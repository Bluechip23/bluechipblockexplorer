import { NATIVE_DENOM } from '../defi/types';

// Osmosis enforces a non-zero base fee (EIP-1559-style fee market), so a
// transaction broadcast with an empty fee amount is rejected by mainnet
// nodes before it ever reaches a block. 0.025uosmo/gas is the standard
// "average" gas price the Osmosis registry advertises to wallets.
export const GAS_PRICE_UOSMO_PER_GAS = 0.025;

export interface ExplicitFee {
    amount: { denom: string; amount: string }[];
    gas: string;
}

/** Build a StdFee for a fixed gas limit, priced at the average Osmosis
 * gas price. The wallet UI still lets the user adjust before signing. */
export function stdFee(gasLimit: number): ExplicitFee {
    const amount = Math.ceil(gasLimit * GAS_PRICE_UOSMO_PER_GAS).toString();
    return {
        amount: [{ denom: NATIVE_DENOM, amount }],
        gas: gasLimit.toString(),
    };
}
