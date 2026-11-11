// The world and the pins on it.

import { draw as drawText, measure, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { recordsKept, RECORD_LABEL, WORK_FIELDS } from '../../game/state/gameState.js';
import { cities, countries } from '../../game/data/content.js';
import { countryAt } from '../../game/data/geo.js';
export { countryAt };
import { hit } from '../ui/kit.js';
import { HOST_LABEL } from '../../game/data/enums.js';

export const MAX_ZOOM = 8;
/// The latitudes shown, as map fractions: 84N down to 60S (no Antarctica).
const TOP = 6 / 180;
const BOTTOM = 150 / 180;
/// Width over height of that strip of the world, so it is never stretched.
const ASPECT = 2 / (BOTTOM - TOP);

/// The world's frame in a box: as large as fits, centred, the right shape.
export function worldFrame(r) {
  const w = Math.min(r.w, r.h * ASPECT);
  const h = w / ASPECT;
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}
const toV = (fy) => (fy - TOP) / (BOTTOM - TOP);
const fromV = (v) => TOP + v * (BOTTOM - TOP);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/// The camera on the world: zoom (1 shows it all) and the frame fraction at
/// its top left. Kept in the map's view so it survives frames.
export function camera(view) {
  const z = clamp(view.zoom ?? 1, 1, MAX_ZOOM);
  const span = 1 / z;
  return { z, ox: clamp(view.ox ?? 0, 0, 1 - span), oy: clamp(view.oy ?? 0, 0, 1 - span) };
}

/// The country each city stands in, by index (worked out once).
let cityHome = null;
function homeOf(i) {
  cityHome ??= cities().map((c) => countryAt(c.x, c.y));
  return cityHome[i];
}

/// The cities to light up under the pointer: the nearest one within `radius`
/// pixels (the focus) and the others of its country (the siblings); with no
/// city near, every city of the country under the pointer. `place` turns a
/// city into its point on screen.
export function hoverCities(px, py, place, hover, radius = 14) {
  const list = cities();
  let focus = null;
  let best = radius * radius;
  list.forEach((c, i) => {
    const p = place(c);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d <= best) {
      best = d;
      focus = i;
    }
  });
  const siblings = [];
  list.forEach((c, i) => {
    if (i === focus) return;
    const same = focus !== null ? c.country === list[focus].country : hover && homeOf(i) === hover;
    if (same) siblings.push(i);
  });
  return { focus, siblings };
}

/// The found machines in a city.
export function cityHosts(game, city) {
  return game.world.hosts.filter((h) => h.discovered && h.city === city);
}

/// The kept drawing of the countries: redrawn only when the view changes.
const kept = { key: null, canvas: null, at: null };

/// The kept drawing of the countries and how far to shift it. `key` names the
/// view apart from where the world sits; `at` is where the world's corner is
/// on screen. While dragging, the drawing is shifted, not redrawn: the edges
/// it never covered stay sea until the drag ends and it is drawn again.
export function countryLayer(r, key, at, panning, paint) {
  if (typeof document === 'undefined') return null;
  const moved = !kept.at || kept.at.x !== at.x || kept.at.y !== at.y;
  if (kept.key !== key || (moved && !panning)) {
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    kept.canvas ??= document.createElement('canvas');
    kept.canvas.width = Math.max(Math.round(r.w * dpr), 1);
    kept.canvas.height = Math.max(Math.round(r.h * dpr), 1);
    const cx = kept.canvas.getContext('2d');
    cx.setTransform?.(dpr, 0, 0, dpr, 0, 0);
    paint(cx);
    kept.key = key;
    kept.at = { ...at };
  }
  return { canvas: kept.canvas, dx: at.x - kept.at.x, dy: at.y - kept.at.y };
}

/// The zoom a picked host is brought in to, at least.
const GLIDE_ZOOM = 3;

/// Sets the camera's goal on a host: centred on it, zoomed in to at least
/// GLIDE_ZOOM. The camera moves there over the next frames.
function aimAt(view, h) {
  const z = Math.max(camera(view).z, GLIDE_ZOOM);
  view.goal = { zoom: z, ox: h.x - 0.5 / z, oy: toV(h.y) - 0.5 / z };
}

/// One frame of the glide: a fifth of the way to the goal, done when close.
export function glideStep(view) {
  if (!view.goal) return;
  const c = camera(view);
  const g = camera(view.goal);
  view.zoom = c.z + (g.z - c.z) * 0.2;
  view.ox = c.ox + (g.ox - c.ox) * 0.2;
  view.oy = c.oy + (g.oy - c.oy) * 0.2;
  if (Math.abs(g.z - c.z) < 0.01 && Math.abs(g.ox - c.ox) < 0.0005 && Math.abs(g.oy - c.oy) < 0.0005) {
    Object.assign(view, { zoom: g.z, ox: g.ox, oy: g.oy });
    view.goal = null;
  }
}

/// The wheel zooms about the pointer and a held press drags the world. `r`
/// is the world's frame; `box` the area that takes the pointer.
export function panZoom(view, r, input, box = r) {
  const over = hit(box, input);
  // a wheel or a press on the map takes the camera back from a glide
  if (over && (Math.abs(input.scroll) > 0.1 || input.pressed)) view.goal = null;
  if (over && Math.abs(input.scroll) > 0.1) {
    const c = camera(view);
    const fx = c.ox + (input.mouse.x - r.x) / (r.w * c.z);
    const fy = c.oy + (input.mouse.y - r.y) / (r.h * c.z);
    const z = clamp(c.z * (input.scroll > 0 ? 1.25 : 0.8), 1, MAX_ZOOM);
    view.zoom = z;
    view.ox = fx - (input.mouse.x - r.x) / (r.w * z);
    view.oy = fy - (input.mouse.y - r.y) / (r.h * z);
  }
  if (over && input.pressed) {
    const c = camera(view);
    view.pressAt = { x: input.mouse.x, y: input.mouse.y };
    view.pan = { mx: input.mouse.x, my: input.mouse.y, ox: c.ox, oy: c.oy };
  }
  if (view.pan && input.down) {
    const z = camera(view).z;
    view.ox = view.pan.ox - (input.mouse.x - view.pan.mx) / (r.w * z);
    view.oy = view.pan.oy - (input.mouse.y - view.pan.my) / (r.h * z);
  }
  if (!input.down) view.pan = null;
  Object.assign(view, camera(view));
  view.zoom = view.z;
  delete view.z;
}

/// The world, the hosts and the route through them. Hosts outside `shown`
/// (the filter and the search) fade back; a missing set shows them all.
export function drawMapWorld(ctx, sk, r, game, view, input, shown = null) {
  const g = worldFrame(r);
  // a host picked in the list (or by SHOW TARGET): the map glides to it
  if (view.glide) {
    const h = game.world.hosts[view.sel];
    if (h) aimAt(view, h);
    view.glide = false;
  }
  panZoom(view, g, input, r);
  glideStep(view);
  const { zoom: z, ox, oy } = view;
  const sx = (fx) => g.x + (fx - ox) * z * g.w;
  const sy = (fy) => g.y + (toV(fy) - oy) * z * g.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = color(sk.deep);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // the countries (Natural Earth), the one under the pointer lit up
  const inMap = hit(r, input);
  const hover = inMap ? countryAt(ox + (input.mouse.x - g.x) / (g.w * z), fromV(oy + (input.mouse.y - g.y) / (g.h * z))) : null;
  const outline = (c, cx, ox2, oy2) => {
    cx.beginPath();
    c.rings.forEach((ring) => {
      cx.moveTo(sx(ring[0]) - ox2, sy(ring[1]) - oy2);
      for (let i = 2; i < ring.length; i += 2) cx.lineTo(sx(ring[i]) - ox2, sy(ring[i + 1]) - oy2);
      cx.closePath();
    });
  };
  // the 1:50m outlines are heavy, so they are drawn once per view and kept
  const at = { x: sx(0), y: sy(0) };
  const layer = countryLayer(r, `${r.w}x${r.h}:${g.w}:${z}:${sk.accent}`, at, Boolean(view.pan), (cx) => {
    cx.lineWidth = 1;
    cx.strokeStyle = cssA(sk.accent, 0.75);
    cx.fillStyle = cssA(sk.accent, 0.1);
    countries().forEach((c) => {
      outline(c, cx, r.x, r.y);
      cx.fill();
      cx.stroke();
    });
  });
  if (layer) ctx.drawImage(layer.canvas, r.x + layer.dx, r.y + layer.dy, r.w, r.h);
  if (hover) {
    outline(hover, ctx, 0, 0);
    ctx.fillStyle = cssA(sk.accent, 0.22);
    ctx.fill();
  }
  // the graticule, over the countries so it reads as a screen
  ctx.strokeStyle = cssA(sk.line, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  // every 30 degrees
  for (let i = 1; i < 12; i += 1) {
    ctx.moveTo(sx(i / 12), r.y);
    ctx.lineTo(sx(i / 12), r.y + r.h);
  }
  for (let i = 1; i < 6; i += 1) {
    ctx.moveTo(r.x, sy(i / 6));
    ctx.lineTo(r.x + r.w, sy(i / 6));
  }
  ctx.stroke();
  // the cities under the pointer: the nearest bright, its country's dimmer
  const place = (c) => ({ x: sx(c.x), y: sy(c.y) });
  const lit = inMap ? hoverCities(input.mouse.x, input.mouse.y, place, hover) : { focus: null, siblings: [] };
  const litSet = new Set([lit.focus, ...lit.siblings]);
  const taken = [];
  const cityLabel = (i, size, col) => {
    const c = cities()[i];
    const hosts = cityHosts(game, i).length;
    const text = hosts && i !== lit.focus ? `${c.name} x${hosts}` : c.name;
    const x = sx(c.x) + 7;
    const y = sy(c.y) + 9;
    const w = measure(ctx, text, size);
    // a label that would sit on one already drawn is left out
    if (taken.some((t) => x < t.x + t.w && x + w > t.x && Math.abs(y - t.y) < size + 2)) return;
    taken.push({ x, y, w });
    drawText(ctx, text, x, y, size, col, { baseline: 'middle' });
  };
  const ring = (i, rad, col, width) => {
    const c = cities()[i];
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(sx(c.x), sy(c.y), rad, 0, Math.PI * 2);
    ctx.stroke();
  };
  lit.siblings.forEach((i) => ring(i, 6, cssA(sk.accent, 0.55), 1));
  if (lit.focus !== null) ring(lit.focus, 9, color(sk.accent), 2);
  if (lit.focus !== null) cityLabel(lit.focus, FONT.emphasis, color(sk.inset_text));
  lit.siblings.forEach((i) => cityLabel(i, 10, cssA(sk.inset_text, 0.8)));
  // every other city's name, once zoomed in far enough to read them
  if (z >= 2) {
    cities().forEach((c, i) => {
      if (!litSet.has(i)) cityLabel(i, 9, cssA(sk.inset_text, 0.55));
    });
  }
  // the pins
  const over = [];
  game.world.hosts.forEach((h) => {
    if (!h.discovered) return;
    const x = sx(h.x);
    const y = sy(h.y);
    const isSel = view.sel === h.id;
    const col = game.favorites.includes(h.id) ? sk.warn : h.company === null || h.company === undefined ? sk.muted : sk.accent;
    const faded = shown && !shown.has(h.id) && !isSel;
    ctx.fillStyle = faded ? cssA(col, 0.22) : color(col);
    ctx.beginPath();
    ctx.arc(x, y, isSel ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    if (isSel) {
      ctx.strokeStyle = color(col);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (!faded && inMap && Math.abs(input.mouse.x - x) < 8 && Math.abs(input.mouse.y - y) < 8) {
      over.push({ h, x, y });
    }
  });
  // the bounce route
  ctx.strokeStyle = cssA(sk.warn, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  game.player.bounce.forEach((id) => {
    const h = game.world.hosts[id];
    if (!h) return;
    const x = sx(h.x);
    const y = sy(h.y);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  });
  ctx.stroke();
  // each hop's place in the route, beside its pin
  game.player.bounce.forEach((id, i) => {
    const h = game.world.hosts[id];
    if (!h) return;
    drawText(ctx, String(i + 1), sx(h.x) + 7, sy(h.y) - 7, 10, color(sk.warn), { baseline: 'middle' });
  });
  ctx.restore();
  drawLegend(ctx, sk, r);
  // the zoom, and how to change it
  const zl = `${z.toFixed(1)}x // WHEEL ZOOM // DRAG PAN`;
  const zw = measure(ctx, zl, FONT.body) + 12;
  if (r.w > zw + 20) {
    ctx.fillStyle = cssA(sk.inset, 0.85);
    ctx.fillRect(r.x + r.w - zw - 8, r.y + 8, zw, 20);
    drawText(ctx, zl, r.x + r.w - zw - 2, r.y + 18, FONT.body, color(sk.inset_text), { baseline: 'middle' });
  }
  // over a city and no pin: the machines found there
  if (lit.focus !== null && !over.length) {
    const c = cities()[lit.focus];
    const hosts = cityHosts(game, lit.focus);
    const rows = hosts.slice(0, 6).map((h) => `${h.name} // ${h.ip}${h.kind ? ` // ${HOST_LABEL[h.kind] ?? h.kind}` : ''}`);
    if (hosts.length > 6) rows.push(`+${hosts.length - 6} MORE`);
    cardLines(ctx, sk, r, sx(c.x), sy(c.y), [`${c.name}${hover ? `, ${hover.name}` : ''} // ${hosts.length} MACHINE${hosts.length === 1 ? '' : 'S'} FOUND`, ...(rows.length ? rows : ['no machines found here yet'])]);
    // a click (not a drag) on the city picks its first machine
    const still = view.pressAt && Math.abs(input.mouse.x - view.pressAt.x) < 4 && Math.abs(input.mouse.y - view.pressAt.y) < 4;
    if (input.released && still && hosts.length) {
      view.sel = hosts[0].id;
      view.follow = true;
    }
  } else if (hover && !over.length) {
    // over a country and no pin: its name and the hosts found in it
    // counted once per country hovered, not every frame
    const n = game.world.hosts.filter((h) => h.discovered).length;
    if (view.counted?.c !== hover || view.counted.n !== n) {
      view.counted = { c: hover, n, found: game.world.hosts.filter((h) => h.discovered && hover.rings.some((ring) => inRing(ring, h.x, h.y))).length };
    }
    const found = view.counted.found;
    card(ctx, sk, r, input.mouse.x, input.mouse.y, `${hover.name} // ${found} HOST${found === 1 ? '' : 'S'} FOUND`);
  }
  // the hover card: sized to its text and kept inside the world
  over.forEach(({ h, x, y }) => {
    const keeps = recordsKept(game, h).filter((f) => !WORK_FIELDS.includes(f)).map((f) => RECORD_LABEL[f]);
    card(ctx, sk, r, x, y, `${h.name} // ${h.ip}${keeps.length ? ` // KEEPS ${keeps.join(', ')}` : ''}`);
    if (input.pressed) {
      view.sel = h.id;
      view.follow = true;
    }
  });
}

/// A one-line card by a point, sized to its text and kept inside the world.
function card(ctx, sk, r, x, y, label) {
  cardLines(ctx, sk, r, x, y, [label]);
}

/// A card of lines by a point: the first is the title.
function cardLines(ctx, sk, r, x, y, lines) {
  const lh = 18;
  const w = Math.min(Math.max(...lines.map((l) => measure(ctx, l, FONT.body))) + 16, r.w - 8);
  const ch = lines.length * lh + 8;
  const bx = Math.max(Math.min(x + 10, r.x + r.w - w - 4), r.x + 4);
  const by = Math.max(Math.min(y - ch - 6, r.y + r.h - ch - 4), r.y + 4);
  ctx.fillStyle = cssA(sk.inset, 0.96);
  ctx.fillRect(bx, by, w, ch);
  ctx.strokeStyle = color(sk.line_hi);
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, ch - 1);
  lines.forEach((l, i) => {
    drawText(ctx, ellipsize(ctx, l, FONT.body, w - 16), bx + 8, by + 4 + lh * i + lh / 2, FONT.body, color(i === 0 ? sk.accent : sk.inset_text), { baseline: 'middle' });
  });
}

/// What the pins and the numbers mean, in the corner of the world.
function drawLegend(ctx, sk, r) {
  const items = [
    [sk.accent, 'COMPANY HOST'],
    [sk.muted, 'INDEPENDENT'],
    [sk.warn, 'FAVOURITE'],
  ];
  const lh = 20;
  const h = items.length * lh + lh + 12;
  const w = 168;
  if (r.w < w + 20 || r.h < h + 20) return;
  const x = r.x + 8;
  const y = r.y + r.h - h - 8;
  ctx.fillStyle = cssA(sk.inset, 0.85);
  ctx.fillRect(x, y, w, h);
  items.forEach(([tint, text], i) => {
    const cy = y + 6 + lh / 2 + i * lh;
    ctx.fillStyle = color(tint);
    ctx.beginPath();
    ctx.arc(x + 12, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText(ctx, text, x + 24, cy, FONT.body, color(sk.inset_text), { baseline: 'middle' });
  });
  const cy = y + 6 + lh / 2 + items.length * lh;
  drawText(ctx, '1 2 3', x + 6, cy, FONT.body, color(sk.warn), { baseline: 'middle' });
  drawText(ctx, 'ROUTE HOPS', x + 60, cy, FONT.body, color(sk.inset_text), { baseline: 'middle' });
}

/// The plain face the map's link buttons use.
export function mapBtn() {
  return {
    dark: { fill: null, hover: 'raised', border: 'line', text: 'text' },
    size: 9,
    pad: 10,
    radius: 2,
    disabled: false,
    mono: true,
    glow: false,
  };
}
