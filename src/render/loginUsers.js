// The users on the welcome screen, right of the divider: one tile per saved
// operator, the picked one lit, with its go arrow and the two-step delete.

import { draw as drawText, ellipsize } from '../core/text.js';
import { hit, drawButton } from '../ui/widgets.js';
import { roundRect } from '../ui/kit.js';

export const SANS = 'Tahoma, Verdana, sans-serif';
export const ROW_H = 64;
export const NEW_H = 92;

const look = (o) => ({ size: 12, pad: 6, radius: 3, disabled: false, mono: false, glow: false, dark: o, light: o });
/// A button with no face: the caller draws it.
export const BARE = look({ fill: null, hover: null, border: null, text: 0xffffff });
const GO = { ...look({ fill: 0x3a9a3a, hover: 0x52b852, border: 0xffffff, text: 0xffffff }), size: 15, isDefault: true };
const DEL = look({ fill: 0x2a55c0, hover: 0x3a6ad8, border: 0xc9d8f8, text: 0xffffff });
const ARMED = look({ fill: 0xb8321e, hover: 0xd8481a, border: 0xffffff, text: 0xffffff });
const HUES = ['#3f8f3a', '#c0661c', '#7a3fa8', '#1f7fae', '#a83a4a', '#8a8a1e'];

/// Draws the saved users and returns where the new-session entry goes.
export function drawUsers(ctx, st, sk, list, input, ui, events) {
  const fits = Math.max(Math.floor((list.h - NEW_H) / ROW_H), 0);
  const shown = st.slots.slice(0, fits);
  let y = list.y + Math.max((list.h - shown.length * ROW_H - NEW_H) / 2, 0);
  shown.forEach((s, i) => {
    const r = { x: list.x, y, w: list.w, h: ROW_H - 6 };
    pick(st, r, i + 1, input);
    const on = st.sel === i + 1;
    const go = goRect(r);
    const del = { x: go.x - 8 - 104, y: r.y + (r.h - 24) / 2, w: 104, h: 24 };
    tile(ctx, r, on, s.handle, `${s.rank} · ${s.credits} cr · day ${s.day}`, HUES[i % HUES.length], s.handle[0] ?? '?', on ? del.x - 8 : r.x + r.w - 8);
    if (on) {
      goButton(ctx, sk, go, input, ui, events);
      // the button that throws the save away, in two steps
      const armed = st.confirmDelete;
      if (drawButton(ctx, ui, sk, 'login.delete', del, armed ? 'Confirm delete' : 'Delete save', armed ? ARMED : DEL, input)) {
        events.push({ type: 'click', id: 'login.delete' });
      }
    }
    y += ROW_H;
  });
  return y;
}

/// A press anywhere on an entry picks it. Pressing the picked one again does
/// not disarm the delete, so its second press can land.
export function pick(st, r, sel, input) {
  if (!(hit(r, input) && input.pressed) || st.sel === sel) return;
  st.sel = sel;
  st.confirmDelete = false;
}

/// Where the green arrow sits on an entry.
export const goRect = (r) => ({ x: r.x + r.w - 34, y: r.y + 15, w: 28, h: 28 });

/// The green arrow on the picked entry; Enter presses it.
export function goButton(ctx, sk, b, input, ui, events) {
  if (drawButton(ctx, ui, sk, 'login.go', b, '→', GO, input)) events.push({ type: 'click', id: 'login.go' });
}

/// One entry: the lit band when picked, the icon tile, the name and a line
/// under it.
export function tile(ctx, r, on, title, sub, hue, letter, textRight, subTint = '#d6e4ff') {
  if (on) {
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, 'rgba(0,48,156,0.95)');
    g.addColorStop(0.75, 'rgba(0,48,156,0.5)');
    g.addColorStop(1, 'rgba(0,48,156,0.1)');
    ctx.fillStyle = g;
    roundRect(ctx, r, 6);
    ctx.fill();
  }
  const s = 48;
  const ix = r.x + 6;
  const iy = r.y + 5;
  ctx.fillStyle = hue;
  roundRect(ctx, { x: ix, y: iy, w: s, h: s }, 5);
  ctx.fill();
  ctx.strokeStyle = on ? '#f8b048' : 'rgba(255,255,255,0.75)';
  ctx.lineWidth = on ? 3 : 2;
  ctx.stroke();
  drawText(ctx, letter.toUpperCase(), ix + s / 2, iy + s / 2 + 1, 24, '#ffffff', { align: 'center', baseline: 'middle', family: SANS });
  const tx = ix + s + 12;
  const room = Math.max(textRight - tx, 20);
  drawText(ctx, ellipsize(ctx, title, 16, room, SANS), tx, iy + 15, 16, '#ffffff', { baseline: 'middle', family: SANS });
  if (sub) drawText(ctx, ellipsize(ctx, sub, 11, room, SANS), tx, iy + 36, 11, subTint, { baseline: 'middle', family: SANS });
}
