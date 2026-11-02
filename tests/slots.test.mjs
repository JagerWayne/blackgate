// Gateway slots: a second part of the same model fits, CPUs come in matched
// sets, and every part taken out goes to a stock where it can be refitted or
// sold for 30-55% of its price.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent, componentDef, chassis } from '../src/data/content.js';
import { makeGame } from '../src/state/gameState.js';
import { fitPlan } from '../src/state/gateway.js';
import { buyComponent, sellPart, sellStock, fitStock, buyChassis } from '../src/state/economy.js';
import { makeInput, endFrame } from '../src/systems/input.js';
import { frameKeys } from '../src/systems/hotkeys.js';
import { makeUiState } from '../src/ui/kit.js';
import { makeWindows, openWindow } from '../src/state/windows.js';
import { drawPlay, desktop } from '../src/render/play.js';
import { handleEvents } from '../src/systems/events.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

await initContent();
const W = 1600;
const H = 900;
const DESK = desktop(W, H);

/// A run with money to spend on a chassis of the given tier.
function rich(tier = 3) {
  const g = makeGame('SLOT', 7);
  g.player.credits = 1e6;
  g.player.accounts[0].balance = 1e6;
  g.player.gateway.chassis = tier;
  return g;
}
const parts = (g, kind) => g.player.gateway.parts.filter((p) => p.kind === kind);
const levels = (g, kind) => parts(g, kind).map((p) => p.level);
const buy = (g, kind, tier) => buyComponent(g, componentDef(kind, tier));

function playState(game) {
  return {
    view: { w: W, h: H }, wallpaper: null, input: makeInput(), ui: makeUiState(),
    windows: makeWindows(), game, win: {}, mode: 'play', time: 0,
  };
}
function frame(state) {
  frameKeys(state);
  const events = [];
  const ctx = stubCtx();
  drawPlay(ctx, theme(), W, H, state, events);
  handleEvents(state, events, DESK);
  endFrame(state.input);
  return ctx;
}
const click = (state, id) => handleEvents(state, [{ type: 'click', id }], DESK);

// -- a second part --------------------------------------------------------------------

test('a second CPU of the fitted model goes into the free slot', () => {
  const g = rich(2);
  assert.equal(buy(g, 'cpu', 1), null);
  assert.deepEqual(levels(g, 'cpu'), [1, 1]);
  assert.equal(g.player.stock.length, 0, 'nothing came out');
});

test('the shop still offers a fitted model while there is room for another', () => {
  const g = rich(2);
  const state = playState(g);
  openWindow(state.windows, 'gateway', DESK);
  state.win.gateway = { tab: 0 };
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'FITTED 1'), 'it says how many are in');
  assert.equal(fitPlan(g.player.gateway, componentDef('cpu', 1)).add, 1, 'and one more fits');
});

test('a full kind that is not matched swaps out only one part', () => {
  const g = rich(3);
  buy(g, 'storage', 1);
  buy(g, 'storage', 1);
  assert.deepEqual(levels(g, 'storage'), [1, 1]);
  buy(g, 'storage', 3);
  assert.equal(parts(g, 'storage').length, 2);
  assert.deepEqual(levels(g, 'storage').sort(), [1, 3]);
  assert.equal(g.player.stock.length, 1, 'the one taken out is in stock');
});

// -- matched sets -----------------------------------------------------------------------

test('a different CPU model takes the whole set out to stock', () => {
  const g = rich(2);
  buy(g, 'cpu', 1);
  assert.equal(buy(g, 'cpu', 3), null);
  assert.deepEqual(levels(g, 'cpu'), [3], 'one of the new model');
  assert.equal(g.player.stock.filter((s) => s.kind === 'cpu').length, 2, 'both old ones in stock');
  buy(g, 'cpu', 3);
  assert.deepEqual(levels(g, 'cpu'), [3, 3]);
});

test('a full matched set of the same model cannot grow', () => {
  const g = rich(1);
  const plan = fitPlan(g.player.gateway, componentDef('cpu', 1));
  assert.equal(plan.add, 0);
  assert.match(plan.why, /full/);
  assert.notEqual(buy(g, 'cpu', 1), null);
});

// -- the stock --------------------------------------------------------------------------------

test('a removed part goes to stock with a fixed price of 30-55%', () => {
  const g = rich(2);
  buy(g, 'modem', 1);
  const credits = g.player.credits;
  sellPart(g, g.player.gateway.parts.findIndex((p) => p.kind === 'modem'));
  assert.equal(g.player.credits, credits, 'nothing is paid yet');
  const item = g.player.stock[0];
  const price = componentDef('modem', 1).price;
  assert.ok(item.pct >= 30 && item.pct <= 55, `${item.pct}%`);
  assert.equal(item.value, Math.floor((price * item.pct) / 100));
});

test('selling from stock pays into the account and the ledger, not earnings', () => {
  const g = rich(2);
  sellPart(g, 0);
  const item = g.player.stock[0];
  const before = { credits: g.player.credits, balance: g.player.accounts[0].balance, earned: g.stats.earned };
  assert.equal(sellStock(g, 0), null);
  assert.equal(g.player.credits - before.credits, item.value);
  assert.equal(g.player.accounts[0].balance - before.balance, item.value);
  assert.equal(g.ledger.at(-1).amount, item.value);
  assert.equal(g.stats.earned, before.earned);
  assert.equal(g.player.stock.length, 0);
});

test('SELL from the STOCK tab takes two clicks', () => {
  const g = rich(2);
  sellPart(g, 0);
  const state = playState(g);
  openWindow(state.windows, 'gateway', DESK);
  click(state, 'gw.stock.sell.0');
  assert.equal(g.player.stock.length, 1, 'armed only');
  click(state, 'gw.stock.sell.0');
  assert.equal(g.player.stock.length, 0);
});

test('a stocked part goes back in for free, if it follows the rules', () => {
  const g = rich(2);
  buy(g, 'cpu', 1);
  sellPart(g, g.player.gateway.parts.findIndex((p) => p.kind === 'cpu'));
  assert.equal(parts(g, 'cpu').length, 1);
  const credits = g.player.credits;
  assert.equal(fitStock(g, 0), null);
  assert.equal(parts(g, 'cpu').length, 2);
  assert.equal(g.player.credits, credits, 'refitting is free');
  // a stocked CPU of another model does not go in beside the fitted set
  buy(g, 'cpu', 3);
  const old = g.player.stock.findIndex((s) => s.kind === 'cpu' && s.level === 1);
  assert.match(fitStock(g, old), /model/);
});

test('a bigger chassis keeps every part; extras would go to stock', () => {
  const g = rich(1);
  g.player.gateway.chassis = 1;
  assert.equal(buyChassis(g, chassis()[1]), null);
  assert.equal(g.player.stock.length, 0);
});

test('the STOCK tab lists what is in stock', () => {
  const g = rich(2);
  buy(g, 'modem', 1);
  sellPart(g, g.player.gateway.parts.findIndex((p) => p.kind === 'modem'));
  const state = playState(g);
  openWindow(state.windows, 'gateway', DESK);
  state.win.gateway = { tab: 5 };
  const ctx = frame(state);
  assert.ok(ctx.texts.some((t) => t.s === 'STOCK 1'), 'the tab counts it');
  assert.ok(ctx.texts.some((t) => /^sells for \d+ cr \(\d+%\)$/.test(t.s)));
  assert.ok(ctx.texts.some((t) => t.s === 'SELL'));
});
