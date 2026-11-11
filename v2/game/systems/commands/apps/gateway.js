import { forms, chassisDef, boardDef } from '../../../data/content.js';
import { buildOf, buildLeft, migrationPlan, migrate } from '../../../state/build.js';
import { boardOf, chassisOf } from '../../../state/gateway.js';
import { pad, fail, rowOf, press, gwPress } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const gatewayApp = {
  alias: ['gw'],
  window: 'gateway',
  about: tl('systems.commands.apps.gateway.your_own_machine_parts'),
  commands: {
    specs: {
      args: '', help: tl('systems.commands.apps.gateway.the_fitted_parts_by'),
      run(ctx) {
        const gw = ctx.game.player.gateway;
        return [
          { text: `GATEWAY ${gw.ip ?? ''}`, tone: 'head' },
          { text: `case ${chassisOf(gw).name} (${forms()[chassisOf(gw).form - 1]}) // board ${boardOf(gw).name}` },
          ...gw.parts.map((p, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(p.kind.toUpperCase(), 10)}T${p.level}  ${p.name}` })),
        ];
      },
    },
    remove: {
      args: '<slot #> --yes', help: tl('systems.commands.apps.gateway.take_a_fitted_part'),
      run(ctx, [w, yes]) {
        const i = rowOf(w);
        if (!ctx.game.player.gateway.parts[i]) fail(tl('systems.commands.apps.gateway.pick_a_slot_n'));
        return gwPress(ctx, `gw.sell.${i}`, yes, 'part moved to stock');
      },
    },
    relocate: {
      args: '', help: tl('systems.commands.apps.gateway.drive_the_mobile_c2'),
      run: (ctx) => press(ctx, 'gw.relocate', 'the Van is on the road'),
    },
    stock: {
      args: '', help: tl('systems.commands.apps.gateway.the_parts_in_stock'),
      run(ctx) {
        const stock = ctx.game.player.stock ?? [];
        if (!stock.length) return [{ text: 'stock is empty' }];
        return stock.map((p, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(p.kind.toUpperCase(), 10)}T${p.level}  ${p.name}` }));
      },
    },
    fit: {
      args: '<#>', help: tl('systems.commands.apps.gateway.fit_a_part_from'),
      run(ctx, [w]) {
        const i = rowOf(w);
        if (!(ctx.game.player.stock ?? [])[i]) fail(tl('systems.commands.apps.gateway.pick_n_from_gw'));
        return press(ctx, `gw.stock.fit.${i}`, 'part fitted');
      },
    },
    build: {
      args: '', help: tl('systems.commands.apps.gateway.the_machine_being_built'),
      run(ctx) {
        const b = buildOf(ctx.game);
        if (!b) return [{ text: 'no build under way: start one on the BUILD tab of the Device Manager' }];
        const left = buildLeft(ctx.game);
        return [
          { text: `BUILD // case ${chassisDef(b.chassis).name} // board ${b.board ? boardDef(b.board).name : 'none'}`, tone: 'head' },
          ...b.parts.map((p, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(p.kind.toUpperCase(), 10)}T${p.level}  ${p.name}` })),
          { text: left ? `assembly: ${left} minutes left` : 'assembly done: `gw migrate <slot #> ... --yes` moves the live parts you name' },
        ];
      },
    },
    migrate: {
      args: '<slot #> ... --yes', help: tl('systems.commands.apps.gateway.move_the_finished_build'),
      run(ctx, args) {
        const take = args.filter((a) => a !== '--yes').map(rowOf);
        const plan = migrationPlan(ctx.game, take);
        if (plan.why) fail(plan.why);
        if (!args.includes('--yes')) return [{ text: `offline ${plan.minutes} minutes, ${plan.left.length} parts to stock: repeat with --yes` }];
        const why = migrate(ctx.game, take);
        if (why) fail(why);
        return [{ text: `migrated // offline ${plan.minutes} minutes` }];
      },
    },
    sell: {
      args: '<#> --yes', help: tl('systems.commands.apps.gateway.sell_a_part_from'),
      run(ctx, [w, yes]) {
        const i = rowOf(w);
        if (!(ctx.game.player.stock ?? [])[i]) fail(tl('systems.commands.apps.gateway.pick_n_from_gw'));
        return gwPress(ctx, `gw.stock.sell.${i}`, yes, 'part sold');
      },
    },
  },
};
