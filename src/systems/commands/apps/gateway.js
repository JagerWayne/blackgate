import { componentsOf, chassis } from '../../../data/content.js';
import { cr, pad, fail, rowOf, press, pick, gwPress } from '../helpers.js';

export const gatewayApp = {
  alias: ['gw'],
  window: 'gateway',
  about: 'your own machine: parts, shop and stock',
  commands: {
    specs: {
      args: '', help: 'the fitted parts, by slot',
      run(ctx) {
        const gw = ctx.game.player.gateway;
        return [
          { text: `GATEWAY ${gw.ip ?? ''}`, tone: 'head' },
          ...gw.parts.map((p, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(p.kind.toUpperCase(), 10)}T${p.level}  ${p.name}` })),
        ];
      },
    },
    shop: {
      args: '[cpu|accel|fpga|hsm|storage|modem|security|chassis]', help: 'the parts for sale',
      run(ctx, [kind = 'cpu']) {
        if (kind === 'chassis') {
          ctx.term.last = { kind: 'shop', ids: chassis().map((c) => `gw.chassis.${c.tier}`) };
          return chassis().map((c, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(c.name, 26)}${pad(cr(c.price), 12)}${c.note ?? ''}` }));
        }
        const list = componentsOf(kind);
        if (!list.length) fail('usage: gw shop [cpu|accel|fpga|hsm|storage|modem|security|chassis]');
        ctx.term.last = { kind: 'shop', ids: list.map((d) => `gw.buy.${kind}.${d.tier}`) };
        return list.map((d, i) => ({ text: `${pad(`#${i + 1}`, 5)}T${d.tier} ${pad(d.name, 30)}${pad(cr(d.price), 12)}${d.note ?? ''}` }));
      },
    },
    buy: {
      args: '<#> [--yes]', help: 'buy #n from the last `gw shop` list; --yes when it takes a part out',
      run(ctx, [w, yes]) {
        const id = pick(ctx, w, 'shop');
        if (!id) fail('pick #n from the last `gw shop` list');
        const before = ctx.game.player.credits;
        const out = gwPress(ctx, id, yes, '');
        if (ctx.game.player.credits < before) return [{ text: `bought for ${cr(before - ctx.game.player.credits)}`, tone: 'ok' }];
        return out.some((l) => l.text) ? out : [{ text: 'not bought // check the price and your slots', tone: 'err' }];
      },
    },
    remove: {
      args: '<slot #> --yes', help: 'take a fitted part out into stock',
      run(ctx, [w, yes]) {
        const i = rowOf(w);
        if (!ctx.game.player.gateway.parts[i]) fail('pick a slot #n from `gw specs`');
        return gwPress(ctx, `gw.sell.${i}`, yes, 'part moved to stock');
      },
    },
    relocate: {
      args: '', help: 'drive the Mobile C2 Van to a new grid (from a Yellow investigation, once a day)',
      run: (ctx) => press(ctx, 'gw.relocate', 'the Van is on the road'),
    },
    stock: {
      args: '', help: 'the parts in stock',
      run(ctx) {
        const stock = ctx.game.player.stock ?? [];
        if (!stock.length) return [{ text: 'stock is empty' }];
        return stock.map((p, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(p.kind.toUpperCase(), 10)}T${p.level}  ${p.name}` }));
      },
    },
    fit: {
      args: '<#>', help: 'fit a part from stock',
      run(ctx, [w]) {
        const i = rowOf(w);
        if (!(ctx.game.player.stock ?? [])[i]) fail('pick #n from `gw stock`');
        return press(ctx, `gw.stock.fit.${i}`, 'part fitted');
      },
    },
    sell: {
      args: '<#> --yes', help: 'sell a part from stock for 30% to 55% of its price',
      run(ctx, [w, yes]) {
        const i = rowOf(w);
        if (!(ctx.game.player.stock ?? [])[i]) fail('pick #n from `gw stock`');
        return gwPress(ctx, `gw.stock.sell.${i}`, yes, 'part sold');
      },
    },
  },
};
