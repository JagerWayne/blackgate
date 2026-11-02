// The command prompt's commands: `<app> <action> [what]`, plus a few general
// ones. Commands that change the game send the same event the matching
// button sends, so the costs, the checks and the messages are the button's.
// Commands that only show something read the game state.
// The apps' commands are in commands/apps/, the shared helpers in commands/helpers.js.

import { openWindow, closeWindow, findWindow } from '../state/windows.js';
import { timeScale } from '../state/cheats.js';
import { rankName } from '../core/theme.js';
import { software } from '../data/content.js';
import { saveRun } from '../state/save.js';
import { cr, pad, clock, Fail, fail } from './commands/helpers.js';
import { APPS } from './commands/apps.js';

const MAX_LINES = 500;

/// The terminal's own state, kept in the window's view.
export function makeTerm() {
  return { lines: [], history: [], at: -1, input: '', last: null };
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

const GENERAL = {
  help: {
    args: '[app]', help: "the apps, or one app's commands",
    run(ctx, [w]) {
      if (w) {
        const app = appOf(w);
        if (!app) fail(`no app "${w}" // \`apps\` lists them`);
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
    args: '', help: 'the applications and which are open',
    run: (ctx) => Object.entries(APPS).filter(([, a]) => !a.hidden).map(([k, a]) => ({ text: `  ${pad(k, 12)}${findWindow(ctx.state.windows, a.window) ? 'open' : '-'}` })),
  },
  open: {
    args: '<app>', help: "open an application's window",
    run(ctx, [w]) {
      const app = appOf(w);
      if (!app) fail(`no app "${w ?? ''}" // \`apps\` lists them`);
      openWindow(ctx.state.windows, app.window, ctx.desk);
      return [{ text: `${app.key} opened`, tone: 'ok' }];
    },
  },
  close: {
    args: '<app>', help: "close an application's window",
    run(ctx, [w]) {
      const app = appOf(w);
      if (!app) fail(`no app "${w ?? ''}" // \`apps\` lists them`);
      closeWindow(ctx.state.windows, app.window);
      return [{ text: `${app.key} closed`, tone: 'ok' }];
    },
  },
  clear: { args: '', help: 'clear the screen', run: (ctx) => { ctx.term.lines = []; ctx.cleared = true; return []; } },
  history: { args: '', help: 'the commands typed this session', run: (ctx) => ctx.term.history.map((h, i) => ({ text: `${pad(i + 1, 5)}${h}` })) },
  whoami: {
    args: '', help: 'handle, rank, money and heat',
    run(ctx) {
      const p = ctx.game.player;
      return [{ text: `${p.handle} // ${rankName(p.rating)} // rating ${p.rating} // ${cr(p.credits)} // heat ${Math.round(p.heat)}` }];
    },
  },
  time: { args: '', help: 'game time and clock speed', run: (ctx) => [{ text: `${clock(ctx.game.clock.minutes)} // ${timeScale(ctx.game)}x${ctx.game.paused ? ' // PAUSED' : ''}` }] },
  pause: { args: '', help: 'stop the clock', run: (ctx) => { ctx.game.paused = true; return [{ text: 'clock paused', tone: 'ok' }]; } },
  resume: { args: '', help: 'start the clock', run: (ctx) => { ctx.game.paused = false; return [{ text: 'clock running', tone: 'ok' }]; } },
  save: { args: '', help: 'save now', run: (ctx) => (saveRun(ctx.game) ? [{ text: 'run saved', tone: 'ok' }] : [{ text: 'save failed', tone: 'err' }]) },
  exit: { args: '', help: 'close the command prompt', run: (ctx) => { closeWindow(ctx.state.windows, 'terminal'); return []; } },
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
    else if (!app) fail(`unknown command "${first}" // type \`help\``);
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
