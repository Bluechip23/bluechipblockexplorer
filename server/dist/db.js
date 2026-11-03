"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NONCE_TTL_SECONDS = void 0;
exports.openDb = openDb;
exports.migrate = migrate;
exports.getProfileByWallet = getProfileByWallet;
exports.getProfileByName = getProfileByName;
exports.getProfileByPool = getProfileByPool;
exports.getProfilesByPools = getProfilesByPools;
exports.upsertProfile = upsertProfile;
exports.searchProfiles = searchProfiles;
exports.listLinks = listLinks;
exports.listLinksForWallets = listLinksForWallets;
exports.countLinks = countLinks;
exports.countPinned = countPinned;
exports.getLink = getLink;
exports.insertLink = insertLink;
exports.maxPosition = maxPosition;
exports.updateLink = updateLink;
exports.deleteLink = deleteLink;
exports.listTiers = listTiers;
exports.listTiersForWallets = listTiersForWallets;
exports.countTiers = countTiers;
exports.getTier = getTier;
exports.insertTier = insertTier;
exports.updateTier = updateTier;
exports.deleteTier = deleteTier;
exports.setLinkTiers = setLinkTiers;
exports.getTierIdsForLinks = getTierIdsForLinks;
exports.getLinkTierIds = getLinkTierIds;
exports.putNonce = putNonce;
exports.getNonce = getNonce;
exports.consumeNonce = consumeNonce;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
function openDb(path) {
    const db = new better_sqlite3_1.default(path);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    return db;
}
function migrate(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
    wallet_address TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pool_address TEXT,
    bio TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profiles_pool ON profiles(pool_address);

CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    gated INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_wallet_pos ON links(wallet_address, position);
CREATE INDEX IF NOT EXISTS idx_links_wallet_created ON links(wallet_address, created_at);

CREATE TABLE IF NOT EXISTS nonces (
    wallet_address TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    issued_at INTEGER NOT NULL
);

-- Priced subscription tiers. A creator defines up to MAX_TIERS named tiers
-- in total, each on one pool their wallet created (ownership verified
-- on-chain before insert). price_native is a micro-OSMO integer string:
-- the minimum gross commit (committing_info.last_payment_native) that
-- covers the tier for one access window.
CREATE TABLE IF NOT EXISTS tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    pool_address TEXT NOT NULL,
    name TEXT NOT NULL,
    price_native TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tiers_wallet ON tiers(wallet_address);

-- Which tiers gate a link (many-to-many). Only gated links have rows; a
-- gated link with no rows is open to any active subscriber of the
-- creator's profile pool.
CREATE TABLE IF NOT EXISTS link_tiers (
    link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    tier_id INTEGER NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
    PRIMARY KEY (link_id, tier_id)
);
CREATE INDEX IF NOT EXISTS idx_link_tiers_tier ON link_tiers(tier_id);
`);
    // Additive column migrations for databases created before the column
    // existed. SQLite has no ADD COLUMN IF NOT EXISTS.
    const linkColumns = db.pragma('table_info(links)').map((c) => c.name);
    if (!linkColumns.includes('pinned')) {
        db.exec('ALTER TABLE links ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
    }
}
// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
function getProfileByWallet(db, wallet) {
    return db.prepare('SELECT * FROM profiles WHERE wallet_address = ?').get(wallet);
}
function getProfileByName(db, name) {
    return db.prepare('SELECT * FROM profiles WHERE name = ? COLLATE NOCASE').get(name);
}
function getProfileByPool(db, poolAddress) {
    return db.prepare('SELECT * FROM profiles WHERE pool_address = ?').get(poolAddress);
}
// Profiles whose pool is one of `pools` (the subscriber feed's creator set).
// Chunked so a long subscription list never exceeds SQLite's bound-parameter
// limit.
function getProfilesByPools(db, pools) {
    const out = [];
    for (let i = 0; i < pools.length; i += 200) {
        const chunk = pools.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(`SELECT * FROM profiles WHERE pool_address IN (${placeholders})`).all(...chunk));
    }
    return out;
}
function upsertProfile(db, p) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT INTO profiles (wallet_address, name, pool_address, bio, created_at, updated_at)
        VALUES (@wallet_address, @name, @pool_address, @bio, @now, @now)
        ON CONFLICT(wallet_address) DO UPDATE SET
            name = excluded.name,
            pool_address = excluded.pool_address,
            bio = excluded.bio,
            updated_at = excluded.updated_at`).run({ ...p, now });
    return getProfileByWallet(db, p.wallet_address);
}
function searchProfiles(db, q, limit) {
    // Substring name match (case-insensitive) OR exact wallet/pool address.
    // LIKE special characters in user input are escaped so they can't widen
    // the match.
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    return db.prepare(`
        SELECT * FROM profiles
        WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE
           OR wallet_address = ?
           OR pool_address = ?
        ORDER BY name COLLATE NOCASE ASC
        LIMIT ?`).all(`%${escaped}%`, q, q, limit);
}
// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------
function listLinks(db, wallet) {
    return db.prepare('SELECT * FROM links WHERE wallet_address = ? ORDER BY position ASC, id ASC').all(wallet);
}
// Newest-first links across several creators, for the subscriber feed.
function listLinksForWallets(db, wallets, limit) {
    if (wallets.length === 0)
        return [];
    const out = [];
    for (let i = 0; i < wallets.length; i += 200) {
        const chunk = wallets.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(`SELECT * FROM links WHERE wallet_address IN (${placeholders})
             ORDER BY created_at DESC, id DESC LIMIT ?`).all(...chunk, limit));
    }
    return out
        .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
        .slice(0, limit);
}
function countLinks(db, wallet) {
    const row = db.prepare('SELECT COUNT(*) AS n FROM links WHERE wallet_address = ?').get(wallet);
    return row.n;
}
function countPinned(db, wallet) {
    const row = db.prepare('SELECT COUNT(*) AS n FROM links WHERE wallet_address = ? AND pinned = 1').get(wallet);
    return row.n;
}
function getLink(db, id) {
    return db.prepare('SELECT * FROM links WHERE id = ?').get(id);
}
function insertLink(db, l) {
    const now = Math.floor(Date.now() / 1000);
    const info = db.prepare(`INSERT INTO links (wallet_address, title, url, gated, pinned, position, created_at, updated_at)
        VALUES (@wallet_address, @title, @url, @gated, @pinned, @position, @now, @now)`).run({ ...l, now });
    return getLink(db, Number(info.lastInsertRowid));
}
function maxPosition(db, wallet) {
    const row = db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM links WHERE wallet_address = ?').get(wallet);
    return row.p;
}
function updateLink(db, id, patch) {
    const existing = getLink(db, id);
    if (!existing)
        return undefined;
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE links SET
        title = @title, url = @url, gated = @gated, pinned = @pinned, position = @position, updated_at = @now
        WHERE id = @id`).run({
        id,
        title: patch.title ?? existing.title,
        url: patch.url ?? existing.url,
        gated: patch.gated ?? existing.gated,
        pinned: patch.pinned ?? existing.pinned,
        position: patch.position ?? existing.position,
        now,
    });
    return getLink(db, id);
}
function deleteLink(db, id) {
    db.prepare('DELETE FROM links WHERE id = ?').run(id);
}
// ---------------------------------------------------------------------------
// Subscription tiers + link↔tier gating
// ---------------------------------------------------------------------------
// Display order: grouped by pool, cheapest first. Prices are stored as
// integer strings without leading zeros, so ordering by length and then
// text orders them numerically.
const TIER_ORDER = 'pool_address ASC, LENGTH(price_native) ASC, price_native ASC, id ASC';
function listTiers(db, wallet) {
    return db.prepare(`SELECT * FROM tiers WHERE wallet_address = ? ORDER BY ${TIER_ORDER}`).all(wallet);
}
// Tiers of several creators at once (the subscriber feed), chunked like the
// other multi-wallet reads.
function listTiersForWallets(db, wallets) {
    const out = [];
    for (let i = 0; i < wallets.length; i += 200) {
        const chunk = wallets.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(`SELECT * FROM tiers WHERE wallet_address IN (${placeholders}) ORDER BY ${TIER_ORDER}`).all(...chunk));
    }
    return out;
}
function countTiers(db, wallet) {
    const row = db.prepare('SELECT COUNT(*) AS n FROM tiers WHERE wallet_address = ?').get(wallet);
    return row.n;
}
function getTier(db, id) {
    return db.prepare('SELECT * FROM tiers WHERE id = ?').get(id);
}
function insertTier(db, t) {
    const now = Math.floor(Date.now() / 1000);
    const info = db.prepare(`INSERT INTO tiers (wallet_address, pool_address, name, price_native, created_at, updated_at)
        VALUES (@wallet_address, @pool_address, @name, @price_native, @now, @now)`).run({ ...t, now });
    return getTier(db, Number(info.lastInsertRowid));
}
function updateTier(db, id, patch) {
    const existing = getTier(db, id);
    if (!existing)
        return undefined;
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`UPDATE tiers SET name = @name, price_native = @price_native, updated_at = @now
        WHERE id = @id`).run({
        id,
        name: patch.name ?? existing.name,
        price_native: patch.price_native ?? existing.price_native,
        now,
    });
    return getTier(db, id);
}
function deleteTier(db, id) {
    db.prepare('DELETE FROM tiers WHERE id = ?').run(id);
}
/** Replace the whole set of tiers gating a link. */
function setLinkTiers(db, linkId, tierIds) {
    const tx = db.transaction((ids) => {
        db.prepare('DELETE FROM link_tiers WHERE link_id = ?').run(linkId);
        const ins = db.prepare('INSERT OR IGNORE INTO link_tiers (link_id, tier_id) VALUES (?, ?)');
        for (const tid of ids)
            ins.run(linkId, tid);
    });
    tx(tierIds);
}
/**
 * link id → the ids of the tiers gating it, for many links in one pass.
 * Links with no tiers are absent from the map.
 */
function getTierIdsForLinks(db, linkIds) {
    const out = new Map();
    for (let i = 0; i < linkIds.length; i += 500) {
        const chunk = linkIds.slice(i, i + 500);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = db.prepare(`SELECT link_id, tier_id FROM link_tiers WHERE link_id IN (${placeholders}) ORDER BY tier_id ASC`).all(...chunk);
        for (const r of rows) {
            const arr = out.get(r.link_id);
            if (arr)
                arr.push(r.tier_id);
            else
                out.set(r.link_id, [r.tier_id]);
        }
    }
    return out;
}
function getLinkTierIds(db, linkId) {
    return getTierIdsForLinks(db, [linkId]).get(linkId) ?? [];
}
// ---------------------------------------------------------------------------
// Nonces (single active nonce per wallet, 5-minute TTL, consumed on use)
// ---------------------------------------------------------------------------
exports.NONCE_TTL_SECONDS = 5 * 60;
function putNonce(db, wallet, nonce) {
    db.prepare(`INSERT INTO nonces (wallet_address, nonce, issued_at) VALUES (?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET nonce = excluded.nonce, issued_at = excluded.issued_at`)
        .run(wallet, nonce, Math.floor(Date.now() / 1000));
}
function getNonce(db, wallet) {
    return db.prepare('SELECT * FROM nonces WHERE wallet_address = ?').get(wallet);
}
function consumeNonce(db, wallet) {
    db.prepare('DELETE FROM nonces WHERE wallet_address = ?').run(wallet);
}
//# sourceMappingURL=db.js.map