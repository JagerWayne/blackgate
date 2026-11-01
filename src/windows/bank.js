// BANKING: the balance, the accounts it is held in, and every movement of
// money the run has made, newest first.

import { section, label, keyValue, spacer } from '../ui/controls.js';
import { drawFrame, sectionHead } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { drawTable, flex } from '../ui/table.js';
import { measureControls } from '../ui/layout.js';
import { hhmm } from '../core/clock.js';
import { FONT } from '../core/text.js';

/// Draws the banking window.
export function drawBank(ctx, sk, r, game, ui, input, events) {
  const accounts = game.player.accounts ?? [];
  const acct = accounts[0];
  const body = drawFrame(ctx, sk, r, ui, input, events, '', acct ? `${acct.bank} // ${acct.number}` : 'no account');

  // the balance and every account it is held in
  const controls = [
    label('BALANCE', FONT.body, sk.dim),
    label(`${game.player.credits} cr`, FONT.title, sk.warn),
    spacer(4),
    section(`ACCOUNTS // ${accounts.length}`),
  ];
  if (!accounts.length) controls.push(label('no account opened', FONT.body, sk.dim));
  accounts.forEach((a) => controls.push(keyValue(`${a.bank} // ${a.number}`, `${a.balance} cr`, sk.text)));
  const top = { x: body.x, y: body.y, w: Math.min(body.w, 620), h: body.h };
  const topH = Math.min(measureControls(ctx, controls, top.w) + 8, body.h * 0.5);
  drawScrolled(ctx, sk, { ...top, h: topH }, controls, 'bank.form', ui, input, events);

  // every movement, newest first; contract fees clear into the first account
  const moves = ledgerOf(game);
  const below = sectionHead(ctx, sk, { x: body.x, y: body.y + topH + 6, w: body.w, h: body.h - topH - 6 }, `LEDGER // ${moves.length} entries // fees clear into the first account`);
  const rows = moves.map((m) => ({
    grid: true,
    cells: [
      { text: `DAY ${Math.floor(m.minute / 1440) + 1}  ${hhmm({ minutes: m.minute })}`, size: FONT.body, color: sk.dim, col: 0, line: 0 },
      { text: m.reason, size: FONT.body, color: sk.text, col: 1, line: 0 },
      { text: `${m.amount > 0 ? '+' : ''}${m.amount} cr`, size: FONT.body, color: m.amount > 0 ? sk.ok : sk.danger, align: 'right', col: 2, line: 0 },
    ],
  }));
  drawTable(ctx, sk, below, {
    id: 'bank.ledger',
    columns: [flex('WHEN', 0.24), flex('WHAT', 0.54), flex('AMOUNT', 0.22, 'right')],
    rows,
    rowH: 30,
    empty: 'no transactions recorded',
  }, ui, input, events);
}

/// The money movements, newest first. A run saved before the ledger kept its
/// own history reads what is left of it in the operator's log.
export function ledgerOf(game) {
  if (Array.isArray(game.ledger)) return game.ledger.slice().reverse();
  return game.log
    .filter((l) => l.text.startsWith('ledger'))
    .map((l) => {
      const m = /^ledger ([+-]\d+) cr \/\/ (.*)$/.exec(l.text);
      return { minute: l.minute, amount: m ? Number(m[1]) : 0, reason: m ? m[2] : l.text };
    })
    .reverse();
}
