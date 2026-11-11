// Tutorial highlights and the lock that goes with them. The tutorial names the
// ids it wants lit (`ui.hint`); a control that is drawn with one of those ids
// notes its box here, and the play screen draws a ring round every box after
// the windows, so a window's clip cannot hide it.
//
// A ring is only drawn where the control can really be clicked: not under a
// window in front of it, not scrolled out of its box. When a window in front
// covers the target, the ring goes to that window's taskbar button instead,
// to bring it forward. While a step lights something, every other control is
// locked (see `lockedOut`), so nothing else can be pressed by mistake.

import { cssA } from '../../game/core/theme.js';
import { roundRect, blind } from './kit.js';
import { windowAt } from '../../game/state/windows.js';

/// What stays usable whatever the step: the tutorial's own buttons, the
/// taskbar and the Start button, the window controls and the pause button.
const OPEN = ['tut.', 'task.', 'start', 'win.', 'hdr.pause'];

/// Lights these ids this frame; none clears the highlights and the lock.
export function setHints(ui, ids) {
  ui.hint = ids?.length ? new Set(ids) : null;
}

/// A control calls this with its id and box while it is drawn. The layer it is
/// on (the window being drawn) and the box it is scrolled in go with it.
export function noteHint(ui, id, rect) {
  if (ui.hint?.has(id)) {
    (ui.hintRects ??= []).push({ ...rect, z: ui.hintZ ?? Infinity, win: ui.hintWin ?? null, clip: ui.hintClip ?? null });
  }
}

/// Is this control shut while the tutorial lights its step? Everything but the
/// lit ids and the always-open ones is. With nothing lit, nothing is locked.
export function lockedOut(ui, id) {
  if (!ui.hint || ui.hint.has(id)) return false;
  return !OPEN.some((p) => id === p || id.startsWith(p));
}

/// The input a control may see: blind to the pointer when it is locked.
export const gate = (ui, id, input) => (lockedOut(ui, id) ? blind(input) : input);

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/// One ring and an arrow above it.
function ring(ctx, sk, r, pulse) {
  const grow = 3 + pulse * 3;
  const box = { x: r.x - grow, y: r.y - grow, w: r.w + grow * 2, h: r.h + grow * 2 };
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = cssA(sk.warn, 0.55 + 0.45 * pulse);
  roundRect(ctx, box, 7);
  ctx.stroke();
  ctx.fillStyle = cssA(sk.warn, 0.12 + 0.1 * pulse);
  roundRect(ctx, r, 5);
  ctx.fill();
  // an arrow above the box points at it
  const ax = box.x + box.w / 2;
  const ay = box.y - 4 - pulse * 3;
  ctx.fillStyle = cssA(sk.warn, 1);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - 7, ay - 11);
  ctx.lineTo(ax + 7, ay - 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/// Draws a ring on every noted box that can be reached. `windows` is the window
/// manager and `blockers` the boxes drawn over the windows (the open Start
/// menu): a box under one of them is not lit, unless it is on the top layer.
/// Returns how many rings it drew.
export function drawHints(ctx, sk, ui, time, windows, blockers = []) {
  const rects = ui.hintRects ?? [];
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  const centres = [];
  const behind = new Set();
  let rings = 0;
  rects.forEach((r) => {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    centres.push({ x: cx, y: cy });
    // scrolled out of the box it sits in
    if (r.clip && !inside(r.clip, cx, cy)) return;
    if (r.z !== Infinity) {
      if (blockers.some((b) => inside(b, cx, cy))) return;
      // a window in front of the one the control is in
      const top = windows ? windowAt(windows, cx, cy) : null;
      if (top && top.z > r.z) {
        if (r.win) behind.add(r.win);
        return;
      }
    }
    ring(ctx, sk, r, pulse);
    rings += 1;
  });
  // a target under another window: its window's taskbar button is lit to bring it forward
  behind.forEach((key) => {
    const t = ui.taskRects?.[key];
    if (t) {
      ring(ctx, sk, t, pulse);
      rings += 1;
    }
  });
  ui.lastHintAt = centres;
  ui.hintRects = [];
  return rings;
}
