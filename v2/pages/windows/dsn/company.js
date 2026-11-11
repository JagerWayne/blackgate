// The company websites in Internet XPlorer, and the Business Directory that
// lists them. A site has three pages (home, team, contact) in one of ten
// colour schemes and four header layouts. The home page is a real landing
// page: header, hero, figures, services, about, leadership, call to action
// and footer. A public email, phone or handle on a site is a link: a click
// puts that detail in the dossier.

import { custom } from '../../ui/controls.js';
import { roundRect } from '../../ui/kit.js';
import { draw as drawText, ellipsize, wrapLines, FONT } from '../../../game/core/text.js';
import { cities } from '../../../game/data/content.js';
import { CO_LABEL } from '../../../game/data/enums.js';
import { portraitOf, drawPortrait } from '../../ui/portrait.js';
import { detailValue, isPublic, knows } from '../../../game/state/intel.js';
import { siteUrl, siteTheme, staffOf, aboutText } from '../../../game/state/sites.js';
import { copyOf, factsOf } from '../../../game/state/siteCopy.js';

const LH = 20;
/// Pixels a character takes, a little over what it needs: heights are guessed from it.
const CH = 8.8;
const inside = (input, r) => input?.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
const press = (input, r) => input?.pressed && inside(input, r);
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };
/// Text colour that reads on a background.
const onColor = (hex) => (lum(hex) > 150 ? '#14181f' : '#ffffff');
const guess = (text, w) => Math.max(Math.ceil((text.length * CH) / Math.max(w, 60)), 1);
const go = (events, url) => events.push({ type: 'click', id: `dsn.go.${url}` });

/// A filled rounded box.
function plate(ctx, r, fillStyle, radius = 8) {
  ctx.fillStyle = fillStyle;
  roundRect(ctx, r, radius);
  ctx.fill();
}

/// A button-like pill with centred text; returns whether it was pressed.
function pill(ctx, r, bg, ink, text, input, outline = false) {
  const hot = inside(input, r);
  if (outline) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    roundRect(ctx, { x: r.x + 0.75, y: r.y + 0.75, w: r.w - 1.5, h: r.h - 1.5 }, r.h / 2);
    ctx.stroke();
    if (hot) plate(ctx, r, rgba(ink.startsWith('#') ? ink : '#ffffff', 0.14), r.h / 2);
  } else plate(ctx, r, hot ? rgba(bg, 0.85) : bg, r.h / 2);
  drawText(ctx, text, r.x + r.w / 2, r.y + r.h / 2, FONT.body, ink, { align: 'center', baseline: 'middle' });
  return press(input, r);
}

/// A section heading with a short accent rule under it.
function heading(t, text, sub) {
  return custom(sub ? 68 : 50, (ctx, sk, r) => {
    drawText(ctx, text, r.x, r.y + 6, FONT.heading, t.ink);
    ctx.fillStyle = t.accent;
    ctx.fillRect(r.x, r.y + 34, 44, 3);
    if (sub) drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w), r.x, r.y + 44, FONT.body, t.dim);
  });
}

/// A pictogram of the industry, drawn with simple shapes inside a square of side `s`.
function icon(ctx, kind, cx, cy, s, col) {
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = Math.max(s / 18, 2);
  ctx.lineJoin = 'round';
  const h = s / 2;
  const p = (pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * h, cy + y * h) : ctx.moveTo(cx + x * h, cy + y * h)));
    ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  };
  const circle = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(cx + x * h, cy + y * h, r * h, 0, Math.PI * 2); if (fill) ctx.fill(); else ctx.stroke(); };
  const rect = (x, y, w, hh, fill) => { if (fill) ctx.fillRect(cx + x * h, cy + y * h, w * h, hh * h); else ctx.strokeRect(cx + x * h, cy + y * h, w * h, hh * h); };
  const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(cx + a * h, cy + b * h); ctx.lineTo(cx + c * h, cy + d * h); ctx.stroke(); };
  switch (kind) {
    case 'bank': case 'gov':
      p([[-1, -0.35], [0, -1], [1, -0.35]]);
      [-0.7, -0.23, 0.23, 0.7].forEach((x) => rect(x - 0.1, -0.2, 0.2, 0.9, true));
      rect(-1, 0.8, 2, 0.2, true);
      break;
    case 'health': rect(-0.3, -1, 0.6, 2, true); rect(-1, -0.3, 2, 0.6, true); break;
    case 'retail': p([[-0.9, -0.4], [0.9, -0.4], [0.7, 1], [-0.7, 1]]); ctx.beginPath(); ctx.arc(cx, cy - 0.4 * h, 0.45 * h, Math.PI, 0); ctx.stroke(); break;
    case 'media': rect(-1, -0.7, 2, 1.4); p([[-0.25, -0.3], [-0.25, 0.3], [0.35, 0]], true); break;
    case 'aiLab': [[-0.8, -0.5], [0.8, -0.6], [0, 0.8], [0.1, -0.05]].forEach(([x, y]) => circle(x, y, 0.22, true)); line(-0.8, -0.5, 0.1, -0.05); line(0.8, -0.6, 0.1, -0.05); line(0, 0.8, 0.1, -0.05); break;
    case 'energy': p([[0.2, -1], [-0.7, 0.15], [-0.05, 0.15], [-0.25, 1], [0.7, -0.2], [0.05, -0.2]], true); break;
    case 'telecom': line(0, -0.2, 0, 1); line(-0.5, 1, 0.5, 1); circle(0, -0.3, 0.12, true); [0.45, 0.8].forEach((r) => { ctx.beginPath(); ctx.arc(cx, cy - 0.3 * h, r * h, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); }); break;
    case 'crypto': p([[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]]); line(-0.25, -0.45, -0.25, 0.45); line(-0.25, -0.45, 0.2, -0.45); line(-0.25, 0, 0.25, 0); line(-0.25, 0.45, 0.25, 0.45); break;
    case 'security': p([[0, -1], [0.85, -0.65], [0.85, 0.1], [0, 1], [-0.85, 0.1], [-0.85, -0.65]]); rect(-0.3, -0.1, 0.6, 0.5, true); ctx.beginPath(); ctx.arc(cx, cy - 0.1 * h, 0.22 * h, Math.PI, 0); ctx.stroke(); break;
    case 'logistics': rect(-1, -0.4, 1.2, 0.9); rect(0.2, -0.1, 0.8, 0.6); circle(-0.55, 0.65, 0.2, true); circle(0.55, 0.65, 0.2, true); break;
    case 'university': p([[0, -0.8], [1, -0.3], [0, 0.2], [-1, -0.3]]); line(-0.6, 0, -0.6, 0.6); line(0.6, 0, 0.6, 0.6); line(-0.6, 0.6, 0.6, 0.6); break;
    default: rect(-0.7, -0.7, 1.4, 1.4); rect(-0.3, -0.3, 0.6, 0.6, true); [-0.4, 0, 0.4].forEach((o) => { line(o, -0.7, o, -1); line(o, 0.7, o, 1); line(-0.7, o, -1, o); line(0.7, o, 1, o); }); // tech: a chip
  }
  ctx.restore();
}

/// A detail of a person drawn as a link when it is public: in the accent, a
/// tick once it is in the dossier, and a click that learns it. A private one
/// reads as such.
export function detailLink(ctx, game, i, field, x, y, maxW, accent, dim, input, events) {
  const p = game.world.people[i];
  if (!isPublic(game, i, field)) {
    drawText(ctx, `${field}: private`, x, y, FONT.body, dim);
    return;
  }
  const value = detailValue(game, i, field);
  const have = knows(game, i, field);
  const text = ellipsize(ctx, `${have ? '✓ ' : ''}${value}`, FONT.body, maxW);
  drawText(ctx, text, x, y, FONT.body, accent);
  const w = Math.min(ctx.measureText ? ctx.measureText(text).width : text.length * 7, maxW);
  const r = { x, y: y - 2, w, h: LH };
  if (inside(input, r)) {
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + 15, w, 1);
  }
  if (press(input, r)) events.push({ type: 'click', id: `sp.learn.${i}.${field}` });
}

// -- the pieces of a page ----------------------------------------------------

/// The top bar: logo, name and the three pages, in the theme's layout.
function header(game, ci, here, t) {
  const c = game.world.companies[ci];
  const stacked = t.layout === 'center';
  return custom(stacked ? 100 : 68, (ctx, sk, r, input, events) => {
    ctx.fillStyle = t.head;
    ctx.fillRect(r.x, r.y, r.w, r.h - 6);
    if (t.layout === 'side') { ctx.fillStyle = t.accent; ctx.fillRect(r.x, r.y, 8, r.h - 6); }
    if (t.layout === 'banner') { ctx.fillStyle = t.accent; ctx.fillRect(r.x, r.y + r.h - 9, r.w, 3); }
    const mark = { x: stacked ? r.x + r.w / 2 - 20 - Math.min(c.name.length * 5.4, 120) : r.x + 20, y: r.y + (stacked ? 12 : 14), w: 36, h: 36 };
    plate(ctx, mark, t.headInk, 9);
    drawText(ctx, c.name[0].toUpperCase(), mark.x + 18, mark.y + 18, FONT.heading, t.head, { align: 'center', baseline: 'middle' });
    drawText(ctx, ellipsize(ctx, c.name, FONT.heading, r.w * 0.4), mark.x + 48, mark.y + 18, FONT.heading, t.headInk, { baseline: 'middle' });
    const pages = [['', 'Home'], ['team', 'Our team'], ['careers', 'Careers'], ['press', 'Press'], ['contact', 'Contact']];
    const navY = stacked ? r.y + 76 : r.y + 32;
    const total = pages.length * 104;
    let nx = stacked ? r.x + r.w / 2 - total / 2 : r.x + r.w - total - (r.w > 720 ? 150 : 10);
    pages.forEach(([sub, text]) => {
      const b = { x: nx, y: navY - 15, w: 98, h: 30 };
      if (here === sub) plate(ctx, b, rgba(t.headInk, 0.2), 15);
      else if (inside(input, b)) plate(ctx, b, rgba(t.headInk, 0.1), 15);
      drawText(ctx, text, b.x + b.w / 2, navY, FONT.body, t.headInk, { align: 'center', baseline: 'middle' });
      if (press(input, b)) go(events, `${siteUrl(c)}${sub ? `/${sub}` : ''}`);
      nx += 104;
    });
    if (!stacked && r.w > 720) {
      if (pill(ctx, { x: r.x + r.w - 140, y: navY - 16, w: 124, h: 32 }, t.headInk, t.head, 'Get in touch', input)) go(events, `${siteUrl(c)}/contact`);
    }
  });
}

/// The big opening block of the home page.
function hero(game, ci, t) {
  const c = game.world.companies[ci];
  const { tag } = copyOf(c);
  const city = title(cities()[c.city]?.name);
  const centred = t.layout === 'center' || t.layout === 'banner';
  return custom(290, (ctx, sk, r, input, events) => {
    const grad = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    grad.addColorStop(0, t.head);
    grad.addColorStop(1, lum(t.head) > 150 ? t.accent : rgba(t.accent, 0.55));
    ctx.fillStyle = grad;
    ctx.fillRect(r.x, r.y, r.w, r.h - 10);
    // a soft pattern: rings and a field of dots
    ctx.strokeStyle = rgba(t.headInk, 0.08);
    ctx.lineWidth = 2;
    [90, 150, 210].forEach((rad) => { ctx.beginPath(); ctx.arc(r.x + r.w * 0.82, r.y + 130, rad, 0, Math.PI * 2); ctx.stroke(); });
    ctx.fillStyle = rgba(t.headInk, 0.1);
    for (let gx = 0; gx < 8; gx += 1) for (let gy = 0; gy < 6; gy += 1) ctx.fillRect(r.x + 24 + gx * 14, r.y + r.h - 112 + gy * 14, 3, 3);
    const wide = r.w >= 640;
    if (wide) {
      plate(ctx, { x: r.x + r.w * 0.82 - 70, y: r.y + 60, w: 140, h: 140 }, rgba(t.headInk, 0.12), 70);
      icon(ctx, c.kind, r.x + r.w * 0.82, r.y + 130, 76, t.headInk);
    }
    const left = centred && !wide ? r.x + r.w / 2 : centred ? r.x + (r.w * 0.64) / 2 : r.x + 36;
    const align = centred ? 'center' : 'left';
    const tw = Math.max((wide ? r.w * 0.58 : r.w - 60), 160);
    const chip = ` ${CO_LABEL[c.kind] ?? ''} `;
    const cw = chip.length * 8.4 + 14;
    plate(ctx, { x: align === 'center' ? left - cw / 2 : left, y: r.y + 28, w: cw, h: 24 }, rgba(t.headInk, 0.18), 12);
    drawText(ctx, chip, align === 'center' ? left : left + cw / 2, r.y + 40, FONT.body, t.headInk, { align: 'center', baseline: 'middle' });
    const lines = wrapLines(ctx, tag, FONT.title, tw);
    lines.forEach((l, k) => drawText(ctx, l, left, r.y + 66 + k * 34, FONT.title, t.headInk, { align }));
    const sy = r.y + 66 + lines.length * 34 + 6;
    drawText(ctx, ellipsize(ctx, `${c.name} // ${city}`, FONT.emphasis, tw), left, sy, FONT.emphasis, rgba(t.headInk, 0.8), { align });
    const bx = align === 'center' ? left - 150 : left;
    const by = sy + 40;
    if (pill(ctx, { x: bx, y: by, w: 140, h: 36 }, t.headInk, t.head, 'Meet our team', input)) go(events, `${siteUrl(c)}/team`);
    if (pill(ctx, { x: bx + 152, y: by, w: 130, h: 36 }, t.headInk, t.headInk, 'Contact us', input, true)) go(events, `${siteUrl(c)}/contact`);
  });
}

/// The figures strip: founded, people, offices, clients.
function figures(game, ci, t) {
  const facts = factsOf(game, ci, staffOf(game, ci).length);
  const across = (w) => (w >= 600 ? 4 : 2);
  return custom((w) => Math.ceil(4 / across(w)) * 96 + 8, (ctx, sk, r) => {
    const n = across(r.w);
    const cw = (r.w - (n - 1) * 12) / n;
    facts.forEach(([value, label], k) => {
      const b = { x: r.x + (k % n) * (cw + 12), y: r.y + 8 + Math.floor(k / n) * 96, w: cw, h: 84 };
      plate(ctx, b, t.card, 10);
      ctx.fillStyle = t.accent;
      ctx.fillRect(b.x + 16, b.y, 36, 4);
      drawText(ctx, value, b.x + 16, b.y + 20, FONT.title, t.accent);
      drawText(ctx, label.toUpperCase(), b.x + 16, b.y + 56, FONT.body, t.dim);
    });
  });
}

/// Three service cards.
function services(c, t) {
  const { services: list } = copyOf(c);
  const across = (w) => (w >= 760 ? 3 : 1);
  const cardH = (w) => {
    const n = across(w);
    const cw = (w - (n - 1) * 14) / n;
    return 92 + Math.max(...list.map(([, text]) => guess(text, cw - 36))) * LH;
  };
  return custom((w) => Math.ceil(3 / across(w)) * (cardH(w) + 14), (ctx, sk, r) => {
    const n = across(r.w);
    const cw = (r.w - (n - 1) * 14) / n;
    const ch = cardH(r.w);
    list.forEach(([name, text], k) => {
      const b = { x: r.x + (k % n) * (cw + 14), y: r.y + Math.floor(k / n) * (ch + 14), w: cw, h: ch };
      plate(ctx, b, t.card, 10);
      plate(ctx, { x: b.x + 18, y: b.y + 18, w: 38, h: 38 }, rgba(t.accent, 0.15), 19);
      drawText(ctx, String(k + 1).padStart(2, '0'), b.x + 37, b.y + 37, FONT.body, t.accent, { align: 'center', baseline: 'middle' });
      drawText(ctx, ellipsize(ctx, name, FONT.emphasis, cw - 36), b.x + 18, b.y + 66, FONT.emphasis, t.ink);
      wrapLines(ctx, text, FONT.body, cw - 36).forEach((l, i) => drawText(ctx, l, b.x + 18, b.y + 92 + i * LH, FONT.body, t.dim));
    });
  });
}

/// About us beside a coloured "why us" card.
function about(game, ci, t, city) {
  const text = aboutText(game, ci, city);
  const reasons = ['Specialists, not generalists', `Rooted in ${city}`, 'Discreet and dependable'];
  const two = (w) => w >= 760;
  const leftW = (w) => (two(w) ? w * 0.6 - 7 : w);
  const height = (w) => Math.max(guess(text, leftW(w) - 44) * LH + 80, 170) + (two(w) ? 0 : 190);
  return custom(height, (ctx, sk, r) => {
    const lw = leftW(r.w);
    const lh = Math.max(guess(text, lw - 44) * LH + 70, 160);
    plate(ctx, { x: r.x, y: r.y, w: lw, h: lh }, t.card, 10);
    drawText(ctx, 'About us', r.x + 22, r.y + 18, FONT.emphasis, t.accent);
    wrapLines(ctx, text, FONT.body, lw - 44).forEach((l, i) => drawText(ctx, l, r.x + 22, r.y + 50 + i * LH, FONT.body, t.ink));
    const rb = two(r.w) ? { x: r.x + lw + 14, y: r.y, w: r.w - lw - 14, h: lh } : { x: r.x, y: r.y + lh + 14, w: r.w, h: 160 };
    plate(ctx, rb, t.accent, 10);
    const ink = onColor(t.accent);
    drawText(ctx, 'Why clients choose us', rb.x + 22, rb.y + 18, FONT.emphasis, ink);
    reasons.forEach((reason, i) => {
      const y = rb.y + 58 + i * 32;
      plate(ctx, { x: rb.x + 22, y: y - 2, w: 20, h: 20 }, rgba(ink, 0.25), 10);
      drawText(ctx, '✓', rb.x + 32, y + 8, FONT.body, ink, { align: 'center', baseline: 'middle' });
      drawText(ctx, ellipsize(ctx, reason, FONT.body, rb.w - 70), rb.x + 52, y, FONT.body, ink);
    });
  });
}

/// A staff card: photo, name, role and the public details.
function personCard(ctx, sk, game, i, box, t, input, events, tall) {
  const p = game.world.people[i];
  plate(ctx, box, t.card, 10);
  ctx.fillStyle = t.accent;
  ctx.fillRect(box.x + 14, box.y, box.w - 28, 4);
  drawPortrait(ctx, sk, { x: box.x + 14, y: box.y + 18, w: 84, h: 84 }, portraitOf(game, i), p.sex);
  if (press(input, { x: box.x, y: box.y, w: box.w, h: 140 })) go(events, `sleekpages/person/${i}`);
  drawText(ctx, ellipsize(ctx, title(p.name), FONT.emphasis, box.w - 28), box.x + 14, box.y + 112, FONT.emphasis, t.ink);
  const role = ellipsize(ctx, title(p.role), FONT.body, box.w - 44);
  const rw = Math.min(role.length * 8.4 + 18, box.w - 28);
  plate(ctx, { x: box.x + 14, y: box.y + 138, w: rw, h: 24 }, rgba(t.accent, 0.14), 12);
  drawText(ctx, role, box.x + 14 + rw / 2, box.y + 150, FONT.body, t.accent, { align: 'center', baseline: 'middle' });
  if (tall) {
    detailLink(ctx, game, i, 'email', box.x + 14, box.y + 174, box.w - 28, t.accent, t.dim, input, events);
    detailLink(ctx, game, i, 'phone', box.x + 14, box.y + 196, box.w - 28, t.accent, t.dim, input, events);
  }
}

/// The first three people, with a link to everyone.
function leaders(game, ci, t) {
  const c = game.world.companies[ci];
  const staff = staffOf(game, ci).slice(0, 3);
  if (!staff.length) return null;
  const across = (w) => Math.max(Math.min(Math.floor(w / 220), staff.length), 1);
  const rowsOf = (w) => Math.ceil(staff.length / across(w));
  return custom((w) => rowsOf(w) * 182 + 54, (ctx, sk, r, input, events) => {
    const n = across(r.w);
    const cw = (r.w - (n - 1) * 14) / n;
    drawText(ctx, 'Leadership', r.x, r.y + 6, FONT.heading, t.ink);
    ctx.fillStyle = t.accent;
    ctx.fillRect(r.x, r.y + 34, 44, 3);
    const more = { x: r.x + r.w - 150, y: r.y + 8, w: 150, h: 28 };
    drawText(ctx, 'See everyone  →', more.x + more.w, more.y + 6, FONT.body, t.accent, { align: 'right' });
    if (press(input, more)) go(events, `${siteUrl(c)}/team`);
    staff.forEach((i, k) => personCard(ctx, sk, game, i, { x: r.x + (k % n) * (cw + 14), y: r.y + 54 + Math.floor(k / n) * 182, w: cw, h: 168 }, t, input, events, false));
  });
}

/// The coloured call-to-action band.
function cta(c, t) {
  return custom(120, (ctx, sk, r, input, events) => {
    plate(ctx, { x: r.x, y: r.y + 4, w: r.w, h: 104 }, t.accent, 12);
    const ink = onColor(t.accent);
    drawText(ctx, ellipsize(ctx, `Ready to work with ${c.name}?`, FONT.heading, r.w - 200), r.x + 28, r.y + 30, FONT.heading, ink);
    drawText(ctx, 'Write to us and a real person will answer.', r.x + 28, r.y + 62, FONT.body, rgba(ink, 0.85));
    if (r.w >= 560 && pill(ctx, { x: r.x + r.w - 168, y: r.y + 34, w: 140, h: 40 }, ink, t.accent, 'Contact us', input)) go(events, `${siteUrl(c)}/contact`);
  });
}

/// The page foot: who we are, where to go, how to reach us.
function footer(c, ci, t, city) {
  const short = c.short.toLowerCase();
  return custom(180, (ctx, sk, r, input, events) => {
    ctx.fillStyle = t.head;
    ctx.fillRect(r.x, r.y + 14, r.w, r.h - 14);
    const cols = r.w >= 600 ? 3 : 1;
    const x0 = r.x + 24;
    drawText(ctx, c.name, x0, r.y + 34, FONT.emphasis, t.headInk);
    drawText(ctx, ellipsize(ctx, `${CO_LABEL[c.kind] ?? ''} // ${city}`, FONT.body, r.w / cols - 40), x0, r.y + 60, FONT.body, rgba(t.headInk, 0.7));
    if (cols === 3) {
      const x1 = r.x + r.w / 3 + 12;
      drawText(ctx, 'PAGES', x1, r.y + 34, FONT.body, rgba(t.headInk, 0.6));
      [['', 'Home'], ['team', 'Our team'], ['contact', 'Contact'], ['whois', 'Domain record']].forEach(([sub, text], i) => {
        const b = { x: x1, y: r.y + 58 + i * 22, w: 140, h: 20 };
        drawText(ctx, text, b.x, b.y, FONT.body, inside(input, b) ? t.headInk : rgba(t.headInk, 0.85));
        if (press(input, b)) go(events, sub === 'whois' ? `whois.nx/${siteUrl(c).replace(/^www\./, '')}` : `${siteUrl(c)}${sub ? `/${sub}` : ''}`);
      });
      const x2 = r.x + (r.w * 2) / 3;
      drawText(ctx, 'REACH US', x2, r.y + 34, FONT.body, rgba(t.headInk, 0.6));
      drawText(ctx, ellipsize(ctx, `reception@${short}.nx`, FONT.body, r.w / 3 - 20), x2, r.y + 58, FONT.body, rgba(t.headInk, 0.85));
      drawText(ctx, `+1 (555) 01${String(ci).padStart(2, '0')}-0000`, x2, r.y + 82, FONT.body, rgba(t.headInk, 0.85));
    }
    ctx.fillStyle = rgba(t.headInk, 0.2);
    ctx.fillRect(r.x + 24, r.y + r.h - 40, r.w - 48, 1);
    drawText(ctx, ellipsize(ctx, `© ${c.name} // ${siteUrl(c)}`, FONT.body, r.w - 48), r.x + 24, r.y + r.h - 28, FONT.body, rgba(t.headInk, 0.6));
  });
}

/// The title band of the team and contact pages.
function band(t, name, sub) {
  return custom(112, (ctx, sk, r) => {
    plate(ctx, { x: r.x, y: r.y + 4, w: r.w, h: 96 }, t.card, 12);
    ctx.fillStyle = t.accent;
    ctx.fillRect(r.x, r.y + 20, 6, 64);
    drawText(ctx, name, r.x + 28, r.y + 22, FONT.title, t.ink);
    drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w - 56), r.x + 28, r.y + 62, FONT.body, t.dim);
  });
}

/// The staff grid.
function team(game, ci, t) {
  const staff = staffOf(game, ci);
  const CARD_H = 228;
  const across = (w) => Math.max(Math.floor(w / 230), 1);
  return custom((w) => Math.ceil(staff.length / across(w)) * (CARD_H + 14) + 6, (ctx, sk, r, input, events) => {
    const n = across(r.w);
    const cw = Math.floor((r.w - (n - 1) * 14) / n);
    staff.forEach((i, k) => personCard(ctx, sk, game, i, { x: r.x + (k % n) * (cw + 14), y: r.y + Math.floor(k / n) * (CARD_H + 14), w: cw, h: CARD_H }, t, input, events, true));
  });
}

/// The contact details beside a pointer to the team.
function contact(game, ci, t, city) {
  const c = game.world.companies[ci];
  const rows = [['@', 'Email', `reception@${c.short.toLowerCase()}.nx`], ['T', 'Phone', `+1 (555) 01${String(ci).padStart(2, '0')}-0000`], ['A', 'Office', `${city}, head office`], ['H', 'Hours', 'Monday to Friday, 09:00 to 17:30']];
  const two = (w) => w >= 700;
  return custom((w) => (two(w) ? 290 : 480), (ctx, sk, r, input, events) => {
    const lw = two(r.w) ? r.w * 0.58 - 7 : r.w;
    plate(ctx, { x: r.x, y: r.y, w: lw, h: 282 }, t.card, 12);
    drawText(ctx, 'Get in touch', r.x + 24, r.y + 20, FONT.heading, t.ink);
    rows.forEach(([glyph, label, value], i) => {
      const y = r.y + 70 + i * 52;
      plate(ctx, { x: r.x + 24, y, w: 38, h: 38 }, rgba(t.accent, 0.15), 19);
      drawText(ctx, glyph, r.x + 43, y + 19, FONT.body, t.accent, { align: 'center', baseline: 'middle' });
      drawText(ctx, label.toUpperCase(), r.x + 76, y, FONT.body, t.dim);
      drawText(ctx, ellipsize(ctx, value, FONT.emphasis, lw - 100), r.x + 76, y + 18, FONT.emphasis, t.ink);
    });
    const rb = two(r.w) ? { x: r.x + lw + 14, y: r.y, w: r.w - lw - 14, h: 282 } : { x: r.x, y: r.y + 296, w: r.w, h: 178 };
    plate(ctx, rb, t.accent, 12);
    const ink = onColor(t.accent);
    drawText(ctx, 'Prefer a person?', rb.x + 24, rb.y + 22, FONT.heading, ink);
    wrapLines(ctx, 'Our team page lists names, roles and direct lines for the people who can help.', FONT.body, rb.w - 48).forEach((l, i) => drawText(ctx, l, rb.x + 24, rb.y + 64 + i * LH, FONT.body, rgba(ink, 0.9)));
    if (pill(ctx, { x: rb.x + 24, y: rb.y + rb.h - 62, w: 150, h: 38 }, ink, t.accent, 'Meet the team', input)) go(events, `${siteUrl(c)}/team`);
  });
}

// -- the pages -----------------------------------------------------------------

/// A company's site page, or null for an address it does not have.
export function companyPage(game, ci, sub = '') {
  const c = game.world.companies[ci];
  if (!c) return null;
  const t = siteTheme(game, ci);
  const city = title(cities()[c.city]?.name);
  const people = staffOf(game, ci).length;
  // each block carries what the DOM needs to draw it again (app/apps/dsnSites.js)
  const D = (control, type, extra = {}) => control && Object.assign(control, { dom: { type, game, ci, c, t, city, sub, ...extra } });
  let body;
  if (!sub) {
    const what = `${title(CO_LABEL[c.kind] ?? c.kind)} services from our offices in ${city}`;
    body = [D(hero(game, ci, t), 'co-hero'), D(figures(game, ci, t), 'co-figures'), D(heading(t, 'What we do', what), 'co-heading', { text: 'What we do', note: what }), D(services(c, t), 'co-services'), D(about(game, ci, t, city), 'co-about'), D(leaders(game, ci, t), 'co-leaders'), D(cta(c, t), 'co-cta')].filter(Boolean);
  } else if (sub === 'team') {
    const note = `${people} people work at ${c.name}. Click a face for their profile.`;
    body = [D(band(t, 'Our team', note), 'co-band', { text: 'Our team', note }), D(team(game, ci, t), 'co-team')];
  } else if (sub === 'careers' || sub === 'press') {
    // drawn by the DOM only (app/apps/dsnSites.js); the canvas has no use for these two pages
    const note = sub === 'careers' ? `Open positions at ${c.name}, ${city}.` : `News from ${c.name}.`;
    const text = sub === 'careers' ? 'Careers' : 'Press';
    body = [D(band(t, text, note), 'co-band', { text, note }), D(custom(40, () => {}), sub === 'careers' ? 'co-openings' : 'co-press')];
  } else if (sub === 'contact') {
    const note = `We would like to hear from you. ${c.name}, ${city}.`;
    body = [D(band(t, 'Contact', note), 'co-band', { text: 'Contact', note }), D(contact(game, ci, t, city), 'co-contact')];
  } else return null;
  return { title: siteUrl(c), site: 'web', bg: t.bg, accent: parseInt(t.accent.slice(1), 16), controls: [D(header(game, ci, sub, t), 'co-header'), ...body, D(footer(c, ci, t, city), 'co-footer')] };
}

/// The Business Directory: every company site, by industry.
export function directoryPage(game) {
  const cos = game.world.companies.map((c, ci) => ({ c, ci })).sort((a, b) => (a.c.kind + a.c.name).localeCompare(b.c.kind + b.c.name));
  const items = [];
  cos.forEach((e, k) => {
    if (k === 0 || cos[k - 1].c.kind !== e.c.kind) items.push({ head: e.c.kind });
    items.push(e);
  });
  const ROW = 58;
  const HEAD = 44;
  const total = items.reduce((s, it) => s + (it.head ? HEAD : ROW), 0);
  const ink = '#1d2733';
  const body = custom(total + 130, (ctx, sk, r, input, events) => {
    const hero = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
    hero.addColorStop(0, '#1f5fbf');
    hero.addColorStop(1, '#5b9bf0');
    ctx.fillStyle = hero;
    roundRect(ctx, { x: r.x, y: r.y, w: r.w, h: 100 }, 12);
    ctx.fill();
    drawText(ctx, 'Business Directory', r.x + 28, r.y + 22, FONT.title, '#ffffff');
    drawText(ctx, `${cos.length} companies on the network, by industry`, r.x + 28, r.y + 62, FONT.body, 'rgba(255,255,255,0.85)');
    let y = r.y + 116;
    items.forEach((it) => {
      if (it.head) {
        drawText(ctx, (CO_LABEL[it.head] ?? it.head).toUpperCase(), r.x + 6, y + 14, FONT.body, '#5f6b7a');
        ctx.fillStyle = '#d3dbe8';
        ctx.fillRect(r.x, y + 36, r.w, 1);
        y += HEAD;
        return;
      }
      const { c, ci } = it;
      const th = siteTheme(game, ci);
      const row = { x: r.x, y, w: r.w, h: ROW - 6 };
      plate(ctx, row, inside(input, row) ? '#eef3fb' : '#ffffff', 10);
      plate(ctx, { x: row.x + 12, y: row.y + 9, w: 34, h: 34 }, th.head, 9);
      drawText(ctx, c.name[0].toUpperCase(), row.x + 29, row.y + 26, FONT.emphasis, th.headInk, { align: 'center', baseline: 'middle' });
      drawText(ctx, ellipsize(ctx, c.name, FONT.emphasis, r.w * 0.34), row.x + 60, row.y + 9, FONT.emphasis, ink);
      drawText(ctx, siteUrl(c), row.x + 60, row.y + 30, FONT.body, '#1f5fbf');
      if (r.w >= 560) drawText(ctx, ellipsize(ctx, title(cities()[c.city]?.name), FONT.body, r.w * 0.25), row.x + row.w - 16, row.y + row.h / 2, FONT.body, '#5f6b7a', { align: 'right', baseline: 'middle' });
      if (press(input, row)) go(events, siteUrl(c));
      y += ROW;
    });
  });
  return { title: 'directory', site: 'web', bg: '#e9edf3', accent: 0x1f5fbf, controls: [Object.assign(body, { dom: { type: 'dir', game, cos, items } })] };
}
