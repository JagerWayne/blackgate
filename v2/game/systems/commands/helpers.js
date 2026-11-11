import { handleEvents, isDestructive } from '../events.js';
import { startTask, LINK_DOWN } from '../sessionTasks.js';
import { RECORD_LABEL } from '../../state/records.js';
import { software } from '../../data/content.js';
import { hiddenHost } from '../../state/intel.js';
import { t as tl } from '../../data/language.js';

// -- small helpers ------------------------------------------------------------

export const cr = (n) => `${Math.round(n).toLocaleString('en-US')} cr`;
export const pad = (s, n) => String(s).padEnd(n);
export const clock = (minute) => {
  const d = Math.floor(minute / 1440) + 1;
  const h = String(Math.floor((minute % 1440) / 60)).padStart(2, '0');
  const m = String(Math.floor(minute % 60)).padStart(2, '0');
  return `day ${d} ${h}:${m}`;
};
export class Fail extends Error {}
/// Stops the command with a message.
export const fail = (text) => { throw new Fail(text); };
/// `#3` or `3` as a 0-based index, or -1.
export const rowOf = (word) => (/^#?\d+$/.test(word ?? '') ? Number(String(word).replace('#', '')) - 1 : -1);

/// Sends a button's event and returns what the game said about it: the
/// toasts it raised, or `done` when it raised none.
export function press(ctx, id, done) {
  const { state } = ctx;
  const before = state.game.toasts.length;
  handleEvents(state, [{ type: 'click', id }], ctx.desk);
  if (!state.game) return [{ text: done, tone: 'ok' }];
  const said = state.game.toasts.slice(before);
  if (!said.length) return [{ text: done, tone: 'ok' }];
  return said.map((t) => ({ text: t.text, tone: t.kind === 'bad' ? 'err' : t.kind === 'good' ? 'ok' : 'info' }));
}

/// The id a `#n` word picks from the last list of a kind, or null.
export function pick(ctx, word, kind) {
  const i = rowOf(word);
  const last = ctx.term.last;
  if (i < 0 || !last || last.kind !== kind) return null;
  return last.ids[i] ?? null;
}

/// A found host by `#n` (from the last host list), IP, name or domain.
export function hostArg(ctx, word, hidden = false) {
  if (!word) fail(tl('systems.commands.helpers.name_a_host_an'));
  const { game } = ctx;
  const byPick = pick(ctx, word, 'host');
  const w = word.toLowerCase();
  const h = byPick !== null ? game.world.hosts[byPick]
    : game.world.hosts.find((x) => x.discovered && (x.ip === word || x.name.toLowerCase() === w || x.domain?.toLowerCase() === w));
  if (hidden && !h) { const x = hiddenHost(game, word); if (x) return x; }
  if (!h || !h.discovered) fail(tl('systems.commands.helpers.no_host_you_know', word));
  return h;
}

/// A contract by its id or `#n` from the last contract list.
export function contractArg(ctx, word) {
  if (!word) fail(tl('systems.commands.helpers.name_a_contract_its'));
  const id = (word.startsWith('#') ? pick(ctx, word, 'contract') : null) ?? Number(String(word).replace(/^C-?/i, ''));
  const c = ctx.game.contracts.find((x) => x.id === id);
  if (!c) fail(tl('systems.commands.helpers.no_contract', word));
  return c;
}

/// The mail, newest first, as the MAIL window lists it.
export const mailbox = (game) => game.mail.slice().sort((a, b) => b.minute - a.minute);

/// A message by `#n` from the last mail list (or the mailbox), or `new`.
export function mailArg(ctx, word) {
  if (!word) fail(tl('systems.commands.helpers.name_a_message_n'));
  const box = mailbox(ctx.game);
  if (word === 'new') {
    const unread = box.filter((m) => !m.read);
    if (!unread.length) fail(tl('systems.commands.helpers.no_unread_mail'));
    return unread[unread.length - 1];
  }
  const id = pick(ctx, word, 'mail');
  const m = (id !== null ? ctx.game.mail.find((x) => x.id === id) : null) ?? box[rowOf(word)];
  if (!m) fail(tl('systems.commands.helpers.no_message', word));
  return m;
}

/// The live link, or a failure saying there is none. With `up`, the link must
/// have finished connecting: until then the host shows nothing.
export function link(ctx, up = true) {
  const s = ctx.game.session;
  if (!s) fail(tl('systems.commands.helpers.not_connected_bg_connect'));
  if (up && s.phase !== 'online') fail(LINK_DOWN);
  return { s, h: ctx.game.world.hosts[s.target] };
}

/// A file on the connected host, by name or `#n` from `bg files`.
export function remoteFile(ctx, word) {
  const { h } = link(ctx);
  if (!word) fail(tl('systems.commands.helpers.name_a_file_its'));
  const last = ctx.term.last;
  // the numbers of a file list belong to the host it listed
  if (last?.kind === 'rfile' && last.host !== h.id && rowOf(word) >= 0) fail(tl('systems.commands.helpers.that_file_list_is'));
  const byPick = pick(ctx, word, 'rfile');
  const i = byPick !== null ? byPick : h.files.findIndex((f) => !f.deleted && f.name.toLowerCase() === word.toLowerCase());
  if (i < 0 || !h.files[i] || h.files[i].deleted) fail(tl('systems.commands.helpers.no_file_on', word, h.name));
  return i;
}

/// Runs a task on the live link, as the button would.
export function task(ctx, kind, arg, label) {
  link(ctx);
  const err = startTask(ctx.game, kind, arg);
  if (err) fail(err);
  return [{ text: `started: ${label}`, tone: 'ok' }];
}

/// A voice lock on the host: the one named, or the first still locked.
export function voiceLock(ctx, word) {
  const { h } = link(ctx);
  const i = word ? rowOf(word) : h.services.findIndex((s) => s.kind === 'voice' && !s.open);
  if (i < 0 || h.services[i]?.kind !== 'voice') fail(word ? `service ${word} is not a voice lock` : 'no locked voice service here');
  return i;
}

/// A person by name (or #n from `bg records`).
export function personArg(ctx, word) {
  if (!word) fail(tl('systems.commands.helpers.name_a_person'));
  const byPick = pick(ctx, word, 'person');
  if (byPick !== null) return byPick;
  const w = word.toLowerCase();
  const i = ctx.game.world.people.findIndex((p) => p.name.toLowerCase() === w);
  if (i < 0) fail(tl('systems.commands.helpers.no_one_called', word));
  return i;
}

/// A record field by its key or label: `status`, `ssn`, `"vital status"`.
export function fieldArg(word) {
  const w = (word ?? '').toLowerCase().replace(/[\s_-]/g, '');
  const key = Object.keys(RECORD_LABEL).find((k) => k.toLowerCase() === w || RECORD_LABEL[k].toLowerCase().replace(/\s/g, '') === w);
  if (!key) fail(tl('systems.commands.helpers.fields', Object.keys(RECORD_LABEL).join(', ')));
  return key;
}

/// A tool by its kind or name, loosely: `PasswordCracker`, `"password breaker"`, `breaker`.
export function toolArg(word) {
  if (!word) fail(tl('systems.commands.helpers.name_a_tool_see'));
  const w = word.toLowerCase().replace(/[\s_-]/g, '');
  const flat = (t) => t.name.toLowerCase().replace(/\s/g, '');
  const t = software().find((x) => x.kind.toLowerCase() === w || flat(x) === w) ?? software().find((x) => flat(x).includes(w));
  if (!t) fail(tl('systems.commands.helpers.no_tool', word));
  return t;
}

export const toolLevel = (game, kind) => game.player.tools.find((t) => t.kind === kind)?.level ?? 0;
export const onOff = (word, what) => {
  if (word === 'on') return true;
  if (word === 'off') return false;
  return fail(tl('systems.commands.helpers.usage_on_off', what));
};

/// A GATEWAY button that may take a part out: without --yes it only says so,
/// the way the window arms the button on its first click.
export function gwPress(ctx, id, yes, done) {
  const destructive = isDestructive(ctx.game, id);
  if (destructive && yes !== '--yes') fail(tl('systems.commands.helpers.this_takes_a_part'));
  // the window's two clicks: the first arms the button, the second does it
  if (destructive) handleEvents(ctx.state, [{ type: 'click', id }], ctx.desk);
  return press(ctx, id, done);
}

/// A shortcut for actions that just press one button with an argument.
export const simple = (args, help, idOf, done) => ({ args, help, run: (ctx, w) => { const x = idOf(ctx, w); return press(ctx, x.id, x.done ?? done); } });

// -- the applications ---------------------------------------------------------
