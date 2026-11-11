import { draw as drawText, FONT } from '../../../game/core/text.js';
import { label, para, keyValue, buttons, field, custom } from '../../ui/controls.js';
import { flat, ghost } from '../../ui/styles.js';
import { hint } from '../../../game/data/content.js';
import { haggleOf, haggleOdds, snubbed, INSULT, MAX_ROUNDS } from '../../../game/state/haggle.js';
import { wrapRow } from '../notepad.js';
import { NET, softAccent, netPrimary, netSolid, netDanger } from './theme.js';
import { color } from '../../../game/core/theme.js';
import { MY_JOBS, links, money, heading } from './shared.js';
import { maxJobs } from '../../../game/data/settings.js';
import { t as tl } from '../../../game/data/language.js';

export const ASKS = [10, 25, 50];

/// The deal panel of a listing: the fee, the asks, the chat with the client.
export function dealPanel(game, c, b, view) {
  const hg = haggleOf(game, c.id);
  const out = [heading('THE DEAL'), keyValue('FEE', money(c.reward), NET.warn)];
  if (c.state === 'offered') {
    const full = game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length >= maxJobs();
    out.push(buttons([{ id: `dsn.accept.${c.id}`, text: tl('windows.dsn.deal.accept_at', money(c.reward)), style: { ...netSolid(), disabled: full, isDefault: true } }]));
    if (full) out.push(label(hint('contractCapacity'), FONT.body, NET.warn));
  } else if (c.state === 'accepted' || c.state === 'ready') {
    out.push(links([[MY_JOBS, 'this job is yours → MY JOBS']]));
  }
  out.push(heading(`CHANNEL // ${c.client}`));
  out.push(chatConsole(c, b, hg));
  if (c.state !== 'offered') return [...out, label('the listing is closed', FONT.body, NET.dim)];
  if (snubbed(game, c.client)) return [...out, label(`${c.client} is not taking your calls`, FONT.body, NET.danger)];
  if (!hg) {
    out.push(para('Ask for a bigger fee. Your rating raises the odds; a bigger ask lowers them. One ask per job; more than double and they pull the listing.', FONT.body));
    ASKS.forEach((pct) => {
      const ask = Math.round(c.reward * (1 + pct / 100));
      out.push(buttons([{ id: `dsn.ask.${c.id}.${pct}`, text: tl('windows.dsn.deal.ask_chance', pct, money(ask), Math.round(haggleOdds(game, c, ask) * 100)), style: ghost() }]));
    });
    out.push(field('dsn.askfield', view.ask ?? '', `or an exact amount, more than ${c.reward}`));
    const typed = Number(view.ask);
    let odds = '';
    if (typed > c.reward) odds = typed / c.reward > INSULT ? 'an insult' : `${Math.round(haggleOdds(game, c, typed) * 100)}% chance`;
    out.push(buttons([{ id: `dsn.askexact.${c.id}`, text: tl('windows.dsn.deal.ask', odds ? ` // ${odds}` : ''), style: ghost() }]));
  } else if (hg.state === 'counter') {
    out.push(buttons([{ id: `dsn.take.${c.id}`, text: tl('windows.dsn.deal.take_and_accept', money(hg.counter)), style: netPrimary() }]));
    if ((hg.round ?? 1) < MAX_ROUNDS) {
      out.push(field('dsn.askfield', view.ask ?? '', `counter: between ${hg.counter} and ${hg.ask}`));
      const typed = Number(view.ask);
      const ok = typed > hg.counter && typed < hg.ask;
      const odds = ok ? ` // ${Math.round(haggleOdds(game, c, typed) * 70)}% chance` : '';
      out.push(buttons([{ id: `dsn.counter.${c.id}`, text: tl('windows.dsn.deal.counter', odds), style: { ...ghost(), disabled: !ok } }]));
    } else out.push(label('last offer: take it or walk away', FONT.body, NET.warn));
  }
  if (hg?.state !== 'waiting') {
    const sure = view.armed === `dsn.decline.${c.id}`;
    out.push(buttons([{ id: `dsn.decline.${c.id}`, text: sure ? 'CONFIRM: WALK AWAY' : 'DECLINE THE JOB', style: sure ? netDanger() : flat() }]));
  }
  return out;
}

export const CHAT_PAD = 10;

export const CHAT_LH = 18;

export let lastCtx = null;

/// The chat with the client, laid out to a width: a header line per message
/// (who and when), then its text wrapped to the bubble.
export function chatRows(ctx, log, w) {
  const rows = [];
  log.forEach((m) => {
    const mine = m.who === 'you';
    const t = `${String(Math.floor(m.minute / 60) % 24).padStart(2, '0')}:${String(m.minute % 60).padStart(2, '0')}`;
    rows.push({ head: true, mine, text: `${mine ? 'YOU' : m.who.toUpperCase()}  ${t}` });
    wrapRow(ctx, m.text, w * 0.75 - 16).forEach((line) => rows.push({ mine, text: line }));
    rows.push({ gap: true });
  });
  return rows;
}

/// A chat console: a dark framed box, the client on the left in their colour,
/// you on the right in blue, a status line along the bottom.
function chatConsole(c, b, hg) {
  const log = hg?.log ?? [];
  const status = !hg ? 'channel open // make your ask below'
    : hg.state === 'waiting' ? `${c.client} is typing…`
      : hg.state === 'counter' ? 'counter-offer on the table'
        : c.state === 'offered' ? 'talks over' : 'channel closed';
  // the height needs a context to measure with: the last one drawn with
  const measure = (w) => (lastCtx ? chatRows(lastCtx, log, w).length : log.length * 4);
  return Object.assign(custom((w) => Math.max(measure(w) * CHAT_LH, 30) + CHAT_PAD * 2 + 26, (ctx, sk, r) => {
    lastCtx = ctx;
    const tint = color(softAccent(b.accent));
    ctx.fillStyle = color(sk.inset);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color(sk.line_hi);
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.clip();
    let y = r.y + CHAT_PAD;
    if (!log.length) drawText(ctx, '-- no messages yet --', r.x + r.w / 2, y + 6, FONT.body, color(sk.muted), { align: 'center' });
    chatRows(ctx, log, r.w).forEach((row) => {
      if (row.gap) { y += CHAT_LH / 2; return; }
      const x = row.mine ? r.x + r.w - CHAT_PAD : r.x + CHAT_PAD;
      const col = row.head ? color(sk.muted) : row.mine ? color(sk.accent) : tint;
      drawText(ctx, row.text, x, y, FONT.body, col, { align: row.mine ? 'right' : 'left' });
      y += CHAT_LH;
    });
    ctx.restore();
    // the status line
    ctx.fillStyle = color(sk.deep);
    ctx.fillRect(r.x + 1, r.y + r.h - 24, r.w - 2, 23);
    drawText(ctx, `● ${status}`, r.x + CHAT_PAD, r.y + r.h - 12, FONT.body, hg?.state === 'waiting' ? color(sk.warn) : color(sk.muted), { baseline: 'middle' });
  }), { dom: { type: 'chat', c, b, hg, log, status } });
}
