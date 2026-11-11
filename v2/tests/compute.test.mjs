// Compute (M2): accelerators and the FPGA speed the crypto tasks up, every task takes
// thread slots, and only as many tasks as the slots hold are processing while the rest wait.
import { roomy } from './roomy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentsOf } from '../game/data/content.js';
import { HW_KINDS } from '../game/data/enums.js';
import { makeGame } from '../game/state/gameState.js';
import { buyComponent } from '../game/state/economy.js';
import * as gw from '../game/state/gateway.js';
import { connect, sessionTick } from '../game/systems/sessionTick.js';
import { startTask, taskError } from '../game/systems/sessionTasks.js';
import { schedule, demand, waiting } from '../game/systems/compute.js';

await initContent();

/// A live link to the first host that passes `pick`, on the starter Pelican (one
/// Gen 1 socket: two thread slots), with the tools installed.
function online(pick, tools = {}) {
  const g = roomy(makeGame('COMPUTE', 7));
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
  assert.deepEqual(HW_KINDS, ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security']);
  assert.deepEqual(componentsOf('accel').map((d) => d.multiplier), [1.5, 2.5, 3.5, 5]);
  assert.deepEqual(componentsOf('accel').map((d) => d.price), [4500, 9000, 15000, 24000]);
  assert.deepEqual(componentsOf('fpga').map((d) => [d.multiplier, d.price]), [[3, 35000]]);
});

test('the FPGA needs a board that can take silicon, a booster needs a card slot', () => {
  const g = makeGame('COMPUTE', 7);
  g.player.credits = 1e9;
  const [card] = componentsOf('accel');
  const [fpga] = componentsOf('fpga');
  assert.ok(gw.fitPlan(g.player.gateway, card).why, 'no card slot on the Micro PC');
  assert.ok(gw.fitPlan(g.player.gateway, fpga).why, 'no FPGA slot on the Micro PC');
  g.player.gateway.chassis = 2;
  g.player.gateway.board = 2;
  assert.equal(gw.fitPlan(g.player.gateway, card).why, '', 'a Mini-ITX board has a card slot');
  assert.ok(gw.fitPlan(g.player.gateway, fpga).why, 'but no FPGA slot');
  g.player.gateway.chassis = 4;
  g.player.gateway.board = 4;
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
  schedule(g, s);
  assert.equal(demand(g, s), 1, 'one slot used');
  stub(g, 'CrackPassword', 1); // two more slots wanted, one left: it waits
  schedule(g, s);
  assert.deepEqual(s.tasks.map((t) => t.queued), [false, true]);
  assert.equal(demand(g, s), 1);
  assert.equal(waiting(s), 1);
});

test('any number of tasks may be started, up to the queue limit, and the rest wait', () => {
  const { g } = online(() => true, { OsintSweep: 3 });
  const s = g.session;
  for (let i = 0; i < 8; i += 1) assert.equal(startTask(g, 'OsintSweep'), null);
  assert.equal(s.tasks.filter((t) => !t.queued).length, 2, 'only the two slots are processing');
  assert.equal(taskError(g, s, 'OsintSweep'), 'task queue full');
  assert.equal(startTask(g, 'OsintSweep'), 'task queue full');
});

test('an FPGA decryption takes no thread slot', () => {
  const { g, h } = online((x) => x.files.some((f) => f.enc > 0 && f.enc <= 3 && !f.deleted), { Decrypter: 3 });
  const i = h.files.findIndex((f) => f.enc > 0 && f.enc <= 3 && !f.deleted);
  stub(g, 'CrackPassword', 0);
  stub(g, 'CrackPassword', 1);
  fit(g, 'fpga', 1);
  assert.equal(startTask(g, 'DecryptFile', i), null);
  assert.equal(g.session.tasks.at(-1).queued, false, 'the FPGA decrypts beside a full machine');
});

test('only the tasks the slots hold make progress; a waiting one starts when a slot frees', () => {
  const { g } = online(() => true);
  const s = g.session;
  stub(g, 'CrackPassword', 0); // takes both slots
  stub(g, 'WipeLogs', 1);
  sessionTick(g, 1);
  assert.ok(s.tasks[0].progress > 0, 'the first runs');
  assert.equal(s.tasks[1].progress, 0, 'the second waits');
  s.tasks[0].progress = 1;
  sessionTick(g, 1);
  assert.equal(s.tasks.length, 1);
  sessionTick(g, 1);
  assert.ok(s.tasks[0].progress > 0, 'it runs once the slot is free');
});
