import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import {
    fetchAllPoolSummaries,
    formatMicroAmount,
    queryBluechipOraclePrice,
    queryDistributionState,
    queryExpandEconomyReserve,
    queryFactoryNotifyStatus,
} from '../../utils/contractQueries';
import { indexerHealth } from '../../utils/indexerApi';
import { factoryAddress } from './IndividualPage.const';

// Protocol-health strip for the front page. The system fails closed —
// a stale oracle stops commits and pool creation within ~2 minutes —
// so surfacing these four signals publicly turns "the site is broken"
// support pings into "the oracle is 90s stale, it will self-heal".
// Mirrors the canary described in the contracts repo's RUNBOOK.md.

// Pool-side gate (MAX_ORACLE_STALENESS_SECONDS): commits reject past this.
const ORACLE_STALE_SECONDS = 120;
// Expand-economy reserve warning floor: ~2 threshold crossings at the
// default ~500 bluechip/cross reward.
const EXPAND_WARN_MICRO = 1_000_000_000n;
// How many crossed pools to health-scan (keeps front-page load bounded).
const POOL_SCAN_CAP = 12;

type Tone = 'success' | 'warning' | 'error' | 'default';

interface StripState {
    oracleAgeSec: number | null;
    oraclePrice: string | null;
    expandAmount: string | null;
    pendingNotifies: number;
    stalledDistributions: number;
    activeDistributions: number;
    indexerHeight: number | null;
    loaded: boolean;
}

const EMPTY: StripState = {
    oracleAgeSec: null, oraclePrice: null, expandAmount: null,
    pendingNotifies: 0, stalledDistributions: 0, activeDistributions: 0,
    indexerHeight: null, loaded: false,
};

const OpsStatusStrip: React.FC = () => {
    const [s, setS] = useState<StripState>(EMPTY);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [oracle, expand, idx, pools] = await Promise.all([
                queryBluechipOraclePrice(),
                queryExpandEconomyReserve(),
                indexerHealth(),
                fetchAllPoolSummaries(factoryAddress).catch(() => []),
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
                oracleAgeSec: oracle ? Math.max(0, Math.floor(Date.now() / 1000) - oracle.timestamp) : null,
                oraclePrice: oracle?.price ?? null,
                expandAmount: expand?.amount ?? null,
                pendingNotifies: healths.filter((h) => h.pending).length,
                stalledDistributions: healths.filter((h) => h.dist?.is_stalled).length,
                activeDistributions: healths.filter((h) => h.dist?.is_distributing && !h.dist.is_stalled).length,
                indexerHeight: idx?.lastIndexedHeight ?? null,
                loaded: true,
            });
        }
        load();
        const interval = setInterval(load, 60_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    if (!s.loaded) return null;

    const oracleTone: Tone = s.oracleAgeSec === null
        ? 'error'
        : s.oracleAgeSec > ORACLE_STALE_SECONDS ? 'error'
        : s.oracleAgeSec > ORACLE_STALE_SECONDS * 0.75 ? 'warning'
        : 'success';
    const oracleLabel = s.oracleAgeSec === null
        ? 'Oracle: unreachable'
        : `Oracle: ${s.oracleAgeSec}s ago`;
    const oracleTip = s.oracleAgeSec === null
        ? 'The price oracle is not answering — commits and pool creation are failing closed until it recovers.'
        : s.oracleAgeSec > ORACLE_STALE_SECONDS
            ? `Last price update ${s.oracleAgeSec}s ago — past the ${ORACLE_STALE_SECONDS}s gate, commits are being rejected until the next oracle round.`
            : `Bluechip/USD price ${s.oraclePrice ? '$' + formatMicroAmount(s.oraclePrice, 6, 4) : ''}, updated ${s.oracleAgeSec}s ago (gate: ${ORACLE_STALE_SECONDS}s).`;

    const expandTone: Tone = s.expandAmount === null
        ? 'warning'
        : BigInt(s.expandAmount) < EXPAND_WARN_MICRO ? 'warning' : 'success';
    const expandLabel = s.expandAmount === null
        ? 'Rewards reserve: n/a'
        : `Rewards reserve: ${formatMicroAmount(s.expandAmount, 6, 0)}`;
    const expandTip = 'Bluechip held by the expand-economy contract — threshold-crossing rewards are paid from it. If it runs dry, crossings defer until it is topped up.';

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
    const notifyTip = 'Factory notifications from threshold crossings awaiting retry. Anyone can call retry_factory_notify; persistent pendings usually mean an expand-economy misconfiguration.';

    const indexerTone: Tone = s.indexerHeight === null ? 'default' : 'success';
    const indexerLabel = s.indexerHeight === null ? 'Indexer: offline' : `Indexer: #${s.indexerHeight}`;
    const indexerTip = s.indexerHeight === null
        ? 'No time-series indexer reachable — charts and history panels are disabled; live data is unaffected.'
        : 'Last block height ingested by the time-series indexer.';

    const chips: { label: string; tone: Tone; tip: string }[] = [
        { label: oracleLabel, tone: oracleTone, tip: oracleTip },
        { label: expandLabel, tone: expandTone, tip: expandTip },
        { label: payoutsLabel, tone: payoutsTone, tip: payoutsTip },
        { label: notifyLabel, tone: notifyTone, tip: notifyTip },
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
