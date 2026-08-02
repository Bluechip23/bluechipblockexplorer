import React, { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { formatMicroAmount, queryNativeUsdRate } from '../../utils/contractQueries';
import { NATIVE_SYMBOL } from '../../defi/types';

// Live OSMO/USD price banner for commit surfaces. The factory values
// every commit through the Pyth native/USD price feed configured on it
// (pyth_contract_addr + pyth_native_usd_feed_id), kept fresh on-chain by
// a price keeper. The read fails CLOSED: a stale price (older than
// max_pyth_staleness_seconds), a too-wide confidence interval, or an
// out-of-band rate makes the factory's conversion query error — and
// commits are rejected on-chain until the feed recovers. A failing rate
// here therefore means commits are failing too, which is the state that
// warrants the warning below.
const OracleStatusBanner: React.FC = () => {
    // undefined = still loading, null = query failed, string = micro-USD
    // per native token (1_000_000 = $1.00/OSMO).
    const [rate, setRate] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        async function probe() {
            const info = await queryNativeUsdRate();
            if (cancelled) return;
            setRate(info ? info.rate_used : null);
        }
        probe();
        const interval = setInterval(probe, 30_000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    if (rate === undefined) return null;

    if (rate === null) {
        return (
            <Alert severity="error" sx={{ mb: 1 }}>
                The {NATIVE_SYMBOL}/USD price lookup is failing — the factory could not read a
                fresh Pyth price (stale, low-confidence, or unavailable). Commits are valued
                through this price and will be rejected until the feed recovers.
            </Alert>
        );
    }
    return (
        <Alert severity="info" sx={{ mb: 1 }}>
            Live price: 1 {NATIVE_SYMBOL} ≈ ${formatMicroAmount(rate, 6, 4)} (Pyth oracle —
            commits are valued in USD at this rate).
        </Alert>
    );
};

export default OracleStatusBanner;
