// Resizing a window: the grabbed edge follows the pointer one for one, however
// many frames the drag takes.
// Run with: node --test tests/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindows, openWindow, findWindow } from '../src/state/windows.js';
import { drawWindow } from '../src/render/windowFrame.js';
import { makeUiState } from '../src/ui/kit.js';
import { theme } from '../src/core/theme.js';
import { stubCtx } from './stubCanvas.mjs';

const DESK = { x: 0, y: 44, w: 1600, h: 822 };

/// One frame with the pointer at (x, y).
function frame(mgr, win, x, y, { pressed = false, down = true } = {}) {
  const input = {
    inside: true, mouse: { x, y }, pressed, down, released: !down,
    rightPressed: false, scroll: 0,
  };
  drawWindow(stubCtx(), theme(), win, mgr, makeUiState(), input, []);
}

/// Drags from (x0, y0) to (x1, y1) over `steps` frames, then lets go.
function drag(mgr, win, x0, y0, x1, y1, steps) {
  frame(mgr, win, x0, y0, { pressed: true });
  for (let i = 1; i <= steps; i += 1) {
    frame(mgr, win, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
  }
  frame(mgr, win, x1, y1, { down: false });
}

for (const steps of [1, 2, 10]) {
  test(`the bottom-right grip follows the pointer over ${steps} frame(s)`, () => {
    const mgr = makeWindows();
    const win = openWindow(mgr, 'mail', DESK);
    const { w, h } = win;
    const gx = win.x + win.w - 4;
    const gy = win.y + win.h - 4;
    drag(mgr, win, gx, gy, gx + 60, gy + 40, steps);
    assert.equal(win.w, w + 60);
    assert.equal(win.h, h + 40);
  });
}

test('the left edge moves the window and keeps the right edge still', () => {
  const mgr = makeWindows();
  const win = openWindow(mgr, 'mail', DESK);
  const right = win.x + win.w;
  const lx = win.x + 2;
  const ly = win.y + 100;
  drag(mgr, win, lx, ly, lx - 30, ly, 5);
  assert.equal(win.x + win.w, right, 'right edge stays');
  assert.equal(win.w, findWindow(mgr, 'mail').w);
  assert.equal(win.x, lx - 2 - 30);
});

test('a resize stops at the minimum size', () => {
  const mgr = makeWindows();
  const win = openWindow(mgr, 'mail', DESK);
  const gx = win.x + win.w - 4;
  const gy = win.y + win.h - 4;
  drag(mgr, win, gx, gy, gx - 2000, gy - 2000, 4);
  assert.equal(win.w, win.minW);
  assert.equal(win.h, win.minH);
});
