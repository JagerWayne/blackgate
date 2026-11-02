import { cr, pad, clock } from '../helpers.js';

export const bankApp = {
  alias: [],
  window: 'bank',
  about: 'your money',
  commands: {
    balance: { args: '', help: 'your credits', run: (ctx) => [{ text: cr(ctx.game.player.credits), tone: 'head' }] },
    ledger: {
      args: '[n]', help: 'the last n transactions (10 by default)',
      run(ctx, [n]) {
        const rows = (ctx.game.ledger ?? []).slice(-Math.max(Number(n) || 10, 1));
        if (!rows.length) return [{ text: 'no transactions' }];
        return rows.map((l) => ({ text: `${pad(clock(l.minute), 14)}${pad(`${l.amount >= 0 ? '+' : '-'}${cr(Math.abs(l.amount))}`, 14)}${l.reason}`, tone: l.amount >= 0 ? 'ok' : 'err' }));
      },
    },
  },
};
