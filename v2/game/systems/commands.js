// The command prompt's commands: `<app> <action> [what]`, plus a few general
// ones. Commands that change the game send the same event the matching
// button sends, so the costs, the checks and the messages are the button's.
// Commands that only show something read the game state.
// The apps' commands are in commands/apps/, the shared helpers in commands/helpers.js.

import { openWindow, closeWindow, findWindow } from '../state/windows.js';
import { timeScale } from '../state/cheats.js';
import { rankName } from '../core/theme.js';
import { software } from '../data/content.js';
import { discover } from '../state/gameState.js';
import { outsideHost } from '../state/intel.js';
import { saveRun } from '../state/save.js';
import { cr, pad, clock, Fail, fail, hostArg } from './commands/helpers.js';
import { APPS } from './commands/apps.js';
import { UNIX, promptOf, routeInfo } from './commands/unix.js';
import { t as tl } from '../data/language.js';
export { promptOf };

const MAX_LINES = 500;

/// The terminal's own state, kept in the window's view.
export function makeTerm() {
  return { lines: [], history: [], at: -1, input: '', last: null, cwd: 'local' };
}

/// Splits a line into words; "quoted text" stays one word.
export function words(line) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2]);
  return out;
}


/// The app a word names, by name or alias.
function appOf(word) {
  const w = (word ?? '').toLowerCase();
  const key = Object.keys(APPS).find((k) => k === w || APPS[k].alias.includes(w));
  return key ? { key, ...APPS[key] } : null;
}

// -- the general commands -----------------------------------------------------

const listFiles = (ctx) => {
  const { game, term } = ctx;
  if (term.cwd === 'remote') {
    const s = game.session;
    if (!s || s.phase !== 'online') { term.cwd = 'local'; fail(tl('systems.commands.the_link_is_gone')); }
    const h = game.world.hosts[s.target];
    const list = h.files.map((f, i) => ({ f, i })).filter(({ f }) => !f.deleted);
    term.last = { kind: 'rfile', host: h.id, ids: list.map(({ i }) => i) };
    return list.length ? list.map(({ f }, n) => ({ text: `${pad(`#${n + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? `encrypted v${f.enc}` : ''}` })) : [{ text: '(empty)' }];
  }
  const files = game.player.storage;
  return files.length ? files.map((f, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? 'encrypted' : ''}` })) : [{ text: '(empty)' }];
};
const clearScreen = { args: '', help: tl('systems.commands.clear_the_screen'), run: (ctx) => { ctx.term.lines = []; ctx.cleared = true; return []; } };
const listCmd = { args: '', help: tl('systems.commands.list_the_files_here'), run: listFiles };

const GENERAL = {
  ...UNIX,
  ls: listCmd,
  dir: listCmd,
  cd: {
    args: '[local|<host>]', help: tl('systems.commands.change_where_ls_looks'),
    run(ctx, [w]) {
      const { game, term } = ctx;
      if (!w || w === '~' || w === '..' || w === '/' || w.toLowerCase() === 'local' || /^c:\?$/i.test(w)) { term.cwd = 'local'; return [{ text: 'local:~', tone: 'ok' }]; }
      const s = game.session;
      const h = s ? game.world.hosts[s.target] : null;
      const word = w.toLowerCase().replace(/[\/]$/, '');
      if (!h || ![h.name.toLowerCase(), h.ip, h.domain?.toLowerCase()].includes(word)) fail(tl('systems.commands.no_such_place_you', w));
      if (s.phase !== 'online') fail(tl('systems.commands.the_link_is_still'));
      term.cwd = 'remote';
      return [{ text: `${h.name}:/`, tone: 'ok' }];
    },
  },
  cls: clearScreen,
  help: {
    args: '[app]', help: tl('systems.commands.the_apps_or_one'),
    run(ctx, [w]) {
      if (w) {
        const app = appOf(w);
        if (!app) fail(tl('systems.commands.no_app_apps_lists', w));
        const name = app.alias[0] ?? app.key;
        return [
          { text: `${app.key}${app.alias.length ? ` (${app.alias.join(', ')})` : ''} // ${app.about}`, tone: 'head' },
          ...Object.entries(app.commands).map(([verb, c]) => ({ text: `  ${pad(`${name} ${verb} ${c.args}`, 46)}${c.help}` })),
        ];
      }
      return [
        { text: 'BLACKGATE command prompt // <app> <action> [what]', tone: 'head' },
        ...Object.entries(GENERAL).map(([name, c]) => ({ text: `  ${pad(`${name} ${c.args}`, 22)}${c.help}` })),
        { text: 'apps // `help <app>` lists its commands:', tone: 'head' },
        ...Object.entries(APPS).filter(([, a]) => !a.hidden).map(([k, a]) => ({ text: `  ${pad(`${k}${a.alias.length ? ` (${a.alias.join(', ')})` : ''}`, 22)}${a.about}` })),
        { text: '#n picks a row of the last list // "quotes" keep words together // Tab completes // Up/Down recall', tone: 'info' },
      ];
    },
  },
  apps: {
    args: '', help: tl('systems.commands.the_applications_and_which'),
    run: (ctx) => Object.entries(APPS).filter(([, a]) => !a.hidden).map(([k, a]) => ({ text: `  ${pad(k, 12)}${findWindow(ctx.state.windows, a.window) ? 'open' : '-'}` })),
  },
  open: {
    args: '<app>', help: tl('systems.commands.open_an_application_s'),
    run(ctx, [w]) {
      const app = appOf(w);
      if (!app) fail(tl('systems.commands.no_app_apps_lists', w ?? ''));
      openWindow(ctx.state.windows, app.window, ctx.desk);
      return [{ text: `${app.key} opened`, tone: 'ok' }];
    },
  },
  close: {
    args: '<app>', help: tl('systems.commands.close_an_application_s'),
    run(ctx, [w]) {
      const app = appOf(w);
      if (!app) fail(tl('systems.commands.no_app_apps_lists', w ?? ''));
      closeWindow(ctx.state.windows, app.window);
      return [{ text: `${app.key} closed`, tone: 'ok' }];
    },
  },
  ping: {
    args: '<host or ip>', help: tl('systems.commands.test_whether_a_host'),
    run(ctx, [w]) {
      const { game } = ctx;
      if (!w) fail(tl('systems.commands.usage_ping_hostname_or'));
      let h = null;
      try { h = hostArg(ctx, w, true); } catch (err) { if (!(err instanceof Fail)) throw err; }
      h ??= outsideHost(game, w); // a name or domain of any outside host answers, found or not
      // an IP you do not know of, and a name nobody runs, get no answer
      // `wait` is real milliseconds before the line shows (see print): a probe goes out every second, a lost one waits longer
      if (!h) return [{ text: `Pinging ${w} with 32 bytes of data:`, tone: 'head' }, ...[0, 1, 2, 3].map((k) => ({ text: 'Request timed out.', tone: 'err', wait: (k + 1) * 1500 })), { text: 'Ping statistics: Sent = 4, Received = 0, Lost = 4 (100% loss)', tone: 'err', wait: 6200 }];
      const { ttl, wobble } = routeInfo(game, h);
      const ms = [0, 1, 2, 3].map((n) => wobble(`${h.ip}:${n}`));
      const fresh = !h.discovered;
      discover(game, h.id); // an answer puts the host on the map
      return [
        { text: `Pinging ${h.name} [${h.ip}] with 32 bytes of data:`, tone: 'head' },
        ...ms.map((t, k) => ({ text: `Reply from ${h.ip}: bytes=32 time=${t}ms TTL=${ttl}`, tone: 'ok', wait: k * 1000 + t })),
        { text: `Ping statistics for ${h.ip}: Sent = 4, Received = 4, Lost = 0 (0% loss)`, wait: 3000 + ms[3] + 100 },
        { text: `Round trip: min = ${Math.min(...ms)}ms, max = ${Math.max(...ms)}ms, avg = ${Math.round(ms.reduce((a, b) => a + b) / 4)}ms`, wait: 3000 + ms[3] + 100 },
        ...(fresh ? [{ text: `${h.name} added to the map`, tone: 'info', wait: 3000 + ms[3] + 100 }] : []),
      ];
    },
  },
  clear: clearScreen,
  history: { args: '', help: tl('systems.commands.the_commands_typed_this'), run: (ctx) => ctx.term.history.map((h, i) => ({ text: `${pad(i + 1, 5)}${h}` })) },
  whoami: {
    args: '', help: tl('systems.commands.handle_rank_money_and'),
    run(ctx) {
      const p = ctx.game.player;
      return [{ text: `${p.handle} // ${rankName(p.rating)} // rating ${p.rating} // ${cr(p.credits)} // heat ${Math.round(p.heat)}` }];
    },
  },
  time: { args: '', help: tl('systems.commands.game_time_and_clock'), run: (ctx) => [{ text: `${clock(ctx.game.clock.minutes)} // ${timeScale(ctx.game)}x${ctx.game.paused ? ' // PAUSED' : ''}` }] },
  pause: { args: '', help: tl('systems.commands.stop_the_clock'), run: (ctx) => { ctx.game.paused = true; return [{ text: 'clock paused', tone: 'ok' }]; } },
  resume: { args: '', help: tl('systems.commands.start_the_clock'), run: (ctx) => { ctx.game.paused = false; return [{ text: 'clock running', tone: 'ok' }]; } },
  save: { args: '', help: tl('systems.commands.save_now'), run: (ctx) => (saveRun(ctx.game) ? [{ text: 'run saved', tone: 'ok' }] : [{ text: 'save failed', tone: 'err' }]) },
  exit: { args: '', help: tl('systems.commands.close_the_command_prompt'), run: (ctx) => { closeWindow(ctx.state.windows, 'terminal'); return []; } },
};

/// Runs one typed line and prints it and its answer to the scrollback.
export function run(state, term, line, desk) {
  const text = line.trim();
  if (!text) return;
  term.history.push(text);
  if (term.history.length > 100) term.history.shift();
  const echo = { text: `> ${text}`, tone: 'echo' };
  const [first, second, ...rest] = words(text);
  const ctx = { state, game: state.game, term, desk };
  let out;
  try {
    const general = GENERAL[first.toLowerCase()];
    const app = general ? null : appOf(first);
    if (general) out = general.run(ctx, [second, ...rest].filter((w) => w !== undefined));
    else if (!app) fail(tl('systems.commands.unknown_command_type_help', first));
    else {
      // an app with one action runs it bare (`operator`); otherwise a bare
      // app name, or an unknown action, lists its commands
      const verbs = Object.keys(app.commands);
      const verb = (second ?? (verbs.length === 1 ? verbs[0] : '')).toLowerCase();
      const cmd = app.commands[verb];
      if (cmd) out = cmd.run(ctx, rest);
      else out = [...(verb ? [{ text: `${app.key} has no "${verb}"`, tone: 'err' }] : []), ...GENERAL.help.run(ctx, [app.key])];
    }
  } catch (err) {
    if (!(err instanceof Fail)) throw err;
    out = [{ text: err.message, tone: 'err' }];
  }
  print(term, ctx.cleared ? out : [echo, ...out]);
}

/// Adds lines to the scrollback, keeping the newest MAX_LINES.
export function print(term, lines) {
  // a line with `wait` shows that many real milliseconds from now: the Command Prompt hides it until then
  const now = Date.now();
  lines = lines.map((l) => (l.wait ? { ...l, at: now + l.wait } : l));
  term.lines.push(...lines);
  if (term.lines.length > MAX_LINES) term.lines.splice(0, term.lines.length - MAX_LINES);
}

/// Completes the last word of a line: commands, then actions, then the
/// files, hosts, contracts or tools the action takes. Returns the new line and,
/// when several things match, the matches.
export function complete(state, line) {
  const parts = words(line);
  const fresh = line === '' || /\s$/.test(line);
  const done = fresh ? parts : parts.slice(0, -1);
  const stem = fresh ? '' : (parts.at(-1) ?? '');
  const game = state.game;
  let options = [];
  if (done.length === 0) options = [...Object.keys(GENERAL), ...Object.keys(APPS).filter((k) => !APPS[k].hidden)];
  else if (done.length === 1 && ['help', 'open', 'close'].includes(done[0])) options = Object.keys(APPS);
  else if (done.length === 1 && done[0] === 'cd') options = game?.session ? [game.world.hosts[game.session.target].name, 'local'] : ['local'];
  else if (done.length === 1 && done[0] === 'ping') options = game?.world.hosts.filter((x) => x.discovered).flatMap((x) => [x.name, x.ip]) ?? [];
  else if (done.length === 1) options = Object.keys(appOf(done[0])?.commands ?? {});
  else {
    const s = game?.session;
    const h = s ? game.world.hosts[s.target] : null;
    const app = appOf(done[0])?.key;
    const verb = done[1];
    if (app === 'blackgate' && ['copy', 'delete', 'decrypt'].includes(verb)) options = h ? h.files.filter((f) => !f.deleted).map((f) => f.name) : [];
    else if (app === 'blackgate' && verb === 'bypass') options = ['firewall', 'monitor', 'proxy'];
    else if (app === 'contracts') options = game.contracts.map((c) => String(c.id));
    else if (app === 'map' || app === 'blackgate') options = game.world.hosts.filter((x) => x.discovered).map((x) => x.ip);
    else if (app === 'software') options = software().map((t) => t.kind);
    else if (app === 'storage') options = game.player.storage.map((f) => f.name);
  }
  const hits = options.filter((o) => o.toLowerCase().startsWith(stem.toLowerCase()));
  if (!hits.length) return { line, hits: [] };
  // the longest start every match shares
  let common = hits[0];
  hits.forEach((x) => { while (!x.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1); });
  const quote = (w) => (/\s/.test(w) ? `"${w}"` : w);
  const head = done.map(quote).join(' ');
  const word = hits.length === 1 ? `${quote(hits[0])} ` : common;
  return { line: `${head ? `${head} ` : ''}${word}`, hits: hits.length > 1 ? hits : [] };
}

/// Every app's action names, for the tests and the README.
export function commandNames() {
  return Object.fromEntries(Object.entries(APPS).map(([k, a]) => [k, Object.keys(a.commands)]));
}

/// The general command names.
export const GENERAL_NAMES = Object.keys(GENERAL);
