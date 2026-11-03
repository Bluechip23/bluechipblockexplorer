"use strict";
// Pure subscription-gate math, kept apart from api.ts so it can be unit
// tested without HTTP, signing or an RPC. All money is micro-OSMO integer
// strings compared as BigInt — never floats.
//
// The model: one commit buys `subscriptionDays` of access (measured from
// committing_info.last_committed), and the size of that commit
// (last_payment_native, gross micro-OSMO) decides which tiers it covers.
// A tier priced at 20 OSMO is "commit at least 20 OSMO per access window";
// a bigger commit also covers every cheaper tier. Committing again renews
// the window at whatever tier the new payment covers.
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkGates = linkGates;
exports.qualifiesForLink = qualifiesForLink;
exports.standingFrom = standingFrom;
exports.parseMicro = parseMicro;
const chain_1 = require("./chain");
/**
 * The gates of one gated link: pool → the cheapest price that unlocks it on
 * that pool.
 *
 * - With tiers attached, each pool's gate is its cheapest attached tier, so
 *   paying for a higher tier grants the lower ones.
 * - With no tiers (the original "subscribers only" switch), any active
 *   subscription to the creator's profile pool unlocks it: a 0 gate on
 *   `profilePool`. A creator with no profile pool gets no gates, so only
 *   the owner can see such a link.
 */
function linkGates(tiers, profilePool) {
    const gates = new Map();
    if (tiers.length === 0) {
        if (profilePool)
            gates.set(profilePool, 0n);
        return gates;
    }
    for (const t of tiers) {
        let price;
        try {
            price = BigInt(t.price_native);
        }
        catch {
            continue; // ignore malformed prices defensively
        }
        const current = gates.get(t.pool_address);
        if (current === undefined || price < current)
            gates.set(t.pool_address, price);
    }
    return gates;
}
/**
 * A link unlocks when, for ANY of its gate pools, the caller has an active
 * subscription whose last payment is at least that pool's gate price.
 * Cross-pool is OR. `standings` maps a pool to the caller's standing, or
 * null when the caller never committed there.
 */
function qualifiesForLink(gates, standings) {
    for (const [pool, price] of gates) {
        const s = standings.get(pool);
        if (s && s.active && s.lastPayment >= price)
            return true;
    }
    return false;
}
/** committing_info → standing (null record = never committed). */
function standingFrom(info, days, nowMs = Date.now()) {
    if (!info)
        return null;
    return {
        active: (0, chain_1.isSubscriptionActive)(info, days, nowMs),
        lastPayment: parseMicro(info.last_payment_native),
    };
}
/** Parse an on-chain micro amount; malformed values count as 0 paid. */
function parseMicro(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value))
        return 0n;
    try {
        return BigInt(value);
    }
    catch {
        return 0n;
    }
}
//# sourceMappingURL=gate.js.map