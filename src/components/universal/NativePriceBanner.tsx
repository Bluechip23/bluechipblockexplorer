import React from 'react';
import { Alert } from '@mui/material';
import { formatMicroAmount } from '../../utils/bigintMath';
import { describeRateSource } from '../../utils/nativeUsdPrice';
import { useNativeUsdRate } from '../../hooks/useNativeUsdRate';
import { NATIVE_SYMBOL } from '../../defi/types';

// OSMO/USD reference banner for commit surfaces. Since the oracle
// removal the contracts value nothing in USD: a commit counts toward the
// pool's threshold at exactly the OSMO attached, and the minimum commit
// is an OSMO amount too. The price shown here is an off-contract market
// reference (Osmosis pool TWAP, CoinGecko fallback) so people can gauge
// what their OSMO is worth — it never gates or prices a commit, so an
// unavailable price is informational, not an outage.
const NativePriceBanner: React.FC = () => {
    const rate = useNativeUsdRate(30_000);

    if (rate === undefined) return null;

    if (rate === null) {
        return (
            <Alert severity="info" sx={{ mb: 1 }}>
                Commits are counted in {NATIVE_SYMBOL} — the attached amount is exactly what counts toward
                the threshold. (No USD reference price is available right now; commits are unaffected.)
            </Alert>
        );
    }
    return (
        <Alert severity="info" sx={{ mb: 1 }}>
            Commits are counted in {NATIVE_SYMBOL}. For reference, 1 {NATIVE_SYMBOL} ≈ $
            {formatMicroAmount(rate.rateMicroUsd, 6, 4)} ({describeRateSource(rate.source)}) — the contracts
            do not use this price.
        </Alert>
    );
};

export default NativePriceBanner;
