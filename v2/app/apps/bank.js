import { bankOf, loanLimit } from '../../game/state/finance.js';
import { COINS, holding, FEE } from '../../game/state/crypto.js';
import { hhmm } from '../../game/core/clock.js';
import { esc, click, autoRender } from '../ui.js';
import { loanRate, savingsCap, savingsRate } from '../../game/data/settings.js';

const TABS = ['ACCOUNT', 'SAVINGS', 'LOANS', 'WALLET'];
const money = (n) => Math.round(n).toLocaleString('en-US');
const act = (id, text, on = true) => `<button data-id="${id}" ${on ? '' : 'disabled'} class="rounded bg-accent/20 px-3 py-1 text-xs font-bold text-accent enabled:hover:bg-accent/30 disabled:opacity-30">${text}</button>`;
const row = (...btns) => `<div class="flex flex-wrap gap-2">${btns.join('')}</div>`;
const kv = (k, v, tone = '') => `<div class="flex justify-between gap-4 border-b border-line/50 py-1"><span class="text-ink/50">${k}</span><b class="${tone}">${v}</b></div>`;
const head = (t) => `<h3 class="pb-1 pt-3 text-[10px] tracking-widest text-ink/50">${t}</h3>`;

/// The money movements, newest first. A run saved before the ledger kept its own history reads what is
/// left of it in the operator's log.
function ledgerOf(game) {
  if (Array.isArray(game.ledger)) return game.ledger.slice().reverse();
  return game.log
    .filter((l) => l.text.startsWith('ledger'))
    .map((l) => {
      const m = /^ledger ([+-]\d+) cr \/\/ (.*)$/.exec(l.text);
      return { minute: l.minute, amount: m ? Number(m[1]) : 0, reason: m ? m[2] : l.text };
    })
    .reverse();
}

function spark(hist) {
  const lo = Math.min(...hist);
  const hi = Math.max(...hist);
  const pts = hist.map((v, i) => `${(i / Math.max(hist.length - 1, 1)) * 100},${34 - 3 - ((v - lo) / Math.max(hi - lo, 1e-9)) * 28}`).join(' ');
  return `<svg viewBox="0 0 100 34" preserveAspectRatio="none" class="h-8 w-full"><polyline points="${pts}" fill="none" stroke="${hist.at(-1) >= hist[0] ? '#34d399' : '#f87171'}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

/// Money: account and ledger, savings, loans and the crypto wallet. The same four tabs (state.win.bank.tab)
/// and the same bank.* ids as the canvas window; every button goes through the game's click handler, so
/// the bank's own rules and refusals apply.
export function mountBank(body, state) {
  const view = () => (state.win.bank ??= {});

  function account(game) {
    const acct = game.player.accounts?.[0];
    const b = game.bank;
    const wallet = COINS.reduce((sum, k) => sum + holding(game, k.id).value, 0);
    const figs = [['SAVINGS', b.savings, 'text-emerald-400'], ['OWED', b.loan?.owed ?? 0, b.loan ? 'text-red-400' : 'text-ink/40'], ['WALLET', Math.round(wallet), 'text-violet-300']];
    const moves = ledgerOf(game);
    return `<div class="flex h-full flex-col"><section class="shrink-0 border-b border-line p-4"><div class="text-[10px] tracking-widest text-ink/50">AVAILABLE BALANCE</div>
      <div class="text-3xl font-bold text-accent">${money(game.player.credits)} cr</div><div class="text-ink/50">${acct ? `${esc(acct.bank)} // ${esc(acct.number)}` : 'no account opened'}</div>
      <div class="mt-3 flex gap-8">${figs.map(([n, v, t]) => `<div><div class="text-[10px] text-ink/50">${n}</div><b class="${t}">${money(v)} cr</b></div>`).join('')}</div>
      ${(game.player.accounts ?? []).slice(1).map((a) => `<div class="mt-2 flex justify-between text-ink/60"><span>${esc(a.bank)} // ${esc(a.number)}</span><span>${money(a.balance)} cr</span></div>`).join('')}</section>
      <div class="shrink-0 px-4 pt-2 text-[10px] tracking-widest text-ink/50">LEDGER // ${moves.length} entries // fees clear into the first account</div>
      <div data-scroll="ledger" class="min-h-0 flex-1 overflow-y-auto"><table class="w-full text-xs"><tbody>${moves.map((m) => `<tr class="border-t border-line"><td class="px-4 py-1.5 text-ink/50">DAY ${Math.floor(m.minute / 1440) + 1} ${hhmm({ minutes: m.minute })}</td><td class="px-2">${esc(m.reason)}</td><td class="px-4 text-right ${m.amount > 0 ? 'text-emerald-400' : 'text-red-400'}">${m.amount > 0 ? '+' : ''}${money(m.amount)} cr</td></tr>`).join('') || '<tr><td class="p-4 text-ink/40">no transactions yet: jobs, loans and trades appear here</td></tr>'}</tbody></table></div></div>`;
  }

  function savings(game) {
    const b = game.bank;
    const c = game.player.credits;
    return `<h2 class="font-bold">SAVINGS</h2>${kv('SAVED', `${b.savings} cr`, 'text-amber-300')}${kv('INTEREST', `${(savingsRate() * 100).toFixed(1)}% a day, up to ${savingsCap()} cr`)}${kv('ON HAND', `${c} cr`)}
      ${head('DEPOSIT')}${row(act('bank.dep.100', '100', c >= 100), act('bank.dep.1000', '1000', c >= 1000), act('bank.dep.all', 'ALL', c > 0))}
      ${head('WITHDRAW')}${row(act('bank.wd.100', '100', b.savings >= 100), act('bank.wd.1000', '1000', b.savings >= 1000), act('bank.wd.all', 'ALL', b.savings > 0))}`;
  }

  function loans(game) {
    const b = game.bank;
    const lim = loanLimit(game);
    let out = `<h2 class="font-bold">LOAN</h2>${kv('LIMIT', `${lim} cr // grows with your rating`)}${kv('INTEREST', `${(loanRate() * 100).toFixed(0)}% a day`)}`;
    if (!b.loan) {
      const locked = game.clock.minutes < b.lockUntil;
      return `${out}${kv('STATE', locked ? 'the bank will not lend yet' : 'no loan', locked ? 'text-red-400' : 'text-emerald-400')}${head('BORROW')}${row(act('bank.borrow.500', '500', !locked && lim >= 500), act('bank.borrow.2000', '2000', !locked && lim >= 2000), act('bank.borrow.max', 'MAX', !locked))}`;
    }
    const days = Math.max((b.loan.due - game.clock.minutes) / 1440, 0);
    out += `${kv('OWED', `${b.loan.owed} cr`, 'text-red-400')}${kv(b.loan.defaulted ? 'OVERDUE // TAKEN AT' : 'DUE IN', `${days.toFixed(1)} days`, b.loan.defaulted || days < 2 ? 'text-red-400' : 'text-amber-300')}
      <p class="py-1 text-[11px] text-ink/50">a missed due date empties your balance, costs rating and adds heat</p>${head('REPAY')}`;
    return out + row(act('bank.repay.100', '100', game.player.credits >= 100), act('bank.repay.1000', '1000', game.player.credits >= 1000), act('bank.repay.all', 'ALL', game.player.credits > 0));
  }

  function wallet(game) {
    const c = game.bank.crypto;
    return `<p class="pb-2 text-[11px] text-ink/50">prices move every hour // ${(FEE * 100).toFixed(0)}% fee on each trade // wild coins can crash</p>${COINS.map((k) => {
      const h = holding(game, k.id);
      const tone = k.risk === 'LOW' ? 'text-emerald-400' : k.risk === 'MID' ? 'text-amber-300' : 'text-red-400';
      return `<section class="mb-4"><h3 class="text-[11px] font-bold tracking-widest text-ink/70">${k.id} // ${esc(k.name)} // ${k.risk} RISK</h3>${kv('PRICE', `${c.prices[k.id].toFixed(2)} cr`, tone)}${spark(c.hist[k.id])}
        ${kv('HELD', `${h.units.toFixed(3)} (${Math.round(h.value)} cr)`)}${kv('PROFIT', `${h.pnl >= 0 ? '+' : ''}${Math.round(h.pnl)} cr`, h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400')}
        <div class="pt-1">${row(act(`bank.buy.${k.id}.100`, 'BUY 100', game.player.credits >= 100), act(`bank.buy.${k.id}.1000`, 'BUY 1000', game.player.credits >= 1000), act(`bank.sell.${k.id}.half`, 'SELL HALF', h.units > 0), act(`bank.sell.${k.id}.all`, 'SELL ALL', h.units > 0))}</div></section>`;
    }).join('')}`;
  }

  function render() {
    const game = state.game;
    bankOf(game);
    const tab = view().tab ?? 0;
    const pane = tab === 0 ? account(game) : `<div data-scroll="banktab" class="h-full overflow-y-auto"><div class="max-w-xl p-4 text-xs">${[savings, loans, wallet][tab - 1](game)}</div></div>`;
    body.innerHTML = `<div class="flex h-full flex-col"><nav class="flex shrink-0 border-b border-line">${TABS.map((t, i) => `<button data-id="bank.tab.${i}" class="px-4 py-2 text-xs font-bold ${i === tab ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${t}</button>`).join('')}</nav><div class="min-h-0 flex-1">${pane}</div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    bankOf(g);
    return JSON.stringify([view().tab, g.player.credits, g.player.accounts?.map((a) => a.balance), g.bank, g.ledger?.length, Math.floor(g.clock.minutes / 60)]);
  }, render);

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    click(state, b.dataset.id);
    refresh();
  });
}
