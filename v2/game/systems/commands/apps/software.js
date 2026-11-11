import { software } from '../../../data/content.js';
import { toolPrice } from '../../../state/economy.js';
import { cr, pad, fail, press, toolArg, toolLevel } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const softwareApp = {
  alias: ['sw'],
  window: 'software',
  about: tl('systems.commands.apps.software.your_tools_and_the'),
  commands: {
    list: {
      args: '', help: tl('systems.commands.apps.software.your_tools_and_their'),
      run(ctx) {
        const mine = ctx.game.player.tools.filter((t) => t.level > 0);
        if (!mine.length) return [{ text: 'no tools' }];
        return mine.map((t) => ({ text: `${pad(software().find((x) => x.kind === t.kind)?.name ?? t.kind, 26)}v${t.level}` }));
      },
    },
    shop: {
      args: '', help: tl('systems.commands.apps.software.every_tool_and_the'),
      run(ctx) {
        return software().map((t) => {
          const lvl = toolLevel(ctx.game, t.kind);
          const max = t.versions?.length ?? 5;
          return { text: `${pad(t.name, 26)}${pad(lvl ? `have v${lvl}` : 'not owned', 11)}${lvl >= max ? 'top version' : `v${lvl + 1} for ${cr(toolPrice(t, lvl + 1))}`}` };
        });
      },
    },
    info: {
      args: '<tool>', help: tl('systems.commands.apps.software.what_a_tool_does'),
      run(ctx, [w]) {
        const t = toolArg(w);
        const lvl = toolLevel(ctx.game, t.kind);
        return [{ text: `${t.name} // you have ${lvl ? `v${lvl}` : 'none'}`, tone: 'head' }, { text: t.desc ?? '' }];
      },
    },
    buy: {
      args: '<tool> [version]', help: tl('systems.commands.apps.software.buy_or_upgrade_a'),
      run(ctx, [w, v]) {
        const t = toolArg(w);
        const before = toolLevel(ctx.game, t.kind);
        const level = v ? Number(String(v).replace(/^v/i, '')) : before + 1;
        if (!Number.isInteger(level) || level < 1) fail(tl('systems.commands.apps.software.usage_sw_buy_tool'));
        const said = press(ctx, `sw.buy.${t.kind}.${level}`, '');
        if (toolLevel(ctx.game, t.kind) > before) return [{ text: `${t.name} v${level} installed`, tone: 'ok' }];
        return said.some((l) => l.text) ? said : [{ text: `could not buy ${t.name} v${level} // check the price and your rating`, tone: 'err' }];
      },
    },
  },
};
