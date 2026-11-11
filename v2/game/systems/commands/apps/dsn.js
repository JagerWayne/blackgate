import { askFee, takeOffer, haggleOf, haggleOdds } from '../../../state/haggle.js';
import { openWindow } from '../../../state/windows.js';
import { cr, fail, press, contractArg } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const dsnApp = {
  alias: ['web', 'deppspacenet'],
  window: 'dsn',
  about: tl('systems.commands.apps.dsn.dsnet_browse_the_hidden'),
  commands: {
    open: {
      args: '[address]', help: tl('systems.commands.apps.dsn.open_a_page_dsn'),
      run(ctx, [w]) {
        openWindow(ctx.state.windows, 'dsn', ctx.desk);
        return press(ctx, `dsn.go.${w ?? 'hub'}`, `loading dsn://${(w ?? 'hub').replace(/^dsn:\/\//i, '')}`);
      },
    },
    search: {
      args: '<text>', help: tl('systems.commands.apps.dsn.search_listings_brokers_and'),
      run(ctx, rest) {
        if (!rest.length) fail(tl('systems.commands.apps.dsn.usage_dsn_search_text'));
        openWindow(ctx.state.windows, 'dsn', ctx.desk);
        return press(ctx, `dsn.go.search/${encodeURIComponent(rest.join(' '))}`, `searching for "${rest.join(' ')}"`);
      },
    },
    haggle: {
      args: '<job> <amount|+n%>', help: tl('systems.commands.apps.dsn.ask_a_client_for'),
      run(ctx, [j, amt]) {
        const c = contractArg(ctx, j);
        if (!amt) fail(tl('systems.commands.apps.dsn.usage_dsn_haggle_job'));
        const ask = amt.endsWith('%') ? c.reward * (1 + Number(amt.replace(/[+%]/g, '')) / 100) : Number(amt);
        const err = askFee(ctx.game, c.id, ask);
        if (err) fail(err);
        return [{ text: `asked ${c.client} for ${Math.round(ask)} cr // odds ${Math.round(haggleOdds(ctx.game, c, ask) * 100)}% // the answer comes in a few minutes`, tone: 'ok' }];
      },
    },
    reply: {
      args: '<job>', help: tl('systems.commands.apps.dsn.the_client_s_channel'),
      run(ctx, [j]) {
        const c = contractArg(ctx, j);
        const hg = haggleOf(ctx.game, c.id);
        if (!hg) return [{ text: 'no ask made on this job yet' }];
        return [...hg.log.map((m) => ({ text: `${m.who.toUpperCase()}: ${m.text}`, tone: m.who === 'you' ? 'echo' : 'info' })), { text: `state: ${hg.state}`, tone: 'head' }];
      },
    },
    take: {
      args: '<job>', help: tl('systems.commands.apps.dsn.take_the_client_s'),
      run(ctx, [j]) {
        const c = contractArg(ctx, j);
        const err = takeOffer(ctx.game, c.id);
        if (err) fail(err);
        return [{ text: `accepted #${c.id} at ${c.reward} cr`, tone: 'ok' }];
      },
    },
  },
};
