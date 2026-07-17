import { ClaimRow, CommitRow, LiquidityRow, PoolRow, TradeRow } from './db';
import { decodeEventAttrs, RawEvent } from './rpc';

// Pure event -> row mapping. Attribute keys mirror the Osmosis-native
// contracts exactly:
//
//   commit (creator-pool/src/commit.rs + commit/*.rs):
//     action=commit, phase, committer, total_commit_count, pool_contract,
//     block_height, block_time + per-phase amount attributes:
//       funding             – pre-threshold commit:
//                             commit_amount_bluechip (micro-OSMO),
//                             total_raised_after (running total, micro-USD),
//                             total_bluechip_raised_after (net micro-OSMO)
//       active              – post-threshold commit routed through the
//                             Osmosis AMM: commit_amount_bluechip,
//                             swap_amount_bluechip, token_out_min_amount,
//                             pool_id
//       threshold_crossing  – the commit that pushed past the threshold:
//                             total_amount_bluechip,
//                             threshold_amount_bluechip,
//                             bluechip_excess_refunded
//       threshold_hit_exact – hit the threshold exactly (no excess swap):
//                             commit_amount_bluechip, total_raised_after
//     Legacy (pre-Osmosis) commits also carried per-commit USD attributes
//     (commit_amount_usd, total_usd_raised_after, threshold_amount_usd,
//     swap_amount_usd) — no longer emitted, still parsed when present so
//     historical backfills keep their USD figures.
//   swap (pool-core/src/swap.rs):
//     action=swap, sender, receiver, offer_asset, ask_asset, offer_amount,
//     token_out_min_amount, pool_id, pool_contract, ... — legacy swaps
//     also carried return_amount, spread_amount, commission_amount,
//     reserve0_after, reserve1_after.
//   creator claims (creator-pool/src/liquidity_helpers.rs):
//     action=claim_creator_excess (bluechip_amount/token_amount)
//   factory pool discovery (factory/src/pool_creation_reply.rs):
//     action=pool_created_successfully (pool_address, pool_id). The
//     creator token is a native TokenFactory denom
//     (factory/{pool}/{subdenom}); the pool's own instantiate event —
//     same tx as the factory reply — carries it as token_denom.
//
//   Legacy actions (pre-Osmosis contracts; will not occur on current
//   chains, kept only so historical backfills still index):
//     liquidity: deposit_liquidity | add_to_position | remove_liquidity |
//       remove_partial_liquidity | collect_fees
//     claim_creator_fees (amount_0/amount_1)
//     standard_pool_created_successfully (standard pools no longer exist)
//     token_created_successfully (token_address = CW20 contract address,
//       from when creator tokens were CW20s)

export interface ParsedTx {
    pools: PoolRow[];
    // token_denom is the creator token's native TokenFactory denom
    // (factory/{pool}/{subdenom}); for legacy pools it is the CW20
    // contract address.
    poolTokens: { pool_id: number; token_denom: string }[];
    thresholdCrossings: { pool: string; ts: number }[];
    commits: CommitRow[];
    trades: TradeRow[];
    liquidity: LiquidityRow[];
    claims: ClaimRow[];
}

export interface TxContext {
    txhash: string;
    height: number;
    ts: number;            // block time, unix seconds
    nativeDenom: string;   // canonical native denom, e.g. "uosmo"
    // When set, pool-discovery events are only accepted from this
    // contract address (the factory).
    factoryAddress: string | null;
}

// Legacy (pre-Osmosis) pool-managed liquidity actions. The current
// contracts have no liquidity entry points (liquidity lives in Osmosis
// pools), so these only appear when backfilling historical chains.
const LIQUIDITY_ACTIONS = new Set([
    'deposit_liquidity',
    'add_to_position',
    'remove_liquidity',
    'remove_partial_liquidity',
    'collect_fees',
]);

function num(s: string | undefined): number | null {
    if (s === undefined) return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

// Sum two micro-unit attribute strings; null when neither is present or
// either is malformed.
function sumMicro(a: string | undefined, b: string | undefined): string | null {
    if (a === undefined && b === undefined) return null;
    try {
        return (BigInt(a ?? '0') + BigInt(b ?? '0')).toString();
    } catch {
        return null;
    }
}

// OSMO-per-token price from micro amounts (decimals cancel: both
// sides are 6-decimal assets). Display-grade only.
function ratioPrice(bluechipMicro: string | undefined, tokenMicro: string | undefined): number | null {
    const b = num(bluechipMicro);
    const t = num(tokenMicro);
    if (b === null || t === null || t === 0) return null;
    return b / t;
}

export function parseTxEvents(ctx: TxContext, events: RawEvent[]): ParsedTx {
    const out: ParsedTx = {
        pools: [], poolTokens: [], thresholdCrossings: [],
        commits: [], trades: [], liquidity: [], claims: [],
    };

    // Creator-token TokenFactory denoms announced by pool instantiate
    // events in this tx, keyed by pool address. Joined to the factory's
    // pool_id after the event walk (the factory's
    // pool_created_successfully reply lands in the same tx).
    const denomByPool = new Map<string, string>();

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type !== 'wasm') continue;
        const a = decodeEventAttrs(ev);
        const contract = a['_contract_address'];
        const action = a['action'];
        if (!action) continue;

        const base = { txhash: ctx.txhash, event_index: i, height: ctx.height, ts: ctx.ts };

        switch (action) {
            // ---- factory: pool discovery -------------------------------
            // standard_pool_created_successfully is legacy: the Osmosis-
            // native factory only creates commit pools.
            case 'pool_created_successfully':
            case 'standard_pool_created_successfully': {
                if (ctx.factoryAddress && contract !== ctx.factoryAddress) break;
                const address = a['pool_address'];
                if (!address) break;
                out.pools.push({
                    address,
                    pool_id: a['pool_id'] !== undefined ? parseInt(a['pool_id'], 10) : null,
                    kind: action === 'pool_created_successfully' ? 'commit' : 'standard',
                    created_height: ctx.height,
                    created_at: ctx.ts,
                });
                break;
            }
            // The pool announces its creator token's TokenFactory denom
            // (factory/{pool}/{subdenom}) on its own instantiate event;
            // it is only accepted once joined to a factory-verified
            // pool_created_successfully event below.
            case 'instantiate': {
                const pool = a['pool_contract'] || contract;
                const denom = a['token_denom'];
                if (pool && denom) denomByPool.set(pool, denom);
                break;
            }
            // Legacy: pre-Osmosis creator tokens were CW20 contracts and
            // the factory announced their address as token_address.
            case 'token_created_successfully': {
                if (ctx.factoryAddress && contract !== ctx.factoryAddress) break;
                const tokenDenom = a['token_denom'] ?? a['token_address'];
                const poolId = a['pool_id'] !== undefined ? parseInt(a['pool_id'], 10) : NaN;
                if (tokenDenom && Number.isFinite(poolId)) {
                    out.poolTokens.push({ pool_id: poolId, token_denom: tokenDenom });
                }
                break;
            }

            // ---- commits ----------------------------------------------
            case 'commit': {
                const pool = a['pool_contract'] || contract;
                const phase = a['phase'] || 'unknown';
                if (!pool || !a['committer']) break;
                out.commits.push({
                    ...base,
                    pool,
                    committer: a['committer'],
                    phase,
                    // funding/active/threshold_hit_exact report
                    // commit_amount_bluechip; the threshold_crossing
                    // (with excess) path reports total_amount_bluechip.
                    amount_bluechip: a['commit_amount_bluechip'] ?? a['total_amount_bluechip'] ?? null,
                    // Per-commit USD is legacy-only (pre-Osmosis events);
                    // current events carry no commit_amount_usd, so this
                    // is null on the live chain. Kept for historical txs.
                    amount_usd: a['commit_amount_usd'] ?? sumMicro(a['threshold_amount_usd'], a['swap_amount_usd']),
                    // Running USD total: total_raised_after (micro-USD,
                    // funding-phase commits) on current events, with the
                    // legacy total_usd_raised_after as fallback.
                    usd_raised_after: a['total_raised_after'] ?? a['total_usd_raised_after'] ?? null,
                    bluechip_raised_after: a['total_bluechip_raised_after'] ?? null,
                    tokens_received: a['tokens_received'] ?? null,
                });
                if (phase === 'threshold_crossing' || phase === 'threshold_hit_exact') {
                    out.thresholdCrossings.push({ pool, ts: ctx.ts });
                }
                // A post-threshold ("active") commit is economically a buy
                // through the AMM — surface it in the trade feed too.
                // Only legacy events report tokens_received on the commit
                // itself; current contracts swap via the Osmosis pool and
                // only know token_out_min_amount at emit time, so no
                // trade row is derived for them.
                if (phase === 'active' && a['swap_amount_bluechip'] && a['tokens_received']) {
                    out.trades.push({
                        ...base,
                        pool,
                        trader: a['committer'],
                        side: 'buy',
                        source: 'commit',
                        offer_amount: a['swap_amount_bluechip'],
                        return_amount: a['tokens_received'],
                        commission: a['commission_amount'] ?? null,
                        spread: a['spread_amount'] ?? null,
                        price: ratioPrice(a['swap_amount_bluechip'], a['tokens_received']),
                        reserve0_after: a['reserve0_after'] ?? null,
                        reserve1_after: a['reserve1_after'] ?? null,
                    });
                }
                break;
            }

            // ---- swaps -------------------------------------------------
            case 'swap': {
                const pool = a['pool_contract'] || contract;
                if (!pool) break;
                // offer_asset is a bank denom on both sides now: the
                // native denom (uosmo) or the creator token's TokenFactory
                // denom (factory/{pool}/{subdenom}). Legacy events carried
                // a CW20 address for the token side — either way, anything
                // that isn't the native denom is the creator-token side.
                const side: 'buy' | 'sell' = a['offer_asset'] === ctx.nativeDenom ? 'buy' : 'sell';
                out.trades.push({
                    ...base,
                    pool,
                    trader: a['sender'] ?? null,
                    side,
                    source: 'swap',
                    offer_amount: a['offer_amount'] ?? null,
                    return_amount: a['return_amount'] ?? null,
                    commission: a['commission_amount'] ?? null,
                    spread: a['spread_amount'] ?? null,
                    price: side === 'buy'
                        ? ratioPrice(a['offer_amount'], a['return_amount'])
                        : ratioPrice(a['return_amount'], a['offer_amount']),
                    reserve0_after: a['reserve0_after'] ?? null,
                    reserve1_after: a['reserve1_after'] ?? null,
                });
                break;
            }

            // ---- creator claims ---------------------------------------
            // Legacy: claim_creator_fees was removed with the pool-managed
            // liquidity entry points; parsed only for historical backfills.
            case 'claim_creator_fees': {
                const pool = a['pool_contract'] || contract;
                if (!pool) break;
                out.claims.push({
                    ...base,
                    pool,
                    action,
                    creator: a['creator'] ?? null,
                    amount_0: a['amount_0'] ?? null,
                    amount_1: a['amount_1'] ?? null,
                });
                break;
            }
            case 'claim_creator_excess': {
                const pool = a['pool_contract'] || contract;
                if (!pool) break;
                out.claims.push({
                    ...base,
                    pool,
                    action,
                    creator: a['creator'] ?? null,
                    amount_0: a['bluechip_amount'] ?? null,
                    amount_1: a['token_amount'] ?? null,
                });
                break;
            }

            // ---- liquidity (legacy, pre-Osmosis) ------------------------
            default: {
                if (!LIQUIDITY_ACTIONS.has(action)) break;
                const pool = a['pool_contract'] || contract;
                if (!pool) break;
                // Per-action amount/actor keys differ; normalize the
                // common ones and keep the full map in attrs_json.
                const amount0 = a['actual_amount0'] ?? a['total_0'] ?? a['fees_0'] ?? null;
                const amount1 = a['actual_amount1'] ?? a['total_1'] ?? a['fees_1'] ?? null;
                const liquidity = a['liquidity'] ?? a['liquidity_removed'] ?? null;
                out.liquidity.push({
                    ...base,
                    pool,
                    action,
                    actor: a['depositor'] ?? a['withdrawer'] ?? a['collector'] ?? a['sender'] ?? null,
                    position_id: a['position_id'] ?? null,
                    amount_0: amount0,
                    amount_1: amount1,
                    liquidity,
                    attrs_json: JSON.stringify(a),
                });
                break;
            }
        }
    }

    // Join instantiate-announced TokenFactory denoms to the pool_id the
    // factory assigned in the same tx. Denoms from contracts that were
    // not registered through a (factory-verified) pool-creation event
    // are dropped.
    for (const p of out.pools) {
        if (p.pool_id === null) continue;
        const denom = denomByPool.get(p.address);
        if (denom) out.poolTokens.push({ pool_id: p.pool_id, token_denom: denom });
    }
    return out;
}
