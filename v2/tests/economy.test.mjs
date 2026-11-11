// The economy makes sense over a whole run: prices climb with the version, pay
// climbs with rating and difficulty, the whole catalogue costs about what a
// 15-hour run earns, the early game can afford its first steps, and the running
// costs stay a small bite that grows with the rig.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { baseReward } from '../game/state/contractPost.js';
import { upkeepPerDay, rigValue, billDay, collectArrears } from '../game/state/upkeep.js';
import { bankTick } from '../game/state/finance.js';
import { MINUTES_PER_DAY } from '../game/core/clock.js';
import { TARGET_HOURS, JOBS_PER_HOUR, meanPay, income, coreCost, catalogue, endRig, billsOver, rigValueAt, levelAt } from '../tools/economy.mjs';

await initContent();

const data = (f) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8'));
const software = data('software').software ?? data('software');
const hardware = data('hardware');

test('every tool version costs more than the one before it', () => {
  for (const d of software) {
    const prices = d.prices ?? [d.price];
    prices.forEach((p, i) => i && assert.ok(p > prices[i - 1], `${d.kind} v${i + 1} costs more than v${i}`));
    assert.equal(prices[0], d.price, `${d.kind}'s base price is its first version`);
  }
});

test('processors, boosters, fibre and cases climb with their tier', () => {
  for (const kind of ['cpu', 'accel', 'modem']) {
    const parts = hardware.components.filter((c) => c.kind === kind).sort((a, b) => a.tier - b.tier);
    parts.forEach((c, i) => i && assert.ok(c.price > parts[i - 1].price, `${kind} tier ${c.tier} costs more than the one below`));
  }
  const cases = [...hardware.chassis].sort((a, b) => a.tier - b.tier);
  cases.forEach((c, i) => i && assert.ok(c.price > cases[i - 1].price, `${c.name} costs more than the case below`));
});

test('pay climbs with the rating and with the difficulty', () => {
  for (const kind of ['retrieve', 'delete', 'modify', 'destroy']) {
    assert.ok(baseReward(kind, 3, 50) > baseReward(kind, 3, 0), `${kind} pays more at a higher rating`);
    assert.ok(baseReward(kind, 6, 20) > baseReward(kind, 2, 20), `${kind} pays more against a harder host`);
  }
  assert.equal(Math.round(baseReward('retrieve', 0, 100) / baseReward('retrieve', 0, 0)), 2, 'rating 100 doubles the pay');
  assert.equal(baseReward('retrieve', 0, 250), baseReward('retrieve', 0, 100), 'rating stops counting at 100');
});

test('the whole catalogue, the end rig and the running costs come to about what a 15 hour run earns', () => {
  const earned = income(TARGET_HOURS * JOBS_PER_HOUR);
  const cost = catalogue() + endRig() + billsOver();
  assert.ok(cost / earned > 0.85 && cost / earned < 1.1, `costs are ${(cost / earned).toFixed(2)} of the income`);
});

test('the early game can afford its next step, and the kit gets easier to afford as the run goes on', () => {
  const ceiling = { 2: 5.5, 3: 3, 4: 1.6, 5: 1.4, 6: 0.8, 7: 0.5 };
  let last = Infinity;
  for (const [level, rating] of [[2, 6], [3, 16], [4, 30], [5, 48], [6, 70], [7, 100]]) {
    const ratio = coreCost(levelAt(rating)) / income(rating + 1);
    assert.ok(ratio <= ceiling[level], `level ${level}: the kit is ${ratio.toFixed(2)} of the income so far`);
    assert.ok(ratio <= last + 1e-9, `level ${level} is no harder to afford than the one before`);
    last = ratio;
  }
  assert.ok(meanPay(100) > 5 * meanPay(0), 'late jobs pay several times the first ones');
});

test('the running costs grow with the rig and stay a small share of the day\'s pay', () => {
  assert.ok(upkeepPerDay(100000) > upkeepPerDay(10000) && upkeepPerDay(10000) > upkeepPerDay(0));
  const jobsPerDay = JOBS_PER_HOUR / (3600 / 1.4 / MINUTES_PER_DAY);
  for (const [rating, share] of [[3, 0], [30, 0.35], [70, 0.7], [100, 1]]) {
    const bill = upkeepPerDay(rigValueAt(share));
    assert.ok(bill < 0.15 * meanPay(rating) * jobsPerDay, `at rating ${rating} the bill is ${bill} of ${Math.round(meanPay(rating) * jobsPerDay)} a day`);
  }
});

test('the tutorial is free of running costs, then a day costs what the rig says', () => {
  const g = makeGame('UPKEEP', 7, { bare: true });
  g.player.credits = 5000;
  const before = g.player.credits;
  billDay(g);
  assert.equal(g.player.credits, before, 'no bill during the tutorial');
  g.tutorial.on = false;
  billDay(g);
  assert.equal(g.player.credits, before - upkeepPerDay(rigValue(g)), 'a day is billed once it is over');
});

test('what the balance cannot cover waits as arrears and is taken from the next credits', () => {
  const g = makeGame('ARREARS', 7, { bare: true });
  g.tutorial.on = false;
  g.player.credits = 10;
  bankTick(g);
  billDay(g);
  const due = upkeepPerDay(rigValue(g));
  assert.equal(g.player.credits, 0, 'the balance pays what it can');
  assert.equal(g.bank.arrears, due - 10, 'the rest is owed');
  g.player.credits = 1000;
  collectArrears(g);
  assert.equal(g.bank.arrears, 0, 'a payment settles the arrears');
  assert.equal(g.player.credits, 1000 - (due - 10));
});

test('a day passing on the clock bills the operator', () => {
  const g = makeGame('CLOCK', 7, { bare: true });
  g.tutorial.on = false;
  g.player.credits = 4000;
  bankTick(g); // the bank opens on day 0
  g.clock.minutes = MINUTES_PER_DAY * 3 + 5;
  bankTick(g);
  assert.ok(g.player.credits < 4000, 'days that went by were billed');
});
