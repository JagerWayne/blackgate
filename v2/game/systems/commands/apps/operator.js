import { rankName } from '../../../core/theme.js';
import { cr, pad, fail } from '../helpers.js';
import { PERKS, perkOffer, choosePerk } from '../../../state/perks.js';
import { t as tl } from '../../../data/language.js';

export const operatorApp = {
  alias: ['stats'],
  window: 'stats',
  about: tl('systems.commands.apps.operator.your_rating_and_statistics'),
  commands: {
    perk: {
      args: '[id]', help: tl('systems.commands.apps.operator.the_perks_on_offer'),
      run(ctx, [id]) {
        const { game } = ctx;
        if (id) {
          const err = choosePerk(game, id);
          if (err) fail(err);
          return [{ text: `perk taken: ${PERKS.find((p) => p.id === id).label}`, tone: 'ok' }];
        }
        const have = (game.perks ?? []).map((p) => p.label).join(', ') || 'none';
        const offer = perkOffer(game);
        return [
          { text: `PERKS TAKEN // ${have}`, tone: 'head' },
          ...(offer.length ? offer.map((p) => ({ text: `${pad(p.id, 12)}${p.label} // ${p.text}` })) : [{ text: 'no perk on offer // one comes every 3 finished jobs' }]),
        ];
      },
    },
    show: {
      args: '', help: tl('systems.commands.apps.operator.rating_rank_and_statistics'),
      run(ctx) {
        const { player, stats } = ctx.game;
        return [
          { text: `${player.handle} // ${rankName(player.rating)} // rating ${player.rating}`, tone: 'head' },
          ...Object.entries(stats).map(([k, v]) => ({ text: `${pad(k.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`), 18)}${k === 'earned' ? cr(v) : v}` })),
        ];
      },
    },
  },
};
