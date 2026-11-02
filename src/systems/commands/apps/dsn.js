import { askFee, takeOffer, haggleOf, haggleOdds } from '../../../state/haggle.js';
import { openWindow } from '../../../state/windows.js';
import { cr, fail, press, contractArg } from '../helpers.js';

export const dsnApp = {
  alias: ['web', 'deppspacenet'],
  window: 'dsn',
  about: 'DSNET: browse the hidden job market and haggle with clients',
  commands: {
    open: {
      args: '[address]', help: 'open a page (dsn://hub by default)',
      run(ctx, [w]) {
        openWindow(ctx.state.windows, 'dsn', ctx.desk);
        return press(ctx, `dsn.go.${w ?? 'hub'}`, `loading dsn://${(w ?? 'hub').replace(/^dsn:\/\//i, '')}`);
      },
    },
    search: {
      args: '<text>', help: 'search listings, brokers and companies',
      run(ctx, rest) {
        if (!rest.length) fail('usage: dsn search <text>');
        openWindow(ctx.state.windows, 'dsn', ctx.desk);
        return press(ctx, `dsn.go.search/${encodeURIComponent(rest.join(' '))}`, `searching for "${rest.join(' ')}"`);
      },
    },
    haggle: {
      args: '<job> <amount|+n%>', help: 'ask a client for a bigger fee (one ask per job)',
      run(ctx, [j, amt]) {
        const c = contractArg(ctx, j);
        if (!amt) fail('usage: dsn haggle <job> <amount|+n%>');
        const ask = amt.endsWith('%') ? c.reward * (1 + Number(amt.replace(/[+%]/g, '')) / 100) : Number(amt);
        const err = askFee(ctx.game, c.id, ask);
        if (err) fail(err);
        return [{ text: `asked ${c.client} for ${Math.round(ask)} cr // odds ${Math.round(haggleOdds(ctx.game, c, ask) * 100)}% // the answer comes in a few minutes`, tone: 'ok' }];
      },
    },
    reply: {
      args: '<job>', help: "the client's channel for a job",
      run(ctx, [j]) {
        const c = contractArg(ctx, j);
        const hg = haggleOf(ctx.game, c.id);
        if (!hg) return [{ text: 'no ask made on this job yet' }];
        return [...hg.log.map((m) => ({ text: `${m.who.toUpperCase()}: ${m.text}`, tone: m.who === 'you' ? 'echo' : 'info' })), { text: `state: ${hg.state}`, tone: 'head' }];
      },
    },
    take: {
      args: '<job>', help: "take the client's counter-offer, or the posted fee, and accept",
      run(ctx, [j]) {
        const c = contractArg(ctx, j);
        const err = takeOffer(ctx.game, c.id);
        if (err) fail(err);
        return [{ text: `accepted #${c.id} at ${c.reward} cr`, tone: 'ok' }];
      },
    },
  },
};
