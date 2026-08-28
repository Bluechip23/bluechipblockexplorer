import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
    commitSeries, creatorStatement, Db, insertClaim, insertCommit, insertTrade,
    listCommits, listCommitsByWallet, listTrades, listTradesByWallet, migrate,
    priceSeries, upsertPool, volumeSeries, windowStats,
} from '../db';

const POOL = 'bluechip1pool';
const T0 = 1_700_002_800;   // bucket-aligned base time (472223 * 3600)

function freshDb(): Db {
    const db = new Database(':memory:');
    migrate(db);
    upsertPool(db, { address: POOL, pool_id: 1, kind: 'commit', created_height: 1, created_at: T0 });
    return db;
}

function trade(db: Db, i: number, ts: number, side: 'buy' | 'sell', price: number, bluechipMicro: string) {
    insertTrade(db, {
        txhash: `TX${i}`, event_index: 0, height: i, ts, pool: POOL,
        trader: 'bluechip1trader', side, source: 'swap',
        offer_amount: side === 'buy' ? bluechipMicro : '999',
        return_amount: side === 'buy' ? '999' : bluechipMicro,
        commission: null, spread: null, price,
        reserve0_after: null, reserve1_after: null,
    });
}

test('priceSeries returns OHLC + bluechip volume per bucket', () => {
    const db = freshDb();
    // Bucket 1 (T0..T0+3600): prices 1.0 -> 3.0 -> 2.0
    trade(db, 1, T0 + 10, 'buy', 1.0, '1000000');
    trade(db, 2, T0 + 20, 'sell', 3.0, '2000000');
    trade(db, 3, T0 + 30, 'buy', 2.0, '3000000');
    // Bucket 2: single trade at 5.0
    trade(db, 4, T0 + 3700, 'buy', 5.0, '4000000');

    const rows = priceSeries(db, { pool: POOL, bucket: 3600, from: T0, to: T0 + 7200 }) as any[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].t, T0);
    assert.equal(rows[0].open, 1.0);
    assert.equal(rows[0].high, 3.0);
    assert.equal(rows[0].low, 1.0);
    assert.equal(rows[0].close, 2.0);
    assert.equal(rows[0].trades, 3);
    // buys contribute offer_amount, sells contribute return_amount.
    assert.equal(rows[0].volume_bluechip, 1000000 + 2000000 + 3000000);
    assert.equal(rows[1].close, 5.0);
});

test('volumeSeries splits buy and sell pressure', () => {
    const db = freshDb();
    trade(db, 1, T0 + 10, 'buy', 1.0, '1000000');
    trade(db, 2, T0 + 20, 'buy', 1.1, '2000000');
    trade(db, 3, T0 + 30, 'sell', 0.9, '500000');

    const rows = volumeSeries(db, { pool: POOL, bucket: 3600, from: T0, to: T0 + 3600 }) as any[];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].buys, 2);
    assert.equal(rows[0].sells, 1);
    assert.equal(rows[0].buy_volume_bluechip, 3000000);
    assert.equal(rows[0].sell_volume_bluechip, 500000);
});

test('commitSeries counts commits, USD and unique wallets per bucket', () => {
    const db = freshDb();
    const commit = (i: number, ts: number, wallet: string, usd: string) => insertCommit(db, {
        txhash: `C${i}`, event_index: 0, height: i, ts, pool: POOL,
        committer: wallet, phase: 'funding',
        amount_bluechip: '1', amount_usd: usd,
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });
    commit(1, T0 + 5, 'bluechip1a', '1000000');
    commit(2, T0 + 6, 'bluechip1a', '2000000');
    commit(3, T0 + 7, 'bluechip1b', '3000000');

    const rows = commitSeries(db, { pool: POOL, bucket: 3600, from: T0, to: T0 + 3600 }) as any[];
    assert.equal(rows[0].commits, 3);
    assert.equal(rows[0].usd, 6000000);
    assert.equal(rows[0].unique_committers, 2);
});

test('listTrades honors side and whale-size filters', () => {
    const db = freshDb();
    trade(db, 1, T0 + 1, 'buy', 1.0, '1000000');
    trade(db, 2, T0 + 2, 'sell', 1.0, '50000000');
    trade(db, 3, T0 + 3, 'buy', 1.0, '100000000');

    const whales = listTrades(db, { pool: POOL, limit: 10, beforeTs: null, side: null, minOfferBluechip: 40000000 }) as any[];
    assert.equal(whales.length, 2);
    const sellsOnly = listTrades(db, { pool: POOL, limit: 10, beforeTs: null, side: 'sell', minOfferBluechip: null }) as any[];
    assert.equal(sellsOnly.length, 1);
    assert.equal(sellsOnly[0].txhash, 'TX2');
});

test('creatorStatement merges commit fee shares (string math) with claims chronologically', () => {
    const db = freshDb();
    insertCommit(db, {
        txhash: 'C1', event_index: 0, height: 1, ts: T0 + 10, pool: POOL,
        committer: 'bluechip1fan', phase: 'funding',
        amount_bluechip: '8000000', amount_usd: '1000000',     // $1.00 commit
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });
    insertClaim(db, {
        txhash: 'CL1', event_index: 1, height: 2, ts: T0 + 20, pool: POOL,
        action: 'claim_creator_fees', creator: 'bluechip1creator',
        amount_0: '850000000', amount_1: '1200000000',
    });

    const rows = creatorStatement(db, { pool: POOL, from: T0, to: T0 + 3600, feeBps: 500 });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, 'commit_fee');
    assert.equal(rows[0].fee_share_usd, '50000');             // 5% of $1.00, micro-USD
    assert.equal(rows[1].type, 'fee_pot_claim');
    assert.equal(rows[1].amount_0, '850000000');
});

test('windowStats compares the current window to the previous one', () => {
    const db = freshDb();
    const now = T0 + 86400 * 2;
    trade(db, 1, now - 1000, 'buy', 1.0, '1000000');          // current window
    trade(db, 2, now - 86400 - 1000, 'sell', 1.0, '2000000'); // previous window
    insertCommit(db, {
        txhash: 'C1', event_index: 0, height: 3, ts: now - 500, pool: POOL,
        committer: 'bluechip1fan', phase: 'funding',
        amount_bluechip: '1', amount_usd: '7000000',
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });

    const s = windowStats(db, POOL, 86400, now) as any;
    assert.equal(s.current.trades, 1);
    assert.equal(s.current.buys, 1);
    assert.equal(s.current.commit_usd, 7000000);
    assert.equal(s.previous.trades, 1);
    assert.equal(s.previous.sells, 1);
});

test('listCommitsByWallet returns cross-pool history newest first', () => {
    const db = freshDb();
    upsertPool(db, { address: 'bluechip1pool2', pool_id: 2, kind: 'commit', created_height: 2, created_at: T0 });
    const commit = (i: number, ts: number, pool: string) => insertCommit(db, {
        txhash: `W${i}`, event_index: 0, height: i, ts, pool,
        committer: 'bluechip1fan', phase: 'funding',
        amount_bluechip: '1000000', amount_usd: '125000',
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });
    commit(1, T0 + 10, POOL);
    commit(2, T0 + 20, 'bluechip1pool2');
    insertCommit(db, {
        txhash: 'OTHER', event_index: 0, height: 3, ts: T0 + 30, pool: POOL,
        committer: 'bluechip1someoneelse', phase: 'funding',
        amount_bluechip: '1', amount_usd: '1',
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });

    const rows = listCommitsByWallet(db, { wallet: 'bluechip1fan', limit: 10, beforeTs: null }) as any[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].txhash, 'W2');           // newest first
    assert.equal(rows[0].pool, 'bluechip1pool2');
    assert.equal(rows[1].txhash, 'W1');
});

// ---------------------------------------------------------------------------
// Current-chain events: no per-commit amount_usd, only the running total
// (usd_raised_after). Per-commit USD must be derived as the delta between
// consecutive totals.
// ---------------------------------------------------------------------------

function currentChainCommit(db: Db, i: number, ts: number, wallet: string, raisedAfter: string | null, phase = 'funding') {
    insertCommit(db, {
        txhash: `N${i}`, event_index: 0, height: i, ts, pool: POOL,
        committer: wallet, phase,
        amount_bluechip: '1000000', amount_usd: null,
        usd_raised_after: raisedAfter, bluechip_raised_after: null, tokens_received: null,
    });
}

test('commitSeries derives per-commit USD from usd_raised_after running totals', () => {
    const db = freshDb();
    currentChainCommit(db, 1, T0 + 5, 'bluechip1a', '1000000');    // +$1
    currentChainCommit(db, 2, T0 + 6, 'bluechip1a', '3000000');    // +$2
    currentChainCommit(db, 3, T0 + 3700, 'bluechip1b', '7500000'); // +$4.50, next bucket

    const rows = commitSeries(db, { pool: POOL, bucket: 3600, from: T0, to: T0 + 7200 }) as any[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].usd, 3000000);
    // The delta at the second bucket's edge must use the previous bucket's
    // total, not restart from zero.
    assert.equal(rows[1].usd, 4500000);
});

test('listCommits exposes derived commit_usd (and leaves active commits null)', () => {
    const db = freshDb();
    currentChainCommit(db, 1, T0 + 5, 'bluechip1a', '2000000');
    currentChainCommit(db, 2, T0 + 6, 'bluechip1b', '5000000');
    currentChainCommit(db, 3, T0 + 7, 'bluechip1c', null, 'active'); // post-threshold: no USD info

    const rows = listCommits(db, { pool: POOL, limit: 10, beforeTs: null, wallet: null }) as any[];
    assert.equal(rows.length, 3);
    // Newest first: active row has no derivable USD.
    assert.equal(rows[0].commit_usd, null);
    assert.equal(rows[1].commit_usd, '3000000');
    assert.equal(rows[2].commit_usd, '2000000');
    // Legacy rows keep their explicit amount_usd.
    insertCommit(db, {
        txhash: 'L1', event_index: 0, height: 10, ts: T0 + 100, pool: POOL,
        committer: 'bluechip1legacy', phase: 'funding',
        amount_bluechip: '1', amount_usd: '999',
        usd_raised_after: null, bluechip_raised_after: null, tokens_received: null,
    });
    const withLegacy = listCommits(db, { pool: POOL, limit: 1, beforeTs: null, wallet: 'bluechip1legacy' }) as any[];
    assert.equal(withLegacy[0].commit_usd, '999');
});

test('creatorStatement fee shares work from derived USD on current-chain commits', () => {
    const db = freshDb();
    currentChainCommit(db, 1, T0 + 10, 'bluechip1fan', '1000000');   // $1.00 first commit
    currentChainCommit(db, 2, T0 + 20, 'bluechip1fan', '5000000');   // +$4.00

    const rows = creatorStatement(db, { pool: POOL, from: T0, to: T0 + 3600, feeBps: 500 });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].gross_usd, '1000000');
    assert.equal(rows[0].fee_share_usd, '50000');    // 5% of $1.00
    assert.equal(rows[1].gross_usd, '4000000');
    assert.equal(rows[1].fee_share_usd, '200000');   // 5% of $4.00
});

test('listTradesByWallet returns cross-pool trade history newest first', () => {
    const db = freshDb();
    upsertPool(db, { address: 'bluechip1pool2', pool_id: 2, kind: 'commit', created_height: 2, created_at: T0 });
    insertTrade(db, {
        txhash: 'T1', event_index: 0, height: 1, ts: T0 + 10, pool: POOL,
        trader: 'bluechip1me', side: 'buy', source: 'swap',
        offer_amount: '1000000', return_amount: '500', commission: null, spread: null,
        price: 2.0, reserve0_after: null, reserve1_after: null,
    });
    insertTrade(db, {
        txhash: 'T2', event_index: 0, height: 2, ts: T0 + 20, pool: 'bluechip1pool2',
        trader: 'bluechip1me', side: 'sell', source: 'swap',
        offer_amount: '500', return_amount: '900000', commission: null, spread: null,
        price: 1.8, reserve0_after: null, reserve1_after: null,
    });
    insertTrade(db, {
        txhash: 'T3', event_index: 0, height: 3, ts: T0 + 30, pool: POOL,
        trader: 'bluechip1notme', side: 'buy', source: 'swap',
        offer_amount: '1', return_amount: '1', commission: null, spread: null,
        price: 1.0, reserve0_after: null, reserve1_after: null,
    });

    const rows = listTradesByWallet(db, { wallet: 'bluechip1me', limit: 10, beforeTs: null }) as any[];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].txhash, 'T2');            // newest first
    assert.equal(rows[0].pool, 'bluechip1pool2');
    assert.equal(rows[0].side, 'sell');
    assert.equal(rows[1].txhash, 'T1');
});
