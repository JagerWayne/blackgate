// The Device Manager's STOCK tab: everything bought and delivered, or taken out
// of the machine. Filter by kind, sort, see at a glance what fits now. Buying
// happens only on eForest.

import { primary, danger, ghost } from '../ui/styles.js';
import { drawButton } from '../ui/widgets.js';
import { drawTable, flex } from '../ui/table.js';
import { stockPlan } from '../../game/state/economy.js';
import { draw as drawText, FONT, measure } from '../../game/core/text.js';
import { color } from '../../game/core/theme.js';
import * as gw from '../../game/state/gateway.js';
import { t as tl } from '../../game/data/language.js';

/// The one line that says what a part does.
export function partStat(d, cat) {
  if (cat === 'cpu') return `${d.lanes} thread slots a socket`;
  if (cat === 'hsm') return 'opens hardware-token locks';
  if (cat === 'accel' || cat === 'fpga') return `${d.multiplier}x on ${cat === 'fpga' ? 'decrypting and handshakes' : 'cracking, decrypting and voice'}`;
  if (cat === 'storage') return `${d.capacity >= 1024 ? `${d.capacity / 1024} TB` : `${d.capacity} GB`} // ${d.form} ${d.rpm ? `${d.rpm} rpm hard disk` : 'SSD'}${d.speed < 1 ? ` // downloads at ${Math.round(d.speed * 100)}%, apps at ${Math.round(d.sys_speed * 100)}% as the system drive` : ' // full speed'}`;
  if (cat === 'modem') return `${d.bandwidth >= 1000 ? `${d.bandwidth / 1000} Gb/s` : `${d.bandwidth} Mb/s`} // ${d.hops} hops`;
  return `trace delay ${d.trace_delay} // +${Math.round(d.raid_shield * 100)}% shield${d.failsafe ? ' // burns the drives in a raid' : ''}`;
}

/// The label of any stock kind, including cases and boards.
export const kindName = (kind) => (kind === 'case' ? 'CASE' : kind === 'board' ? 'BOARD' : gw.kindLabel(kind));

/// The ways to order the list.
const SORTS = ['VALUE', 'TIER', 'KIND'];

/// The stock entries `{ s, i }` the filter and sort show.
export function stockEntries(game, stk) {
  const list = (game.player.stock ?? []).map((s, i) => ({ s, i })).filter(({ s }) => stk.kind === 'all' || s.kind === stk.kind);
  const by = {
    VALUE: (a, b) => b.s.value - a.s.value,
    TIER: (a, b) => b.s.level - a.s.level || a.s.kind.localeCompare(b.s.kind),
    KIND: (a, b) => a.s.kind.localeCompare(b.s.kind) || b.s.level - a.s.level,
  }[SORTS[stk.sort]];
  return list.sort(by);
}

/// Three lines a stocked part: its name and what it sells for, its kind and
/// tier, and whether it fits now (or why not). FIT puts it back for free; SELL
/// takes two clicks.
export function stockRows(sk, game, armed, entries) {
  return entries.map(({ s, i }) => {
    const { why } = stockPlan(game, i);
    const sellId = `gw.stock.sell.${i}`;
    const sure = armed === sellId;
    const cells = [
      { text: s.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${s.value} cr`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: `${kindName(s.kind)} // TIER ${s.level}`, size: FONT.body, color: sk.accent, col: 0, line: 1 },
      { text: sure ? `click again to sell for ${s.value} cr (${s.pct}%)` : `resale ${s.value} cr (${s.pct}% of the price)`, size: FONT.body, color: sure ? sk.danger : sk.dim, col: 0, line: 2 },
      { text: why || 'FITS NOW', size: FONT.body, color: why ? sk.warn : sk.ok, col: 0, line: 3 },
    ];
    return {
      grid: true,
      cells,
      marker: sure ? sk.danger : null,
      actions: [
        { id: `gw.stock.fit.${i}`, text: tl('windows.gatewayShop.fit'), style: { ...primary(), disabled: !!why, tip: why || undefined } },
        { id: sellId, text: sure ? 'CONFIRM SELL' : 'SELL', style: sure ? danger() : ghost() },
      ],
    };
  });
}

/// Draws the STOCK tab in `r`.
export function drawStock(ctx, sk, r, game, ui, input, events, view) {
  const stk = view.stk ?? (view.stk = { kind: 'all', sort: 0 });
  const all = game.player.stock ?? [];
  const total = all.reduce((n, s) => n + s.value, 0);
  const kinds = [...new Set(all.map((s) => s.kind))].sort();
  if (stk.kind !== 'all' && !kinds.includes(stk.kind)) stk.kind = 'all';
  // the summary, then the filter chips and the sort
  drawText(ctx, `${all.length} ITEMS // RESALE ${total.toLocaleString('en-US')} cr // ${game.player.credits.toLocaleString('en-US')} cr TO SPEND`, r.x + 2, r.y + 2, FONT.body, color(sk.dim));
  let x = r.x;
  let y = r.y + 26;
  [['all', 'ALL'], ...kinds.map((k) => [k, kindName(k)])].forEach(([k, label]) => {
    const w = measure(ctx, label, FONT.body) + 22;
    if (x > r.x && x + w > r.x + r.w - 110) { x = r.x; y += 30; }
    if (drawButton(ctx, ui, sk, `gw.stk.kind.${k}`, { x, y, w, h: 26 }, label, k === stk.kind ? primary() : ghost(), input)) events.push({ type: 'click', id: `gw.stk.kind.${k}` });
    x += w + 4;
  });
  if (drawButton(ctx, ui, sk, 'gw.stk.sort', { x: r.x + r.w - 104, y: r.y + 26, w: 104, h: 26 }, `SORT: ${SORTS[stk.sort]}`, ghost(), input)) events.push({ type: 'click', id: 'gw.stk.sort' });
  y += 34;
  if (!all.length) {
    drawText(ctx, 'Nothing in stock. Order parts, boards and cases on eForest:', r.x + 2, y + 8, FONT.body, color(sk.dim));
    if (drawButton(ctx, ui, sk, 'gw.eforest.stock', { x: r.x, y: y + 34, w: 170, h: 30 }, 'OPEN eFOREST', primary(), input)) events.push({ type: 'click', id: 'gw.eforest' });
    return;
  }
  drawTable(ctx, sk, { x: r.x, y, w: r.w, h: Math.max(r.y + r.h - y, 60) }, {
    id: 'gw.shop.1',
    columns: [flex('PART', 0.66), flex('VALUE', 0.34, 'right')],
    rows: stockRows(sk, game, view.armed, stockEntries(game, stk)),
    rowH: 76,
    empty: 'nothing of this kind in stock',
  }, ui, input, events);
}
