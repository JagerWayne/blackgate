// The bank: savings, one loan at a time, and the crypto wallet. Money moves
// through the game's own helpers, so every movement lands in the ledger.
// Every call returns an error text, or null when it worked.

import { refund, adjust, note, toast } from './gameHelpers.js';
import { MINUTES_PER_DAY } from '../core/clock.js';
import { initCrypto, cryptoCatchUp } from './crypto.js';
import { billDay, collectArrears } from './upkeep.js';
import { loanDays, loanRate, savingsCap, savingsRate } from '../data/settings.js';
import { t as tl } from '../data/language.js';

const GRACE_DAYS = 3; // extra time after a missed due date
const LOCKOUT_DAYS = 5; // no new loan after a default is cleared
const DEFAULT_HEAT = 8;

/// The bank state, made on first use so an older save gets it too.
export function bankOf(game) {
  if (!game.bank) {
    game.bank = {
      savings: 0,
      loan: null,
      lockUntil: 0,
      arrears: 0,
      day: Math.floor(game.clock.minutes / MINUTES_PER_DAY),
      crypto: initCrypto(game),
    };
  }
  return game.bank;
}

/// The most a loan can be: it grows with the operator's rating.
export const loanLimit = (game) => 1000 + (game.player.rating ?? 0) * 400;

const whole = (n) => Math.floor(Number(n));
const bad = (n) => !Number.isFinite(n) || n <= 0;

/// Credits into savings.
export function deposit(game, amount) {
  const b = bankOf(game);
  const n = whole(amount);
  if (bad(n)) return 'enter an amount above zero';
  if (n > game.player.credits) return 'not enough credits';
  if (b.savings + n > savingsCap()) return `savings hold at most ${savingsCap()} cr`;
  adjust(game, -n, 'savings deposit');
  b.savings += n;
  return null;
}

/// Savings back to credits.
export function withdraw(game, amount) {
  const b = bankOf(game);
  const n = whole(amount);
  if (bad(n)) return 'enter an amount above zero';
  if (n > b.savings) return 'not enough in savings';
  b.savings -= n;
  refund(game, n, 'savings withdrawal');
  return null;
}

/// Takes the loan out.
export function borrow(game, amount) {
  const b = bankOf(game);
  const n = whole(amount);
  if (bad(n)) return 'enter an amount above zero';
  if (b.loan) return 'repay the loan you have first';
  if (game.clock.minutes < b.lockUntil) return 'the bank will not lend to you yet';
  if (n > loanLimit(game)) return `the limit is ${loanLimit(game)} cr`;
  b.loan = { owed: n, due: game.clock.minutes + loanDays() * MINUTES_PER_DAY, defaulted: false };
  refund(game, n, 'loan paid out');
  return null;
}

/// Pays the loan back, all or in part.
export function repay(game, amount) {
  const b = bankOf(game);
  if (!b.loan) return 'no loan to repay';
  const n = Math.min(whole(amount), b.loan.owed);
  if (bad(n)) return 'enter an amount above zero';
  if (n > game.player.credits) return 'not enough credits';
  adjust(game, -n, 'loan repayment');
  settle(game, n);
  return null;
}

/// Takes `n` off the loan; one cleared after a default locks new loans for a while.
function settle(game, n) {
  const b = bankOf(game);
  b.loan.owed -= n;
  if (b.loan.owed > 0) return;
  if (b.loan.defaulted) b.lockUntil = game.clock.minutes + LOCKOUT_DAYS * MINUTES_PER_DAY;
  b.loan = null;
  note(game, 'loan cleared');
}

/// The per-minute work: daily interest, the loan's due date, the crypto prices.
export function bankTick(game) {
  const b = bankOf(game);
  const now = game.clock.minutes;
  const today = Math.floor(now / MINUTES_PER_DAY);
  for (let guard = 0; b.day < today && guard < 400; b.day += 1, guard += 1) {
    b.savings += Math.floor(b.savings * savingsRate());
    if (b.loan) b.loan.owed += Math.ceil(b.loan.owed * loanRate());
    // the day's running costs: what is owed first, then the new bill
    collectArrears(game);
    billDay(game);
  }
  b.day = Math.max(b.day, today);
  if (b.loan && now >= b.loan.due) collect(game);
  cryptoCatchUp(game);
}

/// The due date passed: the bank takes what the balance covers, and a
/// shortfall costs rating and heat.
function collect(game) {
  const b = bankOf(game);
  const take = Math.min(game.player.credits, b.loan.owed);
  if (take > 0) {
    adjust(game, -take, 'loan collected');
    settle(game, take);
  }
  if (!b.loan) {
    toast(game, tl('state.finance.the_bank_collected_the'), 'info');
    return;
  }
  b.loan.defaulted = true;
  b.loan.due = game.clock.minutes + GRACE_DAYS * MINUTES_PER_DAY;
  game.player.rating = Math.max(game.player.rating - 2, 0);
  game.player.heat = Math.min(game.player.heat + DEFAULT_HEAT, 100);
  note(game, `loan default // ${b.loan.owed} cr still owed`);
  toast(game, tl('state.finance.loan_default_cr_still', b.loan.owed), 'bad');
}
