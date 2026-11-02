// Subscription discovery: which creator pools has a wallet committed to?
//
// The chain exposes commits per POOL (pool_commits), not per wallet, so the
// only authoritative way to list a wallet's subscriptions is to scan every
// factory pool's committer ledger for the wallet. Shared by the holdings
// portfolio ("Pools I Committed To") and the subscriber feed so both agree
// on what "subscribed" means.

import { MyCommitment } from '../components/portfolio/types';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import { CommitterInfo, fetchAllPoolSummaries, PoolSummary, queryPoolCommits } from './contractQueries';
import { nsToDate } from './datetime';

// ---------------------------------------------------------------------------
// Access window. The chain never expires a commit record; BlueChip's policy
// is that one commit buys SUBSCRIPTION_PERIOD_DAYS of access measured from
// `last_committed`, and committing again renews it. The profiles service
// enforces the same window server-side (PROFILES_SUBSCRIPTION_DAYS).
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_PERIOD_DAYS = 30;

/** When the wallet's access from this commit record ends, or null if unknown. */
export function subscriptionExpiresAt(commit: Pick<CommitterInfo, 'last_committed'>): Date | null {
    const last = nsToDate(commit.last_committed);
    return last ? new Date(last.getTime() + SUBSCRIPTION_PERIOD_DAYS * 86_400_000) : null;
}

/** True while the last commit is within the access window. */
export function isSubscriptionActive(commit: Pick<CommitterInfo, 'last_committed'>, now = Date.now()): boolean {
    const expires = subscriptionExpiresAt(commit);
    return expires !== null && expires.getTime() > now;
}

/** Days of access left (rounded up), 0 once expired. */
export function subscriptionDaysLeft(commit: Pick<CommitterInfo, 'last_committed'>, now = Date.now()): number {
    const expires = subscriptionExpiresAt(commit);
    if (!expires) return 0;
    return Math.max(0, Math.ceil((expires.getTime() - now) / 86_400_000));
}

// Pools are scanned a few at a time to keep concurrent RPC requests bounded.
const BATCH_SIZE = 3;

export interface SubscriptionScan {
    /** Every factory pool (reused by callers that need the full registry). */
    pools: PoolSummary[];
    /** Pools where `address` has a commit record, in registry order. */
    commitments: MyCommitment[];
}

/**
 * Scans the factory registry for every pool `address` has committed to.
 * `isCancelled` lets a React effect abandon a long scan after unmount; the
 * returned commitments are whatever was found before cancellation.
 */
export async function scanSubscriptions(
    address: string,
    isCancelled: () => boolean = () => false,
): Promise<SubscriptionScan> {
    if (!address || !factoryAddress) return { pools: [], commitments: [] };
    const pools = await fetchAllPoolSummaries(factoryAddress);
    const commitments: MyCommitment[] = [];
    for (let i = 0; i < pools.length; i += BATCH_SIZE) {
        if (isCancelled()) break;
        const batch = pools.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (pool) => {
            const commits = await queryPoolCommits(pool.poolAddress);
            const mine = commits?.committers.find((c) => c.wallet === address);
            if (mine) commitments.push({ pool, commit: mine });
        }));
    }
    // Promise.all settles batches in order, but entries inside a batch land
    // in RPC-return order — restore registry order for stable rendering.
    const order = new Map(pools.map((p, idx) => [p.poolAddress, idx]));
    commitments.sort((a, b) => (order.get(a.pool.poolAddress) ?? 0) - (order.get(b.pool.poolAddress) ?? 0));
    return { pools, commitments };
}

// ---------------------------------------------------------------------------
// Short-lived cache so the nav badge and the feed page don't each rescan
// every pool on every navigation. Pages that show commit amounts (the
// holdings portfolio) still call scanSubscriptions() directly.
// ---------------------------------------------------------------------------

const SCAN_CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { address: string; at: number; promise: Promise<SubscriptionScan> } | null = null;

export function scanSubscriptionsCached(address: string, force = false): Promise<SubscriptionScan> {
    const now = Date.now();
    if (!force && cached && cached.address === address && now - cached.at < SCAN_CACHE_TTL_MS) {
        return cached.promise;
    }
    const promise = scanSubscriptions(address).catch((err) => {
        // Don't cache a failure — let the next caller retry.
        if (cached?.promise === promise) cached = null;
        throw err;
    });
    cached = { address, at: now, promise };
    return promise;
}
