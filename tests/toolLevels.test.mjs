// Every level of a tool does something the level below does not, and no tool
// sells a level past what a target can ask of it.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { versionEffect, NO_TASK } from '../src/state/toolEffects.js';
import { connect } from '../src/systems/sessionTick.js';
import { taskError } from '../src/systems/sessionTasks.js';
import { buyTool } from '../src/state/economy.js';
import { INTEL_FIELDS } from '../src/state/intel.js';
import { saveRun, loadRun } from '../src/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const defs = software();
const top = (kind) => defs.find((d) => d.kind === kind).versions.length;

/// The most any target in a few generated worlds asks of each tool.
function demands() {
  const m = { lock: 0, firewall: 0, proxy: 0, monitor: 0, voice: 0, enc: 0 };
  for (let seed = 1; seed <= 12; seed += 1) {
    makeGame('LEVELS', seed).world.hosts.forEach((h) => {
      m.firewall = Math.max(m.firewall, h.firewall);
      m.proxy = Math.max(m.proxy, h.proxy);
      m.monitor = Math.max(m.monitor, h.monitor);
      h.services.forEach((s) => {
        m.lock = Math.max(m.lock, s.password);
        if (s.kind === 'voice') m.voice = Math.max(m.voice, s.password);
      });
      h.files.forEach((f) => { m.enc = Math.max(m.enc, f.enc); });
    });
  }
  return m;
}

test('no tool that is for sale describes a level the same as the one before it', () => {
  defs.filter((d) => versionEffect(d.kind, 1) !== NO_TASK).forEach((d) => {
    const texts = d.versions.map((_, i) => versionEffect(d.kind, i + 1));
    assert.equal(new Set(texts).size, texts.length, `${d.kind}: ${texts.join(' | ')}`);
  });
});

test('a tool stops at the highest level any target can ask for', () => {
  const m = demands();
  assert.equal(top('PasswordCracker'), m.lock);
  assert.equal(top('FirewallBypass'), m.firewall);
  assert.equal(top('ProxyBypass'), m.proxy);
  assert.equal(top('MonitorBypass'), m.monitor);
  assert.equal(top('DdosCannon'), Math.min(m.firewall, m.proxy));
  assert.equal(top('Decrypter'), m.enc);
  assert.equal(top('VoiceAnalyser'), m.voice);
  assert.deepEqual([m.lock, m.firewall, m.monitor, m.proxy, m.enc, m.voice], [3, 5, 5, 5, 7, 1], 'the targets span the whole ladders');
  assert.equal(top('OsintSweep'), Math.max(...INTEL_FIELDS.map((f) => f.level)));
});

test('a tool with one job has one level', () => {
  ['FileCopier', 'FileDeleter', 'LogDeleter', 'LogModifier', 'CredentialStuff'].forEach((k) => assert.equal(top(k), 1, k));
  assert.equal(top('SpoofKit'), 2, 'spoofing, then taps');
});

test('a monitor bypass has to match the monitor', () => {
  const g = makeGame('LEVELS', 7);
  const h = g.world.hosts.find((x) => x.monitor >= 2);
  assert.ok(h, 'the world has a strong monitor');
  g.player.tools = g.player.tools.filter((t) => t.kind !== 'MonitorBypass');
  g.player.tools.push({ kind: 'MonitorBypass', level: 1 });
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  assert.ok(taskError(g, g.session, 'BypassMonitor'), 'v1 is too weak');
  g.player.tools.find((t) => t.kind === 'MonitorBypass').level = h.monitor;
  assert.equal(taskError(g, g.session, 'BypassMonitor'), null);
});

test('a level past the last one cannot be bought', () => {
  const g = makeGame('LEVELS', 7);
  g.player.credits = 1e9;
  assert.ok(buyTool(g, 'Decrypter', top('Decrypter') + 1));
});

test('the tools nothing could use are gone, from the shop and from old saves', () => {
  ['IpProbe', 'HudConnect', 'LanScan'].forEach((k) => assert.ok(!defs.some((d) => d.kind === k), k));
  assert.ok(!makeGame('LEVELS', 7).player.tools.some((t) => t.kind === 'IpProbe'), 'not a starter tool any more');
  const g = makeGame('LEVELS', 7);
  g.player.tools.push({ kind: 'IpProbe', level: 1 });
  saveRun(g);
  assert.ok(!loadRun('LEVELS').player.tools.some((t) => t.kind === 'IpProbe'), 'dropped from a saved run');
});

test('a save that owns a level that no longer exists is cut back and refunded', () => {
  const g = makeGame('LEVELS', 7);
  g.player.tools = [{ kind: 'LogDeleter', level: 5 }];
  g.player.credits = 0;
  saveRun(g);
  const loaded = loadRun('LEVELS');
  assert.equal(loaded.player.tools.find((t) => t.kind === 'LogDeleter').level, 1);
  assert.ok(loaded.player.credits > 0, 'the levels that were bought are paid back');
});
