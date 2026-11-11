// The economy report: what a job pays, what the catalogue costs and how the two
// line up over a run. Read-only; run it before and after touching a price or a
// payout:  node tools/economy.mjs
//
// The model: rating rises by one a job, the rating unlocks guard level n at the
// ratings in data/unlocks.json, a target's guard is the mean of the hosts that
// level allows (counted on a generated world), and
// the operator does JOBS_PER_HOUR jobs an hour. It is a guide to the shape of
// the run, not a simulation: tests/economy.test.mjs keeps it honest.

import { readFileSync } from 'node:fs';
import { baseReward } from '../game/state/contractPost.js';
import { upkeepPerDay } from '../game/state/upkeep.js';

const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), 'utf8'));
const software = json('software').software ?? json('software');
const hardware = json('hardware');
const unlocks = json('unlocks').unlocks;

/// The pace the prices are tuned to.
export const TARGET_HOURS = 15;
export const JOBS_PER_HOUR = 12; // a job is the link, the work, the clean-up and the hand-in
const SWING = 1.05; // the mean of the 0.85 - 1.25 random swing
/// Game days in a real hour: a game day is 1440 minutes at 1.4 seconds a minute.
const DAYS_PER_HOUR = 3600 / 1.4 / 1440;

/// The guard level the board offers at a rating (the rule in state/contractTarget.js):
/// none before the second unlock, then one level a step. The world has no host
/// guarded past level 5.
export const levelAt = (rating) => (rating < unlocks[1].rating ? 0 : Math.min(unlocks.filter((u) => rating >= u.rating).length, 5));

/// How many corporate, bank, gov, AI and datacentre hosts have each top guard
/// level, and the guard sum (firewall + monitor + proxy) of such a host. Counted
/// on a generated world; targets are picked evenly among the hosts a rating allows.
const HOSTS = [[11, 0], [18, 1], [34, 4], [34, 7], [24, 10], [5, 13]];

/// The mean guard sum of a target at a guard level.
export function meanDifficulty(level) {
  const pool = HOSTS.slice(0, level + 1);
  return pool.reduce((n, [c, d]) => n + c * d, 0) / pool.reduce((n, [c]) => n + c, 0);
}

/// The kinds the board offers at a rating.
function kindsAt(rating) {
  const kinds = ['retrieve', 'retrieve', 'delete'];
  if (rating >= 8) kinds.push('modify');
  if (rating >= 20) kinds.push('destroy');
  return kinds;
}

/// The mean pay of a job at a rating.
export function meanPay(rating) {
  const d = meanDifficulty(levelAt(rating));
  const kinds = kindsAt(rating);
  return (kinds.reduce((n, k) => n + baseReward(k, d, rating), 0) / kinds.length) * SWING;
}

/// What the first `jobs` jobs pay in all.
export const income = (jobs) => Array.from({ length: jobs }, (_, j) => meanPay(j)).reduce((a, b) => a + b, 0);

/// The price of one tool version.
const priceOf = (kind, level) => {
  const d = software.find((x) => x.kind === kind);
  return d.prices?.[level - 1] ?? d.price;
};

/// The tools every operator needs, and the version each needs at a guard level.
export const CORE = {
  FileCopier: () => 1, FileDeleter: () => 1, LogDeleter: () => 1,
  PasswordCracker: (l) => Math.max(Math.min(l, 3), 1),
  FirewallBypass: (l) => Math.min(l, 5), MonitorBypass: (l) => Math.min(l, 5), ProxyBypass: (l) => Math.min(l, 5),
  Decrypter: (l) => Math.min(l, 5),
};

/// What the core kit costs at a guard level, counting every version bought on the way.
export function coreCost(level) {
  return Object.entries(CORE).reduce((n, [kind, at]) => {
    let sum = 0;
    for (let v = 1; v <= at(level); v += 1) sum += priceOf(kind, v);
    return n + sum;
  }, 0);
}

/// The whole software catalogue, every version.
export const catalogue = () => software.reduce((n, d) => n + (d.prices ?? [d.price]).reduce((a, b) => a + b, 0), 0);

/// The best rig a long run builds towards: the van, a board for it, the top
/// processor, accelerator, fibre, the FPGA, an HSM, the security parts and two
/// big drives.
export function endRig() {
  const by = (kind) => hardware.components.filter((c) => c.kind === kind).map((c) => c.price);
  const top = (kind) => Math.max(...by(kind));
  return Math.max(...hardware.chassis.map((c) => c.price)) + Math.max(...hardware.boards.map((b) => (typeof b === 'number' ? b : b.price)))
    + top('cpu') + top('accel') + top('modem') + top('fpga') + top('hsm') + by('security').reduce((a, b) => a + b, 0) + 2 * top('storage');
}

/// The value of the rig a player has built by a share of the run: it climbs from
/// the starter machine to the end rig.
export const rigValueAt = (share) => endRig() * share ** 1.6 * 0.6;

/// What the running costs come to over the run.
export function billsOver(hours = TARGET_HOURS) {
  const days = Math.round(hours * DAYS_PER_HOUR);
  return Array.from({ length: days }, (_, d) => upkeepPerDay(rigValueAt(d / days))).reduce((a, b) => a + b, 0);
}

if (process.argv[1] && process.argv[1].endsWith('economy.mjs')) {
  const jobs = TARGET_HOURS * JOBS_PER_HOUR;
  const n = (x) => Math.round(x).toLocaleString('en-US');
  console.log('PAY BY RATING (mean job)');
  for (const r of [0, 6, 16, 30, 48, 70, 100]) console.log(`  rating ${String(r).padStart(3)}  level ${levelAt(r)}  ${n(meanPay(r)).padStart(6)} cr`);
  console.log('\nCORE KIT AGAINST INCOME, at the job each guard level unlocks');
  console.log('  level  job#     income    core kit   kit/income');
  unlocks.forEach((u) => {
    const i = income(u.rating + 1);
    const c = coreCost(levelAt(u.rating));
    console.log(`  ${String(u.level).padStart(5)} ${String(u.rating).padStart(5)} ${n(i).padStart(10)} ${n(c).padStart(11)}   ${(c / i).toFixed(2)}`);
  });
  const total = income(jobs);
  console.log(`\nTHE RUN: ${jobs} jobs (${TARGET_HOURS} h at ${JOBS_PER_HOUR} an hour) earn ${n(total)} cr`);
  console.log(`  software catalogue ${n(catalogue())} cr = ${(catalogue() / total).toFixed(2)} of it`);
  console.log(`  end-game rig       ${n(endRig())} cr = ${(endRig() / total).toFixed(2)} of it`);
  console.log(`  running costs      ${n(billsOver())} cr over ${Math.round(TARGET_HOURS * DAYS_PER_HOUR)} game days = ${(billsOver() / total).toFixed(2)} of it`);
  console.log(`  everything         ${((catalogue() + endRig() + billsOver()) / total).toFixed(2)} of it`);
}
