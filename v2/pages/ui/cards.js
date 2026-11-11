// Cards: the building blocks that make a window look designed instead of
// listed. A tile (a label over a figure), a hero card (the one number a window
// is about), a usage bar and a pill. All draw with the skin's colours.

import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { roundRect } from './kit.js';

/// A filled rounded box.
export function plate(ctx, r, fill, radius = 8) {
  ctx.fillStyle = fill;
  roundRect(ctx, r, radius);
  ctx.fill();
}

/// A small coloured tag; returns the width it took.
export function pill(ctx, sk, x, y, text, tint) {
  const w = Math.ceil(text.length * 8.4) + 20;
  plate(ctx, { x, y, w, h: 24 }, cssA(tint, 0.18), 12);
  drawText(ctx, text, x + w / 2, y + 12, FONT.body, color(tint), { align: 'center', baseline: 'middle' });
  return w;
}

/// A tile: a dim label over a figure, with a coloured edge on top.
export function tile(ctx, sk, r, label, value, tint = sk.text_hi) {
  plate(ctx, r, color(sk.panel2), 10);
  ctx.fillStyle = cssA(tint, 0.9);
  ctx.fillRect(r.x + 14, r.y, 28, 3);
  drawText(ctx, ellipsize(ctx, label, FONT.body, r.w - 28), r.x + 14, r.y + 12, FONT.body, color(sk.dim));
  drawText(ctx, ellipsize(ctx, value, FONT.heading, r.w - 28), r.x + 14, r.y + r.h - 30, FONT.heading, color(tint));
}

/// The hero card: a kicker, one big figure, a line under it.
export function hero(ctx, sk, r, kicker, value, sub, tint = sk.warn) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, color(sk.accent_soft));
  g.addColorStop(1, color(sk.panel2));
  ctx.fillStyle = g;
  roundRect(ctx, r, 12);
  ctx.fill();
  ctx.strokeStyle = cssA(sk.accent, 0.35);
  ctx.lineWidth = 1;
  roundRect(ctx, { x: r.x + 0.5, y: r.y + 0.5, w: r.w - 1, h: r.h - 1 }, 12);
  ctx.stroke();
  drawText(ctx, kicker, r.x + 20, r.y + 16, FONT.body, color(sk.dim));
  drawText(ctx, ellipsize(ctx, value, FONT.title, r.w * 0.6), r.x + 20, r.y + 40, FONT.title, color(tint));
  if (sub) drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w * 0.6), r.x + 20, r.y + r.h - 28, FONT.body, color(sk.dim));
}

/// A usage bar: the filled share, in the tint (red when nearly full).
export function usage(ctx, sk, r, frac, tint = sk.accent) {
  plate(ctx, r, color(sk.deep), r.h / 2);
  const f = Math.min(Math.max(frac, 0), 1);
  if (f > 0) plate(ctx, { x: r.x, y: r.y, w: Math.max(r.h, r.w * f), h: r.h }, color(f > 0.9 ? sk.danger : tint), r.h / 2);
}
