"use strict";
// On-chain subscription check against the BlueChip creator-pool contract.
// The pool's `committing_info { wallet }` smart query returns the wallet's
// commit record (or null if it never committed). The chain never expires
// that record; BlueChip's policy is that one commit buys a fixed access
// window (30 days by default), measured from `last_committed`, so a
// subscription is "active" only while the last commit is recent enough.
// Committing again renews it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUBSCRIPTION_DAYS = void 0;
exports.queryCommittingInfo = queryCommittingInfo;
exports.lastCommittedMs = lastCommittedMs;
exports.subscriptionExpiresAtMs = subscriptionExpiresAtMs;
exports.isSubscriptionActive = isSubscriptionActive;
const cosmwasm_stargate_1 = require("@cosmjs/cosmwasm-stargate");
let clientPromise = null;
function getClient(rpcUrl) {
    if (!clientPromise) {
        clientPromise = cosmwasm_stargate_1.CosmWasmClient.connect(rpcUrl).catch((err) => {
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
async function queryCommittingInfo(rpcUrl, poolAddress, wallet) {
    const client = await getClient(rpcUrl);
    const info = await client.queryContractSmart(poolAddress, {
        committing_info: { wallet },
    });
    return (info ?? null);
}
/** Default access window one commit buys, in days. */
exports.DEFAULT_SUBSCRIPTION_DAYS = 30;
/** `last_committed` (nanoseconds) → unix milliseconds, or null if unparseable. */
function lastCommittedMs(info) {
    try {
        const ns = BigInt(info.last_committed);
        if (ns <= 0n)
            return null;
        return Number(ns / 1000000n);
    }
    catch {
        return null;
    }
}
/** Unix milliseconds at which the record's access window ends. */
function subscriptionExpiresAtMs(info, days) {
    const ms = lastCommittedMs(info);
    return ms === null ? null : ms + days * 86_400_000;
}
/** True while the wallet's last commit is within the access window. */
function isSubscriptionActive(info, days, nowMs = Date.now()) {
    if (!info)
        return false;
    const expires = subscriptionExpiresAtMs(info, days);
    return expires !== null && expires > nowMs;
}
//# sourceMappingURL=chain.js.map