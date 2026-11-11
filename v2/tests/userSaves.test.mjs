// One save per operator: each handle has its own key (its own file in the
// desktop app), the old single save is moved to its operator, and handles are
// made safe for file names.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { saveRun, loadRun, deleteRun, listSlots, safeName, hasRun } from '../game/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  keys: () => Object.keys(store),
};
const clear = () => Object.keys(store).forEach((k) => delete store[k]);

test('two operators keep their own runs', () => {
  clear();
  const a = makeGame('ALICE', 1);
  const b = makeGame('BOB', 2);
  a.player.credits = 111;
  b.player.credits = 222;
  assert.ok(saveRun(a));
  assert.ok(saveRun(b));
  assert.deepEqual(Object.keys(store).sort(), ['blackgate.save.ALICE', 'blackgate.save.BOB']);
  assert.deepEqual(listSlots().map((s) => s.handle), ['ALICE', 'BOB']);
  assert.equal(loadRun('ALICE').player.credits, 111);
  assert.equal(loadRun('BOB').player.credits, 222);
});

test('deleting one operator leaves the other', () => {
  clear();
  saveRun(makeGame('ALICE', 1));
  saveRun(makeGame('BOB', 2));
  assert.equal(deleteRun('ALICE'), true);
  assert.equal(loadRun('ALICE'), null);
  assert.equal(loadRun('BOB')?.player.handle, 'BOB');
  assert.deepEqual(listSlots().map((s) => s.handle), ['BOB']);
});

test('the old single save is moved to its operator', () => {
  clear();
  saveRun(makeGame('VETERAN', 4));
  store['blackgate.save'] = store['blackgate.save.VETERAN'];
  delete store['blackgate.save.VETERAN'];
  assert.deepEqual(listSlots().map((s) => s.handle), ['VETERAN']);
  assert.ok(!('blackgate.save' in store), 'the old key is gone');
  assert.ok(store['blackgate.save.VETERAN']);
});

test('a damaged old save is left in place', () => {
  clear();
  store['blackgate.save'] = '{oops';
  assert.deepEqual(listSlots(), []);
  assert.equal(store['blackgate.save'], '{oops');
  assert.ok(hasRun());
});

test('handles become safe file names', () => {
  assert.equal(safeName('neo'), 'NEO');
  assert.equal(safeName('../evil\\x'), '___EVIL_X');
  assert.equal(safeName('  '), 'OPERATOR');
  assert.equal(safeName('x'.repeat(99)).length, 40);
});
