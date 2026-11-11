import { cr, pad, clock, fail } from '../helpers.js';
import { bankOf, deposit, withdraw, borrow, repay, loanLimit } from '../../../state/finance.js';
import { COINS, holding, buyCoin, sellCoin } from '../../../state/crypto.js';
import { t as tl } from '../../../data/language.js';

/// A command that moves money: `all` stands for the whole sum `whole()` gives.
const mover = (args, help, act, whole) => ({
  args, help,
  run(ctx, [w]) {
    if (!w) fail(tl('systems.commands.apps.bank.usage_bank', args));
    bankOf(ctx.game);
    const err = act(ctx.game, w === 'all' || w === 'max' ? whole(ctx.game) : Number(w));
    if (err) fail(err);
    return [{ text: 'done', tone: 'ok' }];
  },
});
const coinArg = (w) => {
  const k = COINS.find((x) => x.id === String(w ?? '').toUpperCase());
  if (!k) fail(tl('systems.commands.apps.bank.usage_a_coin_id', COINS.map((x) => x.id).join(', ')));
  return k.id;
};

export const bankApp = {
  alias: [],
  window: 'bank',
  about: tl('systems.commands.apps.bank.your_money'),
  commands: {
    save: mover('<n|all>', 'put credits into savings', deposit, (g) => g.player.credits),
    withdraw: mover('<n|all>', 'take credits out of savings', withdraw, (g) => g.bank.savings),
    loan: mover('<n|max>', 'borrow credits (one loan at a time)', borrow, loanLimit),
    repay: mover('<n|all>', 'pay the loan back', repay, (g) => g.bank.loan?.owed ?? 0),
    wallet: {
      args: '', help: tl('systems.commands.apps.bank.savings_the_loan_and'),
      run(ctx) {
        const { game } = ctx;
        const b = bankOf(game);
        return [
          { text: `SAVINGS ${cr(b.savings)} // LOAN ${b.loan ? `${cr(b.loan.owed)} due in ${Math.max(((b.loan.due - game.clock.minutes) / 1440), 0).toFixed(1)} days` : 'none'}`, tone: 'head' },
          ...COINS.map((k) => {
            const h = holding(game, k.id);
            return { text: `${pad(k.id, 6)}${pad(k.risk, 6)}${pad(`${b.crypto.prices[k.id].toFixed(2)} cr`, 14)}held ${h.units.toFixed(3)} (${Math.round(h.value)} cr, ${h.pnl >= 0 ? '+' : ''}${Math.round(h.pnl)})` };
          }),
        ];
      },
    },
    buy: {
      args: '<coin> <credits>', help: tl('systems.commands.apps.bank.buy_a_coin_with'),
      run(ctx, [coin, n]) {
        bankOf(ctx.game);
        const err = buyCoin(ctx.game, coinArg(coin), Number(n));
        if (err) fail(err);
        return [{ text: 'bought', tone: 'ok' }];
      },
    },
    sell: {
      args: '<coin> <units|all>', help: tl('systems.commands.apps.bank.sell_a_coin'),
      run(ctx, [coin, n]) {
        bankOf(ctx.game);
        const err = sellCoin(ctx.game, coinArg(coin), n === 'all' ? 'all' : Number(n));
        if (err) fail(err);
        return [{ text: 'sold', tone: 'ok' }];
      },
    },
    balance: { args: '', help: tl('systems.commands.apps.bank.your_credits'), run: (ctx) => [{ text: cr(ctx.game.player.credits), tone: 'head' }] },
    ledger: {
      args: '[n]', help: tl('systems.commands.apps.bank.the_last_n_transactions'),
      run(ctx, [n]) {
        const rows = (ctx.game.ledger ?? []).slice(-Math.max(Number(n) || 10, 1));
        if (!rows.length) return [{ text: 'no transactions' }];
        return rows.map((l) => ({ text: `${pad(clock(l.minute), 14)}${pad(`${l.amount >= 0 ? '+' : '-'}${cr(Math.abs(l.amount))}`, 14)}${l.reason}`, tone: l.amount >= 0 ? 'ok' : 'err' }));
      },
    },
  },
};
