// Internal networks (M7): the crown host of a company is an internal segment, the zero-trust
// mapper reveals a company's hosts, the Kerberos forger moves a live session inside one company,
// the IAM probe and the kernel exploit open locks (the exploit always raises the alert), and
// the three HUD programs show the surface, the route and the graph.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software } from '../src/data/content.js';
import { isInternal, difficultyOf, REACH } from '../src/data/network.js';
import { makeGame } from '../src/state/gameState.js';
import { versionEffect } from '../src/state/toolEffects.js';
import { targetsFor } from '../src/state/contractTarget.js';
import { surfaceText, routeText, graphNodes } from '../src/state/hud.js';
import { connect, sessionTick, disconnect } from '../src/systems/sessionTick.js';
import { startTask, taskError } from '../src/systems/sessionTasks.js';
import { saveRun, loadRun } from '../src/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const give = (g, tools) => Object.entries(tools).forEach(([kind, level]) => {
  g.player.tools = g.player.tools.filter((t) => t.kind !== kind);
  g.player.tools.push({ kind, level });
});

/// A run linked to the front host of a company that has an internal crown host.
function inside(tools = {}) {
  const g = makeGame('NET', 7);
  give(g, tools);
  const co = g.world.companies.findIndex((c) => c.hosts.length >= 3 && isInternal(g.world.hosts[c.hosts.at(-1)]));
  assert.ok(co >= 0, 'a company with an internal segment');
  const hosts = g.world.companies[co].hosts.map((id) => g.world.hosts[id]);
  const front = hosts[0];
  const crown = hosts.at(-1);
  assert.equal(connect(g, front.id), null);
  sessionTick(g, 999);
  assert.equal(g.session.phase, 'online');
  return { g, hosts, front, crown, co };
}

test('the catalogue has the four network tools and the three HUD programs', () => {
  const by = (k) => software().find((d) => d.kind === k);
  ['ZeroTrustMapper', 'IamProbe', 'KerberosForger', 'KernelPrivesc'].forEach((k) => {
    assert.equal(by(k).versions.length, 3, k);
    const texts = [1, 2, 3].map((v) => versionEffect(k, v));
    assert.equal(new Set(texts).size, 3, texts.join(' | '));
  });
  ['AttackSurfaceHud', 'HopVisualizer', 'CloudGraphHud'].forEach((k) => assert.equal(by(k).versions.length, 1, k));
  assert.deepEqual(by('KerberosForger').prices, [4500, 8000, 12500]);
  assert.equal(by('AttackSurfaceHud').price, 5000);
});

test('the crown host of each hard company is an internal segment; front hosts and soft companies are not', () => {
  for (let seed = 1; seed <= 6; seed += 1) {
    const w = makeGame('NET', seed).world;
    w.companies.forEach((c) => {
      const hosts = c.hosts.map((id) => w.hosts[id]);
      const hard = hosts.length >= 2 && difficultyOf(hosts.at(-1)) >= 3;
      hosts.forEach((h, i) => assert.equal(isInternal(h), hard && i === hosts.length - 1, `${h.name}`));
    });
  }
});

test('an internal host cannot be linked from outside', () => {
  const { g, crown } = inside();
  disconnect(g);
  assert.match(connect(g, crown.id), /internal/);
  assert.equal(g.session, null);
});

test('the board offers internal hosts only from the rating that unlocks the forger', () => {
  const g = makeGame('NET', 7);
  const crown = g.world.hosts.find((h) => isInternal(h));
  crown.firewall = 0;
  crown.monitor = 0;
  crown.proxy = 0;
  const offered = (rating) => { g.player.rating = rating; return targetsFor(g, 'delete').includes(crown.id); };
  assert.equal(offered(10), false);
  assert.equal(offered(16), true);
});

test('the mapper reveals the company\'s hosts up to the difficulty its version reaches', () => {
  const { g, hosts, crown } = inside({ ZeroTrustMapper: 1 });
  hosts.forEach((h) => { h.discovered = false; });
  crown.firewall = 5;
  crown.monitor = 5;
  crown.proxy = 3; // difficulty 13
  hosts[1].firewall = 2;
  hosts[1].monitor = 0;
  hosts[1].proxy = 0;
  assert.equal(startTask(g, 'MapNetwork'), null);
  for (let n = 0; n < 30 && g.session.tasks.length; n += 1) sessionTick(g, 1);
  assert.equal(hosts[1].discovered, true);
  assert.equal(crown.discovered, false, 'version 1 reaches difficulty 6');
  give(g, { ZeroTrustMapper: 3 });
  assert.equal(startTask(g, 'MapNetwork'), null);
  for (let n = 0; n < 30 && g.session.tasks.length; n += 1) sessionTick(g, 1);
  assert.equal(crown.discovered, true);
  assert.match(taskError(g, g.session, 'MapNetwork'), /nothing more/);
  assert.equal(REACH[3] >= 15, true);
});

/// Maps the company and returns the crown host ready to be forged to.
function forge(tools = { KerberosForger: 3 }) {
  const l = inside(tools);
  l.hosts.forEach((h) => { h.discovered = true; });
  return l;
}

test('a forged ticket moves the session to another host of the same company', () => {
  const { g, front, crown } = forge();
  const s = g.session;
  s.trace = 0.2;
  s.alerted = true;
  assert.equal(startTask(g, 'ForgeTicket', crown.id), null);
  for (let n = 0; n < 30 && g.session.tasks.length; n += 1) sessionTick(g, 1);
  assert.equal(s.target, crown.id);
  assert.ok(s.route.includes(front.id), 'the old host becomes a hop');
  assert.equal(s.fwBypassed, true, 'inside the network the firewall and proxy are behind you');
  assert.equal(s.proxyBypassed, true);
  assert.equal(s.monBypassed, false, 'the monitor still watches');
  assert.ok(s.trace >= 0.2, 'the trace goes with you');
  assert.ok(crown.logs.some((l) => l.ip === g.player.gateway.ip), 'the move leaves a log');
  assert.equal(crown.discovered, true);
  // leaving: the logs on both hosts count
  front.logs.push({ minute: 0, ip: g.player.gateway.ip, text: 'x', loud: true });
  disconnect(g);
  assert.ok(g.player.heat > 0);
});

test('a ticket reaches only the same company, only what is known, only what the version reaches', () => {
  const { g, crown, hosts } = forge({ KerberosForger: 1 });
  const other = g.world.hosts.find((h) => h.company != null && h.company !== crown.company);
  other.discovered = true;
  assert.match(taskError(g, g.session, 'ForgeTicket', other.id), /another company/);
  crown.discovered = false;
  assert.match(taskError(g, g.session, 'ForgeTicket', crown.id), /not on your map/);
  crown.discovered = true;
  crown.firewall = 5;
  crown.monitor = 5;
  crown.proxy = 0;
  assert.match(taskError(g, g.session, 'ForgeTicket', crown.id), /too weak/);
  give(g, { KerberosForger: 2 });
  assert.equal(taskError(g, g.session, 'ForgeTicket', crown.id), null);
  assert.match(taskError(g, g.session, 'ForgeTicket', g.session.target), /already/);
  assert.ok(hosts.length >= 3);
});

test('a ticket waits for the running tasks to finish', () => {
  const { g, crown } = forge();
  g.session.tasks.push({ kind: 'WipeLogs', label: 'x', progress: 0, dur: 100, lane: 0 });
  assert.match(taskError(g, g.session, 'ForgeTicket', crown.id), /running/);
});

/// A host with one locked service of each guard.
function locked() {
  const l = inside({ IamProbe: 1, KernelPrivesc: 1 });
  const h = l.front;
  h.services = ['password', 'mfa', 'session', 'token'].map((auth, i) => ({ name: auth, port: 9000 + i, kind: 'admin', password: 1, open: false, visible: true, auth }));
  return { ...l, h };
}

test('the IAM probe opens one locked service quietly, and reaches further with each version', () => {
  const l = locked();
  const open = () => l.h.services.filter((v) => v.open).map((v) => v.auth);
  assert.equal(startTask(l.g, 'ProbeIam'), null);
  for (let n = 0; n < 30 && l.g.session.tasks.length; n += 1) sessionTick(l.g, 1);
  assert.deepEqual(open(), ['password']);
  assert.equal(l.g.session.alerted, false, 'a service account key is quiet');
  assert.match(taskError(l.g, l.g.session, 'ProbeIam'), /no locked service/);
  give(l.g, { IamProbe: 2 });
  startTask(l.g, 'ProbeIam');
  for (let n = 0; n < 30 && l.g.session.tasks.length; n += 1) sessionTick(l.g, 1);
  assert.deepEqual(open(), ['password', 'mfa']);
  give(l.g, { IamProbe: 3 });
  startTask(l.g, 'ProbeIam');
  for (let n = 0; n < 30 && l.g.session.tasks.length; n += 1) sessionTick(l.g, 1);
  assert.deepEqual(open(), ['password', 'mfa', 'session']);
  assert.match(taskError(l.g, l.g.session, 'ProbeIam'), /no locked service/, 'a hardware token needs the HSM, not a key');
});

test('the kernel exploit opens every lock it reaches and always raises the alert', () => {
  const l = locked();
  give(l.g, { KernelPrivesc: 2 });
  const s = l.g.session;
  const rate = s.traceRate;
  assert.equal(s.alerted, false);
  assert.equal(startTask(l.g, 'EscalateKernel'), null);
  for (let n = 0; n < 30 && s.tasks.length; n += 1) sessionTick(l.g, 1);
  assert.deepEqual(l.h.services.filter((v) => v.open).map((v) => v.auth), ['password', 'mfa']);
  assert.equal(s.alerted, true);
  assert.ok(s.trace >= 0.15);
  assert.ok(s.traceRate >= rate * 2);
});

test('the HUD programs show the surface, the route and the graph, and only when installed', () => {
  const l = forge({});
  assert.equal(surfaceText(l.g, l.g.session), null);
  assert.equal(routeText(l.g, l.g.session), null);
  assert.deepEqual(graphNodes(l.g, l.g.session), null);
  give(l.g, { AttackSurfaceHud: 1, HopVisualizer: 1, CloudGraphHud: 1 });
  assert.match(surfaceText(l.g, l.g.session), /FW \d.*MON \d.*PX \d/);
  assert.match(routeText(l.g, l.g.session), /^ROUTE: you → /);
  const nodes = graphNodes(l.g, l.g.session);
  assert.deepEqual(nodes.map((n) => n.id), l.hosts.map((h) => h.id), 'the segments the company has, all known');
  assert.equal(nodes.filter((n) => n.here).length, 1);
  l.crown.discovered = false;
  assert.ok(!graphNodes(l.g, l.g.session).some((n) => n.id === l.crown.id), 'an unknown segment is not drawn');
});

test('a run saved before internal networks gets its segments on load', () => {
  const g = makeGame('NET', 9);
  const want = g.world.hosts.map((h) => isInternal(h));
  g.world.hosts.forEach((h) => { delete h.internal; });
  saveRun(g);
  const loaded = loadRun('NET');
  assert.deepEqual(loaded.world.hosts.map((h) => isInternal(h)), want);
});

test('the CLOUD GRAPH window lists the segments, and its FORGE button moves the session', async () => {
  const { handleEvents } = await import('../src/systems/events.js');
  const { drawNetwork } = await import('../src/windows/network.js');
  const { makeUiState } = await import('../src/ui/kit.js');
  const { makeInput } = await import('../src/systems/input.js');
  const { theme } = await import('../src/core/theme.js');
  const { stubCtx } = await import('./stubCanvas.mjs');
  const l = forge({ KerberosForger: 3, CloudGraphHud: 1 });
  const ctx = stubCtx();
  drawNetwork(ctx, theme(), { x: 0, y: 0, w: 700, h: 500 }, l.g, makeUiState(), makeInput(), []);
  const shown = ctx.texts.map((t) => t.s);
  l.hosts.forEach((h) => assert.ok(shown.includes(h.name), h.name));
  assert.ok(shown.includes('FORGE') && shown.includes('MAP NETWORK'));
  assert.ok(shown.some((t) => /INTERNAL SEGMENT/.test(t)));
  const state = { game: l.g, win: {}, windows: { list: [] }, ui: {}, input: {} };
  handleEvents(state, [{ type: 'click', id: `net.forge.${l.crown.id}` }], { x: 0, y: 0, w: 800, h: 600 });
  assert.equal(l.g.session.tasks[0]?.kind, 'ForgeTicket');
});

test('the new host actions have buttons with a reason when they cannot run', async () => {
  const { sessionActions } = await import('../src/data/content.js');
  const kinds = sessionActions().map((a) => a.kind);
  ['MapNetwork', 'ProbeIam', 'EscalateKernel'].forEach((k) => assert.ok(kinds.includes(k), k));
});
