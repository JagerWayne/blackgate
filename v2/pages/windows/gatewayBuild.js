// The Device Manager's BUILD tab: the workbench for a second machine, made from
// parts already in stock. A step bar (CASE, BOARD, PARTS, ASSEMBLE, MIGRATE)
// says where the build is; below it the page of the step: the bill of
// materials with what is still missing, a stock list to pick from, the
// assembly progress, or the migration checklist beside a before/after table.
// Nothing is bought here: what is missing is bought on eForest.

import { drawTable, flex } from '../ui/table.js';
import { primary, danger, ghost } from '../ui/styles.js';
import { stepper, card, gauge } from '../ui/dash.js';
import { drawButton } from '../ui/widgets.js';
import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color } from '../../game/core/theme.js';
import { chassisDef, boardDef } from '../../game/data/content.js';
import {
  buildOf, buildStage, buildLeft, kitMissing, kitMinutes, buildBoardBlock, buildPartBlock, migrationPlan,
} from '../../game/state/build.js';
import { kindName } from './gatewayShop.js';
import * as gw from '../../game/state/gateway.js';
import { t as tl } from '../../game/data/language.js';

const COLS = [flex('ITEM', 0.7), flex('', 0.3, 'right')];

/// The kinds a build takes parts of, in board order.
const KINDS = ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security'];

const gb = (n) => (n >= 1024 ? `${Math.round(n / 102.4) / 10} TB` : `${n} GB`);

/// A row: a title with a note on the right, a line of detail, an optional hint, and buttons.
function row(sk, { title, right, sub, note, noteColor, actions = [], marker = null }) {
  const cells = [{ text: title, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 }];
  if (right) cells.push({ text: right, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 });
  if (sub) cells.push({ text: sub, size: FONT.body, color: sk.accent, col: 0, line: 1 });
  if (note) cells.push({ text: note, size: FONT.body, color: noteColor ?? sk.warn, col: 0, line: 2 });
  return { grid: true, cells, actions, marker };
}

const btn = (id, text, why, style = primary()) => ({ id, text, style: { ...style, disabled: !!why, tip: why || undefined } });
const back = (sk) => row(sk, { title: '< BACK TO THE KIT', actions: [btn('gw.bld.page.main', 'BACK', '', ghost())] });
const store = (sk, text) => row(sk, { title: text, sub: tl('windows.gatewayBuild.it_has_to_be'), actions: [btn('gw.eforest', 'OPEN eFOREST', '')] });

/// The steps and where the build is in them.
function steps(game) {
  const b = buildOf(game);
  const stage = buildStage(game);
  const missing = b ? kitMissing(game) : [];
  const partsDone = !!b && !missing.filter((m) => m !== 'a board').length;
  const at = { none: 0, kit: !b?.board ? 1 : partsDone ? 3 : 2, assembling: 3, ready: 4 }[stage];
  return ['CASE', 'BOARD', 'PARTS', 'ASSEMBLE', 'MIGRATE'].map((label, i) => ({ label, state: i < at ? 'done' : i === at ? 'current' : 'todo' }));
}

/// A machine's numbers, for the before/after table.
function specs(rig) {
  return [
    ['THREAD SLOTS', String(gw.lanes(rig))],
    ['UNLOCK SPEED', `${(gw.crypt(rig) * gw.fpga(rig)).toFixed(1)}x`],
    ['SYS DRIVE', gb(gw.sharedDrive(rig) ? gw.storage(rig) : gw.systemCap(rig))],
    ['STR DRIVES', gw.sharedDrive(rig) ? 'shared' : gb(gw.downloadCap(rig))],
    ['INTERNET', `${gw.bandwidth(rig)} Mb/s`],
    ['RELAY HOPS', String(gw.hops(rig))],
    ['DEFENCE', gw.defense(rig)],
  ];
}

/// The page with no build: the cases in stock, or the way to get one.
function startRows(sk, game) {
  const rows = [row(sk, {
    title: 'NO BUILD UNDER WAY',
    note: 'A new machine is made from parts you already own: a case, a board, a processor, a network card and a drive. Buy them on eForest; they arrive in STOCK.',
    noteColor: sk.dim,
  })];
  let any = false;
  (game.player.stock ?? []).forEach((s, i) => {
    if (s.kind !== 'case') return;
    any = true;
    const fixed = chassisDef(s.level)?.fixed_board;
    rows.push(row(sk, { title: s.name, right: 'IN STOCK', sub: tl('windows.gatewayBuild.case'), note: fixed ? 'its board is built in: it cannot start a build' : '', actions: [btn(`gw.bld.start.${i}`, 'START BUILD', fixed)] }));
  });
  if (!any) rows.push(store(sk, 'NO CASE IN STOCK'));
  return rows;
}

/// The bill of materials: what the kit has, what it needs, and what to do next.
function kitRows(sk, game, view) {
  const b = buildOf(game);
  const locked = buildStage(game) !== 'kit';
  const c = chassisDef(b.chassis);
  const bd = b.board ? boardDef(b.board) : null;
  const rows = [row(sk, { title: c.name, right: 'CASE  OK', sub: tl('windows.gatewayBuild.drive_bays_security_slots', c.bays, c.security_slots, c.migration) })];
  rows.push(row(sk, {
    title: bd ? bd.name : 'BOARD  REQUIRED',
    right: bd ? 'BOARD  OK' : 'MISSING',
    sub: bd ? `${bd.cpu_slots} processors up to T${bd.cpu_max} // ${bd.storage_slots} drives // drives up to ${gb(bd.drive_cap)}` : 'every part needs a board first',
    actions: [btn('gw.bld.page.board', bd ? 'CHANGE' : 'PICK BOARD', locked ? 'the kit is being assembled' : '', bd ? ghost() : primary())],
  }));
  b.parts.forEach((p, i) => rows.push(row(sk, {
    title: p.name, right: kindName(p.kind), sub: tl('windows.gatewayBuild.tier', p.level),
    actions: [btn(`gw.bld.rm.${i}`, 'TO STOCK', locked ? 'the kit is being assembled' : '', ghost())],
  })));
  if (b.board) {
    KINDS.forEach((kind) => {
      const slots = gw.slotsFor(b, kind);
      if (!slots) return;
      const used = gw.usedSlots(b, kind);
      const need = ['cpu', 'modem', 'storage'].includes(kind) && !used;
      rows.push(row(sk, {
        title: `${kindName(kind)}  ${used}/${slots}`, right: need ? 'REQUIRED' : used < slots ? 'OPTIONAL' : 'FULL',
        sub: used < slots ? 'free slot' : 'all slots used',
        actions: [btn(`gw.bld.page.add.${kind}`, 'PICK', locked ? 'the kit is being assembled' : used >= slots ? 'all slots full' : '', need ? primary() : ghost())],
      }));
    });
  }
  return rows;
}

/// The bar pinned under the list: what the kit lacks or what happens next, and
/// the buttons that move the build on (ASSEMBLE, MIGRATE) or scrap it.
function drawFooter(ctx, sk, r, game, ui, input, events, view) {
  const b = buildOf(game);
  const stage = buildStage(game);
  const missing = kitMissing(game);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + 0.5);
  ctx.lineTo(r.x + r.w, r.y + 0.5);
  ctx.stroke();
  const note = {
    kit: missing.length ? [`still needs ${missing.join(', ')}`, sk.warn] : [`kit complete // ${kitMinutes(b)} min to assemble`, sk.ok],
    assembling: [`assembling // ${buildLeft(game)} min left; the live machine keeps working`, sk.dim],
    ready: ['assembly done // pick what moves across', sk.ok],
  }[stage];
  drawText(ctx, ellipsize(ctx, note[0], FONT.body, r.w - 330), r.x + 2, r.y + 17, FONT.body, color(note[1]));
  const scrap = view.armed === 'gw.bld.cancel';
  let x = r.x + r.w;
  const put = (id, text, w, style) => {
    x -= w;
    if (drawButton(ctx, ui, sk, id, { x, y: r.y + 8, w, h: 30 }, text, style, input)) events.push({ type: 'click', id });
    x -= 8;
  };
  put('gw.bld.cancel', scrap ? 'CONFIRM SCRAP' : 'SCRAP', scrap ? 130 : 80, scrap ? danger() : ghost());
  if (stage === 'kit') put('gw.bld.assemble', 'ASSEMBLE', 110, { ...primary(), disabled: missing.length > 0, tip: missing.length ? `still needs ${missing.join(', ')}` : 'one timer for the whole kit' });
  else if (stage === 'ready') put('gw.bld.page.migrate', 'MIGRATE...', 120, primary());
}

/// The boards in stock.
function boardRows(sk, game) {
  const rows = [back(sk)];
  let any = false;
  (game.player.stock ?? []).forEach((s, i) => {
    if (s.kind !== 'board') return;
    any = true;
    const why = buildBoardBlock(game, s.level);
    const d = boardDef(s.level);
    rows.push(row(sk, {
      title: s.name, right: 'IN STOCK',
      sub: d ? `${d.cpu_slots} processors up to T${d.cpu_max} // ${d.storage_slots} drives // ${d.modem_slots} line${d.modem_slots > 1 ? 's' : ''}` : '',
      note: why || 'fits this case', noteColor: why ? sk.warn : sk.ok, actions: [btn(`gw.bld.board.${i}`, 'FIT', why)],
    }));
  });
  if (!any) rows.push(store(sk, 'NO BOARD IN STOCK'));
  return rows;
}

/// The parts of one kind in stock.
function addRows(sk, game, kind) {
  const rows = [back(sk)];
  let any = false;
  (game.player.stock ?? []).forEach((s, i) => {
    if (s.kind !== kind) return;
    any = true;
    const why = buildPartBlock(game, kind, s.level);
    rows.push(row(sk, { title: s.name, right: 'IN STOCK', sub: tl('windows.gatewayBuild.tier', s.level), note: why || 'fits the kit', noteColor: why ? sk.warn : sk.ok, actions: [btn(`gw.bld.use.${kind}.${i}`, 'FIT', why)] }));
  });
  if (!any) rows.push(store(sk, `NO ${kindName(kind)} IN STOCK`));
  return rows;
}

/// The checklist of the live parts to move, and the verdict of the migration.
function migrateRows(sk, game, view, plan) {
  const take = view.bld.take;
  const sure = view.armed === 'gw.bld.go';
  const rows = [back(sk)];
  rows.push(row(sk, {
    title: plan.why ? 'CANNOT MIGRATE YET' : `READY // OFFLINE ${plan.minutes} MINUTES`,
    sub: tl('windows.gatewayBuild.parts_in_the_new', plan.parts.length, plan.left.length),
    note: plan.why || (sure ? 'click again: the machine goes offline while the data is copied' : 'the new machine takes over this one\'s apps and public IP'),
    noteColor: plan.why || sure ? sk.danger : sk.dim,
    marker: sure ? sk.danger : null,
    actions: [{ id: 'gw.bld.go', text: sure ? 'CONFIRM' : 'MIGRATE', style: { ...(sure ? danger() : primary()), disabled: !!plan.why } }],
  }));
  game.player.gateway.parts.forEach((p, i) => {
    const stays = p.kind === 'storage' && p.fixed;
    const on = take.includes(i);
    rows.push(row(sk, {
      title: p.name, right: kindName(p.kind), sub: tl('windows.gatewayBuild.tier_2', p.level, p.fixed ? ' // soldered' : ''),
      note: stays ? 'stays with the old board' : on ? 'MOVES to the new machine' : 'goes to stock',
      noteColor: on ? sk.ok : sk.dim,
      actions: stays ? [] : [{ id: `gw.bld.tick.${i}`, text: on ? 'LEAVE' : 'MOVE', style: on ? ghost() : primary() }],
    }));
  });
  return rows;
}

/// The before/after card of the migration.
function drawCompare(ctx, sk, r, game, plan) {
  const b = buildOf(game);
  const now = specs(game.player.gateway);
  const after = specs({ chassis: b.chassis, board: b.board, parts: plan.parts });
  const body = card(ctx, sk, r, 'NOW  ->  AFTER MIGRATION', `offline ${plan.minutes || '?'} min`);
  const colW = body.w / 2;
  now.forEach(([label, was], i) => {
    const will = after[i][1];
    const x = body.x + (i % 2) * colW;
    const y = body.y + Math.floor(i / 2) * 20;
    drawText(ctx, label, x, y, FONT.body, color(sk.muted));
    drawText(ctx, was === will ? was : `${was} -> ${will}`, x + colW - 14, y, FONT.body, color(was === will ? sk.dim : sk.ok), { align: 'right' });
  });
}

/// Draws the BUILD tab in `r`.
export function drawBuild(ctx, sk, r, game, ui, input, events, view) {
  const bld = view.bld ?? (view.bld = { page: 'main', take: [], pick: null });
  const b = buildOf(game);
  const stage = buildStage(game);
  stepper(ctx, sk, ui, input, events, { x: r.x, y: r.y, w: r.w, h: 46 }, steps(game));
  let y = r.y + 54;
  if (stage === 'assembling') {
    const total = kitMinutes(b);
    const left = buildLeft(game);
    const body = card(ctx, sk, { x: r.x, y, w: r.w, h: 66 }, 'ASSEMBLING', `${left} of ${total} min left`);
    gauge(ctx, sk, { x: body.x, y: body.y + 4, w: body.w, h: 8 }, 1 - left / total, 2, 2);
    y += 74;
  }
  let rows;
  if (!b) rows = startRows(sk, game);
  else if (bld.page === 'board' && stage === 'kit') rows = boardRows(sk, game);
  else if (bld.page.startsWith('add.') && stage === 'kit') rows = addRows(sk, game, bld.page.slice(4));
  else if (bld.page === 'migrate' && stage === 'ready') {
    const plan = migrationPlan(game, bld.take);
    drawCompare(ctx, sk, { x: r.x, y, w: r.w, h: 28 + 4 * 20 + 14 }, game, plan);
    y += 28 + 4 * 20 + 22;
    rows = migrateRows(sk, game, view, plan);
  } else rows = kitRows(sk, game, view);
  // the footer shows on the kit page only; the lists and the migration have their own BACK row
  const main = b && !(rows[0] && rows[0].actions[0]?.id === 'gw.bld.page.main');
  const foot = main ? 46 : 0;
  drawTable(ctx, sk, { x: r.x, y, w: r.w, h: Math.max(r.y + r.h - y - foot, 60) }, { id: 'gw.build', columns: COLS, rows, rowH: 62, empty: '' }, ui, input, events);
  if (main) drawFooter(ctx, sk, { x: r.x, y: r.y + r.h - foot, w: r.w, h: foot }, game, ui, input, events, view);
}
