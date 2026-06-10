import cors from 'cors';
import express, { Express, Request } from 'express';
import {
    commitSeries, creatorStatement, Db, healthCounts, listCommits,
    listCommitsByWallet, listPools, listTrades, priceSeries, volumeSeries,
    windowStats,
} from './db';

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
    const n = parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

function optInt(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : null;
}

const BECH32ISH = /^[a-z0-9]{8,90}$/;

function poolParam(req: Request): string | null {
    const p = String(req.params.address || '');
    return BECH32ISH.test(p) ? p : null;
}

function seriesParams(req: Request, pool: string) {
    const nowSec = Math.floor(Date.now() / 1000);
    const bucket = clampInt(req.query.bucket, 3600, 60, 30 * 86400);
    const to = clampInt(req.query.to, nowSec + 60, 0, 4_000_000_000);
    const from = clampInt(req.query.from, to - 30 * 86400, 0, 4_000_000_000);
    return { pool, bucket, from, to };
}

// Fixed-window per-IP rate limiter (no external deps). Generous default
// for a public explorer; set RATE_LIMIT_PER_MIN=0 to disable when the
// API sits behind a reverse proxy that already rate-limits.
function rateLimiter(maxPerMinute: number) {
    const windows = new Map<string, { windowStart: number; count: number }>();
    return (req: Request, res: any, next: () => void) => {
        if (maxPerMinute <= 0 || req.path === '/health') return next();
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const w = windows.get(ip);
        if (!w || now - w.windowStart >= 60_000) {
            windows.set(ip, { windowStart: now, count: 1 });
            // Opportunistic cleanup so the map can't grow unbounded.
            if (windows.size > 10_000) {
                for (const [k, v] of windows) {
                    if (now - v.windowStart >= 60_000) windows.delete(k);
                }
            }
            return next();
        }
        w.count += 1;
        if (w.count > maxPerMinute) {
            return res.status(429).json({ error: 'rate limit exceeded' });
        }
        next();
    };
}

export function buildApi(db: Db): Express {
    const app = express();
    app.use(cors());
    app.use(rateLimiter(parseInt(process.env.RATE_LIMIT_PER_MIN ?? '300', 10)));

    app.get('/health', (_req, res) => {
        res.json({ ok: true, ...healthCounts(db) });
    });

    app.get('/pools', (_req, res) => {
        res.json(listPools(db));
    });

    app.get('/pools/:address/price-series', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        res.json(priceSeries(db, seriesParams(req, pool)));
    });

    app.get('/pools/:address/volume-series', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        res.json(volumeSeries(db, seriesParams(req, pool)));
    });

    app.get('/pools/:address/commit-series', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        res.json(commitSeries(db, seriesParams(req, pool)));
    });

    app.get('/pools/:address/trades', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        const side = req.query.side === 'buy' || req.query.side === 'sell' ? req.query.side : null;
        res.json(listTrades(db, {
            pool,
            limit: clampInt(req.query.limit, 50, 1, 1000),
            beforeTs: optInt(req.query.before_ts),
            side,
            minOfferBluechip: optInt(req.query.min_bluechip),
        }));
    });

    app.get('/pools/:address/commits', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        const wallet = typeof req.query.wallet === 'string' && BECH32ISH.test(req.query.wallet)
            ? req.query.wallet : null;
        res.json(listCommits(db, {
            pool,
            limit: clampInt(req.query.limit, 50, 1, 1000),
            beforeTs: optInt(req.query.before_ts),
            wallet,
        }));
    });

    app.get('/wallets/:address/commits', (req, res) => {
        const wallet = poolParam(req);   // same bech32 shape check
        if (!wallet) return res.status(400).json({ error: 'invalid wallet address' });
        res.json(listCommitsByWallet(db, {
            wallet,
            limit: clampInt(req.query.limit, 50, 1, 1000),
            beforeTs: optInt(req.query.before_ts),
        }));
    });

    app.get('/pools/:address/creator-statement', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        const nowSec = Math.floor(Date.now() / 1000);
        res.json(creatorStatement(db, {
            pool,
            from: clampInt(req.query.from, 0, 0, 4_000_000_000),
            to: clampInt(req.query.to, nowSec + 60, 0, 4_000_000_000),
            // commit_fee_creator default is 5%; pass fee_bps to override
            // if the factory config differs.
            feeBps: clampInt(req.query.fee_bps, 500, 0, 10_000),
        }));
    });

    app.get('/pools/:address/stats', (req, res) => {
        const pool = poolParam(req);
        if (!pool) return res.status(400).json({ error: 'invalid pool address' });
        const windowSec = clampInt(req.query.window, 86400, 3600, 90 * 86400);
        res.json(windowStats(db, pool, windowSec, Math.floor(Date.now() / 1000)));
    });

    return app;
}
