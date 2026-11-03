"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEED_MAX_LINKS = exports.FEED_MAX_POOLS = void 0;
exports.buildApi = buildApi;
const crypto_1 = require("crypto");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const chain_1 = require("./chain");
const db_1 = require("./db");
const gate_1 = require("./gate");
const validate_1 = require("./validate");
// ---------------------------------------------------------------------------
// Serialization. Public reads NEVER include the url of a gated link — the
// only paths that return gated urls are the owner's signed reads and the
// signed /links/unlock subscription check.
// ---------------------------------------------------------------------------
// `tier_ids` is public: viewers need to know which tier a locked link asks
// for. A gated link with no tier ids is open to any active subscriber.
function publicLink(l, tierIds) {
    const base = {
        id: l.id, title: l.title, gated: !!l.gated, pinned: !!l.pinned, position: l.position,
        tier_ids: tierIds, created_at: l.created_at, updated_at: l.updated_at,
    };
    return l.gated ? base : { ...base, url: l.url };
}
function fullLink(l, tierIds) {
    return {
        id: l.id, title: l.title, url: l.url, gated: !!l.gated, pinned: !!l.pinned, position: l.position,
        tier_ids: tierIds, created_at: l.created_at, updated_at: l.updated_at,
    };
}
// Serialize many links with their tier ids attached (one link_tiers read).
function withTierIds(db, links, serialize) {
    const ids = (0, db_1.getTierIdsForLinks)(db, links.map((l) => l.id));
    return links.map((l) => serialize(l, ids.get(l.id) ?? []));
}
// Tiers are public: name, pool and price (micro-OSMO string) are what a
// follower needs to pick one.
function publicTier(t) {
    return {
        id: t.id,
        wallet_address: t.wallet_address,
        pool_address: t.pool_address,
        name: t.name,
        price_native: t.price_native,
    };
}
// Feed rows carry the creator inline so the client can render a mixed,
// newest-first list without a second lookup per creator.
function feedCreator(p) {
    return { name: p.name, wallet_address: p.wallet_address, pool_address: p.pool_address };
}
// The subscriber feed is keyed by pool addresses (what the viewer's on-chain
// commit ledger identifies). Bounded and de-duplicated; invalid entries are
// rejected rather than silently dropped so a malformed client is visible.
exports.FEED_MAX_POOLS = 200;
exports.FEED_MAX_LINKS = 500;
function parseFeedPools(raw) {
    if (!Array.isArray(raw))
        return { ok: false, error: 'pools must be an array of pool addresses' };
    if (raw.length > exports.FEED_MAX_POOLS)
        return { ok: false, error: `at most ${exports.FEED_MAX_POOLS} pools per request` };
    const pools = [];
    for (const p of raw) {
        if (!(0, validate_1.isOsmoAddress)(p))
            return { ok: false, error: 'pools must be valid osmo1... bech32 addresses' };
        if (!pools.includes(p))
            pools.push(p);
    }
    return { ok: true, pools };
}
function parseFeedLimit(raw) {
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    if (!Number.isInteger(n) || n <= 0)
        return exports.FEED_MAX_LINKS;
    return Math.min(n, exports.FEED_MAX_LINKS);
}
// Run `fn` over `items` with at most `width` in flight — the unlock path
// issues one RPC query per subscribed pool.
async function mapLimited(items, width, fn) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}
// Every gated link of `profiles`, with its pool → cheapest-price gates.
function gatedLinksOf(db, profiles) {
    const tiersById = new Map((0, db_1.listTiersForWallets)(db, profiles.map((p) => p.wallet_address)).map((t) => [t.id, t]));
    const out = [];
    for (const profile of profiles) {
        const gated = (0, db_1.listLinks)(db, profile.wallet_address).filter((l) => l.gated);
        const idsByLink = (0, db_1.getTierIdsForLinks)(db, gated.map((l) => l.id));
        for (const link of gated) {
            const tierIds = idsByLink.get(link.id) ?? [];
            const tiers = tierIds.map((id) => tiersById.get(id)).filter((t) => !!t);
            out.push({ link, profile, tierIds, gates: (0, gate_1.linkGates)(tiers, profile.pool_address) });
        }
    }
    return out;
}
async function readPools(cfg, pools, wallet, tag) {
    const reads = await mapLimited(pools, 4, async (pool) => {
        try {
            return [pool, { info: await (0, chain_1.queryCommittingInfo)(cfg.rpcUrl, pool, wallet) }];
        }
        catch (err) {
            console.error(`[${tag}] committing_info query failed:`, err);
            return [pool, 'failed'];
        }
    });
    return new Map(reads);
}
function standingsOf(reads, days) {
    const out = new Map();
    for (const [pool, read] of reads) {
        if (read !== 'failed')
            out.set(pool, (0, gate_1.standingFrom)(read.info, days));
    }
    return out;
}
// What the client shows next to a locked link: is the caller subscribed on
// this pool, how much did their last commit pay, and until when.
function subscriptionJson(pool, read, days) {
    if (!read || read === 'failed') {
        return { pool_address: pool, status: 'failed', last_payment_native: null, expires_at: null };
    }
    if (!read.info)
        return { pool_address: pool, status: 'none', last_payment_native: null, expires_at: null };
    const standing = (0, gate_1.standingFrom)(read.info, days);
    const expiresMs = (0, chain_1.subscriptionExpiresAtMs)(read.info, days);
    return {
        pool_address: pool,
        status: standing.active ? 'active' : 'expired',
        last_payment_native: standing.lastPayment.toString(),
        expires_at: expiresMs === null ? null : Math.floor(expiresMs / 1000),
    };
}
function publicProfile(p) {
    return {
        wallet_address: p.wallet_address,
        name: p.name,
        pool_address: p.pool_address,
        bio: p.bio,
        created_at: p.created_at,
        updated_at: p.updated_at,
    };
}
// :idOrName may be a wallet address, a profile name, or a pool address.
function resolveProfile(db, idOrName) {
    if ((0, validate_1.isOsmoAddress)(idOrName)) {
        return (0, db_1.getProfileByWallet)(db, idOrName) ?? (0, db_1.getProfileByPool)(db, idOrName);
    }
    return (0, db_1.getProfileByName)(db, idOrName);
}
// Fixed-window per-IP rate limiter (same shape as the indexer's — no
// external deps; set RATE_LIMIT_PER_MIN=0 behind a proxy that rate-limits).
function rateLimiter(maxPerMinute) {
    const windows = new Map();
    return (req, res, next) => {
        if (maxPerMinute <= 0 || req.path === '/health')
            return next();
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const w = windows.get(ip);
        if (!w || now - w.windowStart >= 60_000) {
            windows.set(ip, { windowStart: now, count: 1 });
            if (windows.size > 10_000) {
                for (const [k, v] of windows) {
                    if (now - v.windowStart >= 60_000)
                        windows.delete(k);
                }
            }
            return next();
        }
        w.count += 1;
        if (w.count > maxPerMinute) {
            res.status(429).json({ error: 'rate limit exceeded' });
            return;
        }
        next();
    };
}
// Shared preamble for every signed endpoint: shape-check the auth fields,
// require a payload object with the expected `intent` (binding the signature
// to one specific endpoint), then verify nonce + pubkey + ADR-36 signature.
// On-chain pool-ownership gate shared by PUT /profiles and POST /tiers.
// Returns true when the signer created the pool; otherwise it has already
// answered (403 not the owner, 502 RPC failure) and the caller must return.
async function verifyPoolOwnership(cfg, res, poolAddress, wallet) {
    let creator;
    try {
        creator = await (0, chain_1.queryPoolCreator)(cfg.rpcUrl, poolAddress);
    }
    catch (err) {
        console.error('[pool-ownership] fee_info query failed:', err);
        res.status(502).json({ error: 'could not verify pool ownership on-chain — try again' });
        return false;
    }
    if (creator !== wallet) {
        res.status(403).json({ error: 'that pool was not created by your wallet' });
        return false;
    }
    return true;
}
// Validate a link write's `tier_ids` and confirm every tier belongs to the
// caller. Returns the de-duplicated ids, or null after answering 400.
function resolveOwnedTiers(db, res, wallet, raw) {
    const parsed = (0, validate_1.validateTierIds)(raw);
    if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return null;
    }
    for (const id of parsed.value) {
        const tier = (0, db_1.getTier)(db, id);
        if (!tier || tier.wallet_address !== wallet) {
            res.status(400).json({ error: `tier ${id} does not exist or is not yours` });
            return null;
        }
    }
    return parsed.value;
}
async function requireSigned(db, req, res, intent) {
    const auth = (0, auth_1.extractAuth)(req.body);
    const payload = req.body?.payload;
    if (!auth || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        res.status(400).json({ error: 'expected { address, pub_key, signature, nonce, payload }' });
        return null;
    }
    if (!(0, validate_1.isOsmoAddress)(auth.address)) {
        res.status(400).json({ error: 'address must be a valid osmo1... bech32 address' });
        return null;
    }
    const p = payload;
    if (p.intent !== intent) {
        res.status(400).json({ error: `payload.intent must be "${intent}"` });
        return null;
    }
    const check = await (0, auth_1.verifySignedRequest)(db, auth, payload);
    if (!check.ok) {
        res.status(check.status ?? 401).json({ error: check.error });
        return null;
    }
    return { auth, payload: p };
}
function buildApi(db, cfg) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)()); // public read API — allow all origins
    app.use(express_1.default.json({ limit: '64kb' })); // JSON only, small bodies
    app.use(rateLimiter(cfg.rateLimitPerMin));
    app.get('/health', (_req, res) => {
        res.json({ ok: true, subscription_days: cfg.subscriptionDays });
    });
    // ---- Auth -------------------------------------------------------------
    app.get('/auth/nonce', (req, res) => {
        const address = String(req.query.address || '');
        if (!(0, validate_1.isOsmoAddress)(address)) {
            return res.status(400).json({ error: 'address must be a valid osmo1... bech32 address' });
        }
        const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
        (0, db_1.putNonce)(db, address, nonce);
        res.json({ nonce });
    });
    // ---- Public reads -----------------------------------------------------
    app.get('/profiles/:idOrName', (req, res) => {
        const idOrName = String(req.params.idOrName || '').trim();
        if (!idOrName || idOrName.length > 90) {
            return res.status(400).json({ error: 'invalid profile identifier' });
        }
        const profile = resolveProfile(db, idOrName);
        if (!profile)
            return res.status(404).json({ error: 'profile not found' });
        res.json({
            profile: publicProfile(profile),
            links: withTierIds(db, (0, db_1.listLinks)(db, profile.wallet_address), publicLink),
            tiers: (0, db_1.listTiers)(db, profile.wallet_address).map(publicTier),
        });
    });
    app.get('/search', (req, res) => {
        const q = String(req.query.q || '').trim();
        if (!q || q.length > 90)
            return res.json({ results: [] });
        const rows = (0, db_1.searchProfiles)(db, q, 20);
        res.json({
            results: rows.map((p) => ({
                name: p.name,
                wallet_address: p.wallet_address,
                pool_address: p.pool_address,
            })),
        });
    });
    // ---- Subscriber feed ----------------------------------------------------
    //
    // The platform hosts nothing but links, so a subscriber's "feed" is the
    // newest links across every creator they are committed to. The client
    // discovers those pools from the chain and posts them here; this is a
    // public read (gated links come without url, exactly like
    // GET /profiles/:idOrName) — POST only because a long pool list does
    // not fit in a query string.
    app.post('/feed', (req, res) => {
        const body = (req.body ?? {});
        const parsed = parseFeedPools(body.pools);
        if (!parsed.ok)
            return res.status(400).json({ error: parsed.error });
        const limit = parseFeedLimit(body.limit);
        const profiles = (0, db_1.getProfilesByPools)(db, parsed.pools);
        const byWallet = new Map(profiles.map((p) => [p.wallet_address, p]));
        const wallets = profiles.map((p) => p.wallet_address);
        const links = (0, db_1.listLinksForWallets)(db, wallets, limit);
        res.json({
            creators: profiles.map(feedCreator),
            links: withTierIds(db, links, (l, ids) => ({
                ...publicLink(l, ids), creator: feedCreator(byWallet.get(l.wallet_address)),
            })),
            tiers: (0, db_1.listTiersForWallets)(db, wallets).map(publicTier),
        });
    });
    // One signature unlocks the gated links of every subscribed creator at
    // once, with the same per-link enforcement as /links/unlock: each link's
    // gate pools are read once for the caller and a link is returned with
    // its url only when an active subscription paid enough for one of its
    // tiers (or the caller owns it). Per creator, the response also says
    // whose subscription is verified, expired (renew) or unreadable (retry),
    // and how many links still need a higher tier.
    app.post('/feed/unlock', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'unlock_feed');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const parsed = parseFeedPools(payload.pools);
        if (!parsed.ok)
            return res.status(400).json({ error: parsed.error });
        const profiles = (0, db_1.getProfilesByPools)(db, parsed.pools);
        const gated = gatedLinksOf(db, profiles);
        const pools = new Set();
        for (const p of profiles)
            if (p.wallet_address !== auth.address)
                pools.add(p.pool_address);
        for (const g of gated) {
            if (g.profile.wallet_address !== auth.address)
                for (const pool of g.gates.keys())
                    pools.add(pool);
        }
        const reads = await readPools(cfg, [...pools], auth.address, 'feed/unlock');
        const standings = standingsOf(reads, cfg.subscriptionDays);
        const verified = [];
        const expired = [];
        const failed = [];
        for (const p of profiles) {
            const pool = p.pool_address;
            if (p.wallet_address === auth.address) {
                verified.push(pool);
                continue;
            }
            const read = reads.get(pool);
            if (read === 'failed')
                failed.push(pool);
            else if (read?.info)
                (standings.get(pool)?.active ? verified : expired).push(pool);
        }
        const links = [];
        let tierLocked = 0;
        for (const g of gated) {
            const own = g.profile.wallet_address === auth.address;
            if (own || (0, gate_1.qualifiesForLink)(g.gates, standings)) {
                links.push({ ...fullLink(g.link, g.tierIds), creator: feedCreator(g.profile) });
            }
            else if (verified.includes(g.profile.pool_address)) {
                // Subscribed to this creator, but the last commit is below
                // every tier this link accepts.
                tierLocked += 1;
            }
        }
        res.json({
            links,
            verified_pools: verified,
            expired_pools: expired,
            failed_pools: failed,
            tier_locked: tierLocked,
            subscription_days: cfg.subscriptionDays,
        });
    });
    // ---- Signed writes ----------------------------------------------------
    app.put('/profiles', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'put_profile');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const name = (0, validate_1.validateName)(payload.name);
        if (!name.ok)
            return res.status(400).json({ error: name.error });
        const bio = (0, validate_1.validateBio)(payload.bio);
        if (!bio.ok)
            return res.status(400).json({ error: bio.error });
        const pool = (0, validate_1.validatePoolAddress)(payload.pool_address);
        if (!pool.ok)
            return res.status(400).json({ error: pool.error });
        // Reject case-insensitive name collisions with other wallets.
        const existing = (0, db_1.getProfileByName)(db, name.value);
        if (existing && existing.wallet_address !== auth.address) {
            return res.status(409).json({ error: 'that name is already taken' });
        }
        // A profile pool must belong to the signer on-chain: it decides whose
        // subscribers see this profile's links in their feed, so pointing it
        // at someone else's pool would post into their subscribers' feeds.
        // An unchanged pool is not re-checked.
        const current = (0, db_1.getProfileByWallet)(db, auth.address);
        if (pool.value && pool.value !== current?.pool_address) {
            if (!(await verifyPoolOwnership(cfg, res, pool.value, auth.address)))
                return;
        }
        const profile = (0, db_1.upsertProfile)(db, {
            wallet_address: auth.address,
            name: name.value,
            pool_address: pool.value ?? null,
            bio: bio.value ?? null,
        });
        res.json({
            profile: publicProfile(profile),
            links: withTierIds(db, (0, db_1.listLinks)(db, auth.address), fullLink),
            tiers: (0, db_1.listTiers)(db, auth.address).map(publicTier),
        });
    });
    app.post('/links', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'add_link');
        if (!signed)
            return;
        const { auth, payload } = signed;
        if (!(0, db_1.getProfileByWallet)(db, auth.address)) {
            return res.status(400).json({ error: 'create a profile first (PUT /profiles)' });
        }
        const title = (0, validate_1.validateTitle)(payload.title);
        if (!title.ok)
            return res.status(400).json({ error: title.error });
        const url = (0, validate_1.validateUrl)(payload.url);
        if (!url.ok)
            return res.status(400).json({ error: url.error });
        const gated = (0, validate_1.validateGated)(payload.gated);
        if (!gated.ok)
            return res.status(400).json({ error: gated.error });
        const pinned = (0, validate_1.validatePinned)(payload.pinned);
        if (!pinned.ok)
            return res.status(400).json({ error: pinned.error });
        const position = (0, validate_1.validatePosition)(payload.position);
        if (!position.ok)
            return res.status(400).json({ error: position.error });
        if (pinned.value && (0, db_1.countPinned)(db, auth.address) >= validate_1.MAX_PINNED) {
            return res.status(400).json({ error: `at most ${validate_1.MAX_PINNED} pinned links per profile` });
        }
        // Tiers imply gated. Gated with no tiers = any active subscriber.
        const tierIds = resolveOwnedTiers(db, res, auth.address, payload.tier_ids);
        if (tierIds === null)
            return;
        if (tierIds.length > 0 && payload.gated !== undefined && !gated.value) {
            return res.status(400).json({ error: 'a link with tiers must be gated' });
        }
        const link = (0, db_1.insertLink)(db, {
            wallet_address: auth.address,
            title: title.value,
            url: url.value,
            gated: tierIds.length > 0 ? 1 : gated.value,
            pinned: pinned.value,
            position: position.value ?? (0, db_1.maxPosition)(db, auth.address) + 1,
        });
        (0, db_1.setLinkTiers)(db, link.id, tierIds);
        res.json({ link: fullLink(link, tierIds) });
    });
    app.put('/links/:id', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'update_link');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || payload.id !== id) {
            return res.status(400).json({ error: 'payload.id must match the link id in the URL' });
        }
        const existing = (0, db_1.getLink)(db, id);
        if (!existing || existing.wallet_address !== auth.address) {
            // Same response for "missing" and "not yours" — don't leak ids.
            return res.status(404).json({ error: 'link not found' });
        }
        const patch = {};
        if (payload.title !== undefined) {
            const title = (0, validate_1.validateTitle)(payload.title);
            if (!title.ok)
                return res.status(400).json({ error: title.error });
            patch.title = title.value;
        }
        if (payload.url !== undefined) {
            const url = (0, validate_1.validateUrl)(payload.url);
            if (!url.ok)
                return res.status(400).json({ error: url.error });
            patch.url = url.value;
        }
        if (payload.gated !== undefined) {
            const gated = (0, validate_1.validateGated)(payload.gated);
            if (!gated.ok)
                return res.status(400).json({ error: gated.error });
            patch.gated = gated.value;
        }
        if (payload.pinned !== undefined) {
            const pinned = (0, validate_1.validatePinned)(payload.pinned);
            if (!pinned.ok)
                return res.status(400).json({ error: pinned.error });
            if (pinned.value && !existing.pinned && (0, db_1.countPinned)(db, auth.address) >= validate_1.MAX_PINNED) {
                return res.status(400).json({ error: `at most ${validate_1.MAX_PINNED} pinned links per profile` });
            }
            patch.pinned = pinned.value;
        }
        if (payload.position !== undefined) {
            const position = (0, validate_1.validatePosition)(payload.position);
            if (!position.ok)
                return res.status(400).json({ error: position.error });
            patch.position = position.value;
        }
        // tier_ids, when present, replaces the link's tier set; tiers imply
        // gated, and un-gating a link clears its tiers.
        let tierIds = null;
        if (payload.tier_ids !== undefined) {
            tierIds = resolveOwnedTiers(db, res, auth.address, payload.tier_ids);
            if (tierIds === null)
                return;
        }
        const gatedAfter = patch.gated ?? existing.gated;
        if (tierIds && tierIds.length > 0) {
            if (payload.gated !== undefined && !gatedAfter) {
                return res.status(400).json({ error: 'a link with tiers must be gated' });
            }
            patch.gated = 1;
        }
        else if (!gatedAfter) {
            tierIds = [];
        }
        const link = (0, db_1.updateLink)(db, id, patch);
        if (tierIds !== null)
            (0, db_1.setLinkTiers)(db, id, tierIds);
        res.json({ link: fullLink(link, (0, db_1.getLinkTierIds)(db, id)) });
    });
    app.delete('/links/:id', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'delete_link');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || payload.id !== id) {
            return res.status(400).json({ error: 'payload.id must match the link id in the URL' });
        }
        const existing = (0, db_1.getLink)(db, id);
        if (!existing || existing.wallet_address !== auth.address) {
            return res.status(404).json({ error: 'link not found' });
        }
        (0, db_1.deleteLink)(db, id);
        res.json({ ok: true });
    });
    // ---- Subscription tiers --------------------------------------------------
    //
    // A tier is a named OSMO price on one of the creator's own pools: an
    // active subscription whose last commit paid at least that much covers
    // it. Creating one verifies on-chain that the signer created the pool.
    app.post('/tiers', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'add_tier');
        if (!signed)
            return;
        const { auth, payload } = signed;
        if (!(0, db_1.getProfileByWallet)(db, auth.address)) {
            return res.status(400).json({ error: 'create a profile first (PUT /profiles)' });
        }
        if ((0, db_1.countTiers)(db, auth.address) >= validate_1.MAX_TIERS) {
            return res.status(400).json({ error: `at most ${validate_1.MAX_TIERS} subscription tiers per creator` });
        }
        if (!(0, validate_1.isOsmoAddress)(payload.pool_address)) {
            return res.status(400).json({ error: 'pool_address must be a valid osmo1... bech32 address' });
        }
        const poolAddress = payload.pool_address;
        const name = (0, validate_1.validateTierName)(payload.name);
        if (!name.ok)
            return res.status(400).json({ error: name.error });
        const price = (0, validate_1.validatePriceNative)(payload.price_native);
        if (!price.ok)
            return res.status(400).json({ error: price.error });
        if (!(await verifyPoolOwnership(cfg, res, poolAddress, auth.address)))
            return;
        const tier = (0, db_1.insertTier)(db, {
            wallet_address: auth.address,
            pool_address: poolAddress,
            name: name.value,
            price_native: price.value,
        });
        res.json({ tier: publicTier(tier) });
    });
    // Rename or re-price a tier. Its pool is fixed: moving a tier to another
    // pool is delete + create, which re-runs the ownership check.
    app.put('/tiers/:id', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'update_tier');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || payload.id !== id) {
            return res.status(400).json({ error: 'payload.id must match the tier id in the URL' });
        }
        const existing = (0, db_1.getTier)(db, id);
        if (!existing || existing.wallet_address !== auth.address) {
            return res.status(404).json({ error: 'tier not found' });
        }
        const patch = {};
        if (payload.name !== undefined) {
            const name = (0, validate_1.validateTierName)(payload.name);
            if (!name.ok)
                return res.status(400).json({ error: name.error });
            patch.name = name.value;
        }
        if (payload.price_native !== undefined) {
            const price = (0, validate_1.validatePriceNative)(payload.price_native);
            if (!price.ok)
                return res.status(400).json({ error: price.error });
            patch.price_native = price.value;
        }
        res.json({ tier: publicTier((0, db_1.updateTier)(db, id, patch)) });
    });
    // Deleting a tier removes it from every link it gated (cascade). A link
    // left with no tiers stays gated and falls back to "any active
    // subscriber"; the manage page warns about that before deleting.
    app.delete('/tiers/:id', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'delete_tier');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const id = parseInt(String(req.params.id), 10);
        if (!Number.isInteger(id) || payload.id !== id) {
            return res.status(400).json({ error: 'payload.id must match the tier id in the URL' });
        }
        const existing = (0, db_1.getTier)(db, id);
        if (!existing || existing.wallet_address !== auth.address) {
            return res.status(404).json({ error: 'tier not found' });
        }
        (0, db_1.deleteTier)(db, id);
        res.json({ ok: true });
    });
    // ---- Subscription-gated unlock -----------------------------------------
    //
    // The real enforcement point for gated links, per link. Verify the
    // caller's identity (ADR-36), read the caller's committing_info once on
    // every pool the creator's gated links depend on, and return only the
    // links whose gate the caller meets: an active subscription (last commit
    // within cfg.subscriptionDays) whose last payment is at least the
    // cheapest attached tier on that pool. Untiered gated links need any
    // active subscription to the profile pool. Owners see everything. Any
    // RPC failure fails closed (502) rather than partially unlocking.
    app.post('/links/unlock', async (req, res) => {
        const signed = await requireSigned(db, req, res, 'unlock_links');
        if (!signed)
            return;
        const { auth, payload } = signed;
        const ownerKey = typeof payload.owner === 'string' ? payload.owner.trim() : '';
        if (!ownerKey || ownerKey.length > 90) {
            return res.status(400).json({ error: 'payload.owner (wallet, name, or pool address) is required' });
        }
        const profile = resolveProfile(db, ownerKey);
        if (!profile)
            return res.status(404).json({ error: 'profile not found' });
        const gated = gatedLinksOf(db, [profile]);
        if (profile.wallet_address === auth.address) {
            return res.json({
                links: gated.map((g) => fullLink(g.link, g.tierIds)),
                subscriptions: [],
                subscription_days: cfg.subscriptionDays,
            });
        }
        const pools = new Set();
        if (profile.pool_address)
            pools.add(profile.pool_address);
        for (const g of gated)
            for (const pool of g.gates.keys())
                pools.add(pool);
        const reads = await readPools(cfg, [...pools], auth.address, 'unlock');
        if ([...reads.values()].some((r) => r === 'failed')) {
            return res.status(502).json({ error: 'could not verify subscription on-chain — try again' });
        }
        const standings = standingsOf(reads, cfg.subscriptionDays);
        res.json({
            links: gated.filter((g) => (0, gate_1.qualifiesForLink)(g.gates, standings)).map((g) => fullLink(g.link, g.tierIds)),
            subscriptions: [...pools].map((pool) => subscriptionJson(pool, reads.get(pool), cfg.subscriptionDays)),
            subscription_days: cfg.subscriptionDays,
        });
    });
    return app;
}
//# sourceMappingURL=api.js.map