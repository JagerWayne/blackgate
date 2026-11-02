// What the run keeps: the skin goes with the save, leaving the page saves
// the run, and a save that fails says so. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { loadRun, saveOnLeave, saveRun, deleteRun } from '../src/state/save.js';
import { handleEvents } from '../src/systems/events.js';
import { makeWindows } from '../src/state/windows.js';
import { setDark, isDark } from '../src/core/theme.js';

await initContent();

const store = {};
let full = false;
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    if (full) throw new Error('QuotaExceededError');
    store[k] = String(v);
  },
  removeItem: (k) => { delete store[k]; },
};

const click = (state, id) => handleEvents(state, [{ type: 'click', id }], { x: 0, y: 40, w: 1600, h: 800 });
const playState = (game) => ({ game, windows: makeWindows(), win: {}, ui: {}, mode: 'play' });

test('the skin picked in SYSTEM goes with the run', () => {
  const state = playState(makeGame('SKIN', 3));
  setDark(false);
  click(state, 'set.theme.dark');
  assert.equal(isDark(), true);
  assert.equal(state.game.settings.darkSkin, true);
  click(state, 'set.theme.light');
  assert.equal(state.game.settings.darkSkin, false);
});

test('a manual save says whether it worked', () => {
  const state = playState(makeGame('SAVER', 3));
  full = false;
  click(state, 'set.save');
  assert.equal(state.game.toasts.at(-1)?.kind, 'good');
  full = true;
  click(state, 'set.save');
  assert.equal(state.game.toasts.at(-1)?.kind, 'bad', 'a full store is reported');
  full = false;
});

test('a save made before the offers revealed their target still finds the machine', () => {
  const game = makeGame('OLD', 8);
  const c = game.contracts.find((x) => x.state === 'offered');
  game.world.hosts[c.target].discovered = false; // how the old build left it
  saveRun(game);
  const loaded = loadRun();
  assert.equal(loaded.world.hosts[c.target].discovered, true, 'the machine is on the map');
});

test('a save made before the board only had workable jobs is put right', () => {
  const game = makeGame('OLD', 8);
  const c = game.contracts.find((x) => x.state === 'offered');
  c.kind = 'modify';
  c.file = null;
  c.subject = 'A. PERSON';
  saveRun(game);
  const loaded = loadRun();
  const fixed = loaded.contracts.find((x) => x.id === c.id);
  assert.equal(fixed.state, 'expired', 'the job with no task behind it is put back');

  // a retrieve whose file went encrypted is pointed at a file that can be taken
  const g2 = makeGame('OLD', 9);
  const r = g2.contracts.find((x) => x.state === 'offered');
  const h = g2.world.hosts[r.target];
  const plain = h.files.find((f) => !f.deleted && f.enc === 0);
  const enc = h.files.find((f) => f !== plain && !f.deleted);
  enc.enc = 1;
  r.file = enc.name;
  r.subject = enc.name;
  saveRun(g2);
  const loaded2 = loadRun();
  const fixed2 = loaded2.contracts.find((x) => x.id === r.id);
  assert.ok(fixed2, 'the job is still on the board');
  const host2 = loaded2.world.hosts[r.target];
  const f2 = host2.files.find((x) => x.name === fixed2.file);
  assert.ok(f2, 'the job names a file on the host');
  assert.equal(f2.enc, 0, 'the job names a plain file');
  assert.equal(f2.tag, 0, 'no other job has claimed it');
});

test('a save this build cannot read is backed up before a new run replaces it', () => {
  store['blackgate.save.BROKEN'] = '{"version":99}';
  saveRun(makeGame('BROKEN', 3));
  assert.equal(store['blackgate.save.BROKEN.bak'], '{"version":99}');
  assert.equal(loadRun('BROKEN')?.player.handle, 'BROKEN');
  saveRun(makeGame('GOOD', 3));
  saveRun(makeGame('GOOD', 3));
  assert.ok(!('blackgate.save.GOOD.bak' in store), 'a readable save needs no backup');
});

test('a saved run can be deleted from the terminal', () => {
  const game = makeGame('SAVER', 3);
  saveRun(game);
  assert.ok(loadRun(), 'the run is on the terminal');
  assert.equal(deleteRun(), true);
  assert.equal(loadRun(), null, 'the terminal keeps no copy of it');
});

test('leaving the page saves a live run, and never an ended one', () => {
  const win = new EventTarget();
  const state = playState(makeGame('LEAVER', 5));
  saveOnLeave(win, state);
  delete store['blackgate.save'];
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(loadRun()?.player.handle, 'LEAVER');

  state.game = makeGame('ENDED', 6);
  state.game.gameOver = 'caught';
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(loadRun()?.player.handle, 'LEAVER', 'the ended run did not overwrite the save');

  state.game = makeGame('NOAUTO', 6);
  state.game.settings.autosave = false;
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(loadRun()?.player.handle, 'LEAVER', 'autosave off means no save on leaving');
});
