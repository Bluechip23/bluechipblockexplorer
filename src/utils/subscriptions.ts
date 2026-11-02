// Subscription discovery: which creator pools has a wallet committed to?
//
// The chain exposes commits per POOL (pool_commits), not per wallet. The
// indexer's /wallets/:address/pools endpoint answers "which pools has this
// wallet ever committed to?" in one call, so the fast path asks it for the
// candidate list and then reads the wallet's live record (committing_info)
// on just those pools — the chain stays the source of truth for amounts
// and the access window. When the indexer is unreachable (or in demo
// mode) the slow path scans every factory pool's committer ledger, which
// is correct but linear in pool count. Shared by the holdings portfolio
// ("Pools I Committed To"), the subscriber feed and the nav badge so all
// three agree on what "subscribed" means.

import { MyCommitment } from '../components/portfolio/types';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import {
    CommitterInfo,
    fetchAllPoolSummaries,
    getDataSource,
    PoolSummary,
    queryCommittingInfo,
    queryPoolCommits,
} from './contractQueries';
import { nsToDate } from './datetime';
import { getCosmWasmClient } from './chainQueries';
import { fetchWalletPools, indexerHealth } from './indexerApi';

// How far behind the chain head the indexer's cursor may be before its
// answer is distrusted. An empty answer from an indexer that is still
// backfilling (or stuck) would hide real subscriptions, so beyond this
// the slow path runs instead. ~100 Osmosis blocks is a few minutes.
const INDEXER_MAX_LAG_BLOCKS = 100;

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
 * Finds every pool `address` has committed to.
 *
 * Fast path: the indexer names the candidate pools, and only those are
 * asked for the wallet's live committing_info record. Slow path (indexer
 * unreachable, or demo mode, whose pools the indexer has never seen):
 * every factory pool's committer ledger is scanned for the wallet.
 * `isCancelled` lets a React effect abandon a long scan after unmount; the
 * returned commitments are whatever was found before cancellation.
 */
export async function scanSubscriptions(
    address: string,
    isCancelled: () => boolean = () => false,
): Promise<SubscriptionScan> {
    if (!address || !factoryAddress) return { pools: [], commitments: [] };
    const pools = await fetchAllPoolSummaries(factoryAddress);

    const candidates = await candidatePoolsFromIndexer(address, pools);
    const commitments = candidates !== null
        ? await confirmOnChain(address, candidates, isCancelled)
        : await scanEveryPool(address, pools, isCancelled);

    // Batches settle in order, but entries inside a batch land in
    // RPC-return order — restore registry order for stable rendering.
    const order = new Map(pools.map((p, idx) => [p.poolAddress, idx]));
    commitments.sort((a, b) => (order.get(a.pool.poolAddress) ?? 0) - (order.get(b.pool.poolAddress) ?? 0));
    return { pools, commitments };
}

/**
 * The registry pools the indexer has seen `address` commit to, or null
 * when the indexer can't answer (unreachable, or demo mode). Pools the
 * indexer knows but the registry doesn't (a stale indexer database
 * pointed at an older factory) are dropped, since there is no summary to
 * render for them.
 */
async function candidatePoolsFromIndexer(address: string, pools: PoolSummary[]): Promise<PoolSummary[] | null> {
    if ((await getDataSource()) !== 'chain') return null;
    if (!(await indexerIsCurrent())) return null;
    const indexed = await fetchWalletPools(address);
    if (indexed === null) return null;
    const committed = new Set(indexed.map((p) => p.pool));
    return pools.filter((p) => committed.has(p.poolAddress));
}

// True when the indexer is reachable and its cursor is within
// INDEXER_MAX_LAG_BLOCKS of the chain head. A chain-height failure is
// treated as "can't tell" and the indexer is trusted — the slow path
// would be hitting the same RPC anyway.
async function indexerIsCurrent(): Promise<boolean> {
    const health = await indexerHealth();
    if (!health?.ok || health.lastIndexedHeight === null) return false;
    try {
        const head = await (await getCosmWasmClient()).getHeight();
        return head - health.lastIndexedHeight <= INDEXER_MAX_LAG_BLOCKS;
    } catch {
        return true;
    }
}

// Read the wallet's live record on each candidate pool. A candidate the
// chain no longer has a record for (it can't happen today — commit records
// never expire — but a re-deployed pool at the same address would do it)
// is simply skipped.
async function confirmOnChain(
    address: string,
    candidates: PoolSummary[],
    isCancelled: () => boolean,
): Promise<MyCommitment[]> {
    const commitments: MyCommitment[] = [];
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        if (isCancelled()) break;
        const batch = candidates.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (pool) => {
            const mine = await queryCommittingInfo(pool.poolAddress, address);
            if (mine) commitments.push({ pool, commit: mine });
        }));
    }
    return commitments;
}

// No indexer: walk every pool's committer ledger looking for the wallet.
async function scanEveryPool(
    address: string,
    pools: PoolSummary[],
    isCancelled: () => boolean,
): Promise<MyCommitment[]> {
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
    return commitments;
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
