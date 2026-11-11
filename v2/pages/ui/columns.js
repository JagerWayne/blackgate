// The columns of a table, the widths they get, and how tall a row grows to
// hold its cells.

/// The height of one text line inside a row.
export const LINE_H = 22;

/// A column that shares the width: `flex('NAME', 0.5)` takes half of it.
export function flex(title, frac, align = 'left') {
  return { title, frac, align };
}

/// A column with a fixed width: `fixed('T', 40)`.
export function fixed(title, width, align = 'left') {
  return { title, width, align };
}

/// The x and the width of every column, from `x0` across a total width. A
/// flex column takes its share of the total.
export function layout(columns, total, x0 = 0) {
  let x = x0;
  return columns.map((c) => {
    const w = Math.max(c.width ?? c.frac * total, 16);
    const col = { x, w, align: c.align };
    x += w;
    return col;
  });
}

/// The lines the column cells use. Cells past the last column flow onto the
/// lines below them, one line each.
export function columnLines(row, cols) {
  if (row.grid) return row.cells.reduce((m, c) => Math.max(m, (c.line ?? 0) + 1), 1);
  return row.cells.slice(0, cols).reduce((m, c) => Math.max(m, (c.line ?? 0) + 1), 1);
}

/// How tall a row is: tall enough for every line, never under the table's own.
export function rowHeight(row, cols, rowH) {
  // a grid row places every cell itself; other rows flow extra cells below
  const extra = row.grid ? 0 : Math.max(row.cells.length - cols, 0);
  const lines = columnLines(row, cols) + extra;
  return Math.max(lines * LINE_H + 14, rowH);
}
