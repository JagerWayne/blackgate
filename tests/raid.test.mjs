// The raid: what happens when the heat reaches 100, for each security part.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentDef } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { heatTick } from '../src/systems/heatTick.js';

await initContent();

/// A run at 100 heat with one security part of a tier (0: none), a staged
/// file and a live trace, on the starting chassis.
function raided(tier) {
  const g = makeGame('RAID', 7);
  g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'security');
  if (tier) g.player.gateway.parts.push({ kind: 'security', level: tier, name: componentDef('security', tier).name });
  g.player.storage = [{ name: 'loot.db', size: 4, enc: 0, tag: 0, source: 'x' }];
  g.player.heat = 100;
  heatTick(g, 0);
  return g;
}

test('no security part: the raid ends the run', () => {
  const g = raided(0);
  assert.equal(g.gameOver, 'raided');
});

test('no security part, but a chassis with an emergency purge: the drives burn, the run goes on', () => {
  const g = makeGame('RAID', 7);
  g.player.gateway.chassis = 4; // the chassis with emergency_purge
  g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'security');
  g.player.storage = [{ name: 'loot.db', size: 4, enc: 0, tag: 0, source: 'x' }];
  g.player.heat = 100;
  heatTick(g, 0);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.storage.length, 0);
  assert.equal(g.player.heat, 45);
});

test('a tier 4 chassis with shield-only security: the shield absorbs, the purge does not fire', () => {
  for (const tier of [1, 2]) {
    const g = makeGame('RAID', 7);
    g.player.gateway.chassis = 4; // the chassis with emergency_purge
    g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'security');
    g.player.gateway.parts.push({ kind: 'security', level: tier, name: componentDef('security', tier).name });
    g.player.storage = [{ name: 'loot.db', size: 4, enc: 0, tag: 0, source: 'x' }];
    g.player.heat = 100;
    heatTick(g, 0);
    assert.equal(g.gameOver, null, `tier ${tier}`);
    assert.equal(g.player.heat, 100 - componentDef('security', tier).raid_shield * 100);
    assert.equal(g.player.storage.length, 1, 'no file is wiped');
  }
});

test('a shield-only part (tiers 1 and 2) absorbs its share and the run goes on', () => {
  for (const tier of [1, 2]) {
    const g = raided(tier);
    const shield = componentDef('security', tier).raid_shield;
    assert.equal(g.gameOver, null, `tier ${tier}`);
    assert.equal(g.player.heat, 100 - shield * 100, `tier ${tier} leaves the unabsorbed heat`);
    assert.equal(g.player.storage.length, 1, 'nothing is burned');
  }
});

test('tier 3 (PURGE): the drives burn and the heat drops to 45', () => {
  const g = raided(3);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.storage.length, 0, 'the staged files are destroyed');
  assert.equal(g.player.heat, 45);
});

test('tier 4 (DECOY): the search finds nothing and the heat goes to 0', () => {
  const g = raided(4);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 0);
  assert.equal(g.player.storage.length, 1, 'nothing is burned');
});

test('tier 5 (EMP): the heat goes to 0', () => {
  const g = raided(5);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 0);
});
