// The cells of one table row, inside the row's box.

import { draw as drawText, ellipsize, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { layout, columnLines, LINE_H } from './columns.js';

/// One cell per column, on the line each cell asks for; then any extra cells,
/// full width, one line each below them.
export function drawCells(ctx, sk, row, rr, columns, cellW) {
  const x0 = rr.x + (row.marker ? 8 : 4);
  const wide = Math.max(rr.x + cellW - 6 - x0, 40);
  const cols = layout(columns, wide, x0);
  const n = cols.length;
  const fit = (cell, size, w) => ellipsize(ctx, String(cell.text ?? ''), size, Math.max(w, 8));
  // a grid row: each cell names its own column and line
  if (row.grid) {
    // a cell that spans runs from its column to the far edge of the last one
    const right = cols[n - 1].x + cols[n - 1].w;
    row.cells.forEach((cell) => {
      const col = cols[Math.min(cell.col ?? 0, n - 1)];
      const w = cell.span ? right - col.x : col.w;
      const size = cell.size ?? FONT.body;
      const align = cell.align ?? col.align;
      const cx = align === 'right' ? col.x + w - 4 : align === 'center' ? col.x + w / 2 : col.x;
      const cy = rr.y + 6 + (cell.line ?? 0) * LINE_H;
      drawText(ctx, fit(cell, size, w - 6), cx, cy, size, color(cell.color ?? sk.text), { align });
    });
    return;
  }
  row.cells.slice(0, n).forEach((cell, c) => {
    const col = cols[c];
    const size = cell.size ?? FONT.body;
    const align = cell.align ?? col.align;
    const cx = align === 'right' ? col.x + col.w - 4 : align === 'center' ? col.x + col.w / 2 : col.x;
    const cy = rr.y + 6 + (cell.line ?? 0) * LINE_H;
    drawText(ctx, fit(cell, size, col.w - 6), cx, cy, size, color(cell.color ?? sk.text), { align });
  });
  const base = columnLines(row, n);
  row.cells.slice(n).forEach((cell, k) => {
    const cy = rr.y + 6 + (base + k) * LINE_H;
    if (cy > rr.y + rr.h - 8) return;
    const size = cell.size ?? FONT.body;
    drawText(ctx, fit(cell, size, wide), x0, cy, size, color(cell.color ?? sk.dim));
  });
}
