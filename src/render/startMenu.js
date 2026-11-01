// The Start menu: the banner on the side, the operator, the installed
// software and the way out.

import { draw as drawText, ellipsize, measure, FONT } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { hit } from '../ui/kit.js';
import { WINDOWS } from '../state/windows.js';

/// The applications the menu lists: a hidden one is opened another way.
const LISTED = WINDOWS.filter((w) => !w.hidden);

/// The rect the menu takes up on the screen.
export function startMenuRect(screen) {
  // tall enough for the header, every application and the way out
  const w = 300;
  const h = Math.min(Math.max(430, 12 + 62 + 24 + LISTED.length * 32 + 62), screen.h - 34);
  return { x: screen.x, y: screen.y + screen.h - h - 34, w, h };
}

/// Draws the menu. Returns the key that was picked, or null.
export function drawStartMenu(ctx, sk, screen, game, ui, input) {
  const r = startMenuRect(screen);
  const sideW = 34;
  // the frame
  ctx.fillStyle = color(sk.menu_bg);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(sk.xp_border);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  // the banner on the side
  const side = { x: r.x, y: r.y, w: sideW, h: r.h };
  ctx.fillStyle = color(sk.menu_side);
  ctx.fillRect(side.x, side.y, side.w, side.h);
  ctx.save();
  ctx.translate(side.x + sideW - 8, side.y + side.h - 12);
  ctx.rotate(-Math.PI / 2);
  drawText(ctx, 'BLACKGATE', 0, 0, FONT.emphasis, color(sk.accent));
  ctx.restore();
  // the operator
  const body = { x: r.x + sideW + 12, y: r.y + 12, w: r.w - sideW - 24, h: r.h - 24 };
  drawText(ctx, ellipsize(ctx, game.player.handle, FONT.emphasis, body.w), body.x, body.y, FONT.emphasis, color(sk.text_hi));
  drawText(ctx, 'log off to change operator', body.x, body.y + 24, FONT.body, color(sk.dim));

  // the applications the shell carries
  let y = body.y + 50;
  drawText(ctx, 'APPLICATIONS', body.x, y, FONT.body, color(sk.dim));
  y += 24;
  let picked = null;
  LISTED.forEach((w) => {
    const row = { x: body.x, y, w: body.w, h: 30 };
    const over = hit(row, input);
    if (over) {
      ctx.fillStyle = color(sk.accent_dim);
      ctx.fillRect(row.x, row.y, row.w, row.h);
    }
    drawText(ctx, ellipsize(ctx, w.title, FONT.body, row.w - 12), row.x + 6, row.y + row.h / 2, FONT.body, color(over ? sk.text_hi : sk.text), { baseline: 'middle' });
    if (over && input.pressed) picked = w.key;
    y += row.h + 2;
  });

  // the way out
  const off = { x: body.x, y: r.y + r.h - 44, w: body.w, h: 34 };
  const overOff = hit(off, input);
  if (overOff) {
    ctx.fillStyle = cssA(sk.danger, 0.15);
    ctx.fillRect(off.x, off.y, off.w, off.h);
  }
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(off.x + 0.5, off.y + 0.5, off.w - 1, off.h - 1);
  drawText(ctx, 'Turn off the PC', off.x + 12, off.y + off.h / 2, FONT.body, color(overOff ? sk.danger : sk.text), {
    baseline: 'middle',
  });
  if (overOff && input.pressed) picked = '__power__';
  return picked;
}
