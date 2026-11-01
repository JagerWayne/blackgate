// The shell's backdrop: the dark grid, and the BLACKGATE mark. Both are
// behind everything else the shell draws.

import { color, cssA } from '../core/theme.js';

/// The grid the shell sits on.
export function backdrop(ctx, w, h, sk) {
  ctx.fillStyle = color(sk.void);
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#0b1219';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 44) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y < h; y += 44) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
}

/// The BLACKGATE mark: a triangle with a box inside it.
export function logo(ctx, cx, cy, size, sk) {
  const w = size;
  const bx = cx - w / 2;
  const by = cy - w / 2;
  const p1 = { x: bx + w * 0.18, y: by + w * 0.2 };
  const p2 = { x: bx + w * 0.82, y: by + w * 0.2 };
  const p3 = { x: bx + w * 0.5, y: by + w * 0.82 };
  ctx.strokeStyle = cssA(sk.accent, 0.86);
  ctx.lineWidth = Math.max(w * 0.06, 1);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.stroke();
  const inner = w * 0.3;
  ctx.strokeStyle = cssA(sk.accent, 0.59);
  ctx.lineWidth = Math.max(w * 0.03, 1);
  ctx.strokeRect(cx - inner / 2, by + w * 0.42 - inner / 2, inner, inner);
}
