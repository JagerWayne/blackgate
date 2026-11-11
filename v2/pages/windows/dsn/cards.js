// Job cards: a grid of listings, three across in a wide window, two at medium
// width, one when narrow. Each card names the kind of work, shows the fee, the
// time left as a thin bar, the difficulty as pips, the broker in their colour,
// and VIEW and ACCEPT buttons.

import { custom } from '../../ui/controls.js';
import { drawButton } from '../../ui/widgets.js';
import { ghost } from '../../ui/styles.js';
import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { color, cssA } from '../../../game/core/theme.js';
import { MISSION_LABEL } from '../../../game/data/enums.js';
import { contractLabel } from '../../../game/state/contracts.js';
import { broker, haggleOf } from '../../../game/state/haggle.js';
import { KIND_COLOR, UI_FONT, softAccent, netSolid } from './theme.js';
import { t as tl } from '../../../game/data/language.js';

const CARD_H = 156;
const GAP = 12;

/// How many cards fit across a width.
export const across = (w) => (w >= 760 ? 3 : w >= 470 ? 2 : 1);

/// The badge a job carries while it is being talked over or after.
function badge(game, c, sk) {
  const hg = haggleOf(game, c.id);
  if (c.state === 'accepted') return ['YOURS', sk.ok];
  if (c.state === 'ready') return ['READY', sk.ok];
  if (!hg) return null;
  return {
    waiting: ['REPLY PENDING', sk.warn],
    counter: ['COUNTER', sk.warn],
    yes: ['FEE AGREED', sk.ok],
    no: ['REFUSED', sk.danger],
  }[hg.state] ?? null;
}

/// Draws one card and its buttons.
function drawCard(ctx, sk, r, game, c, input, events, st) {
  const kind = KIND_COLOR[c.kind] ?? sk.accent;
  const b = broker(c.client);
  const hot = input.inside && input.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
  ctx.fillStyle = color(hot ? sk.raised : sk.panel2);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = hot ? cssA(kind, 0.6) : color(sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = cssA(kind, 0.9);
  ctx.fillRect(r.x, r.y, 2, r.h);

  const x = r.x + 14;
  const w = r.w - 28;
  const fee = `${c.reward.toLocaleString('en-US')} cr`;
  drawText(ctx, ellipsize(ctx, `${MISSION_LABEL[c.kind] ?? ''} // #${c.id}`, FONT.body, w - fee.length * 10), x, r.y + 10, FONT.body, color(kind));
  drawText(ctx, fee, r.x + r.w - 14, r.y + 9, FONT.emphasis, color(sk.warn), { align: 'right' });
  drawText(ctx, ellipsize(ctx, (c.title || contractLabel(c)).toUpperCase(), FONT.emphasis, w, UI_FONT), x, r.y + 34, FONT.emphasis, color(sk.text_hi), { family: UI_FONT });

  const co = game.world.companies[game.world.hosts[c.target]?.company]?.name ?? 'unknown';
  const tag = badge(game, c, sk);
  const tagW = tag ? tag[0].length * 9 + 8 : 0;
  drawText(ctx, ellipsize(ctx, `${c.client}  vs ${co}`, FONT.body, w - tagW, UI_FONT), x, r.y + 60, FONT.body, color(softAccent(b.accent)), { family: UI_FONT });
  if (tag) drawText(ctx, tag[0], r.x + r.w - 14, r.y + 60, FONT.body, color(tag[1]), { align: 'right' });

  // the time left: a thin bar that turns amber, then red, near the deadline
  const left = Math.max(c.deadline - game.clock.minutes, 0);
  const frac = Math.min(left / (72 * 60), 1);
  const late = left < 6 * 60;
  const by = r.y + 88;
  const pips = 5;
  const barW = w - pips * 12 - 56;
  ctx.fillStyle = color(sk.track);
  ctx.fillRect(x, by + 6, barW, 3);
  ctx.fillStyle = color(late ? sk.danger : frac < 0.35 ? sk.warn : sk.ok);
  ctx.fillRect(x, by + 6, barW * frac, 3);
  drawText(ctx, `${Math.floor(left / 60)}h`, x + barW + 8, by, FONT.body, color(late ? sk.danger : sk.dim));
  const d = Math.max(1, Math.min(c.difficulty ?? 1, pips));
  for (let i = 0; i < pips; i += 1) {
    ctx.fillStyle = i < d ? color(sk.warn) : color(sk.line_hi);
    ctx.fillRect(r.x + r.w - 14 - (pips - i) * 12 + 2, by + 4, 8, 8);
  }

  const y = r.y + r.h - 40;
  const view = { id: `dsn.go.job/${c.id}`, text: tl('windows.dsn.cards.view') };
  const buttons = c.state === 'offered' ? [view, { id: `dsn.accept.${c.id}`, text: tl('windows.dsn.cards.accept') }] : [view];
  const bw = Math.floor((w - 8 * (buttons.length - 1)) / buttons.length);
  buttons.forEach((btn, i) => {
    const rr = { x: x + i * (bw + 8), y, w: bw, h: 30 };
    const style = i === 1 ? netSolid() : ghost();
    if (drawButton(ctx, st, sk, btn.id, rr, btn.text, style, input)) events.push({ type: 'click', id: btn.id });
  });
}

/// A grid of job cards, as one form row.
export function jobCards(game, jobs) {
  const rows = (w) => Math.ceil(jobs.length / across(w));
  return Object.assign(custom((w) => rows(w) * (CARD_H + GAP) - GAP, (ctx, sk, r, input, events, st) => {
    const n = across(r.w);
    const cw = Math.floor((r.w - GAP * (n - 1)) / n);
    jobs.forEach((c, i) => {
      const rr = { x: r.x + (i % n) * (cw + GAP), y: r.y + Math.floor(i / n) * (CARD_H + GAP), w: cw, h: CARD_H };
      drawCard(ctx, sk, rr, game, c, input ?? {}, events ?? [], st ?? {});
    });
  }), { dom: { type: 'cards', game, jobs } });
}
