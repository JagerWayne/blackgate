// Job cards: a grid of listings, three across in a wide window, two at medium
// width, one when narrow. Each card shows the fee first, the time left as a
// bar, the stars, the broker in their colour, and VIEW and ACCEPT buttons.

import { custom } from '../../ui/controls.js';
import { drawButton } from '../../ui/widgets.js';
import { ghost } from '../../ui/styles.js';
import { draw as drawText, ellipsize } from '../../core/text.js';
import { color, cssA } from '../../core/theme.js';
import { MISSION_LABEL } from '../../data/enums.js';
import { contractLabel } from '../../state/contracts.js';
import { broker, haggleOf } from '../../state/haggle.js';
import { KIND_COLOR, hexOf, netSolid } from './theme.js';

const CARD_H = 132;
const GAP = 12;

/// How many cards fit across a width.
export const across = (w) => (w >= 760 ? 3 : w >= 470 ? 2 : 1);

/// The badge a job carries while it is being talked over or after.
function badge(game, c) {
  const hg = haggleOf(game, c.id);
  if (c.state === 'accepted') return ['YOURS', 0x5be49b];
  if (c.state === 'ready') return ['READY TO SUBMIT', 0x5be49b];
  if (!hg) return null;
  return {
    waiting: ['REPLY PENDING', 0xffc857],
    counter: ['COUNTER-OFFER', 0xffc857],
    yes: ['FEE AGREED', 0x5be49b],
    no: ['ASK REFUSED', 0xff6b6b],
  }[hg.state] ?? null;
}

/// Draws one card and its two buttons.
function drawCard(ctx, sk, r, game, c, input, events, st) {
  const kind = KIND_COLOR[c.kind] ?? sk.accent;
  const b = broker(c.client);
  const hot = input.inside && input.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
  ctx.fillStyle = color(hot ? sk.raised : sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = cssA(kind, hot ? 0.8 : 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = color(kind);
  ctx.fillRect(r.x, r.y, 4, r.h);

  const x = r.x + 14;
  const w = r.w - 24;
  drawText(ctx, ellipsize(ctx, `${MISSION_LABEL[c.kind] ?? ''} // #${c.id}`, 9.5, w), x, r.y + 9, 9.5, color(kind));
  drawText(ctx, ellipsize(ctx, (c.title || contractLabel(c)).toUpperCase(), 12, w - 90), x, r.y + 25, 12, color(sk.text_hi));
  drawText(ctx, `${c.reward.toLocaleString('en-US')} cr`, r.x + r.w - 10, r.y + 23, 15, color(sk.warn), { align: 'right' });

  // the time left: a bar that turns red near the deadline
  const left = Math.max(c.deadline - game.clock.minutes, 0);
  const frac = Math.min(left / (72 * 60), 1);
  const late = left < 6 * 60;
  ctx.fillStyle = color(sk.track);
  ctx.fillRect(x, r.y + 48, w, 4);
  ctx.fillStyle = color(late ? sk.danger : frac < 0.35 ? sk.warn : sk.ok);
  ctx.fillRect(x, r.y + 48, w * frac, 4);
  const d = Math.max(1, Math.min(c.difficulty ?? 1, 5));
  drawText(ctx, `${Math.floor(left / 60)}h left`, x, r.y + 57, 9.5, color(late ? sk.danger : sk.dim));
  drawText(ctx, '★'.repeat(d) + '☆'.repeat(5 - d), r.x + r.w - 10, r.y + 57, 10, color(sk.warn), { align: 'right' });

  const co = game.world.companies[game.world.hosts[c.target]?.company]?.name ?? 'unknown';
  drawText(ctx, ellipsize(ctx, c.client, 10, w), x, r.y + 74, 10, color(hexOf(b.accent)));
  drawText(ctx, ellipsize(ctx, `vs ${co}`, 9.5, w), x, r.y + 88, 9.5, color(sk.dim));
  const tag = badge(game, c);
  if (tag) drawText(ctx, tag[0], r.x + r.w - 10, r.y + 74, 9, color(tag[1]), { align: 'right' });

  const by = r.y + r.h - 32;
  const view = { id: `dsn.go.job/${c.id}`, text: 'VIEW' };
  const buttons = c.state === 'offered' ? [view, { id: `dsn.accept.${c.id}`, text: 'ACCEPT' }] : [view];
  const bw = Math.floor((w - 8 * (buttons.length - 1)) / buttons.length);
  buttons.forEach((btn, i) => {
    const rr = { x: x + i * (bw + 8), y: by, w: bw, h: 24 };
    const style = i === 1 ? netSolid() : ghost();
    if (drawButton(ctx, st, sk, btn.id, rr, btn.text, style, input)) events.push({ type: 'click', id: btn.id });
  });
}

/// A grid of job cards, as one form row.
export function jobCards(game, jobs) {
  const rows = (w) => Math.ceil(jobs.length / across(w));
  return custom((w) => rows(w) * (CARD_H + GAP), (ctx, sk, r, input, events, st) => {
    const n = across(r.w);
    const cw = Math.floor((r.w - GAP * (n - 1)) / n);
    jobs.forEach((c, i) => {
      const rr = { x: r.x + (i % n) * (cw + GAP), y: r.y + Math.floor(i / n) * (CARD_H + GAP), w: cw, h: CARD_H };
      drawCard(ctx, sk, rr, game, c, input ?? {}, events ?? [], st ?? {});
    });
  });
}
