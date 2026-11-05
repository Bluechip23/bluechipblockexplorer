/**
 * @jest-environment node
 */
import {
    buildExitMsg,
    buildJoinMsg,
    gammAminoConverters,
    gammRegistryTypes,
    MSG_JOIN_POOL,
    quoteExit,
    quoteJoinByOsmo,
} from './osmosisGamm';

const TOTAL = 10n ** 26n;
const RES_OSMO = 500_000_000_000n;     // 500,000 OSMO
const RES_TOKEN = 350_000_000_000n;    // 350,000 TOKEN
const DENOM = 'factory/osmo1pool/ualpha';

describe('quoteJoinByOsmo', () => {
    it('pairs the creator side at the pool ratio and caps both sides', () => {
        const q = quoteJoinByOsmo(1_000_000n, TOTAL, RES_OSMO, RES_TOKEN, 100n);
        expect(q.maxIn.osmo).toBe(1_000_000n);
        expect(q.maxIn.creator).toBe(700_000n);
        expect(q.expectedShares).toBe(200_000_000_000_000_000_000n);
        // 1% slippage comes off the shares requested, never added to the inputs.
        expect(q.shareOut).toBe(198_000_000_000_000_000_000n);
    });

    it('rounds the creator side up so the deposit stays balanced', () => {
        const q = quoteJoinByOsmo(1n, TOTAL, 3n, 2n, 0n);
        expect(q.maxIn.creator).toBe(1n);
    });

    it('rejects empty pools and zero input', () => {
        expect(() => quoteJoinByOsmo(1n, 0n, RES_OSMO, RES_TOKEN, 100n)).toThrow();
        expect(() => quoteJoinByOsmo(0n, TOTAL, RES_OSMO, RES_TOKEN, 100n)).toThrow();
    });
});

describe('quoteExit', () => {
    it('returns the pro-rata share and a slippage floor', () => {
        const q = quoteExit(TOTAL / 100n, TOTAL, RES_OSMO, RES_TOKEN, 100n);
        expect(q.expected).toEqual({ osmo: 5_000_000_000n, creator: 3_500_000_000n });
        expect(q.minOut).toEqual({ osmo: 4_950_000_000n, creator: 3_465_000_000n });
    });

    it('rejects a zero position', () => {
        expect(() => quoteExit(0n, TOTAL, RES_OSMO, RES_TOKEN, 100n)).toThrow();
    });
});

describe('message encoding', () => {
    const join = buildJoinMsg('osmo1abc', '7', quoteJoinByOsmo(1_000_000n, TOTAL, RES_OSMO, RES_TOKEN, 100n), 'uosmo', DENOM);

    it('sorts coins by denom (SDK Coins invariant)', () => {
        const amino = gammAminoConverters[MSG_JOIN_POOL].toAmino(join.value);
        expect(amino.token_in_maxs.map((c: { denom: string }) => c.denom)).toEqual([DENOM, 'uosmo']);
        expect(amino.pool_id).toBe('7');
    });

    it('encodes MsgJoinPool to the expected protobuf bytes', () => {
        const type = Object.fromEntries(gammRegistryTypes)[MSG_JOIN_POOL];
        const bytes = type.encode({
            sender: 'osmo1abc',
            poolId: '1',
            shareOutAmount: '1',
            tokenInMaxs: [{ denom: 'uosmo', amount: '1' }, { denom: 'factory/x/uy', amount: '2' }],
        }).finish();
        // Matches osmojs MsgJoinPool.encode for the same input.
        expect(Buffer.from(bytes).toString('hex')).toBe(
            '0a086f736d6f316162631001' + '1a0131' +
            '2211' + '0a0c666163746f72792f782f7579' + '120132' +
            '220a' + '0a05756f736d6f' + '120131',
        );
    });

    it('builds exit mins in both denoms', () => {
        const exit = buildExitMsg('osmo1abc', '7', 10n, quoteExit(10n, TOTAL, RES_OSMO, RES_TOKEN, 100n), 'uosmo', DENOM);
        expect(exit.value.tokenOutMins.map((c) => c.denom).sort()).toEqual([DENOM, 'uosmo']);
    });
});
