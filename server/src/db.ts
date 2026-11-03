import Database from 'better-sqlite3';

// Creator-profile storage. Wallet addresses are the primary identity;
// display names are unique case-insensitively so /creator/<name> lookups
// can't be squatted with case variants.

export type Db = Database.Database;

export function openDb(path: string): Db {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    return db;
}

export function migrate(db: Db): void {
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
    const linkColumns = (db.pragma('table_info(links)') as Array<{ name: string }>).map((c) => c.name);
    if (!linkColumns.includes('pinned')) {
        db.exec('ALTER TABLE links ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
    }
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ProfileRow {
    wallet_address: string;
    name: string;
    pool_address: string | null;
    bio: string | null;
    created_at: number;
    updated_at: number;
}

export interface LinkRow {
    id: number;
    wallet_address: string;
    title: string;
    url: string;
    gated: number;
    // Pinned links are the creator's "bio" set: shown at the top of the
    // links page in position order. Unpinned links are posts, newest first.
    pinned: number;
    position: number;
    created_at: number;
    updated_at: number;
}

export interface TierRow {
    id: number;
    wallet_address: string;
    pool_address: string;
    name: string;
    price_native: string;
    created_at: number;
    updated_at: number;
}

export interface NonceRow {
    wallet_address: string;
    nonce: string;
    issued_at: number;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export function getProfileByWallet(db: Db, wallet: string): ProfileRow | undefined {
    return db.prepare('SELECT * FROM profiles WHERE wallet_address = ?').get(wallet) as ProfileRow | undefined;
}

export function getProfileByName(db: Db, name: string): ProfileRow | undefined {
    return db.prepare('SELECT * FROM profiles WHERE name = ? COLLATE NOCASE').get(name) as ProfileRow | undefined;
}

export function getProfileByPool(db: Db, poolAddress: string): ProfileRow | undefined {
    return db.prepare('SELECT * FROM profiles WHERE pool_address = ?').get(poolAddress) as ProfileRow | undefined;
}

// Profiles whose pool is one of `pools` (the subscriber feed's creator set).
// Chunked so a long subscription list never exceeds SQLite's bound-parameter
// limit.
export function getProfilesByPools(db: Db, pools: string[]): ProfileRow[] {
    const out: ProfileRow[] = [];
    for (let i = 0; i < pools.length; i += 200) {
        const chunk = pools.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(
            `SELECT * FROM profiles WHERE pool_address IN (${placeholders})`,
        ).all(...chunk) as ProfileRow[]);
    }
    return out;
}

export function upsertProfile(db: Db, p: {
    wallet_address: string; name: string; pool_address: string | null; bio: string | null;
}): ProfileRow {
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT INTO profiles (wallet_address, name, pool_address, bio, created_at, updated_at)
        VALUES (@wallet_address, @name, @pool_address, @bio, @now, @now)
        ON CONFLICT(wallet_address) DO UPDATE SET
            name = excluded.name,
            pool_address = excluded.pool_address,
            bio = excluded.bio,
            updated_at = excluded.updated_at`).run({ ...p, now });
    return getProfileByWallet(db, p.wallet_address)!;
}

export function searchProfiles(db: Db, q: string, limit: number): ProfileRow[] {
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
        LIMIT ?`).all(`%${escaped}%`, q, q, limit) as ProfileRow[];
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export function listLinks(db: Db, wallet: string): LinkRow[] {
    return db.prepare(
        'SELECT * FROM links WHERE wallet_address = ? ORDER BY position ASC, id ASC',
    ).all(wallet) as LinkRow[];
}

// Newest-first links across several creators, for the subscriber feed.
export function listLinksForWallets(db: Db, wallets: string[], limit: number): LinkRow[] {
    if (wallets.length === 0) return [];
    const out: LinkRow[] = [];
    for (let i = 0; i < wallets.length; i += 200) {
        const chunk = wallets.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(
            `SELECT * FROM links WHERE wallet_address IN (${placeholders})
             ORDER BY created_at DESC, id DESC LIMIT ?`,
        ).all(...chunk, limit) as LinkRow[]);
    }
    return out
        .sort((a, b) => b.created_at - a.created_at || b.id - a.id)
        .slice(0, limit);
}

export function countLinks(db: Db, wallet: string): number {
    const row = db.prepare('SELECT COUNT(*) AS n FROM links WHERE wallet_address = ?').get(wallet) as { n: number };
    return row.n;
}

export function countPinned(db: Db, wallet: string): number {
    const row = db.prepare(
        'SELECT COUNT(*) AS n FROM links WHERE wallet_address = ? AND pinned = 1',
    ).get(wallet) as { n: number };
    return row.n;
}

export function getLink(db: Db, id: number): LinkRow | undefined {
    return db.prepare('SELECT * FROM links WHERE id = ?').get(id) as LinkRow | undefined;
}

export function insertLink(db: Db, l: {
    wallet_address: string; title: string; url: string; gated: number; pinned: number; position: number;
}): LinkRow {
    const now = Math.floor(Date.now() / 1000);
    const info = db.prepare(`INSERT INTO links (wallet_address, title, url, gated, pinned, position, created_at, updated_at)
        VALUES (@wallet_address, @title, @url, @gated, @pinned, @position, @now, @now)`).run({ ...l, now });
    return getLink(db, Number(info.lastInsertRowid))!;
}

export function maxPosition(db: Db, wallet: string): number {
    const row = db.prepare(
        'SELECT COALESCE(MAX(position), -1) AS p FROM links WHERE wallet_address = ?',
    ).get(wallet) as { p: number };
    return row.p;
}

export function updateLink(db: Db, id: number, patch: {
    title?: string; url?: string; gated?: number; pinned?: number; position?: number;
}): LinkRow | undefined {
    const existing = getLink(db, id);
    if (!existing) return undefined;
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

export function deleteLink(db: Db, id: number): void {
    db.prepare('DELETE FROM links WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------------
// Subscription tiers + link↔tier gating
// ---------------------------------------------------------------------------

// Display order: grouped by pool, cheapest first. Prices are stored as
// integer strings without leading zeros, so ordering by length and then
// text orders them numerically.
const TIER_ORDER = 'pool_address ASC, LENGTH(price_native) ASC, price_native ASC, id ASC';

export function listTiers(db: Db, wallet: string): TierRow[] {
    return db.prepare(
        `SELECT * FROM tiers WHERE wallet_address = ? ORDER BY ${TIER_ORDER}`,
    ).all(wallet) as TierRow[];
}

// Tiers of several creators at once (the subscriber feed), chunked like the
// other multi-wallet reads.
export function listTiersForWallets(db: Db, wallets: string[]): TierRow[] {
    const out: TierRow[] = [];
    for (let i = 0; i < wallets.length; i += 200) {
        const chunk = wallets.slice(i, i + 200);
        const placeholders = chunk.map(() => '?').join(',');
        out.push(...db.prepare(
            `SELECT * FROM tiers WHERE wallet_address IN (${placeholders}) ORDER BY ${TIER_ORDER}`,
        ).all(...chunk) as TierRow[]);
    }
    return out;
}

export function countTiers(db: Db, wallet: string): number {
    const row = db.prepare('SELECT COUNT(*) AS n FROM tiers WHERE wallet_address = ?').get(wallet) as { n: number };
    return row.n;
}

export function getTier(db: Db, id: number): TierRow | undefined {
    return db.prepare('SELECT * FROM tiers WHERE id = ?').get(id) as TierRow | undefined;
}

export function insertTier(db: Db, t: {
    wallet_address: string; pool_address: string; name: string; price_native: string;
}): TierRow {
    const now = Math.floor(Date.now() / 1000);
    const info = db.prepare(`INSERT INTO tiers (wallet_address, pool_address, name, price_native, created_at, updated_at)
        VALUES (@wallet_address, @pool_address, @name, @price_native, @now, @now)`).run({ ...t, now });
    return getTier(db, Number(info.lastInsertRowid))!;
}

export function updateTier(db: Db, id: number, patch: { name?: string; price_native?: string }): TierRow | undefined {
    const existing = getTier(db, id);
    if (!existing) return undefined;
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

export function deleteTier(db: Db, id: number): void {
    db.prepare('DELETE FROM tiers WHERE id = ?').run(id);
}

/** Replace the whole set of tiers gating a link. */
export function setLinkTiers(db: Db, linkId: number, tierIds: number[]): void {
    const tx = db.transaction((ids: number[]) => {
        db.prepare('DELETE FROM link_tiers WHERE link_id = ?').run(linkId);
        const ins = db.prepare('INSERT OR IGNORE INTO link_tiers (link_id, tier_id) VALUES (?, ?)');
        for (const tid of ids) ins.run(linkId, tid);
    });
    tx(tierIds);
}

/**
 * link id → the ids of the tiers gating it, for many links in one pass.
 * Links with no tiers are absent from the map.
 */
export function getTierIdsForLinks(db: Db, linkIds: number[]): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (let i = 0; i < linkIds.length; i += 500) {
        const chunk = linkIds.slice(i, i + 500);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = db.prepare(
            `SELECT link_id, tier_id FROM link_tiers WHERE link_id IN (${placeholders}) ORDER BY tier_id ASC`,
        ).all(...chunk) as { link_id: number; tier_id: number }[];
        for (const r of rows) {
            const arr = out.get(r.link_id);
            if (arr) arr.push(r.tier_id);
            else out.set(r.link_id, [r.tier_id]);
        }
    }
    return out;
}

export function getLinkTierIds(db: Db, linkId: number): number[] {
    return getTierIdsForLinks(db, [linkId]).get(linkId) ?? [];
}

// ---------------------------------------------------------------------------
// Nonces (single active nonce per wallet, 5-minute TTL, consumed on use)
// ---------------------------------------------------------------------------

export const NONCE_TTL_SECONDS = 5 * 60;

export function putNonce(db: Db, wallet: string, nonce: string): void {
    db.prepare(`INSERT INTO nonces (wallet_address, nonce, issued_at) VALUES (?, ?, ?)
        ON CONFLICT(wallet_address) DO UPDATE SET nonce = excluded.nonce, issued_at = excluded.issued_at`)
        .run(wallet, nonce, Math.floor(Date.now() / 1000));
}

export function getNonce(db: Db, wallet: string): NonceRow | undefined {
    return db.prepare('SELECT * FROM nonces WHERE wallet_address = ?').get(wallet) as NonceRow | undefined;
}

export function consumeNonce(db: Db, wallet: string): void {
    db.prepare('DELETE FROM nonces WHERE wallet_address = ?').run(wallet);
}
