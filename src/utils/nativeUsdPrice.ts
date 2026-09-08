import { apiEndpoint } from '../components/universal/IndividualPage.const';
import { NATIVE_DENOM } from '../defi/types';
import { safeBigInt } from './bigintMath';
import { getDataSource, queryFactoryConfig } from './contractQueries';

// OSMO/USD REFERENCE price for display.
//
// The contracts have no price oracle any more: the commit threshold, the
// per-wallet commit ledger and every commit event are denominated in
// OSMO, and nothing on-chain values a commit in USD. The USD figures the
// explorer shows are therefore purely informational conversions made
// here, from a market price that still exists off the contracts:
//
//   1. Osmosis on-chain TWAP — the factory's `pricing_pool_id` trades
//      uosmo against `fee_quote_denom` (alloyed USDC on osmosis-1; the
//      same route the contracts use to budget the GAMM creation-fee swap
//      at threshold crossing). A 600s arithmetic TWAP of that pool, read
//      over the LCD, is quote-per-base = USD per OSMO (both 6 decimals).
//   2. CoinGecko `osmosis` spot price, when the chain read fails or the
//      factory has no USD-quoted pricing pool configured.
//
// A missing rate never affects anything on-chain — commits keep working
// — so callers should render "USD unavailable" rather than an error.

export interface NativeUsdRate {
    // micro-USD per 1 OSMO (1_000_000 = $1.00/OSMO), as an integer string.
    rateMicroUsd: string;
    // unix seconds the rate was fetched at.
    timestamp: number;
    source: 'osmosis-twap' | 'coingecko' | 'demo';
}

const TWAP_WINDOW_SECONDS = 600;   // mirrors the factory's FEE_TWAP_WINDOW_SECONDS
const CACHE_MS = 30_000;
const FETCH_TIMEOUT_MS = 6_000;
const DEMO_RATE_MICRO_USD = '500000';   // $0.50/OSMO in demo mode

// Decimal string (e.g. "0.512345678901234567") -> micro-unit integer
// string, truncating past 6 fractional digits. null on malformed input
// or a non-positive value.
export function decimalToMicro(dec: string | number | null | undefined, decimals = 6): string | null {
    const s = String(dec ?? '').trim();
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const [whole, frac = ''] = s.split('.');
    const micro = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals));
    return micro > 0n ? micro.toString() : null;
}

async function fetchJson(url: string): Promise<any | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// Osmosis x/twap ArithmeticTwapToNow over the factory's fee-swap pool.
async function fetchOsmosisTwapRate(): Promise<NativeUsdRate | null> {
    const cfg = await queryFactoryConfig().catch(() => null);
    if (!cfg || !cfg.pricing_pool_id || !cfg.fee_quote_denom) return null;
    const startTime = new Date(Date.now() - TWAP_WINDOW_SECONDS * 1000).toISOString();
    const params = new URLSearchParams({
        pool_id: String(cfg.pricing_pool_id),
        base_asset: NATIVE_DENOM,
        quote_asset: cfg.fee_quote_denom,
        start_time: startTime,
    });
    const body = await fetchJson(`${apiEndpoint}/osmosis/twap/v1beta1/ArithmeticTwapToNow?${params.toString()}`);
    const rate = decimalToMicro(body?.arithmetic_twap);
    if (!rate) return null;
    return { rateMicroUsd: rate, timestamp: Math.floor(Date.now() / 1000), source: 'osmosis-twap' };
}

async function fetchCoinGeckoRate(): Promise<NativeUsdRate | null> {
    const body = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=osmosis&vs_currencies=usd');
    const usd = body?.osmosis?.usd;
    if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return null;
    const rate = decimalToMicro(usd.toFixed(6));
    if (!rate) return null;
    return { rateMicroUsd: rate, timestamp: Math.floor(Date.now() / 1000), source: 'coingecko' };
}

let cache: { at: number; value: NativeUsdRate | null } | null = null;
let inflight: Promise<NativeUsdRate | null> | null = null;

// Current OSMO/USD reference rate, or null when no source answered.
// Results (including a null) are cached for 30s so pages that render
// many USD approximations share one lookup.
export function fetchNativeUsdRate(): Promise<NativeUsdRate | null> {
    if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.value);
    if (inflight) return inflight;
    inflight = (async () => {
        let value: NativeUsdRate | null;
        if ((await getDataSource()) !== 'chain') {
            value = { rateMicroUsd: DEMO_RATE_MICRO_USD, timestamp: Math.floor(Date.now() / 1000), source: 'demo' };
        } else {
            value = (await fetchOsmosisTwapRate()) ?? (await fetchCoinGeckoRate());
        }
        cache = { at: Date.now(), value };
        inflight = null;
        return value;
    })();
    return inflight;
}

// micro-OSMO * (micro-USD per OSMO) -> micro-USD, integer math.
export function microNativeToMicroUsd(
    microNative: string | number | bigint | null | undefined,
    rateMicroUsd: string | number | bigint | null | undefined,
): bigint {
    return (safeBigInt(microNative) * safeBigInt(rateMicroUsd)) / 1_000_000n;
}

export function describeRateSource(source: NativeUsdRate['source']): string {
    switch (source) {
        case 'osmosis-twap': return 'Osmosis pool TWAP';
        case 'coingecko': return 'CoinGecko';
        default: return 'demo data';
    }
}
