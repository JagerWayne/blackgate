// The crypto wallet: three coins from calm to wild. Prices step once an hour
// of game time, drawn from a hash of the world seed and the hour, so they
// need no generator state in the save.

import { refund, adjust, toast } from './gameHelpers.js';

/// Per coin: its risk, start price, hourly drift and swing.
export const COINS = [
  { id: 'STBL', name: 'StableNet', risk: 'LOW', start: 100, drift: 0.0001, vol: 0.004 },
  { id: 'BLUE', name: 'BlueChain', risk: 'MID', start: 250, drift: 0.0002, vol: 0.025 },
  { id: 'GHST', name: 'GhostCoin', risk: 'HIGH', start: 40, drift: 0, vol: 0.07, events: true },
];
export const FEE = 0.01;
const FLOOR = 1;
const HISTORY = 48;
// A wild coin pumps or crashes now and then. The odds and sizes make the
// average event slightly negative, so the events cannot be farmed.
const EVENT_CHANCE = 0.015;
const PUMP = { odds: 0.35, by: 2.2 };
const CRASH = 0.3;

/// A repeatable number in [0, 1) for a seed and two indexes.
function rand(seed, a, b) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(a + 1, 0xc2b2ae35) ^ Math.imul(b + 7, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 2 ** 32;
}

/// A fresh wallet state.
export function initCrypto(game) {
  const c = { hour: Math.floor(game.clock.minutes / 60), prices: {}, hist: {}, held: {}, cost: {} };
  COINS.forEach((k) => {
    c.prices[k.id] = k.start;
    c.hist[k.id] = [k.start];
    c.held[k.id] = 0;
    c.cost[k.id] = 0;
  });
  return c;
}

/// Runs the hourly price steps that are due.
export function cryptoCatchUp(game) {
  const c = game.bank.crypto;
  const target = Math.floor(game.clock.minutes / 60);
  for (let n = 0; c.hour < target && n < 500; n += 1) {
    c.hour += 1;
    COINS.forEach((k, i) => step(game, c, k, i));
  }
  c.hour = Math.max(c.hour, target);
}

function step(game, c, k, i) {
  const seed = game.seed ?? 0;
  const swing = (rand(seed, c.hour, i * 3) + rand(seed, c.hour, i * 3 + 1) - 1) * 1.7;
  let p = c.prices[k.id] * (1 + k.drift + k.vol * swing);
  if (k.events && rand(seed, c.hour, i * 3 + 2) < EVENT_CHANCE) {
    const up = rand(seed, c.hour + 100000, i) < PUMP.odds;
    p *= up ? PUMP.by : CRASH;
    game.news.push({
      minute: game.clock.minutes,
      headline: up ? `${k.name} rockets on rumours` : `${k.name} collapses in a sell-off`,
      body: up ? 'Traders pile in; analysts urge caution.' : 'Holders rush for the exit as the price falls away.',
    });
    if (game.news.length > 40) game.news.shift();
    toast(game, `${k.id} ${up ? 'pumps' : 'crashes'}`, up ? 'good' : 'bad');
  }
  c.prices[k.id] = Math.max(p, FLOOR);
  c.hist[k.id].push(c.prices[k.id]);
  if (c.hist[k.id].length > HISTORY) c.hist[k.id].shift();
}

/// Buys `amount` credits' worth of a coin, less the fee.
export function buyCoin(game, id, amount) {
  const c = game.bank.crypto;
  const n = Math.floor(Number(amount));
  if (!(id in c.prices)) return 'no such coin';
  if (!Number.isFinite(n) || n <= 0) return 'enter an amount above zero';
  if (n > game.player.credits) return 'not enough credits';
  adjust(game, -n, `buy ${id}`);
  c.held[id] += (n * (1 - FEE)) / c.prices[id];
  c.cost[id] += n;
  return null;
}

/// Sells `units` of a coin (or 'all' of it), less the fee.
export function sellCoin(game, id, units) {
  const c = game.bank.crypto;
  if (!(id in c.prices)) return 'no such coin';
  const have = c.held[id];
  const u = units === 'all' ? have : Number(units);
  if (!Number.isFinite(u) || u <= 0) return 'enter an amount above zero';
  if (u > have + 1e-9) return 'you do not hold that much';
  const share = Math.min(u / have, 1);
  const proceeds = Math.floor(Math.min(u, have) * c.prices[id] * (1 - FEE));
  c.held[id] = share >= 1 ? 0 : have - u;
  c.cost[id] = share >= 1 ? 0 : c.cost[id] * (1 - share);
  if (proceeds > 0) refund(game, proceeds, `sell ${id}`);
  return null;
}

/// What a holding is worth now, and the profit or loss against what it cost.
export function holding(game, id) {
  const c = game.bank.crypto;
  const value = c.held[id] * c.prices[id];
  return { units: c.held[id], value, pnl: value - c.cost[id] };
}
