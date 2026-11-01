// RAM and STORAGE: the drive holds what is downloaded, the RAM makes the
// software run faster, and running too much at once on too little RAM swaps.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentDef, componentsOf } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { ram, ramSpeed, storage, slotsFor } from '../src/state/gateway.js';
import { buyComponent } from '../src/state/economy.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { taskError, ramLoad, swapFactor } from '../src/systems/sessionTasks.js';
import { maxGateway } from '../src/state/cheats.js';
import { saveRun, loadRun } from '../src/state/save.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

const fitted = (g, kind) => g.player.gateway.parts.filter((p) => p.kind === kind);
const setRam = (g, level) => {
  const d = componentDef('ram', level);
  g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'ram');
  g.player.gateway.parts.push({ kind: 'ram', level, name: d.name });
};

/// A run on a live link to a host with a plain file on it.
function online(seed = 7) {
  const g = makeGame('HW', seed);
  if (!g.player.tools.some((t) => t.kind === 'FileCopier')) g.player.tools.push({ kind: 'FileCopier', level: 1 });
  const h = g.world.hosts.find((x) => x.company !== null && x.files.some((f) => !f.deleted && f.enc === 0 && f.size < 30));
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  const file = h.files.findIndex((f) => !f.deleted && f.enc === 0 && f.size < 30);
  return { g, h, file };
}

// -- the parts --------------------------------------------------------------------

test('a new run has RAM and a drive, and nothing called memory', () => {
  const g = makeGame('HW', 7);
  assert.equal(fitted(g, 'memory').length, 0);
  assert.equal(fitted(g, 'ram').length, 1);
  assert.equal(fitted(g, 'storage').length, 1);
  assert.equal(ram(g.player.gateway), 16, '16 GB of RAM');
  assert.equal(storage(g.player.gateway), 32, 'a 32 GB drive');
});

test('the drives run from a small disk to a huge one, and every chassis takes some', () => {
  const caps = componentsOf('storage').map((d) => d.capacity);
  assert.deepEqual(caps, [32, 128, 384, 1024, 4096]);
  const g = makeGame('HW', 7);
  for (const tier of [1, 2, 3, 4, 5]) {
    g.player.gateway.chassis = tier;
    assert.ok(slotsFor(g.player.gateway, 'storage') >= 1, `chassis ${tier}`);
    assert.ok(slotsFor(g.player.gateway, 'ram') >= 1, `chassis ${tier}`);
  }
});

// -- storage --------------------------------------------------------------------------

test('a download needs room on the drive, not in the RAM', () => {
  const { g, h, file } = online();
  const f = h.files[file];
  assert.equal(taskError(g, g.session, 'CopyFile', file), null, 'room to spare');
  // fill the drive to just short of the file
  g.player.storage = [{ name: 'filler', size: storage(g.player.gateway) - f.size + 1, enc: 0, tag: 0, source: 'x' }];
  assert.equal(taskError(g, g.session, 'CopyFile', file), 'not enough gateway storage');
  // more RAM does not help
  setRam(g, 5);
  assert.equal(taskError(g, g.session, 'CopyFile', file), 'not enough gateway storage');
});

test('a bigger drive from the shop gives more room', () => {
  const g = makeGame('HW', 7);
  g.player.credits = 50000;
  g.player.accounts[0].balance = 50000;
  assert.equal(buyComponent(g, componentDef('storage', 2)), null);
  assert.equal(storage(g.player.gateway), 128);
});

// -- RAM ------------------------------------------------------------------------------

test('faster RAM makes the software faster', () => {
  const g = makeGame('HW', 7);
  assert.equal(ramSpeed(g.player.gateway), 1);
  setRam(g, 3);
  assert.ok(Math.abs(ramSpeed(g.player.gateway) - 1.24) < 1e-9);
  setRam(g, 5);
  assert.ok(Math.abs(ramSpeed(g.player.gateway) - 1.48) < 1e-9);
});

function progressWith(level, tasks = 1) {
  const { g } = online();
  setRam(g, level);
  for (let i = 0; i < tasks; i += 1) {
    g.session.tasks.push({ kind: 'CrackPassword', arg: 0, label: 't', progress: 0, dur: 100, lane: i });
  }
  sessionTick(g, 1);
  return { g, p: g.session.tasks[0].progress };
}

test('a task on fast RAM finishes sooner', () => {
  const slow = progressWith(1).p;
  const fast = progressWith(3).p;
  assert.ok(Math.abs(fast / slow - 1.24) < 1e-6, `${fast} vs ${slow}`);
});

test('every running tool takes RAM, and too much at once swaps', () => {
  const { g } = progressWith(1, 4);
  assert.ok(ramLoad(g) > ram(g.player.gateway), 'four tools do not fit in 16 GB');
  assert.ok(swapFactor(g) < 1, 'swapping');
  // the same four tasks on plenty of RAM run at full speed
  const roomy = progressWith(4, 4);
  assert.equal(swapFactor(roomy.g), 1);
  const cramped = progressWith(1, 4).p;
  assert.ok(cramped * ramSpeed(roomy.g.player.gateway) < roomy.p, 'the cramped machine is slower than the speed alone explains');
});

test('one task never swaps on the starting RAM', () => {
  const { g } = progressWith(1, 1);
  assert.ok(ramLoad(g) <= ram(g.player.gateway));
  assert.equal(swapFactor(g), 1);
});

// -- the windows ----------------------------------------------------------------------

function frameOf(game, key) {
  const state = {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game, win: {}, mode: 'play', time: 0,
  };
  openWindow(state.windows, key, DESK);
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx;
}

test('the GATEWAY shop and machine card name RAM and STORAGE', () => {
  const ctx = frameOf(makeGame('HW', 7), 'gateway');
  for (const word of ['RAM', 'STORAGE']) assert.ok(ctx.texts.some((t) => t.s === word), word);
  assert.ok(!ctx.texts.some((t) => t.s === 'MEMORY'), 'the old name is gone');
  assert.ok(ctx.texts.some((t) => t.s === '0/32 GB'), 'the drive figure');
});

test('the session shows the RAM in use, and says when it swaps', () => {
  const { g } = progressWith(1, 4);
  const ctx = frameOf(g, 'blackgate');
  assert.ok(ctx.texts.some((t) => t.s.startsWith('RAM ') && t.s.includes('SWAPPING')));
});

// -- the cheat and old saves ------------------------------------------------------------

test('MAX THE GATEWAY fills the drive slots too', () => {
  const g = makeGame('HW', 7);
  maxGateway(g);
  assert.equal(fitted(g, 'storage').length, slotsFor(g.player.gateway, 'storage'));
  assert.ok(fitted(g, 'storage').every((p) => p.level === 5));
});

test('an old save turns its memory into RAM and gets a drive that holds its files', () => {
  const store = new Map();
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const g = makeGame('OLD', 7);
    // the shape of a run saved before the split
    g.player.gateway.parts = g.player.gateway.parts
      .filter((p) => p.kind !== 'storage')
      .map((p) => (p.kind === 'ram' ? { ...p, kind: 'memory' } : p));
    g.player.storage = [
      { name: 'a.db', size: 25, enc: 0, tag: 0, source: 'x' },
      { name: 'b.db', size: 15, enc: 0, tag: 0, source: 'x' },
    ];
    assert.ok(saveRun(g));
    const back = loadRun();
    assert.equal(back.player.gateway.parts.filter((p) => p.kind === 'memory').length, 0);
    assert.equal(back.player.gateway.parts.filter((p) => p.kind === 'ram').length, 1);
    const drives = back.player.gateway.parts.filter((p) => p.kind === 'storage');
    assert.equal(drives.length, 1);
    assert.equal(drives[0].level, 2, '40 GB staged needs the 128 GB drive');
    assert.equal(back.player.storage.length, 2, 'no file is lost');
  } finally {
    globalThis.localStorage = saved;
  }
});

// -- the audit fixes ------------------------------------------------------------------

test('a running copy counts against the drive, and a file is not copied twice', () => {
  const { g, h, file } = online();
  const f = h.files[file];
  // a second CPU gives a free lane next to the running copy
  g.player.gateway.chassis = 2;
  g.player.gateway.parts.push({ kind: 'cpu', level: 1, name: componentDef('cpu', 1).name });
  g.session.tasks.push({ kind: 'CopyFile', arg: file, label: 'c', progress: 0, dur: 10, lane: 0 });
  assert.equal(taskError(g, g.session, 'CopyFile', file), 'already copying this file');
  // the drive is full once the running copy lands, though nothing is on it yet
  g.player.storage = [{ name: 'filler', size: storage(g.player.gateway) - f.size, enc: 0, tag: 0, source: 'x' }];
  const other = h.files.findIndex((x, i) => i !== file && !x.deleted && x.enc === 0);
  if (other >= 0) assert.equal(taskError(g, g.session, 'CopyFile', other), 'not enough gateway storage');
});

test('a host\'s old logs do not add heat again on the next link', async () => {
  const { disconnect } = await import('../src/systems/sessionTick.js');
  const { g, h } = online();
  h.logs.push({ minute: g.clock.minutes, ip: g.player.gateway.ip, text: 'old', loud: true });
  disconnect(g);
  const after = g.player.heat;
  assert.ok(after > 0, 'the first link pays for its log');
  g.clock.minutes += 5;
  assert.equal(connect(g, h.id), null);
  disconnect(g);
  assert.equal(g.player.heat, after, 'the same log is not counted again');
});
