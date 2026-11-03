// The animations of running tasks. Each is drawn from the task's progress, a
// seed made from the task and the clock of the interface, so the same task
// always looks the same at the same progress.

import { draw as drawText, ellipsize } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { custom } from './controls.js';

const HEX = '0123456789ABCDEF';
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789#$%&@';
const HEIGHT = 58;
const STRIP = 30;

/// A small fixed hash: the same text always gives the same numbers.
function hash(text, n) {
  let h = 2166136261 ^ n;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/// The row of a running task: its label and percent over its animation.
export function taskRow(task, time) {
  return custom(HEIGHT, (ctx, sk, r) => {
    const p = Math.min(Math.max(task.progress, 0), 1);
    const pct = `${Math.round(p * 100)}%`;
    drawText(ctx, ellipsize(ctx, task.label, 10.5, r.w - 50), r.x, r.y, 10.5, color(sk.text_hi));
    drawText(ctx, pct, r.x + r.w, r.y, 10.5, color(sk.accent), { align: 'right' });
    const box = { x: r.x, y: r.y + 20, w: r.w, h: STRIP };
    ctx.fillStyle = color(sk.inset);
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const fx = FX[task.kind] ?? blocks;
    fx(ctx, sk, box, p, time, `${task.kind}:${task.label}:${task.lane}`, task);
    // the progress line under every animation
    ctx.fillStyle = color(sk.accent);
    ctx.fillRect(box.x, box.y + box.h - 2, box.w * p, 2);
  });
}

/// Password: glyphs spin, and lock in from the left as the breaker wins.
function crack(ctx, sk, box, p, time, seed) {
  const n = Math.max(Math.min(Math.floor((box.w - 16) / 16), 16), 4);
  const locked = Math.floor(p * n);
  for (let i = 0; i < n; i += 1) {
    const on = i < locked;
    const k = on ? hash(seed, i) : hash(seed, i * 977 + Math.floor(time * 18));
    const ch = GLYPHS[k % GLYPHS.length];
    drawText(ctx, ch, box.x + 10 + i * 16, box.y + 7, 13, on ? color(sk.ok) : cssA(sk.accent, 0.55));
  }
}

/// Decryption: a block of hex settles into the plain text, in a scattered order.
function decrypt(ctx, sk, box, p, time, seed, task) {
  const cols = Math.max(Math.floor((box.w - 12) / 9), 8);
  const plain = `${task.label.replace(/^decrypt\s*/i, '').toUpperCase()} // PLAINTEXT RECOVERED // `;
  for (let i = 0; i < cols; i += 1) {
    const done = (hash(seed, i) % 1000) / 1000 < p;
    const ch = done ? plain[i % plain.length] : HEX[hash(seed, i * 31 + Math.floor(time * 14)) % 16];
    drawText(ctx, ch, box.x + 6 + i * 9, box.y + 8, 11, done ? color(sk.ok) : cssA(sk.inset_text, 0.45));
  }
}

/// Voice: a moving waveform; the bands matched so far light up.
function wave(ctx, sk, box, p, time, seed) {
  const n = Math.max(Math.floor(box.w / 6), 8);
  const mid = box.y + box.h / 2 - 1;
  for (let i = 0; i < n; i += 1) {
    const amp = 0.25 + ((hash(seed, i) % 100) / 100) * 0.75;
    const v = Math.abs(Math.sin(time * 6 + i * 0.55)) * amp * (box.h / 2 - 4);
    ctx.fillStyle = i / n < p ? color(sk.ok) : cssA(sk.accent, 0.45);
    ctx.fillRect(box.x + 3 + i * 6, mid - v, 3, Math.max(v * 2, 1));
  }
}

/// Bypass: a grid of ports, turning over one by one.
function ports(ctx, sk, box, p, time, seed) {
  const cols = Math.max(Math.floor((box.w - 8) / 12), 4);
  const n = cols * 2;
  const passed = Math.floor(p * n);
  for (let i = 0; i < n; i += 1) {
    const x = box.x + 6 + (i % cols) * 12;
    const y = box.y + 5 + Math.floor(i / cols) * 11;
    const probing = i === passed && Math.floor(time * 8) % 2 === 0;
    ctx.fillStyle = i < passed ? color(sk.ok) : probing ? color(sk.warn) : cssA(sk.inset_text, 0.18);
    ctx.fillRect(x, y, 8, 8);
  }
}

/// Copy, delete and the rest: blocks fill in; a deletion strikes them out.
function blocks(ctx, sk, box, p, time, seed, task) {
  const n = Math.max(Math.floor((box.w - 8) / 10), 4);
  const filled = Math.floor(p * n);
  const strike = task.kind === 'DeleteFile' || task.kind === 'WipeLogs';
  for (let i = 0; i < n; i += 1) {
    const x = box.x + 5 + i * 10;
    const on = i < filled;
    ctx.fillStyle = on ? (strike ? color(sk.danger) : color(sk.accent)) : cssA(sk.inset_text, 0.15);
    ctx.fillRect(x, box.y + 8, 7, 12);
    if (on && strike) {
      ctx.fillStyle = color(sk.inset);
      ctx.fillRect(x, box.y + 13, 7, 2);
    }
  }
}

const FX = {
  CrackPassword: crack,
  DecryptFile: decrypt,
  RecordVoice: wave,
  PlayVoiceprint: wave,
  BypassFirewall: ports,
  BypassMonitor: ports,
  BypassProxy: ports,
  Ddos: ports,
};
