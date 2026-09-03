// Wallet + chain access. Everything network/Keplr-touching lives here so
// messages.ts stays pure and the smoke test can stub at this seam.

import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { getConfig, keplrChainInfo } from './config.ts';
import {
    beliefPriceFromSimulation,
    buildCommitMsg,
    commitFee,
    commitFunds,
    committingInfoQuery,
    evaluateGate,
    IS_FULLY_COMMITED_QUERY,
    simulationQuery,
    smartQueryUrl,
    toMicro,
    type CommitRecord,
    type GateResult,
} from './messages.ts';

// Minimal Keplr surface the widget uses. The default deployment is the
// osmo-test-5 testnet, which is not in Keplr's built-in registry, so the
// chain is suggested before enabling (a no-op for chains Keplr already
// knows, like osmosis-1).
interface KeplrLike {
    experimentalSuggestChain(info: unknown): Promise<void>;
    enable(chainId: string): Promise<void>;
    getOfflineSigner(chainId: string): unknown;
    getKey(chainId: string): Promise<{ bech32Address: string }>;
}

declare global {
    interface Window {
        keplr?: KeplrLike;
    }
}

export interface Session {
    address: string;
    client: SigningCosmWasmClient;
}

let session: Session | null = null;

export async function connect(): Promise<Session> {
    if (session) return session;
    const cfg = getConfig();
    const keplr = window.keplr;
    if (!keplr) {
        throw new Error('Keplr wallet not found — install it from https://www.keplr.app/get and refresh.');
    }
    await keplr.experimentalSuggestChain(keplrChainInfo(cfg));
    await keplr.enable(cfg.chainId);
    const signer = keplr.getOfflineSigner(cfg.chainId) as Parameters<typeof SigningCosmWasmClient.connectWithSigner>[1];
    const accounts = await signer.getAccounts();
    if (!accounts.length) throw new Error('No account available in Keplr for this chain.');
    const client = await SigningCosmWasmClient.connectWithSigner(cfg.rpc, signer);

    // Refuse to sign against the wrong chain (mirrors the explorer's guard).
    const liveChainId = await client.getChainId();
    if (liveChainId !== cfg.chainId) {
        throw new Error(`Connected chain is "${liveChainId}" but expected "${cfg.chainId}". Check the rpc setting.`);
    }

    session = { address: accounts[0].address, client };
    return session;
}

export function disconnect(): void {
    session = null;
}

/** The viewer's address via Keplr alone — no RPC connection. Enough for
 * read-only flows like the gate check. */
export async function getAddress(): Promise<string> {
    if (session) return session.address;
    const cfg = getConfig();
    const keplr = window.keplr;
    if (!keplr) {
        throw new Error('Keplr wallet not found — install it from https://www.keplr.app/get and refresh.');
    }
    await keplr.experimentalSuggestChain(keplrChainInfo(cfg));
    await keplr.enable(cfg.chainId);
    const key = await keplr.getKey(cfg.chainId);
    return key.bech32Address;
}

export interface SubscribeResult {
    txHash: string;
    address: string;
}

/** Commit OSMO to a creator pool ("subscribe"). Amount is in whole OSMO
 * (e.g. "25" or 25). */
export async function subscribe(opts: { pool?: string; amount: string | number }): Promise<SubscribeResult> {
    const cfg = getConfig();
    const pool = opts.pool ?? cfg.pool;
    if (!pool) throw new Error('No pool address configured — pass {pool} or set it in BluechipWidget.init.');

    const amountMicro = toMicro(opts.amount, cfg.coinDecimals);
    const { address, client } = await connect();

    // Post-threshold commits are AMM swaps and need a belief_price + spread
    // guard; pre-threshold commits must NOT set either.
    let thresholdHit = false;
    try {
        const status = await client.queryContractSmart(pool, IS_FULLY_COMMITED_QUERY);
        thresholdHit = status === 'fully_committed'
            || (typeof status === 'object' && status !== null && 'fully_committed' in status);
    } catch {
        // If the status query fails, fall through with thresholdHit=false;
        // a wrong guess fails loudly at execution rather than silently.
    }

    // The contract REQUIRES a non-null belief_price on post-threshold
    // commits: derive it from the pool's own swap simulation (offer per
    // ask). Pre-threshold commits keep belief_price null.
    let beliefPrice: string | null = null;
    if (thresholdHit) {
        const sim = (await client.queryContractSmart(
            pool,
            simulationQuery(cfg.nativeDenom, amountMicro),
        )) as { return_amount?: string } | null;
        beliefPrice = beliefPriceFromSimulation(amountMicro, sim?.return_amount);
    }

    const msg = buildCommitMsg({ denom: cfg.nativeDenom, amountMicro, thresholdHit, beliefPrice });
    const funds = commitFunds(cfg.nativeDenom, amountMicro);
    const result = await client.execute(
        address,
        pool,
        msg,
        commitFee(cfg.nativeDenom, cfg.gasPrice.average, thresholdHit),
        'BlueChip subscribe',
        funds,
    );
    return { txHash: result.transactionHash, address };
}

/** Read a wallet's subscription record over the REST (LCD) endpoint —
 * no wallet connection or signing needed when an address is supplied.
 *
 * NOTE: this is a CLIENT-SIDE convenience gate (hide/show UI). Anyone
 * can bypass it with dev tools. To protect content that matters, verify
 * wallet ownership server-side with an ADR-36 signature and run this
 * same LCD query from your backend (see the integration guide).
 */
export async function checkSubscription(opts: {
    pool?: string;
    address?: string;
    minUsd?: number;
}): Promise<GateResult> {
    const cfg = getConfig();
    const pool = opts.pool ?? cfg.pool;
    if (!pool) throw new Error('No pool address configured — pass {pool} or set it in BluechipWidget.init.');

    const address = opts.address ?? (await getAddress());
    const url = smartQueryUrl(cfg.rest, pool, committingInfoQuery(address));
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Subscription lookup failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { data: CommitRecord | null };
    return evaluateGate(body.data ?? null, opts.minUsd ?? 0);
}
