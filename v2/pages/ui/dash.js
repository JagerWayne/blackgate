// The dashboard pieces of the Device Manager: stat tiles with a gauge, status
// chips, a segmented control and a step bar. Flat panels, 1 px borders, small
// upper-case captions; every colour is a skin token.

import { draw as drawText, ellipsize, measure, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { drawButton } from './widgets.js';
import { ghost, primary, flat } from './styles.js';

/// The colour of a tone in the skin.
export const toneColor = (sk, tone) => sk[{ ok: 'ok', warn: 'warn', danger: 'danger', accent: 'accent', dim: 'dim' }[tone] ?? 'dim'];

/// A bordered card with a caption bar. Returns the rect inside it.
export function card(ctx, sk, r, caption, right = '') {
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  let top = r.y;
  if (caption) {
    drawText(ctx, ellipsize(ctx, caption, FONT.body, r.w - 20), r.x + 10, r.y + 7, FONT.body, color(sk.dim));
    if (right) drawText(ctx, ellipsize(ctx, right, FONT.body, r.w * 0.5), r.x + r.w - 10, r.y + 7, FONT.body, color(sk.dim), { align: 'right' });
    ctx.strokeStyle = color(sk.line);
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + 26.5);
    ctx.lineTo(r.x + r.w, r.y + 26.5);
    ctx.stroke();
    top = r.y + 28;
  }
  return { x: r.x + 10, y: top + 8, w: Math.max(r.w - 20, 20), h: Math.max(r.y + r.h - top - 14, 10) };
}

/// A pill with a status word. Returns its width, so chips can be laid in a row.
export function chip(ctx, sk, x, y, text, tone = 'dim') {
  const w = measure(ctx, text, FONT.body) + 18;
  const c = toneColor(sk, tone);
  ctx.fillStyle = cssA(c, 0.16);
  ctx.fillRect(x, y, w, 22);
  ctx.strokeStyle = cssA(c, 0.8);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 21);
  drawText(ctx, text, x + 9, y + 4, FONT.body, color(c));
  return w;
}

/// A thin gauge: a track and a fill of `frac` (0-1). A fill past `warnAt` turns amber, past `dangerAt` red.
export function gauge(ctx, sk, r, frac, warnAt = 0.8, dangerAt = 0.95) {
  const f = Math.min(Math.max(Number.isFinite(frac) ? frac : 0, 0), 1);
  ctx.fillStyle = color(sk.track);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const tone = f >= dangerAt ? sk.danger : f >= warnAt ? sk.warn : sk.accent;
  ctx.fillStyle = color(tone);
  ctx.fillRect(r.x, r.y, Math.round(r.w * f), r.h);
}

/// A metric tile: a caption, the value, a line under it and an optional gauge.
export function statTile(ctx, sk, r, label, value, { frac = null, sub = '', tone = null } = {}) {
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  drawText(ctx, ellipsize(ctx, label, FONT.body, r.w - 20), r.x + 10, r.y + 7, FONT.body, color(sk.dim));
  drawText(ctx, ellipsize(ctx, value, FONT.emphasis, r.w - 20), r.x + 10, r.y + 26, FONT.emphasis, color(tone ? toneColor(sk, tone) : sk.text_hi));
  if (sub) drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w - 20), r.x + 10, r.y + 47, FONT.body, color(sk.dim));
  if (frac !== null) gauge(ctx, sk, { x: r.x + 10, y: r.y + r.h - 10, w: r.w - 20, h: 4 }, frac);
}

/// A row of joined buttons, one active. `items` are `{ id, label }`; clicks become events.
export function segmented(ctx, sk, ui, input, events, r, items, active) {
  const w = Math.floor(r.w / items.length);
  items.forEach((it, i) => {
    const rr = { x: r.x + i * w, y: r.y, w: i === items.length - 1 ? r.w - w * i : w, h: r.h };
    const style = i === active ? primary() : { ...flat(), mono: true };
    if (drawButton(ctx, ui, sk, it.id, rr, ellipsize(ctx, it.label, FONT.body, rr.w - 10), { ...style, tip: it.tip }, input)) events.push({ type: 'click', id: it.id });
  });
}

/// A step bar: numbered markers joined by a line. `steps` are `{ label, state }`
/// with state 'done', 'current' or 'todo'; a step with an `id` can be clicked.
export function stepper(ctx, sk, ui, input, events, r, steps) {
  const w = r.w / steps.length;
  steps.forEach((s, i) => {
    const cx = r.x + w * i + w / 2;
    const cy = r.y + 11;
    if (i) {
      ctx.strokeStyle = color(steps[i - 1].state === 'done' ? sk.ok : sk.line);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - w + 14, cy);
      ctx.lineTo(cx - 14, cy);
      ctx.stroke();
    }
    const tone = s.state === 'done' ? sk.ok : s.state === 'current' ? sk.accent : sk.line;
    ctx.fillStyle = s.state === 'todo' ? color(sk.panel2) : color(tone);
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color(tone);
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, s.state === 'done' ? 'OK' : String(i + 1), cx, cy, FONT.body, color(s.state === 'todo' ? sk.dim : sk.void), { align: 'center', baseline: 'middle' });
    drawText(ctx, ellipsize(ctx, s.label, FONT.body, w - 8), cx, r.y + 30, FONT.body, color(s.state === 'current' ? sk.text_hi : s.state === 'done' ? sk.dim : sk.dim), { align: 'center' });
    if (s.id) {
      const hitR = { x: cx - w / 2, y: r.y, w, h: 46 };
      if (drawButton(ctx, ui, sk, s.id, hitR, '', { ...ghost(), dark: { fill: null, hover: null, border: null, text: 'text' }, tip: s.tip }, input)) events.push({ type: 'click', id: s.id });
    }
  });
}
