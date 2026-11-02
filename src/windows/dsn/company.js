// The company websites in Internet XPlorer, and the Business Directory that
// lists them. A site has three pages (home, team, contact) in one of ten
// looks. A public email, phone or handle on it is a link: a click puts that
// detail in the dossier.

import { custom } from '../../ui/controls.js';
import { draw as drawText, ellipsize, FONT } from '../../core/text.js';
import { cities } from '../../data/content.js';
import { CO_LABEL } from '../../data/enums.js';
import { portraitOf, drawPortrait } from '../../ui/portrait.js';
import { phoneOf, isPublic, knows } from '../../state/intel.js';
import { siteUrl, siteTheme, staffOf, aboutText } from '../../state/sites.js';
import { wrapRow } from '../notepad.js';

const LH = 18;
const inside = (input, r) => input?.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
const press = (input, r) => input?.pressed && inside(input, r);
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/// A detail of a person drawn as a link when it is public: in the accent, a
/// tick once it is in the dossier, and a click that learns it. A private one
/// reads as such.
export function detailLink(ctx, game, i, field, x, y, maxW, accent, dim, input, events) {
  const p = game.world.people[i];
  if (!isPublic(game, i, field)) {
    drawText(ctx, `${field}: private`, x, y, FONT.body, dim);
    return;
  }
  const value = field === 'phone' ? phoneOf(p) : p[field];
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

/// The header of a site in its theme's layout, with the three pages.
function header(game, ci, here) {
  const c = game.world.companies[ci];
  const t = siteTheme(game, ci);
  const tall = t.layout === 'banner' ? 120 : 64;
  return custom(tall, (ctx, sk, r, input, events) => {
    ctx.fillStyle = t.head;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const centre = t.layout === 'center' || t.layout === 'banner';
    const nameY = t.layout === 'banner' ? r.y + 40 : r.y + r.h / 2;
    drawText(ctx, c.name, centre ? r.x + r.w / 2 : r.x + 18, nameY, FONT.heading, t.headInk, { align: centre ? 'center' : 'left', baseline: 'middle' });
    if (t.layout === 'banner') drawText(ctx, `${CO_LABEL[c.kind] ?? ''} // ${title(cities()[c.city]?.name)}`, r.x + r.w / 2, r.y + 66, FONT.body, t.headInk, { align: 'center', baseline: 'middle' });
    if (t.layout === 'side') {
      ctx.fillStyle = t.accent;
      ctx.fillRect(r.x, r.y, 6, r.h);
    }
    const pages = [['', 'Home'], ['team', 'Our team'], ['contact', 'Contact']];
    const navY = t.layout === 'banner' ? r.y + 96 : r.y + r.h / 2;
    let nx = t.layout === 'banner' ? r.x + r.w / 2 - 150 : r.x + r.w - 310;
    if (t.layout === 'center') nx = r.x + 18;
    pages.forEach(([sub, text]) => {
      const b = { x: nx, y: navY - 10, w: 96, h: 20 };
      drawText(ctx, text, b.x + b.w / 2, navY, FONT.body, t.headInk, { align: 'center', baseline: 'middle' });
      if (here === sub) {
        ctx.fillStyle = t.headInk;
        ctx.fillRect(b.x + 20, navY + 10, b.w - 40, 2);
      }
      if (press(input, b)) events.push({ type: 'click', id: `dsn.go.${siteUrl(c)}${sub ? `/${sub}` : ''}` });
      nx += 100;
    });
  });
}

/// A themed card with a heading and wrapped text.
function textCard(t, heading, text) {
  const guess = (w) => Math.max(Math.ceil((text.length * 7.6) / Math.max(w - 40, 40)), 1) + 1;
  return custom((w) => 50 + guess(w) * LH, (ctx, sk, r) => {
    ctx.fillStyle = t.card;
    ctx.fillRect(r.x, r.y, r.w, r.h - 10);
    drawText(ctx, heading, r.x + 18, r.y + 14, FONT.emphasis, t.accent);
    wrapRow(ctx, text, r.w - 36).forEach((line, k) => drawText(ctx, line, r.x + 18, r.y + 42 + k * LH, FONT.body, t.ink));
  });
}

/// The staff grid: a square photo, name, role, and the public details.
function team(game, ci, t) {
  const staff = staffOf(game, ci);
  const CARD_H = 196;
  const across = (w) => Math.max(Math.floor(w / 220), 1);
  return custom((w) => Math.ceil(staff.length / across(w)) * (CARD_H + 10) + 10, (ctx, sk, r, input, events) => {
    const n = across(r.w);
    const cw = Math.floor((r.w - (n - 1) * 10) / n);
    staff.forEach((i, k) => {
      const p = game.world.people[i];
      const box = { x: r.x + (k % n) * (cw + 10), y: r.y + Math.floor(k / n) * (CARD_H + 10), w: cw, h: CARD_H };
      ctx.fillStyle = t.card;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      const face = { x: box.x + 12, y: box.y + 12, w: 84, h: 84 };
      drawPortrait(ctx, sk, face, portraitOf(game, i), p.sex);
      // the name and photo lead to the person's SleekPages profile
      if (press(input, { x: box.x, y: box.y, w: box.w, h: 136 })) events.push({ type: 'click', id: `dsn.go.sleekpages/person/${i}` });
      drawText(ctx, ellipsize(ctx, title(p.name), FONT.emphasis, box.w - 24), box.x + 12, box.y + 104, FONT.emphasis, t.ink);
      drawText(ctx, ellipsize(ctx, title(p.role), FONT.body, box.w - 24), box.x + 12, box.y + 126, FONT.body, t.dim);
      detailLink(ctx, game, i, 'email', box.x + 12, box.y + 148, box.w - 24, t.accent, t.dim, input, events);
      detailLink(ctx, game, i, 'phone', box.x + 12, box.y + 168, box.w - 24, t.accent, t.dim, input, events);
    });
  });
}

/// A company's site page, or null for an address it does not have.
export function companyPage(game, ci, sub = '') {
  const c = game.world.companies[ci];
  if (!c) return null;
  const t = siteTheme(game, ci);
  const city = title(cities()[c.city]?.name);
  const short = c.short.toLowerCase();
  let body;
  if (!sub) {
    body = [
      textCard(t, 'About us', aboutText(game, ci, city)),
      textCard(t, 'What we do', `${title(CO_LABEL[c.kind] ?? c.kind)} services from our offices in ${city}. ${staffOf(game, ci).length} people work here.`),
    ];
  } else if (sub === 'team') body = [team(game, ci, t)];
  else if (sub === 'contact') {
    body = [textCard(t, 'Contact', `Reception: reception@${short}.nx // +1 (555) 01${String(ci).padStart(2, '0')}-0000 // ${city}. Our staff can be reached directly: see Our team.`)];
  } else return null;
  const footer = custom(40, (ctx, sk, r) => {
    drawText(ctx, `© ${c.name} // ${siteUrl(c)}`, r.x + r.w / 2, r.y + 20, FONT.body, t.dim, { align: 'center', baseline: 'middle' });
  });
  return { title: siteUrl(c), site: 'web', bg: t.bg, accent: parseInt(t.accent.slice(1), 16), controls: [header(game, ci, sub), ...body, footer] };
}

/// The Business Directory: every company site, by industry.
export function directoryPage(game) {
  const cos = game.world.companies.map((c, ci) => ({ c, ci })).sort((a, b) => (a.c.kind + a.c.name).localeCompare(b.c.kind + b.c.name));
  const rows = custom(cos.length * 40 + 60, (ctx, sk, r, input, events) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, r.y, r.w, r.h - 10);
    drawText(ctx, `BUSINESS DIRECTORY // ${cos.length} companies`, r.x + 16, r.y + 14, FONT.emphasis, '#1d2733');
    cos.forEach(({ c, ci }, k) => {
      const row = { x: r.x, y: r.y + 46 + k * 40, w: r.w, h: 40 };
      if (inside(input, row)) {
        ctx.fillStyle = '#eef2f8';
        ctx.fillRect(row.x, row.y, row.w, row.h);
      }
      ctx.fillStyle = siteTheme(game, ci).accent;
      ctx.fillRect(row.x + 16, row.y + 12, 14, 14);
      drawText(ctx, c.name, row.x + 40, row.y + 20, FONT.body, '#1d2733', { baseline: 'middle' });
      drawText(ctx, siteUrl(c), row.x + r.w * 0.42, row.y + 20, FONT.body, '#1f5fbf', { baseline: 'middle' });
      drawText(ctx, ellipsize(ctx, `${CO_LABEL[c.kind] ?? c.kind} // ${title(cities()[c.city]?.name)}`, FONT.body, r.w * 0.3), row.x + r.w - 16, row.y + 20, FONT.body, '#5f6b7a', { align: 'right', baseline: 'middle' });
      if (press(input, row)) events.push({ type: 'click', id: `dsn.go.${siteUrl(c)}` });
    });
  });
  return { title: 'directory', site: 'web', bg: '#e9edf3', accent: 0x1f5fbf, controls: [rows] };
}
