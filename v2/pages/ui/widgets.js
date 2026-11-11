// The widgets a form is made of: the button and the check box. Each one
// draws itself and reports what the operator did with it.

import { addTip, tipFor } from '../../game/core/tooltip.js';
import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { hit, resolveStyle, mixHex, gamma, roundRect, blind } from './kit.js';
import { noteHint, lockedOut } from './hint.js';

export { makeUiState, hit, resolveStyle } from './kit.js';

/// Draws a button and reports whether it was clicked. While the tutorial lights
/// its step, a button it does not light is drawn faded and cannot be pressed.
export function drawButton(ctx, st, sk, id, r, text, style, input) {
  if (!lockedOut(st, id)) return drawLive(ctx, st, sk, id, r, text, style, input);
  ctx.save();
  ctx.globalAlpha *= 0.45;
  drawLive(ctx, st, sk, id, r, text, { ...style, disabled: true }, input);
  ctx.restore();
  return false;
}

function drawLive(ctx, st, sk, id, r, text, style, input) {
  const s = resolveStyle(style, sk);
  // every button can be hovered: its own tip, or the one for its kind
  addTip(r, style?.tip ?? tipFor(id));
  noteHint(st, id, r);
  st.seen?.add(id);
  const hot = !s.disabled && hit(r, input);
  if (hot) st.hover = id;
  let clicked = false;
  // the default button: Enter presses it. The last one drawn is the one on
  // top, so it wins.
  if (style?.isDefault && !s.disabled) st.defaultId = id;
  if (st.fire === id && !s.disabled) {
    clicked = true;
    st.fire = null;
  }
  if (hot && input.pressed) st.active = id;
  if (st.active === id && input.released) {
    if (hot) clicked = true;
    st.active = null;
  }
  const held = st.active === id && hot;
  let fill = s.fill;
  // a disabled face washes out toward the panel instead of going black, so
  // its caption stays readable
  if (s.disabled) fill = s.fill === null ? null : mixHex(s.fill, sk.panel, 0.7);
  else if (held) fill = gamma(s.hover, 0.8);
  else if (hot) fill = s.hover;
  if (fill !== null) {
    ctx.fillStyle = color(fill);
    roundRect(ctx, r, s.radius);
    ctx.fill();
    // the XP bevel: light along the top, shadow underneath
    ctx.fillStyle = cssA(mixHex(fill, 0xffffff, hot ? 0.45 : 0.32), 0.6);
    ctx.fillRect(r.x + 2, r.y + 1, r.w - 4, 1);
    ctx.fillStyle = cssA(mixHex(fill, 0x000000, 0.28), 0.6);
    ctx.fillRect(r.x + 2, r.y + r.h - 2, r.w - 4, 1);
  }
  if (s.border !== null) {
    ctx.strokeStyle = color(s.border);
    ctx.lineWidth = 1;
    roundRect(ctx, r, s.radius);
    ctx.stroke();
  }
  const label = ellipsize(ctx, text, s.size, Math.max(r.w - s.pad * 2, 4));
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, s.size, color(s.disabled ? sk.dim : s.text), {
    align: 'center',
    baseline: 'middle',
  });
  return clicked;
}

/// Draws a check box and reports its new state, or null when it did not move.
export function drawCheck(ctx, st, sk, id, r, text, on, input) {
  if (lockedOut(st, id)) input = blind(input);
  const box = { x: r.x, y: r.y + (r.h - 16) / 2, w: 16, h: 16 };
  const hot = hit(r, input);
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = color(hot ? sk.accent : sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  if (on) {
    ctx.strokeStyle = color(sk.accent);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(box.x + 3, box.y + 8);
    ctx.lineTo(box.x + 6, box.y + 12);
    ctx.lineTo(box.x + 13, box.y + 4);
    ctx.stroke();
  }
  drawText(ctx, text, box.x + box.w + 6, r.y + r.h / 2, FONT.body, color(sk.text), {
    baseline: 'middle',
  });
  if (hot && input.pressed) return !on;
  return null;
}
