// A table of rows: the titles over the columns, the cells, a badge, a marker
// and the buttons at the end of each row. It scrolls when the rows are
// taller than the panel.

import { draw as drawText, ellipsize, measure, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { hit } from './kit.js';
import { noteHint, lockedOut } from './hint.js';
import { ctxSource } from './ctxMenu.js';
import { drawButton } from './widgets.js';
import { drawCells } from './tableCells.js';

export { flex, fixed } from './columns.js';
import { layout, rowHeight } from './columns.js';

/// The height of the band the column titles sit in.
export const HEADER_H = 32;

/// Draws a table. Each row is `{ cells, badge, actions, marker }`; each cell
/// is `{ text, size, color, align, line }`.
export function drawTable(ctx, sk, r, table, ui, input, events) {
  const rows = table.rows;
  const cols = table.columns ?? [];
  const headH = cols.some((c) => c.title) ? HEADER_H : 0;
  if (!rows.length) {
    if (headH) drawHeader(ctx, sk, r, cols, r.w);
    drawText(ctx, table.empty ?? 'nothing here', r.x + 8, r.y + headH + 8, FONT.body, color(sk.dim));
    return;
  }
  const heights = rows.map((row) => rowHeight(row, cols.length, table.rowH ?? 30));
  const actionW = rows.reduce((m, row) => Math.max(m, actionsWidth(ctx, row)), 0);
  const contentH = heights.reduce((s, h) => s + h, 0);
  // the titles take the top of the box; the rows live under them
  const bodyTop = r.y + headH;
  const bodyH = Math.max(r.h - headH, 20);
  const maxScroll = Math.max(contentH - bodyH, 0);
  // a table that scrolls keeps its cells and buttons clear of the scrollbar
  const gutter = maxScroll > 0 ? 10 : 0;
  const cellW = Math.max(r.w - actionW - gutter, 40);
  // `reveal` is a row to bring into view, with the row above it showing: the
  // offset comes from the real row heights, never a guessed height
  if (table.reveal >= 0) {
    ui.scroll.set(table.id, Math.min(heights.slice(0, Math.max(table.reveal - 1, 0)).reduce((s, h) => s + h, 0), maxScroll));
  }
  const off = Math.min(ui.scroll.get(table.id) ?? 0, maxScroll);
  if (hit(r, input) && Math.abs(input.scroll) > 0.1) {
    ui.scroll.set(table.id, Math.min(Math.max(off - input.scroll * 0.6, 0), maxScroll));
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, bodyTop, r.w, bodyH);
  ctx.clip();
  let y = bodyTop - off;
  rows.forEach((row, i) => {
    const rr = { x: r.x, y, w: r.w, h: heights[i] };
    y += rr.h;
    if (rr.y + rr.h < bodyTop || rr.y > r.y + r.h) return;
    const selected = table.selected === i;
    const over = hit(rr, input);
    if (selected || over) {
      ctx.fillStyle = color(selected ? sk.accent_dim : sk.panel2);
      ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
    }
    if (row.marker) {
      ctx.fillStyle = color(row.marker);
      ctx.fillRect(rr.x, rr.y, 3, rr.h);
    }
    if (row.hint) noteHint(ui, row.hint, rr);
    // a right click on a row that has a menu opens it
    if (row.menu) ctxSource(ui, input, rr, row.hint ?? '', row.menu, lockedOut(ui, row.hint ?? ''));
    // while the tutorial lights its step, only a row it lights can be picked
    if (over && input.pressed && table.id && !lockedOut(ui, row.hint ?? '')) {
      events.push({ type: 'select', id: table.id, index: i });
    }
    drawCells(ctx, sk, row, rr, table.columns, cellW);
    if (row.badge) {
      drawText(ctx, row.badge[0], r.x + cellW - 6, rr.y + rr.h - 12, FONT.body, color(row.badge[1]), { align: 'right' });
    }
    drawActions(ctx, sk, row, { ...rr, w: rr.w - gutter }, ui, input, events);
  });
  // the edge fades where the rows run past the panel, so the last row reads
  // as "more below" instead of being cut in half
  if (maxScroll > 0 && off < maxScroll - 0.5) {
    const fade = ctx.createLinearGradient(r.x, r.y + r.h - 20, r.x, r.y + r.h);
    fade.addColorStop(0, cssA(sk.panel, 0));
    fade.addColorStop(1, cssA(sk.panel, 0.95));
    ctx.fillStyle = fade;
    ctx.fillRect(r.x, r.y + r.h - 20, r.w - gutter, 20);
  }
  ctx.restore();

  if (headH) drawHeader(ctx, sk, r, cols, cellW);

  if (maxScroll > 0) {
    ctx.fillStyle = color(sk.track);
    ctx.fillRect(r.x + r.w - 6, bodyTop, 4, bodyH);
    const th = Math.max((bodyH * bodyH) / contentH, 24);
    const ty = bodyTop + (bodyH - th) * (off / maxScroll);
    ctx.fillStyle = color(sk.line_hi);
    ctx.fillRect(r.x + r.w - 6, ty, 4, th);
  }
}

/// The band with the titles of the columns, laid over the columns they name.
function drawHeader(ctx, sk, r, cols, cellW) {
  const x0 = r.x + 4;
  const wide = Math.max(cellW - 10, 40);
  const laid = layout(cols, wide, x0);
  cols.forEach((c, i) => {
    if (!c.title) return;
    const col = laid[i];
    const align = c.align ?? 'left';
    const x = align === 'right' ? col.x + col.w - 4 : align === 'center' ? col.x + col.w / 2 : col.x;
    drawText(ctx, ellipsize(ctx, c.title, FONT.body, col.w), x, r.y + 7, FONT.body, color(sk.dim), { align });
  });
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + HEADER_H - 4.5);
  ctx.lineTo(r.x + r.w, r.y + HEADER_H - 4.5);
  ctx.stroke();
}

/// The width the buttons at the end of a row need.
function actionsWidth(ctx, row) {
  if (!row.actions || !row.actions.length) return 0;
  return row.actions.reduce((w, a) => w + measure(ctx, a.text, FONT.body) + 26, 0) + 6;
}

/// Draws the buttons at the end of a row.
function drawActions(ctx, sk, row, rr, ui, input, events) {
  if (!row.actions || !row.actions.length) return;
  let ax = rr.x + rr.w;
  for (let i = row.actions.length - 1; i >= 0; i -= 1) {
    const spec = row.actions[i];
    const aw = measure(ctx, spec.text, FONT.body) + 20;
    ax -= aw;
    const abr = { x: ax, y: rr.y + (rr.h - 26) / 2, w: aw, h: 26 };
    if (drawButton(ctx, ui, sk, spec.id, abr, spec.text, spec.style ?? ghostBtn(), input)) {
      events.push({ type: 'click', id: spec.id });
    }
    ax -= 6;
  }
}

/// The plain face the table actions use.
function ghostBtn() {
  return {
    dark: { fill: null, hover: 'raised', border: 'line', text: 'text' },
    size: FONT.body,
    pad: 10,
    radius: 2,
    disabled: false,
    mono: true,
    glow: false,
  };
}
