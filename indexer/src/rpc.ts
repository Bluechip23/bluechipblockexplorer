import { createHash } from 'node:crypto';

// Minimal Tendermint/CometBFT RPC client over the HTTP JSON endpoints.
// Only the three endpoints the ingester needs: /status, /block,
// /block_results.

export interface RawEventAttr {
    key: string;
    value: string;
}

export interface RawEvent {
    type: string;
    attributes: RawEventAttr[];
}

export interface BlockData {
    height: number;
    timeSec: number;          // block header time, unix seconds
    txHashes: string[];       // uppercase hex, SHA256 of raw tx bytes
}

export interface TxResult {
    code: number;             // 0 = success
    events: RawEvent[];
}

async function rpcGet(rpcUrl: string, path: string): Promise<any> {
    const res = await fetch(`${rpcUrl}${path}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
        throw new Error(`RPC ${path} -> HTTP ${res.status}`);
    }
    const body = await res.json() as { error?: { message?: string; data?: string }; result?: any };
    if (body.error) {
        throw new Error(`RPC ${path} -> ${body.error.data || body.error.message || 'unknown error'}`);
    }
    return body.result;
}

export async function getLatestHeight(rpcUrl: string): Promise<number> {
    const result = await rpcGet(rpcUrl, '/status');
    return parseInt(result.sync_info.latest_block_height, 10);
}

export async function getBlock(rpcUrl: string, height: number): Promise<BlockData> {
    const result = await rpcGet(rpcUrl, `/block?height=${height}`);
    const txsB64: string[] = result.block.data.txs ?? [];
    return {
        height,
        timeSec: Math.floor(Date.parse(result.block.header.time) / 1000),
        txHashes: txsB64.map((b64) =>
            createHash('sha256').update(Buffer.from(b64, 'base64')).digest('hex').toUpperCase()
        ),
    };
}

export async function getBlockResults(rpcUrl: string, height: number): Promise<TxResult[]> {
    const result = await rpcGet(rpcUrl, `/block_results?height=${height}`);
    const txs = result.txs_results ?? [];
    return txs.map((t: any) => ({
        code: t.code ?? 0,
        events: (t.events ?? []).map((e: any) => ({
            type: e.type,
            attributes: (e.attributes ?? []).map((a: any) => ({
                key: String(a.key ?? ''),
                value: String(a.value ?? ''),
            })),
        })),
    }));
}

// ---------------------------------------------------------------------------
// Attribute decoding.
//
// Tendermint < 0.37 returns event attribute keys/values base64-encoded;
// CometBFT 0.37+ returns them as plain strings. Detect per event: every
// wasm event carries the `_contract_address` key, and every contract
// event in this codebase carries `action`, so if neither appears as a
// plain key but does after base64-decoding, the event is base64-encoded.
// ---------------------------------------------------------------------------

const MARKER_KEYS = new Set(['_contract_address', 'action', 'amount', 'sender', 'recipient']);

function b64MaybeDecode(s: string): string | null {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return null;
    try {
        const decoded = Buffer.from(s, 'base64').toString('utf8');
        // Reject if the round-trip changes bytes (not real base64) or the
        // result contains control characters (binary garbage).
        if (Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '') !== s.replace(/=+$/, '')) return null;
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) return null;
        return decoded;
    } catch {
        return null;
    }
}

export function decodeEventAttrs(ev: RawEvent): Record<string, string> {
    const plainHasMarker = ev.attributes.some((a) => MARKER_KEYS.has(a.key));
    if (plainHasMarker) {
        const out: Record<string, string> = {};
        for (const a of ev.attributes) out[a.key] = a.value;
        return out;
    }
    // Try base64: only adopt if a decoded key matches a marker.
    const decoded = ev.attributes.map((a) => ({
        key: b64MaybeDecode(a.key),
        value: b64MaybeDecode(a.value),
    }));
    const decodedHasMarker = decoded.some((a) => a.key !== null && MARKER_KEYS.has(a.key));
    const out: Record<string, string> = {};
    if (decodedHasMarker) {
        for (let i = 0; i < ev.attributes.length; i++) {
            const k = decoded[i].key ?? ev.attributes[i].key;
            const v = decoded[i].value ?? ev.attributes[i].value;
            out[k] = v;
        }
    } else {
        for (const a of ev.attributes) out[a.key] = a.value;
    }
    return out;
}
