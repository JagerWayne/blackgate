// RAM and STORAGE: the drive holds what is downloaded, the RAM makes the
// software run faster, and running too much at once on too little RAM swaps.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentDef, componentsOf } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { storage, slotsFor } from '../src/state/gateway.js';
import { buyComponent } from '../src/state/economy.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { taskError } from '../src/systems/sessionTasks.js';
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

test('a new run has one compute part, and the chassis carries the drive', () => {
  const g = makeGame('HW', 7);
  assert.equal(fitted(g, 'cpu').length, 1);
  assert.equal(fitted(g, 'ram').length, 0, 'no RAM part');
  assert.equal(fitted(g, 'storage').length, 0, 'the drive is onboard');
  assert.equal(storage(g.player.gateway), 2048, 'a 2 TB onboard drive');
});

test('the drives run from 4 TB to 128 TB, and every chassis takes some', () => {
  const caps = componentsOf('storage').map((d) => d.capacity);
  assert.deepEqual(caps, [4096, 8192, 16384, 32768, 65536, 131072]);
  const g = makeGame('HW', 7);
  for (const tier of [1, 2, 3, 4, 5, 6, 7]) {
    g.player.gateway.chassis = tier;
    assert.ok(slotsFor(g.player.gateway, 'storage') >= 1, `chassis ${tier}`);
  }
});

// -- storage --------------------------------------------------------------------------

test('a download needs room on the drive', () => {
  const { g, h, file } = online();
  const f = h.files[file];
  assert.equal(taskError(g, g.session, 'CopyFile', file), null, 'room to spare');
  // fill the drive to just short of the file
  g.player.storage = [{ name: 'filler', size: storage(g.player.gateway) - f.size + 1, enc: 0, tag: 0, source: 'x' }];
  assert.equal(taskError(g, g.session, 'CopyFile', file), 'not enough gateway storage');
});

test('a bigger drive from the shop gives more room', () => {
  const g = makeGame('HW', 7);
  g.player.credits = 50000;
  g.player.accounts[0].balance = 50000;
  assert.equal(buyComponent(g, componentDef('storage', 2)), null);
  assert.equal(storage(g.player.gateway), 2048 + 8192, 'the onboard drive plus the card');
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

test('the GATEWAY shop and machine card name COMPUTE and STORAGE', () => {
  const ctx = frameOf(makeGame('HW', 7), 'gateway');
  for (const word of ['COMPUTE', 'STORAGE']) assert.ok(ctx.texts.some((t) => t.s === word), word);
  assert.ok(!ctx.texts.some((t) => t.s === 'MEMORY'), 'the old name is gone');
  assert.ok(ctx.texts.some((t) => t.s === '0/2048 GB'), 'the drive figure');
});

// -- the cheat and old saves ------------------------------------------------------------

test('MAX THE GATEWAY fills the drive slots too', () => {
  const g = makeGame('HW', 7);
  maxGateway(g);
  assert.equal(fitted(g, 'storage').length, slotsFor(g.player.gateway, 'storage'));
  assert.ok(fitted(g, 'storage').every((p) => p.level === 3), 'the best card the Van takes (ZFS needs a rack)');
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
