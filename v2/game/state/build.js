// A second machine built in the background, from parts the operator already
// owns. Everything comes out of stock (bought on eForest and delivered): the
// case starts a kit, then the board and the parts are picked into it. Picked
// items are reserved, and go back to stock exactly as they were if they are
// taken out or the kit is scrapped. When the kit holds a board, a processor, a
// network card and a drive, ASSEMBLE starts one timer for the whole kit while
// the live machine keeps working. When it is done the operator picks which
// parts of the live machine move across (MIGRATE). The machine is offline while
// the data is copied; what is not moved, and the old case and board, go to stock.

import { componentDef, boardDef, chassisDef } from '../data/content.js';
import { toast } from './gameState.js';
import * as gw from './gateway.js';
import { INSTALL_MINUTES, stockPart, roleBlock, transferMinutes } from './economy.js';
import { t as tl } from '../data/language.js';

/// The build under way, or null.
export const buildOf = (game) => game.player.build ?? null;

/// The minutes the assembly still needs.
export const buildLeft = (game) => Math.max((buildOf(game)?.readyAt ?? 0) - game.clock.minutes, 0);

/// Where the build is: 'none', 'kit' (picking items), 'assembling' or 'ready'.
export function buildStage(game) {
  const b = buildOf(game);
  if (!b) return 'none';
  if (b.stage !== 'assembling') return 'kit';
  return buildLeft(game) > 0 ? 'assembling' : 'ready';
}

/// What a kit needs before it can be assembled.
export const KIT_NEEDS = [['board', 'a board'], ['cpu', 'a processor'], ['modem', 'a network card'], ['storage', 'a drive']];

/// The kit's missing items, in words (empty when it can be assembled).
export function kitMissing(game) {
  const b = buildOf(game);
  if (!b) return [];
  return KIT_NEEDS.filter(([kind]) => (kind === 'board' ? !b.board : !gw.partsOf(b, kind).length)).map(([, text]) => text);
}

/// The minutes assembling the kit takes: the board and every part, one after the other.
export const kitMinutes = (b) => (b.board ? INSTALL_MINUTES.board : 0) + b.parts.reduce((n, p) => n + (INSTALL_MINUTES[p.kind] ?? 20), 0);

/// Why the kit cannot be changed, or '': nothing is, once assembling has started.
const lockedWhy = (b) => (b.stage === 'assembling' ? 'the kit is being assembled' : '');

/// The stock entry at `index` if it is of this kind, else null.
function stocked(game, kind, index) {
  const item = game.player.stock?.[index];
  return item && item.kind === kind ? item : null;
}

/// Puts an item back in stock as it was (value and share kept).
function giveBack(game, item) {
  if (!Array.isArray(game.player.stock)) game.player.stock = [];
  game.player.stock.push(item);
}

/// An item to hold in the kit: what stock had, with its value kept.
const keep = (item) => ({ kind: item.kind, level: item.level, name: item.name, pct: item.pct, value: item.value });

/// Starts a kit with a case from stock (not the soldered Micro PC).
export function startBuild(game, stockIndex) {
  if (buildOf(game)) return 'a build is already under way';
  const item = stocked(game, 'case', stockIndex);
  if (!item) return 'no case in stock: buy one on eForest';
  if (chassisDef(item.level).fixed_board) return 'that case has its board built in';
  game.player.stock.splice(stockIndex, 1);
  game.player.build = { chassis: item.level, board: 0, parts: [], stage: 'kit', readyAt: 0, caseItem: keep(item), boardItem: null };
  toast(game, tl('state.build.build_started', chassisDef(item.level).name), 'good');
  return null;
}

/// Puts the parts the new board cannot hold back in stock.
function swapBoard(game, b, def) {
  const probe = { ...b, board: def.tier };
  const counts = {};
  const out = [];
  b.parts = b.parts.filter((p) => {
    const n = counts[p.kind] ?? 0;
    if (n < gw.slotsFor(probe, p.kind) && gw.fitsBoard(probe, p.kind, p.level)) { counts[p.kind] = n + 1; return true; }
    out.push(p);
    return false;
  });
  out.forEach((p) => giveBack(game, p));
  if (b.boardItem) giveBack(game, b.boardItem);
  b.board = def.tier;
  return out.length;
}

/// Why a board cannot go in the kit, or ''.
export function buildBoardBlock(game, level) {
  const b = buildOf(game);
  const def = boardDef(level);
  if (!b) return 'no build under way';
  if (lockedWhy(b)) return lockedWhy(b);
  if (!def) return 'no such board';
  if (def.integrated) return 'the built-in board is soldered into the Micro PC';
  if (def.tier === b.board) return 'already fitted';
  if (!gw.boardFits(chassisDef(b.chassis), def)) return `too big for the ${chassisDef(b.chassis).name} case`;
  return '';
}

/// Fits a board from stock in the kit; the board it replaces and what the new one cannot hold go back to stock.
export function setBuildBoard(game, stockIndex) {
  const b = buildOf(game);
  if (!b) return 'no build under way';
  const item = stocked(game, 'board', stockIndex);
  if (!item) return 'no board in stock: buy one on eForest';
  const block = buildBoardBlock(game, item.level);
  if (block) return block;
  game.player.stock.splice(stockIndex, 1);
  const moved = swapBoard(game, b, boardDef(item.level));
  b.boardItem = keep(item);
  toast(game, tl('state.build.kit_board', item.name, moved ? ` // ${moved} back to stock` : ''), 'good');
  return null;
}

/// Why a part of this kind and tier cannot be added to the kit, or ''.
export function buildPartBlock(game, kind, level) {
  const b = buildOf(game);
  const def = componentDef(kind, level);
  if (!b) return 'no build under way';
  if (lockedWhy(b)) return lockedWhy(b);
  if (!b.board) return 'fit a board first';
  if (!def) return 'not a known part';
  const plan = gw.fitPlan(b, def);
  if (plan.why) return plan.why;
  const fitted = gw.partsOf(b, kind);
  if (gw.matched(kind) && fitted.length && fitted[0].level !== level) return `the other ${gw.kindLabel(kind)} is another model`;
  if (plan.out.length) return `all ${gw.kindLabel(kind)} slots full`;
  return '';
}

/// Adds a part from stock to the kit.
export function addBuildPart(game, kind, stockIndex) {
  const item = stocked(game, kind, stockIndex);
  if (!item) return `no ${gw.kindLabel(kind)} in stock: buy one on eForest`;
  const block = buildPartBlock(game, kind, item.level);
  if (block) return block;
  game.player.stock.splice(stockIndex, 1);
  buildOf(game).parts.push(keep(item));
  toast(game, tl('state.build.kit', item.name), 'good');
  return null;
}

/// Takes a part out of the kit and back to stock as it was.
export function removeBuildPart(game, index) {
  const b = buildOf(game);
  const p = b?.parts[index];
  if (!p) return 'nothing to remove';
  if (lockedWhy(b)) return lockedWhy(b);
  b.parts.splice(index, 1);
  giveBack(game, p);
  return null;
}

/// Starts assembling a complete kit: one timer for the whole of it.
export function assemble(game) {
  const b = buildOf(game);
  if (!b) return 'no build under way';
  if (lockedWhy(b)) return lockedWhy(b);
  const missing = kitMissing(game);
  if (missing.length) return `the kit still needs ${missing.join(', ')}`;
  b.stage = 'assembling';
  b.readyAt = game.clock.minutes + kitMinutes(b);
  toast(game, tl('state.build.assembling_minutes', kitMinutes(b)), 'info');
  return null;
}

/// Scraps the build: the case, the board and every part go back to stock as they were.
export function cancelBuild(game) {
  const b = buildOf(game);
  if (!b) return 'no build under way';
  b.parts.forEach((p) => giveBack(game, p));
  if (b.boardItem) giveBack(game, b.boardItem);
  giveBack(game, b.caseItem);
  game.player.build = null;
  toast(game, tl('state.build.build_scrapped_everything_back'), 'info');
  return null;
}

/// What a migration would do with the live parts at the indexes `take`: the
/// parts the new machine would have, the live parts left over, the minutes
/// offline, and why it cannot be done ('' when it can).
export function migrationPlan(game, take = []) {
  const b = buildOf(game);
  const g = game.player.gateway;
  const plan = { why: '', parts: [], left: [], minutes: 0 };
  if (!b) return { ...plan, why: 'no build under way' };
  const moved = [...new Set(take)].map((i) => g.parts[i]).filter(Boolean);
  plan.left = g.parts.filter((p) => !moved.includes(p) && !(p.kind === 'storage' && p.fixed));
  plan.parts = [
    ...b.parts.map((p) => ({ kind: p.kind, level: p.level, name: p.name })),
    ...moved.map((p) => { const q = { ...p }; delete q.fixed; delete q.role; return q; }),
  ];
  if (game.session) return { ...plan, why: 'close the link first' };
  if (game.raid) return { ...plan, why: 'the breach is under way' };
  if (gw.migrating(g, game.clock.minutes)) return { ...plan, why: 'chassis is being reconfigured' };
  const stage = buildStage(game);
  if (stage === 'kit') return { ...plan, why: 'assemble the kit first' };
  if (stage === 'assembling') return { ...plan, why: `assembly needs ${buildLeft(game)} more minutes` };
  if (moved.some((p) => p.kind === 'storage' && p.fixed)) return { ...plan, why: 'the soldered eMMC stays with the old board' };
  const rig = { ...b, parts: plan.parts };
  for (const kind of new Set(plan.parts.map((p) => p.kind))) {
    const have = gw.partsOf(rig, kind);
    const slots = gw.slotsFor(rig, kind);
    if (have.length > slots) return { ...plan, why: `the new board has ${slots} ${gw.kindLabel(kind)} slot${slots === 1 ? '' : 's'}, ${have.length} picked` };
    const bad = have.map((p) => gw.partLimit(rig, kind, p.level)).find(Boolean);
    if (bad) return { ...plan, why: bad };
    if (gw.matched(kind) && have.some((p) => p.level !== have[0].level)) return { ...plan, why: `every ${gw.kindLabel(kind)} must be the same model` };
  }
  for (const kind of ['cpu', 'modem', 'storage']) {
    if (!gw.partsOf(rig, kind).length) return { ...plan, why: `the new machine needs a ${gw.kindLabel(kind)}` };
  }
  const room = roleBlock(game, plan.parts);
  if (room) return { ...plan, why: room };
  return { ...plan, minutes: chassisDef(b.chassis).migration + transferMinutes(game) };
}

/// Moves the live machine onto the build. The first drive of the new machine
/// (the build's own first) becomes the SYS Drive and the apps are copied to it.
export function migrate(game, take) {
  const plan = migrationPlan(game, take);
  if (plan.why) return plan.why;
  const b = buildOf(game);
  const g = game.player.gateway;
  plan.left.forEach((p) => stockPart(game, p));
  const oldCase = gw.chassisOf(g);
  const oldBoard = gw.boardOf(g);
  if (oldCase.price > 0) stockPart(game, { kind: 'case', level: g.chassis, name: oldCase.name });
  if (!oldBoard.integrated) stockPart(game, { kind: 'board', level: g.board, name: oldBoard.name });
  g.chassis = b.chassis;
  g.board = b.board;
  g.parts = plan.parts;
  g.migrateUntil = game.clock.minutes + plan.minutes;
  gw.settleRoles(g);
  game.player.build = null;
  toast(game, tl('state.build.migrated_to_offline_minutes', chassisDef(b.chassis).name, plan.minutes), 'good');
  return null;
}
