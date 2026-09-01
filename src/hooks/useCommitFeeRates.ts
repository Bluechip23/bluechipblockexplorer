import { useEffect, useState } from 'react';
import { queryFactoryConfig } from '../utils/contractQueries';

// Commit fee rates in basis points, read from the factory's on-chain
// config (commit_fee_creator / commit_fee_bluechip are Decimal strings
// like "0.05"). The defaults mirror the deployed configuration and are
// used until the factory query resolves (or when it fails).

export interface CommitFeeRates {
    creatorBps: bigint;    // creator's share of every commit (500n = 5%)
    platformBps: bigint;   // platform's share (100n = 1%)
}

export const DEFAULT_COMMIT_FEE_RATES: CommitFeeRates = {
    creatorBps: 500n,
    platformBps: 100n,
};

function decimalToBps(s: string | undefined): bigint | null {
    const n = Number.parseFloat(s ?? '');
    if (!Number.isFinite(n) || n < 0 || n > 1) return null;
    return BigInt(Math.round(n * 10_000));
}

// One fetch per session: the factory config is effectively static.
let cached: CommitFeeRates | null = null;

export async function fetchCommitFeeRates(): Promise<CommitFeeRates> {
    if (cached) return cached;
    try {
        const cfg = await queryFactoryConfig();
        const creatorBps = decimalToBps(cfg?.commit_fee_creator);
        const platformBps = decimalToBps(cfg?.commit_fee_bluechip);
        if (creatorBps !== null && platformBps !== null) {
            cached = { creatorBps, platformBps };
            return cached;
        }
    } catch {
        // fall through to defaults; not cached so a later mount retries
    }
    return DEFAULT_COMMIT_FEE_RATES;
}

export function useCommitFeeRates(): CommitFeeRates {
    const [rates, setRates] = useState<CommitFeeRates>(cached ?? DEFAULT_COMMIT_FEE_RATES);
    useEffect(() => {
        let cancelled = false;
        fetchCommitFeeRates().then((r) => { if (!cancelled) setRates(r); });
        return () => { cancelled = true; };
    }, []);
    return rates;
}

/** "500n" -> "5", "125n" -> "1.25" — for labels like "Your 5% share". */
export function bpsPct(bps: bigint): string {
    return (Number(bps) / 100).toString();
}

/** The fee share of a micro-unit amount at the given rate. */
export function feeShare(amountMicro: bigint, bps: bigint): bigint {
    return (amountMicro * bps) / 10_000n;
}
