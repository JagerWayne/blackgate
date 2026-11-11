import { openWindow } from '../../../state/windows.js';
import { savedRoutes, maxHops } from '../../../state/routes.js';
import { passesKind, passesQuery, MAP_FILTERS } from '../../../state/mapQuery.js';
import { recordsKept, RECORD_LABEL } from '../../../state/records.js';
import { HOST_LABEL } from '../../../data/enums.js';
import { pad, fail, rowOf, press, hostArg, link, simple } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const mapApp = {
  alias: [],
  window: 'map',
  about: tl('systems.commands.apps.map.the_hosts_you_know'),
  commands: {
    hosts: {
      args: '[kind] [text]', help: tl('systems.commands.apps.map.found_hosts_kinds', MAP_FILTERS.map(([k]) => k).join(', ')),
      run(ctx, [a, ...rest]) {
        const kinds = MAP_FILTERS.map(([k]) => k);
        const kind = kinds.includes(a) ? a : 'all';
        const text = (kinds.includes(a) ? rest : [a, ...rest]).filter(Boolean).join(' ');
        const list = ctx.game.world.hosts.filter((h) => h.discovered && passesKind(ctx.game, h, kind) && passesQuery(ctx.game, h, text));
        ctx.term.last = { kind: 'host', ids: list.map((h) => h.id) };
        if (!list.length) return [{ text: 'no hosts match' }];
        return list.map((h, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(h.ip, 17)}${pad(h.name, 24)}${HOST_LABEL[h.kind] ?? h.kind}${ctx.game.favorites.includes(h.id) ? '  [fav]' : ''}` }));
      },
    },
    show: {
      args: '<host>', help: tl('systems.commands.apps.map.details_of_a_host'),
      run(ctx, [w]) {
        const { game } = ctx;
        const h = hostArg(ctx, w);
        const co = h.company !== null && h.company !== undefined ? game.world.companies[h.company]?.name : 'independent';
        const keeps = recordsKept(game, h).map((f) => RECORD_LABEL[f]);
        return [
          { text: `${h.name} // ${h.ip} // ${HOST_LABEL[h.kind] ?? h.kind}`, tone: 'head' },
          { text: `OWNER    ${co}` },
          { text: `SECURITY proxy ${h.proxy} // firewall ${h.firewall} // monitor ${h.monitor} // trace ${h.trace}` },
          { text: `SERVICES ${h.services.filter((s) => s.visible !== false).map((s) => `${s.name}:${s.port}${s.open ? '' : ' (locked)'}`).join(', ') || 'none'}` },
          ...(keeps.length ? [{ text: `RECORDS  ${keeps.join(', ')}` }] : []),
        ];
      },
    },
    select: {
      args: '<host>', help: tl('systems.commands.apps.map.select_a_host_the'),
      run(ctx, [w]) {
        const h = hostArg(ctx, w);
        Object.assign((ctx.state.win.map ??= {}), { sel: h.id, follow: true, glide: true });
        openWindow(ctx.state.windows, 'map', ctx.desk);
        return [{ text: `${h.name} selected`, tone: 'ok' }];
      },
    },
    fav: simple('<host>', 'mark or unmark a favourite', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.fav.${h.id}`, done: `${h.name} ${ctx.game.favorites.includes(h.id) ? 'unmarked' : 'marked'}` }; }),
    route: {
      args: '[add|remove <host> | clear | save | load <#> | delete <#>]', help: tl('systems.commands.apps.map.show_or_change_the'),
      run(ctx, [verb, w]) {
        const { game } = ctx;
        if (!verb) {
          if (!game.player.bounce.length) return [{ text: 'the route is empty // `map route add <host>`' }];
          return game.player.bounce.map((id, i) => ({ text: `${i + 1}. ${game.world.hosts[id].name} (${game.world.hosts[id].ip})` }));
        }
        if (verb === 'add' || verb === 'remove') {
          const h = hostArg(ctx, w);
          const inRoute = game.player.bounce.includes(h.id);
          if (verb === 'add' && inRoute) fail(tl('systems.commands.apps.map.is_already_in_the', h.name));
          if (verb === 'remove' && !inRoute) fail(tl('systems.commands.apps.map.is_not_in_the', h.name));
          const out = press(ctx, `map.hop.${h.id}`, '');
          if (game.player.bounce.includes(h.id) === inRoute) return out;
          return [{ text: `${h.name} ${verb === 'add' ? 'added' : 'removed'} // ${game.player.bounce.length} of ${maxHops(game)} hops`, tone: 'ok' }];
        }
        if (verb === 'clear') return press(ctx, 'map.route.clear', 'route cleared');
        if (verb === 'save') return press(ctx, 'map.route.save', 'route saved');
        if (verb === 'load' || verb === 'delete') {
          const i = rowOf(w);
          if (!savedRoutes(game)[i]) fail(tl('systems.commands.apps.map.name_a_saved_route'));
          return press(ctx, `map.route.${verb === 'load' ? 'load' : 'del'}.${i}`, `route ${verb === 'load' ? 'loaded' : 'deleted'}`);
        }
        return fail(tl('systems.commands.apps.map.usage_map_route_add'));
      },
    },
    routes: {
      args: '', help: tl('systems.commands.apps.map.the_saved_routes'),
      run(ctx) {
        const list = savedRoutes(ctx.game);
        if (!list.length) return [{ text: 'no saved routes' }];
        return list.map((r, i) => ({ text: `#${i + 1}  ${pad(r.name, 16)}${r.hops.map((id) => ctx.game.world.hosts[id]?.name ?? '?').join(' > ')}` }));
      },
    },
    link: simple('<host>', 'connect through the current route', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.go.${h.id}`, done: `link open to ${h.name}` }; }),
  },
};
