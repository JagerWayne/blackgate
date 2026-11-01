// A panel: the title, the tab strip and the body the content goes in.

import { draw as drawText, ellipsize, measure, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawButton } from './widgets.js';
import { ghost } from './styles.js';

/// Draws the frame of a panel and returns the body rect.
export function drawFrame(ctx, sk, r, ui, input, events, title, subtitle = '', tabs = [], active = 0) {
  let y = r.y;
  if (title) {
    drawText(ctx, ellipsize(ctx, title, FONT.heading, Math.max(r.w, 20)), r.x, y, FONT.heading, color(sk.text_hi));
    if (subtitle) {
      drawText(ctx, ellipsize(ctx, subtitle, FONT.body, Math.max(r.w, 20)), r.x, y + 26, FONT.body, color(sk.dim));
    }
    y += subtitle ? 48 : 30;
  } else if (subtitle) {
    // the caption already names the window: the panel only says what it holds
    drawText(ctx, ellipsize(ctx, subtitle, FONT.body, Math.max(r.w, 20)), r.x, y + 1, FONT.body, color(sk.dim));
    y += 26;
  }
  if (tabs.length) {
    let x = r.x;
    tabs.forEach((t, i) => {
      const label = t.count === undefined || t.count === null ? t.label : `${t.label} ${t.count}`;
      const w = Math.min(Math.max(measure(ctx, label, FONT.body) + 26, 28), r.w);
      // a tab that would run past the edge starts a second row
      if (x > r.x && x + w > r.x + r.w) {
        x = r.x;
        y += 34;
      }
      const rr = { x, y, w, h: 30 };
      const on = i === active;
      const flat = { ...ghost(), size: FONT.body, dark: { ...ghost().dark, fill: null, border: null, text: 'dim' }, light: { ...ghost().light, fill: null, border: null, text: 'dim' } };
      if (drawButton(ctx, ui, sk, t.id, rr, ellipsize(ctx, label, FONT.body, w - 12), on ? { ...ghost(), size: FONT.body } : flat, input)) {
        events.push({ type: 'click', id: t.id });
      }
      x += w + 4;
    });
    y += 34;
    ctx.strokeStyle = color(sk.line);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, y - 4.5);
    ctx.lineTo(r.x + r.w, y - 4.5);
    ctx.stroke();
    y += 4;
  }
  return { x: r.x, y, w: r.w, h: r.y + r.h - y };
}

/// A detail pane: the second ground, with its contents kept off the edges.
/// Returns the rect the contents go in.
export function detailPane(ctx, sk, r) {
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  return { x: r.x + 12, y: r.y + 10, w: Math.max(r.w - 18, 40), h: Math.max(r.h - 16, 20) };
}

/// A form column that stops growing past a comfortable reading width.
export function readable(r, max = 560) {
  return { x: r.x, y: r.y, w: Math.min(r.w, max), h: r.h };
}

/// The line a pane shows when it has nothing to show.
export function emptyNote(ctx, sk, r, text) {
  drawText(ctx, ellipsize(ctx, text, FONT.body, Math.max(r.w, 20)), r.x, r.y, FONT.body, color(sk.dim));
}

/// A heading with a rule under it, above a table. Returns the rect below it.
export function sectionHead(ctx, sk, r, text) {
  drawText(ctx, ellipsize(ctx, text, FONT.emphasis, Math.max(r.w, 20)), r.x, r.y, FONT.emphasis, color(sk.dim));
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + 24);
  ctx.lineTo(r.x + r.w, r.y + 24);
  ctx.stroke();
  return { x: r.x, y: r.y + 30, w: r.w, h: Math.max(r.h - 30, 0) };
}

/// Splits a panel into a list on the left and a detail on the right.
export function splitPanel(r, fraction, minList) {
  const gap = 10;
  const available = Math.max(r.w - gap, 2);
  const detailMin = Math.min(Math.max(available * 0.34, 90), 240);
  const lo = Math.min(60, available * 0.5);
  const hi = Math.max(available - detailMin, lo);
  const w = Math.min(Math.max(r.w * fraction, minList), hi);
  const list = { x: r.x, y: r.y, w, h: r.h };
  const detail = { x: list.x + w + gap, y: r.y, w: r.x + r.w - (list.x + w + gap), h: r.h };
  return [list, detail];
}
