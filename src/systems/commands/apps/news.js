import { pad, clock, fail, rowOf, pick } from '../helpers.js';

export const newsApp = {
  alias: [],
  window: 'news',
  about: 'the newswire',
  commands: {
    list: {
      args: '', help: 'the headlines, newest first',
      run(ctx) {
        const n = ctx.game.news.length;
        ctx.term.last = { kind: 'news', ids: ctx.game.news.map((_, i) => n - 1 - i) };
        if (!n) return [{ text: 'no news' }];
        return ctx.game.news.slice().reverse().map((x, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(clock(x.minute), 14)}${x.headline}` }));
      },
    },
    read: {
      args: '<#>', help: 'read a story',
      run(ctx, [w]) {
        const i = pick(ctx, w, 'news') ?? ctx.game.news.length - 1 - rowOf(w);
        const x = rowOf(w) >= 0 ? ctx.game.news[i] : null;
        if (!x) fail('pick #n from `news list`');
        return [{ text: x.headline, tone: 'head' }, ...String(x.body ?? '').split('\n').map((text) => ({ text }))];
      },
    },
  },
};
