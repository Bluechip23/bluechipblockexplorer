import React, { useEffect, useState } from 'react';
import { Alert, Stack } from '@mui/material';
import {
    DistributionStateResponse,
    formatMicroAmount,
    queryDistributionState,
    queryPoolIsPaused,
} from '../../utils/contractQueries';

// Public-facing operational state for a pool: paused, payout
// distribution stalled, or distribution in progress. Mounted on the
// pool page so traders see WHY a transaction would fail before they
// sign it (previously this was only visible on the creator's earnings
// tab). Renders nothing when the pool is healthy.
const PoolStatusBanners: React.FC<{ poolAddress: string; tokenSymbol?: string }> = ({ poolAddress, tokenSymbol }) => {
    const [paused, setPaused] = useState(false);
    const [distribution, setDistribution] = useState<DistributionStateResponse | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const [isPaused, dist] = await Promise.all([
                queryPoolIsPaused(poolAddress),
                queryDistributionState(poolAddress),
            ]);
            if (cancelled) return;
            setPaused(isPaused);
            setDistribution(dist);
        }
        load();
        return () => { cancelled = true; };
    }, [poolAddress]);

    const symbol = tokenSymbol || 'creator tokens';
    const banners: React.ReactNode[] = [];

    if (paused) {
        banners.push(
            <Alert key="paused" severity="error">
                This pool is currently <strong>paused</strong> — commits, swaps, and liquidity
                actions are rejected on-chain until an administrator unpauses it.
            </Alert>
        );
    }
    if (distribution?.is_stalled) {
        banners.push(
            <Alert key="stalled" severity="error">
                The threshold payout distribution is <strong>stalled</strong> with{' '}
                {distribution.distributions_remaining} supporter payouts remaining. Payouts resume
                after the pool admin runs stuck-state recovery; trading is unaffected.
            </Alert>
        );
    } else if (distribution?.is_distributing) {
        banners.push(
            <Alert key="distributing" severity="info">
                Threshold payout distribution in progress: {distribution.distributions_remaining}{' '}
                supporter payouts remaining ({formatMicroAmount(distribution.distributed_so_far)} of{' '}
                {formatMicroAmount(distribution.total_to_distribute)} {symbol} minted so far).
            </Alert>
        );
    }

    if (banners.length === 0) return null;
    return <Stack spacing={1}>{banners}</Stack>;
};

export default PoolStatusBanners;
