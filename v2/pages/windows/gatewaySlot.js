// The Device Manager's right side: what the selected slot holds and what can
// be done with it. A fitted slot can be stored, sold, or replaced from the
// store or from storage; a free one can be filled the same two ways.

import { sectionHead } from '../ui/panel.js';
import { card } from '../ui/dash.js';
import { drawTable, flex } from '../ui/table.js';
import { drawButton } from '../ui/widgets.js';
import { label, para, keyValue } from '../ui/controls.js';
import { ghost, danger, primary } from '../ui/styles.js';
import { drawScrolled } from '../ui/scroll.js';
import { measureControls } from '../ui/layout.js';
import { draw as drawText, wrapLines, FONT } from '../../game/core/text.js';
import { color } from '../../game/core/theme.js';
import { componentDef, componentsOf } from '../../game/data/content.js';
import { keepReason, slotBlock, transferMinutes } from '../../game/state/economy.js';
import { partStat } from './gatewayShop.js';
import * as gw from '../../game/state/gateway.js';
import { t as tl } from '../../game/data/language.js';

/// A button that is off, and says why when hovered.
const off = (why, style = ghost()) => ({ ...style, disabled: !!why, tip: why || style.tip });

/// Draws the inspector in `r`.
export function drawInspector(ctx, sk, r, game, ui, input, events, view) {
  const g = game.player.gateway;
  const sel = view.slot;
  if (!sel) {
    const pane = card(ctx, sk, { x: r.x, y: r.y, w: r.w, h: Math.min(r.h, 190) }, 'SLOT INSPECTOR');
    drawScrolled(ctx, sk, pane, [
      label('NO SLOT PICKED', FONT.heading, sk.text_hi),
      para('Click a slot on the board. You can then fit a part from stock, replace what is in it, or take it out. Buy new parts on eForest; they arrive in STOCK.', FONT.body, sk.dim),
    ], 'gw.none', ui, input, events);
    return;
  }
  const { kind, n } = sel;
  const index = gw.slotIndex(g, kind, n);
  const part = g.parts[index];
  const def = part ? componentDef(kind, part.level) : null;
  const stocked = (game.player.stock ?? []).filter((s) => s.kind === kind).length;
  const worth = def ? `${Math.floor(def.price * 0.3)}-${Math.floor(def.price * 0.55)} cr` : '';
  const keep = part ? keepReason(game, index) : '';
  const busy = gw.migrating(g, game.clock.minutes) ? 'the chassis is being reconfigured' : '';
  // the details of the slot: they scroll when there is a lot to say
  const controls = [
    label(part ? part.name : 'EMPTY // nothing fitted', FONT.heading, part ? sk.text_hi : sk.dim),
  ];
  if (def) {
    if (part.fixed) controls.push(label('SOLDERED ON // part of the board', FONT.body, sk.warn));
    controls.push(para(partStat(def, kind), FONT.body, sk.text));
    if (!def.onboard) controls.push(keyValue('NEW PRICE', `${def.price} cr`, sk.warn), keyValue('SELLS FOR ABOUT', worth, sk.dim));
  }
  if (part && kind === 'storage') {
    const shared = gw.sharedDrive(g);
    const sys = gw.systemDrive(g) === part;
    controls.push(label(shared ? `${gw.driveName(g, part)} (C:) // the one drive, apps and downloads share it` : sys ? `${gw.driveName(g, part)} (C:) // the apps live here` : `${gw.driveName(g, part)} (D:) // files land here`, FONT.body, shared || sys ? sk.accent : sk.ok));
  }
  const need = measureControls(ctx, controls, Math.max(r.w - 18, 40)) + 58;
  // with a list open the details shrink to leave the list room (they scroll)
  const cardH = view.mode === 'stock' ? Math.min(need, 130) : Math.min(need, Math.max(r.h * 0.4, 170));
  const caption = `${gw.kindLabel(kind)} SLOT ${n + 1} OF ${gw.slotsFor(g, kind)}`;
  drawScrolled(ctx, sk, card(ctx, sk, { x: r.x, y: r.y, w: r.w, h: cardH }, caption, part ? `TIER ${part.level}` : ''), controls, 'gw.slotcard', ui, input, events);

  // what to do: a bar of buttons that wraps onto more rows, never hidden in the card
  const sure = view.armed === 'gw.do.sell';
  const acts = [];
  let message = '';
  let hot = sk.warn;
  if (part) {
    const solder = part.fixed ? 'soldered to the board: it cannot be replaced' : '';
    acts.push({ id: 'gw.do.store', text: tl('windows.gatewaySlot.store'), style: off(keep || busy) });
    acts.push({ id: 'gw.do.sell', text: sure ? 'CONFIRM SELL' : 'SELL', style: sure ? danger() : off(keep || busy) });
    acts.push({ id: 'gw.mode.stock', text: tl('windows.gatewaySlot.replace_from_storage', stocked), style: solder ? off(solder) : view.mode === 'stock' ? primary() : off(stocked ? '' : 'nothing of this kind in storage') });
    if (keep) message = keep;
    else if (sure) { message = `sells ${part.name} for a share of its price, for good`; hot = sk.danger; }
  } else {
    acts.push({ id: 'gw.eforest', text: tl('windows.gatewaySlot.buy_on_eforest'), style: ghost() });
    acts.push({ id: 'gw.mode.stock', text: tl('windows.gatewaySlot.fit_from_storage', stocked), style: view.mode === 'stock' ? primary() : off(stocked ? '' : 'nothing of this kind in storage') });
  }
  let y = r.y + cardH + 10;
  drawText(ctx, 'WHAT TO DO', r.x + 2, y, FONT.body, color(sk.dim));
  y += 22;
  let x = r.x;
  acts.forEach((a) => {
    const w = Math.min(Math.ceil(a.text.length * 8.4) + 26, r.w);
    if (x > r.x && x + w > r.x + r.w) { x = r.x; y += 36; }
    if (drawButton(ctx, ui, sk, a.id, { x, y, w, h: 30 }, a.text, a.style, input)) events.push({ type: 'click', id: a.id });
    x += w + 8;
  });
  y += 36;
  if (message) {
    const lines = wrapLines(ctx, message, FONT.body, r.w - 4);
    lines.slice(0, 3).forEach((l, i) => drawText(ctx, l, r.x + 2, y + i * 20, FONT.body, color(hot)));
    y += Math.min(lines.length, 3) * 20 + 2;
  }

  const below = { x: r.x, y: y + 6, w: r.w, h: Math.max(r.y + r.h - y - 6, 40) };
  if (view.mode === 'stock') drawStockList(ctx, sk, below, game, ui, input, events, kind, index);
}

/// What swapping a part for a stocked one changes, in a few words ('' when there is no old part to compare).
export function changeText(kind, old, item) {
  const to = componentDef(kind, item.level);
  const from = old ? componentDef(kind, old.level) : null;
  if (!to) return '';
  const diff = (a, b, unit) => (a === b ? `same ${unit}` : `${unit} ${a} -> ${b}`);
  if (kind === 'cpu') return diff(from?.lanes ?? 0, to.lanes, 'thread slots');
  if (kind === 'accel' || kind === 'fpga') return diff(from?.multiplier ?? 1, to.multiplier, 'speed x');
  if (kind === 'storage') return diff(from?.capacity ?? 0, to.capacity, 'GB');
  if (kind === 'modem') return diff(from?.bandwidth ?? 0, to.bandwidth, 'Mb/s');
  return '';
}

/// The parts in storage that fit this slot.
function drawStockList(ctx, sk, r, game, ui, input, events, kind, index) {
  const body = sectionHead(ctx, sk, r, 'STORAGE');
  const rows = [];
  (game.player.stock ?? []).forEach((s, i) => {
    if (s.kind !== kind) return;
    const why = slotBlock(game, kind, s.level, index);
    const cells = [
      { text: s.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${s.value} cr`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: `tier ${s.level}`, size: FONT.body, color: sk.accent, col: 0, line: 1 },
    ];
    const copy = kind === 'storage' && index >= 0 && gw.systemDrive(game.player.gateway) === game.player.gateway.parts[index];
    const change = why ? '' : changeText(kind, game.player.gateway.parts[index], s);
    if (change) cells.push({ text: change, size: FONT.body, color: sk.ok, col: 0, line: 3 });
    if (why) cells.push({ text: why, size: FONT.body, color: sk.warn, col: 0, line: 2 });
    else if (copy) cells.push({ text: `copies the apps over // offline ${transferMinutes(game)} min`, size: FONT.body, color: sk.warn, col: 0, line: 2 });
    rows.push({ grid: true, cells, actions: [{ id: `gw.do.stock.${i}`, text: index >= 0 ? 'SWAP IN' : 'FIT', style: off(why, primary()) }] });
  });
  drawTable(ctx, sk, body, { id: 'gw.stocklist', columns: [flex('PART', 0.66), flex('VALUE', 0.34, 'right')], rows, rowH: 52, empty: 'nothing of this kind in storage' }, ui, input, events);
}
