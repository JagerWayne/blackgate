// The economy: what the operator buys, and what it costs.

import { componentDef, boardDef, chassisDef, software } from '../data/content.js';
import { appsUsed } from './apps.js';
import { charge, refund, toast } from './gameState.js';
import * as gw from './gateway.js';
import { range } from '../core/rng.js';
import { versionEffect, NO_TASK } from './toolEffects.js';
import { toolSize } from './apps.js';
import { systemFree, downloadsUsed } from './gameHelpers.js';
import { t as tl } from '../data/language.js';

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
  // a second drive splits the roles (system and downloads), which must still hold what is stored
  if (def.kind === 'storage') {
    const why = driveBlock(game, [...g.parts.filter((p) => !plan.out.includes(p)), { kind: 'storage', level: def.tier }]);
    if (why) return why;
  }
  const what = plan.add > 1 ? `${plan.add}x ${def.name}` : def.name;
  if (!charge(game, cost, `hardware ${what}`)) return 'insufficient credits';
  takeOut(game, plan.out);
  for (let i = 0; i < plan.add; i += 1) g.parts.push({ kind: def.kind, level: def.tier, name: def.name });
  settleDrives(game);
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
  settleDrives(game);
}

/// Puts a part in stock, with the price it will sell for: a share of what it
/// cost, rolled once, so looking again does not change it.
/// The game minutes the machine is offline while a part is fitted: a board
/// takes the longest, a card the least (a case brings its own migration time).
export const INSTALL_MINUTES = { cpu: 30, storage: 30, accel: 20, fpga: 20, hsm: 20, modem: 20, security: 25, board: 120 };

/// Takes the machine offline while something is installed.
function goOffline(game, minutes, what) {
  const g = game.player.gateway;
  g.migrateUntil = game.clock.minutes + minutes;
  toast(game, tl('state.economy.installing_offline_for_minutes', what, minutes), 'info');
}

/// The catalogue price of a part, a motherboard or a case.
export function framePrice(kind, level) {
  if (kind === 'board') return boardDef(level)?.price ?? 0;
  if (kind === 'case') return chassisDef(level)?.price ?? 0;
  return componentDef(kind, level)?.price ?? 0;
}

export function stockPart(game, p) {
  if (!Array.isArray(game.player.stock)) game.player.stock = [];
  const price = framePrice(p.kind, p.level);
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
  toast(game, tl('state.economy.sold_cr', item.name, item.value), 'money');
  return null;
}

/// Why a stocked part cannot go back in, or '' when it can; with the stock
/// indexes it would take (RAM goes back as enough matching sticks).
export function stockPlan(game, index) {
  const item = game.player.stock?.[index];
  if (!item) return { why: 'nothing in stock', take: [] };
  const g = game.player.gateway;
  if (gw.migrating(g, game.clock.minutes)) return { why: 'chassis is being reconfigured', take: [] };
  // a motherboard or a case from stock goes in as the buying of one does, for free
  if (item.kind === 'board') {
    const block = boardBlock(game, boardDef(item.level));
    return { why: block, take: block ? [] : [index] };
  }
  if (item.kind === 'case') {
    const block = caseBlock(game, chassisDef(item.level));
    return { why: block, take: block ? [] : [index] };
  }
  const def = componentDef(item.kind, item.level);
  if (!def) return { why: 'not a known part', take: [] };
  const model = gw.fittedModel(g, item.kind);
  if (gw.matched(item.kind) && model !== null && model !== item.level) {
    return { why: `the fitted ${gw.kindLabel(item.kind)} is another model`, take: [] };
  }
  const plan = gw.fitPlan(g, def);
  if (plan.why) return { why: plan.why, take: [] };
  if (plan.out.length) return { why: `no free ${gw.kindLabel(item.kind)} slot`, take: [] };
  if (item.kind === 'storage') {
    const block = driveBlock(game, [...g.parts, { kind: 'storage', level: item.level }]);
    if (block) return { why: block, take: [] };
  }
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
  const frame = game.player.stock[index];
  if (frame.kind === 'board' || frame.kind === 'case') {
    game.player.stock.splice(index, 1);
    if (frame.kind === 'board') {
      // the old board goes back to stock, unless it was soldered into the Micro PC
      if (!gw.boardOf(g).integrated) stockPart(game, { kind: 'board', level: g.board, name: gw.boardOf(g).name });
      applyBoard(game, boardDef(frame.level));
    } else {
      stockPart(game, { kind: 'case', level: g.chassis, name: gw.chassisOf(g).name });
      applyCase(game, chassisDef(frame.level));
    }
    return null;
  }
  const items = take.map((i) => game.player.stock[i]);
  game.player.stock = game.player.stock.filter((_, i) => !take.includes(i));
  items.forEach((s) => g.parts.push({ kind: s.kind, level: s.level, name: s.name }));
  settleDrives(game);
  toast(game, tl('state.economy.refitted', items[0].name, items.length > 1 ? ` x${items.length}` : ''), 'good');
  goOffline(game, (INSTALL_MINUTES[items[0].kind] ?? 20) * items.length, items[0].name);
  return null;
}

/// Fits a new case. The machine is offline for the migration time. The board
/// stays (a bigger case always takes it); what the new case has no room for
/// goes to stock.
export function buyChassis(game, def) {
  if (game.player.credits < def.price) return 'insufficient credits';
  const why = caseBlock(game, def);
  if (why) return why;
  if (!charge(game, def.price, `chassis ${def.name}`)) return 'insufficient credits';
  applyCase(game, def);
  return null;
}

/// Why a case cannot go in, or '': only a bigger case, and the board must fit it.
export function caseBlock(game, def) {
  const g = game.player.gateway;
  if (!def) return 'no such case';
  if (def.tier <= g.chassis) return def.tier === g.chassis ? 'that chassis is already fitted' : 'a bigger case only';
  if (gw.migrating(g, game.clock.minutes)) return 'chassis is being reconfigured';
  if (!gw.boardFits(def, gw.boardOf(g))) return 'the board does not fit that case';
  return '';
}

/// Puts the machine in a new case: what the case has no room for goes to
/// stock, and the machine is offline for the migration time.
function applyCase(game, def) {
  const g = game.player.gateway;
  g.chassis = def.tier;
  reflow(game);
  g.migrateUntil = game.clock.minutes + def.migration;
  toast(game, tl('state.economy.chassis_fitted', def.name), 'good');
  if (def.migration > 0) toast(game, tl('state.economy.reconfiguring_minutes', def.migration), 'info');
}

/// Why a board cannot go in, or ''.
export function boardBlock(game, def) {
  const g = game.player.gateway;
  const chassis = gw.chassisOf(g);
  if (!def) return 'no such board';
  if (def.tier === g.board) return 'already fitted';
  if (chassis.fixed_board) return `the ${chassis.name} has its board built in`;
  if (!gw.boardFits(chassis, def)) return `too big for the ${chassis.name} case`;
  if (def.integrated) return 'the built-in board is soldered into the Micro PC';
  if (gw.migrating(g, game.clock.minutes)) return 'chassis is being reconfigured';
  const kept = fitSet(g, def, chassis);
  if (!kept.some((p) => p.kind === 'cpu')) return `none of your processors run on this board (it takes up to tier ${def.cpu_max}): fit a smaller one first`;
  return driveBlock(game, kept);
}

/// What changing to this board would take out to stock (parts it has no room
/// or no support for).
export function boardLoss(game, def) {
  const g = game.player.gateway;
  const keep = new Set(fitSet(g, def, gw.chassisOf(g)));
  return g.parts.filter((p) => !keep.has(p));
}

/// Fits a motherboard. Parts it cannot hold go to stock; the soldered network
/// card moves across to the new board. The old board is taken back for part of its price.
export function buyBoard(game, def) {
  const why = boardBlock(game, def);
  if (why) return why;
  const g = game.player.gateway;
  const back = Math.floor(gw.boardOf(g).price * 0.35);
  if (game.player.credits + back < def.price) return 'insufficient credits';
  if (back) refund(game, back, 'old board returned');
  if (!charge(game, def.price, `board ${def.name}`)) return 'insufficient credits';
  applyBoard(game, def);
  return null;
}

/// Puts a new motherboard in. What was soldered to the old board goes with it:
/// the eMMC is gone, the network card moves across; what the board cannot hold
/// goes to stock.
function applyBoard(game, def) {
  const g = game.player.gateway;
  g.board = def.tier;
  g.parts = g.parts.filter((p) => !(p.kind === 'storage' && p.fixed));
  g.parts.forEach((p) => { delete p.fixed; });
  if (def.integrated) g.parts.filter((p) => p.kind === 'modem').forEach((p) => { p.fixed = true; });
  reflow(game);
  toast(game, tl('state.economy.board_fitted', def.name), 'good');
  goOffline(game, INSTALL_MINUTES.board, def.name);
}

/// The parts the machine can keep with a board in a case: per kind the first
/// parts up to the slots, none above the tier the board supports.
function fitSet(g, board, chassis) {
  const probe = { ...g, board: board.tier, chassis: chassis.tier };
  const keep = [];
  const counts = {};
  g.parts.forEach((p) => {
    // a drive soldered to the old board does not move to another board
    if (p.kind === 'storage' && p.fixed && board.tier !== g.board) return;
    const n = counts[p.kind] ?? 0;
    if (n < gw.slotsFor(probe, p.kind) && (gw.fitsBoard(probe, p.kind, p.level) || p.fixed)) {
      counts[p.kind] = n + 1;
      keep.push(p);
    }
  });
  return keep;
}

/// Puts every part the machine cannot hold now into stock.
function reflow(game) {
  const g = game.player.gateway;
  const keep = new Set(fitSet(g, gw.boardOf(g), gw.chassisOf(g)));
  const out = g.parts.filter((p) => !keep.has(p));
  g.parts = g.parts.filter((p) => keep.has(p));
  out.forEach((p) => stockPart(game, p));
  settleDrives(game);
  if (out.length) toast(game, tl('state.economy.part_moved_to_stock', out.length, out.length > 1 ? 's' : ''), 'info');
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
  const why = keepReason(game, index);
  if (why) return why;
  takeOut(game, out);
  toast(game, tl('state.economy.removed_to_stock', out[0].name, out.length > 1 ? ` x${out.length}` : ''), 'info');
  return null;
}

/// Why the drives in `parts`, with the roles they have, cannot hold what is
/// stored, or '': the apps must fit the system drive and the files the
/// download drives (or both the one drive).
export function roleBlock(game, parts) {
  const apps = appsUsed(game);
  const files = downloadsUsed(game);
  const p = { ...game.player.gateway, parts };
  if (gw.drives(p).length === 0) return 'the machine needs a drive';
  if (gw.sharedDrive(p)) return apps + files > gw.storage(p) ? `the drive could not hold the ${apps + files} GB stored on it` : '';
  if (apps > gw.systemCap(p)) return `the apps need ${apps} GB on the system drive`;
  if (files > gw.downloadCap(p)) return `the downloads need ${files} GB of room`;
  return '';
}

/// Why the drives in `parts` cannot hold what is stored, or '': the apps live
/// on the first bay's drive, the files on the others.
export const driveBlock = roleBlock;

/// Tidies the drive roles after a change: bay 1 is the system drive.
function settleDrives(game) {
  gw.settleRoles(game.player.gateway);
}

/// The minutes the machine is offline while the SYS Drive is swapped: the
/// data (the apps) is copied from the old drive to the new one.
export function transferMinutes(game) {
  return INSTALL_MINUTES.storage + appsUsed(game);
}

/// Why the part at `index` cannot be taken out, or '': the machine needs a processor.
export function keepReason(game, index) {
  const g = game.player.gateway;
  if (g.parts[index]?.fixed) return 'soldered on: it cannot be taken out';
  if (g.parts[index]?.kind === 'storage' && gw.drives(g).length <= 2) return 'every machine keeps a SYS Drive and at least one STR Drive';
  if (g.parts[index]?.kind === 'storage' && gw.drives(g).length > 1 && gw.systemDrive(g) === g.parts[index]) return 'the SYS Drive stays: fit the new drive from stock in its place and the data is transferred';
  if (g.parts[index]?.kind === 'storage') return driveBlock(game, g.parts.filter((_, i) => i !== index));
  if (g.parts[index]?.kind === 'modem' && gw.usedSlots(g, 'modem') <= 1) return 'the last network card stays: the machine needs a line';
  if (g.parts[index]?.kind === 'cpu' && gw.usedSlots(g, 'cpu') <= 1) {
    return 'the last processor stays: fit a second one first, or replace it';
  }
  return '';
}

/// Why `kind` tier `level` cannot go in place of the fitted part at `index`
/// (-1: into a free slot), or ''.
export function slotBlock(game, kind, level, index) {
  const g = game.player.gateway;
  if (gw.migrating(g, game.clock.minutes)) return 'chassis is being reconfigured';
  const def = componentDef(kind, level);
  if (!def) return 'not a known part';
  if (g.parts[index]?.fixed) return 'the old part is soldered on';
  if (kind === 'storage') {
    const why = driveBlock(game, index >= 0 ? g.parts.map((p, i) => (i === index ? { ...p, level } : p)) : [...g.parts, { kind, level }]);
    if (why) return why;
  }
  const limit = gw.partLimit(g, kind, level);
  if (limit) return limit;
  if (index < 0 && gw.usedSlots(g, kind) >= gw.slotsFor(g, kind)) return `all ${gw.kindLabel(kind)} slots full`;
  if (gw.matched(kind)) {
    const other = gw.partsOf(g, kind).filter((p) => p !== g.parts[index]);
    if (other.length && other[0].level !== level) return `the other ${gw.kindLabel(kind)} is another model`;
  }
  return '';
}

/// Puts a part in one slot: bought from the store (`from.tier`) or taken from
/// stock (`from.stock`). The part it replaces, if any, goes to stock.
export function installInSlot(game, kind, index, from) {
  const g = game.player.gateway;
  const item = from.stock !== undefined ? game.player.stock?.[from.stock] : null;
  if (from.stock !== undefined && (!item || item.kind !== kind)) return 'nothing in stock for this slot';
  const level = item ? item.level : from.tier;
  if (g.parts[index] && g.parts[index].kind !== kind) return 'wrong slot';
  const why = slotBlock(game, kind, level, index);
  if (why) return why;
  const def = componentDef(kind, level);
  if (!item && !charge(game, def.price, `hardware ${def.name}`)) return 'insufficient credits';
  if (item) game.player.stock.splice(from.stock, 1);
  const old = g.parts[index];
  const transfer = kind === 'storage' && old && gw.systemDrive(g) === old ? transferMinutes(game) : 0;
  const fresh = { kind, level, name: item ? item.name : def.name };
  if (old?.role) fresh.role = old.role;
  if (old) {
    g.parts[index] = fresh;
    stockPart(game, old);
  } else g.parts.push(fresh);
  settleDrives(game);
  toast(game, `${old ? 'replaced' : 'installed'} ${fresh.name}${old ? ` // ${old.name} to stock` : ''}`, 'good');
  if (item) goOffline(game, transfer || (INSTALL_MINUTES[kind] ?? 20), transfer ? `${fresh.name} (data transferred from ${old.name})` : fresh.name);
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
  // an upgrade replaces the old version, so only the difference has to fit
  const extra = toolSize(kind, level) - toolSize(kind, owned?.level ?? 0);
  if (extra > systemFree(game)) return `not enough room on the system drive // ${extra} GB needed`;
  if (!charge(game, price, `software ${def.short} v${level}`)) return 'insufficient credits';
  if (owned) owned.level = level;
  else game.player.tools.push({ kind, level });
  toast(game, tl('state.economy.installed_v', def.short, level), 'good');
  return null;
}

/// The price of a tool at a level.
export function toolPrice(def, level) {
  // a tool with a price sheet sells each version at its own price; a version
  // past the sheet (an old save's) is valued by the old multiplier
  return def.prices?.[level - 1] ?? Math.floor(def.price * TOOL_MULT[Math.min(level, 5)]);
}
