// The physical trace (M3): the sensor bands, the 15-second Red countdown, and the
// counter-measures: the RF jammer, the thermite reset, the Van's relocation and the
// VPS that wipes its files instead of ending the run.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, components, chassis } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { heatTick } from '../game/systems/heatTick.js';
import { band, relocate } from '../game/systems/physical.js';
import { connect, sessionTick, disconnect } from '../game/systems/sessionTick.js';
import { timeScale } from '../game/state/cheats.js';
import * as gw from '../game/state/gateway.js';

await initContent();

const sensors = components().find((d) => d.kind === 'security' && d.hud);
const jammer = components().find((d) => d.kind === 'security' && d.jammer);
const thermite = components().find((d) => d.kind === 'security' && d.failsafe === 'PURGE');
// a sensor suite that absorbs nothing, so the end of a countdown ends the run
const BARE = 92;
components().push({ ...sensors, tier: BARE, name: 'TEST BARE SENSORS', raid_shield: 0 });
test.after(() => {
  const list = components();
  list.splice(list.findIndex((d) => d.tier === BARE && d.kind === 'security'), 1);
});

/// A run on a chassis with the given security parts fitted.
function rig(chassisTier, ...tiers) {
  const g = makeGame('PHYSICAL', 7);
  g.player.gateway.chassis = chassisTier;
  g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'security');
  tiers.forEach((level) => g.player.gateway.parts.push({ kind: 'security', level, name: 'part' }));
  g.player.storage = [{ name: 'loot.db', size: 4, enc: 0, tag: 0, source: 'x' }];
  return g;
}

/// A live link that has just been traced to the end.
function trace(g) {
  connect(g, g.world.hosts[0].id);
  g.session.phase = 'online';
  g.session.trace = 1;
  sessionTick(g, 0);
  return g;
}

/// The heat one link leaves behind: it wipes nothing, so its log counts.
function leave(g) {
  const target = g.world.hosts.find((x) => x.company != null);
  connect(g, target.id);
  g.session.phase = 'online';
  target.logs.push({ minute: 0, ip: g.player.gateway.ip, text: 'x', loud: true });
  disconnect(g);
  return g.player.heat;
}

test('the catalogue marks the VPS, the Van and the Pelican\'s surge protector', () => {
  const by = (t) => chassis().find((c) => c.tier === t);
  assert.equal(by(2).vps, true);
  assert.equal(by(7).mobile, true);
  assert.equal(by(1).base_shield, 0.15);
  assert.equal(gw.raidShield(rig(1).player.gateway), 0.15, 'a bare Pelican still absorbs a little');
  assert.ok(sensors && jammer && thermite);
});

test('the sensors show Green below 70, Yellow from 70 and Red in the countdown; none without them', () => {
  const g = rig(3, sensors.tier);
  g.player.heat = 40;
  assert.equal(band(g), 'green');
  g.player.heat = 70;
  assert.equal(band(g), 'yellow');
  g.player.heat = 99;
  assert.equal(band(g), 'yellow');
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(band(g), 'red');
  const bare = rig(3);
  bare.player.heat = 80;
  assert.equal(band(bare), null);
});

test('without sensors the raid lands at once, as it always did', () => {
  const g = rig(4);
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(g.gameOver, 'raided');
  assert.ok(!g.raid);
});

test('Red gives fifteen seconds at 1x and then the raid lands', () => {
  const g = rig(3, BARE);
  g.settings.timeScale = 8;
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(g.raid.left, 15);
  assert.equal(timeScale(g), 1, 'the clock speed is forced to 1x');
  heatTick(g, 14);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 100, 'the heat does not cool during the countdown');
  heatTick(g, 1);
  assert.equal(g.gameOver, 'raided');
  assert.equal(g.raid, null);
  assert.equal(timeScale(g), 8);
});

test('the RF jammer adds 45 seconds to the countdown', () => {
  const g = rig(4, BARE, jammer.tier);
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(g.raid.left, 60);
  heatTick(g, 59);
  assert.equal(g.gameOver, null);
  heatTick(g, 1);
  assert.equal(g.gameOver, 'raided');
});

test('after a jammed raid, the next 6 hours leave heat at twice the rate', () => {
  const g = rig(4, BARE, jammer.tier);
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(g.player.rfUntil, g.clock.minutes + 360);
  const plain = leave(makeGame('PHYSICAL', 7));
  const loud = makeGame('PHYSICAL', 7);
  loud.player.rfUntil = loud.clock.minutes + 360;
  assert.ok(Math.abs(leave(loud) - 2 * plain) < 1e-9);
});

test('the thermite melt voids the warrant: a starter rig, empty drives, credits and tools kept', () => {
  const g = rig(4, thermite.tier);
  g.player.credits = 12345;
  const tools = g.player.tools.length;
  g.player.stock = [{ kind: 'modem', level: 1, name: 'old', pct: 40, value: 300 }];
  g.player.heat = 100;
  heatTick(g, 0);
  assert.ok(!g.raid, 'the part has no sensors: the raid lands at once');
  assert.equal(g.gameOver, null);
  assert.equal(g.player.gateway.chassis, 1);
  assert.deepEqual(g.player.gateway.parts.map((p) => p.kind), ['cpu', 'storage', 'storage', 'modem']);
  assert.equal(g.player.gateway.board, 1);
  assert.equal(g.player.storage.length, 0);
  assert.equal(g.player.heat, 0);
  assert.equal(g.player.credits, 12345);
  assert.equal(g.player.tools.length, tools);
  assert.equal(g.player.stock.length, 1);
});

test('the Van drives away from a Yellow investigation, once a day', () => {
  const g = rig(7);
  assert.equal(relocate(g), 'no investigation to escape');
  g.player.heat = 75;
  assert.equal(relocate(g), null);
  assert.equal(g.player.heat, 0);
  assert.equal(g.player.gateway.migrateUntil, g.clock.minutes + 120, 'two hours on the road');
  g.player.heat = 80;
  assert.match(relocate(g), /day/);
  g.clock.minutes += 1440;
  g.player.gateway.migrateUntil = 0;
  assert.equal(relocate(g), null);
});

test('only a mobile rig with no open link can relocate', () => {
  const g = rig(3);
  g.player.heat = 80;
  assert.equal(relocate(g), 'only the Mobile C2 Van can move');
  const v = rig(7);
  v.player.heat = 80;
  connect(v, v.world.hosts[0].id);
  assert.equal(relocate(v), 'close the link first');
});

test('a trace that completes on the VPS wipes the files and the run goes on', () => {
  const g = trace(rig(2));
  assert.equal(g.gameOver, null);
  assert.equal(g.session, null);
  assert.equal(g.player.storage.length, 0);
  assert.ok(g.player.credits > 0);
});

test('a trace that completes anywhere else still ends the run', () => {
  assert.equal(trace(rig(3)).gameOver, 'caught');
});

test('a wiped file takes its job back to the accepted state', () => {
  const g = rig(2);
  const c = g.contracts.find((x) => x.kind === 'retrieve');
  c.state = 'ready';
  g.player.storage = [{ name: c.file, size: 4, enc: 0, tag: c.id, source: 'x' }];
  trace(g);
  assert.equal(c.state, 'accepted');
});
