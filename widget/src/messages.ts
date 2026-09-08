// Pure helpers: wire messages and unit conversions. Everything here
// mirrors the contract API in bluechip-contracts (creator-pool commit,
// committing_info / is_fully_commited queries) and is covered by unit
// tests — keep this file free of DOM, wallet, and network access.

/** Convert a user-entered decimal amount to micro-units via string math
 * (no float drift). Throws on malformed or non-positive input. */
export function toMicro(amount: string | number, decimals = 6): string {
    const s = String(amount).trim();
    if (!/^\d+(\.\d+)?$/.test(s)) {
        throw new Error(`Invalid amount: "${s}"`);
    }
    const [whole, frac = ''] = s.split('.');
    if (frac.length > decimals) {
        throw new Error(`Too many decimal places (max ${decimals}): "${s}"`);
    }
    const micro = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
    if (micro <= 0n) throw new Error('Amount must be greater than zero');
    return micro.toString();
}

/** Micro-unit string -> display number (6 decimals unless told otherwise). */
export function fromMicro(micro: string | null | undefined, decimals = 6): number {
    if (!micro || !/^\d+$/.test(micro)) return 0;
    const n = BigInt(micro);
    const base = 10n ** BigInt(decimals);
    return Number(n / base) + Number(n % base) / Number(base);
}

/** Transaction deadline in nanoseconds-since-epoch, as the contracts
 * expect (cosmwasm Timestamp). */
export function deadlineNs(minutesFromNow = 20, nowMs = Date.now()): string {
    return ((nowMs + minutesFromNow * 60_000) * 1_000_000).toString();
}

/** The creator-pool `commit` execute message. Pre-threshold commits are
 * ledger entries (no AMM leg) so belief_price and max_spread must both be
 * null; post-threshold commits route through the AMM and the contract
 * REQUIRES a non-null belief_price (offer-per-ask decimal string, derived
 * from a pool `simulation` query — see beliefPriceFromSimulation) plus a
 * spread guard. */
export function buildCommitMsg(opts: {
    denom: string;
    amountMicro: string;
    thresholdHit: boolean;
    /** Required (non-null) when thresholdHit; must stay null otherwise. */
    beliefPrice?: string | null;
    maxSpread?: string;
    nowMs?: number;
}) {
    if (opts.thresholdHit && !opts.beliefPrice) {
        throw new Error('belief_price is required for post-threshold commits — derive it from the pool simulation query.');
    }
    return {
        commit: {
            asset: {
                info: { bluechip: { denom: opts.denom } },
                amount: opts.amountMicro,
            },
            transaction_deadline: deadlineNs(20, opts.nowMs),
            belief_price: opts.thresholdHit ? opts.beliefPrice! : null,
            max_spread: opts.thresholdHit ? (opts.maxSpread ?? '0.05') : null,
        },
    };
}

/** Funds attached to the commit: exactly one coin of the configured
 * native denom — uosmo on Osmosis (the contract validates with must_pay). */
export function commitFunds(denom: string, amountMicro: string) {
    return [{ denom, amount: amountMicro }];
}

/** Gas budgets, mirroring the contract repo's reference frontend: a
 * pre-threshold commit can be the one that CROSSES the threshold, which
 * creates and seeds the native GAMM pool inside the same tx; a
 * post-threshold commit is a single AMM swap. */
export const COMMIT_GAS_PRE_THRESHOLD = '3000000';
export const COMMIT_GAS_POST_THRESHOLD = '800000';

/** Explicit StdFee for the commit tx. Osmosis enforces a non-zero base
 * fee (EIP-1559-style fee market), so a `{ amount: [], ... }` fee is
 * rejected by mainnet nodes — price the gas at the configured average
 * (0.025uosmo/gas, the Osmosis registry default). */
export function commitFee(denom: string, gasPricePerUnit: number, thresholdHit: boolean) {
    const gas = thresholdHit ? COMMIT_GAS_POST_THRESHOLD : COMMIT_GAS_PRE_THRESHOLD;
    const amount = Math.ceil(Number(gas) * gasPricePerUnit).toString();
    return { amount: [{ denom, amount }], gas };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const IS_FULLY_COMMITED_QUERY = { is_fully_commited: {} } as const; // [sic] contract spelling

export function committingInfoQuery(wallet: string) {
    return { committing_info: { wallet } };
}

/** Pool swap-simulation query for a native-coin offer. Used to derive the
 * belief_price a post-threshold commit must carry. */
export function simulationQuery(denom: string, offerAmountMicro: string) {
    return {
        simulation: {
            offer_asset: {
                info: { bluechip: { denom } },
                amount: offerAmountMicro,
            },
        },
    };
}

/** belief_price for a post-threshold commit: offer-per-ask as an
 * 18-decimal string, from the pool simulation's return_amount. Throws
 * when the simulation yields no (or zero) return_amount — the contract
 * rejects a null belief_price post-threshold, so failing here beats
 * sending a doomed tx. */
export function beliefPriceFromSimulation(
    offerAmountMicro: string,
    returnAmount: string | null | undefined,
): string {
    const ret = Number(returnAmount);
    if (!returnAmount || !Number.isFinite(ret) || ret <= 0) {
        throw new Error('Pool simulation returned no return_amount — cannot derive the belief_price required for a post-threshold commit. Try again or check the pool address.');
    }
    return (Number(offerAmountMicro) / ret).toFixed(18);
}

/** LCD smart-query URL: the query JSON is base64-encoded into the path. */
export function smartQueryUrl(rest: string, contract: string, query: unknown): string {
    const json = JSON.stringify(query);
    // btoa in browsers, Buffer under Node (tests).
    const b64 = typeof btoa === 'function'
        ? btoa(json)
        : Buffer.from(json, 'utf8').toString('base64');
    return `${rest.replace(/\/$/, '')}/cosmwasm/wasm/v1/contract/${contract}/smart/${encodeURIComponent(b64)}`;
}

/** On-chain per-wallet commit record (creator-pool `committing_info`).
 * The query returns null for wallets that never committed. Every amount
 * is micro-OSMO: the contracts have no price oracle, so a commit is
 * recorded (and counts toward the pool's threshold) at exactly the OSMO
 * attached. `total_paid_native` is the wallet's cumulative GROSS (pre-fee)
 * OSMO committed; `total_paid_bluechip` carries the same value and is
 * kept by the contract for response-shape stability. */
export interface CommitRecord {
    committer: string;
    total_paid_native: string;    // gross micro-OSMO, cumulative
    total_paid_bluechip: string;  // same value (compat)
    last_committed: string;       // nanoseconds
    last_payment_native: string;  // gross micro-OSMO of the last commit
    last_payment_bluechip: string;
}

export interface GateResult {
    subscribed: boolean;
    /** Total lifetime OSMO committed (whole OSMO, gross before fees). */
    totalOsmo: number;
    /** Raw on-chain record, null if the wallet never committed. */
    record: CommitRecord | null;
}

/** Gate on the wallet's lifetime OSMO committed. `minOsmo` is the site's
 * own floor in whole OSMO (0 = any commit record passes). */
export function evaluateGate(record: CommitRecord | null, minOsmo = 0): GateResult {
    const totalOsmo = fromMicro(record?.total_paid_native);
    return {
        subscribed: record !== null && totalOsmo >= minOsmo,
        totalOsmo,
        record,
    };
}
