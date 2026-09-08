import { useEffect, useState } from 'react';
import { formatMicroAmount } from '../utils/bigintMath';
import { fetchNativeUsdRate, microNativeToMicroUsd, NativeUsdRate } from '../utils/nativeUsdPrice';

// OSMO/USD reference rate for display-only conversions (see
// utils/nativeUsdPrice.ts). `undefined` while loading, `null` when no
// price source answered — a page should then show OSMO amounts alone.
export function useNativeUsdRate(refreshMs = 60_000): NativeUsdRate | null | undefined {
    const [rate, setRate] = useState<NativeUsdRate | null | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const r = await fetchNativeUsdRate();
            if (!cancelled) setRate(r);
        };
        load();
        const interval = setInterval(load, refreshMs);
        return () => { cancelled = true; clearInterval(interval); };
    }, [refreshMs]);
    return rate;
}

// "≈ $1,234.56" for a micro-OSMO amount at the given rate; empty string
// while the rate is loading or unavailable (so it can be dropped inline).
export function approxUsd(
    microNative: string | number | bigint | null | undefined,
    rate: NativeUsdRate | null | undefined,
    displayDecimals = 2,
): string {
    if (!rate) return '';
    return `≈ $${formatMicroAmount(microNativeToMicroUsd(microNative, rate.rateMicroUsd), 6, displayDecimals)}`;
}

// "1,234.56 OSMO (≈ $617.28)" — the OSMO amount with the USD hint when
// a rate is available.
export function formatNativeWithUsd(
    microNative: string | number | bigint | null | undefined,
    rate: NativeUsdRate | null | undefined,
    symbol = 'OSMO',
    displayDecimals = 2,
): string {
    const base = `${formatMicroAmount(microNative, 6, displayDecimals)} ${symbol}`;
    const usd = approxUsd(microNative, rate, displayDecimals);
    return usd ? `${base} (${usd})` : base;
}
