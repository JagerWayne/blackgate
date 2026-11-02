// Regression tests for the bugs the code audit found: each fails on the old code.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { connect, sessionTick } from '../src/systems/sessionTick.js';
import { startTask, taskError } from '../src/systems/sessionTasks.js';
import { onMinutes } from '../src/systems/clockTick.js';
import { traceFactor } from '../src/state/gateway.js';
import { acceptContract } from '../src/state/contracts.js';

await initContent();

/// A live link to the first host that passes `pick`, with tools installed and
/// enough processors for several tasks at once.
function online(pick, tools) {
  const g = makeGame('AUDIT', 7);
  Object.entries(tools).forEach(([kind, level]) => {
    g.player.tools = g.player.tools.filter((t) => t.kind !== kind);
    g.player.tools.push({ kind, level });
  });
  for (let i = 0; i < 3; i += 1) g.player.gateway.parts.push({ kind: 'cpu', level: 1, name: 'extra' });
  const h = g.world.hosts.find(pick);
  assert.ok(h, 'the world has such a host');
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  return { g, h };
}

const finish = (g) => {
  for (let i = 0; i < 300 && g.session.tasks.length; i += 1) sessionTick(g, 1);
  assert.equal(g.session.tasks.length, 0, 'the tasks finished');
};

test('a proxy can be scrubbed only once', () => {
  const { g } = online((x) => x.proxy > 0, { ProxyBypass: 5 });
  assert.equal(startTask(g, 'BypassProxy'), null);
  assert.ok(taskError(g, g.session, 'BypassProxy'), 'not twice at once');
  finish(g);
  const rate = g.session.traceRate;
  assert.ok(taskError(g, g.session, 'BypassProxy'), 'not again afterwards');
  assert.equal(g.session.traceRate, rate);
});

test('the same lock or file is not worked on by two tasks at once', () => {
  const { g, h } = online((x) => x.services.some((v) => v.kind !== 'voice' && !v.open && v.password > 0) && x.files.some((f) => !f.deleted), { PasswordCracker: 5, FileDeleter: 5 });
  const lock = h.services.findIndex((v) => v.kind !== 'voice' && !v.open && v.password > 0);
  assert.equal(startTask(g, 'CrackPassword', lock), null);
  assert.ok(taskError(g, g.session, 'CrackPassword', lock), 'one crack per lock');
  const file = h.files.findIndex((f) => !f.deleted);
  assert.equal(startTask(g, 'DeleteFile', file), null);
  assert.ok(taskError(g, g.session, 'DeleteFile', file), 'one delete per file');
});

test('a person with no company is not staff of an independent host', () => {
  const { g } = online((x) => x.company == null, { OsintSweep: 3 });
  const civilian = g.world.people.findIndex((p) => p.company == null);
  assert.ok(civilian >= 0, 'the world has a civilian');
  assert.ok(taskError(g, g.session, 'Profile', civilian), 'refused');
});

test('asking whether a task can run does not put the person on file', () => {
  const { g, h } = online((x) => x.company != null, { OsintSweep: 3 });
  const i = g.world.people.findIndex((p) => p.company === h.company);
  taskError(g, g.session, 'Profile', i);
  assert.equal(g.intel?.[i], undefined);
});

test('the best security part counts, not the last one fitted', () => {
  const g = makeGame('AUDIT', 7);
  const gw = g.player.gateway;
  const sec = (level) => ({ kind: 'security', level, name: 's' });
  gw.parts = gw.parts.filter((p) => p.kind !== 'security');
  gw.parts.push(sec(1));
  const low = traceFactor(gw);
  gw.parts.push(sec(4), sec(1));
  assert.ok(traceFactor(gw) < low, 'a later weaker part does not undo the strong one');
});

test('a job that is already done when it is taken is ready at once', () => {
  const g = makeGame('AUDIT', 7);
  const c = g.contracts.find((x) => x.state === 'offered');
  const h = g.world.hosts[c.target];
  c.kind = 'delete';
  c.file = h.files[0].name;
  h.files.filter((f) => f.name === c.file).forEach((f) => { f.deleted = true; });
  assert.equal(acceptContract(g, c.id), true);
  assert.equal(c.state, 'ready');
});

test('a target that is also a hop leaves one log, not two', () => {
  const g = makeGame('AUDIT', 7);
  const h = g.world.hosts.find((x) => x.company != null);
  const opens = () => h.logs.filter((l) => l.text === 'session open').length;
  const before = opens();
  assert.equal(connect(g, h.id), null);
  g.session.route = [h.id]; // the target is also a hop
  sessionTick(g, 999);
  assert.equal(opens() - before, 1);
});

test('a news headline is not skipped when the clock moves several minutes at once', () => {
  const g = makeGame('AUDIT', 7);
  g.clock.minutes = 100; // 97 lies inside the five minutes that just passed
  onMinutes(g, 5);
  assert.equal(g.news.at(-1)?.minute, 100);
});
