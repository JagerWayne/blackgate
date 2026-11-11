// The Device Manager's picture: the machine's motherboard with every slot the
// chassis has. It is drawn like a real board (green PCB, copper traces, gold
// pins, white silkscreen); each kind of part has its own artwork, and the tier
// of a fitted part is its colour. A free slot is an empty socket, a kind the
// chassis lacks is hatched. Clicking a slot selects it.

import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { drawButton, hit } from '../ui/widgets.js';
import { componentDef } from '../../game/data/content.js';
import * as gw from '../../game/state/gateway.js';

// the board's own palette: a part does not change with the desktop skin
const PCB = 0x0c3526;
const PCB_HI = 0x15503b;
const TRACE = 0x2fa77a;
const GOLD = 0xd6b25e;
const SILK = 0xd8efe3;
const METAL = 0xb9c2cc;
const METAL_DK = 0x6d7782;
const SOCKET = 0x151a21;
const PICK = 0xffd75e;
/// The colour of a part by tier: grey, green, blue, violet, orange, red, gold.
const TIER = [0x8a97a6, 0x4fc27a, 0x3f9bf0, 0x9a6ae6, 0xf0953a, 0xe0524f, 0xf2cb4c];
const tierColor = (level) => TIER[(Math.max(level, 1) - 1) % TIER.length];

/// A transparent button: it only catches the click and the tip.
const CATCH = (tip) => ({
  dark: { fill: null, hover: null, border: null, text: 'text' },
  size: FONT.body, pad: 0, radius: 0, disabled: false, tip,
});

/// The groups on the board, in the order they are laid out.
export const GROUPS = [
  { kind: 'cpu', title: 'PROCESSORS', ref: 'CPU' },
  { kind: 'accel', title: 'BOOSTER', ref: 'PCIE' },
  { kind: 'fpga', title: 'UNLOCK CHIP', ref: 'FPGA' },
  { kind: 'hsm', title: 'KEY READER', ref: 'HSM' },
  { kind: 'storage', title: 'DRIVE BAYS', ref: 'SATA' },
  { kind: 'modem', title: 'INTERNET', ref: 'LAN' },
  { kind: 'security', title: 'SECURITY', ref: 'SEC' },
];

/// The slot id for a kind and a position.
export const slotId = (kind, n) => `gw.slot.${kind}.${n}`;

/// What a slot says on hover.
function describe(kind, part, slots) {
  if (!slots) return `No ${gw.kindLabel(kind)} slot on this chassis.`;
  if (!part) return `Free ${gw.kindLabel(kind)} slot. Click it to fit a part.`;
  const d = componentDef(kind, part.level);
  return `${part.name}\n${gw.kindLabel(kind)} // tier ${part.level}${d?.note ? `\n${d.note}` : ''}`;
}

const fill = (ctx, hex, a, x, y, w, h) => {
  ctx.fillStyle = cssA(hex, a);
  ctx.fillRect(x, y, w, h);
};
const line = (ctx, hex, a, w, pts) => {
  ctx.strokeStyle = cssA(hex, a);
  ctx.lineWidth = w;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
};
const dot = (ctx, hex, a, x, y, r) => {
  ctx.fillStyle = cssA(hex, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/// A processor in its socket: a metal lid with a tier stripe, or bare pins.
function cpuArt(ctx, b, level) {
  const s = Math.min(b.w, b.h);
  const x = b.x + (b.w - s) / 2;
  const y = b.y + (b.h - s) / 2;
  fill(ctx, SOCKET, 1, x, y, s, s);
  ctx.strokeStyle = cssA(METAL_DK, 1);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  if (level === null) {
    const n = 6;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) dot(ctx, GOLD, 0.55, x + s * 0.18 + (i * s * 0.64) / (n - 1), y + s * 0.18 + (j * s * 0.64) / (n - 1), 1.3);
    line(ctx, METAL, 0.7, 2, [[x + s * 0.06, y + s * 0.1], [x + s * 0.06, y + s * 0.9]]);
    return;
  }
  const t = tierColor(level);
  const i = s * 0.12;
  fill(ctx, METAL, 1, x + i, y + i, s - i * 2, s - i * 2);
  fill(ctx, t, 1, x + i, y + i, s - i * 2, (s - i * 2) * 0.24);
  fill(ctx, 0xffffff, 0.35, x + i, y + i, s - i * 2, 2);
  fill(ctx, 0xffffff, 0.2, x + i, y + i, 2, s - i * 2);
  fill(ctx, 0x000000, 0.25, x + i, y + s - i - 2, s - i * 2, 2);
  fill(ctx, METAL_DK, 0.55, x + s * 0.32, y + s * 0.42, s * 0.36, s * 0.36);
  ctx.fillStyle = cssA(GOLD, 1);
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 1);
  ctx.lineTo(x + 9, y + 1);
  ctx.lineTo(x + 1, y + 9);
  ctx.closePath();
  ctx.fill();
}

/// An add-in card standing in a long PCIe slot: a fan, a grid or a key.
function cardArt(ctx, b, kind, level) {
  const slotH = Math.min(b.h * 0.22, 14);
  const sy = b.y + b.h - slotH - 2;
  fill(ctx, SOCKET, 1, b.x, sy, b.w, slotH);
  for (let x = b.x + 4; x < b.x + b.w - 3; x += 5) fill(ctx, GOLD, level === null ? 0.35 : 0.9, x, sy + 2, 2, slotH - 4);
  if (level === null) return;
  const t = tierColor(level);
  const c = { x: b.x + b.w * 0.1, y: b.y + 1, w: b.w * 0.8, h: sy - b.y - 1 };
  fill(ctx, 0x12263a, 1, c.x, c.y, c.w, c.h);
  fill(ctx, t, 1, c.x, c.y, c.w, 3);
  ctx.strokeStyle = cssA(TRACE, 0.8);
  ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  fill(ctx, METAL, 1, c.x - 4, c.y, 4, c.h + slotH);
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2 + 1;
  const r = Math.max(Math.min(c.w, c.h) * 0.32, 5);
  if (kind === 'accel') {
    dot(ctx, METAL_DK, 1, cx, cy, r);
    for (let k = 0; k < 3; k += 1) {
      const a = (k * Math.PI * 2) / 3 + 0.4;
      line(ctx, t, 1, 3, [[cx, cy], [cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9]]);
    }
    dot(ctx, 0x12263a, 1, cx, cy, 2);
  } else if (kind === 'fpga') {
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) fill(ctx, t, 0.9, cx - r + i * (r * 0.75), cy - r + j * (r * 0.75), r * 0.55, r * 0.55);
  } else {
    ctx.strokeStyle = cssA(t, 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - r * 0.5, cy, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    line(ctx, t, 1, 2, [[cx - r * 0.05, cy], [cx + r, cy], [cx + r, cy + r * 0.45], [cx + r * 0.6, cy], [cx + r * 0.6, cy + r * 0.4]]);
  }
}

/// A drive bay: dark rails when free, a metal drive with a label when fitted.
function bayArt(ctx, b, level) {
  fill(ctx, SOCKET, 1, b.x, b.y, b.w, b.h);
  ctx.strokeStyle = cssA(METAL_DK, 1);
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  if (level === null) {
    line(ctx, METAL_DK, 0.6, 1, [[b.x + 4, b.y + 4], [b.x + b.w - 4, b.y + 4]]);
    line(ctx, METAL_DK, 0.6, 1, [[b.x + 4, b.y + b.h - 4], [b.x + b.w - 4, b.y + b.h - 4]]);
    fill(ctx, GOLD, 0.4, b.x + b.w - 10, b.y + b.h / 2 - 6, 6, 12);
    return;
  }
  const t = tierColor(level);
  fill(ctx, METAL, 1, b.x + 3, b.y + 3, b.w - 13, b.h - 6);
  fill(ctx, 0xffffff, 0.3, b.x + 3, b.y + 3, b.w - 13, 2);
  fill(ctx, 0xf4f6f8, 1, b.x + 8, b.y + b.h * 0.3, (b.w - 13) * 0.55, b.h * 0.4);
  fill(ctx, t, 1, b.x + 8, b.y + b.h * 0.3, 4, b.h * 0.4);
  dot(ctx, 0x4cf08a, 1, b.x + b.w - 18, b.y + 8, 2.5);
  fill(ctx, GOLD, 1, b.x + b.w - 8, b.y + b.h / 2 - 6, 5, 12);
}

/// A network port: gold pins and link lights; a cable plugs into a fitted one.
function portArt(ctx, b, level) {
  const w = Math.min(b.w, b.h * 1.5);
  const x = b.x + (b.w - w) / 2;
  fill(ctx, METAL_DK, 1, x, b.y, w, b.h);
  fill(ctx, SOCKET, 1, x + 5, b.y + 6, w - 10, b.h - 8);
  for (let i = 0; i < 8; i += 1) fill(ctx, GOLD, level === null ? 0.5 : 1, x + 8 + (i * (w - 20)) / 8, b.y + 8, 2, 8);
  const on = level !== null;
  dot(ctx, on ? 0x4cf08a : METAL_DK, 1, x + 8, b.y + 3, 1.8);
  dot(ctx, on ? tierColor(level) : METAL_DK, 1, x + w - 8, b.y + 3, 1.8);
  if (on) {
    fill(ctx, tierColor(level), 1, x + 9, b.y + 16, w - 18, b.h - 18);
    fill(ctx, 0xffffff, 0.25, x + 9, b.y + 16, w - 18, 2);
  }
}

/// A security module: a shield, with a lock on it when fitted.
function shieldArt(ctx, b, level) {
  const s = Math.min(b.w, b.h);
  const x = b.x + (b.w - s) / 2;
  const y = b.y;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + s / 2, y);
    ctx.lineTo(x + s * 0.92, y + s * 0.16);
    ctx.lineTo(x + s * 0.92, y + s * 0.55);
    ctx.lineTo(x + s / 2, y + s);
    ctx.lineTo(x + s * 0.08, y + s * 0.55);
    ctx.lineTo(x + s * 0.08, y + s * 0.16);
    ctx.closePath();
  };
  path();
  if (level === null) {
    ctx.strokeStyle = cssA(SILK, 0.4);
    ctx.lineWidth = 1.5;
    ctx.setLineDash?.([4, 3]);
    ctx.stroke();
    ctx.setLineDash?.([]);
    return;
  }
  ctx.fillStyle = cssA(tierColor(level), 0.9);
  ctx.fill();
  ctx.save();
  path();
  ctx.clip?.();
  fill(ctx, 0xffffff, 0.22, x, y, s / 2, s);
  ctx.restore();
  ctx.strokeStyle = cssA(0xffffff, 0.7);
  ctx.lineWidth = 1.5;
  path();
  ctx.stroke();
  fill(ctx, 0xffffff, 0.95, x + s * 0.36, y + s * 0.42, s * 0.28, s * 0.22);
  ctx.strokeStyle = cssA(0xffffff, 0.95);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s * 0.42, s * 0.1, Math.PI, 0);
  ctx.stroke();
}

/// Hatching over a slot the chassis does not have.
function hatch(ctx, r) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip?.();
  ctx.strokeStyle = cssA(SILK, 0.14);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -r.h; i < r.w; i += 9) {
    ctx.moveTo(r.x + i, r.y + r.h);
    ctx.lineTo(r.x + i + r.h, r.y);
  }
  ctx.stroke();
  ctx.restore();
}

/// One slot. Returns true when it was clicked.
function drawSlot(ctx, sk, ui, input, group, n, r, game, selected, id) {
  const { kind } = group;
  const g = game.player.gateway;
  const slots = gw.slotsFor(g, kind);
  const part = gw.partsOf(g, kind)[n];
  const locked = n >= slots;
  const level = part ? part.level : null;
  fill(ctx, 0x000000, locked ? 0.35 : 0.22, r.x, r.y, r.w, r.h);
  const tall = r.h >= 68;
  const strip = 20;
  const b = { x: r.x + 8, y: r.y + (tall ? 18 : 6), w: r.w - 16, h: Math.max(r.h - (tall ? 18 : 6) - strip - 4, 12) };
  if (locked) hatch(ctx, r);
  else if (kind === 'cpu') cpuArt(ctx, b, level);
  else if (kind === 'storage') bayArt(ctx, b, level);
  else if (kind === 'modem') portArt(ctx, b, level);
  else if (kind === 'security') shieldArt(ctx, b, level);
  else cardArt(ctx, b, kind, level);
  if (tall && !locked) drawText(ctx, `${group.ref}${n + 1}`, r.x + 6, r.y + 3, FONT.body, cssA(SILK, 0.75));
  // the name plate under the art
  fill(ctx, 0x000000, 0.4, r.x, r.y + r.h - strip, r.w, strip);
  const tag = kind === 'storage' && part ? `${gw.driveName(g, part)} // ` : '';
  const text = locked ? 'NO SLOT' : part ? `${tag}${part.name}` : 'EMPTY';
  drawText(ctx, ellipsize(ctx, text, FONT.body, r.w - 8), r.x + r.w / 2, r.y + r.h - strip / 2, FONT.body, cssA(part ? 0xffffff : SILK, part ? 1 : 0.6), { align: 'center', baseline: 'middle' });
  if (part) fill(ctx, tierColor(part.level), 1, r.x, r.y + r.h - strip, 3, strip);
  ctx.strokeStyle = selected ? color(PICK) : cssA(SILK, locked ? 0.2 : 0.45);
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  if (selected) fill(ctx, PICK, 0.1, r.x, r.y, r.w, r.h);
  else if (!locked && hit(r, input)) fill(ctx, 0xffffff, 0.09, r.x, r.y, r.w, r.h);
  if (locked) return false;
  return drawButton(ctx, ui, sk, id, r, '', CATCH(describe(kind, part, slots)), input);
}

/// Lays a group's slots in a grid under its silkscreen title. A kind the
/// chassis lacks shows as one hatched cell, so the board always shows every kind.
function drawGroup(ctx, sk, ui, input, events, game, box, group, sel, prefix) {
  const slots = gw.slotsFor(game.player.gateway, group.kind);
  drawText(ctx, `${group.title}${slots ? '' : '  -  NONE'}`, box.x + 2, box.y, FONT.body, cssA(SILK, 0.85));
  const area = { x: box.x, y: box.y + 20, w: box.w, h: Math.max(box.h - 20, 30) };
  const count = Math.max(slots, 1);
  const cols = Math.max(1, Math.min(count, Math.floor(area.w / 70)));
  const rows = Math.ceil(count / cols);
  const gap = 8;
  const cw = Math.min((area.w - gap * (cols - 1)) / cols, 130);
  const ch = Math.min((area.h - gap * (rows - 1)) / rows, 110);
  for (let i = 0; i < count; i += 1) {
    const r = { x: area.x + (i % cols) * (cw + gap), y: area.y + Math.floor(i / cols) * (ch + gap), w: cw, h: ch };
    const on = sel?.kind === group.kind && sel?.n === i;
    const id = `${prefix}.${group.kind}.${i}`;
    if (drawSlot(ctx, sk, ui, input, group, i, r, game, on, id)) events.push({ type: 'click', id });
  }
}

/// The board itself: PCB, copper buses between the groups, mounting holes.
function drawPcb(ctx, r, inner, gap, topH, midH, cpuW, tier) {
  const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  grad.addColorStop(0, color(PCB_HI));
  grad.addColorStop(1, color(PCB));
  ctx.fillStyle = grad;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = cssA(GOLD, 0.7);
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  // buses: three parallel traces in the gaps, with a via at each end
  const bus = (y) => [-5, 0, 5].forEach((o) => {
    line(ctx, TRACE, 0.7, 1.5, [[inner.x + 4, y + o], [inner.x + inner.w - 4, y + o]]);
    dot(ctx, GOLD, 0.9, inner.x + 4, y + o, 2);
    dot(ctx, GOLD, 0.9, inner.x + inner.w - 4, y + o, 2);
  });
  bus(inner.y + topH + gap / 2);
  bus(inner.y + topH + midH + gap * 1.5);
  [-5, 0, 5].forEach((o) => line(ctx, TRACE, 0.6, 1.5, [[inner.x + cpuW + gap / 2 + o, inner.y + 4], [inner.x + cpuW + gap / 2 + o, inner.y + topH - 4]]));
  // mounting holes
  [[r.x + 9, r.y + 9], [r.x + r.w - 9, r.y + 9], [r.x + 9, r.y + r.h - 9], [r.x + r.w - 9, r.y + r.h - 9]].forEach(([x, y]) => {
    dot(ctx, GOLD, 1, x, y, 5);
    dot(ctx, 0x05140d, 1, x, y, 2.5);
  });
  drawText(ctx, tier, r.x + r.w - 16, r.y + r.h - 12, FONT.body, cssA(SILK, 0.35), { align: 'right', baseline: 'middle' });
}

/// Draws the board in `r`: the live machine, or with `opts.rig` another machine
/// (the build), whose slots click as `<opts.prefix>.<kind>.<n>` and show `opts.sel` as picked.
export function drawBoard(ctx, sk, r, live, ui, input, events, view, opts = {}) {
  const game = opts.rig ? { player: { gateway: opts.rig } } : live;
  const sel = opts.rig ? opts.sel : view.slot;
  const prefix = opts.prefix ?? 'gw.slot';
  const m = 20;
  const inner = { x: r.x + m, y: r.y + m, w: r.w - m * 2, h: r.h - m * 2 };
  const gap = 20;
  const topH = Math.max(inner.h * 0.5, 120);
  const midH = Math.max(inner.h * 0.24, 80);
  const botH = Math.max(inner.h - topH - midH - gap * 2, 80);
  const cpuW = Math.max(inner.w * 0.5, 150);
  drawPcb(ctx, r, inner, gap, topH, midH, cpuW, gw.boardOf(game.player.gateway).name.toUpperCase());
  const rightW = inner.w - cpuW - gap;
  const third = (topH - gap) / 3;
  const put = (i, box) => drawGroup(ctx, sk, ui, input, events, game, box, GROUPS[i], sel, prefix);
  put(0, { x: inner.x, y: inner.y, w: cpuW, h: topH });
  put(1, { x: inner.x + cpuW + gap, y: inner.y, w: rightW, h: third });
  put(2, { x: inner.x + cpuW + gap, y: inner.y + third + gap / 2, w: rightW, h: third });
  put(3, { x: inner.x + cpuW + gap, y: inner.y + (third + gap / 2) * 2, w: rightW, h: third });
  put(4, { x: inner.x, y: inner.y + topH + gap, w: inner.w, h: midH });
  const half = (inner.w - gap) / 2;
  put(5, { x: inner.x, y: inner.y + topH + midH + gap * 2, w: half, h: botH });
  put(6, { x: inner.x + half + gap, y: inner.y + topH + midH + gap * 2, w: half, h: botH });
}
