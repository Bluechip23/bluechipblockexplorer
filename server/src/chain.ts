// On-chain subscription check against the BlueChip creator-pool contract.
// The pool's `committing_info { wallet }` smart query returns the wallet's
// commit record (or null if it never committed). The chain never expires
// that record; BlueChip's policy is that one commit buys a fixed access
// window (30 days by default), measured from `last_committed`, so a
// subscription is "active" only while the last commit is recent enough.
// Committing again renews it.

import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

export interface CommittingInfo {
    total_paid_native: string;  // gross micro-OSMO committed (string)
    last_committed: string;     // nanosecond timestamp string
    [key: string]: unknown;
}

let clientPromise: Promise<CosmWasmClient> | null = null;

function getClient(rpcUrl: string): Promise<CosmWasmClient> {
    if (!clientPromise) {
        clientPromise = CosmWasmClient.connect(rpcUrl).catch((err) => {
            // Do not cache a failed connection — allow the next request to retry.
            clientPromise = null;
            throw err;
        });
    }
    return clientPromise;
}

/**
 * Returns the wallet's commit record for the pool, or null when the wallet
 * has never committed. Throws when the RPC / contract query itself fails so
 * callers can distinguish "not subscribed" from "could not check".
 */
export async function queryCommittingInfo(
    rpcUrl: string,
    poolAddress: string,
    wallet: string,
): Promise<CommittingInfo | null> {
    const client = await getClient(rpcUrl);
    const info = await client.queryContractSmart(poolAddress, {
        committing_info: { wallet },
    });
    return (info ?? null) as CommittingInfo | null;
}

/** Default access window one commit buys, in days. */
export const DEFAULT_SUBSCRIPTION_DAYS = 30;

/** `last_committed` (nanoseconds) → unix milliseconds, or null if unparseable. */
export function lastCommittedMs(info: CommittingInfo): number | null {
    try {
        const ns = BigInt(info.last_committed);
        if (ns <= 0n) return null;
        return Number(ns / 1_000_000n);
    } catch {
        return null;
    }
}

/** Unix milliseconds at which the record's access window ends. */
export function subscriptionExpiresAtMs(info: CommittingInfo, days: number): number | null {
    const ms = lastCommittedMs(info);
    return ms === null ? null : ms + days * 86_400_000;
}

/** True while the wallet's last commit is within the access window. */
export function isSubscriptionActive(info: CommittingInfo | null, days: number, nowMs = Date.now()): boolean {
    if (!info) return false;
    const expires = subscriptionExpiresAtMs(info, days);
    return expires !== null && expires > nowMs;
}
