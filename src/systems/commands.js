import { routeLines } from '../state/session.js';
import { padsOf, newPad, openPad, deletePad, MAX_PADS } from '../state/notes.js';
// The command prompt's commands: `<app> <action> [what]`, plus a few general
// ones. Commands that change the game send the same event the matching
// button sends, so the costs, the checks and the messages are the button's.
// Commands that only show something read the game state.

import { handleEvents, isDestructive } from './events.js';
import { startTask, LINK_DOWN } from './sessionTasks.js';
import { dossiers, intelText, INTEL_FIELDS } from '../state/intel.js';
import { askFee, takeOffer, haggleOf, haggleOdds } from '../state/haggle.js';
import { openWindow, closeWindow, findWindow } from '../state/windows.js';
import { contractLabel } from '../state/contracts.js';
import { savedRoutes, MAX_HOPS } from '../state/routes.js';
import { passesKind, passesQuery, MAP_FILTERS } from '../state/mapQuery.js';
import { recordsKept, RECORD_LABEL, WORK_FIELDS, parseRecord, validRecord, recordText } from '../state/records.js';
import { timeScale, SPEEDS } from '../state/cheats.js';
import { rankName } from '../core/theme.js';
import { HOST_LABEL } from '../data/enums.js';
import { software, componentsOf, chassis } from '../data/content.js';
import { toolPrice } from '../state/economy.js';
import { saveRun } from '../state/save.js';

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

// -- small helpers ------------------------------------------------------------

const cr = (n) => `${Math.round(n).toLocaleString('en-US')} cr`;
const pad = (s, n) => String(s).padEnd(n);
const clock = (minute) => {
  const d = Math.floor(minute / 1440) + 1;
  const h = String(Math.floor((minute % 1440) / 60)).padStart(2, '0');
  const m = String(Math.floor(minute % 60)).padStart(2, '0');
  return `day ${d} ${h}:${m}`;
};
class Fail extends Error {}
/// Stops the command with a message.
const fail = (text) => { throw new Fail(text); };
/// `#3` or `3` as a 0-based index, or -1.
const rowOf = (word) => (/^#?\d+$/.test(word ?? '') ? Number(String(word).replace('#', '')) - 1 : -1);

/// Sends a button's event and returns what the game said about it: the
/// toasts it raised, or `done` when it raised none.
function press(ctx, id, done) {
  const { state } = ctx;
  const before = state.game.toasts.length;
  handleEvents(state, [{ type: 'click', id }], ctx.desk);
  if (!state.game) return [{ text: done, tone: 'ok' }];
  const said = state.game.toasts.slice(before);
  if (!said.length) return [{ text: done, tone: 'ok' }];
  return said.map((t) => ({ text: t.text, tone: t.kind === 'bad' ? 'err' : t.kind === 'good' ? 'ok' : 'info' }));
}

/// The id a `#n` word picks from the last list of a kind, or null.
function pick(ctx, word, kind) {
  const i = rowOf(word);
  const last = ctx.term.last;
  if (i < 0 || !last || last.kind !== kind) return null;
  return last.ids[i] ?? null;
}

/// A found host by `#n` (from the last host list), IP, name or domain.
function hostArg(ctx, word) {
  if (!word) fail('name a host: an IP, a name, or #n from `map hosts`');
  const { game } = ctx;
  const byPick = pick(ctx, word, 'host');
  const w = word.toLowerCase();
  const h = byPick !== null ? game.world.hosts[byPick]
    : game.world.hosts.find((x) => x.discovered && (x.ip === word || x.name.toLowerCase() === w || x.domain?.toLowerCase() === w));
  if (!h || !h.discovered) fail(`no host you know of matches "${word}"`);
  return h;
}

/// A contract by its id or `#n` from the last contract list.
function contractArg(ctx, word) {
  if (!word) fail('name a contract: its id, or #n from `ct list`');
  const id = (word.startsWith('#') ? pick(ctx, word, 'contract') : null) ?? Number(String(word).replace(/^C-?/i, ''));
  const c = ctx.game.contracts.find((x) => x.id === id);
  if (!c) fail(`no contract ${word}`);
  return c;
}

/// The mail, newest first, as the MAIL window lists it.
const mailbox = (game) => game.mail.slice().sort((a, b) => b.minute - a.minute);

/// A message by `#n` from the last mail list (or the mailbox), or `new`.
function mailArg(ctx, word) {
  if (!word) fail('name a message: #n from `mail list`, or `new`');
  const box = mailbox(ctx.game);
  if (word === 'new') {
    const unread = box.filter((m) => !m.read);
    if (!unread.length) fail('no unread mail');
    return unread[unread.length - 1];
  }
  const id = pick(ctx, word, 'mail');
  const m = (id !== null ? ctx.game.mail.find((x) => x.id === id) : null) ?? box[rowOf(word)];
  if (!m) fail(`no message ${word}`);
  return m;
}

/// The live link, or a failure saying there is none. With `up`, the link must
/// have finished connecting: until then the host shows nothing.
function link(ctx, up = true) {
  const s = ctx.game.session;
  if (!s) fail('not connected // `bg connect <host>` first');
  if (up && s.phase !== 'online') fail(LINK_DOWN);
  return { s, h: ctx.game.world.hosts[s.target] };
}

/// A file on the connected host, by name or `#n` from `bg files`.
function remoteFile(ctx, word) {
  const { h } = link(ctx);
  if (!word) fail('name a file: its name, or #n from `bg files`');
  const byPick = pick(ctx, word, 'rfile');
  const i = byPick !== null ? byPick : h.files.findIndex((f) => !f.deleted && f.name.toLowerCase() === word.toLowerCase());
  if (i < 0 || !h.files[i] || h.files[i].deleted) fail(`no file "${word}" on ${h.name}`);
  return i;
}

/// Runs a task on the live link, as the button would.
function task(ctx, kind, arg, label) {
  link(ctx);
  const err = startTask(ctx.game, kind, arg);
  if (err) fail(err);
  return [{ text: `started: ${label}`, tone: 'ok' }];
}

/// A voice lock on the host: the one named, or the first still locked.
function voiceLock(ctx, word) {
  const { h } = link(ctx);
  const i = word ? rowOf(word) : h.services.findIndex((s) => s.kind === 'voice' && !s.open);
  if (i < 0 || h.services[i]?.kind !== 'voice') fail(word ? `service ${word} is not a voice lock` : 'no locked voice service here');
  return i;
}

/// A person by name (or #n from `bg records`).
function personArg(ctx, word) {
  if (!word) fail('name a person');
  const byPick = pick(ctx, word, 'person');
  if (byPick !== null) return byPick;
  const w = word.toLowerCase();
  const i = ctx.game.world.people.findIndex((p) => p.name.toLowerCase() === w);
  if (i < 0) fail(`no one called "${word}"`);
  return i;
}

/// A record field by its key or label: `status`, `ssn`, `"vital status"`.
function fieldArg(word) {
  const w = (word ?? '').toLowerCase().replace(/[\s_-]/g, '');
  const key = Object.keys(RECORD_LABEL).find((k) => k.toLowerCase() === w || RECORD_LABEL[k].toLowerCase().replace(/\s/g, '') === w);
  if (!key) fail(`fields: ${Object.keys(RECORD_LABEL).join(', ')}`);
  return key;
}

/// A tool by its kind or name, loosely: `PasswordCracker`, `"password breaker"`, `breaker`.
function toolArg(word) {
  if (!word) fail('name a tool: see `sw shop`');
  const w = word.toLowerCase().replace(/[\s_-]/g, '');
  const flat = (t) => t.name.toLowerCase().replace(/\s/g, '');
  const t = software().find((x) => x.kind.toLowerCase() === w || flat(x) === w) ?? software().find((x) => flat(x).includes(w));
  if (!t) fail(`no tool "${word}"`);
  return t;
}

const toolLevel = (game, kind) => game.player.tools.find((t) => t.kind === kind)?.level ?? 0;
const onOff = (word, what) => {
  if (word === 'on') return true;
  if (word === 'off') return false;
  return fail(`usage: ${what} on|off`);
};

/// A GATEWAY button that may take a part out: without --yes it only says so,
/// the way the window arms the button on its first click.
function gwPress(ctx, id, yes, done) {
  const destructive = isDestructive(ctx.game, id);
  if (destructive && yes !== '--yes') fail('this takes a part out of the machine: add --yes to go ahead');
  // the window's two clicks: the first arms the button, the second does it
  if (destructive) handleEvents(ctx.state, [{ type: 'click', id }], ctx.desk);
  return press(ctx, id, done);
}

/// A shortcut for actions that just press one button with an argument.
const simple = (args, help, idOf, done) => ({ args, help, run: (ctx, w) => { const x = idOf(ctx, w); return press(ctx, x.id, x.done ?? done); } });

// -- the applications ---------------------------------------------------------

/// Every app's commands. `args` is the usage shown in help.
const APPS = {
  mail: {
    alias: [],
    window: 'mail',
    about: 'read and answer your messages',
    commands: {
      list: {
        args: '[new|all]', help: 'the messages, newest first (* = unread)',
        run(ctx, [which]) {
          const box = mailbox(ctx.game).filter((m) => which !== 'new' || !m.read);
          ctx.term.last = { kind: 'mail', ids: box.map((m) => m.id) };
          if (!box.length) return [{ text: which === 'new' ? 'no unread mail' : 'the mailbox is empty' }];
          return box.map((m, i) => ({ text: `${pad(`#${i + 1}`, 5)}${m.read ? ' ' : '*'} ${pad(clock(m.minute), 14)}${pad(m.from.replace(/\s*<.*>/, ''), 24)}${m.subject}` }));
        },
      },
      read: {
        args: '<#|new>', help: 'show a message and mark it read; `new` reads the oldest unread one',
        run(ctx, [word]) {
          const m = mailArg(ctx, word);
          m.read = true;
          ctx.term.last = { kind: 'mail', ids: [m.id] };
          return [
            { text: `FROM     ${m.from}`, tone: 'head' },
            { text: `SUBJECT  ${m.subject}`, tone: 'head' },
            { text: `SENT     ${clock(m.minute)}`, tone: 'head' },
            ...String(m.body ?? '').split('\n').map((text) => ({ text })),
            ...(m.contract ? [{ text: `job ${m.contract}: \`mail accept #1\`, \`mail decline #1\` or \`mail target #1\``, tone: 'info' }] : []),
          ];
        },
      },
      readall: { args: '', help: 'mark every message read', run: (ctx) => press(ctx, 'mail.readAll', 'all mail marked read') },
      accept: simple('<#>', 'accept the job a message offers', (ctx, [w]) => { const m = mailArg(ctx, w); if (!m.contract) fail('that message offers no job'); return { id: `mail.accept.${m.contract}`, done: `contract ${m.contract} accepted` }; }),
      decline: simple('<#>', 'turn down the job a message offers', (ctx, [w]) => { const m = mailArg(ctx, w); if (!m.contract) fail('that message offers no job'); return { id: `mail.decline.${m.contract}`, done: `contract ${m.contract} declined` }; }),
      target: simple('<#>', "show the offered job's target on the map", (ctx, [w]) => { const m = mailArg(ctx, w); if (!m.contract) fail('that message offers no job'); return { id: `mail.track.${m.contract}` }; }, 'target shown on the NEXUS MAP'),
    },
  },

  contracts: {
    alias: ['ct'],
    window: 'dsn',
    about: 'your jobs and the offers (the same as DeepSpaceN3T)',
    commands: {
      list: {
        args: '[offered|accepted|ready|done|all]', help: 'the jobs with id, kind, payout and deadline',
        run(ctx, [which = 'all']) {
          const list = ctx.game.contracts.filter((c) => which === 'all' || c.state === which || (which === 'done' && c.state === 'paid'));
          ctx.term.last = { kind: 'contract', ids: list.map((c) => c.id) };
          if (!list.length) return [{ text: 'no jobs' }];
          return list.map((c, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(c.id, 6)}${pad(c.state.toUpperCase(), 10)}${pad(contractLabel(c), 30)} ${pad(cr(c.reward), 12)} due ${clock(c.deadline)}` }));
        },
      },
      show: {
        args: '<id>', help: 'the full brief and objective',
        run(ctx, [word]) {
          const c = contractArg(ctx, word);
          const h = ctx.game.world.hosts[c.target];
          return [
            { text: `CONTRACT ${c.id} // ${contractLabel(c)} // ${c.state.toUpperCase()}`, tone: 'head' },
            { text: `CLIENT   ${c.client}` },
            { text: `TARGET   ${h?.discovered ? `${h.name} (${h.ip})` : 'not on your map yet // `ct target` reveals it'}` },
            ...(c.file ? [{ text: `FILE     ${c.file}` }] : []),
            { text: `FEE      ${cr(c.reward)}` },
            { text: `DUE      ${clock(c.deadline)}` },
            ...String(c.brief ?? '').split('\n').map((text) => ({ text })),
          ];
        },
      },
      accept: simple('<id>', 'take an offered job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.accept.${c.id}`, done: `contract ${c.id} accepted` }; }),
      decline: simple('<id>', 'turn down an offered job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.decline.${c.id}`, done: `contract ${c.id} declined` }; }),
      drop: simple('<id>', 'abandon an accepted job', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.drop.${c.id}`, done: `contract ${c.id} dropped` }; }),
      target: simple('<id>', 'reveal and select the target on the map', (ctx, [w]) => ({ id: `ct.track.${contractArg(ctx, w).id}` }), 'target shown on the NEXUS MAP'),
      link: simple('<id>', 'connect to the target through your route', (ctx, [w]) => { const c = contractArg(ctx, w); return { id: `ct.link.${c.id}`, done: 'link open' }; }),
      submit: {
        args: '<id>', help: 'hand in finished work and get paid',
        run(ctx, [w]) {
          const c = contractArg(ctx, w);
          if (c.state !== 'ready') fail(`contract ${c.id} is ${c.state}: finish the objective first`);
          return press(ctx, `ct.submit.${c.id}`, `contract ${c.id} submitted`);
        },
      },
    },
  },

  map: {
    alias: [],
    window: 'map',
    about: 'the hosts you know, routes and links',
    commands: {
      hosts: {
        args: '[kind] [text]', help: `found hosts; kinds: ${MAP_FILTERS.map(([k]) => k).join(', ')}`,
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
        args: '<host>', help: 'details of a host',
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
        args: '<host>', help: 'select a host; the map glides to it',
        run(ctx, [w]) {
          const h = hostArg(ctx, w);
          Object.assign((ctx.state.win.map ??= {}), { sel: h.id, follow: true, glide: true });
          openWindow(ctx.state.windows, 'map', ctx.desk);
          return [{ text: `${h.name} selected`, tone: 'ok' }];
        },
      },
      fav: simple('<host>', 'mark or unmark a favourite', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.fav.${h.id}`, done: `${h.name} ${ctx.game.favorites.includes(h.id) ? 'unmarked' : 'marked'}` }; }),
      route: {
        args: '[add|remove <host> | clear | save | load <#> | delete <#>]', help: 'show or change the bounce route',
        run(ctx, [verb, w]) {
          const { game } = ctx;
          if (!verb) {
            if (!game.player.bounce.length) return [{ text: 'the route is empty // `map route add <host>`' }];
            return game.player.bounce.map((id, i) => ({ text: `${i + 1}. ${game.world.hosts[id].name} (${game.world.hosts[id].ip})` }));
          }
          if (verb === 'add' || verb === 'remove') {
            const h = hostArg(ctx, w);
            const inRoute = game.player.bounce.includes(h.id);
            if (verb === 'add' && inRoute) fail(`${h.name} is already in the route`);
            if (verb === 'remove' && !inRoute) fail(`${h.name} is not in the route`);
            const out = press(ctx, `map.hop.${h.id}`, '');
            if (game.player.bounce.includes(h.id) === inRoute) return out;
            return [{ text: `${h.name} ${verb === 'add' ? 'added' : 'removed'} // ${game.player.bounce.length} of ${MAX_HOPS} hops`, tone: 'ok' }];
          }
          if (verb === 'clear') return press(ctx, 'map.route.clear', 'route cleared');
          if (verb === 'save') return press(ctx, 'map.route.save', 'route saved');
          if (verb === 'load' || verb === 'delete') {
            const i = rowOf(w);
            if (!savedRoutes(game)[i]) fail('name a saved route: #n from `map routes`');
            return press(ctx, `map.route.${verb === 'load' ? 'load' : 'del'}.${i}`, `route ${verb === 'load' ? 'loaded' : 'deleted'}`);
          }
          return fail('usage: map route [add|remove <host> | clear | save | load <#> | delete <#>]');
        },
      },
      routes: {
        args: '', help: 'the saved routes',
        run(ctx) {
          const list = savedRoutes(ctx.game);
          if (!list.length) return [{ text: 'no saved routes' }];
          return list.map((r, i) => ({ text: `#${i + 1}  ${pad(r.name, 16)}${r.hops.map((id) => ctx.game.world.hosts[id]?.name ?? '?').join(' > ')}` }));
        },
      },
      link: simple('<host>', 'connect through the current route', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.go.${h.id}`, done: `link open to ${h.name}` }; }),
    },
  },

  blackgate: {
    alias: ['bg'],
    window: 'blackgate',
    about: 'the hacking client: the live link and its tasks',
    commands: {
      connect: simple('<host>', 'open a link through your route', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.go.${h.id}`, done: `link open to ${h.name}` }; }),
      disconnect: { args: '', help: 'close the link', run: (ctx) => { link(ctx, false); return press(ctx, 'sess.disconnect', 'disconnected'); } },
      status: {
        args: '', help: 'heat, the trace and the running tasks',
        run(ctx) {
          const { game } = ctx;
          const out = [{ text: `HEAT ${Math.round(game.player.heat)} / 100`, tone: 'head' }];
          const s = game.session;
          if (!s) return [...out, { text: 'not connected' }];
          const h = game.world.hosts[s.target];
          if (s.phase !== 'online') return [...out, { text: `LINK ${h.name} // negotiating ${Math.round((s.connectT / s.connectDur) * 100)}%` }, ...routeLines(game, s).map((l) => ({ text: `  ${l.text}`, tone: l.done ? 'ok' : undefined }))];
          out.push({ text: `LINK ${h.name} (${h.ip}) // trace ${Math.round(s.trace * 100)}%`, tone: s.trace > 0.7 ? 'err' : 'head' });
          if (!s.tasks.length) out.push({ text: 'no tasks running' });
          s.tasks.forEach((t) => out.push({ text: `  ${pad(t.label, 32)}${Math.round(Math.min(t.progress, 1) * 100)}%` }));
          return out;
        },
      },
      services: {
        args: '', help: "the host's services",
        run(ctx) {
          const { h } = link(ctx);
          return h.services.map((s, i) => ({ s, i })).filter(({ s }) => s.visible !== false)
            .map(({ s, i }) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(`${s.name}:${s.port}`, 18)}${s.open ? 'open' : `locked (lock v${s.password})`}` }));
        },
      },
      files: {
        args: '', help: "the host's files",
        run(ctx) {
          const { h } = link(ctx);
          const list = h.files.map((f, i) => ({ f, i })).filter(({ f }) => !f.deleted);
          ctx.term.last = { kind: 'rfile', ids: list.map(({ i }) => i) };
          if (!list.length) return [{ text: 'no files' }];
          return list.map(({ f }, n) => ({ text: `${pad(`#${n + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? `encrypted v${f.enc}` : ''}` }));
        },
      },
      logs: {
        args: '[wipe|scrub]', help: 'show the logs; `wipe` deletes them all, `scrub` quietly removes only yours',
        run(ctx, [verb]) {
          const { h } = link(ctx);
          if (verb === 'wipe') return task(ctx, 'WipeLogs', undefined, 'wipe logs');
          if (verb === 'scrub') return task(ctx, 'ModifyLogs', undefined, 'scrub own logs');
          if (verb) fail('usage: bg logs [wipe|scrub]');
          if (!h.logs.length) return [{ text: 'no logs' }];
          return h.logs.map((l) => ({ text: typeof l === 'string' ? l : `${l.minute !== undefined ? `${pad(clock(l.minute), 14)}` : ''}${l.text ?? l.action ?? ''}` }));
        },
      },
      records: {
        args: '[text]', help: 'the people on the host, with search',
        run(ctx, rest) {
          const { game } = ctx;
          const { h } = link(ctx);
          const fields = recordsKept(game, h);
          if (!fields.length) return [{ text: `${h.name} keeps no personal records` }];
          const staffOnly = fields.some((f) => WORK_FIELDS.includes(f)) && !fields.some((f) => !WORK_FIELDS.includes(f));
          const q = rest.join(' ').toLowerCase();
          const people = game.world.people.map((p, i) => ({ p, i }))
            .filter(({ p }) => !staffOnly || p.company === h.company)
            .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
          ctx.term.last = { kind: 'person', ids: people.map(({ i }) => i) };
          if (!people.length) return [{ text: 'no one matches' }];
          const rows = people.slice(0, 60).map(({ p }, n) => ({ text: `${pad(`#${n + 1}`, 5)}${pad(p.name, 24)}${fields.map((f) => `${RECORD_LABEL[f]} ${recordText(game, f, p[f])}`).join(' // ')}` }));
          if (people.length > 60) rows.push({ text: `... ${people.length - 60} more // narrow it with a search`, tone: 'info' });
          return rows;
        },
      },
      crack: {
        args: '[service #]', help: 'break a password (the first locked service by default)',
        run(ctx, [w]) {
          const { h } = link(ctx);
          const i = w ? rowOf(w) : h.services.findIndex((s) => !s.open && s.kind !== 'voice');
          if (i < 0 || !h.services[i]) fail(w ? `no service ${w} // see \`bg services\`` : 'every password lock is already open');
          return task(ctx, 'CrackPassword', i, `crack ${h.services[i].name}`);
        },
      },
      record: {
        args: '[service #]', help: "call a voice lock's admin and record their voice",
        run(ctx, [w]) {
          const i = voiceLock(ctx, w);
          return task(ctx, 'RecordVoice', i, `call to the admin of ${link(ctx).h.services[i].name}`);
        },
      },
      voiceprint: {
        args: '[service #]', help: "play the admin's recording to open a voice lock",
        run(ctx, [w]) {
          const i = voiceLock(ctx, w);
          return task(ctx, 'PlayVoiceprint', i, `voiceprint ${link(ctx).h.services[i].name}`);
        },
      },
      bypass: {
        args: 'firewall|monitor|proxy', help: 'bypass a defence',
        run(ctx, [what]) {
          const kind = { firewall: 'BypassFirewall', monitor: 'BypassMonitor', proxy: 'BypassProxy' }[what];
          if (!kind) fail('usage: bg bypass firewall|monitor|proxy');
          return task(ctx, kind, undefined, `bypass ${what}`);
        },
      },
      copy: { args: '<file>', help: 'copy a file to your storage', run: (ctx, [w]) => task(ctx, 'CopyFile', remoteFile(ctx, w), `copy ${w}`) },
      delete: { args: '<file>', help: 'delete a file on the host', run: (ctx, [w]) => task(ctx, 'DeleteFile', remoteFile(ctx, w), `delete ${w}`) },
      decrypt: { args: '<file>', help: 'decrypt a file on the host', run: (ctx, [w]) => task(ctx, 'DecryptFile', remoteFile(ctx, w), `decrypt ${w}`) },
      osint: { args: '', help: 'run an OSINT sweep', run: (ctx) => task(ctx, 'OsintSweep', undefined, 'OSINT sweep') },
      alter: {
        args: '<person> <field> <value>', help: 'change a record, e.g. bg alter "Ana Diaz" status deceased',
        run(ctx, [who, f, ...rest]) {
          if (!who || !f || !rest.length) fail('usage: bg alter <person> <field> <value>');
          link(ctx);
          const person = personArg(ctx, who);
          const field = fieldArg(f);
          const value = parseRecord(ctx.game, field, rest.join(' '));
          if (!validRecord(ctx.game, field, value)) fail(`not a valid ${RECORD_LABEL[field].toLowerCase()}`);
          return task(ctx, 'AlterRecord', { person, field, value }, `alter ${RECORD_LABEL[field].toLowerCase()} of ${ctx.game.world.people[person].name}`);
        },
      },
    },
  },

  gateway: {
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
        args: '[cpu|ram|storage|modem|security|chassis]', help: 'the parts for sale',
        run(ctx, [kind = 'cpu']) {
          if (kind === 'chassis') {
            ctx.term.last = { kind: 'shop', ids: chassis().map((c) => `gw.chassis.${c.tier}`) };
            return chassis().map((c, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(c.name, 26)}${pad(cr(c.price), 12)}${c.note ?? ''}` }));
          }
          const list = componentsOf(kind);
          if (!list.length) fail('usage: gw shop [cpu|ram|storage|modem|security|chassis]');
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
  },

  software: {
    alias: ['sw'],
    window: 'software',
    about: 'your tools and the tool shop',
    commands: {
      list: {
        args: '', help: 'your tools and their versions',
        run(ctx) {
          const mine = ctx.game.player.tools.filter((t) => t.level > 0);
          if (!mine.length) return [{ text: 'no tools' }];
          return mine.map((t) => ({ text: `${pad(software().find((x) => x.kind === t.kind)?.name ?? t.kind, 26)}v${t.level}` }));
        },
      },
      shop: {
        args: '', help: 'every tool and the price of its next version',
        run(ctx) {
          return software().map((t) => {
            const lvl = toolLevel(ctx.game, t.kind);
            const max = t.versions?.length ?? 5;
            return { text: `${pad(t.name, 26)}${pad(lvl ? `have v${lvl}` : 'not owned', 11)}${lvl >= max ? 'top version' : `v${lvl + 1} for ${cr(toolPrice(t, lvl + 1))}`}` };
          });
        },
      },
      info: {
        args: '<tool>', help: 'what a tool does',
        run(ctx, [w]) {
          const t = toolArg(w);
          const lvl = toolLevel(ctx.game, t.kind);
          return [{ text: `${t.name} // you have ${lvl ? `v${lvl}` : 'none'}`, tone: 'head' }, { text: t.desc ?? '' }];
        },
      },
      buy: {
        args: '<tool> [version]', help: 'buy or upgrade a tool (the next version by default)',
        run(ctx, [w, v]) {
          const t = toolArg(w);
          const before = toolLevel(ctx.game, t.kind);
          const level = v ? Number(String(v).replace(/^v/i, '')) : before + 1;
          if (!Number.isInteger(level) || level < 1) fail('usage: sw buy <tool> [version]');
          const said = press(ctx, `sw.buy.${t.kind}.${level}`, '');
          if (toolLevel(ctx.game, t.kind) > before) return [{ text: `${t.name} v${level} installed`, tone: 'ok' }];
          return said.some((l) => l.text) ? said : [{ text: `could not buy ${t.name} v${level} // check the price and your rating`, tone: 'err' }];
        },
      },
    },
  },

  storage: {
    alias: ['files'],
    window: 'files',
    about: 'the files you have downloaded',
    commands: {
      list: {
        args: '', help: 'your files',
        run(ctx) {
          const files = ctx.game.player.storage;
          if (!files.length) return [{ text: 'storage is empty' }];
          return files.map((f, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? 'encrypted' : ''}` }));
        },
      },
      space: {
        args: '', help: 'used and free space',
        run(ctx) {
          const used = ctx.game.player.storage.reduce((n, f) => n + (f.size ?? 0), 0);
          const cap = ctx.game.player.gateway.parts.filter((p) => p.kind === 'storage')
            .reduce((n, p) => n + (componentsOf('storage').find((d) => d.tier === p.level)?.capacity ?? 0), 0);
          return [{ text: `${used} GB used of ${cap} GB // ${Math.max(cap - used, 0)} GB free` }];
        },
      },
      delete: {
        args: '<file|#>', help: 'delete a downloaded file',
        run(ctx, [w]) {
          const files = ctx.game.player.storage;
          const n = rowOf(w) >= 0 ? rowOf(w) : files.findIndex((f) => f.name.toLowerCase() === (w ?? '').toLowerCase());
          if (!files[n]) fail('name a file, or #n from `storage list`');
          const { name } = files[n];
          return press(ctx, `files.del.${n}`, `${name} deleted`);
        },
      },
    },
  },

  bank: {
    alias: [],
    window: 'bank',
    about: 'your money',
    commands: {
      balance: { args: '', help: 'your credits', run: (ctx) => [{ text: cr(ctx.game.player.credits), tone: 'head' }] },
      ledger: {
        args: '[n]', help: 'the last n transactions (10 by default)',
        run(ctx, [n]) {
          const rows = (ctx.game.ledger ?? []).slice(-Math.max(Number(n) || 10, 1));
          if (!rows.length) return [{ text: 'no transactions' }];
          return rows.map((l) => ({ text: `${pad(clock(l.minute), 14)}${pad(`${l.amount >= 0 ? '+' : '-'}${cr(Math.abs(l.amount))}`, 14)}${l.reason}`, tone: l.amount >= 0 ? 'ok' : 'err' }));
        },
      },
    },
  },

  news: {
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
  },

  operator: {
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
  },

  system: {
    alias: ['sys'],
    window: 'settings',
    about: 'settings, saving and logging out',
    commands: {
      autosave: { args: 'on|off', help: 'autosave every 45 seconds', run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.auto', value: onOff(w, 'sys autosave') }], ctx.desk); return [{ text: `autosave ${w}`, tone: 'ok' }]; } },
      fast: { args: 'on|off', help: 'run the world clock 8x', run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.fast', value: onOff(w, 'sys fast') }], ctx.desk); return [{ text: `fast-forward ${w}`, tone: 'ok' }]; } },
      theme: {
        args: 'light|dark', help: 'the skin',
        run(ctx, [w]) {
          if (w !== 'light' && w !== 'dark') fail('usage: sys theme light|dark');
          return press(ctx, `set.theme.${w}`, `${w} skin`);
        },
      },
      save: { args: '', help: 'save now', run: (ctx) => press(ctx, 'set.save', 'run saved') },
      quit: { args: '', help: 'save and log out', run: (ctx) => press(ctx, 'set.quit', 'saved // logging out') },
    },
  },

  dsn: {
    alias: ['web', 'deppspacenet'],
    window: 'dsn',
    about: 'DeepSpaceN3T: browse the hidden job market and haggle with clients',
    commands: {
      open: {
        args: '[address]', help: 'open a page (dsn://hub by default)',
        run(ctx, [w]) {
          openWindow(ctx.state.windows, 'dsn', ctx.desk);
          return press(ctx, `dsn.go.${w ?? 'hub'}`, `loading dsn://${(w ?? 'hub').replace(/^dsn:\/\//i, '')}`);
        },
      },
      search: {
        args: '<text>', help: 'search listings, brokers and companies',
        run(ctx, rest) {
          if (!rest.length) fail('usage: dsn search <text>');
          openWindow(ctx.state.windows, 'dsn', ctx.desk);
          return press(ctx, `dsn.go.search/${encodeURIComponent(rest.join(' '))}`, `searching for "${rest.join(' ')}"`);
        },
      },
      haggle: {
        args: '<job> <amount|+n%>', help: 'ask a client for a bigger fee (one ask per job)',
        run(ctx, [j, amt]) {
          const c = contractArg(ctx, j);
          if (!amt) fail('usage: dsn haggle <job> <amount|+n%>');
          const ask = amt.endsWith('%') ? c.reward * (1 + Number(amt.replace(/[+%]/g, '')) / 100) : Number(amt);
          const err = askFee(ctx.game, c.id, ask);
          if (err) fail(err);
          return [{ text: `asked ${c.client} for ${Math.round(ask)} cr // odds ${Math.round(haggleOdds(ctx.game, c, ask) * 100)}% // the answer comes in a few minutes`, tone: 'ok' }];
        },
      },
      reply: {
        args: '<job>', help: "the client's channel for a job",
        run(ctx, [j]) {
          const c = contractArg(ctx, j);
          const hg = haggleOf(ctx.game, c.id);
          if (!hg) return [{ text: 'no ask made on this job yet' }];
          return [...hg.log.map((m) => ({ text: `${m.who.toUpperCase()}: ${m.text}`, tone: m.who === 'you' ? 'echo' : 'info' })), { text: `state: ${hg.state}`, tone: 'head' }];
        },
      },
      take: {
        args: '<job>', help: "take the client's counter-offer, or the posted fee, and accept",
        run(ctx, [j]) {
          const c = contractArg(ctx, j);
          const err = takeOffer(ctx.game, c.id);
          if (err) fail(err);
          return [{ text: `accepted #${c.id} at ${c.reward} cr`, tone: 'ok' }];
        },
      },
    },
  },
  people: {
    alias: ['ppl', 'dossiers'],
    window: 'dossiers',
    about: 'OSINT: dossiers on people, and attacks on their phones and inboxes',
    commands: {
      list: {
        args: '', help: 'everyone on file, with what you know',
        run(ctx) {
          const ids = dossiers(ctx.game);
          if (!ids.length) return [{ text: 'nobody on file // `bg osint` on a link adds leads' }];
          ctx.term.last = { kind: 'person', ids };
          return ids.map((i, n) => {
            const p = ctx.game.world.people[i];
            return { text: `#${n + 1}  ${pad(p.name, 22)}${pad(intelText(ctx.game, i, 'email'), 34)}${intelText(ctx.game, i, 'phone')}` };
          });
        },
      },
      staff: {
        args: '', help: "the staff of the linked host's company",
        run(ctx) {
          const { h } = link(ctx);
          const ids = ctx.game.world.people.map((p, i) => i).filter((i) => ctx.game.world.people[i].company === h.company);
          ctx.term.last = { kind: 'person', ids };
          return ids.map((i, n) => ({ text: `#${n + 1}  ${pad(ctx.game.world.people[i].name, 22)}clearance ${ctx.game.world.people[i].clearance}  ${intelText(ctx.game, i, 'role')}` }));
        },
      },
      show: {
        args: '<person>', help: 'the dossier of one person',
        run(ctx, [w]) {
          const i = personArg(ctx, w);
          const p = ctx.game.world.people[i];
          const it = ctx.game.intel?.[i] ?? {};
          return [
            { text: `${p.name} // ${ctx.game.world.companies[p.company]?.name ?? ''} // clearance ${p.clearance}`, tone: 'head' },
            ...INTEL_FIELDS.map((f) => ({ text: `  ${pad(f.label, 12)}${intelText(ctx.game, i, f.field)}` })),
            { text: `  ${[it.tapped && 'TAPPED', it.inbox && 'INBOX HACKED', it.phishAt !== undefined && 'PHISH SENT'].filter(Boolean).join(' // ') || 'nothing done yet'}` },
          ];
        },
      },
      profile: { args: '<person>', help: 'OSINT a person: email, role, phone, social, leaked password', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Profile', i, `profile ${ctx.game.world.people[i].name}`); } },
      call: { args: '<person>', help: 'call and record their voice (leaves a call log)', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'CallRecord', i, `call ${ctx.game.world.people[i].name}`); } },
      spoofcall: { args: '<person>', help: 'record their voice posing as their IT desk (no log)', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'SpoofCall', i, `spoofcall ${ctx.game.world.people[i].name}`); } },
      tap: { args: '<person>', help: 'tap their phone (SPOOF KIT v2): a password they say opens a lock', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'TapPhone', i, `tap ${ctx.game.world.people[i].name}`); } },
      inbox: { args: '<person>', help: 'hack their inbox: company hosts, colleagues, saved passwords', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'HackInbox', i, `inbox ${ctx.game.world.people[i].name}`); } },
      phish: { args: '<person>', help: 'send a fake reset mail; the answer comes in 3 hours', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Phish', i, `phish ${ctx.game.world.people[i].name}`); } },
      spam: { args: '<person>', help: 'bury their inbox for a day; slows the trace if they run the host', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Spam', i, `spam ${ctx.game.world.people[i].name}`); } },
    },
  },
  notepad: {
    alias: ['note'],
    window: 'notepad',
    about: 'your notes',
    commands: {
      show: { args: '', help: 'print the notes', run: (ctx) => (ctx.game.notes ? ctx.game.notes.split('\n').map((text, i) => ({ text: `${pad(i + 1, 4)}${text}` })) : [{ text: 'the notepad is empty' }]) },
      list: { args: '', help: 'every notepad', run: (ctx) => padsOf(ctx.game).map((n, i) => ({ text: `${i === ctx.game.notepad ? '>' : ' '} ${i + 1}  ${n.name}` })) },
      new: {
        args: '[name]', help: 'start a new notepad',
        run(ctx, rest) {
          if (!newPad(ctx.game, rest.join(' '))) fail(`at most ${MAX_PADS} notepads`);
          return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
        },
      },
      open: {
        args: '<n>', help: 'switch notepad',
        run(ctx, [n]) {
          if (!openPad(ctx.game, Number(n) - 1)) fail('no such notepad: `notepad list`');
          return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
        },
      },
      rename: {
        args: '<name>', help: 'rename the open notepad',
        run(ctx, rest) {
          if (!rest.length) fail('usage: notepad rename <name>');
          padsOf(ctx.game)[ctx.game.notepad].name = rest.join(' ').toUpperCase().slice(0, 16);
          return [{ text: 'renamed', tone: 'ok' }];
        },
      },
      delete: {
        args: '<n> --yes', help: 'delete a notepad',
        run(ctx, [n, yes]) {
          if (yes !== '--yes') fail('this deletes the notepad: `notepad delete <n> --yes`');
          if (!deletePad(ctx.game, Number(n) - 1)) fail('no such notepad: `notepad list`');
          return [{ text: 'notepad deleted', tone: 'ok' }];
        },
      },
      write: {
        args: '"<text>"', help: 'add a line to the notes',
        run(ctx, rest) {
          const text = rest.join(' ');
          if (!text) fail('usage: notepad write "<text>"');
          ctx.game.notes = (ctx.game.notes ? `${ctx.game.notes}\n` : '') + text;
          return [{ text: 'line added', tone: 'ok' }];
        },
      },
      wrap: {
        args: 'on|off', help: 'word wrap',
        run(ctx, [w]) {
          const v = onOff(w, 'notepad wrap');
          if ((ctx.game.settings.noteWrap !== false) !== v) handleEvents(ctx.state, [{ type: 'click', id: 'note.wrap' }], ctx.desk);
          return [{ text: `wrap ${w}`, tone: 'ok' }];
        },
      },
      clear: {
        args: '--yes', help: 'wipe every line',
        run(ctx, [yes]) {
          if (yes !== '--yes') fail('this wipes every line: `notepad clear --yes`');
          ctx.game.notes = '';
          return [{ text: 'notepad cleared', tone: 'ok' }];
        },
      },
    },
  },

  cheat: {
    alias: [],
    window: 'cheats',
    hidden: true,
    about: 'the cheat menu (it does not mark the run)',
    commands: {
      money: {
        args: '<n>', help: 'set your credits',
        run(ctx, [n]) {
          (ctx.state.win.cheats ??= {}).money = n ?? '';
          const said = press(ctx, 'cheat.money.set', '');
          return said.some((l) => l.tone === 'err') ? said : [{ text: `credits now ${cr(ctx.game.player.credits)}`, tone: 'ok' }];
        },
      },
      heat: {
        args: '<0-99>', help: 'set heat',
        run(ctx, [n]) {
          const v = Number(n);
          if (n === undefined || !Number.isFinite(v)) fail('usage: cheat heat <0-99>');
          const to = Math.max(0, Math.min(99, Math.round(v)));
          return press(ctx, `cheat.heat.set.${to}`, `heat set to ${to}`);
        },
      },
      rating: {
        args: '<n>', help: 'set your rating',
        run(ctx, [n]) {
          const v = Number(n);
          if (n === undefined || !Number.isFinite(v)) fail('usage: cheat rating <n>');
          press(ctx, `cheat.rating.${Math.round(v - ctx.game.player.rating)}`, '');
          return [{ text: `rating now ${ctx.game.player.rating}`, tone: 'ok' }];
        },
      },
      speed: {
        args: `<${SPEEDS.join('|')}>`, help: 'clock speed',
        run(ctx, [n]) {
          if (!SPEEDS.includes(Number(n))) fail(`usage: cheat speed <${SPEEDS.join('|')}>`);
          return press(ctx, `cheat.time.${n}`, `clock at ${n}x`);
        },
      },
      reveal: { args: '', help: 'reveal the whole map', run: (ctx) => press(ctx, 'cheat.map', 'map revealed') },
      tools: { args: '', help: 'every tool at v5', run: (ctx) => press(ctx, 'cheat.tools', 'every tool at v5') },
      gateway: { args: '', help: 'max the gateway', run: (ctx) => press(ctx, 'cheat.gateway', 'gateway maxed') },
      mission: { args: '', help: 'open the MISSION BUILDER', run: (ctx) => press(ctx, 'cheat.missions', 'MISSION BUILDER opened') },
    },
  },
};

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
