import { contractLabel } from '../../../state/contracts.js';
import { cr, pad, clock, fail, press, contractArg, link, simple } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const contractsApp = {
  alias: ['ct'],
  window: 'dsn',
  about: tl('systems.commands.apps.contracts.your_jobs_and_the'),
  commands: {
    list: {
      args: '[offered|accepted|ready|done|all]', help: tl('systems.commands.apps.contracts.the_jobs_with_id'),
      run(ctx, [which = 'all']) {
        const list = ctx.game.contracts.filter((c) => which === 'all' || c.state === which || (which === 'done' && c.state === 'paid'));
        ctx.term.last = { kind: 'contract', ids: list.map((c) => c.id) };
        if (!list.length) return [{ text: 'no jobs' }];
        return list.map((c, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(c.id, 6)}${pad(c.state.toUpperCase(), 10)}${pad(contractLabel(c), 30)} ${pad(cr(c.reward), 12)} due ${clock(c.deadline)}` }));
      },
    },
    show: {
      args: '<id>', help: tl('systems.commands.apps.contracts.the_full_brief_and'),
      run(ctx, [word]) {
        const c = contractArg(ctx, word);
        const h = ctx.game.world.hosts[c.target];
        return [
          { text: `CONTRACT ${c.id} // ${contractLabel(c)} // ${c.state.toUpperCase()}`, tone: 'head' },
          { text: `CLIENT   ${c.client}` },
          { text: `TARGET   ${h?.discovered ? `${h.name} (${h.ip})` : 'not on your map yet // `ct target` reveals it'}` },
          ...(c.file ? [{ text: `FILE     ${c.file}` }] : []),
          { text: `FEE      ${cr(c.reward)}` },
          { text: `DUE      ${clock(c.deadline)}` },
          ...String(c.brief ?? '').split('\n').map((text) => ({ text })),
        ];
      },
    },
    accept: simple('<id>', 'take an offered job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.accept.${c.id}`, done: `contract ${c.id} accepted` }; }),
    decline: simple('<id>', 'turn down an offered job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.decline.${c.id}`, done: `contract ${c.id} declined` }; }),
    drop: simple('<id>', 'abandon an accepted job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.drop.${c.id}`, done: `contract ${c.id} dropped` }; }),
    target: simple('<id>', 'reveal and select the target on the map', (ctx, [w]) => ({ id: `ct.track.${contractArg(ctx, w).id}` }), 'target shown on the NEXUS MAP'),
    link: simple('<id>', 'connect to the target through your route', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.link.${c.id}`, done: 'link open' }; }),
    submit: {
      args: '<id>', help: tl('systems.commands.apps.contracts.hand_in_finished_work'),
      run(ctx, [w]) {
        const c = contractArg(ctx, w);
        if (c.state !== 'ready') fail(tl('systems.commands.apps.contracts.contract_is_finish_the', c.id, c.state));
        return press(ctx, `ct.submit.${c.id}`, `contract ${c.id} submitted`);
      },
    },
  },
};
