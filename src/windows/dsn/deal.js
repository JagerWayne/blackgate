import { draw as drawText, FONT } from '../../core/text.js';
import { label, para, keyValue, buttons, field, custom } from '../../ui/controls.js';
import { flat, ghost } from '../../ui/styles.js';
import { hint } from '../../data/content.js';
import { haggleOf, haggleOdds, snubbed, INSULT, MAX_ROUNDS } from '../../state/haggle.js';
import { wrapRow } from '../notepad.js';
import { hexOf, netPrimary, netSolid, netDanger } from './theme.js';
import { MY_JOBS, MAX_JOBS, links, money, heading } from './shared.js';

export const ASKS = [10, 25, 50];

/// The deal panel of a listing: the fee, the asks, the chat with the client.
export function dealPanel(game, c, b, view) {
  const hg = haggleOf(game, c.id);
  const accent = hexOf(b.accent);
  const out = [heading('THE DEAL'), keyValue('FEE', money(c.reward), 0xffc857)];
  if (c.state === 'offered') {
    const full = game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length >= MAX_JOBS;
    out.push(buttons([{ id: `dsn.accept.${c.id}`, text: `ACCEPT AT ${money(c.reward)}`, style: { ...netSolid(), disabled: full, isDefault: true } }]));
    if (full) out.push(label(hint('contractCapacity'), 10, 0xffc857));
  } else if (c.state === 'accepted' || c.state === 'ready') {
    out.push(links([[MY_JOBS, 'this job is yours → MY JOBS']]));
  }
  out.push(heading(`CHANNEL // ${c.client}`));
  out.push(chatConsole(c, b, hg));
  if (c.state !== 'offered') return [...out, label('the listing is closed', 10)];
  if (snubbed(game, c.client)) return [...out, label(`${c.client} is not taking your calls`, 10, 0xff6b6b)];
  if (!hg) {
    out.push(para('Ask for a bigger fee. Your rating raises the odds; a bigger ask lowers them. One ask per job; more than double and they pull the listing.', FONT.body));
    ASKS.forEach((pct) => {
      const ask = Math.round(c.reward * (1 + pct / 100));
      out.push(buttons([{ id: `dsn.ask.${c.id}.${pct}`, text: `ASK +${pct}% → ${money(ask)} // ${Math.round(haggleOdds(game, c, ask) * 100)}% chance`, style: ghost() }]));
    });
    out.push(field('dsn.askfield', view.ask ?? '', `or an exact amount, more than ${c.reward}`));
    const typed = Number(view.ask);
    let odds = '';
    if (typed > c.reward) odds = typed / c.reward > INSULT ? 'an insult' : `${Math.round(haggleOdds(game, c, typed) * 100)}% chance`;
    out.push(buttons([{ id: `dsn.askexact.${c.id}`, text: `ASK${odds ? ` // ${odds}` : ''}`, style: ghost() }]));
  } else if (hg.state === 'counter') {
    out.push(buttons([{ id: `dsn.take.${c.id}`, text: `TAKE ${money(hg.counter)} AND ACCEPT`, style: netPrimary() }]));
    if ((hg.round ?? 1) < MAX_ROUNDS) {
      out.push(field('dsn.askfield', view.ask ?? '', `counter: between ${hg.counter} and ${hg.ask}`));
      const typed = Number(view.ask);
      const ok = typed > hg.counter && typed < hg.ask;
      const odds = ok ? ` // ${Math.round(haggleOdds(game, c, typed) * 70)}% chance` : '';
      out.push(buttons([{ id: `dsn.counter.${c.id}`, text: `COUNTER${odds}`, style: { ...ghost(), disabled: !ok } }]));
    } else out.push(label('last offer: take it or walk away', FONT.body, 0xffc857));
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
export function chatConsole(c, b, hg) {
  const log = hg?.log ?? [];
  const status = !hg ? 'channel open // make your ask below'
    : hg.state === 'waiting' ? `${c.client} is typing…`
      : hg.state === 'counter' ? 'counter-offer on the table'
        : c.state === 'offered' ? 'talks over' : 'channel closed';
  // the height needs a context to measure with: the last one drawn with
  const measure = (w) => (lastCtx ? chatRows(lastCtx, log, w).length : log.length * 4);
  return custom((w) => Math.max(measure(w) * CHAT_LH, 30) + CHAT_PAD * 2 + 26, (ctx, sk, r) => {
    lastCtx = ctx;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.clip();
    let y = r.y + CHAT_PAD;
    if (!log.length) drawText(ctx, '-- no messages yet --', r.x + r.w / 2, y + 6, FONT.body, '#55607a', { align: 'center' });
    chatRows(ctx, log, r.w).forEach((row) => {
      if (row.gap) { y += CHAT_LH / 2; return; }
      const x = row.mine ? r.x + r.w - CHAT_PAD : r.x + CHAT_PAD;
      const col = row.head ? '#55607a' : row.mine ? '#7fd4ff' : b.accent;
      drawText(ctx, row.text, x, y, FONT.body, col, { align: row.mine ? 'right' : 'left' });
      y += CHAT_LH;
    });
    ctx.restore();
    // the status line
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(r.x + 1, r.y + r.h - 24, r.w - 2, 23);
    drawText(ctx, `● ${status}`, r.x + CHAT_PAD, r.y + r.h - 12, FONT.body, hg?.state === 'waiting' ? '#ffc857' : '#55607a', { baseline: 'middle' });
  });
}
