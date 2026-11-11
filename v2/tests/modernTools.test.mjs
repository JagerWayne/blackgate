// The tools in their modern dress (M5): the spec names on the same kind ids, and the
// Volumetric DDoS Cannon, which drops a firewall and a proxy at once and gives the
// trace a head start.
// Run with: node --test tests/*.mjs
import { roomy } from './roomy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software, sessionActions } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { versionEffect } from '../game/state/toolEffects.js';
import { connect, sessionTick } from '../game/systems/sessionTick.js';
import { startTask, taskError } from '../game/systems/sessionTasks.js';

await initContent();

const NAMES = {
  PasswordCracker: 'Password Breaker',
  SessionHijacker: 'Two-Step Login Bypass',
  ProxyBypass: 'Relay Cleaner',
  FirewallBypass: 'Firewall Breaker',
  MonitorBypass: 'Alarm Silencer',
  DdosCannon: 'Overload Attack',
  TraceTracker: 'Trace Alert',
  FileCopier: 'File Downloader',
  FileDeleter: 'File Shredder',
  Decrypter: 'File Unlocker',
  LogModifier: 'Quiet Log Cleaner',
  LogDeleter: 'Log Wiper',
  OsintSweep: 'People Finder',
  CredentialStuff: 'Email Login Tester',
  VoiceAnalyser: 'Voice Copier',
  SpoofKit: 'Fake Identity Kit',
  ZeroTrustMapper: 'Network Mapper',
  IamProbe: 'Key Finder',
  KerberosForger: 'Staff Pass Forger',
  KernelPrivesc: 'Admin Takeover',
  AttackSurfaceHud: 'Target Overview',
  HopVisualizer: 'Route Viewer',
  CloudGraphHud: 'Company Map',
};

/// A live link to a host with the given defences, with the cannon at a level.
function linked(firewall, proxy, cannon) {
  const g = roomy(makeGame('MODERN', 7));
  g.player.tools = g.player.tools.filter((t) => t.kind !== 'DdosCannon');
  if (cannon) g.player.tools.push({ kind: 'DdosCannon', level: cannon });
  const h = g.world.hosts.find((x) => x.company != null);
  h.firewall = firewall;
  h.proxy = proxy;
  h.monitor = 0;
  assert.equal(connect(g, h.id), null);
  sessionTick(g, 999);
  assert.equal(g.session.phase, 'online');
  return { g, h };
}

const finish = (g) => {
  for (let i = 0; i < 100 && g.session.tasks.length; i += 1) sessionTick(g, 1);
  assert.equal(g.session.tasks.length, 0);
};

test('every tool carries its plain-English name and keeps its kind id', () => {
  const have = Object.fromEntries(software().map((d) => [d.kind, d.name]));
  assert.deepEqual(have, NAMES);
});

test('the cannon has five distinct versions', () => {
  const d = software().find((x) => x.kind === 'DdosCannon');
  assert.equal(d.versions.length, 5);
  const texts = d.versions.map((_, i) => versionEffect('DdosCannon', i + 1));
  assert.equal(new Set(texts).size, 5, texts.join(' | '));
});

test('the cannon is a host action with its own button', () => {
  assert.ok(sessionActions().some((a) => a.kind === 'Ddos' && a.tool === 'DdosCannon'));
});

test('the cannon needs a version that beats both the firewall and the proxy', () => {
  assert.match(taskError(...(() => { const { g } = linked(2, 1, 0); return [g, g.session, 'Ddos']; })()), /Overload Attack/);
  const weak = linked(3, 1, 2);
  assert.match(taskError(weak.g, weak.g.session, 'Ddos'), /too weak/);
  const ok = linked(3, 1, 3);
  assert.equal(taskError(ok.g, ok.g.session, 'Ddos'), null);
});

test('the cannon drops the firewall and the proxy at once, and the trace starts fast', () => {
  const { g, h } = linked(2, 1, 2);
  h.services.push({ name: 'relay', port: 3128, kind: 'proxy', password: 0, open: false, visible: true });
  const s = g.session;
  const rate = s.traceRate;
  assert.equal(s.alerted, false);
  assert.equal(startTask(g, 'Ddos'), null);
  finish(g);
  assert.equal(s.fwBypassed, true);
  assert.equal(s.proxyBypassed, true);
  assert.ok(h.services.filter((v) => v.kind === 'proxy').every((v) => v.open), 'the proxy is open');
  assert.equal(s.alerted, true, 'the flood is noticed at once');
  assert.ok(Math.abs(s.traceRate - rate * 0.65 * 3) < 1e-12, 'a head start the quiet bypasses do not give');
});

test('with nothing to drop the cannon says so', () => {
  const { g } = linked(0, 0, 1);
  assert.match(taskError(g, g.session, 'Ddos'), /nothing to drop/);
});

test('every tool and part reads in plain English: a use line, no jargon in the name', async () => {
  const { components, chassis } = await import('../game/data/content.js');
  software().forEach((d) => {
    assert.ok(d.use && d.use.length > 10, `${d.kind} says when to use it`);
    assert.ok(d.tech, `${d.kind} keeps the real term`);
    assert.ok(!/[A-Z]{3,}/.test(d.name), `${d.name} has no acronym in it`);
    d.versions.forEach((v) => assert.match(v, /^(Basic|Standard|Advanced|Expert|Elite|Master|Ultimate)$/));
  });
  [...components().map((c) => c.name), ...chassis().map((c) => c.name)].forEach((n) => {
    assert.ok(!/NVME|ZFS|FPGA|XEON|EPYC|PCIE|FTTP|SFP|HSM|LEO|THERMITE|TENSOR/i.test(n), `${n} is plain`);
  });
});
