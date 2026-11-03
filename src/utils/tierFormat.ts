// Pure subscription-tier helpers shared by the links page, the feed and the
// manage page. No chain or service imports, so they unit-test cleanly.
// Money stays in micro-OSMO integer strings and BigInt, never floats.

import type { CreatorLink, Tier } from './profilesApi';

const MICRO = 1_000_000n;

function microOf(value: string): bigint {
    return BigInt(/^\d+$/.test(value) ? value : '0');
}

export function compareMicroStrings(a: string, b: string): number {
    const x = microOf(a);
    const y = microOf(b);
    return x < y ? -1 : x > y ? 1 : 0;
}

/** micro-OSMO → the plain decimal an amount field accepts ("12.5"). */
export function microToOsmoInput(micro: string): string {
    const n = microOf(micro);
    const frac = (n % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
    return `${n / MICRO}${frac ? `.${frac}` : ''}`;
}

/** The tiers that unlock `link`, cheapest first (empty = any subscriber). */
export function tiersForLink(link: CreatorLink, tiers: Tier[]): Tier[] {
    const ids = new Set(link.tier_ids ?? []);
    return tiers.filter((t) => ids.has(t.id))
        .sort((a, b) => compareMicroStrings(a.price_native, b.price_native) || a.id - b.id);
}

/**
 * micro-OSMO → "12.5 OSMO": exact BigInt math, up to 6 decimals with
 * trailing zeros dropped, so a small price never rounds to "0.00".
 */
export function formatTierPrice(micro: string): string {
    const n = microOf(micro);
    const whole = (n / MICRO).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const frac = (n % MICRO).toString().padStart(6, '0').replace(/0+$/, '');
    return `${whole}${frac ? `.${frac}` : ''} OSMO`;
}

/** Gated links whose ONLY tier is `tierId`: deleting it opens them to any subscriber. */
export function linksOnlyGatedBy(links: CreatorLink[], tierId: number): CreatorLink[] {
    return links.filter((l) => l.gated && l.tier_ids?.length === 1 && l.tier_ids[0] === tierId);
}

/**
 * What unlocks a gated link, for its locked label: "Subscribers only" when
 * any active subscription does, otherwise the tier names with the cheapest
 * price ("Gold · 20 OSMO", "Bronze / Gold · from 5 OSMO"). Names are raw;
 * callers render them as text (React escapes), never as HTML.
 */
export function describeGate(link: CreatorLink, tiers: Tier[]): string {
    const gating = tiersForLink(link, tiers);
    if (gating.length === 0) return 'Subscribers only';
    const names = gating.map((t) => t.name).join(' / ');
    const price = formatTierPrice(gating[0].price_native);
    return gating.length === 1 ? `${names} · ${price}` : `${names} · from ${price}`;
}
