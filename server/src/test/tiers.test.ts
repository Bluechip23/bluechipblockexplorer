import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { after, before, beforeEach, test } from 'node:test';
import { encodeSecp256k1Pubkey, pubkeyToAddress, serializeSignDoc } from '@cosmjs/amino';
import { Secp256k1, sha256 } from '@cosmjs/crypto';
import { toBase64, toBech32 } from '@cosmjs/encoding';
import { Server } from 'node:http';
import { buildApi } from '../api';
import { makeAdr36SignDoc, signDataFor } from '../auth';
import * as chain from '../chain';
import {
    countTiers, Db, getLinkTierIds, getTierIdsForLinks, insertLink, insertTier,
    listTiers, migrate, openDb, setLinkTiers, upsertProfile,
} from '../db';
import { linkGates, qualifiesForLink, standingFrom } from '../gate';
import { MAX_TIERS, validatePriceNative } from '../validate';

const OSMO = 1_000_000n;
const addr = (n: number) => toBech32('osmo', new Uint8Array(20).fill(n));
const POOL_A = addr(1);
const POOL_B = addr(2);
const DAY_NS = 86_400_000_000_000n;
const nowNs = () => BigInt(Date.now()) * 1_000_000n;

// ---------------------------------------------------------------------------
// Pure gate math
// ---------------------------------------------------------------------------

test('cheapest tier per pool sets the gate; untiered links need any active subscription', () => {
    const gates = linkGates([
        { pool_address: POOL_A, price_native: String(20n * OSMO) },
        { pool_address: POOL_A, price_native: String(5n * OSMO) },
        { pool_address: POOL_B, price_native: String(10n * OSMO) },
    ], POOL_A);
    assert.equal(gates.get(POOL_A), 5n * OSMO);
    assert.equal(gates.get(POOL_B), 10n * OSMO);

    assert.deepEqual([...linkGates([], POOL_A)], [[POOL_A, 0n]]);
    assert.equal(linkGates([], null).size, 0, 'no profile pool: owner only');
});

test('a link unlocks on any pool where an active commit paid at least the gate', () => {
    const gates = new Map([[POOL_A, 5n * OSMO], [POOL_B, 10n * OSMO]]);
    const active = (paid: bigint) => ({ active: true, lastPayment: paid });
    assert.equal(qualifiesForLink(gates, new Map([[POOL_A, active(6n * OSMO)]])), true);
    assert.equal(qualifiesForLink(gates, new Map([[POOL_A, active(5n * OSMO)]])), true, 'boundary is inclusive');
    assert.equal(qualifiesForLink(gates, new Map([[POOL_A, active(4n * OSMO)], [POOL_B, null]])), false);
    assert.equal(qualifiesForLink(gates, new Map([[POOL_B, active(10n * OSMO)]])), true, 'cross-pool OR');
    assert.equal(
        qualifiesForLink(gates, new Map([[POOL_A, { active: false, lastPayment: 100n * OSMO }]])),
        false,
        'an expired subscription never qualifies, however much it paid',
    );
    assert.equal(qualifiesForLink(new Map(), new Map([[POOL_A, active(1n)]])), false);
});

test('standing comes from last_payment_native and the access window', () => {
    const fresh = { total_paid_native: '0', last_payment_native: '7000000', last_committed: String(nowNs()) };
    const stale = { ...fresh, last_committed: String(nowNs() - 31n * DAY_NS) };
    assert.deepEqual(standingFrom(fresh, 30), { active: true, lastPayment: 7_000_000n });
    assert.equal(standingFrom(stale, 30)!.active, false);
    assert.equal(standingFrom(null, 30), null);
    assert.equal(standingFrom({ ...fresh, last_payment_native: 'junk' }, 30)!.lastPayment, 0n);
});

test('prices are positive micro-OSMO integer strings', () => {
    assert.equal(validatePriceNative('0005000000').value, '5000000');
    for (const bad of ['0', '1.5', '1e6', '-1', '', 5000000]) {
        assert.equal(validatePriceNative(bad).ok, false, `rejects ${JSON.stringify(bad)}`);
    }
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function seededDb(wallet: string): Db {
    const db = openDb(':memory:');
    migrate(db);
    upsertProfile(db, { wallet_address: wallet, name: 'Creator', pool_address: POOL_A, bio: null });
    return db;
}

test('tiers list cheapest first per pool, and link tiers replace as a set', () => {
    const W = addr(9);
    const db = seededDb(W);
    const gold = insertTier(db, { wallet_address: W, pool_address: POOL_A, name: 'Gold', price_native: '20000000' });
    const bronze = insertTier(db, { wallet_address: W, pool_address: POOL_A, name: 'Bronze', price_native: '5000000' });
    const fan = insertTier(db, { wallet_address: W, pool_address: POOL_B, name: 'Fan', price_native: '100000000' });
    // Grouped by pool, cheapest first inside each pool ("5000000" < "20000000"
    // numerically even though it sorts after it as text).
    const poolA = listTiers(db, W).filter((t) => t.pool_address === POOL_A).map((t) => t.name);
    assert.deepEqual(poolA, ['Bronze', 'Gold']);
    assert.equal(listTiers(db, W).length, 3);
    assert.equal(countTiers(db, W) < MAX_TIERS, true);

    const link = insertLink(db, { wallet_address: W, title: 'x', url: 'https://x.test', gated: 1, pinned: 0, position: 0 });
    setLinkTiers(db, link.id, [gold.id, bronze.id, fan.id]);
    assert.equal(getLinkTierIds(db, link.id).length, 3);
    setLinkTiers(db, link.id, [fan.id]);
    assert.deepEqual(getLinkTierIds(db, link.id), [fan.id]);
    assert.equal(getTierIdsForLinks(db, [link.id, 999]).has(999), false);
});

// ---------------------------------------------------------------------------
// HTTP: signed requests against a stubbed chain
// ---------------------------------------------------------------------------

interface Wallet { address: string; privkey: Uint8Array; pubkey: Uint8Array }

async function makeWallet(seed: number): Promise<Wallet> {
    const kp = await Secp256k1.makeKeypair(new Uint8Array(32).fill(seed));
    const pubkey = Secp256k1.compressPubkey(kp.pubkey);
    return { address: pubkeyToAddress(encodeSecp256k1Pubkey(pubkey), 'osmo'), privkey: kp.privkey, pubkey };
}

let server: Server;
let base = '';
let db: Db;
let creator: Wallet;
let fan: Wallet;
// Stubbed chain state: pool → creator, and pool:wallet → commit record.
const poolCreators = new Map<string, string>();
const commits = new Map<string, chain.CommittingInfo>();

before(async () => {
    creator = await makeWallet(7);
    fan = await makeWallet(8);
    const c = chain as unknown as Record<string, unknown>;
    c.queryPoolCreator = async (_rpc: string, pool: string) => poolCreators.get(pool) ?? null;
    c.queryCommittingInfo = async (_rpc: string, pool: string, wallet: string) => commits.get(`${pool}:${wallet}`) ?? null;
});

beforeEach(async () => {
    if (server) server.close();
    db = openDb(':memory:');
    migrate(db);
    poolCreators.clear();
    commits.clear();
    poolCreators.set(POOL_A, creator.address);
    poolCreators.set(POOL_B, addr(3)); // someone else's pool
    const app = buildApi(db, { port: 0, dbPath: ':memory:', rpcUrl: 'http://stub', rateLimitPerMin: 0, subscriptionDays: 30 });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server?.close());

async function signed(w: Wallet, method: string, path: string, payload: Record<string, unknown>) {
    const { nonce } = await (await fetch(`${base}/auth/nonce?address=${w.address}`)).json() as { nonce: string };
    const digest = sha256(serializeSignDoc(makeAdr36SignDoc(w.address, signDataFor(nonce, payload))));
    const sig = await Secp256k1.createSignature(digest, w.privkey);
    const body = {
        address: w.address, pub_key: toBase64(w.pubkey), nonce, payload,
        signature: toBase64(sig.toFixedLength().slice(0, 64)),
    };
    const res = await fetch(`${base}${path}`, {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as Record<string, any> };
}

function commit(pool: string, w: Wallet, paidOsmo: bigint, daysAgo = 1) {
    commits.set(`${pool}:${w.address}`, {
        total_paid_native: String(paidOsmo * OSMO),
        last_payment_native: String(paidOsmo * OSMO),
        last_committed: String(nowNs() - BigInt(daysAgo) * DAY_NS),
    });
}

async function setUpCreator() {
    const prof = await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_A });
    assert.equal(prof.status, 200, JSON.stringify(prof.body));
    const bronze = (await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Bronze', price_native: String(5n * OSMO) })).body.tier;
    const gold = (await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Gold', price_native: String(20n * OSMO) })).body.tier;
    const add = async (title: string, extra: Record<string, unknown>) =>
        (await signed(creator, 'POST', '/links', { intent: 'add_link', title, url: `https://x.test/${title}`, ...extra })).body.link;
    const links = {
        open: await add('open', {}),
        anySub: await add('anySub', { gated: true }),
        bronze: await add('bronze', { tier_ids: [bronze.id] }),
        gold: await add('gold', { tier_ids: [gold.id] }),
    };
    return { bronze, gold, links };
}

const unlock = async (w: Wallet) => {
    const res = await signed(w, 'POST', '/links/unlock', { intent: 'unlock_links', owner: 'Maker' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return { titles: (res.body.links as { title: string }[]).map((l) => l.title).sort(), body: res.body };
};

test('pool ownership is enforced for the profile pool and for tiers', async () => {
    const stolen = await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_B });
    assert.equal(stolen.status, 403);
    await signed(creator, 'PUT', '/profiles', { intent: 'put_profile', name: 'Maker', pool_address: POOL_A });
    const tier = await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_B, name: 'X', price_native: '1' });
    assert.equal(tier.status, 403);
});

test('public reads expose tiers and tier ids but never gated urls', async () => {
    const { gold, links } = await setUpCreator();
    const res = await (await fetch(`${base}/profiles/Maker`)).json() as Record<string, any>;
    assert.deepEqual(res.tiers.map((t: { name: string }) => t.name), ['Bronze', 'Gold']);
    const goldLink = res.links.find((l: { id: number }) => l.id === links.gold.id);
    assert.deepEqual(goldLink.tier_ids, [gold.id]);
    assert.equal(goldLink.gated, true);
    assert.equal('url' in goldLink, false);
});

test('unlock returns exactly the links the last commit pays for', async () => {
    await setUpCreator();
    assert.deepEqual((await unlock(fan)).titles, [], 'never committed');

    commit(POOL_A, fan, 1n);
    let r = await unlock(fan);
    assert.deepEqual(r.titles, ['anySub'], 'any subscriber, below every tier');
    assert.equal(r.body.subscriptions[0].status, 'active');
    assert.equal(r.body.subscriptions[0].last_payment_native, String(OSMO));

    commit(POOL_A, fan, 5n);
    assert.deepEqual((await unlock(fan)).titles, ['anySub', 'bronze']);

    commit(POOL_A, fan, 25n);
    assert.deepEqual((await unlock(fan)).titles, ['anySub', 'bronze', 'gold'], 'higher tier grants lower');

    commit(POOL_A, fan, 25n, 31);
    r = await unlock(fan);
    assert.deepEqual(r.titles, [], 'expired window');
    assert.equal(r.body.subscriptions[0].status, 'expired');

    assert.equal((await unlock(creator)).titles.length, 3, 'owner sees every gated link');
});

test('link writes: tiers imply gated, un-gating clears tiers, foreign tiers are rejected', async () => {
    const { bronze, gold, links } = await setUpCreator();
    let res = await signed(creator, 'PUT', `/links/${links.open.id}`, { intent: 'update_link', id: links.open.id, tier_ids: [gold.id] });
    assert.equal(res.body.link.gated, true);
    assert.deepEqual(res.body.link.tier_ids, [gold.id]);

    res = await signed(creator, 'PUT', `/links/${links.open.id}`, { intent: 'update_link', id: links.open.id, gated: false });
    assert.equal(res.body.link.gated, false);
    assert.deepEqual(res.body.link.tier_ids, []);

    res = await signed(creator, 'PUT', `/links/${links.bronze.id}`, { intent: 'update_link', id: links.bronze.id, gated: false, tier_ids: [bronze.id] });
    assert.equal(res.status, 400);

    await signed(fan, 'PUT', '/profiles', { intent: 'put_profile', name: 'Fan Person' });
    res = await signed(fan, 'POST', '/links', { intent: 'add_link', title: 't', url: 'https://x.test', tier_ids: [gold.id] });
    assert.equal(res.status, 400, 'cannot gate with another creator\'s tier');
});

test('tier cap, re-pricing, and delete falling back to any subscriber', async () => {
    const { gold, links } = await setUpCreator();
    for (let i = 0; i < MAX_TIERS - 2; i++) {
        await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: `T${i}`, price_native: '1' });
    }
    const over = await signed(creator, 'POST', '/tiers', { intent: 'add_tier', pool_address: POOL_A, name: 'Six', price_native: '1' });
    assert.equal(over.status, 400);

    commit(POOL_A, fan, 10n);
    assert.equal((await unlock(fan)).titles.includes('gold'), false);
    await signed(creator, 'PUT', `/tiers/${gold.id}`, { intent: 'update_tier', id: gold.id, price_native: String(10n * OSMO) });
    assert.equal((await unlock(fan)).titles.includes('gold'), true, 're-pricing takes effect immediately');

    await signed(creator, 'DELETE', `/tiers/${gold.id}`, { intent: 'delete_tier', id: gold.id });
    const res = await (await fetch(`${base}/profiles/Maker`)).json() as Record<string, any>;
    const goldLink = res.links.find((l: { id: number }) => l.id === links.gold.id);
    assert.equal(goldLink.gated, true);
    assert.deepEqual(goldLink.tier_ids, []);
});

test('feed unlock applies the same per-link tiers and counts tier-locked links', async () => {
    await setUpCreator();
    commit(POOL_A, fan, 5n);
    const feed = await (await fetch(`${base}/feed`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pools: [POOL_A] }),
    })).json() as Record<string, any>;
    assert.equal(feed.tiers.length, 2);
    assert.equal(feed.links.every((l: { tier_ids?: unknown }) => Array.isArray(l.tier_ids)), true);

    const res = await signed(fan, 'POST', '/feed/unlock', { intent: 'unlock_feed', pools: [POOL_A] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.links.map((l: { title: string }) => l.title).sort(), ['anySub', 'bronze']);
    assert.deepEqual(res.body.verified_pools, [POOL_A]);
    assert.equal(res.body.tier_locked, 1);
});
