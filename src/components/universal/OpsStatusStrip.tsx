import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import {
    fetchAllPoolSummaries,
    formatMicroAmount,
    queryDistributionState,
    queryFactoryNotifyStatus,
    queryPendingChanges,
} from '../../utils/contractQueries';
import { describeRateSource, fetchNativeUsdRate, NativeUsdRate } from '../../utils/nativeUsdPrice';
import { indexerHealth } from '../../utils/indexerApi';
import { NATIVE_SYMBOL } from '../../defi/types';
import { factoryAddress } from './IndividualPage.const';

// Protocol-health strip for the front page. There is no price oracle in
// the protocol any more (commits count in OSMO), so the operational
// signals are the post-threshold payout distributions, factory notify
// retries, the factory's 48h-timelocked pending changes (the timelock's
// value is community observability), and the indexer. The OSMO/USD chip
// is a market reference only.

// How many crossed pools to health-scan (keeps front-page load bounded).
const POOL_SCAN_CAP = 12;

type Tone = 'success' | 'warning' | 'error' | 'default';

interface StripState {
    // OSMO/USD reference rate; null = no price source answered (display
    // only — commits are unaffected).
    usdRate: NativeUsdRate | null;
    pendingNotifies: number;
    stalledDistributions: number;
    activeDistributions: number;
    // In-flight 48h-timelocked factory changes; null = query unsupported.
    pendingChanges: number | null;
    indexerHeight: number | null;
    loaded: boolean;
}

const EMPTY: StripState = {
    usdRate: null,
    pendingNotifies: 0, stalledDistributions: 0, activeDistributions: 0,
    pendingChanges: null,
    indexerHeight: null, loaded: false,
};

const OpsStatusStrip: React.FC = () => {
    const [s, setS] = useState<StripState>(EMPTY);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [rate, idx, pools, pending] = await Promise.all([
                fetchNativeUsdRate().catch(() => null),
                indexerHealth(),
                fetchAllPoolSummaries(factoryAddress).catch(() => []),
                queryPendingChanges().catch(() => null),
            ]);

            const crossed = pools.filter((p) => p.thresholdReached).slice(0, POOL_SCAN_CAP);
            const healths = await Promise.all(crossed.map(async (p) => {
                const [notify, dist] = await Promise.all([
                    queryFactoryNotifyStatus(p.poolAddress),
                    queryDistributionState(p.poolAddress),
                ]);
                return { pending: !!notify.pending, dist };
            }));

            if (cancelled) return;
            setS({
                usdRate: rate,
                pendingNotifies: healths.filter((h) => h.pending).length,
                stalledDistributions: healths.filter((h) => h.dist?.is_stalled).length,
                activeDistributions: healths.filter((h) => h.dist?.is_distributing && !h.dist.is_stalled).length,
                pendingChanges: pending
                    ? (pending.config ? 1 : 0) + (pending.router ? 1 : 0) + (pending.pool_upgrade ? 1 : 0)
                        + pending.pool_configs.length
                    : null,
                indexerHeight: idx?.lastIndexedHeight ?? null,
                loaded: true,
            });
        }
        load();
        const interval = setInterval(load, 60_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    if (!s.loaded) return null;

    // Reference price only: nothing on-chain reads it, so a missing rate
    // is neutral rather than an outage.
    const priceTone: Tone = s.usdRate === null ? 'default' : 'success';
    const priceLabel = s.usdRate === null
        ? `${NATIVE_SYMBOL}/USD: n/a`
        : `${NATIVE_SYMBOL}/USD: $${formatMicroAmount(s.usdRate.rateMicroUsd, 6, 4)}`;
    const priceTip = s.usdRate === null
        ? `No ${NATIVE_SYMBOL}/USD reference price is reachable (Osmosis pool TWAP and CoinGecko both failed). Display only — commits are counted in ${NATIVE_SYMBOL} and are unaffected.`
        : `${NATIVE_SYMBOL}/USD reference from ${describeRateSource(s.usdRate.source)}. Display only — the contracts value commits in ${NATIVE_SYMBOL}, not USD.`;

    const timelockTone: Tone = s.pendingChanges === null ? 'default'
        : s.pendingChanges > 0 ? 'warning' : 'success';
    const timelockLabel = s.pendingChanges === null ? 'Timelock: n/a'
        : s.pendingChanges > 0 ? `Timelock: ${s.pendingChanges} pending` : 'Timelock: clear';
    const timelockTip = s.pendingChanges === null
        ? 'This factory does not expose the pending_changes query.'
        : 'Factory changes proposed by the admin and waiting out the 48h timelock (config replacement, router rotation, pool upgrades, per-pool config). Review them before they become effective.';

    const payoutsTone: Tone = s.stalledDistributions > 0 ? 'error'
        : s.activeDistributions > 0 ? 'warning' : 'success';
    const payoutsLabel = s.stalledDistributions > 0
        ? `Payouts: ${s.stalledDistributions} stalled`
        : s.activeDistributions > 0
            ? `Payouts: ${s.activeDistributions} in progress`
            : 'Payouts: clear';
    const payoutsTip = 'Post-threshold supporter payouts across active pools. Stalled distributions need keeper/admin recovery; in-progress ones clear in batches.';

    const notifyTone: Tone = s.pendingNotifies > 0 ? 'warning' : 'success';
    const notifyLabel = s.pendingNotifies > 0
        ? `Notifies: ${s.pendingNotifies} pending`
        : 'Notifies: clear';
    const notifyTip = 'Factory notifications from threshold crossings awaiting retry. Anyone can call retry_factory_notify to clear them.';

    const indexerTone: Tone = s.indexerHeight === null ? 'default' : 'success';
    const indexerLabel = s.indexerHeight === null ? 'Indexer: offline' : `Indexer: #${s.indexerHeight}`;
    const indexerTip = s.indexerHeight === null
        ? 'No time-series indexer reachable — charts and history panels are disabled; live data is unaffected.'
        : 'Last block height ingested by the time-series indexer.';

    const chips: { label: string; tone: Tone; tip: string }[] = [
        { label: priceLabel, tone: priceTone, tip: priceTip },
        { label: payoutsLabel, tone: payoutsTone, tip: payoutsTip },
        { label: notifyLabel, tone: notifyTone, tip: notifyTip },
        { label: timelockLabel, tone: timelockTone, tip: timelockTip },
        { label: indexerLabel, tone: indexerTone, tip: indexerTip },
    ];

    return (
        <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <MonitorHeartIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" sx={{ mr: 1 }}>Protocol Health</Typography>
                    {chips.map((c) => (
                        <Tooltip key={c.label} title={c.tip} arrow>
                            <Chip
                                size="small"
                                label={c.label}
                                color={c.tone === 'default' ? undefined : c.tone}
                                variant={c.tone === 'success' ? 'outlined' : 'filled'}
                            />
                        </Tooltip>
                    ))}
                </Box>
            </CardContent>
        </Card>
    );
};

export default OpsStatusStrip;
