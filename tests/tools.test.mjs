// The tools that finish a session task: the OSINT sweep and the decrypter.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { startTask, taskError } from '../src/systems/sessionTasks.js';

await initContent();

/// A live link to the first host that passes `pick`, with a tool installed.
function online(pick, tool, level = 1) {
  const g = makeGame('TOOLS', 7);
  g.player.tools = g.player.tools.filter((t) => t.kind !== tool);
  g.player.tools.push({ kind: tool, level });
  const h = g.world.hosts.find(pick);
  assert.ok(h, 'the world has such a host');
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  return { g, h };
}

/// Runs the link until no task is left.
function finish(g) {
  for (let i = 0; i < 200 && g.session.tasks.length; i += 1) sessionTick(g, 1);
  assert.equal(g.session.tasks.length, 0, 'the task finished');
}

test('an OSINT sweep puts the target company\'s other hosts on the map', () => {
  const { g, h } = online((x) => x.company !== null && x.company !== undefined
    && g0Hosts(x).length > 1, 'OsintSweep');
  const others = g.world.companies[h.company].hosts.filter((id) => id !== h.id);
  others.forEach((id) => { g.world.hosts[id].discovered = false; });
  assert.equal(startTask(g, 'OsintSweep'), null);
  finish(g);
  assert.ok(others.every((id) => g.world.hosts[id].discovered), 'every host of the company is known');
  assert.ok(g.session.lines.some((l) => /osint/i.test(l)), 'the link log says so');
});

test('an encrypted file is decrypted, then copied', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc > 0 && !f.deleted && f.size < 30), 'Decrypter', 3);
  const i = h.files.findIndex((f) => f.enc > 0 && !f.deleted && f.size < 30);
  const f = h.files[i];
  assert.equal(taskError(g, g.session, 'CopyFile', i), 'file is encrypted');
  assert.equal(startTask(g, 'DecryptFile', i), null);
  finish(g);
  assert.equal(f.enc, 0, 'the file is plain now');
  assert.equal(taskError(g, g.session, 'CopyFile', i), null, 'and can be copied');
  assert.equal(taskError(g, g.session, 'DecryptFile', i), 'file is not encrypted');
});

test('a decrypter weaker than the encryption is refused', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc >= 2 && !f.deleted), 'Decrypter', 1);
  const i = h.files.findIndex((f) => f.enc >= 2 && !f.deleted);
  assert.match(taskError(g, g.session, 'DecryptFile', i), /cannot open/);
});

test('without a decrypter the task says what is missing', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc > 0 && !f.deleted), 'Decrypter', 1);
  g.player.tools = g.player.tools.filter((t) => t.kind !== 'Decrypter');
  const i = h.files.findIndex((f) => f.enc > 0 && !f.deleted);
  assert.match(taskError(g, g.session, 'DecryptFile', i), /Decrypter/);
});

// the company's hosts, read from a fresh world of the same seed
function g0Hosts(h) {
  return G0.world.companies[h.company]?.hosts ?? [];
}
const G0 = makeGame('TOOLS', 7);

test('the DECRYPT button on the file row starts the task', async () => {
  const { handleEvents } = await import('../src/systems/events.js');
  const { g, h } = online((x) => x.files.some((f) => f.enc === 1 && !f.deleted), 'Decrypter', 1);
  const i = h.files.findIndex((f) => f.enc === 1 && !f.deleted);
  const state = { game: g, win: {}, windows: { list: [] }, ui: {}, input: {} };
  handleEvents(state, [{ type: 'click', id: `sess.decrypt.${i}` }], { x: 0, y: 0, w: 800, h: 600 });
  assert.equal(g.session.tasks[0]?.kind, 'DecryptFile');
});

test('an encrypted file row offers DECRYPT next to COPY', async () => {
  const { stubCtx } = await import('./stubCanvas.mjs');
  const { drawFiles } = await import('../src/windows/sessionTabs.js');
  const { makeUiState } = await import('../src/ui/kit.js');
  const { makeInput } = await import('../src/systems/input.js');
  const { theme } = await import('../src/core/theme.js');
  const { g } = online((x) => x.files.some((f) => f.enc > 0 && !f.deleted), 'Decrypter', 3);
  const ctx = stubCtx();
  drawFiles(ctx, theme(), { x: 0, y: 0, w: 700, h: 2000 }, g, g.session, makeUiState(), makeInput(), []);
  assert.ok(ctx.texts.some((t) => t.s === 'DECRYPT'));
  assert.ok(ctx.texts.some((t) => t.s === 'COPY'));
});

// -- LOGMOD, TRACE and the shop ------------------------------------------------------

test('LOGMOD removes only the operator\'s logs, quietly', () => {
  const { g, h } = online((x) => x.company !== null && x.company !== undefined, 'LogModifier');
  const ip = g.player.gateway.ip;
  h.logs.push({ minute: 1, ip, text: 'mine', loud: true });
  const others = h.logs.filter((l) => l.ip !== ip).length;
  assert.ok(others > 0, 'the host has other people\'s logs');
  const trace = g.session.trace;
  assert.equal(startTask(g, 'ModifyLogs'), null);
  assert.equal(g.session.alerted, false, 'starting it trips no alarm');
  finish(g);
  assert.equal(h.logs.filter((l) => l.ip === ip).length, 0, 'every log of the operator is gone');
  assert.equal(h.logs.length, others, 'everyone else\'s logs are left');
  assert.equal(g.session.alerted, false);
  assert.equal(g.session.trace, trace, 'no trace was added');
  assert.equal(taskError(g, g.session, 'ModifyLogs'), 'no logs of yours here');
});

test('TRACE moves the trace warning earlier by 5% a version', async () => {
  const { traceWarnAt } = await import('../src/systems/sessionTick.js');
  const { warnAt } = await import('../src/state/gateway.js');
  const { g } = online(() => true, 'TraceTracker', 3);
  assert.ok(Math.abs(traceWarnAt(g) - (warnAt(g.player.gateway) - 0.15)) < 1e-9);
  // the warning fires at the earlier mark
  Object.assign(g.session, { alerted: true, traceRate: 0, trace: traceWarnAt(g) + 0.001 });
  sessionTick(g, 0.01);
  assert.equal(g.session.warned, true);
});

test('a tool no task uses cannot be bought', async () => {
  const { buyTool } = await import('../src/state/economy.js');
  const g = makeGame('TOOLS', 7);
  g.player.credits = 1e6;
  g.player.accounts[0].balance = 1e6;
  assert.equal(buyTool(g, 'HudConnect', 1), 'no task uses this tool yet');
  assert.ok(!g.player.tools.some((t) => t.kind === 'HudConnect'));
  assert.equal(buyTool(g, 'LogModifier', 1), null, 'LOGMOD is for sale now');
  assert.equal(buyTool(g, 'TraceTracker', 1), null, 'TRACE is for sale now');
});

// -- keys and mail ------------------------------------------------------------------

async function playState() {
  const { makeInput } = await import('../src/systems/input.js');
  const { makeUiState } = await import('../src/ui/kit.js');
  const { makeWindows } = await import('../src/state/windows.js');
  return { view: { w: 1600, h: 900 }, input: makeInput(), ui: makeUiState(), windows: makeWindows(), game: makeGame('KEYS', 7), win: {}, mode: 'play' };
}

test('1-9 open the applications and Space pauses, unless a field has the keys', async () => {
  const { frameKeys } = await import('../src/systems/hotkeys.js');
  const { WINDOWS } = await import('../src/state/windows.js');
  const state = await playState();
  state.input.text = '2';
  frameKeys(state);
  assert.equal(state.windows.list[0]?.key, WINDOWS.filter((w) => !w.hidden)[1].key);
  state.input.text = ' ';
  frameKeys(state);
  assert.equal(state.game.paused, true);
  state.ui.focus = 'notepad';
  state.input.text = ' ';
  frameKeys(state);
  assert.equal(state.game.paused, true, 'typing a space in a field does not pause');
});

test('MARK ALL READ clears the unread mail', async () => {
  const { handleEvents } = await import('../src/systems/events.js');
  const state = await playState();
  state.game.mail.push({ id: 99, from: 'x', subject: 's', body: 'b', minute: 0, read: false });
  handleEvents(state, [{ type: 'click', id: 'mail.readAll' }], { x: 0, y: 0, w: 800, h: 600 });
  assert.ok(state.game.mail.every((m) => m.read));
});
