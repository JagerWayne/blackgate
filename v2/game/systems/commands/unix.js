// The familiar shell commands: aliases for what the game already does, and a few of their own (nmap, traceroute, cat, ps, pwd).
// Merged into the general commands by commands.js.

import { APPS } from './apps.js';
import { pad, fail, hostArg, remoteFile, Fail } from './helpers.js';
import { t as tl } from '../../data/language.js';

/// Where `ls` and `cd` stand: your own storage, or the files of the host the link is open to.
export function promptOf(game, term) {
  const s = game?.session;
  return term.cwd === 'remote' && s?.phase === 'online' ? `${game.world.hosts[s.target].name}:/` : 'local:~';
}

/// A command that runs another app's command, with some words fixed.
const via = (app, verb, help, args = '', fixed = []) => ({ args, help, run: (ctx, rest) => APPS[app].commands[verb].run(ctx, [...fixed, ...rest]) });
/// A command that picks by where you are standing: in a host, or in your storage.
const byPlace = (remote, local, help, args) => ({ args, help, run: (ctx, rest) => (ctx.term.cwd === 'remote' ? remote : local)(ctx, rest) });

const hash = (s) => { let x = 2166136261; for (const ch of s) x = Math.imul(x ^ ch.charCodeAt(0), 16777619) >>> 0; return x; };

/// The route to a host as the link would take it: the hops, the base time over the map, the TTL and a wobble worked out
/// from the seed and the clock (no random draw).
export function routeInfo(game, h) {
  const path = [...game.player.bounce.map((id) => game.world.hosts[id]).filter(Boolean), h];
  let km = 0;
  path.reduce((a, b) => { km += Math.hypot(a.x - b.x, a.y - b.y); return b; }, { x: 0.5, y: 0.5 });
  const base = 6 + km * 220 + path.length * 4;
  const wobble = (key) => Math.max(1, Math.round(base + (hash(`${game.seed}:${key}:${Math.floor(game.clock.minutes)}`) % 100) / 100 * base * 0.15));
  return { path, base, ttl: Math.max(64 - path.length * 2, 1), wobble };
}

const known = (ctx, w) => { try { return hostArg(ctx, w, true); } catch (err) { if (!(err instanceof Fail)) throw err; return null; } };

export const UNIX = {
  ssh: via('blackgate', 'connect', 'open a link to a host', '<host>'),
  hydra: via('blackgate', 'crack', 'break a password on the linked host', '[service #]'),
  ddos: via('blackgate', 'bypass', 'drop the firewall and the proxy together, loudly', '', ['ddos']),
  hashcat: via('blackgate', 'decrypt', 'decrypt a file on the linked host', '<file>'),
  getsystem: via('blackgate', 'root', 'escalate to root on the linked host'),
  su: via('blackgate', 'root', 'escalate to root on the linked host'),
  shred: via('blackgate', 'logs', 'delete all logs on the linked host', '', ['wipe']),
  clearev: via('blackgate', 'logs', "quietly remove only your own log lines", '', ['scrub']),
  theharvester: via('blackgate', 'osint', 'run an OSINT sweep'),
  netstat: via('blackgate', 'status', 'the link and its tasks'),
  df: via('storage', 'space', 'used and free space'),
  rm: byPlace((ctx, r) => APPS.blackgate.commands.delete.run(ctx, r), (ctx, r) => APPS.storage.commands.delete.run(ctx, r), 'delete a file (on the host, or in your storage)', '<file|#>'),
  cp: byPlace((ctx, r) => APPS.blackgate.commands.copy.run(ctx, r), () => fail(tl('systems.commands.unix.nothing_to_copy_here')), 'copy a file from the linked host to your storage', '<file|#>'),
  pwd: { args: '', help: tl('systems.commands.unix.where_you_are'), run: (ctx) => [{ text: promptOf(ctx.game, ctx.term) }] },
  cat: {
    args: '<file|#>', help: tl('systems.commands.unix.show_the_text_of'),
    run(ctx, [w]) {
      if (ctx.term.cwd !== 'remote') fail(tl('systems.commands.unix.your_storage_keeps_copies'));
      const f = ctx.game.world.hosts[ctx.game.session.target].files[remoteFile(ctx, w)];
      if (f.enc > 0) fail(tl('systems.commands.unix.is_encrypted_decrypt_it', f.name));
      if (!f.content) fail(tl('systems.commands.unix.has_no_readable_text', f.name));
      return String(f.content).split('\n').map((text) => ({ text }));
    },
  },
  ps: {
    args: '', help: tl('systems.commands.unix.the_tasks_running_on'),
    run(ctx) {
      const s = ctx.game.session;
      if (!s || !s.tasks.length) return [{ text: 'no processes' }];
      return [{ text: `${pad('PID', 6)}${pad('TASK', 34)}DONE`, tone: 'head' }, ...s.tasks.map((t, n) => ({ text: `${pad(n + 1, 6)}${pad(t.label, 34)}${Math.round(Math.min(t.progress, 1) * 100)}%` }))];
    },
  },
  nmap: {
    args: '<host or ip>', help: tl('systems.commands.unix.list_the_services_a'),
    run(ctx, [w]) {
      if (!w) fail(tl('systems.commands.unix.usage_nmap_hostname_or'));
      const h = known(ctx, w);
      if (!h) fail(tl('systems.commands.unix.failed_to_resolve', w));
      const open = h.services.filter((s) => s.visible !== false);
      return [
        { text: `Nmap scan report for ${h.name} (${h.ip})`, tone: 'head' },
        { text: `${pad('PORT', 10)}${pad('STATE', 10)}SERVICE` },
        ...open.map((s) => ({ text: `${pad(`${s.port}/tcp`, 10)}${pad(s.open ? 'open' : 'closed', 10)}${s.name}${s.open ? '' : ' (login required)'}` })),
        { text: `${open.length} service${open.length === 1 ? '' : 's'} shown`, tone: 'info' },
      ];
    },
  },
  traceroute: {
    args: '<host or ip>', help: tl('systems.commands.unix.the_hops_of_your'),
    run(ctx, [w]) {
      if (!w) fail(tl('systems.commands.unix.usage_traceroute_hostname_or'));
      const h = known(ctx, w);
      if (!h) fail(tl('systems.commands.unix.traceroute_unknown_host', w));
      const { path, base } = routeInfo(ctx.game, h);
      return [
        { text: `traceroute to ${h.name} (${h.ip}), ${path.length} hops max`, tone: 'head' },
        ...path.map((p, n) => ({ text: `${pad(n + 1, 4)}${pad(p.name, 26)}${pad(p.ip, 16)}${Math.max(1, Math.round((base * (n + 1)) / path.length))} ms` })),
      ];
    },
  },
};
