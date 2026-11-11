import { SPEEDS } from '../../../state/cheats.js';
import { cr, clock, fail, press } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const cheatApp = {
  alias: [],
  window: 'cheats',
  hidden: true,
  about: tl('systems.commands.apps.cheat.the_cheat_menu_it'),
  commands: {
    money: {
      args: '<n>', help: tl('systems.commands.apps.cheat.set_your_credits'),
      run(ctx, [n]) {
        (ctx.state.win.cheats ??= {}).money = n ?? '';
        const said = press(ctx, 'cheat.money.set', '');
        return said.some((l) => l.tone === 'err') ? said : [{ text: `credits now ${cr(ctx.game.player.credits)}`, tone: 'ok' }];
      },
    },
    heat: {
      args: '<0-99>', help: tl('systems.commands.apps.cheat.set_heat'),
      run(ctx, [n]) {
        const v = Number(n);
        if (n === undefined || !Number.isFinite(v)) fail(tl('systems.commands.apps.cheat.usage_cheat_heat_0'));
        const to = Math.max(0, Math.min(99, Math.round(v)));
        return press(ctx, `cheat.heat.set.${to}`, `heat set to ${to}`);
      },
    },
    rating: {
      args: '<n>', help: tl('systems.commands.apps.cheat.set_your_rating'),
      run(ctx, [n]) {
        const v = Number(n);
        if (n === undefined || !Number.isFinite(v)) fail(tl('systems.commands.apps.cheat.usage_cheat_rating_n'));
        press(ctx, `cheat.rating.${Math.round(v - ctx.game.player.rating)}`, '');
        return [{ text: `rating now ${ctx.game.player.rating}`, tone: 'ok' }];
      },
    },
    speed: {
      args: `<${SPEEDS.join('|')}>`, help: tl('systems.commands.apps.cheat.clock_speed'),
      run(ctx, [n]) {
        if (!SPEEDS.includes(Number(n))) fail(tl('systems.commands.apps.cheat.usage_cheat_speed', SPEEDS.join('|')));
        return press(ctx, `cheat.time.${n}`, `clock at ${n}x`);
      },
    },
    reveal: { args: '', help: tl('systems.commands.apps.cheat.reveal_the_whole_map'), run: (ctx) => press(ctx, 'cheat.map', 'map revealed') },
    tools: { args: '', help: tl('systems.commands.apps.cheat.every_tool_at_v5'), run: (ctx) => press(ctx, 'cheat.tools', 'every tool at v5') },
    tutorial: { args: '', help: tl('systems.commands.apps.cheat.skip_the_tutorial_the'), run: (ctx) => press(ctx, 'cheat.tutorial', 'tutorial skipped') },
    gateway: { args: '', help: tl('systems.commands.apps.cheat.max_the_gateway'), run: (ctx) => press(ctx, 'cheat.gateway', 'gateway maxed') },
    mission: { args: '', help: tl('systems.commands.apps.cheat.open_the_mission_builder'), run: (ctx) => press(ctx, 'cheat.missions', 'MISSION BUILDER opened') },
  },
};
