import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { color, cssA } from '../../../game/core/theme.js';
import { buttons, custom } from '../../ui/controls.js';
import { flat } from '../../ui/styles.js';
import { UI_FONT } from './theme.js';

export const HOME = 'hub';

export const MY_JOBS = 'jobs';


const linkStyle = () => ({ ...flat(), dark: { ...flat().dark, text: 'accent' } });

export const link = (url, text) => ({ id: `dsn.go.${url}`, text, style: linkStyle() });

export const links = (items) => buttons(items.map(([url, text]) => link(url, text)));

export const money = (n) => `${n.toLocaleString('en-US')} cr`;

/// The top of a page: the address as a prompt, the title, a line under it, an
/// accent bar down the side and an optional tag at the right.
export function pageHeader({ path, title, sub = '', accent, tag = '' }) {
  return Object.assign(custom(FONT.title + FONT.body * 2 + 30, (ctx, sk, r) => {
    const tint = accent ?? sk.accent;
    ctx.fillStyle = cssA(tint, 0.85);
    ctx.fillRect(r.x, r.y + 4, 3, r.h - 14);
    const x = r.x + 16;
    drawText(ctx, `> ${path}`, x, r.y + 6, FONT.body, color(sk.muted));
    drawText(ctx, ellipsize(ctx, title, FONT.title, r.w - 24 - (tag ? 140 : 0), UI_FONT), x, r.y + 6 + FONT.body + 6, FONT.title, color(sk.text_hi), { family: UI_FONT });
    if (sub) drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w - 24, UI_FONT), x, r.y + r.h - FONT.body - 10, FONT.body, color(sk.dim), { family: UI_FONT });
    if (tag) {
      const w = tag.length * 9 + 22;
      const t = { x: r.x + r.w - w, y: r.y + 8, w, h: 26 };
      ctx.strokeStyle = cssA(tint, 0.55);
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
      drawText(ctx, tag, t.x + t.w / 2, t.y + t.h / 2, FONT.body, color(tint), { align: 'center', baseline: 'middle' });
    }
    ctx.fillStyle = color(sk.line);
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 1);
  }), { text: title, dom: { type: 'header', path, title, sub, accent, tag } });
}

/// A title over a hairline, with a count or note at the right: the heading of
/// one block of a page.
export function heading(text, note = '') {
  // the text is kept on the control too, so a page can be read without drawing it
  return Object.assign(custom(FONT.body + 26, (ctx, sk, r) => {
    const y = r.y + 14;
    drawText(ctx, text, r.x, y, FONT.body, color(sk.dim), { baseline: 'middle' });
    if (note) drawText(ctx, note, r.x + r.w, y, FONT.body, color(sk.muted), { align: 'right', baseline: 'middle' });
    ctx.fillStyle = color(sk.line);
    ctx.fillRect(r.x, r.y + FONT.body + 12, r.w, 1);
  }), { text, dom: { type: 'heading', text, note } });
}

/// Tiles in a row, each a small label over a figure: `{ label, value, tone }`.
/// Two across in a narrow page, four in a wide one.
export function statTiles(items) {
  const across = (w) => (w >= 560 ? Math.min(items.length, 4) : 2);
  const TILE_H = FONT.body + FONT.heading + 26;
  return Object.assign(custom((w) => Math.ceil(items.length / across(w)) * (TILE_H + 8) - 8, (ctx, sk, r) => {
    const n = across(r.w);
    const tw = Math.floor((r.w - 8 * (n - 1)) / n);
    items.forEach((it, i) => {
      const t = { x: r.x + (i % n) * (tw + 8), y: r.y + Math.floor(i / n) * (TILE_H + 8), w: tw, h: TILE_H };
      ctx.fillStyle = color(sk.panel2);
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle = color(sk.line);
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
      drawText(ctx, ellipsize(ctx, it.label, FONT.body, t.w - 24), t.x + 12, t.y + 10, FONT.body, color(sk.dim));
      drawText(ctx, ellipsize(ctx, String(it.value), FONT.heading, t.w - 24), t.x + 12, t.y + 14 + FONT.body, FONT.heading, color(it.tone ?? sk.text_hi));
    });
  }), { dom: { type: 'tiles', items } });
}

/// A line of text art in a colour, kept for pages that still want a banner.
export const banner = (lines, accent) => pageHeader({ path: 'dsn', title: lines[0].replace(/^[>/\s]+|[<\s]+$/g, ''), sub: lines[1]?.trim() ?? '', accent: typeof accent === 'number' ? accent : parseInt(String(accent).replace('#', ''), 16) });
