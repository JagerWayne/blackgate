// Close calls, the runaway trace and the burn button.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { connect, disconnect, sessionTick, burn } from '../game/systems/sessionTick.js';

await initContent();

function online() {
  const g = makeGame('RISK', 5);
  const h = g.world.hosts.find((x) => !x.internal);
  assert.equal(connect(g, h.id), null);
  g.session.phase = 'online';
  g.session.traceRate = 0.01;
  return { g, h };
}

test('slipping away at a high trace pays once per host', () => {
  const { g, h } = online();
  g.session.alerted = true;
  g.session.trace = 0.8;
  const before = g.player.credits;
  disconnect(g);
  assert.ok(g.player.credits > before, 'paid');
  connect(g, h.id);
  g.session.alerted = true;
  g.session.trace = 0.8;
  const again = g.player.credits;
  disconnect(g);
  assert.equal(g.player.credits, again, 'not twice on the same host');
});

test('a low trace pays nothing and an unalerted link counts as a ghost run', () => {
  const { g } = online();
  const before = g.player.credits;
  disconnect(g);
  assert.equal(g.player.credits, before);
  assert.equal(g.stats.ghostRuns, 1);
});

test('the trace runs faster near the end', () => {
  const rise = (from) => {
    const { g } = online();
    g.session.alerted = true;
    g.session.trace = from;
    sessionTick(g, 1);
    return g.session.trace - from;
  };
  assert.ok(rise(0.9) > rise(0.3));
});

test('burn drops the tasks, costs heat, slows the trace and works once', () => {
  const { g } = online();
  g.session.alerted = true;
  g.session.tasks.push({ kind: 'CopyFile', progress: 0, dur: 99, lane: 1, label: 'x' });
  const heat = g.player.heat;
  const free = (() => { const o = online(); o.g.session.alerted = true; sessionTick(o.g, 1); return o.g.session.trace; })();
  assert.equal(burn(g), null);
  assert.equal(g.session.tasks.length, 0);
  assert.ok(g.player.heat > heat);
  sessionTick(g, 1);
  assert.ok(g.session.trace < free, 'slower than an unburned link');
  assert.ok(burn(g), 'not twice');
});

test('a loud task held long enough makes the admin notice, warning first', () => {
  const { g } = online();
  g.session.alerted = true;
  g.session.tasks.push({ kind: 'CopyFile', progress: 0, dur: 999, lane: 1, label: 'x', loud: true });
  const rate = g.session.traceRate;
  for (let i = 0; i < 50 && g.session.noticing === undefined; i += 1) sessionTick(g, 1);
  assert.ok(g.session.noticing > 0, 'warned');
  assert.equal(g.session.traceRate, rate, 'not yet faster');
  for (let i = 0; i < 5; i += 1) sessionTick(g, 1);
  assert.equal(g.session.traceRate, rate * 2);
});

test('a blind monitor keeps the admin away', () => {
  const { g } = online();
  g.session.alerted = true;
  g.session.monBypassed = true;
  g.session.tasks.push({ kind: 'CopyFile', progress: 0, dur: 999, lane: 1, label: 'x', loud: true });
  for (let i = 0; i < 50; i += 1) sessionTick(g, 1);
  assert.equal(g.session.noticing, undefined);
});

test('traits come only on hard hosts and are stable', async () => {
  const { traitOf } = await import('../game/data/traits.js');
  const g = makeGame('RISK', 5);
  g.world.hosts.forEach((h) => {
    const hard = h.firewall + h.monitor + h.proxy >= 5;
    assert.equal(traitOf(h) !== null, hard);
    assert.equal(traitOf(h), traitOf(h));
  });
});
