import { rankName } from '../../../core/theme.js';
import { cr, pad } from '../helpers.js';

export const operatorApp = {
  alias: ['stats'],
  window: 'stats',
  about: 'your rating and statistics',
  commands: {
    show: {
      args: '', help: 'rating, rank and statistics',
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
