// The interface tells the truth: the tables name their columns, the link
// offers the actions that work on the host, and nothing on screen is a
// button that does nothing.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { drawOff } from '../src/render/off.js';
import { makeLogin } from '../src/render/login.js';
import { handleEvents } from '../src/systems/events.js';
import { connect } from '../src/systems/sessionTick.js';
import { completeTask } from '../src/systems/sessionComplete.js';
import { spawnContract } from '../src/state/contractSpawn.js';
import { drawTable, flex } from '../src/ui/table.js';
import { guardTint } from '../src/ui/guard.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();

// the terminal's storage, so a save can be written and read back
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  keys: () => Object.keys(store),
};

const W = 1600;
const H = 900;
const DESK = desktop(W, H);

function playState() {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game: makeGame('GUI', 7), win: {}, mode: 'play', time: 0,
    login: makeLogin(),
  };
}

/// One drawn frame, in the order the game runs it.
function frame(state) {
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx;
}

/// A live link to the target of the first offer, up and online.
function liveLink(state) {
  const g = state.game;
  const job = g.contracts.find((c) => c.state === 'offered');
  connect(g, job.target);
  g.session.phase = 'online';
  openWindow(state.windows, 'blackgate', DESK);
  return job;
}

// -- the tables ----------------------------------------------------------------

test('a table names its columns over the cells', () => {
  const ctx = stubCtx();
  const r = { x: 500, y: 100, w: 400, h: 200 };
  const table = {
    id: 't',
    columns: [flex('HOST', 0.6), flex('ADDRESS', 0.4, 'right')],
    rows: [{ grid: true, cells: [{ text: 'relay-01', col: 0, line: 0 }, { text: '10.0.0.1', col: 1, line: 0 }] }],
  };
  drawTable(ctx, theme(), r, table, makeUiState(), makeInput(), []);
  const texts = ctx.texts;
  const host = texts.find((t) => t.s === 'HOST');
  const address = texts.find((t) => t.s === 'ADDRESS');
  assert.ok(host, 'the first column is named');
  assert.ok(address, 'the second column is named');
  assert.ok(host.y < texts.find((t) => t.s === 'relay-01').y, 'the titles sit over the cells');
  assert.ok(address.x > host.x, 'the titles follow the columns');
});

test('a table with nothing in it still names its columns', () => {
  const ctx = stubCtx();
  const table = { id: 't', columns: [flex('WHEN', 1)], rows: [], empty: 'nothing here' };
  drawTable(ctx, theme(), { x: 0, y: 0, w: 300, h: 100 }, table, makeUiState(), makeInput(), []);
  const texts = ctx.texts.map((t) => t.s);
  assert.ok(texts.includes('WHEN'));
  assert.ok(texts.includes('nothing here'));
});

// -- the link ------------------------------------------------------------------

test('the link offers the actions that work on the host', () => {
  const state = playState();
  liveLink(state);
  const ctx = frame(state);
  const drawn = ctx.texts.map((t) => t.s);
  for (const caption of ['BYPASS FIREWALL', 'BLIND MONITOR', 'SCRUB PROXY', 'WIPE LOGS']) {
    assert.ok(drawn.includes(caption), `${caption} is offered`);
  }
});

test('an action that cannot run says why', () => {
  const state = playState();
  liveLink(state);
  const ctx = frame(state);
  const reasons = ctx.texts.map((t) => t.s).filter((s) => /^(BYPASS FIREWALL|BLIND MONITOR|SCRUB PROXY|WIPE LOGS) \/\/ /.test(s));
  assert.ok(reasons.length, 'a blocked action says why');
});

test('the wipe of the logs clears the host', () => {
  const state = playState();
  const job = liveLink(state);
  const g = state.game;
  const host = g.world.hosts[job.target];
  assert.ok(host.logs.length, 'the host has logs');
  handleEvents(state, [{ type: 'click', id: 'sess.task.WipeLogs' }], DESK);
  assert.equal(g.session.tasks.length, 1, 'the wipe is running');
  completeTask(g, g.session, { kind: 'WipeLogs', arg: undefined, label: 'wipe logs', progress: 1, dur: 1, lane: 0 });
  assert.equal(host.logs.length, 0, 'the logs are gone');
});

test('an action without its tool says so instead of running', () => {
  const state = playState();
  liveLink(state);
  const g = state.game;
  handleEvents(state, [{ type: 'click', id: 'sess.task.BypassMonitor' }], DESK);
  assert.equal(g.session.tasks.length, 0, 'nothing started');
  assert.ok(g.toasts.some((t) => /monitorbypass/i.test(t.text)), 'the toast says why');
  g.player.tools.push({ kind: 'MonitorBypass', level: 1 });
  handleEvents(state, [{ type: 'click', id: 'sess.task.BypassMonitor' }], DESK);
  assert.equal(g.session.tasks.length, 1, 'the action runs once the tool is fitted');
});

test('a sabotage job is ready once the files are burned and the logs wiped', () => {
  const state = playState();
  const job = liveLink(state);
  const g = state.game;
  const host = g.world.hosts[job.target];
  g.contracts.push({
    id: 900, client: 'WARDEN', kind: 'destroy', target: host.id, file: null,
    subject: 'every file and every log', amount: 0, reward: 100, posted: 0,
    deadline: g.clock.minutes + 9999, difficulty: 1, state: 'accepted', brief: 'burn it',
    story: false, title: '',
  });
  host.files.forEach((f) => { f.deleted = true; });
  completeTask(g, g.session, { kind: 'WipeLogs', arg: undefined, label: 'wipe logs', progress: 1, dur: 1, lane: 0 });
  assert.equal(g.contracts.find((c) => c.id === 900).state, 'ready', 'the job can be handed in');
});

test('the board offers sabotage only when the tools are fitted', () => {
  const g = makeGame('TOOLS', 7);
  g.player.rating = 30;
  g.stats.missionsDone = 1;
  const kinds = new Set();
  for (let i = 0; i < 60; i += 1) {
    const id = spawnContract(g);
    if (id) kinds.add(g.contracts.find((c) => c.id === id).kind);
  }
  assert.ok(!kinds.has('destroy'), 'sabotage is not offered without the tools');
  g.player.tools.push({ kind: 'FileDeleter', level: 1 }, { kind: 'LogDeleter', level: 1 });
  const withTools = new Set();
  for (let i = 0; i < 60; i += 1) {
    const id = spawnContract(g);
    if (id) withTools.add(g.contracts.find((c) => c.id === id).kind);
  }
  assert.ok(withTools.has('destroy'), 'sabotage is on the board once the tools are fitted');
});

// -- the mail ------------------------------------------------------------------

test('MAIL opens on the newest message', () => {
  const state = playState();
  const g = state.game;
  g.mail.push({ id: 5000, from: 'OLD <o@x>', subject: 'OLD', body: 'old', minute: 1, read: true, contract: null, kind: 'normal' });
  g.mail.push({ id: 5001, from: 'NEW <n@x>', subject: 'NEW', body: 'new', minute: 9999, read: false, contract: null, kind: 'normal' });
  openWindow(state.windows, 'mail', DESK);
  frame(state);
  assert.equal(state.win.mail.mailSel, 5001, 'the newest message is open');
});

test('MAIL says when the board is full', () => {
  const state = playState();
  const g = state.game;
  // four jobs are taken, and one more is on the board
  g.contracts.slice(0, 4).forEach((c) => { c.state = 'accepted'; });
  const spare = {
    id: 6000, client: 'X', kind: 'retrieve', target: g.contracts[0].target, file: 'a.txt',
    subject: 'a.txt', amount: 0, reward: 500, posted: 0, deadline: g.clock.minutes + 9999,
    difficulty: 1, state: 'offered', brief: 'do it', story: false, title: '',
  };
  g.contracts.push(spare);
  g.mail.push({
    id: 5002, from: 'X <x@y>', subject: 'CONTRACT', body: 'do it', minute: 9999,
    read: false, contract: spare.id, kind: 'contract',
  });
  openWindow(state.windows, 'mail', DESK);
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'at capacity // finish or drop a job first'), 'the reader explains');
});

// -- the shell -----------------------------------------------------------------

test('SAVE + QUIT writes the run out and brings the welcome screen back', () => {
  const state = playState();
  handleEvents(state, [{ type: 'click', id: 'set.quit' }], DESK);
  assert.equal(state.mode, 'login');
  assert.equal(state.game, null);
  assert.ok(Object.keys(store).some((k) => k.startsWith('blackgate.save.')), 'the run is on the terminal');
  assert.equal(state.login.notice, 'run saved');
  assert.equal(state.login.slots.length, 1, 'the saved operator is listed');
});

test('the machine can be turned off and turned back on', () => {
  const state = playState();
  state.mode = 'off';
  const ctx = stubCtx();
  drawOff(ctx, W, H);
  assert.ok(ctx.texts.some((t) => t.s === 'POWER OFF'), 'the screen says the machine is off');
  state.input.anyKey = true;
  frameKeys(state);
  assert.equal(state.mode, 'boot', 'a key turns the machine back on');
  assert.equal(state.boot.done, true, 'the boot is skipped');
});

test('a wide open host shows its guard in the safe colour', () => {
  const sk = theme();
  assert.equal(guardTint(sk, { firewall: 0, monitor: 0, proxy: 0 }), sk.ok);
  assert.equal(guardTint(sk, { firewall: 1, monitor: 0, proxy: 0 }), sk.warn);
  assert.equal(guardTint(sk, { firewall: 0, monitor: 4, proxy: 0 }), sk.danger);
});
