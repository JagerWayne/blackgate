// The text fields and the progress meter: the controls the operator types
// into and the ones that report a number.

import { draw as drawText, ellipsize, measure } from '../core/text.js';
import { color } from '../core/theme.js';
import { hit } from './widgets.js';
import { roundRect } from './kit.js';

/// Draws a text field and returns its new value, or null when it did not
/// change. The caret sits after the text.
export function drawField(ctx, st, sk, id, r, value, hint, secret, input) {
  // Tab walks the fields in the order they are drawn
  st.fields?.push(id);
  const hot = hit(r, input);
  const focused = st.focus === id;
  if (hot && input.pressed) {
    st.focus = focused ? null : id;
    st.caret = (value ?? '').length;
  }
  ctx.fillStyle = color(focused ? sk.panel2 : sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(focused ? sk.accent : sk.line);
  ctx.lineWidth = focused ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  let text = value ?? '';
  if (secret) text = text.replace(/./g, '*');
  if (!text && hint && !focused) {
    drawText(ctx, ellipsize(ctx, hint, 14, r.w - 10), r.x + 5, r.y + r.h / 2, 14, color(sk.dim), {
      baseline: 'middle',
    });
    return null;
  }
  const shown = ellipsize(ctx, text, 14, r.w - 10);
  drawText(ctx, shown, r.x + 5, r.y + r.h / 2, 14, color(text ? sk.text : sk.dim), {
    baseline: 'middle',
  });
  if (focused) {
    const caretX = r.x + 5 + measure(ctx, text, 14);
    ctx.fillStyle = color(sk.text);
    ctx.fillRect(caretX, r.y + 5, 1, r.h - 10);
  }
  if (!focused) return null;
  let next = text;
  if (input.text) next += input.text;
  if (input.backspace) next = next.slice(0, -1);
  if (input.paste) next += input.paste;
  if (next === text) return null;
  st.caret = next.length;
  return next;
}

/// Draws a labelled progress bar. The track is a groove the fill sits in,
/// not a black bar: the empty part reads as empty, not as a redaction.
export function drawMeter(ctx, sk, r, label, frac, tint, mark = null) {
  drawText(ctx, ellipsize(ctx, label, 14, r.w), r.x, r.y, 14, color(sk.dim));
  const bar = { x: r.x, y: r.y + 22, w: r.w, h: 12 };
  // the groove
  roundRect(ctx, bar, 3);
  ctx.fillStyle = color(sk.track);
  ctx.fill();
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  roundRect(ctx, bar, 3);
  ctx.stroke();
  // the fill, with a rounded end
  const full = Math.max(0, Math.min(1, frac));
  const w = bar.w * full;
  if (w > 1) {
    const fill = { x: bar.x, y: bar.y, w: Math.max(w, 4), h: bar.h };
    roundRect(ctx, fill, 3);
    ctx.fillStyle = color(tint ?? sk.accent);
    ctx.fill();
  }
  // the threshold: a tick through the groove where something happens
  if (mark !== null && mark > 0 && mark < 1) {
    ctx.fillStyle = color(sk.danger);
    ctx.fillRect(Math.round(bar.x + bar.w * mark) - 1, bar.y - 3, 2, bar.h + 6);
  }
}
