// A form in a box that scrolls when the form is taller than the box.

import { color } from '../../game/core/theme.js';
import { placeControls, measureControls } from './layout.js';
import { drawControls } from './draw.js';

/// Draws a form in a box that scrolls when the form is taller than the box.
export function drawScrolled(ctx, sk, box, controls, id, ui, input, events) {
  // the room the contents get: the scrollbar sits in the last few pixels, so
  // nothing is drawn under it
  const innerW = Math.max(box.w - 14, 20);
  const height = measureControls(ctx, controls, innerW);
  const max = Math.max(height - box.h, 0);
  const off = Math.min(ui.scroll.get(id) ?? 0, max);
  const over = box.h > 0 && input.inside
    && input.mouse.x >= box.x && input.mouse.x <= box.x + box.w
    && input.mouse.y >= box.y && input.mouse.y <= box.y + box.h;
  if (over && Math.abs(input.scroll) > 0.1) {
    ui.scroll.set(id, Math.min(Math.max(off - input.scroll * 0.6, 0), max));
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  const top = box.y - off;
  const { placed } = placeControls(ctx, controls, innerW, top, top + box.h);
  // a highlight noted inside this box is only lit where the box shows it
  const outer = ui.hintClip;
  ui.hintClip = box;
  drawControls(ctx, placed.map((p) => ({ ...p, x: box.x })), sk, input, ui, events);
  ui.hintClip = outer;
  ctx.restore();
  if (max > 0) {
    ctx.fillStyle = color(sk.deep);
    ctx.fillRect(box.x + box.w - 6, box.y, 4, box.h);
    const th = Math.max((box.h * box.h) / height, 24);
    const ty = box.y + (box.h - th) * (off / max);
    ctx.fillStyle = color(sk.line_hi);
    ctx.fillRect(box.x + box.w - 6, ty, 4, th);
  }
}
