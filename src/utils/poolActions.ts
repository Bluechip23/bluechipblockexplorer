// Shared building blocks for MsgExecuteContract flows against creator
// pools. These were previously copy-pasted (and drifting) between the
// Creator Economy page forms and the pool action modals.

import type { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { NATIVE_DENOM } from '../defi/types';
import { safeBigInt } from './bigintMath';

export interface PoolAssets {
    /**
     * The creator token's native TokenFactory denom
     * (factory/{pool_addr}/{subdenom}), or null if the pool has no
     * creator leg. Post-Osmosis-migration the creator token is a bank
     * coin — there is no CW20 contract address.
     */
    tokenDenom: string | null;
    /** The pool's native denom leg (defaults to the canonical OSMO denom). */
    bluechipDenom: string;
}

// Pool denom is configurable per-pool; read it from `pair {}` rather than
// assuming NATIVE_DENOM. The Pair query returns PoolDetails, whose asset
// list field is `asset_infos`. (`pool_token_info` is the *input* field on
// factory create messages and the factory's pool_by_address response —
// kept as a defensive fallback only.)
export async function resolvePoolAssets(
    client: SigningCosmWasmClient,
    poolAddress: string,
): Promise<PoolAssets> {
    let tokenDenom: string | null = null;
    let bluechipDenom = NATIVE_DENOM;
    try {
        const pairInfo = await client.queryContractSmart(poolAddress, { pair: {} });
        const infos: Array<{
            bluechip?: { denom: string };
            creator_token?: { denom: string };
        }> = pairInfo?.asset_infos ?? pairInfo?.pool_token_info ?? [];
        for (const asset of infos) {
            if (asset?.creator_token?.denom) tokenDenom = asset.creator_token.denom;
            if (asset?.bluechip?.denom) bluechipDenom = asset.bluechip.denom;
        }
    } catch {
        // Fall back to NATIVE_DENOM / no creator leg.
    }
    return { tokenDenom, bluechipDenom };
}

/**
 * Derives the `belief_price` string (offer-per-ask, 18 decimals) from a
 * live `simulation` quote against the pool. Setting a belief price fixes
 * the user's worst-case fill at submit time — a front-run that moves the
 * pool reverts the swap instead of filling at the worse price — and is
 * REQUIRED by the contract on post-threshold commits. Returns null when
 * the pool cannot be quoted (caller decides whether that is fatal).
 */
export async function deriveBeliefPrice(
    client: SigningCosmWasmClient,
    poolAddress: string,
    offerInfo: { bluechip: { denom: string } } | { creator_token: { denom: string } },
    offerAmountMicro: string,
): Promise<string | null> {
    try {
        const sim = await client.queryContractSmart(poolAddress, {
            simulation: { offer_asset: { info: offerInfo, amount: offerAmountMicro } },
        });
        const out = safeBigInt(sim?.return_amount ?? '0');
        if (out <= 0n) return null;
        return (Number(offerAmountMicro) / Number(out)).toFixed(18);
    } catch {
        return null;
    }
}

/**
 * Applies a percentage slippage tolerance to a micro-amount using BigInt
 * basis-point math (no floating-point drift on large deposits). Returns the
 * minimum acceptable amount as an integer string.
 */
export function minAmountAfterSlippage(micro: string, slippagePct: string | number): string {
    const pct = typeof slippagePct === 'number' ? slippagePct : parseFloat(slippagePct || '0');
    const bps = BigInt(Math.round((Number.isFinite(pct) ? pct : 0) * 100));
    const scale = 10_000n;
    return ((safeBigInt(micro) * (scale - bps)) / scale).toString();
}
