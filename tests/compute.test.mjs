// Compute (M2): accelerators and the FPGA speed the crypto tasks up, every task takes
// thread slots, an overloaded machine slows all of them and, left overloaded, drops a
// bypass and starts the trace. Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentsOf } from '../src/data/content.js';
import { HW_KINDS } from '../src/data/enums.js';
import { makeGame } from '../src/state/gameState.js';
import { buyComponent } from '../src/state/economy.js';
import * as gw from '../src/state/gateway.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { startTask, taskError } from '../src/systems/sessionTasks.js';

await initContent();

/// A live link to the first host that passes `pick`, on the starter Pelican (one
/// Gen 1 socket: two thread slots), with the tools installed.
function online(pick, tools = {}) {
  const g = makeGame('COMPUTE', 7);
  Object.entries(tools).forEach(([kind, level]) => {
    g.player.tools = g.player.tools.filter((t) => t.kind !== kind);
    g.player.tools.push({ kind, level });
  });
  const h = g.world.hosts.find(pick);
  assert.ok(h, 'the world has such a host');
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  g.session.traceRate = 0.01;
  return { g, h };
}

const lock = (v) => v.kind !== 'voice' && !v.open && v.password > 0;
const fit = (g, kind, level) => g.player.gateway.parts.push({ kind, level });
/// A task that is already running and will not finish in the test.
const stub = (g, kind, lane) => g.session.tasks.push({ kind, arg: lane, label: kind, progress: 0, dur: 1000, lane });
/// The duration a fresh task of this kind gets right now.
function durOf(g, kind, arg) {
  g.session.tasks = [];
  assert.equal(startTask(g, kind, arg), null);
  return g.session.tasks[0].dur;
}

test('the catalogue has accelerator cards and an FPGA', () => {
  assert.deepEqual(HW_KINDS, ['cpu', 'accel', 'fpga', 'storage', 'modem', 'security']);
  assert.deepEqual(componentsOf('accel').map((d) => d.multiplier), [1.5, 2.5, 3.5, 5]);
  assert.deepEqual(componentsOf('accel').map((d) => d.price), [4500, 9000, 15000, 24000]);
  assert.deepEqual(componentsOf('fpga').map((d) => [d.multiplier, d.price]), [[3, 35000]]);
});

test('the FPGA needs a chassis that can take silicon, an accelerator fits anywhere', () => {
  const g = makeGame('COMPUTE', 7);
  g.player.credits = 1e9;
  const [card] = componentsOf('accel');
  const [fpga] = componentsOf('fpga');
  assert.equal(gw.fitPlan(g.player.gateway, card).why, '');
  assert.ok(gw.fitPlan(g.player.gateway, fpga).why, 'no FPGA slot on the Pelican');
  g.player.gateway.chassis = 4;
  assert.equal(buyComponent(g, fpga), null);
  assert.equal(gw.fpga(g.player.gateway), 3);
});

test('an accelerator card shortens a crack by its stated factor', () => {
  const { g, h } = online((x) => x.services.some(lock), { PasswordCracker: 5 });
  const i = h.services.findIndex(lock);
  const base = durOf(g, 'CrackPassword', i);
  [[1, 1.5], [2, 2.5], [3, 3.5], [4, 5]].forEach(([tier, factor]) => {
    g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'accel');
    fit(g, 'accel', tier);
    assert.equal(gw.crypt(g.player.gateway), factor);
    const fast = durOf(g, 'CrackPassword', i);
    assert.ok(Math.abs(base / fast - factor) < 1e-9 || fast === 0.6, `${factor}x`);
  });
});

test('the FPGA speeds a decryption three times over', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc > 0 && f.enc <= 3 && !f.deleted), { Decrypter: 3 });
  const i = h.files.findIndex((f) => f.enc > 0 && f.enc <= 3 && !f.deleted);
  const base = durOf(g, 'DecryptFile', i);
  fit(g, 'fpga', 1);
  const fast = durOf(g, 'DecryptFile', i);
  assert.ok(Math.abs(base / fast - 3) < 1e-9 || fast === 0.6);
});

test('a recorded call is as long as the call, an accelerator does not shorten it', () => {
  const { g } = online((x) => x.company != null, { VoiceAnalyser: 3, SpoofKit: 2, OsintSweep: 4 });
  const person = g.world.people.findIndex((p) => p.company === g.world.hosts[g.session.target].company);
  g.intel = { ...g.intel, [person]: { level: 4 } };
  assert.equal(durOf(g, 'CallRecord', person), 8);
  fit(g, 'accel', 4);
  assert.equal(durOf(g, 'CallRecord', person), 8);
  assert.ok(durOf(g, 'SpoofCall', person) < 14, 'a spoofed call is synthesised');
});

test('every task takes a thread slot; crackers, decrypters and voice work take two', () => {
  const { g } = online(() => true, { OsintSweep: 3 });
  const s = g.session;
  assert.equal(gw.lanes(g.player.gateway), 2);
  stub(g, 'OsintSweep', 0);
  assert.equal(taskError(g, s, 'OsintSweep'), null, 'one slot used, one left');
  stub(g, 'CrackPassword', 1); // demand 3 on 2 slots: allowed, but throttled
  assert.equal(taskError(g, s, 'OsintSweep'), null, 'up to twice the slots is allowed');
  stub(g, 'WipeLogs', 2); // demand 4: the most the machine will take
  assert.equal(taskError(g, s, 'OsintSweep'), 'processors saturated');
  assert.equal(startTask(g, 'OsintSweep'), 'processors saturated');
});

test('an FPGA decryption takes no thread slot', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc > 0 && f.enc <= 3 && !f.deleted), { Decrypter: 3 });
  const i = h.files.findIndex((f) => f.enc > 0 && f.enc <= 3 && !f.deleted);
  stub(g, 'CrackPassword', 0);
  stub(g, 'CrackPassword', 1); // demand 4 of 4
  assert.equal(taskError(g, g.session, 'DecryptFile', i), 'processors saturated');
  fit(g, 'fpga', 1);
  assert.equal(taskError(g, g.session, 'DecryptFile', i), null);
});

test('more tools than thread slots slow every task by slots over demand', () => {
  const { g } = online(() => true);
  stub(g, 'CrackPassword', 0);
  stub(g, 'WipeLogs', 1); // demand 3 on 2 slots
  sessionTick(g, 1);
  g.session.tasks.forEach((t) => assert.ok(Math.abs(t.progress - (1 / 1000) * (2 / 3)) < 1e-12));
  g.session.tasks = [];
  stub(g, 'WipeLogs', 0); // within the slots: full speed
  sessionTick(g, 1);
  assert.ok(Math.abs(g.session.tasks[0].progress - 1 / 1000) < 1e-12);
});

test('twenty seconds past one and a half times the slots drops the weakest bypass and starts the trace', () => {
  const { g, h } = online(() => true);
  const s = g.session;
  h.firewall = 3;
  h.monitor = 1;
  s.fwBypassed = true;
  s.monBypassed = true;
  stub(g, 'CrackPassword', 0);
  stub(g, 'CrackPassword', 1); // demand 4 > 1.5 x 2
  assert.equal(s.alerted, false);
  sessionTick(g, 19);
  assert.ok(s.fwBypassed && s.monBypassed, 'not yet');
  sessionTick(g, 1);
  assert.equal(s.monBypassed, false, 'the weakest (monitor level 1) is dropped');
  assert.equal(s.fwBypassed, true);
  assert.equal(s.alerted, true, 'the digital trace starts');
  sessionTick(g, 1);
  assert.ok(s.trace > 0);
});

test('a proxy scrub is undone, and a bypass still being worked on is cancelled', () => {
  const { g, h } = online(() => true);
  const s = g.session;
  h.proxy = 2;
  s.proxyBypassed = true;
  h.services.filter((v) => v.kind === 'proxy').forEach((v) => { v.open = true; });
  stub(g, 'CrackPassword', 0);
  stub(g, 'CrackPassword', 1);
  sessionTick(g, 20);
  assert.equal(s.proxyBypassed, false);
  assert.ok(Math.abs(s.traceRate - 0.01 / 0.65) < 1e-12);
  assert.ok(h.services.filter((v) => v.kind === 'proxy').every((v) => !v.open));
  h.firewall = 2;
  s.tasks = [];
  stub(g, 'BypassFirewall', 0);
  stub(g, 'CrackPassword', 1);
  stub(g, 'CrackPassword', 2);
  sessionTick(g, 20);
  assert.ok(!s.tasks.some((t) => t.kind === 'BypassFirewall'));
});

test('an overload that eases before twenty seconds costs nothing', () => {
  const { g } = online(() => true);
  const s = g.session;
  s.fwBypassed = true;
  stub(g, 'CrackPassword', 0);
  stub(g, 'CrackPassword', 1);
  sessionTick(g, 15);
  s.tasks.pop();
  sessionTick(g, 15);
  stub(g, 'CrackPassword', 1);
  sessionTick(g, 15);
  assert.equal(s.fwBypassed, true, 'the clock restarted when the load eased');
  assert.equal(s.alerted, false);
});
