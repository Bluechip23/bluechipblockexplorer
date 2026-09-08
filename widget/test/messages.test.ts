import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    beliefPriceFromSimulation,
    buildCommitMsg,
    commitFunds,
    committingInfoQuery,
    deadlineNs,
    evaluateGate,
    fromMicro,
    simulationQuery,
    smartQueryUrl,
    toMicro,
    type CommitRecord,
} from '../src/messages.ts';

test('toMicro converts whole and fractional amounts with string math', () => {
    assert.equal(toMicro('25'), '25000000');
    assert.equal(toMicro('0.000001'), '1');
    assert.equal(toMicro('1.5'), '1500000');
    assert.equal(toMicro(100), '100000000');
    // no float drift on awkward decimals
    assert.equal(toMicro('0.29'), '290000');
});

test('toMicro rejects malformed and non-positive input', () => {
    for (const bad of ['', '-1', '1.2.3', 'abc', '1e6', '0', '0.0000001']) {
        assert.throws(() => toMicro(bad), Error, `expected throw for "${bad}"`);
    }
});

test('fromMicro renders micro strings and tolerates nulls', () => {
    assert.equal(fromMicro('25000000'), 25);
    assert.equal(fromMicro('1'), 0.000001);
    assert.equal(fromMicro(null), 0);
    assert.equal(fromMicro('not-a-number'), 0);
});

test('deadlineNs is nanoseconds 20 minutes out', () => {
    const nowMs = 1_700_000_000_000;
    assert.equal(deadlineNs(20, nowMs), ((nowMs + 20 * 60_000) * 1_000_000).toString());
});

test('pre-threshold commit msg has null belief_price/max_spread and the exact contract shape', () => {
    const nowMs = 1_700_000_000_000;
    const msg = buildCommitMsg({ denom: 'uosmo', amountMicro: '25000000', thresholdHit: false, nowMs });
    assert.deepEqual(msg, {
        commit: {
            asset: { info: { bluechip: { denom: 'uosmo' } }, amount: '25000000' },
            transaction_deadline: deadlineNs(20, nowMs),
            belief_price: null,
            max_spread: null,
        },
    });
});

test('post-threshold commit msg carries the belief_price and a spread guard', () => {
    const msg = buildCommitMsg({
        denom: 'uosmo',
        amountMicro: '1000000',
        thresholdHit: true,
        beliefPrice: '0.500000000000000000',
    });
    assert.equal(msg.commit.belief_price, '0.500000000000000000');
    assert.equal(msg.commit.max_spread, '0.05');
});

test('post-threshold commit msg without a belief_price is refused', () => {
    assert.throws(
        () => buildCommitMsg({ denom: 'uosmo', amountMicro: '1000000', thresholdHit: true }),
        /belief_price is required/,
    );
    assert.throws(
        () => buildCommitMsg({ denom: 'uosmo', amountMicro: '1000000', thresholdHit: true, beliefPrice: null }),
        /belief_price is required/,
    );
});

test('simulationQuery has the exact pool wire shape', () => {
    assert.deepEqual(simulationQuery('uosmo', '25000000'), {
        simulation: {
            offer_asset: { info: { bluechip: { denom: 'uosmo' } }, amount: '25000000' },
        },
    });
});

test('beliefPriceFromSimulation is offer-per-ask with 18 decimals', () => {
    assert.equal(beliefPriceFromSimulation('25000000', '50000000'), '0.500000000000000000');
    assert.equal(beliefPriceFromSimulation('1000000', '1000000'), '1.000000000000000000');
});

test('beliefPriceFromSimulation refuses a zero/missing return_amount', () => {
    for (const bad of ['0', '', null, undefined, 'not-a-number']) {
        assert.throws(
            () => beliefPriceFromSimulation('25000000', bad),
            /return_amount/,
            `expected throw for ${JSON.stringify(bad)}`,
        );
    }
});

test('commit funds are exactly one coin of the native denom', () => {
    assert.deepEqual(commitFunds('uosmo', '5000000'), [{ denom: 'uosmo', amount: '5000000' }]);
});

test('smartQueryUrl base64-encodes the query into the LCD path', () => {
    const url = smartQueryUrl('https://rest.example/', 'osmo1pool', committingInfoQuery('osmo1fan'));
    const expected = Buffer.from(JSON.stringify({ committing_info: { wallet: 'osmo1fan' } })).toString('base64');
    assert.equal(url, `https://rest.example/cosmwasm/wasm/v1/contract/osmo1pool/smart/${encodeURIComponent(expected)}`);
});

const RECORD: CommitRecord = {
    committer: 'osmo1fan',
    total_paid_native: '150500000',      // 150.5 OSMO (gross)
    total_paid_bluechip: '150500000',    // same value, compat twin
    last_committed: '1700000000000000000',
    last_payment_native: '115000000',
    last_payment_bluechip: '115000000',
};

test('evaluateGate grants and denies on the OSMO floor', () => {
    assert.deepEqual(evaluateGate(RECORD, 115), { subscribed: true, totalOsmo: 150.5, record: RECORD });
    assert.equal(evaluateGate(RECORD, 200).subscribed, false);
    assert.deepEqual(evaluateGate(null, 0), { subscribed: false, totalOsmo: 0, record: null });
});

test('evaluateGate reads total_paid_native, not the compat bluechip twin', () => {
    const skewed: CommitRecord = { ...RECORD, total_paid_bluechip: '999000000000' };
    assert.equal(evaluateGate(skewed, 200).subscribed, false);
});
