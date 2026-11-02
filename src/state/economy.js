// The economy: what the operator buys, and what it costs.

import { componentDef, software } from '../data/content.js';
import { charge, refund, toast } from './gameState.js';
import * as gw from './gateway.js';
import { range } from '../core/rng.js';
import { versionEffect, NO_TASK } from './toolEffects.js';

/// The price of a tool at a level, over its level one price.
const TOOL_MULT = [1, 1, 3.4, 9, 21, 46];

/// The lowest and highest share of its price a stocked part sells for.
const STOCK_PCT = [30, 55];

/// Buys a component, following the slot rules (see fitPlan): a free slot is
/// filled, RAM grows to the next allowed count, a new CPU or RAM model takes
/// the old set out, and a full kind swaps its oldest part out. Whatever comes
/// out goes to stock.
export function buyComponent(game, def) {
  if (!def) return 'no such part';
  if (gw.migrating(game.player.gateway, game.clock.minutes)) return 'chassis is being reconfigured';
  const g = game.player.gateway;
  const plan = gw.fitPlan(g, def);
  if (plan.why) return plan.why;
  const cost = def.price * plan.add;
  if (game.player.credits < cost) return 'insufficient credits';
  const what = plan.add > 1 ? `${plan.add}x ${def.name}` : def.name;
  if (!charge(game, cost, `hardware ${what}`)) return 'insufficient credits';
  takeOut(game, plan.out);
  for (let i = 0; i < plan.add; i += 1) g.parts.push({ kind: def.kind, level: def.tier, name: def.name });
  toast(game, plan.out.length ? `installed ${what} // ${plan.out.length} to stock` : `installed ${what}`, 'good');
  return null;
}

/// Takes fitted parts out of the machine and puts them in stock.
function takeOut(game, out) {
  const g = game.player.gateway;
  out.forEach((p) => {
    const at = g.parts.indexOf(p);
    if (at >= 0) g.parts.splice(at, 1);
    stockPart(game, p);
  });
}

/// Puts a part in stock, with the price it will sell for: a share of what it
/// cost, rolled once, so looking again does not change it.
export function stockPart(game, p) {
  if (!Array.isArray(game.player.stock)) game.player.stock = [];
  const price = componentDef(p.kind, p.level)?.price ?? 0;
  const pct = range(game.rng, STOCK_PCT[0], STOCK_PCT[1] + 1);
  const item = { kind: p.kind, level: p.level, name: p.name, pct, value: Math.floor((price * pct) / 100) };
  game.player.stock.push(item);
  return item;
}

/// Sells a part from stock.
export function sellStock(game, index) {
  const item = game.player.stock?.[index];
  if (!item) return 'nothing to sell';
  game.player.stock.splice(index, 1);
  refund(game, item.value, `sold ${item.name}`);
  toast(game, `sold ${item.name} // ${item.value} cr`, 'money');
  return null;
}

/// Why a stocked part cannot go back in, or '' when it can; with the stock
/// indexes it would take (RAM goes back as enough matching sticks).
export function stockPlan(game, index) {
  const item = game.player.stock?.[index];
  if (!item) return { why: 'nothing in stock', take: [] };
  const g = game.player.gateway;
  if (gw.migrating(g, game.clock.minutes)) return { why: 'chassis is being reconfigured', take: [] };
  const def = componentDef(item.kind, item.level);
  if (!def) return { why: 'not a known part', take: [] };
  const model = gw.fittedModel(g, item.kind);
  if (gw.matched(item.kind) && model !== null && model !== item.level) {
    return { why: `the fitted ${gw.kindLabel(item.kind)} is another model`, take: [] };
  }
  const plan = gw.fitPlan(g, def);
  if (plan.why) return { why: plan.why, take: [] };
  if (plan.out.length) return { why: `no free ${gw.kindLabel(item.kind)} slot`, take: [] };
  const take = [index];
  game.player.stock.forEach((s, i) => {
    if (take.length < plan.add && i !== index && s.kind === item.kind && s.level === item.level) take.push(i);
  });
  if (take.length < plan.add) {
    return { why: `needs ${plan.add} matching sticks in stock, has ${take.length}`, take: [] };
  }
  return { why: '', take };
}

/// Puts a stocked part back in, for free.
export function fitStock(game, index) {
  const { why, take } = stockPlan(game, index);
  if (why) return why;
  const g = game.player.gateway;
  const items = take.map((i) => game.player.stock[i]);
  game.player.stock = game.player.stock.filter((_, i) => !take.includes(i));
  items.forEach((s) => g.parts.push({ kind: s.kind, level: s.level, name: s.name }));
  toast(game, `refitted ${items[0].name}${items.length > 1 ? ` x${items.length}` : ''}`, 'good');
  return null;
}

/// Fits a new chassis. The machine is offline for the migration time.
export function buyChassis(game, def) {
  if (game.player.credits < def.price) return 'insufficient credits';
  if (def.tier <= game.player.gateway.chassis) return 'that chassis is already fitted';
  if (gw.migrating(game.player.gateway, game.clock.minutes)) return 'chassis is being reconfigured';
  if (!charge(game, def.price, `chassis ${def.name}`)) return 'insufficient credits';
  const g = game.player.gateway;
  g.chassis = def.tier;
  // the new frame may not take everything the old one did
  const counts = {};
  const keep = [];
  const out = [];
  g.parts.forEach((p) => {
    const n = counts[p.kind] ?? 0;
    if (n < gw.slotsFor(g, p.kind)) {
      counts[p.kind] = n + 1;
      keep.push(p);
    } else out.push(p);
  });
  g.parts = keep;
  out.forEach((p) => stockPart(game, p));
  g.migrateUntil = game.clock.minutes + def.migration;
  toast(game, `chassis ${def.name} fitted`, 'good');
  if (def.migration > 0) toast(game, `reconfiguring // ${def.migration} minutes`, 'info');
  return null;
}

/// The fitted parts a REMOVE takes out: the one picked, or for RAM enough
/// sticks to drop to the allowed count below.
export function removePlan(game, index) {
  const g = game.player.gateway;
  const p = g.parts[index];
  if (!p) return [];
  return [p];
}

/// Takes a component out of the machine and puts it in stock, to refit or to
/// sell later.
export function sellPart(game, index) {
  const out = removePlan(game, index);
  if (!out.length) return 'nothing to remove';
  takeOut(game, out);
  toast(game, `removed ${out[0].name}${out.length > 1 ? ` x${out.length}` : ''} // to stock`, 'info');
  return null;
}

/// Buys a version of a tool.
export function buyTool(game, kind, level) {
  const def = software().find((d) => d.kind === kind);
  if (!def) return 'no such tool';
  if (versionEffect(kind, level) === NO_TASK) return NO_TASK;
  if (level > def.versions.length) return 'no such version';
  const price = toolPrice(def, level);
  const owned = game.player.tools.find((t) => t.kind === kind);
  if (owned && owned.level >= level) return 'already owned';
  if (game.player.credits < price) return 'insufficient credits';
  if (!charge(game, price, `software ${def.short} v${level}`)) return 'insufficient credits';
  if (owned) owned.level = level;
  else game.player.tools.push({ kind, level });
  toast(game, `installed ${def.short} v${level}`, 'good');
  return null;
}

/// The price of a tool at a level.
export function toolPrice(def, level) {
  return Math.floor(def.price * TOOL_MULT[Math.min(level, 5)]);
}
