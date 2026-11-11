// A small file explorer, drawn the way Windows Explorer lays things out: an
// address bar with the way up, a toolbar for the picked item, a folder tree on
// the left, a details list on the right and a status bar underneath. The
// caller describes the folders and files; this draws them and keeps only the
// open folder and the picked item in `view`.
//
//   spec = { id, root, status, folders: [{ id, name, empty, items: [item] }] }
//   item = { key, name, detail, size, tint, kind: 'file' | 'app' | 'log',
//            marker, note, open: 'event id of a double click', actions: [{ id, text, style }] }

import { hit, roundRect } from './kit.js';
import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { drawScrolled } from './scroll.js';
import { drawButton } from './widgets.js';
import { custom } from './controls.js';
import { ghost } from './styles.js';
import { dragWidth } from './panel.js';
import { noteHint, lockedOut } from './hint.js';
import { ctxSource } from './ctxMenu.js';

const TREE_W = 150;
const ADDR_H = 30;
const BAR_H = 34;
const STATUS_H = 24;
const HEAD_H = 24;
const ROW_H = 26;
const SIZE_W = 86;

/// A yellow folder.
function folderIcon(ctx, x, y) {
  ctx.fillStyle = '#e8b84a';
  roundRect(ctx, { x, y: y + 2, w: 7, h: 4 }, 1);
  ctx.fill();
  roundRect(ctx, { x, y: y + 4, w: 16, h: 11 }, 2);
  ctx.fill();
}

/// A page with a folded corner, tinted by what it is.
function fileIcon(ctx, x, y, tint) {
  ctx.fillStyle = color(tint);
  ctx.fillRect(x + 2, y, 11, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(x + 9, y, 4, 4);
}

/// Draws the explorer into `r`.
export function drawExplorer(ctx, sk, r, ui, input, events, spec, view) {
  const folders = spec.folders;
  // folders may sit under a drive (`group`: 'C:'); a drive is opened as `@C:`
  const groups = [...new Set(folders.map((f) => f.group).filter(Boolean))];
  const group = typeof view.folder === 'string' && view.folder.startsWith('@') && groups.includes(view.folder.slice(1)) ? view.folder.slice(1) : null;
  const open = folders.find((f) => f.id === view.folder) ?? null;
  if (!open && !group) view.folder = null;
  const asItem = (f) => ({ key: f.id, name: f.name, kind: 'folder', detail: `${f.items.length} item${f.items.length === 1 ? '' : 's'}`, size: '' });
  const items = open
    ? open.items
    : group
      ? folders.filter((f) => f.group === group).map(asItem)
      : groups.length
        ? groups.map((gr) => ({ key: `@${gr}`, name: gr, kind: 'folder', detail: `${folders.filter((f) => f.group === gr).length} folders`, size: '' }))
        : folders.map(asItem);
  const picked = items.find((i) => i.key === view.sel) ?? null;

  // -- the address bar: up, and where we are ---------------------------------------
  const addr = { x: r.x, y: r.y, w: r.w, h: ADDR_H };
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(addr.x, addr.y, addr.w, addr.h);
  const up = { x: addr.x + 4, y: addr.y + 3, w: 30, h: ADDR_H - 6 };
  if (drawButton(ctx, ui, sk, `${spec.id}.up`, up, '^', { ...ghost(), disabled: !open && !group }, input) && (open || group)) {
    view.folder = open?.group ? `@${open.group}` : null;
    view.sel = null;
  }
  const trail = [spec.root, open?.group ?? group, open?.name].filter(Boolean).join('  >  ');
  drawText(ctx, ellipsize(ctx, trail, FONT.body, addr.w - 50), addr.x + 44, addr.y + 8, FONT.body, color(sk.text_hi));

  // -- the toolbar: what can be done with the picked item -------------------------
  const bar = { x: r.x, y: r.y + ADDR_H, w: r.w, h: BAR_H };
  ctx.fillStyle = color(sk.line);
  ctx.fillRect(bar.x, bar.y + bar.h - 1, bar.w, 1);
  let bx = bar.x + 6;
  (picked?.actions ?? []).forEach((a) => {
    const w = Math.min(Math.max(a.text.length * 8 + 26, 80), 150);
    if (bx + w > bar.x + bar.w) return;
    if (drawButton(ctx, ui, sk, a.id, { x: bx, y: bar.y + 4, w, h: BAR_H - 9 }, a.text, a.style, input)) events.push({ type: 'click', id: a.id });
    bx += w + 6;
  });
  if (!picked) drawText(ctx, open ? 'pick a file to see what you can do with it' : 'open a folder', bar.x + 8, bar.y + 10, FONT.body, color(sk.dim));

  // -- the tree ---------------------------------------------------------------------
  const body = { x: r.x, y: bar.y + BAR_H + 2, w: r.w, h: r.h - ADDR_H - BAR_H - STATUS_H - 4 };
  const tw = body.w < 480 ? 0 : 6 + dragWidth(ctx, sk, ui, input, view, `${spec.id}Tree`, body.x, 6, (spec.treeW ?? TREE_W) - 6, 84, Math.max(body.w * 0.6, 90), body.h, body.y);
  if (tw) {
    const node = (y, label, on, count, onClick, depth, id) => {
      const row = { x: body.x, y, w: tw - 6, h: 26 };
      if (on) {
        ctx.fillStyle = cssA(sk.accent, 0.18);
        ctx.fillRect(row.x, row.y, row.w, row.h);
      } else if (hit(row, input)) {
        ctx.fillStyle = cssA(sk.accent, 0.08);
        ctx.fillRect(row.x, row.y, row.w, row.h);
      }
      folderIcon(ctx, row.x + 6 + depth * 14, row.y + 5);
      drawText(ctx, ellipsize(ctx, label, FONT.body, row.w - 56 - depth * 14), row.x + 28 + depth * 14, row.y + 7, FONT.body, color(on ? sk.text_hi : sk.text));
      if (count !== null) drawText(ctx, String(count), row.x + row.w - 6, row.y + 7, FONT.body, color(sk.dim), { align: 'right' });
      // a folder of the tree can be a tutorial target; otherwise it is shut while a step is lit
      noteHint(ui, id, row);
      if (input.pressed && hit(row, input) && !lockedOut(ui, id)) onClick();
    };
    node(body.y, spec.root, !open && !group, null, () => { view.folder = null; view.sel = null; }, 0, `${spec.id}.node.root`);
    // the tree cascades: a drive, then its folders under it
    let row = 0;
    const next = () => body.y + 28 + row++ * 28;
    const lone = folders.filter((f) => !f.group);
    groups.forEach((gr) => {
      node(next(), gr, group === gr, null, () => { view.folder = `@${gr}`; view.sel = null; }, 1, `${spec.id}.node.@${gr}`);
      folders.filter((f) => f.group === gr).forEach((f) => node(next(), f.name, open?.id === f.id, f.items.length, () => { view.folder = f.id; view.sel = null; }, 2, `${spec.id}.node.${f.id}`));
    });
    lone.forEach((f) => node(next(), f.name, open?.id === f.id, f.items.length, () => { view.folder = f.id; view.sel = null; }, 1, `${spec.id}.node.${f.id}`));
  }

  // -- the details list --------------------------------------------------------------
  const list = { x: body.x + tw, y: body.y, w: body.w - tw, h: body.h };
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(list.x, list.y, list.w, HEAD_H);
  drawText(ctx, 'NAME', list.x + 30, list.y + 6, FONT.body, color(sk.dim));
  drawText(ctx, 'DETAILS', list.x + Math.floor(list.w * 0.42), list.y + 6, FONT.body, color(sk.dim));
  drawText(ctx, 'SIZE', list.x + list.w - 14, list.y + 6, FONT.body, color(sk.dim), { align: 'right' });
  const rows = custom(Math.max(items.length * ROW_H, ROW_H), (c, s, rr, inp, ev = events) => {
    if (!items.length) drawText(c, open?.empty ?? 'this folder is empty', rr.x + 10, rr.y + 8, FONT.body, color(s.dim));
    items.forEach((it, i) => {
      const row = { x: rr.x, y: rr.y + i * ROW_H, w: rr.w, h: ROW_H };
      const on = it.key === view.sel;
      if (on) {
        c.fillStyle = cssA(s.accent, 0.2);
        c.fillRect(row.x, row.y, row.w, row.h);
      } else if (inp && hit(row, inp)) {
        c.fillStyle = cssA(s.accent, 0.07);
        c.fillRect(row.x, row.y, row.w, row.h);
      }
      if (it.marker) {
        c.fillStyle = color(it.marker);
        c.fillRect(row.x, row.y + 2, 3, row.h - 4);
      }
      if (it.kind === 'folder') folderIcon(c, row.x + 8, row.y + 5);
      else fileIcon(c, row.x + 8, row.y + 5, it.tint ?? s.accent);
      const detailX = row.x + Math.floor(row.w * 0.42);
      drawText(c, ellipsize(c, it.name, FONT.body, detailX - row.x - 36), row.x + 30, row.y + 7, FONT.body, color(on ? s.text_hi : s.text));
      drawText(c, ellipsize(c, it.detail ?? '', FONT.body, row.x + row.w - SIZE_W - detailX - 6), detailX, row.y + 7, FONT.body, color(it.detailTint ?? s.dim));
      drawText(c, it.size ?? '', row.x + row.w - 14, row.y + 7, FONT.body, color(s.warn), { align: 'right' });
      // a row the tutorial points at is scrolled into view once and noted; any other is shut while a step is lit
      const rowId = `${spec.id}.row.${it.key}`;
      noteHint(ui, rowId, row);
      if (ui.hint?.has(rowId) && view.revealed !== rowId) {
        view.revealed = rowId;
        ui.scroll.set(`${spec.id}.${view.folder ?? 'root'}`, Math.max(i * ROW_H - 2 * ROW_H, 0));
      }
      // a right click on a row that has a menu opens it
      if (it.menu && inp) ctxSource(ui, inp, row, rowId, it.menu, lockedOut(ui, rowId));
      if (inp?.pressed && hit(row, inp) && !lockedOut(ui, rowId)) {
        // a folder in the root list opens; a file is picked
        if (it.kind === 'folder') { view.folder = it.key; view.sel = null; } else {
          // a second press on the same file within a moment opens it
          const now = globalThis.performance?.now?.() ?? Date.now();
          if (it.open && view.lastKey === it.key && now - (view.lastAt ?? 0) < 500) ev.push({ type: 'click', id: it.open });
          view.lastKey = it.key;
          view.lastAt = now;
          view.sel = it.key;
        }
      }
    });
  });
  drawScrolled(ctx, sk, { x: list.x, y: list.y + HEAD_H, w: list.w, h: list.h - HEAD_H }, [rows], `${spec.id}.${view.folder ?? 'root'}`, ui, input, events);

  // -- the status bar ----------------------------------------------------------------
  const st = { x: r.x, y: r.y + r.h - STATUS_H, w: r.w, h: STATUS_H };
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(st.x, st.y, st.w, st.h);
  const left = picked?.note ? picked.note : `${items.length} item${items.length === 1 ? '' : 's'}`;
  drawText(ctx, ellipsize(ctx, left, FONT.body, st.w * 0.55), st.x + 8, st.y + 6, FONT.body, color(picked?.note ? sk.warn : sk.dim));
  if (spec.status) drawText(ctx, spec.status.text, st.x + st.w - 8, st.y + 6, FONT.body, color(spec.status.tint ?? sk.dim), { align: 'right' });
}
