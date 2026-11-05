// Native Osmosis GAMM liquidity — add/remove from the explorer.
//
// At threshold crossing a creator pool seeds a standard Osmosis GAMM
// (balancer, 50/50) pool. Anyone can add liquidity to it with
// MsgJoinPool and remove it with MsgExitPool; the BlueChip contract is not
// involved. Ported from the contract repo's frontend
// (frontend/src/lib/osmosisGamm.ts) with these changes:
//   - the messages are registered on the explorer's one wallet client
//     (WalletContext), so Keplr and Leap both work, and amino converters are
//     included so Ledger (amino-only) signers can sign too;
//   - joins cap each side at exactly the quoted deposit and take the
//     slippage off the LP shares requested (the Osmosis app's approach), so
//     a join can never pull more than the user was shown;
//   - reserves and total shares come from the GAMM pool itself over LCD.
//
// Why hand-rolled protobuf: the explorer ships only base @cosmjs, which has
// no Osmosis types, and these two messages are tiny. A wrong encoding fails
// closed (the chain rejects the tx); the slippage bounds cap a mispriced
// tx to "reverts", never "pulls more than shown".

import { toUtf8 } from '@cosmjs/encoding';
import type { GeneratedType } from '@cosmjs/proto-signing';
import type { AminoConverters } from '@cosmjs/stargate';
import { apiEndpoint } from '../components/universal/IndividualPage.const';
import { safeBigInt } from './bigintMath';

// ---------------------------------------------------------------------------
// Minimal protobuf writer (proto3; only the wire types these messages use)
// ---------------------------------------------------------------------------

class Writer {
    private buf: number[] = [];

    private varint(v: bigint) {
        let n = v;
        while (n > 0x7fn) {
            this.buf.push(Number((n & 0x7fn) | 0x80n));
            n >>= 7n;
        }
        this.buf.push(Number(n));
    }

    private tag(field: number, wire: number) {
        this.varint(BigInt((field << 3) | wire));
    }

    /** string field (wire type 2); proto3 omits empty strings. */
    string(field: number, value: string) {
        if (!value) return this;
        const bytes = toUtf8(value);
        this.tag(field, 2);
        this.varint(BigInt(bytes.length));
        for (const b of bytes) this.buf.push(b);
        return this;
    }

    /** uint64 field (wire type 0) from a decimal string; proto3 omits 0. */
    uint64(field: number, value: string) {
        const v = BigInt(value);
        if (v === 0n) return this;
        this.tag(field, 0);
        this.varint(v);
        return this;
    }

    /** embedded message field (wire type 2). */
    message(field: number, bytes: Uint8Array) {
        this.tag(field, 2);
        this.varint(BigInt(bytes.length));
        for (const b of bytes) this.buf.push(b);
        return this;
    }

    finish(): Uint8Array {
        return Uint8Array.from(this.buf);
    }
}

export interface Coin {
    denom: string;
    amount: string;
}

// cosmos.base.v1beta1.Coin { denom = 1; amount = 2; }
function encodeCoin(c: Coin): Uint8Array {
    return new Writer().string(1, c.denom).string(2, c.amount).finish();
}

// The SDK's Coins type must be sorted by denom.
function sortCoins(coins: Coin[]): Coin[] {
    return [...coins].sort((a, b) => (a.denom < b.denom ? -1 : a.denom > b.denom ? 1 : 0));
}

// ---------------------------------------------------------------------------
// GAMM messages
// ---------------------------------------------------------------------------

export const MSG_JOIN_POOL = '/osmosis.gamm.v1beta1.MsgJoinPool';
export const MSG_EXIT_POOL = '/osmosis.gamm.v1beta1.MsgExitPool';

// osmosis.gamm.v1beta1.MsgJoinPool
//   sender = 1; pool_id = 2; share_out_amount = 3; token_in_maxs = 4
export interface MsgJoinPool {
    sender: string;
    poolId: string;
    shareOutAmount: string;
    tokenInMaxs: Coin[];
}

// osmosis.gamm.v1beta1.MsgExitPool
//   sender = 1; pool_id = 2; share_in_amount = 3; token_out_mins = 4
export interface MsgExitPool {
    sender: string;
    poolId: string;
    shareInAmount: string;
    tokenOutMins: Coin[];
}

function encodeMsgJoinPool(m: MsgJoinPool): Uint8Array {
    const w = new Writer().string(1, m.sender).uint64(2, m.poolId).string(3, m.shareOutAmount);
    for (const c of sortCoins(m.tokenInMaxs)) w.message(4, encodeCoin(c));
    return w.finish();
}

function encodeMsgExitPool(m: MsgExitPool): Uint8Array {
    const w = new Writer().string(1, m.sender).uint64(2, m.poolId).string(3, m.shareInAmount);
    for (const c of sortCoins(m.tokenOutMins)) w.message(4, encodeCoin(c));
    return w.finish();
}

// CosmJS only calls encode(...).finish() and fromPartial on the signing
// path; decode is never used for outbound messages.
function generatedType<T>(encode: (m: T) => Uint8Array): GeneratedType {
    return {
        encode: (message: T) => ({ finish: () => encode(message) }),
        decode: () => ({}),
        fromPartial: (m: T) => m,
    } as unknown as GeneratedType;
}

/** Proto types to register on the wallet client's Registry. */
export const gammRegistryTypes: ReadonlyArray<[string, GeneratedType]> = [
    [MSG_JOIN_POOL, generatedType(encodeMsgJoinPool)],
    [MSG_EXIT_POOL, generatedType(encodeMsgExitPool)],
];

// Amino names from osmosis x/gamm/types/codec.go. Needed only for
// amino-only signers (Ledger through Keplr/Leap).
const coinsToAmino = (cs: Coin[]) => sortCoins(cs).map((c) => ({ denom: c.denom, amount: c.amount }));

export const gammAminoConverters: AminoConverters = {
    [MSG_JOIN_POOL]: {
        aminoType: 'osmosis/gamm/join-pool',
        toAmino: (m: MsgJoinPool) => ({
            sender: m.sender,
            pool_id: m.poolId,
            share_out_amount: m.shareOutAmount,
            token_in_maxs: coinsToAmino(m.tokenInMaxs),
        }),
        fromAmino: (a: { sender: string; pool_id: string; share_out_amount: string; token_in_maxs: Coin[] }): MsgJoinPool => ({
            sender: a.sender,
            poolId: a.pool_id,
            shareOutAmount: a.share_out_amount,
            tokenInMaxs: a.token_in_maxs,
        }),
    },
    [MSG_EXIT_POOL]: {
        aminoType: 'osmosis/gamm/exit-pool',
        toAmino: (m: MsgExitPool) => ({
            sender: m.sender,
            pool_id: m.poolId,
            share_in_amount: m.shareInAmount,
            token_out_mins: coinsToAmino(m.tokenOutMins),
        }),
        fromAmino: (a: { sender: string; pool_id: string; share_in_amount: string; token_out_mins: Coin[] }): MsgExitPool => ({
            sender: a.sender,
            poolId: a.pool_id,
            shareInAmount: a.share_in_amount,
            tokenOutMins: a.token_out_mins,
        }),
    },
};

// ---------------------------------------------------------------------------
// Pool state (LCD)
// ---------------------------------------------------------------------------

export interface GammPoolState {
    poolId: string;
    shareDenom: string;
    totalShares: bigint;
    /** Reserve per denom, base units. */
    reserves: Record<string, bigint>;
}

interface LcdBalancerPool {
    id?: string;
    total_shares?: Coin;
    pool_assets?: Array<{ token?: Coin }>;
}

/**
 * Reads the GAMM pool's reserves and total shares straight from the chain.
 * Tries the gamm endpoint first, then poolmanager (newer nodes may only
 * serve one of them).
 */
export async function fetchGammPool(poolId: number | string): Promise<GammPoolState> {
    const id = String(poolId);
    const urls = [
        `${apiEndpoint}/osmosis/gamm/v1beta1/pools/${encodeURIComponent(id)}`,
        `${apiEndpoint}/osmosis/poolmanager/v1beta1/pools/${encodeURIComponent(id)}`,
    ];
    let lastErr: unknown = null;
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
            const body = await res.json();
            const pool: LcdBalancerPool | undefined = body?.pool;
            if (!pool?.total_shares?.denom || !Array.isArray(pool.pool_assets)) {
                lastErr = new Error('unexpected pool response');
                continue;
            }
            const reserves: Record<string, bigint> = {};
            for (const a of pool.pool_assets) {
                if (a?.token?.denom) reserves[a.token.denom] = safeBigInt(a.token.amount);
            }
            return {
                poolId: id,
                shareDenom: pool.total_shares.denom,
                totalShares: safeBigInt(pool.total_shares.amount),
                reserves,
            };
        } catch (err) {
            lastErr = err;
        }
    }
    throw new Error(`Could not load Osmosis pool #${id}: ${(lastErr as Error)?.message ?? 'unknown error'}`);
}

// ---------------------------------------------------------------------------
// Join / exit math. Base-unit BigInts throughout: LP shares are 18-decimal,
// so Number is not safe.
// ---------------------------------------------------------------------------

const BPS = 10_000n;

function ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b;
}

export interface JoinQuote {
    /** LP shares requested (share_out_amount), already reduced by slippage. */
    shareOut: bigint;
    /** LP shares the deposit is worth at the current ratio. */
    expectedShares: bigint;
    /** Most the chain may pull per side (token_in_maxs). */
    maxIn: { osmo: bigint; creator: bigint };
}

/**
 * Quote a balanced join driven by an OSMO amount. The matching creator
 * amount is ceil(osmoIn * resCreator / resOsmo). Both become hard caps
 * (token_in_maxs). The shares requested are the shares that deposit is worth,
 * minus the slippage tolerance, so the join still succeeds if the ratio
 * moves by up to that much before it lands, and reverts beyond it.
 */
export function quoteJoinByOsmo(
    osmoIn: bigint,
    totalShares: bigint,
    resOsmo: bigint,
    resCreator: bigint,
    slippageBps: bigint,
): JoinQuote {
    if (totalShares <= 0n || resOsmo <= 0n || resCreator <= 0n) {
        throw new Error('This pool has no liquidity to price against.');
    }
    if (osmoIn <= 0n) throw new Error('Enter an amount greater than zero.');
    const creatorIn = ceilDiv(osmoIn * resCreator, resOsmo);
    // Shares the deposit is worth = the smaller side's share of the pool.
    const byOsmo = (totalShares * osmoIn) / resOsmo;
    const byCreator = (totalShares * creatorIn) / resCreator;
    const expectedShares = byOsmo < byCreator ? byOsmo : byCreator;
    const shareOut = (expectedShares * (BPS - slippageBps)) / BPS;
    if (shareOut <= 0n) throw new Error('Amount too small to mint any LP shares.');
    return { shareOut, expectedShares, maxIn: { osmo: osmoIn, creator: creatorIn } };
}

export interface ExitQuote {
    /** Expected out per side at the current ratio. */
    expected: { osmo: bigint; creator: bigint };
    /** Least accepted per side (token_out_mins). */
    minOut: { osmo: bigint; creator: bigint };
}

/** Exit `shareIn` shares: floor(reserve * shareIn / totalShares) per side. */
export function quoteExit(
    shareIn: bigint,
    totalShares: bigint,
    resOsmo: bigint,
    resCreator: bigint,
    slippageBps: bigint,
): ExitQuote {
    if (totalShares <= 0n) throw new Error('This pool has no shares.');
    if (shareIn <= 0n) throw new Error('You hold no LP shares in this pool.');
    const osmo = (resOsmo * shareIn) / totalShares;
    const creator = (resCreator * shareIn) / totalShares;
    const floorSlip = (x: bigint) => (x * (BPS - slippageBps)) / BPS;
    return {
        expected: { osmo, creator },
        minOut: { osmo: floorSlip(osmo), creator: floorSlip(creator) },
    };
}

export function buildJoinMsg(
    sender: string,
    poolId: string,
    quote: JoinQuote,
    osmoDenom: string,
    creatorDenom: string,
): { typeUrl: string; value: MsgJoinPool } {
    return {
        typeUrl: MSG_JOIN_POOL,
        value: {
            sender,
            poolId,
            shareOutAmount: quote.shareOut.toString(),
            tokenInMaxs: [
                { denom: osmoDenom, amount: quote.maxIn.osmo.toString() },
                { denom: creatorDenom, amount: quote.maxIn.creator.toString() },
            ],
        },
    };
}

export function buildExitMsg(
    sender: string,
    poolId: string,
    shareIn: bigint,
    quote: ExitQuote,
    osmoDenom: string,
    creatorDenom: string,
): { typeUrl: string; value: MsgExitPool } {
    return {
        typeUrl: MSG_EXIT_POOL,
        value: {
            sender,
            poolId,
            shareInAmount: shareIn.toString(),
            tokenOutMins: [
                { denom: osmoDenom, amount: quote.minOut.osmo.toString() },
                { denom: creatorDenom, amount: quote.minOut.creator.toString() },
            ],
        },
    };
}
