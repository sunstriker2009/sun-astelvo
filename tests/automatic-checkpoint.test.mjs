import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomaticCheckpoint } from '../ui/automatic-checkpoint.ts';

function fixture(write = async () => {}) {
  let value = 'first', available = true, tick;
  const writes = [], errors = [], states = [];
  const timer = { active: false };
  const controller = new AutomaticCheckpoint({ capture: () => value, write: async snapshot => { writes.push(snapshot); await write(snapshot); },
    available: () => available, state: state => states.push(state), failed: error => errors.push(error),
    schedule: callback => { tick = callback; timer.active = true; return timer; }, cancel: () => { timer.active = false; } });
  return { controller, writes, errors, states, timer, tick: () => tick(), value: next => { value = next; }, available: next => { available = next; } };
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('automatic checkpoints skip clean/unchanged data and foreground work without postponing continuous edits', async () => {
  const f = fixture(); f.controller.start();
  f.tick(); await f.controller.drain(); assert.deepEqual(f.writes, ['first']);
  f.tick(); await f.controller.drain(); assert.equal(f.writes.length, 1);
  f.value(null); f.tick(); await f.controller.drain(); assert.equal(f.writes.length, 1, 'Clean tabs retain the last checkpoint');
  f.value('second'); f.available(false); f.tick(); await f.controller.drain(); assert.equal(f.writes.length, 1);
  f.available(true); f.tick(); await f.controller.drain(); assert.deepEqual(f.writes, ['first', 'second']);
  f.available(false); f.value('foreground flush'); await f.controller.flush();
  assert.deepEqual(f.writes, ['first', 'second', 'foreground flush'], 'Explicit flush bypasses timer availability under the foreground lock');
  f.controller.stop(); assert.equal(f.timer.active, false);
});

test('a flush waits for an older write then checkpoints the latest draft exactly once', async () => {
  const gate = deferred(); const f = fixture(value => value === 'first' ? gate.promise : Promise.resolve());
  f.controller.start(); f.tick(); await settle();
  f.value('latest'); f.tick(); assert.deepEqual(f.writes, ['first'], 'No overlapping writes');
  const flush = f.controller.flush(); gate.resolve(); await flush;
  assert.deepEqual(f.writes, ['first', 'latest']);
  await f.controller.flush(); assert.equal(f.writes.length, 2);
  f.controller.stop();
});

test('write failures pause automatic work without retry and propagate to close/transition flush', async () => {
  const error = new Error('Token conflict'); const f = fixture(async () => { throw error; });
  f.controller.start(); f.tick(); await f.controller.drain();
  assert.equal(f.controller.enabled, false); assert.equal(f.timer.active, false); assert.deepEqual(f.errors, [error]);
  f.tick(); await settle(); assert.equal(f.writes.length, 1);
  await assert.rejects(f.controller.flush(), error);
  f.controller.stop(); await f.controller.flush();
});

test('capture failures pause safely and an explicit restart permits a new reviewed write', async () => {
  let fail = true, tick; const writes = [], errors = [];
  const c = new AutomaticCheckpoint({ capture: () => { if (fail) throw new Error('Capture failed'); return 'reviewed'; }, write: async value => { writes.push(value); },
    available: () => true, state: () => {}, failed: error => errors.push(error.message), schedule: callback => { tick = callback; return 1; }, cancel: () => {} });
  c.start(); tick(); await c.drain(); assert.deepEqual(errors, ['Capture failed']);
  fail = false; c.start(); await c.flush(); assert.deepEqual(writes, ['reviewed']); c.stop();
});

test('stopping drains an already-dispatched write but cannot schedule another workspace write', async () => {
  const gate = deferred(); const f = fixture(() => gate.promise);
  f.controller.start(); f.tick(); await settle(); f.controller.stop(); f.value('other workspace');
  const drained = f.controller.drain(); gate.resolve(); await drained;
  f.tick(); await settle(); assert.deepEqual(f.writes, ['first']);
});
