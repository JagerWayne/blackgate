// Perks, the daily world and their effect on the numbers.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { perk, perkOffer, choosePerk, PERK_EVERY } from '../game/state/perks.js';
import { dailySeed, dailyMod } from '../game/state/daily.js';
import { saveRun, loadRun } from '../game/state/save.js';

await initContent();

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

test('a perk is offered every few jobs, taken once, and changes the numbers', () => {
  const g = makeGame('PERK', 4);
  assert.equal(perkOffer(g).length, 0);
  g.stats.missionsDone = PERK_EVERY;
  const offer = perkOffer(g);
  assert.equal(offer.length, 3);
  assert.equal(choosePerk(g, offer[0].id), null);
  assert.equal(perkOffer(g).length, 0, 'the next one is further off');
  assert.ok(choosePerk(g, offer[0].id), 'not twice');
  assert.notEqual(perk(g, 'trace') * perk(g, 'pay') * perk(g, 'dur'), 1);
});

test('the daily seed is stable within a day and its modifier is applied', () => {
  const d = new Date('2026-11-07T10:00:00Z');
  assert.equal(dailySeed(d), dailySeed(new Date('2026-11-07T23:00:00Z')));
  assert.notEqual(dailySeed(d), dailySeed(new Date('2026-11-08T10:00:00Z')));
  const g = makeGame('DAILY', dailySeed(d));
  g.mod = dailyMod(dailySeed(d));
  assert.equal(perk(g, 'trace', 10), 10 * (g.mod.tweaks.trace ?? 1));
});

test('perks and the modifier survive a save', () => {
  const g = makeGame('KEEP', 9);
  g.stats.missionsDone = PERK_EVERY;
  choosePerk(g, perkOffer(g)[0].id);
  g.mod = dailyMod(9);
  saveRun(g);
  const back = loadRun('KEEP');
  assert.deepEqual(back.perks.map((p) => p.id), g.perks.map((p) => p.id));
  assert.equal(back.mod.id, g.mod.id);
});
