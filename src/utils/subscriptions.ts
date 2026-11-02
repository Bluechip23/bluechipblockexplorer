// Subscription discovery: which creator pools has a wallet committed to?
//
// The chain exposes commits per POOL (pool_commits), not per wallet, so the
// only authoritative way to list a wallet's subscriptions is to scan every
// factory pool's committer ledger for the wallet. Shared by the holdings
// portfolio ("Pools I Committed To") and the subscriber feed so both agree
// on what "subscribed" means.

import { MyCommitment } from '../components/portfolio/types';
import { factoryAddress } from '../components/universal/IndividualPage.const';
import { fetchAllPoolSummaries, PoolSummary, queryPoolCommits } from './contractQueries';

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
