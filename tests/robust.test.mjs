// What keeps the game alive: the loop survives a bad frame, and a bad save is
// turned away instead of taking the boot down. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { startLoop } from '../src/core/loop.js';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { saveRun, loadRun, slotInfo, hasRun } from '../src/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  keys: () => Object.keys(store),
};
const KEY = 'blackgate.save.X';

test('the loop keeps running after a frame throws', () => {
  const queue = [];
  globalThis.requestAnimationFrame = (f) => queue.push(f);
  const quiet = console.error;
  console.error = () => {};
  let steps = 0;
  let renders = 0;
  const loop = startLoop({
    step: () => {
      steps += 1;
      if (steps === 1) throw new Error('bad step');
    },
    render: () => { renders += 1; },
  });
  let now = performance.now();
  try {
    for (let i = 0; i < 10 && queue.length; i += 1) {
      now += 1000 / 60 + 1;
      queue.shift()(now);
    }
  } finally {
    console.error = quiet;
    loop.stop();
  }
  assert.ok(steps > 1, `the loop stepped again after the throw (steps=${steps})`);
  assert.ok(renders > 0, 'the loop rendered after the throw');
});

test('a sound save goes in and comes back', () => {
  assert.ok(saveRun(makeGame('KEEPER', 3)));
  assert.equal(loadRun()?.player.handle, 'KEEPER');
  assert.equal(slotInfo()?.handle, 'KEEPER');
});

test('a malformed or older save is turned away, not thrown', () => {
  const good = JSON.parse((saveRun(makeGame('X', 1)), store[KEY]));
  const bad = {
    garbage: '{oops',
    null: 'null',
    'a number': '42',
    'older version': JSON.stringify({ ...good, version: 0 }),
    'no version': JSON.stringify({ ...good, version: undefined }),
    'no player': JSON.stringify({ ...good, player: undefined }),
    'no clock': JSON.stringify({ ...good, clock: undefined }),
    'no world': JSON.stringify({ ...good, world: undefined }),
  };
  for (const [name, text] of Object.entries(bad)) {
    store[KEY] = text;
    assert.doesNotThrow(() => slotInfo(), name);
    assert.equal(slotInfo(), null, `slotInfo: ${name}`);
    assert.equal(loadRun(), null, `loadRun: ${name}`);
  }
  assert.ok(hasRun(), 'the bad save is left in place, not deleted');
});
