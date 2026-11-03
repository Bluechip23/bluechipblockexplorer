import type { CreatorLink, Tier } from './profilesApi';
import { describeGate, formatTierPrice, linksOnlyGatedBy, microToOsmoInput, tiersForLink } from './tierFormat';

const tier = (id: number, name: string, price: string, pool = 'osmo1poola'): Tier =>
    ({ id, name, price_native: price, pool_address: pool });
const link = (id: number, gated: boolean, tier_ids: number[] = []): CreatorLink =>
    ({ id, title: `L${id}`, gated, pinned: false, position: id, tier_ids });

const TIERS = [tier(1, 'Gold', '25000000'), tier(2, 'Bronze', '5000000'), tier(3, 'Fan', '100000000', 'osmo1poolb')];

describe('formatTierPrice', () => {
    it('formats micro-OSMO exactly, without rounding small prices to zero', () => {
        expect(formatTierPrice('25000000')).toBe('25 OSMO');
        expect(formatTierPrice('12500000')).toBe('12.5 OSMO');
        expect(formatTierPrice('1500')).toBe('0.0015 OSMO');
        expect(formatTierPrice('1234567000000')).toBe('1,234,567 OSMO');
        expect(formatTierPrice('junk')).toBe('0 OSMO');
    });
});

describe('microToOsmoInput', () => {
    it('gives the plain decimal the amount field accepts', () => {
        expect(microToOsmoInput('25000000')).toBe('25');
        expect(microToOsmoInput('12500000')).toBe('12.5');
        expect(microToOsmoInput('1500')).toBe('0.0015');
    });
});

describe('describeGate', () => {
    it('says "Subscribers only" for an untiered gated link', () => {
        expect(describeGate(link(1, true), TIERS)).toBe('Subscribers only');
    });

    it('names one tier with its price', () => {
        expect(describeGate(link(1, true, [1]), TIERS)).toBe('Gold · 25 OSMO');
    });

    it('lists several tiers cheapest first with a "from" price', () => {
        expect(describeGate(link(1, true, [3, 1, 2]), TIERS)).toBe('Bronze / Gold / Fan · from 5 OSMO');
    });

    it('ignores tier ids it has no tier for', () => {
        expect(describeGate(link(1, true, [99]), TIERS)).toBe('Subscribers only');
    });
});

describe('tier helpers', () => {
    it('orders a link\'s tiers by price', () => {
        expect(tiersForLink(link(1, true, [1, 2]), TIERS).map((t) => t.name)).toEqual(['Bronze', 'Gold']);
    });

    it('finds links that a tier delete would open to any subscriber', () => {
        const links = [link(1, true, [1]), link(2, true, [1, 2]), link(3, false), link(4, true)];
        expect(linksOnlyGatedBy(links, 1).map((l) => l.id)).toEqual([1]);
    });
});
