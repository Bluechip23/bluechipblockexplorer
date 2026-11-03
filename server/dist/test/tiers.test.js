"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const amino_1 = require("@cosmjs/amino");
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
const api_1 = require("../api");
const auth_1 = require("../auth");
const chain = __importStar(require("../chain"));
const db_1 = require("../db");
const gate_1 = require("../gate");
const validate_1 = require("../validate");
const OSMO = 1000000n;
const addr = (n) => (0, encoding_1.toBech32)('osmo', new Uint8Array(20).fill(n));
const POOL_A = addr(1);
const POOL_B = addr(2);
const DAY_NS = 86400000000000n;
const nowNs = () => BigInt(Date.now()) * 1000000n;
// ---------------------------------------------------------------------------
// Pure gate math
// ---------------------------------------------------------------------------
(0, node_test_1.test)('cheapest tier per pool sets the gate; untiered links need any active subscription', () => {
    const gates = (0, gate_1.linkGates)([
        { pool_address: POOL_A, price_native: String(20n * OSMO) },
        { pool_address: POOL_A, price_native: String(5n * OSMO) },
        { pool_address: POOL_B, price_native: String(10n * OSMO) },
    ], POOL_A);
    strict_1.default.equal(gates.get(POOL_A), 5n * OSMO);
    strict_1.default.equal(gates.get(POOL_B), 10n * OSMO);
    strict_1.default.deepEqual([...(0, gate_1.linkGates)([], POOL_A)], [[POOL_A, 0n]]);
    strict_1.default.equal((0, gate_1.linkGates)([], null).size, 0, 'no profile pool: owner only');
});
(0, node_test_1.test)('a link unlocks on any pool where an active commit paid at least the gate', () => {
    const gates = new Map([[POOL_A, 5n * OSMO], [POOL_B, 10n * OSMO]]);
    const active = (paid) => ({ active: true, lastPayment: paid });
    strict_1.default.equal((0, gate_1.qualifiesForLink)(gates, new Map([[POOL_A, active(6n * OSMO)]])), true);
    strict_1.default.equal((0, gate_1.qualifiesForLink)(gates, new Map([[POOL_A, active(5n * OSMO)]])), true, 'boundary is inclusive');
    strict_1.default.equal((0, gate_1.qualifiesForLink)(gates, new Map([[POOL_A, active(4n * OSMO)], [POOL_B, null]])), false);
    strict_1.default.equal((0, gate_1.qualifiesForLink)(gates, new Map([[POOL_B, active(10n * OSMO)]])), true, 'cross-pool OR');
    strict_1.default.equal((0, gate_1.qualifiesForLink)(gates, new Map([[POOL_A, { active: false, lastPayment: 100n * OSMO }]])), false, 'an expired subscription never qualifies, however much it paid');
    strict_1.default.equal((0, gate_1.qualifiesForLink)(new Map(), new Map([[POOL_A, active(1n)]])), false);
});
(0, node_test_1.test)('standing comes from last_payment_native and the access window', () => {
    const fresh = { total_paid_native: '0', last_payment_native: '7000000', last_committed: String(nowNs()) };
    const stale = { ...fresh, last_committed: String(nowNs() - 31n * DAY_NS) };
    strict_1.default.deepEqual((0, gate_1.standingFrom)(fresh, 30), { active: true, lastPayment: 7000000n });
    strict_1.default.equal((0, gate_1.standingFrom)(stale, 30).active, false);
    strict_1.default.equal((0, gate_1.standingFrom)(null, 30), null);
    strict_1.default.equal((0, gate_1.standingFrom)({ ...fresh, last_payment_native: 'junk' }, 30).lastPayment, 0n);
});
(0, node_test_1.test)('prices are positive micro-OSMO integer strings', () => {
    strict_1.default.equal((0, validate_1.validatePriceNative)('0005000000').value, '5000000');
    for (const bad of ['0', '1.5', '1e6', '-1', '', 5000000]) {
        strict_1.default.equal((0, validate_1.validatePriceNative)(bad).ok, false, `rejects ${JSON.stringify(bad)}`);
    }
});
// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function seededDb(wallet) {
    const db = (0, db_1.openDb)(':memory:');
    (0, db_1.migrate)(db);
    (0, db_1.upsertProfile)(db, { wallet_address: wallet, name: 'Creator', pool_address: POOL_A, bio: null });
    return db;
}
(0, node_test_1.test)('tiers list cheapest first per pool, and link tiers replace as a set', () => {
    const W = addr(9);
    const db = seededDb(W);
    const gold = (0, db_1.insertTier)(db, { wallet_address: W, pool_address: POOL_A, name: 'Gold', price_native: '20000000' });
    const bronze = (0, db_1.insertTier)(db, { wallet_address: W, pool_address: POOL_A, name: 'Bronze', price_native: '5000000' });
    const fan = (0, db_1.insertTier)(db, { wallet_address: W, pool_address: POOL_B, name: 'Fan', price_native: '100000000' });
    // Grouped by pool, cheapest first inside each pool ("5000000" < "20000000"
    // numerically even though it sorts after it as text).
    const poolA = (0, db_1.listTiers)(db, W).filter((t) => t.pool_address === POOL_A).map((t) => t.name);
    strict_1.default.deepEqual(poolA, ['Bronze', 'Gold']);
    strict_1.default.equal((0, db_1.listTiers)(db, W).length, 3);
    strict_1.default.equal((0, db_1.countTiers)(db, W) < validate_1.MAX_TIERS, true);
    const link = (0, db_1.insertLink)(db, { wallet_address: W, title: 'x', url: 'https://x.test', gated: 1, pinned: 0, position: 0 });
    (0, db_1.setLinkTiers)(db, link.id, [gold.id, bronze.id, fan.id]);
    strict_1.default.equal((0, db_1.getLinkTierIds)(db, link.id).length, 3);
    (0, db_1.setLinkTiers)(db, link.id, [fan.id]);
    strict_1.default.deepEqual((0, db_1.getLinkTierIds)(db, link.id), [fan.id]);
    strict_1.default.equal((0, db_1.getTierIdsForLinks)(db, [link.id, 999]).has(999), false);
});
async function makeWallet(seed) {
    const kp = await crypto_1.Secp256k1.makeKeypair(new Uint8Array(32).fill(seed));
    const pubkey = crypto_1.Secp256k1.compressPubkey(kp.pubkey);
    return { address: (0, amino_1.pubkeyToAddress)((0, amino_1.encodeSecp256k1Pubkey)(pubkey), 'osmo'), privkey: kp.privkey, pubkey };
}
let server;
let base = '';
let db;
let creator;
let fan;
// Stubbed chain state: pool → creator, and pool:wallet → commit record.
const poolCreators = new Map();
const commits = new Map();
(0, node_test_1.before)(async () => {
    creator = await makeWallet(7);
    fan = await makeWallet(8);
    const c = chain;
    c.queryPoolCreator = async (_rpc, pool) => poolCreators.get(pool) ?? null;
    c.queryCommittingInfo = async (_rpc, pool, wallet) => commits.get(`${pool}:${wallet}`) ?? null;
});
(0, node_test_1.beforeEach)(async () => {
    if (server)
        server.close();
    db = (0, db_1.openDb)(':memory:');
    (0, db_1.migrate)(db);
    poolCreators.clear();
    commits.clear();
    poolCreators.set(POOL_A, creator.address);
    poolCreators.set(POOL_B, addr(3)); // someone else's pool
    const app = (0, api_1.buildApi)(db, { port: 0, dbPath: ':memory:', rpcUrl: 'http://stub', rateLimitPerMin: 0, subscriptionDays: 30 });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
(0, node_test_1.after)(() => server?.close());
async function signed(w, method, path, payload) {
    const { nonce } = await (await fetch(`${base}/auth/nonce?address=${w.address}`)).json();
    const digest = (0, crypto_1.sha256)((0, amino_1.serializeSignDoc)((0, auth_1.makeAdr36SignDoc)(w.address, (0, auth_1.signDataFor)(nonce, payload))));
    const sig = await crypto_1.Secp256k1.createSignature(digest, w.privkey);
    const body = {
        address: w.address, pub_key: (0, encoding_1.toBase64)(w.pubkey), nonce, payload,
        signature: (0, encoding_1.toBase64)(sig.toFixedLength().slice(0, 64)),
    };
    const res = await fetch(`${base}${path}`, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}
function commit(pool, w, paidOsmo, daysAgo = 1) {
    commits.set(`${pool}:${w.address}`, {
        total_paid_native: String(paidOsmo * OSMO),
        last_payment_native: String(paidOsmo * OSMO),
        last_committed: String(nowNs() - BigInt(daysAgo) * DAY_NS),
    });
}
async function setUpCreator() {
    const prof = await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_A });
    strict_1.default.equal(prof.status, 200, JSON.stringify(prof.body));
    const bronze = (await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Bronze', price_native: String(5n * OSMO) })).body.tier;
    const gold = (await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Gold', price_native: String(20n * OSMO) })).body.tier;
    const add = async (title, extra) => (await signed(creator, 'POST', '/links', { intent: 'add_link', title, url: `https://x.test/${title}`, ...extra })).body.link;
    const links = {
        open: await add('open', {}),
        anySub: await add('anySub', { gated: true }),
        bronze: await add('bronze', { tier_ids: [bronze.id] }),
        gold: await add('gold', { tier_ids: [gold.id] }),
    };
    return { bronze, gold, links };
}
const unlock = async (w) => {
    const res = await signed(w, 'POST', '/links/unlock', { intent: 'unlock_links', owner: 'Maker' });
    strict_1.default.equal(res.status, 200, JSON.stringify(res.body));
    return { titles: res.body.links.map((l) => l.title).sort(), body: res.body };
};
(0, node_test_1.test)('pool ownership is enforced for the profile pool and for tiers', async () => {
    const stolen = await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_B });
    strict_1.default.equal(stolen.status, 403);
    await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_A });
    const tier = await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_B, name: 'X', price_native: '1' });
    strict_1.default.equal(tier.status, 403);
});
(0, node_test_1.test)('public reads expose tiers and tier ids but never gated urls', async () => {
    const { gold, links } = await setUpCreator();
    const res = await (await fetch(`${base}/profiles/Maker`)).json();
    strict_1.default.deepEqual(res.tiers.map((t) => t.name), ['Bronze', 'Gold']);
    const goldLink = res.links.find((l) => l.id === links.gold.id);
    strict_1.default.deepEqual(goldLink.tier_ids, [gold.id]);
    strict_1.default.equal(goldLink.gated, true);
    strict_1.default.equal('url' in goldLink, false);
});
(0, node_test_1.test)('unlock returns exactly the links the last commit pays for', async () => {
    await setUpCreator();
    strict_1.default.deepEqual((await unlock(fan)).titles, [], 'never committed');
    commit(POOL_A, fan, 1n);
    let r = await unlock(fan);
    strict_1.default.deepEqual(r.titles, ['anySub'], 'any subscriber, below every tier');
    strict_1.default.equal(r.body.subscriptions[0].status, 'active');
    strict_1.default.equal(r.body.subscriptions[0].last_payment_native, String(OSMO));
    commit(POOL_A, fan, 5n);
    strict_1.default.deepEqual((await unlock(fan)).titles, ['anySub', 'bronze']);
    commit(POOL_A, fan, 25n);
    strict_1.default.deepEqual((await unlock(fan)).titles, ['anySub', 'bronze', 'gold'], 'higher tier grants lower');
    commit(POOL_A, fan, 25n, 31);
    r = await unlock(fan);
    strict_1.default.deepEqual(r.titles, [], 'expired window');
    strict_1.default.equal(r.body.subscriptions[0].status, 'expired');
    strict_1.default.equal((await unlock(creator)).titles.length, 3, 'owner sees every gated link');
});
(0, node_test_1.test)('link writes: tiers imply gated, un-gating clears tiers, foreign tiers are rejected', async () => {
    const { bronze, gold, links } = await setUpCreator();
    let res = await signed(creator, 'PUT', `/links/${links.open.id}`, { intent: 'update_link', id: links.open.id, tier_ids: [gold.id] });
    strict_1.default.equal(res.body.link.gated, true);
    strict_1.default.deepEqual(res.body.link.tier_ids, [gold.id]);
    res = await signed(creator, 'PUT', `/links/${links.open.id}`, { intent: 'update_link', id: links.open.id, gated: false });
    strict_1.default.equal(res.body.link.gated, false);
    strict_1.default.deepEqual(res.body.link.tier_ids, []);
    res = await signed(creator, 'PUT', `/links/${links.bronze.id}`, { intent: 'update_link', id: links.bronze.id, gated: false, tier_ids: [bronze.id] });
    strict_1.default.equal(res.status, 400);
    await signed(fan, 'PUT', '/profiles', { intent: 'put_profile', name: 'Fan Person' });
    res = await signed(fan, 'POST', '/links', { intent: 'add_link', title: 't', url: 'https://x.test', tier_ids: [gold.id] });
    strict_1.default.equal(res.status, 400, 'cannot gate with another creator\'s tier');
});
(0, node_test_1.test)('tier cap, re-pricing, and delete falling back to any subscriber', async () => {
    const { gold, links } = await setUpCreator();
    for (let i = 0; i < validate_1.MAX_TIERS - 2; i++) {
        await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: `T${i}`, price_native: '1' });
    }
    const over = await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Six', price_native: '1' });
    strict_1.default.equal(over.status, 400);
    commit(POOL_A, fan, 10n);
    strict_1.default.equal((await unlock(fan)).titles.includes('gold'), false);
    await signed(creator, 'PUT', `/tiers/${gold.id}`, { intent: 'update_tier', id: gold.id, price_native: String(10n * OSMO) });
    strict_1.default.equal((await unlock(fan)).titles.includes('gold'), true, 're-pricing takes effect immediately');
    await signed(creator, 'DELETE', `/tiers/${gold.id}`, { intent: 'delete_tier', id: gold.id });
    const res = await (await fetch(`${base}/profiles/Maker`)).json();
    const goldLink = res.links.find((l) => l.id === links.gold.id);
    strict_1.default.equal(goldLink.gated, true);
    strict_1.default.deepEqual(goldLink.tier_ids, []);
});
(0, node_test_1.test)('feed unlock applies the same per-link tiers and counts tier-locked links', async () => {
    await setUpCreator();
    commit(POOL_A, fan, 5n);
    const feed = await (await fetch(`${base}/feed`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pools: [POOL_A] }),
    })).json();
    strict_1.default.equal(feed.tiers.length, 2);
    strict_1.default.equal(feed.links.every((l) => Array.isArray(l.tier_ids)), true);
    const res = await signed(fan, 'POST', '/feed/unlock', { intent: 'unlock_feed', pools: [POOL_A] });
    strict_1.default.equal(res.status, 200);
    strict_1.default.deepEqual(res.body.links.map((l) => l.title).sort(), ['anySub', 'bronze']);
    strict_1.default.deepEqual(res.body.verified_pools, [POOL_A]);
    strict_1.default.equal(res.body.tier_locked, 1);
});
//# sourceMappingURL=tiers.test.js.map