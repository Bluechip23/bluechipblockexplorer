// Typed client for the creator-profiles service (see server/README.md).
// The service is optional infrastructure: every read degrades to null/[]
// when it is unreachable, and the whole write surface transparently falls
// back to a localStorage store so the feature stays browsable in demo mode
// (REACT_APP_USE_MOCK_DATA=true or profiles API down). Callers use one
// interface either way.

import { profilesApiUrl } from '../components/universal/IndividualPage.const';
import { CHAIN_CONFIG } from '../defi/types';
import { getDataSource } from './contractQueries';

const BASE_URL = (profilesApiUrl || '').replace(/\/+$/, '');
const DEMO_STORAGE_KEY = 'bluechip.profiles.demo';
const SIGN_PREFIX = 'bluechip-profiles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatorProfile {
    wallet_address: string;
    name: string;
    pool_address: string | null;
    bio: string | null;
}

export interface CreatorLink {
    id: number;
    title: string;
    /** Absent on public reads of gated links — obtain via unlockLinks(). */
    url?: string;
    gated: boolean;
    position: number;
    /** Unix seconds. Present on every service response; optional for older demo entries. */
    created_at?: number;
    updated_at?: number;
}

/** A link in the subscriber feed, with its creator inline. */
export interface FeedLink extends CreatorLink {
    creator: ProfileSearchResult;
}

export interface SubscriberFeed {
    /** Subscribed creators that have a profile (pool → links page). */
    creators: ProfileSearchResult[];
    /** Newest first. Gated links come without url until unlockFeed(). */
    links: FeedLink[];
}

export interface FeedUnlockResult {
    links: FeedLink[];
    /** Pools where the caller's subscription was confirmed on-chain. */
    verified_pools: string[];
    /** Pools whose on-chain check errored (retry; not "unsubscribed"). */
    failed_pools: string[];
}

export interface ProfileWithLinks {
    profile: CreatorProfile;
    links: CreatorLink[];
}

export interface ProfileSearchResult {
    name: string;
    wallet_address: string;
    pool_address: string | null;
}

export type WriteResult<T = undefined> =
    | { ok: true; value?: T }
    | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Mode probe: real API vs localStorage demo store. One probe per session,
// mirroring getDataSource()'s chain/mock dispatch.
// ---------------------------------------------------------------------------

type ProfilesMode = 'api' | 'demo';

let modePromise: Promise<ProfilesMode> | null = null;

function getMode(): Promise<ProfilesMode> {
    if (!modePromise) {
        modePromise = (async () => {
            if ((await getDataSource()) === 'mock') return 'demo';
            const health = await fetchJson<{ ok: boolean }>('/health', 3000);
            if (health?.ok) return 'api';
            console.warn('[bluechip] profiles API unreachable — profiles stored locally (demo mode)');
            return 'demo';
        })();
    }
    return modePromise;
}

/** True when profile writes are stored locally instead of on the service. */
export async function isProfilesDemoMode(): Promise<boolean> {
    return (await getMode()) === 'demo';
}

async function fetchJson<T>(path: string, timeoutMs = 8000, init?: RequestInit): Promise<T | null> {
    if (!BASE_URL) return null;
    try {
        const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

// Writes need the failure body (409 name conflict, 403 no subscription…),
// so they use a variant that surfaces the server's error string.
async function fetchWrite<T>(path: string, method: string, body: unknown): Promise<{ status: number; data: T | null; error?: string }> {
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });
        const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!res.ok) return { status: res.status, data: null, error: data?.error || `request failed (${res.status})` };
        return { status: res.status, data };
    } catch (err) {
        return { status: 0, data: null, error: err instanceof Error ? err.message : 'profiles API unreachable' };
    }
}

// ---------------------------------------------------------------------------
// ADR-36 signing helper (Keplr / Leap signArbitrary)
// ---------------------------------------------------------------------------

// Deterministic JSON — must match server/src/auth.ts canonicalJson exactly.
function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj).sort()
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${parts.join(',')}}`;
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface SignedBody {
    address: string;
    pub_key: string;
    signature: string;
    nonce: string;
    payload: Record<string, unknown>;
}

async function buildSignedBody(
    address: string,
    walletName: string | null,
    payload: Record<string, unknown>,
): Promise<SignedBody> {
    if (walletName === 'Demo') {
        // Demo wallets cannot sign — callers should already have routed the
        // write to the local store; error clearly if one slips through.
        throw new Error('Demo mode — demo profile stored locally, no signing available.');
    }
    const nonceRes = await fetchJson<{ nonce: string }>(`/auth/nonce?address=${encodeURIComponent(address)}`, 8000);
    if (!nonceRes?.nonce) throw new Error('Could not get a signing nonce from the profiles service.');

    const signData = `${SIGN_PREFIX}:${nonceRes.nonce}:${await sha256Hex(canonicalJson(payload))}`;
    // signArbitrary is a Keplr/Leap extension beyond the typed InjectedWallet
    // surface — cast window locally rather than widening the global type.
    const w = window as unknown as {
        keplr?: { signArbitrary?: (chainId: string, signer: string, data: string) => Promise<{ pub_key: { value: string }; signature: string }> };
        leap?: { signArbitrary?: (chainId: string, signer: string, data: string) => Promise<{ pub_key: { value: string }; signature: string }> };
    };
    const provider = walletName === 'Leap' ? w.leap : w.keplr;
    if (!provider?.signArbitrary) {
        throw new Error(`${walletName || 'Wallet'} does not support signArbitrary — update your wallet extension.`);
    }
    const sig = await provider.signArbitrary(CHAIN_CONFIG.chainId, address, signData);
    return {
        address,
        pub_key: sig.pub_key.value,
        signature: sig.signature,
        nonce: nonceRes.nonce,
        payload,
    };
}

// ---------------------------------------------------------------------------
// Demo store (localStorage). Mirrors the server's behavior — including
// hiding gated urls on public reads — so page code is mode-agnostic.
// ---------------------------------------------------------------------------

type DemoLink = Required<Omit<CreatorLink, 'created_at' | 'updated_at'>> & {
    created_at?: number;
    updated_at?: number;
};

interface DemoEntry {
    profile: CreatorProfile;
    links: DemoLink[];
    nextId: number;
}

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

interface DemoStore {
    profiles: Record<string, DemoEntry>;
}

function loadDemoStore(): DemoStore {
    try {
        const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as DemoStore;
            if (parsed && typeof parsed === 'object' && parsed.profiles) return parsed;
        }
    } catch {
        // Corrupt / unavailable storage — start fresh.
    }
    return { profiles: {} };
}

function saveDemoStore(store: DemoStore): void {
    try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Private-mode Safari can throw; demo data is best-effort.
    }
}

function demoFindEntry(store: DemoStore, idOrName: string): DemoEntry | null {
    const direct = store.profiles[idOrName];
    if (direct) return direct;
    const needle = idOrName.trim().toLowerCase();
    for (const entry of Object.values(store.profiles)) {
        if (entry.profile.name.toLowerCase() === needle) return entry;
        if (entry.profile.pool_address === idOrName) return entry;
    }
    return null;
}

function demoLinkBase(l: DemoLink): CreatorLink {
    return {
        id: l.id, title: l.title, gated: l.gated, position: l.position,
        created_at: l.created_at, updated_at: l.updated_at,
    };
}

function demoPublicLinks(entry: DemoEntry): CreatorLink[] {
    return [...entry.links]
        .sort((a, b) => a.position - b.position || a.id - b.id)
        .map((l) => (l.gated ? demoLinkBase(l) : { ...demoLinkBase(l), url: l.url }));
}

function demoSearchResult(entry: DemoEntry): ProfileSearchResult {
    return {
        name: entry.profile.name,
        wallet_address: entry.profile.wallet_address,
        pool_address: entry.profile.pool_address,
    };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getProfile(idOrName: string): Promise<ProfileWithLinks | null> {
    if (!idOrName) return null;
    if ((await getMode()) === 'demo') {
        const entry = demoFindEntry(loadDemoStore(), idOrName);
        return entry ? { profile: entry.profile, links: demoPublicLinks(entry) } : null;
    }
    return fetchJson<ProfileWithLinks>(`/profiles/${encodeURIComponent(idOrName)}`);
}

export async function searchProfiles(q: string): Promise<ProfileSearchResult[]> {
    if (!q.trim()) return [];
    if ((await getMode()) === 'demo') {
        const needle = q.trim().toLowerCase();
        return Object.values(loadDemoStore().profiles)
            .filter((e) => e.profile.name.toLowerCase().includes(needle)
                || e.profile.wallet_address === q
                || e.profile.pool_address === q)
            .slice(0, 20)
            .map((e) => ({
                name: e.profile.name,
                wallet_address: e.profile.wallet_address,
                pool_address: e.profile.pool_address,
            }));
    }
    const res = await fetchJson<{ results: ProfileSearchResult[] }>(`/search?q=${encodeURIComponent(q)}`);
    return res?.results ?? [];
}

// ---------------------------------------------------------------------------
// Writes (nonce → signArbitrary → request; localStorage in demo mode)
// ---------------------------------------------------------------------------

export interface ProfileInput {
    name: string;
    pool_address: string | null;
    bio: string | null;
}

export async function saveProfile(
    address: string,
    walletName: string | null,
    input: ProfileInput,
): Promise<WriteResult> {
    if ((await getMode()) === 'demo') {
        const store = loadDemoStore();
        const name = input.name.trim();
        for (const [wallet, entry] of Object.entries(store.profiles)) {
            if (wallet !== address && entry.profile.name.toLowerCase() === name.toLowerCase()) {
                return { ok: false, error: 'that name is already taken' };
            }
        }
        const existing = store.profiles[address];
        store.profiles[address] = {
            profile: { wallet_address: address, name, pool_address: input.pool_address, bio: input.bio },
            links: existing?.links ?? [],
            nextId: existing?.nextId ?? 1,
        };
        saveDemoStore(store);
        return { ok: true };
    }
    try {
        const body = await buildSignedBody(address, walletName, {
            intent: 'put_profile',
            name: input.name,
            pool_address: input.pool_address ?? undefined,
            bio: input.bio ?? undefined,
        });
        const res = await fetchWrite('/profiles', 'PUT', body);
        return res.error ? { ok: false, error: res.error } : { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'profile save failed' };
    }
}

export interface LinkInput {
    title: string;
    url: string;
    gated: boolean;
    position?: number;
}

export async function addLink(
    address: string,
    walletName: string | null,
    input: LinkInput,
): Promise<WriteResult> {
    if ((await getMode()) === 'demo') {
        const store = loadDemoStore();
        const entry = store.profiles[address];
        if (!entry) return { ok: false, error: 'create a profile first' };
        if (entry.links.length >= 50) return { ok: false, error: 'at most 50 links per profile' };
        const position = input.position ?? (entry.links.reduce((m, l) => Math.max(m, l.position), -1) + 1);
        entry.links.push({
            id: entry.nextId,
            title: input.title,
            url: input.url,
            gated: input.gated,
            position,
            created_at: nowSeconds(),
            updated_at: nowSeconds(),
        });
        entry.nextId += 1;
        saveDemoStore(store);
        return { ok: true };
    }
    try {
        const body = await buildSignedBody(address, walletName, {
            intent: 'add_link',
            title: input.title,
            url: input.url,
            gated: input.gated,
            position: input.position,
        });
        const res = await fetchWrite('/links', 'POST', body);
        return res.error ? { ok: false, error: res.error } : { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'link create failed' };
    }
}

export interface LinkPatch {
    title?: string;
    url?: string;
    gated?: boolean;
    position?: number;
}

export async function updateLink(
    address: string,
    walletName: string | null,
    id: number,
    patch: LinkPatch,
): Promise<WriteResult> {
    if ((await getMode()) === 'demo') {
        const store = loadDemoStore();
        const entry = store.profiles[address];
        const link = entry?.links.find((l) => l.id === id);
        if (!entry || !link) return { ok: false, error: 'link not found' };
        if (patch.title !== undefined) link.title = patch.title;
        if (patch.url !== undefined) link.url = patch.url;
        if (patch.gated !== undefined) link.gated = patch.gated;
        if (patch.position !== undefined) link.position = patch.position;
        link.updated_at = nowSeconds();
        saveDemoStore(store);
        return { ok: true };
    }
    try {
        const body = await buildSignedBody(address, walletName, {
            intent: 'update_link',
            id,
            title: patch.title,
            url: patch.url,
            gated: patch.gated,
            position: patch.position,
        });
        const res = await fetchWrite(`/links/${id}`, 'PUT', body);
        return res.error ? { ok: false, error: res.error } : { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'link update failed' };
    }
}

export async function deleteLink(
    address: string,
    walletName: string | null,
    id: number,
): Promise<WriteResult> {
    if ((await getMode()) === 'demo') {
        const store = loadDemoStore();
        const entry = store.profiles[address];
        if (!entry) return { ok: false, error: 'link not found' };
        entry.links = entry.links.filter((l) => l.id !== id);
        saveDemoStore(store);
        return { ok: true };
    }
    try {
        const body = await buildSignedBody(address, walletName, { intent: 'delete_link', id });
        const res = await fetchWrite(`/links/${id}`, 'DELETE', body);
        return res.error ? { ok: false, error: res.error } : { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'link delete failed' };
    }
}

/**
 * Unlocks the gated links of `owner` (wallet, name, or pool address) for the
 * connected wallet. In API mode this round-trips the server, which checks the
 * caller's committing_info record on the owner's pool contract — the real
 * subscription enforcement. In demo mode gated links unlock immediately.
 */
export async function unlockLinks(
    address: string,
    walletName: string | null,
    owner: string,
): Promise<WriteResult<CreatorLink[]>> {
    if ((await getMode()) === 'demo') {
        const entry = demoFindEntry(loadDemoStore(), owner);
        if (!entry) return { ok: false, error: 'profile not found' };
        return {
            ok: true,
            value: entry.links.filter((l) => l.gated).map((l) => ({ ...demoLinkBase(l), url: l.url })),
        };
    }
    try {
        const body = await buildSignedBody(address, walletName, { intent: 'unlock_links', owner });
        const res = await fetchWrite<{ links: CreatorLink[] }>('/links/unlock', 'POST', body);
        if (res.error) return { ok: false, error: res.error };
        return { ok: true, value: res.data?.links ?? [] };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'unlock failed' };
    }
}

// ---------------------------------------------------------------------------
// Subscriber feed: newest links across every creator the viewer is
// committed to. The caller supplies the subscribed pool addresses (see
// utils/subscriptions.ts); the service maps pools → profiles → links.
// ---------------------------------------------------------------------------

/** Upper bound on pools per feed request (mirrors the service). */
export const FEED_MAX_POOLS = 200;

function demoFeedEntries(pools: string[]): DemoEntry[] {
    const wanted = new Set(pools);
    return Object.values(loadDemoStore().profiles)
        .filter((e) => e.profile.pool_address && wanted.has(e.profile.pool_address));
}

function sortNewest(links: FeedLink[]): FeedLink[] {
    return links.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0) || b.id - a.id);
}

/**
 * Public feed read. Gated links are returned without url (locked); call
 * unlockFeed() once to reveal every gated link the viewer is entitled to.
 * Returns null when the service is unreachable (not "no links").
 */
export async function getFeed(pools: string[]): Promise<SubscriberFeed | null> {
    const trimmed = pools.slice(0, FEED_MAX_POOLS);
    if (trimmed.length === 0) return { creators: [], links: [] };
    if ((await getMode()) === 'demo') {
        const entries = demoFeedEntries(trimmed);
        const links: FeedLink[] = [];
        for (const e of entries) {
            const creator = demoSearchResult(e);
            for (const l of demoPublicLinks(e)) links.push({ ...l, creator });
        }
        return { creators: entries.map(demoSearchResult), links: sortNewest(links) };
    }
    const res = await fetchJson<SubscriberFeed>('/feed', 15000, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pools: trimmed }),
    });
    if (!res) return null;
    return { creators: res.creators ?? [], links: sortNewest(res.links ?? []) };
}

/**
 * Reveals the gated links of every subscribed creator with ONE wallet
 * signature. The service re-checks committing_info on each pool for the
 * caller — the same enforcement as unlockLinks(). Demo mode unlocks all.
 */
export async function unlockFeed(
    address: string,
    walletName: string | null,
    pools: string[],
): Promise<WriteResult<FeedUnlockResult>> {
    const trimmed = pools.slice(0, FEED_MAX_POOLS);
    if ((await getMode()) === 'demo') {
        const entries = demoFeedEntries(trimmed);
        const links: FeedLink[] = [];
        for (const e of entries) {
            const creator = demoSearchResult(e);
            for (const l of e.links) {
                if (l.gated) links.push({ ...demoLinkBase(l), url: l.url, creator });
            }
        }
        return {
            ok: true,
            value: {
                links: sortNewest(links),
                verified_pools: entries.map((e) => e.profile.pool_address!),
                failed_pools: [],
            },
        };
    }
    try {
        const body = await buildSignedBody(address, walletName, { intent: 'unlock_feed', pools: trimmed });
        const res = await fetchWrite<FeedUnlockResult>('/feed/unlock', 'POST', body);
        if (res.error) return { ok: false, error: res.error };
        return {
            ok: true,
            value: {
                links: res.data?.links ?? [],
                verified_pools: res.data?.verified_pools ?? [],
                failed_pools: res.data?.failed_pools ?? [],
            },
        };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'feed unlock failed' };
    }
}
