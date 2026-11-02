import { SPEEDS } from '../../../state/cheats.js';
import { cr, clock, fail, press } from '../helpers.js';

export const cheatApp = {
  alias: [],
  window: 'cheats',
  hidden: true,
  about: 'the cheat menu (it does not mark the run)',
  commands: {
    money: {
      args: '<n>', help: 'set your credits',
      run(ctx, [n]) {
        (ctx.state.win.cheats ??= {}).money = n ?? '';
        const said = press(ctx, 'cheat.money.set', '');
        return said.some((l) => l.tone === 'err') ? said : [{ text: `credits now ${cr(ctx.game.player.credits)}`, tone: 'ok' }];
      },
    },
    heat: {
      args: '<0-99>', help: 'set heat',
      run(ctx, [n]) {
        const v = Number(n);
        if (n === undefined || !Number.isFinite(v)) fail('usage: cheat heat <0-99>');
        const to = Math.max(0, Math.min(99, Math.round(v)));
        return press(ctx, `cheat.heat.set.${to}`, `heat set to ${to}`);
      },
    },
    rating: {
      args: '<n>', help: 'set your rating',
      run(ctx, [n]) {
        const v = Number(n);
        if (n === undefined || !Number.isFinite(v)) fail('usage: cheat rating <n>');
        press(ctx, `cheat.rating.${Math.round(v - ctx.game.player.rating)}`, '');
        return [{ text: `rating now ${ctx.game.player.rating}`, tone: 'ok' }];
      },
    },
    speed: {
      args: `<${SPEEDS.join('|')}>`, help: 'clock speed',
      run(ctx, [n]) {
        if (!SPEEDS.includes(Number(n))) fail(`usage: cheat speed <${SPEEDS.join('|')}>`);
        return press(ctx, `cheat.time.${n}`, `clock at ${n}x`);
      },
    },
    reveal: { args: '', help: 'reveal the whole map', run: (ctx) => press(ctx, 'cheat.map', 'map revealed') },
    tools: { args: '', help: 'every tool at v5', run: (ctx) => press(ctx, 'cheat.tools', 'every tool at v5') },
    gateway: { args: '', help: 'max the gateway', run: (ctx) => press(ctx, 'cheat.gateway', 'gateway maxed') },
    mission: { args: '', help: 'open the MISSION BUILDER', run: (ctx) => press(ctx, 'cheat.missions', 'MISSION BUILDER opened') },
  },
};
