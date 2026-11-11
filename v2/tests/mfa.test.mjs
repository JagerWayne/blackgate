// Multi-factor authentication (M6): services carry an auth level, the Session Token Hijacker
// opens MFA for a short token that expires loudly, hardware tokens need the HSM tap, and
// a stuffed or cracked password is not enough behind MFA.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software, componentsOf } from '../game/data/content.js';
import { HW_KINDS } from '../game/data/enums.js';
import { authFor, authOf, inboxAuth, AUTH_LEVEL, TOKEN_SECS } from '../game/data/auth.js';
import { makeGame } from '../game/state/gameState.js';
import { versionEffect } from '../game/state/toolEffects.js';
import { targetsFor } from '../game/state/contractTarget.js';
import { connect, sessionTick, disconnect } from '../game/systems/sessionTick.js';
import { startTask, taskError } from '../game/systems/sessionTasks.js';
import { saveRun, loadRun } from '../game/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

/// A live link to a company host whose records lock is of the given auth.
function linked(auth, tools = {}) {
  const g = makeGame('MFA', 7);
  Object.entries(tools).forEach(([kind, level]) => {
    g.player.tools = g.player.tools.filter((t) => t.kind !== kind);
    g.player.tools.push({ kind, level });
  });
  const h = g.world.hosts.find((x) => x.company != null && x.services.some((v) => v.kind === 'records'));
  const i = h.services.findIndex((v) => v.kind === 'records');
  h.services[i].auth = auth;
  h.services[i].open = false;
  assert.equal(connect(g, h.id), null);
  sessionTick(g, 999);
  assert.equal(g.session.phase, 'online');
  return { g, h, i, svc: h.services[i] };
}

test('the catalogue has the HSM tap and the session token hijacker', () => {
  assert.ok(HW_KINDS.includes('hsm'));
  assert.deepEqual(componentsOf('hsm').map((d) => d.price), [11000]);
  const d = software().find((x) => x.kind === 'SessionHijacker');
  assert.equal(d.versions.length, 2);
  assert.deepEqual(d.prices, [3500, 7500]);
  assert.notEqual(versionEffect('SessionHijacker', 1), versionEffect('SessionHijacker', 2));
});

test('a lock is behind MFA by the host\'s difficulty; tokens are for the big banks and ministries', () => {
  const host = (kind, d) => ({ kind, firewall: Math.min(d, 5), monitor: Math.min(Math.max(d - 5, 0), 5), proxy: Math.max(d - 10, 0) });
  const lock = { kind: 'records', password: 2 };
  assert.equal(authFor(host('corporate', 3), lock), 'password');
  assert.equal(authFor(host('corporate', 4), lock), 'mfa');
  assert.equal(authFor(host('corporate', 7), lock), 'session');
  assert.equal(authFor(host('corporate', 12), lock), 'session', 'a corporation has no hardware tokens');
  assert.equal(authFor(host('bank', 9), { kind: 'bank', password: 3 }), 'token');
  assert.equal(authFor(host('gov', 9), lock), 'token');
  assert.equal(authFor(host('bank', 12), { kind: 'voice', password: 1 }), 'password', 'a voice lock has its own check');
  assert.equal(authFor(host('bank', 12), { kind: 'web', password: 0 }), 'password');
});

test('the generated worlds use every auth level, and soft hosts keep passwords', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    makeGame('MFA', seed).world.hosts.forEach((h) => {
      h.services.forEach((v) => {
        seen.add(authOf(v));
        if (h.firewall + h.monitor + h.proxy < 4) assert.equal(authOf(v), 'password');
      });
    });
  }
  assert.deepEqual([...seen].sort(), ['mfa', 'password', 'session', 'token']);
});

test('cracking a password is not enough behind MFA', () => {
  const { g, i } = linked('mfa', { PasswordCracker: 3 });
  assert.match(taskError(g, g.session, 'CrackPassword', i), /MFA.*Two-Step Login Bypass/i);
});

test('a hardware token needs the HSM tap, and with it is cracked like a password', () => {
  const { g, i, svc } = linked('token', { PasswordCracker: 3 });
  svc.password = 1;
  assert.match(taskError(g, g.session, 'CrackPassword', i), /HSM|key reader/i);
  g.player.gateway.parts.push({ kind: 'hsm', level: 1 });
  assert.equal(taskError(g, g.session, 'CrackPassword', i), null);
});

test('the hijacker: version 1 beats app MFA, version 2 session-bound MFA', () => {
  const app = linked('mfa', { SessionHijacker: 1 });
  assert.equal(taskError(app.g, app.g.session, 'HijackSession', app.i), null);
  const bound = linked('session', { SessionHijacker: 1 });
  assert.match(taskError(bound.g, bound.g.session, 'HijackSession', bound.i), /cannot beat/);
  const v2 = linked('session', { SessionHijacker: 2 });
  assert.equal(taskError(v2.g, v2.g.session, 'HijackSession', v2.i), null);
  const plain = linked('password', { SessionHijacker: 2 });
  assert.match(taskError(plain.g, plain.g.session, 'HijackSession', plain.i), /no MFA/);
  const none = linked('mfa');
  assert.match(taskError(none.g, none.g.session, 'HijackSession', none.i), /Two-Step Login Bypass/);
});

/// Runs the hijack to its end.
function hijack(l) {
  assert.equal(startTask(l.g, 'HijackSession', l.i), null);
  for (let n = 0; n < 60 && l.g.session.tasks.length; n += 1) sessionTick(l.g, 1);
  assert.equal(l.svc.open, true);
}

test('the token opens the service for forty seconds, then it expires loudly', () => {
  const l = linked('mfa', { SessionHijacker: 1 });
  const s = l.g.session;
  hijack(l);
  // the token starts counting in the second it was captured
  assert.ok(l.svc.tokenLeft > TOKEN_SECS - 2 && l.svc.tokenLeft <= TOKEN_SECS);
  assert.equal(s.alerted, false, 'a silent hijack');
  sessionTick(l.g, TOKEN_SECS - 3);
  assert.equal(l.svc.open, true, 'still inside the window');
  sessionTick(l.g, 4);
  assert.equal(l.svc.open, false);
  assert.equal(l.svc.tokenLeft, undefined);
  assert.equal(s.alerted, true, 'the host noticed the dead session');
  assert.ok(s.trace > 0);
});

test('an alteration under way is lost when the token expires', () => {
  const l = linked('mfa', { SessionHijacker: 1 });
  hijack(l);
  l.g.session.tasks.push({ kind: 'AlterRecord', arg: { person: 0, field: 'status', value: 'x' }, label: 'alter', progress: 0, dur: 1000, lane: 0 });
  sessionTick(l.g, TOKEN_SECS + 1);
  assert.ok(!l.g.session.tasks.some((t) => t.kind === 'AlterRecord'));
});

test('closing the link takes the token back', () => {
  const l = linked('mfa', { SessionHijacker: 1 });
  hijack(l);
  disconnect(l.g);
  assert.equal(l.svc.open, false);
  assert.equal(l.svc.tokenLeft, undefined);
});

test('stuffing and brute force are blocked behind MFA; the hijacker gets in', () => {
  const g = makeGame('MFA', 7);
  const h = g.world.hosts.find((x) => x.company != null);
  const staff = g.world.people.findIndex((p) => p.company === h.company);
  g.intel = { ...g.intel, [staff]: { level: 4, leak: true } };
  [{ kind: 'CredentialStuff', level: 1 }, { kind: 'PasswordCracker', level: 3 }].forEach((t) => g.player.tools.push(t));
  const set = (auth) => g.world.hosts.filter((x) => x.company === h.company).forEach((x) => x.services.forEach((v) => { v.auth = auth; }));
  set('password');
  assert.equal(connect(g, h.id), null);
  sessionTick(g, 999);
  const email = () => taskError(g, g.session, 'HackInbox', staff);
  set('mfa');
  assert.equal(inboxAuth(g.world, h.company), 'mfa');
  assert.match(email(), /MFA/);
  g.player.tools.push({ kind: 'SessionHijacker', level: 1 });
  assert.equal(email(), null);
});

test('jobs on a host whose records are behind a harder auth wait for the rating that unlocks the hijacker', () => {
  const g = makeGame('MFA', 7);
  const h = g.world.hosts.find((x) => x.company != null && x.services.some((v) => v.kind === 'records'));
  const records = h.services.find((v) => v.kind === 'records');
  h.firewall = 0;
  h.monitor = 0;
  h.proxy = 0;
  const open = (rating) => { g.player.rating = rating; return targetsFor(g, 'modify').includes(h.id); };
  records.auth = 'mfa';
  assert.equal(open(7), true);
  assert.equal(open(5), false);
  records.auth = 'session';
  assert.equal(open(10), false);
  assert.equal(open(16), true);
  records.auth = 'token';
  assert.equal(open(20), false);
  assert.equal(open(30), true);
  assert.deepEqual(Object.keys(AUTH_LEVEL), ['password', 'mfa', 'session', 'token']);
});

test('a run saved before MFA gets its auth levels on load', () => {
  const g = makeGame('MFA', 9);
  const want = g.world.hosts.map((h) => h.services.map((v) => authOf(v)));
  g.world.hosts.forEach((h) => h.services.forEach((v) => { delete v.auth; }));
  saveRun(g);
  const loaded = loadRun('MFA');
  assert.deepEqual(loaded.world.hosts.map((h) => h.services.map((v) => authOf(v))), want);
});

test('the lock row has no button, the Two-Step Login Bypass starts from its menu, and the row names the guard', async () => {
  const { handleEvents } = await import('../game/systems/events.js');
  const { drawAccess } = await import('../pages/windows/sessionTabs.js');
  const { makeUiState } = await import('../pages/ui/kit.js');
  const { makeInput } = await import('../game/systems/input.js');
  const { theme } = await import('../game/core/theme.js');
  const { stubCtx } = await import('./stubCanvas.mjs');
  const l = linked('mfa', { SessionHijacker: 1 });
  const ctx = stubCtx();
  drawAccess(ctx, theme(), { x: 0, y: 0, w: 600, h: 500 }, l.g, l.g.session, makeUiState(), makeInput(), []);
  const shown = ctx.texts.map((t) => t.s);
  assert.ok(shown.includes('APP MFA'), shown.join(' | '));
  assert.ok(!shown.includes('HIJACK'), 'the row has no button: the menu is on a right click');
  const state = { game: l.g, win: {}, windows: { list: [] }, ui: {}, input: {} };
  const desk = { x: 0, y: 0, w: 800, h: 600 };
  handleEvents(state, [{ type: 'click', id: `sess.hijack.${l.i}` }], desk);
  assert.equal(l.g.session.tasks[0]?.kind, 'HijackSession');
});
