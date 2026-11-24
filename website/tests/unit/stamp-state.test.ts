import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialStampState, stampReducer, type StampAction } from '../../src/features/loyalty/stamp-state.ts';

function play(...actions: StampAction[]) {
  return actions.reduce(stampReducer, initialStampState);
}

test('one simulated purchase starts the press and impact counts it only once', () => {
  const pressing = play({ type: 'restore', count: 0 }, { type: 'earn' }, { type: 'earn' });
  assert.deepEqual(pressing, { phase: 'pressing', count: 0, restored: true });
  const actions: StampAction[] = [{ type: 'impact' }, { type: 'impact' }, { type: 'earn' }, { type: 'settle' }];
  const stamped = actions.reduce(stampReducer, pressing);
  assert.equal(stamped.count, 1);
  assert.equal(stamped.phase, 'earned');
  assert.equal(stampReducer(stamped, { type: 'impact' }), stamped);
  assert.equal(stampReducer(stamped, { type: 'undo' }).count, 0);
});

test('completion is retained through replay and only preview permits redemption', () => {
  const unlocking = play({ type: 'restore', count: 0 }, { type: 'example' }, { type: 'earn' }, { type: 'impact' }, { type: 'settle' });
  assert.equal(unlocking.phase, 'unlocking');
  assert.equal(unlocking.count, 8);
  assert.equal(stampReducer(unlocking, { type: 'reset' }), unlocking);
  const unlocked = stampReducer(unlocking, { type: 'unlock' });
  for (const type of ['earn', 'example', 'undo', 'impact', 'unlock', 'redeem'] as const) {
    assert.equal(stampReducer(unlocked, { type }), unlocked);
  }
  const replay = stampReducer(unlocked, { type: 'replay' });
  assert.equal(replay.phase, 'unlocking');
  assert.deepEqual(stampReducer(replay, { type: 'unlock' }), unlocked);
  const preview = stampReducer(unlocked, { type: 'flip' });
  const redeemed = stampReducer(preview, { type: 'redeem' });
  assert.equal(redeemed.phase, 'redeemed');
  assert.equal(redeemed.count, 0);
  assert.equal(stampReducer(redeemed, { type: 'earn' }).phase, 'pressing');
});

test('restoration bounds the persisted count and does not replay a completed card', () => {
  for (const count of [NaN, -1, 1.5, 9, Infinity]) assert.equal(play({ type: 'restore', count }).count, 0);
  assert.equal(play({ type: 'restore', count: 8 }).phase, 'unlocked');
  assert.equal(play({ type: 'restore', count: 7 }, { type: 'restore', count: 0 }).count, 7);
  assert.equal(play({ type: 'restore', count: 0 }, { type: 'undo' }).count, 0);
});
