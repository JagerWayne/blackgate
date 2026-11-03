// Bandwidth and exfiltration windows (M4): a copy takes size over the uplink, hard hosts
// close the link after 45-90 seconds, datastore dumps are too big for a slow line, and the
// modems differ in how easily they are traced.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { generateWorld } from '../src/data/world.js';
import * as gw from '../src/state/gateway.js';
import { exfilWindow, copyRate } from '../src/state/transfer.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { startTask } from '../src/systems/sessionTasks.js';

await initContent();

/// A live link (really negotiated) to a company host of the given difficulty,
/// holding one plain file of the given size.
function linked(difficulty, size = 100, chassis = 1) {
  const g = makeGame('TRANSFER', 7);
  g.player.gateway.chassis = chassis;
  const h = g.world.hosts.find((x) => x.company != null);
  h.firewall = Math.min(difficulty, 4);
  h.monitor = Math.min(Math.max(difficulty - 4, 0), 4);
  h.proxy = Math.max(difficulty - 8, 0);
  h.files.push({ name: 'dump_77.db', size, enc: 0, tag: 0, content: 'x', deleted: false });
  assert.equal(connect(g, h.id), null);
  sessionTick(g, 999);
  assert.equal(g.session.phase, 'online');
  return { g, h, file: h.files.length - 1 };
}

test('the window is 90 seconds at difficulty 6, 15 less a step, never under 45; none below 6', () => {
  const win = (d) => exfilWindow({ firewall: d, monitor: 0, proxy: 0 });
  assert.equal(win(5), null);
  assert.deepEqual([6, 7, 8, 9, 12].map(win), [90, 75, 60, 45, 45]);
});

test('a copy takes the size over the uplink', () => {
  const { g, h, file } = linked(0, 120);
  const rate = copyRate(g.player.gateway);
  assert.equal(rate, gw.bandwidth(g.player.gateway) / 1000 * 1.2);
  assert.equal(startTask(g, 'CopyFile', file), null);
  assert.ok(Math.abs(g.session.tasks[0].dur - 120 / rate) < 1e-9);
  assert.equal(h.files[file].size, 120);
});

test('a 1 Gbps uplink cannot move a datastore dump inside a 60 s window; 10 Gbps can', () => {
  const slow = linked(8, 300, 1);
  assert.equal(exfilWindow(slow.h), 60);
  startTask(slow.g, 'CopyFile', slow.file);
  assert.ok(slow.g.session.tasks[0].dur > 60, 'the Pelican needs minutes');
  const fast = linked(8, 300, 4);
  startTask(fast.g, 'CopyFile', fast.file);
  assert.ok(fast.g.session.tasks[0].dur < 60, 'a 10 Gbps rack makes it');
});

test('the link closes when the window runs out, and the copy under way is lost', () => {
  const { g, file } = linked(8, 300, 1);
  assert.equal(g.session.windowLeft, 60);
  startTask(g, 'CopyFile', file);
  sessionTick(g, 59);
  assert.ok(g.session, 'still open');
  sessionTick(g, 2);
  assert.equal(g.session, null);
  assert.equal(g.gameOver, null, 'a timeout is not a capture');
  assert.equal(g.player.storage.length, 0);
});

test('an easy host has no window', () => {
  const { g } = linked(2);
  assert.equal(g.session.windowLeft, undefined);
  sessionTick(g, 500);
  assert.ok(g.session || g.gameOver, 'only the trace can end it');
});

test('the modems differ in how easily they are traced', () => {
  const trace = (level) => {
    const g = makeGame('TRANSFER', 7);
    if (level) g.player.gateway.parts.push({ kind: 'modem', level });
    return gw.traceFactor(g.player.gateway);
  };
  assert.equal(trace(0), 1);
  assert.ok(trace(1) > 1 && trace(2) > 1, 'a fixed fibre line is easy to follow');
  assert.ok(trace(3) < 1, 'dark fibre is harder');
  assert.ok(trace(4) < trace(3), 'a dish has no wire to follow');
});

test('a LEO dish is triangulated after 120 seconds of activity', () => {
  const { g } = linked(0);
  g.player.gateway.parts.push({ kind: 'modem', level: 4 });
  const s = g.session;
  const rate = s.traceRate;
  sessionTick(g, 119);
  assert.equal(s.alerted, false);
  sessionTick(g, 2);
  assert.equal(s.alerted, true, 'the trace starts');
  assert.ok(s.traceRate > rate);
});

test('a dish-less line is never triangulated', () => {
  const { g } = linked(0);
  g.player.gateway.parts.push({ kind: 'modem', level: 3 });
  sessionTick(g, 300);
  assert.equal(g.session.alerted, false);
});

test('the world keeps one datastore dump on each hard host and its other files small', () => {
  for (let seed = 1; seed <= 6; seed += 1) {
    const world = generateWorld(seed);
    world.hosts.forEach((h) => {
      const hard = h.firewall + h.monitor + h.proxy >= 6;
      const dumps = h.files.filter((f) => f.size > 100);
      assert.equal(dumps.length, hard ? 1 : 0, `seed ${seed} ${h.name}`);
      dumps.forEach((f) => assert.ok(f.size >= 150 && f.size <= 450, `${f.size} GB`));
      h.files.filter((f) => f.size <= 100).forEach((f) => assert.ok(f.size >= 2));
    });
  }
});
