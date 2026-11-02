import Database from 'better-sqlite3';

// All token amounts are stored as TEXT in micro-units so u128 values
// survive verbatim. Aggregations CAST to REAL — fine for charts, not
// for accounting; the on-chain ledger stays authoritative.

export type Db = Database.Database;

export function openDb(path: string): Db {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    return db;
}

export function migrate(db: Db): void {
    db.exec(`
CREATE TABLE IF NOT EXISTS cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    height INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pools (
    address TEXT PRIMARY KEY,
    pool_id INTEGER,
    kind TEXT NOT NULL,                -- 'commit' | 'standard'
    created_height INTEGER NOT NULL,
    created_at INTEGER NOT NULL,       -- unix seconds (block time)
    threshold_crossed_at INTEGER       -- unix seconds, NULL pre-threshold
);
CREATE INDEX IF NOT EXISTS idx_pools_pool_id ON pools(pool_id);

-- Creator-token identifiers land here and are joined to pools on
-- pool_id. The token_address column name is historical: it now stores
-- the token's native TokenFactory denom (factory/{pool}/{subdenom});
-- legacy pre-Osmosis rows hold the old CW20 contract address.
CREATE TABLE IF NOT EXISTS pool_tokens (
    pool_id INTEGER PRIMARY KEY,
    token_address TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commits (
    txhash TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    height INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    pool TEXT NOT NULL,
    committer TEXT NOT NULL,
    phase TEXT NOT NULL,               -- funding | active | threshold_crossing | threshold_hit_exact
    amount_bluechip TEXT,              -- gross micro-OSMO attached to the commit
    raised_after TEXT,                 -- pool's GROSS micro-OSMO running total (funding-phase commits)
    bluechip_raised_after TEXT,        -- pool's NET-of-fee micro-OSMO running total
    tokens_received TEXT,
    threshold_portion_bluechip TEXT,   -- threshold_crossing only: the part of the commit that filled the gap
    fee_base_bluechip TEXT,            -- micro-OSMO the 1%+5% commit fees were charged on
    excess_refunded_bluechip TEXT,     -- threshold_crossing only: gross excess refunded to the committer
    excess_retained_bluechip TEXT,     -- threshold_crossing only: excess kept toward the GAMM creation-fee reserve
    PRIMARY KEY (txhash, event_index)
);
CREATE INDEX IF NOT EXISTS idx_commits_pool_ts ON commits(pool, ts);
CREATE INDEX IF NOT EXISTS idx_commits_wallet_ts ON commits(committer, ts);

CREATE TABLE IF NOT EXISTS trades (
    txhash TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    height INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    pool TEXT NOT NULL,
    trader TEXT,
    side TEXT NOT NULL,                -- 'buy' (bluechip -> token) | 'sell'
    source TEXT NOT NULL,              -- 'swap' | 'commit'
    offer_amount TEXT,
    return_amount TEXT,
    commission TEXT,
    spread TEXT,
    price REAL,                        -- OSMO per token (display only)
    reserve0_after TEXT,
    reserve1_after TEXT,
    PRIMARY KEY (txhash, event_index)
);
CREATE INDEX IF NOT EXISTS idx_trades_pool_ts ON trades(pool, ts);
CREATE INDEX IF NOT EXISTS idx_trades_trader_ts ON trades(trader, ts);

CREATE TABLE IF NOT EXISTS liquidity_events (
    txhash TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    height INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    pool TEXT NOT NULL,
    action TEXT NOT NULL,              -- deposit_liquidity | add_to_position | remove_liquidity | remove_partial_liquidity | collect_fees
    actor TEXT,
    position_id TEXT,
    amount_0 TEXT,
    amount_1 TEXT,
    liquidity TEXT,
    attrs_json TEXT NOT NULL,          -- full attribute map, nothing lost
    PRIMARY KEY (txhash, event_index)
);
CREATE INDEX IF NOT EXISTS idx_liq_pool_ts ON liquidity_events(pool, ts);

CREATE TABLE IF NOT EXISTS creator_claims (
    txhash TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    height INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    pool TEXT NOT NULL,
    action TEXT NOT NULL,              -- claim_creator_fees | claim_creator_excess
    creator TEXT,
    amount_0 TEXT,                     -- bluechip leg
    amount_1 TEXT,                     -- creator-token leg
    PRIMARY KEY (txhash, event_index)
);
CREATE INDEX IF NOT EXISTS idx_claims_pool_ts ON creator_claims(pool, ts);
`);
    migrateCommitsToNative(db);
    migrateCommitsAddCrossingColumns(db);
}

// Pre-oracle-removal databases stored the pool's running total as
// `usd_raised_after` (the contracts then valued commits in USD) plus a
// legacy per-commit `amount_usd`. The current contracts denominate
// everything in OSMO: `total_raised_after` is gross micro-OSMO, and no
// USD attribute exists. Rename the running-total column so its name
// matches what it now holds, and drop the dead USD column. Rows indexed
// from the old contracts keep their (USD) values under the new name —
// those pools cannot exist on a factory running the current contracts,
// so a database is either all-old or all-new; re-index from scratch
// when repointing at a redeployed factory.
function migrateCommitsToNative(db: Db): void {
    const cols = new Set(
        (db.prepare('PRAGMA table_info(commits)').all() as { name: string }[]).map((c) => c.name),
    );
    if (cols.has('usd_raised_after') && !cols.has('raised_after')) {
        db.exec('ALTER TABLE commits RENAME COLUMN usd_raised_after TO raised_after');
    }
    if (cols.has('amount_usd')) {
        db.exec('ALTER TABLE commits DROP COLUMN amount_usd');
    }
}

// Databases created before the contract started charging commit fees on
// the threshold portion only (and before this indexer stored the crossing
// split) lack the crossing columns. Add them in place; rows indexed
// earlier keep NULLs there, which the readers below treat as "fee base =
// gross amount" and "no crossing split" — re-index from the pool's
// creation height to backfill the crossing commit's threshold portion.
const CROSSING_COLUMNS = [
    'threshold_portion_bluechip',
    'fee_base_bluechip',
    'excess_refunded_bluechip',
    'excess_retained_bluechip',
];

function migrateCommitsAddCrossingColumns(db: Db): void {
    const cols = new Set(
        (db.prepare('PRAGMA table_info(commits)').all() as { name: string }[]).map((c) => c.name),
    );
    for (const col of CROSSING_COLUMNS) {
        if (!cols.has(col)) db.exec(`ALTER TABLE commits ADD COLUMN ${col} TEXT`);
    }
}

// ---------------------------------------------------------------------------
// Row types + writers (INSERT OR REPLACE keeps re-ingestion idempotent)
// ---------------------------------------------------------------------------

export interface PoolRow {
    address: string;
    pool_id: number | null;
    kind: 'commit' | 'standard';
    created_height: number;
    created_at: number;
}

export interface CommitRow {
    txhash: string; event_index: number; height: number; ts: number;
    pool: string; committer: string; phase: string;
    // Gross micro-OSMO attached to the commit.
    amount_bluechip: string | null;
    // Pool's gross micro-OSMO running total after the commit (funding
    // phase only) — the accumulator the threshold check runs against.
    raised_after: string | null;
    bluechip_raised_after: string | null;
    tokens_received: string | null;
    // threshold_crossing only: the part of the gross commit that filled
    // the remaining gap to the threshold (the only part that counts).
    threshold_portion_bluechip: string | null;
    // What the 1% + 5% commit fees were charged on: the gross amount,
    // except on a crossing emitted by the "fees on the threshold portion
    // only" contract generation, where it is threshold_portion_bluechip.
    fee_base_bluechip: string | null;
    // threshold_crossing only: gross excess refunded to the committer in
    // the same tx, and the slice of the excess retained toward the GAMM
    // pool-creation-fee reserve (zero once the reserve is full).
    excess_refunded_bluechip: string | null;
    excess_retained_bluechip: string | null;
}

export interface TradeRow {
    txhash: string; event_index: number; height: number; ts: number;
    pool: string; trader: string | null; side: 'buy' | 'sell'; source: 'swap' | 'commit';
    offer_amount: string | null; return_amount: string | null;
    commission: string | null; spread: string | null; price: number | null;
    reserve0_after: string | null; reserve1_after: string | null;
}

export interface LiquidityRow {
    txhash: string; event_index: number; height: number; ts: number;
    pool: string; action: string; actor: string | null; position_id: string | null;
    amount_0: string | null; amount_1: string | null; liquidity: string | null;
    attrs_json: string;
}

export interface ClaimRow {
    txhash: string; event_index: number; height: number; ts: number;
    pool: string; action: string; creator: string | null;
    amount_0: string | null; amount_1: string | null;
}

export function getCursor(db: Db): number | null {
    const row = db.prepare('SELECT height FROM cursor WHERE id = 1').get() as { height: number } | undefined;
    return row ? row.height : null;
}

export function setCursor(db: Db, height: number): void {
    db.prepare('INSERT INTO cursor (id, height) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET height = excluded.height').run(height);
}

export function upsertPool(db: Db, p: PoolRow): void {
    db.prepare(`INSERT INTO pools (address, pool_id, kind, created_height, created_at)
        VALUES (@address, @pool_id, @kind, @created_height, @created_at)
        ON CONFLICT(address) DO UPDATE SET pool_id = excluded.pool_id, kind = excluded.kind`).run(p);
}

// tokenDenom: TokenFactory denom (or a legacy CW20 address); stored in
// the token_address column, whose name predates the Osmosis migration.
export function setPoolToken(db: Db, poolId: number, tokenDenom: string): void {
    db.prepare(`INSERT INTO pool_tokens (pool_id, token_address) VALUES (?, ?)
        ON CONFLICT(pool_id) DO UPDATE SET token_address = excluded.token_address`).run(poolId, tokenDenom);
}

export function markThresholdCrossed(db: Db, pool: string, ts: number): void {
    db.prepare('UPDATE pools SET threshold_crossed_at = COALESCE(threshold_crossed_at, ?) WHERE address = ?').run(ts, pool);
}

export function insertCommit(db: Db, r: CommitRow): void {
    db.prepare(`INSERT OR REPLACE INTO commits
        (txhash, event_index, height, ts, pool, committer, phase, amount_bluechip, raised_after, bluechip_raised_after, tokens_received,
         threshold_portion_bluechip, fee_base_bluechip, excess_refunded_bluechip, excess_retained_bluechip)
        VALUES (@txhash, @event_index, @height, @ts, @pool, @committer, @phase, @amount_bluechip, @raised_after, @bluechip_raised_after, @tokens_received,
         @threshold_portion_bluechip, @fee_base_bluechip, @excess_refunded_bluechip, @excess_retained_bluechip)`).run(r);
}

export function insertTrade(db: Db, r: TradeRow): void {
    db.prepare(`INSERT OR REPLACE INTO trades
        (txhash, event_index, height, ts, pool, trader, side, source, offer_amount, return_amount, commission, spread, price, reserve0_after, reserve1_after)
        VALUES (@txhash, @event_index, @height, @ts, @pool, @trader, @side, @source, @offer_amount, @return_amount, @commission, @spread, @price, @reserve0_after, @reserve1_after)`).run(r);
}

export function insertLiquidity(db: Db, r: LiquidityRow): void {
    db.prepare(`INSERT OR REPLACE INTO liquidity_events
        (txhash, event_index, height, ts, pool, action, actor, position_id, amount_0, amount_1, liquidity, attrs_json)
        VALUES (@txhash, @event_index, @height, @ts, @pool, @action, @actor, @position_id, @amount_0, @amount_1, @liquidity, @attrs_json)`).run(r);
}

export function insertClaim(db: Db, r: ClaimRow): void {
    db.prepare(`INSERT OR REPLACE INTO creator_claims
        (txhash, event_index, height, ts, pool, action, creator, amount_0, amount_1)
        VALUES (@txhash, @event_index, @height, @ts, @pool, @action, @creator, @amount_0, @amount_1)`).run(r);
}

// ---------------------------------------------------------------------------
// Query helpers (the REST layer is a thin wrapper over these so they can
// be unit-tested against an in-memory database)
// ---------------------------------------------------------------------------

// A commit's contribution toward the threshold is derived from the
// pool's gross running total (raised_after, from the event's
// total_raised_after) as the difference between consecutive totals; for
// plain funding commits (and an exact threshold hit) this equals
// amount_bluechip. The commit that crosses the threshold WITH EXCESS
// carries no running total — the contract reports the part that filled
// the gap as threshold_amount_bluechip instead — so its contribution is
// taken from threshold_portion_bluechip directly (the excess is refunded
// and never counts). The window deliberately ignores any time filter so
// deltas at a query window's edge stay correct. Caveat: if indexing
// started mid-history (START_HEIGHT after the pool's first commit), the
// first indexed commit's delta absorbs everything raised before it.
const DERIVED_NATIVE_CTE = `derived_native AS (
    SELECT txhash, event_index,
           raised_after - COALESCE(LAG(raised_after) OVER (
               PARTITION BY pool ORDER BY ts, height, event_index), 0) AS delta_native
    FROM commits
    WHERE raised_after IS NOT NULL
    UNION ALL
    SELECT txhash, event_index, CAST(threshold_portion_bluechip AS REAL) AS delta_native
    FROM commits
    WHERE raised_after IS NULL AND threshold_portion_bluechip IS NOT NULL
)`;

// Micro-OSMO the commit fees were charged on. Rows indexed before the
// fee-base column existed fall back to the gross amount (correct for
// every path except a crossing-with-excess on the current contracts).
const FEE_BASE_EXPR = `COALESCE(c.fee_base_bluechip, c.amount_bluechip)`;

// Per-row threshold contribution as a micro-OSMO TEXT value (NULL for
// post-threshold "active" commits, which no longer count toward it).
const COMMIT_NATIVE_EXPR = `CAST(CAST(ROUND(d.delta_native) AS INTEGER) AS TEXT)`;

export function healthCounts(db: Db) {
    const count = (table: string) =>
        (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    return {
        lastIndexedHeight: getCursor(db),
        pools: count('pools'),
        commits: count('commits'),
        trades: count('trades'),
        liquidityEvents: count('liquidity_events'),
        creatorClaims: count('creator_claims'),
    };
}

export function listPools(db: Db) {
    return db.prepare(`
        SELECT p.address, p.pool_id, p.kind, p.created_height, p.created_at,
               p.threshold_crossed_at, t.token_address
        FROM pools p LEFT JOIN pool_tokens t ON t.pool_id = p.pool_id
        ORDER BY p.created_height ASC`).all();
}

export interface SeriesParams {
    pool: string;
    bucket: number;   // seconds
    from: number;     // unix seconds inclusive
    to: number;       // unix seconds exclusive
}

// better-sqlite3 binds JS numbers as REAL; `ts / @bucket` must be
// INTEGER division for the bucketing to collapse, so bind the bucket
// as a BigInt (better-sqlite3 binds BigInt as INTEGER).
function seriesBind(p: SeriesParams) {
    return { pool: p.pool, bucket: BigInt(Math.floor(p.bucket)), from: p.from, to: p.to };
}

// OHLC + volume per bucket, derived from trades with a known price.
export function priceSeries(db: Db, p: SeriesParams) {
    return db.prepare(`
        SELECT
            (ts / @bucket) * @bucket AS t,
            (SELECT t2.price FROM trades t2
              WHERE t2.pool = @pool AND t2.price IS NOT NULL
                AND (t2.ts / @bucket) * @bucket = (trades.ts / @bucket) * @bucket
              ORDER BY t2.ts ASC, t2.height ASC, t2.event_index ASC LIMIT 1) AS open,
            MAX(price) AS high,
            MIN(price) AS low,
            (SELECT t2.price FROM trades t2
              WHERE t2.pool = @pool AND t2.price IS NOT NULL
                AND (t2.ts / @bucket) * @bucket = (trades.ts / @bucket) * @bucket
              ORDER BY t2.ts DESC, t2.height DESC, t2.event_index DESC LIMIT 1) AS close,
            SUM(CASE side WHEN 'buy' THEN CAST(offer_amount AS REAL) ELSE CAST(return_amount AS REAL) END) AS volume_bluechip,
            COUNT(*) AS trades
        FROM trades
        WHERE pool = @pool AND price IS NOT NULL AND ts >= @from AND ts < @to
        GROUP BY t
        ORDER BY t ASC`).all(seriesBind(p));
}

// Buy/sell pressure per bucket.
export function volumeSeries(db: Db, p: SeriesParams) {
    return db.prepare(`
        SELECT
            (ts / @bucket) * @bucket AS t,
            SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buys,
            SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sells,
            SUM(CASE WHEN side = 'buy' THEN CAST(offer_amount AS REAL) ELSE 0 END) AS buy_volume_bluechip,
            SUM(CASE WHEN side = 'sell' THEN CAST(return_amount AS REAL) ELSE 0 END) AS sell_volume_bluechip
        FROM trades
        WHERE pool = @pool AND ts >= @from AND ts < @to
        GROUP BY t
        ORDER BY t ASC`).all(seriesBind(p));
}

// Commit activity per bucket (count, gross OSMO toward the threshold,
// unique wallets).
export function commitSeries(db: Db, p: SeriesParams) {
    return db.prepare(`
        WITH ${DERIVED_NATIVE_CTE}
        SELECT
            (c.ts / @bucket) * @bucket AS t,
            COUNT(*) AS commits,
            SUM(d.delta_native) AS native,
            COUNT(DISTINCT c.committer) AS unique_committers
        FROM commits c
        LEFT JOIN derived_native d ON d.txhash = c.txhash AND d.event_index = c.event_index
        WHERE c.pool = @pool AND c.ts >= @from AND c.ts < @to
        GROUP BY t
        ORDER BY t ASC`).all(seriesBind(p));
}

export function listTrades(db: Db, opts: {
    pool: string; limit: number; beforeTs: number | null;
    side: 'buy' | 'sell' | null; minOfferBluechip: number | null;
}) {
    return db.prepare(`
        SELECT txhash, height, ts, trader, side, source, offer_amount, return_amount, commission, spread, price
        FROM trades
        WHERE pool = @pool
          AND (@beforeTs IS NULL OR ts < @beforeTs)
          AND (@side IS NULL OR side = @side)
          AND (@minOfferBluechip IS NULL OR
               CAST(CASE side WHEN 'buy' THEN offer_amount ELSE return_amount END AS REAL) >= @minOfferBluechip)
        ORDER BY ts DESC, height DESC, event_index DESC
        LIMIT @limit`).all(opts);
}

export function listCommits(db: Db, opts: {
    pool: string; limit: number; beforeTs: number | null; wallet: string | null;
}) {
    return db.prepare(`
        WITH ${DERIVED_NATIVE_CTE}
        SELECT c.txhash, c.height, c.ts, c.committer, c.phase, c.amount_bluechip,
               c.raised_after, c.bluechip_raised_after, c.tokens_received,
               ${COMMIT_NATIVE_EXPR} AS commit_native,
               ${FEE_BASE_EXPR} AS fee_base_bluechip,
               c.excess_refunded_bluechip, c.excess_retained_bluechip
        FROM commits c
        LEFT JOIN derived_native d ON d.txhash = c.txhash AND d.event_index = c.event_index
        WHERE c.pool = @pool
          AND (@beforeTs IS NULL OR c.ts < @beforeTs)
          AND (@wallet IS NULL OR c.committer = @wallet)
        ORDER BY c.ts DESC, c.height DESC, c.event_index DESC
        LIMIT @limit`).all(opts);
}

// Per-transaction creator income statement: the creator's commit-fee
// share of every commit (estimated at fee_bps, default 5%, on the
// commit's fee base) plus claim events, in chronological order.
export function creatorStatement(db: Db, opts: {
    pool: string; from: number; to: number; feeBps: number;
}) {
    const commits = db.prepare(`
        WITH ${DERIVED_NATIVE_CTE}
        SELECT c.txhash, c.ts, c.committer, c.phase, c.amount_bluechip,
               ${COMMIT_NATIVE_EXPR} AS commit_native,
               ${FEE_BASE_EXPR} AS fee_base_bluechip
        FROM commits c
        LEFT JOIN derived_native d ON d.txhash = c.txhash AND d.event_index = c.event_index
        WHERE c.pool = @pool AND c.ts >= @from AND c.ts < @to
        ORDER BY c.ts ASC, c.height ASC, c.event_index ASC`).all(opts) as {
        txhash: string; ts: number; committer: string; phase: string;
        commit_native: string | null; amount_bluechip: string | null;
        fee_base_bluechip: string | null;
    }[];
    const claims = db.prepare(`
        SELECT txhash, ts, action, creator, amount_0, amount_1
        FROM creator_claims
        WHERE pool = @pool AND ts >= @from AND ts < @to
        ORDER BY ts ASC, height ASC, event_index ASC`).all(opts) as {
        txhash: string; ts: number; action: string; creator: string | null;
        amount_0: string | null; amount_1: string | null;
    }[];

    const rows = [
        ...commits.map((c) => ({
            ts: c.ts,
            type: 'commit_fee' as const,
            txhash: c.txhash,
            counterparty: c.committer,
            phase: c.phase,
            // Gross OSMO attached to the commit (pre- and post-threshold
            // alike); commit_native (the part that counted toward the
            // threshold) is exposed alongside.
            gross_native: c.amount_bluechip,
            // The creator's fee is taken on the commit's fee base: the
            // gross amount, except on a threshold crossing with excess
            // where the current contracts charge it on the threshold
            // portion only and refund the excess fee-free.
            fee_base_native: c.fee_base_bluechip,
            // String math on micro-units: fee_base * feeBps / 10000.
            fee_share_native: c.fee_base_bluechip !== null
                ? ((BigInt(c.fee_base_bluechip) * BigInt(opts.feeBps)) / 10_000n).toString()
                : null,
            commit_native: c.commit_native,
            gross_bluechip: c.amount_bluechip,
            amount_0: null as string | null,
            amount_1: null as string | null,
        })),
        ...claims.map((c) => ({
            ts: c.ts,
            type: c.action === 'claim_creator_fees' ? ('fee_pot_claim' as const) : ('excess_claim' as const),
            txhash: c.txhash,
            counterparty: c.creator,
            phase: null as string | null,
            gross_native: null as string | null,
            fee_base_native: null as string | null,
            fee_share_native: null as string | null,
            commit_native: null as string | null,
            gross_bluechip: null as string | null,
            amount_0: c.amount_0,
            amount_1: c.amount_1,
        })),
    ];
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
}

// Rolling-window stats with previous-window comparison.
export function windowStats(db: Db, pool: string, windowSec: number, now: number) {
    const one = (from: number, to: number) => {
        const t = db.prepare(`
            SELECT COUNT(*) AS trades,
                   SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buys,
                   SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sells,
                   SUM(CAST(CASE side WHEN 'buy' THEN offer_amount ELSE return_amount END AS REAL)) AS volume_bluechip
            FROM trades WHERE pool = ? AND ts >= ? AND ts < ?`).get(pool, from, to) as Record<string, number | null>;
        const c = db.prepare(`
            WITH ${DERIVED_NATIVE_CTE}
            SELECT COUNT(*) AS commits,
                   SUM(d.delta_native) AS commit_native,
                   COUNT(DISTINCT c.committer) AS unique_committers
            FROM commits c
            LEFT JOIN derived_native d ON d.txhash = c.txhash AND d.event_index = c.event_index
            WHERE c.pool = ? AND c.ts >= ? AND c.ts < ?`).get(pool, from, to) as Record<string, number | null>;
        return { ...t, ...c };
    };
    return {
        window_seconds: windowSec,
        current: one(now - windowSec, now),
        previous: one(now - 2 * windowSec, now - windowSec),
    };
}

// Cross-pool commit history for one wallet (newest first) — powers the
// explorer's wallet-page commit history.
export function listCommitsByWallet(db: Db, opts: {
    wallet: string; limit: number; beforeTs: number | null;
}) {
    return db.prepare(`
        WITH ${DERIVED_NATIVE_CTE}
        SELECT c.txhash, c.height, c.ts, c.pool, c.phase, c.amount_bluechip,
               c.tokens_received, ${COMMIT_NATIVE_EXPR} AS commit_native,
               ${FEE_BASE_EXPR} AS fee_base_bluechip,
               c.excess_refunded_bluechip, c.excess_retained_bluechip
        FROM commits c
        LEFT JOIN derived_native d ON d.txhash = c.txhash AND d.event_index = c.event_index
        WHERE c.committer = @wallet
          AND (@beforeTs IS NULL OR c.ts < @beforeTs)
        ORDER BY c.ts DESC, c.height DESC, c.event_index DESC
        LIMIT @limit`).all(opts);
}

// Every pool one wallet has ever committed to, most recently committed
// first — the explorer's subscription discovery uses this to know WHICH
// pools to ask the chain about instead of reading every factory pool's
// committer ledger (the chain exposes commits per pool, not per wallet).
// The chain's committing_info on each returned pool stays the source of
// truth for the record itself; this is only the candidate list.
export function listPoolsByWallet(db: Db, wallet: string) {
    return db.prepare(`
        SELECT pool, COUNT(*) AS commits, MAX(ts) AS last_commit_ts, MIN(ts) AS first_commit_ts
        FROM commits
        WHERE committer = @wallet
        GROUP BY pool
        ORDER BY last_commit_ts DESC`).all({ wallet });
}

// Cross-pool trade history for one wallet (newest first) — powers the
// portfolio "My Transactions" view. The trader column is filled from the
// swap dispatch's sender (or the committer, for post-threshold commits).
export function listTradesByWallet(db: Db, opts: {
    wallet: string; limit: number; beforeTs: number | null;
}) {
    return db.prepare(`
        SELECT txhash, height, ts, pool, side, source, offer_amount, return_amount, price
        FROM trades
        WHERE trader = @wallet
          AND (@beforeTs IS NULL OR ts < @beforeTs)
        ORDER BY ts DESC, height DESC, event_index DESC
        LIMIT @limit`).all(opts);
}
