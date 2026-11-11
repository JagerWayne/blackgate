// Right-click menus. A target (a file row, a service row, the host's name)
// calls `ctxSource` while it is drawn; a right press on it opens a menu of what
// can be done with it. The window draws the open menu last with `drawCtx`. An
// item is `{ id, text, note?, why? }`: `id` is the click event it sends, `note`
// a small line under the text and `why` the reason it cannot be used (the item
// is then greyed and shows the reason). An item without an id is only a line.

import { draw as drawText, ellipsize, wrapLines, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { hit, roundRect } from './kit.js';
import { noteHint, lockedOut } from './hint.js';

const W = 280;
const PAD = 4;

/// The height of an item: one line, or two with a note or a reason.
const itemH = (it) => (it.why || it.note ? 48 : 30);

/// A right press on `rect` opens the menu for `key`. `items` is called then, not
/// every frame. A locked target (the tutorial lights something else) opens none.
export function ctxSource(ui, input, rect, key, items, locked = false) {
  if (!locked && input.rightPressed && hit(rect, input)) ui.ctx = { key, items: items(), x: input.mouse.x, y: input.mouse.y, fresh: true };
}

/// The box of the open menu inside `bounds`, or null when none is open.
export function ctxRect(ui, bounds) {
  const m = ui.ctx;
  if (!m) return null;
  const h = m.items.reduce((n, it) => n + itemH(it), 0) + PAD * 2;
  return {
    x: Math.min(Math.max(m.x, bounds.x), bounds.x + bounds.w - W),
    y: Math.min(Math.max(m.y, bounds.y), Math.max(bounds.y + bounds.h - h, bounds.y)),
    w: W,
    h,
  };
}

/// Draws the open menu and takes its clicks: an item that can be used sends its
/// click and closes the menu; a press anywhere else, or Escape, closes it.
export function drawCtx(ctx, sk, ui, input, events, bounds) {
  const m = ui.ctx;
  const r = ctxRect(ui, bounds);
  if (!m || !r) return;
  m.rect = r;
  ctx.fillStyle = color(sk.panel);
  roundRect(ctx, r, 6);
  ctx.fill();
  ctx.strokeStyle = color(sk.accent);
  ctx.lineWidth = 1;
  roundRect(ctx, { x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }, 6);
  ctx.stroke();
  let y = r.y + PAD;
  let chosen = false;
  m.items.forEach((it) => {
    const box = { x: r.x + PAD, y, w: r.w - PAD * 2, h: itemH(it) };
    y += box.h;
    const live = !!it.id && !it.why && !lockedOut(ui, it.id);
    if (it.id) noteHint(ui, it.id, box);
    const over = live && hit(box, input);
    if (over) {
      ctx.fillStyle = cssA(sk.accent, 0.22);
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }
    drawText(ctx, ellipsize(ctx, it.text, FONT.body, box.w - 20), box.x + 10, box.y + 7, FONT.body, color(live ? sk.text_hi : sk.dim));
    const sub = it.why ?? it.note;
    if (sub) drawText(ctx, wrapLines(ctx, sub, FONT.body - 2, box.w - 20)[0], box.x + 10, box.y + 27, FONT.body - 2, color(it.why ? sk.warn : sk.dim));
    if (over && input.pressed) {
      events.push({ type: 'click', id: it.id });
      chosen = true;
    }
  });
  // the press that opened the menu does not close it
  const away = !m.fresh && (input.pressed || input.rightPressed) && !hit(r, input);
  m.fresh = false;
  if (chosen || away || input.esc) ui.ctx = null;
}
