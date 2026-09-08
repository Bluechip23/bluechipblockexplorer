// Typed client for the time-series indexer (see indexer/README.md).
// The indexer is optional infrastructure: every helper here resolves to
// null/[] when it is unreachable so callers can degrade gracefully.

const INDEXER_URL = (process.env.REACT_APP_INDEXER_URL || 'http://localhost:4316').replace(/\/+$/, '');

async function fetchJson<T>(path: string, timeoutMs = 8000): Promise<T | null> {
    try {
        const res = await fetch(`${INDEXER_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

export interface IndexerHealth {
    ok: boolean;
    lastIndexedHeight: number | null;
    pools: number;
    commits: number;
    trades: number;
}

export interface PricePoint {
    t: number;                 // bucket start, unix seconds
    open: number; high: number; low: number; close: number;
    volume_bluechip: number;   // micro-units, float aggregate
    trades: number;
}

export interface VolumePoint {
    t: number;
    buys: number; sells: number;
    buy_volume_bluechip: number;
    sell_volume_bluechip: number;
}

export interface IndexedTrade {
    txhash: string;
    height: number;
    ts: number;
    trader: string | null;
    side: 'buy' | 'sell';
    source: 'swap' | 'commit';
    offer_amount: string | null;
    return_amount: string | null;
    price: number | null;
}

export interface IndexedCommit {
    txhash: string;
    height: number;
    ts: number;
    committer: string;
    phase: string;
    // Gross micro-OSMO attached to the commit (commit_amount_bluechip /
    // total_amount_bluechip on the event).
    amount_bluechip: string | null;
    // Pool's gross micro-OSMO running total after this commit (the
    // event's total_raised_after; funding-phase commits only). This is
    // the accumulator the threshold check runs against.
    raised_after: string | null;
    // This commit's contribution toward the threshold, in micro-OSMO,
    // derived by the indexer from consecutive running totals. NULL for
    // post-threshold "active" commits, which no longer count.
    commit_native: string | null;
    tokens_received: string | null;
}

export interface StatementLine {
    ts: number;
    type: 'commit_fee' | 'fee_pot_claim' | 'excess_claim';
    txhash: string;
    counterparty: string | null;
    phase: string | null;
    // Gross micro-OSMO of the commit and the creator's fee share of it.
    gross_native: string | null;
    fee_share_native: string | null;
    gross_bluechip: string | null;
    amount_0: string | null;
    amount_1: string | null;
}

export interface IndexedPool {
    address: string;
    pool_id: number | null;
    created_height: number;
    created_at: number;                 // unix seconds
    threshold_crossed_at: number | null;
    token_address: string | null;
}

export function indexerHealth(): Promise<IndexerHealth | null> {
    return fetchJson<IndexerHealth>('/health', 3000);
}

export function fetchIndexedPools(): Promise<IndexedPool[] | null> {
    return fetchJson<IndexedPool[]>('/pools', 5000);
}

export function fetchPriceSeries(pool: string, bucket: number, from: number, to: number): Promise<PricePoint[] | null> {
    return fetchJson<PricePoint[]>(`/pools/${pool}/price-series?bucket=${bucket}&from=${from}&to=${to}`);
}

export function fetchVolumeSeries(pool: string, bucket: number, from: number, to: number): Promise<VolumePoint[] | null> {
    return fetchJson<VolumePoint[]>(`/pools/${pool}/volume-series?bucket=${bucket}&from=${from}&to=${to}`);
}

export function fetchRecentTrades(pool: string, limit = 25): Promise<IndexedTrade[] | null> {
    return fetchJson<IndexedTrade[]>(`/pools/${pool}/trades?limit=${limit}`);
}

export function fetchRecentCommits(pool: string, limit = 25, wallet?: string): Promise<IndexedCommit[] | null> {
    const w = wallet ? `&wallet=${encodeURIComponent(wallet)}` : '';
    return fetchJson<IndexedCommit[]>(`/pools/${pool}/commits?limit=${limit}${w}`);
}

export interface WalletCommit {
    txhash: string;
    height: number;
    ts: number;
    pool: string;
    phase: string;
    amount_bluechip: string | null;
    commit_native: string | null;       // derived per-commit micro-OSMO (see IndexedCommit)
    tokens_received: string | null;
}

// Cross-pool commit history for one wallet, newest first.
export function fetchWalletCommits(wallet: string, limit = 50): Promise<WalletCommit[] | null> {
    return fetchJson<WalletCommit[]>(`/wallets/${wallet}/commits?limit=${limit}`);
}

export interface WalletTrade {
    txhash: string;
    height: number;
    ts: number;
    pool: string;
    side: 'buy' | 'sell';
    source: 'swap' | 'commit';
    offer_amount: string | null;
    return_amount: string | null;
    price: number | null;
}

// Cross-pool trade history for one wallet, newest first.
export function fetchWalletTrades(wallet: string, limit = 50): Promise<WalletTrade[] | null> {
    return fetchJson<WalletTrade[]>(`/wallets/${wallet}/trades?limit=${limit}`);
}

export function fetchCreatorStatement(pool: string, from = 0, to?: number, feeBps = 500): Promise<StatementLine[] | null> {
    const end = to ?? Math.floor(Date.now() / 1000) + 60;
    return fetchJson<StatementLine[]>(`/pools/${pool}/creator-statement?from=${from}&to=${end}&fee_bps=${feeBps}`, 20000);
}
