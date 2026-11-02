// The raid: what happens when the heat reaches 100, for each security part.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, chassis, components } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { heatTick } from '../src/systems/heatTick.js';

await initContent();

/// The shop's two security parts, and two failsafes no shop part carries yet:
/// they stay tested through parts added only for these tests.
const SENSORS = 1;
const THERMITE = 2;
const base = components().find((d) => d.kind === 'security');
const extra = (tier, failsafe) => {
  components().push({ ...base, tier, name: `TEST ${failsafe}`, failsafe, raid_shield: 0.6, defense: failsafe });
  return tier;
};
const DECOY = extra(90, 'DECOY');
const EMP = extra(91, 'EMP');
test.after(() => {
  const list = components();
  [DECOY, EMP].forEach((tier) => list.splice(list.findIndex((d) => d.tier === tier && d.kind === 'security'), 1));
});

/// A run at 100 heat on a chassis, with at most one security part (0: none),
/// a staged file and a live trace.
function raided(tier, chassisTier = 4) {
  const g = makeGame('RAID', 7);
  g.player.gateway.chassis = chassisTier;
  g.player.gateway.parts = g.player.gateway.parts.filter((p) => p.kind !== 'security');
  if (tier) g.player.gateway.parts.push({ kind: 'security', level: tier, name: 'part' });
  g.player.storage = [{ name: 'loot.db', size: 4, enc: 0, tag: 0, source: 'x' }];
  g.player.heat = 100;
  heatTick(g, 0);
  return g;
}

test('no security part: the raid ends the run', () => {
  const g = raided(0);
  assert.equal(g.gameOver, 'raided');
});

test('a chassis with an emergency purge and no security part: the drives burn, the run goes on', () => {
  const def = chassis().find((c) => c.tier === 4);
  def.emergency_purge = true;
  try {
    const g = raided(0);
    assert.equal(g.gameOver, null);
    assert.equal(g.player.storage.length, 0);
    assert.equal(g.player.heat, 45);
  } finally {
    def.emergency_purge = false;
  }
});

test('the perimeter sensors absorb their share and the run goes on', () => {
  const g = raided(SENSORS);
  const shield = components().find((d) => d.kind === 'security' && d.tier === SENSORS).raid_shield;
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 100 - shield * 100, 'the unabsorbed heat is left');
  assert.equal(g.player.storage.length, 1, 'nothing is burned');
});

test('the thermite core melt (PURGE): the drives burn and the heat drops to 45', () => {
  const g = raided(THERMITE);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.storage.length, 0, 'the staged files are destroyed');
  assert.equal(g.player.heat, 45);
});

test('a decoy failsafe: the search finds nothing and the heat goes to 0', () => {
  const g = raided(DECOY);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 0);
  assert.equal(g.player.storage.length, 1, 'nothing is burned');
});

test('an EMP failsafe: the heat goes to 0', () => {
  const g = raided(EMP);
  assert.equal(g.gameOver, null);
  assert.equal(g.player.heat, 0);
});
