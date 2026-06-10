import { Config } from './config';
import {
    Db, getCursor, insertClaim, insertCommit, insertLiquidity, insertTrade,
    markThresholdCrossed, setCursor, setPoolToken, upsertPool,
} from './db';
import { parseTxEvents } from './parsers';
import { getBlock, getBlockResults, getLatestHeight } from './rpc';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const backoff = Math.min(15_000, 1000 * 2 ** i);
            console.warn(`[ingest] ${label} failed (attempt ${i + 1}/${attempts}): ${(err as Error).message} — retrying in ${backoff}ms`);
            await sleep(backoff);
        }
    }
    throw lastErr;
}

async function ingestHeight(db: Db, cfg: Config, height: number): Promise<void> {
    const [block, txResults] = await Promise.all([
        withRetry(`block ${height}`, () => getBlock(cfg.rpcUrl, height)),
        withRetry(`block_results ${height}`, () => getBlockResults(cfg.rpcUrl, height)),
    ]);

    const writeAll = db.transaction(() => {
        for (let i = 0; i < txResults.length; i++) {
            const tx = txResults[i];
            if (tx.code !== 0) continue;   // failed txs emit no state changes
            const parsed = parseTxEvents({
                txhash: block.txHashes[i] ?? `${height}-${i}`,
                height,
                ts: block.timeSec,
                nativeDenom: cfg.nativeDenom,
                factoryAddress: cfg.factoryAddress,
            }, tx.events);

            for (const p of parsed.pools) upsertPool(db, p);
            for (const t of parsed.poolTokens) setPoolToken(db, t.pool_id, t.token_address);
            for (const c of parsed.commits) insertCommit(db, c);
            for (const t of parsed.trades) insertTrade(db, t);
            for (const l of parsed.liquidity) insertLiquidity(db, l);
            for (const c of parsed.claims) insertClaim(db, c);
            // Apply threshold marks last so the pool row exists.
            for (const tc of parsed.thresholdCrossings) markThresholdCrossed(db, tc.pool, tc.ts);
        }
        setCursor(db, height);
    });
    writeAll();
}

// Walks heights from the stored cursor (or START_HEIGHT) to the chain
// tip, then tails new blocks forever. Resumable: the cursor is committed
// in the same SQLite transaction as each height's rows, and every writer
// is INSERT OR REPLACE, so a crash mid-batch just re-ingests one height.
export async function runIngestLoop(db: Db, cfg: Config): Promise<never> {
    let next = (getCursor(db) ?? cfg.startHeight - 1) + 1;
    console.log(`[ingest] starting at height ${next} (rpc: ${cfg.rpcUrl})`);

    for (;;) {
        let tip: number;
        try {
            tip = await getLatestHeight(cfg.rpcUrl);
        } catch (err) {
            console.warn(`[ingest] cannot reach RPC: ${(err as Error).message}`);
            await sleep(cfg.pollIntervalMs * 2);
            continue;
        }

        if (next > tip) {
            await sleep(cfg.pollIntervalMs);
            continue;
        }

        const end = Math.min(tip, next + cfg.batchSize - 1);
        for (let h = next; h <= end; h++) {
            await ingestHeight(db, cfg, h);
        }
        if (end % 500 === 0 || end === tip) {
            console.log(`[ingest] indexed through height ${end} (tip ${tip})`);
        }
        next = end + 1;
    }
}
