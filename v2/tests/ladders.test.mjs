// The tool ladders after the rebalance: longer ladders for the bypasses and the decrypter,
// shorter ones for the cracker, the voice cloner and the trace interceptor, spec prices,
// seven unlock levels, jobs gated by what the rating has unlocked, and pay that keeps rising.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, software, unlocks } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { toolPrice } from '../game/state/economy.js';
import { targetsFor } from '../game/state/contractTarget.js';
import { spawnContract } from '../game/state/contractSpawn.js';
import { connect, sessionTick } from '../game/systems/sessionTick.js';
import { taskError } from '../game/systems/sessionTasks.js';
import { saveRun, loadRun } from '../game/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const def = (kind) => software().find((d) => d.kind === kind);

test('the ladders have the lengths of the spec', () => {
  const want = {
    PasswordCracker: 3, FirewallBypass: 5, MonitorBypass: 5, ProxyBypass: 5, DdosCannon: 5,
    Decrypter: 7, TraceTracker: 4, VoiceAnalyser: 1, OsintSweep: 4, SpoofKit: 2,
  };
  Object.entries(want).forEach(([kind, n]) => assert.equal(def(kind).versions.length, n, kind));
});

test('the versions are priced from the sheet, the others by the old multiplier', () => {
  assert.deepEqual([1, 2, 3].map((v) => toolPrice(def('PasswordCracker'), v)), [1500, 4000, 8500]);
  assert.equal(toolPrice(def('Decrypter'), 7), 25000);
  assert.deepEqual([1, 2, 3, 4, 5].map((v) => toolPrice(def('MonitorBypass'), v)), [1200, 2500, 5200, 11000, 23000]);
  assert.equal(toolPrice(def('FileCopier'), 1), 650);
});

test('seven unlock levels', () => {
  assert.deepEqual(unlocks().map((u) => u.rating), [0, 6, 16, 30, 48, 70, 100]);
});

test('a firewall bypass has to be at least as strong as the firewall', () => {
  const g = makeGame('LADDER', 7);
  const h = g.world.hosts.find((x) => x.company != null);
  h.firewall = 2;
  g.player.tools = g.player.tools.filter((t) => t.kind !== 'FirewallBypass');
  g.player.tools.push({ kind: 'FirewallBypass', level: 1 });
  assert.equal(connect(g, h.id), null);
  sessionTick(g, 999);
  assert.match(taskError(g, g.session, 'BypassFirewall'), /too weak/);
  g.player.tools.find((t) => t.kind === 'FirewallBypass').level = 2;
  assert.equal(taskError(g, g.session, 'BypassFirewall'), null);
});

test('a rating is only given the targets its unlocked tools can beat', () => {
  const g = makeGame('LADDER', 7);
  const worst = (rating) => {
    g.player.rating = rating;
    return Math.max(0, ...targetsFor(g, 'delete').map((id) => {
      const h = g.world.hosts[id];
      return Math.max(h.firewall, h.monitor, h.proxy);
    }));
  };
  assert.equal(worst(5), 0, 'a new operator meets no guards');
  assert.ok(worst(6) <= 2, 'rating 6 unlocks version 2');
  assert.ok(worst(16) <= 3);
  assert.ok(worst(100) <= 5);
  assert.ok(worst(100) > worst(6), 'the world opens up with the rating');
});

/// The mean pay of a rating's offers over a few worlds.
function meanPay(rating) {
  const pay = [];
  for (let seed = 1; seed <= 4; seed += 1) {
    const g = makeGame('PAY', seed);
    g.player.rating = rating;
    g.contracts = [];
    for (let i = 0; i < 40; i += 1) {
      const id = spawnContract(g, false);
      const c = g.contracts.find((x) => x.id === id);
      if (c) pay.push(c.reward);
    }
  }
  return pay.reduce((a, b) => a + b, 0) / pay.length;
}

test('pay keeps rising with the rating past 20', () => {
  assert.ok(meanPay(100) > 1.4 * meanPay(20));
});

test('a run saved on the old ladders is clamped: locks, voice locks, tools and refund', () => {
  const g = makeGame('LADDER', 9);
  const h = g.world.hosts.find((x) => x.company != null);
  h.services.push({ name: 'old', port: 1, kind: 'admin', password: 5, open: false, visible: true });
  h.services.push({ name: 'oldvoice', port: 2, kind: 'voice', password: 3, open: false, visible: true });
  g.player.tools = [{ kind: 'PasswordCracker', level: 5 }, { kind: 'VoiceAnalyser', level: 3 }, { kind: 'TraceTracker', level: 5 }];
  g.player.credits = 0;
  saveRun(g);
  const loaded = loadRun('LADDER');
  const lock = loaded.world.hosts[h.id].services;
  assert.ok(lock.find((v) => v.name === 'old').password <= 3);
  assert.equal(lock.find((v) => v.name === 'oldvoice').password, 1);
  const lv = (k) => loaded.player.tools.find((t) => t.kind === k).level;
  assert.deepEqual([lv('PasswordCracker'), lv('VoiceAnalyser'), lv('TraceTracker')], [3, 1, 4]);
  assert.ok(loaded.player.credits > 0, 'the cut levels are paid back');
});
