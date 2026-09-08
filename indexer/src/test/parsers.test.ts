import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTxEvents, TxContext } from '../parsers';
import { decodeEventAttrs, RawEvent } from '../rpc';

const CTX: TxContext = {
    txhash: 'ABC123',
    height: 100,
    ts: 1_700_000_000,
    nativeDenom: 'uosmo',
    factoryAddress: 'osmo1factory',
};

const POOL = 'osmo1pool';
const TOKEN_DENOM = `factory/${POOL}/ucreator`;

function wasm(attrs: Record<string, string>): RawEvent {
    return { type: 'wasm', attributes: Object.entries(attrs).map(([key, value]) => ({ key, value })) };
}

test('swap event with native offer parses as buy with OSMO-per-token price', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'swap',
        sender: 'osmo1trader',
        receiver: 'osmo1trader',
        offer_asset: 'uosmo',
        ask_asset: TOKEN_DENOM,
        offer_amount: '1000000',     // 1 OSMO
        return_amount: '2000000',    // 2 tokens
        spread_amount: '100',
        commission_amount: '3000',
        reserve0_after: '5',
        reserve1_after: '6',
        pool_contract: POOL,
    })]);
    assert.equal(out.trades.length, 1);
    const t = out.trades[0];
    assert.equal(t.side, 'buy');
    assert.equal(t.source, 'swap');
    assert.equal(t.trader, 'osmo1trader');
    assert.equal(t.offer_amount, '1000000');
    assert.equal(t.return_amount, '2000000');
    assert.ok(Math.abs((t.price ?? 0) - 0.5) < 1e-9);   // 1 OSMO / 2 tokens
});

test('swap event offering the TokenFactory denom parses as sell', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'swap',
        sender: 'osmo1seller',
        offer_asset: TOKEN_DENOM,
        ask_asset: 'uosmo',
        offer_amount: '4000000',     // 4 tokens
        return_amount: '1000000',    // 1 OSMO
        pool_contract: POOL,
    })]);
    assert.equal(out.trades[0].side, 'sell');
    assert.ok(Math.abs((out.trades[0].price ?? 0) - 0.25) < 1e-9);   // 1 OSMO / 4 tokens
});

test('funding-phase commit parses current attributes and raises no trade', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'commit',
        phase: 'funding',
        committer: 'osmo1fan',
        total_commit_count: '3',
        commit_amount_bluechip: '8000000',
        total_raised_after: '48000000',             // gross running total, micro-OSMO
        total_bluechip_raised_after: '45120000',    // net-of-fee micro-OSMO
        pool_contract: POOL,
        block_height: '100',
        block_time: '1700000000',
    })]);
    assert.equal(out.commits.length, 1);
    assert.equal(out.trades.length, 0);
    const c = out.commits[0];
    assert.equal(c.phase, 'funding');
    assert.equal(c.amount_bluechip, '8000000');
    assert.equal(c.raised_after, '48000000');       // taken from total_raised_after
    assert.equal(c.bluechip_raised_after, '45120000');
});

test('post-threshold ("active") commit indexes with current attributes; no trade without tokens_received', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'commit',
        phase: 'active',
        committer: 'osmo1fan',
        total_commit_count: '9',
        commit_amount_bluechip: '1000000',
        swap_amount_bluechip: '940000',     // net of fees, swapped via the Osmosis pool
        token_out_min_amount: '1850000',
        pool_id: '7',
        pool_contract: POOL,
        block_height: '100',
        block_time: '1700000000',
    })]);
    assert.equal(out.commits.length, 1);
    const c = out.commits[0];
    assert.equal(c.amount_bluechip, '1000000');
    assert.equal(c.raised_after, null);             // post-threshold commits carry no running total
    assert.equal(c.tokens_received, null);
    // The swap output is only known in a later reply, so no trade row.
    assert.equal(out.trades.length, 0);
});

test('async swap: swap_forward reply in the same tx fills return_amount and price', () => {
    const out = parseTxEvents(CTX, [
        wasm({
            _contract_address: POOL,
            action: 'swap',
            sender: 'osmo1trader',
            receiver: 'osmo1trader',
            offer_asset: 'uosmo',
            ask_asset: TOKEN_DENOM,
            offer_amount: '1000000',
            token_out_min_amount: '1900000',
            pool_id: '7',
            pool_contract: POOL,
            block_height: '100',
            block_time: '1700000000',
        }),
        wasm({
            _contract_address: POOL,
            action: 'swap_forward',
            sender: 'osmo1trader',
            receiver: 'osmo1trader',
            offer_amount: '1000000',
            offer_denom: 'uosmo',
            return_amount: '2000000',
            token_out_denom: TOKEN_DENOM,
            effective_price: '2',
            block_time: '1700000000',
        }),
    ]);
    assert.equal(out.trades.length, 1);
    const t = out.trades[0];
    assert.equal(t.side, 'buy');
    assert.equal(t.return_amount, '2000000');
    assert.ok(Math.abs((t.price ?? 0) - 0.5) < 1e-9);   // 1 OSMO / 2 tokens
});

test('active commit + swap_forward reply fills tokens_received and derives the buy trade', () => {
    const out = parseTxEvents(CTX, [
        wasm({
            _contract_address: POOL,
            action: 'commit',
            phase: 'active',
            committer: 'osmo1fan',
            total_commit_count: '9',
            commit_amount_bluechip: '1000000',
            swap_amount_bluechip: '940000',
            token_out_min_amount: '1850000',
            pool_id: '7',
            pool_contract: POOL,
            block_height: '100',
            block_time: '1700000000',
        }),
        wasm({
            _contract_address: POOL,
            action: 'swap_forward',
            sender: POOL,
            receiver: 'osmo1fan',
            offer_amount: '940000',
            offer_denom: 'uosmo',
            return_amount: '1880000',
            token_out_denom: TOKEN_DENOM,
            effective_price: '2',
            block_time: '1700000000',
        }),
    ]);
    assert.equal(out.commits.length, 1);
    assert.equal(out.commits[0].tokens_received, '1880000');
    assert.equal(out.trades.length, 1);
    const t = out.trades[0];
    assert.equal(t.side, 'buy');
    assert.equal(t.source, 'commit');
    assert.equal(t.trader, 'osmo1fan');
    assert.equal(t.offer_amount, '940000');
    assert.equal(t.return_amount, '1880000');
    assert.ok(Math.abs((t.price ?? 0) - 0.5) < 1e-9);   // 0.94 OSMO / 1.88 tokens
});

test('threshold-crossing commit parses current attributes and marks the crossing', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'commit',
        phase: 'threshold_crossing',
        committer: 'osmo1whale',
        total_commit_count: '12',
        total_amount_bluechip: '99000000',
        threshold_amount_bluechip: '95000000',
        bluechip_excess_refunded: '4000000',
        pool_contract: POOL,
    })]);
    assert.equal(out.commits[0].amount_bluechip, '99000000');
    assert.equal(out.commits[0].raised_after, null);
    assert.deepEqual(out.thresholdCrossings, [{ pool: POOL, ts: CTX.ts }]);
});

test('exact threshold hit marks the crossing and keeps the gross running total', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'commit',
        phase: 'threshold_hit_exact',
        committer: 'osmo1whale',
        commit_amount_bluechip: '99000000',
        total_raised_after: '500000000000',
        pool_contract: POOL,
    })]);
    assert.equal(out.commits[0].amount_bluechip, '99000000');
    assert.equal(out.commits[0].raised_after, '500000000000');
    assert.equal(out.trades.length, 0);
    assert.deepEqual(out.thresholdCrossings, [{ pool: POOL, ts: CTX.ts }]);
});

// Older contract generations emitted per-commit USD attributes and, on
// active commits, tokens_received. The USD attributes are ignored (the
// current contracts value nothing in USD); a legacy tokens_received still
// derives the buy trade.
test('legacy commit events: USD attributes are ignored, tokens_received still derives a trade', () => {
    const legacyCtx: TxContext = { ...CTX, nativeDenom: 'ubluechip', factoryAddress: 'bluechip1factory' };
    const out = parseTxEvents(legacyCtx, [
        wasm({
            _contract_address: 'bluechip1pool',
            action: 'commit',
            phase: 'funding',
            committer: 'bluechip1fan',
            commit_amount_bluechip: '8000000',
            commit_amount_usd: '1000000',
            total_usd_raised_after: '5000000',
            total_bluechip_raised_after: '40000000',
            pool_contract: 'bluechip1pool',
        }),
        wasm({
            _contract_address: 'bluechip1pool',
            action: 'commit',
            phase: 'threshold_crossing',
            committer: 'bluechip1whale',
            total_amount_bluechip: '99000000',
            threshold_amount_usd: '11000000',
            swap_amount_usd: '1000000',
            pool_contract: 'bluechip1pool',
        }),
        wasm({
            _contract_address: 'bluechip1pool',
            action: 'commit',
            phase: 'active',
            committer: 'bluechip1fan',
            commit_amount_bluechip: '1000000',
            commit_amount_usd: '125000',
            swap_amount_bluechip: '940000',
            tokens_received: '1880000',
            commission_amount: '2820',
            spread_amount: '12',
            pool_contract: 'bluechip1pool',
        }),
    ]);
    assert.equal(out.commits.length, 3);
    assert.equal(out.commits[0].amount_bluechip, '8000000');
    assert.equal(out.commits[0].raised_after, null);        // legacy USD running total is not a gross-OSMO total
    assert.equal(out.commits[0].bluechip_raised_after, '40000000');
    assert.equal(out.commits[1].amount_bluechip, '99000000');
    assert.ok(!('amount_usd' in out.commits[0]));
    // Legacy active commits reported tokens_received -> derived buy trade.
    assert.equal(out.trades.length, 1);
    assert.equal(out.trades[0].source, 'commit');
    assert.equal(out.trades[0].side, 'buy');
    assert.equal(out.trades[0].offer_amount, '940000');
    assert.ok(Math.abs((out.trades[0].price ?? 0) - 0.5) < 1e-9);
});

test('factory pool creation + pool instantiate register a pool with its TokenFactory denom', () => {
    const out = parseTxEvents(CTX, [
        wasm({
            _contract_address: POOL,
            action: 'instantiate',
            pool_kind: 'commit',
            pool_contract: POOL,
            token_denom: TOKEN_DENOM,
        }),
        wasm({
            _contract_address: 'osmo1factory',
            action: 'pool_created_successfully',
            pool_address: POOL,
            pool_id: '7',
        }),
    ]);
    assert.equal(out.pools.length, 1);
    assert.equal(out.pools[0].kind, 'commit');
    assert.equal(out.pools[0].address, POOL);
    assert.deepEqual(out.poolTokens, [{ pool_id: 7, token_denom: TOKEN_DENOM }]);
});

test('instantiate token_denom without a factory-verified pool event is dropped', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: 'osmo1impostorpool',
        action: 'instantiate',
        pool_kind: 'commit',
        pool_contract: 'osmo1impostorpool',
        token_denom: 'factory/osmo1impostorpool/ufake',
    })]);
    assert.equal(out.pools.length, 0);
    assert.equal(out.poolTokens.length, 0);
});

test('pool-discovery events from a non-factory contract are ignored when a factory filter is set', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: 'osmo1impostor',
        action: 'pool_created_successfully',
        pool_address: 'osmo1fakepool',
        pool_id: '666',
    })]);
    assert.equal(out.pools.length, 0);
});

test('legacy token_created_successfully (CW20 address) still registers the pool token', () => {
    const legacyCtx: TxContext = { ...CTX, factoryAddress: 'bluechip1factory' };
    const out = parseTxEvents(legacyCtx, [wasm({
        _contract_address: 'bluechip1factory',
        action: 'token_created_successfully',
        token_address: 'bluechip1token',
        pool_id: '7',
    })]);
    assert.deepEqual(out.poolTokens, [{ pool_id: 7, token_denom: 'bluechip1token' }]);
});

test('creator claim events map both amount layouts onto amount_0/amount_1', () => {
    const out = parseTxEvents(CTX, [
        // claim_creator_excess is the only claim on current chains.
        wasm({
            _contract_address: POOL,
            action: 'claim_creator_excess',
            creator: 'osmo1creator',
            bluechip_denom: 'uosmo',
            bluechip_amount: '15000000000',
            creator_denom: TOKEN_DENOM,
            token_amount: '30000000000',
            pool_contract: POOL,
        }),
        // claim_creator_fees is legacy (pre-Osmosis) only.
        wasm({
            _contract_address: POOL,
            action: 'claim_creator_fees',
            creator: 'osmo1creator',
            amount_0: '850000000',
            amount_1: '1200000000',
            pool_contract: POOL,
        }),
    ]);
    assert.equal(out.claims.length, 2);
    assert.equal(out.claims[0].amount_0, '15000000000');
    assert.equal(out.claims[0].amount_1, '30000000000');
    assert.equal(out.claims[1].amount_0, '850000000');
    assert.equal(out.claims[1].amount_1, '1200000000');
});

test('legacy liquidity events normalize actor/amounts and keep the full attribute map', () => {
    const out = parseTxEvents(CTX, [wasm({
        _contract_address: POOL,
        action: 'deposit_liquidity',
        position_id: '3',
        depositor: 'osmo1lp',
        liquidity: '123456',
        actual_amount0: '1000000',
        actual_amount1: '2000000',
        pool_contract: POOL,
    })]);
    assert.equal(out.liquidity.length, 1);
    const l = out.liquidity[0];
    assert.equal(l.actor, 'osmo1lp');
    assert.equal(l.amount_0, '1000000');
    assert.equal(JSON.parse(l.attrs_json).position_id, '3');
});

test('base64-encoded attributes (pre-0.37 Tendermint) are auto-decoded', () => {
    const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
    const ev: RawEvent = {
        type: 'wasm',
        attributes: [
            { key: b64('_contract_address'), value: b64(POOL) },
            { key: b64('action'), value: b64('swap') },
            { key: b64('offer_asset'), value: b64('uosmo') },
            { key: b64('offer_amount'), value: b64('1000000') },
            { key: b64('return_amount'), value: b64('2000000') },
            { key: b64('pool_contract'), value: b64(POOL) },
        ],
    };
    const decoded = decodeEventAttrs(ev);
    assert.equal(decoded['action'], 'swap');
    const out = parseTxEvents(CTX, [ev]);
    assert.equal(out.trades.length, 1);
    assert.equal(out.trades[0].side, 'buy');
});

test('plain attributes are passed through untouched', () => {
    const attrs = decodeEventAttrs(wasm({ _contract_address: POOL, action: 'swap', offer_amount: '5' }));
    assert.equal(attrs['offer_amount'], '5');
});
