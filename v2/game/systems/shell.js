// The host shell: a small Unix-like command line over the machine the link is
// on, and over the operator's own gateway. The remote host is `/` with the
// folders `files` and `logs`; the gateway is `~` with `apps`, `downloads` and
// `logs`. The commands that change the host (copy, del, decrypt, crack and
// the rest) start the same tasks the buttons start, so the checks, the
// timings and the traces are the game's own.

import { startTask } from './sessionTasks.js';
import { burn, traceWarnAt } from './sessionTick.js';
import { storageUsed } from '../state/gameHelpers.js';
import { toolSize, appsUsed } from '../state/apps.js';
import { storage, sharedDrive, systemCap, downloadCap } from '../state/gateway.js';
import { logFiles } from '../state/logs.js';
import { copyRate } from '../state/transfer.js';
import { rankName } from '../core/theme.js';
import { t as tl } from '../data/language.js';

const FOLDERS = { '/': ['files', 'logs'], '~': ['apps', 'downloads', 'logs'] };
const WIDTH = 72;

/// The state of one shell: its scrollback, history and where it is.
export function makeShell(s) {
  return { session: s, lines: [], history: [], at: -1, input: '', root: '/', dir: '', seenCount: s.pushed ?? s.lines.length, greeted: false, want: null };
}

// -- output ---------------------------------------------------------------------

const out = (sh, text, tone) => sh.lines.push({ text, tone });
const segs = (sh, parts) => sh.lines.push({ segs: parts });
const pad = (v, n) => String(v).padEnd(n);
const pad3 = (n) => String(n).padStart(3, '0');
const bar = (frac, w = 24) => `[${'#'.repeat(Math.round(Math.min(Math.max(frac, 0), 1) * w)).padEnd(w, '.')}]`;
const stamp = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const day = (m) => Math.floor(m / 1440) + 1;

/// Words of a line; "quoted text" stays one word.
function words(line) {
  const o = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) o.push(m[1] ?? m[2]);
  return o;
}

/// A repeatable number from a text, for the made-up bytes of a file.
function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// -- the file system ---------------------------------------------------------------

/// What lives in a folder: `{ name, kind, size, ... }` entries.
function entries(game, s, root, dir) {
  const h = game.world.hosts[s.target];
  if (!dir) return FOLDERS[root].map((name) => ({ name, kind: 'dir' }));
  if (root === '/' && dir === 'files') {
    return h.files.map((f, i) => ({ name: f.name, kind: 'file', size: f.size, enc: f.enc, idx: i, deleted: f.deleted })).filter((e) => !e.deleted);
  }
  if (root === '/' && dir === 'logs') {
    return h.logs.map((l, i) => ({ name: `log-${pad3(i)}.log`, kind: 'log', minute: l.minute, text: `${l.ip}  ${l.text}`, mine: l.ip === game.player.gateway.ip, loud: l.loud, idx: i }));
  }
  if (dir === 'apps') {
    return game.player.tools.map((t) => ({ name: `${t.kind.toLowerCase()}.exe`, kind: 'exe', size: toolSize(t.kind, t.level), level: t.level, tool: t.kind, local: true }));
  }
  if (dir === 'downloads') return game.player.storage.map((f, i) => ({ name: f.name, kind: 'file', size: f.size, enc: f.enc, idx: i, local: true }));
  return logFiles(game).map((f) => ({ name: f.name, kind: 'log', minute: f.day * 1440, text: f.text, lines: f.entries, daily: true, idx: f.day, local: true }));
}

/// A name in a folder: exact, or a unique start of one.
function find(list, name) {
  const w = name.toLowerCase();
  const exact = list.find((e) => e.name.toLowerCase() === w);
  if (exact) return exact;
  const hits = list.filter((e) => e.name.toLowerCase().startsWith(w));
  return hits.length === 1 ? hits[0] : null;
}

/// A path, from where the shell is: `{ root, dir, file }` or `{ error }`.
function parsePath(sh, text) {
  let { root, dir } = sh;
  let rest = text;
  if (text === '~' || text.startsWith('~/')) {
    root = '~';
    dir = '';
    rest = text.slice(1);
  } else if (text.startsWith('/')) {
    root = '/';
    dir = '';
  }
  let file = null;
  for (const part of rest.split('/').filter(Boolean)) {
    if (part === '.') continue;
    if (file !== null) return { error: `not a directory: ${file}` };
    if (part === '..') dir = '';
    else if (!dir && FOLDERS[root].includes(part)) dir = part;
    else if (dir) file = part;
    else return { error: `no such directory: ${part}` };
  }
  return { root, dir, file };
}

const where = (sh) => (sh.root === '~' ? `~${sh.dir ? `/${sh.dir}` : ''}` : `/${sh.dir}`);

/// The prompt as coloured pieces: handle, host and place.
export function promptOf(game, sh) {
  const h = game.world.hosts[sh.session.target];
  const host = h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16);
  return [[game.player.handle.toLowerCase(), 'ok'], ['@', 'dim'], [host, 'head'], [':', 'dim'], [where(sh), 'info'], ['$ ', 'dim']];
}

/// The colour a listing gives an entry.
const toneOf = (e) => (e.kind === 'dir' ? 'dir' : e.enc > 0 ? 'err' : e.kind === 'exe' ? 'ok' : e.loud ? 'err' : e.kind === 'log' ? 'dim' : 'plain');

/// One entry of a long listing.
function longLine(sh, e, game) {
  const dir = e.kind === 'dir';
  const perm = dir ? 'drwxr-xr-x' : e.enc > 0 ? '-rw-------' : e.kind === 'exe' ? '-rwxr-xr-x' : '-rw-r--r--';
  const size = dir ? '-' : e.kind === 'log' ? `${(e.text?.length ?? 0) + 24}B` : `${e.size}G`;
  const when = e.minute !== undefined ? `day ${day(e.minute)} ${stamp(e.minute)}` : `day ${day(game.clock.minutes)} --:--`;
  const owner = e.local ? game.player.handle.toLowerCase().slice(0, 8) : 'root';
  segs(sh, [[`${perm}  1 ${pad(owner, 9)}${pad(size, 7)}${pad(when, 14)}`, 'dim'], [e.name + (dir ? '/' : ''), toneOf(e)]]);
}

/// The entry a command names: a path, a name in this folder, or a name among
/// the host's files. Throws a message when there is none.
function target(ctx, word, kinds) {
  const { sh, game, s } = ctx;
  let e;
  if (!word.includes('/') && word !== '~') {
    // this folder first, then the host's files, then the host's logs, so `del log-003.log` works from anywhere
    e = (sh.dir ? find(entries(game, s, sh.root, sh.dir), word) : null)
      ?? find(entries(game, s, '/', 'files'), word)
      ?? find(entries(game, s, '/', 'logs'), word);
    if (!e && !sh.dir && FOLDERS[sh.root].includes(word)) e = { name: word, kind: 'dir' };
  } else {
    const p = parsePath(sh, word);
    if (p.error) throw new Error(p.error);
    e = p.file === null ? (p.dir ? { name: p.dir, kind: 'dir' } : { name: word, kind: 'dir' }) : find(entries(game, s, p.root, p.dir), p.file);
  }
  if (!e) throw new Error(`${word}: no such file`);
  if (kinds && !kinds.includes(e.kind)) throw new Error(`${word}: ${e.kind === 'dir' ? 'is a directory' : `not a ${kinds.join(' or ')}`}`);
  return { e };
}

/// Runs a task and says so; a refusal is an error line.
function begin(ctx, kind, arg, label) {
  const err = startTask(ctx.game, kind, arg);
  if (err) throw new Error(err);
  out(ctx.sh, `[+] ${label}`, 'ok');
}

/// A service by number, name or port.
function serviceIndex(ctx, word) {
  const h = ctx.game.world.hosts[ctx.s.target];
  if (!word) {
    const first = h.services.findIndex((v) => !v.open && v.kind !== 'voice');
    if (first < 0) throw new Error('nothing locked here');
    return first;
  }
  const n = /^#?\d+$/.test(word) && Number(word.replace('#', '')) <= h.services.length ? Number(word.replace('#', '')) - 1 : -1;
  const w = word.toLowerCase();
  const i = n >= 0 ? n : h.services.findIndex((v) => v.name.toLowerCase() === w || `${v.name}:${v.port}`.toLowerCase() === w || String(v.port) === w);
  if (i < 0 || !h.services[i]) throw new Error(`no service "${word}" // try \`nmap\``);
  return i;
}

/// The made-up bytes of a file, 16 to a row, as a classic hex dump.
function hexdump(sh, name, rows = 8) {
  let seed = hash(name);
  for (let r = 0; r < rows; r += 1) {
    const b = [];
    for (let i = 0; i < 16; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      b.push((seed >>> 24) & 0xff);
    }
    const ascii = b.map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('');
    const hex = b.map((x) => x.toString(16).padStart(2, '0')).join(' ');
    segs(sh, [[`${(r * 16).toString(16).padStart(8, '0')}  `, 'dim'], [`${hex.slice(0, 23)}  ${hex.slice(24)}  `, 'info'], [`|${ascii}|`, 'ok']]);
  }
}

const WORDS = ['passwd', 'root', 'admin', 'token', 'secret', 'api_key', '/etc/shadow', 'BEGIN RSA PRIVATE KEY', 'Authorization: Bearer', 'db_password', 'sshd', 'cron', 'vault', 'backup', 'jdbc:postgresql://', 'AKIA', 'session_id', 'X-Forwarded-For'];

const COMMANDS = {
  help: {
    usage: 'help [command]', help: tl('systems.shell.this_list_or_how'),
    run(ctx, [w]) {
      const { sh } = ctx;
      if (w) {
        const name = ALIAS[w] ?? w;
        const c = COMMANDS[name];
        if (!c) throw new Error(`no manual entry for ${w}`);
        out(sh, `NAME     ${name} - ${c.help}`, 'head');
        out(sh, `USAGE    ${c.usage}`, 'info');
        (c.more ?? []).forEach((l) => out(sh, `         ${l}`, 'dim'));
        return;
      }
      out(sh, 'BLACKGATE rootshell // commands (help <command> for details)', 'head');
      Object.entries(COMMANDS).forEach(([name, c]) => segs(sh, [[`  ${pad(name, 11)}`, 'ok'], [c.help, 'plain']]));
      out(sh, 'paths: / is the host (files, logs), ~ is your gateway (apps, downloads, logs) // Tab completes // Up/Down recall // wheel scrolls', 'info');
    },
  },
  pwd: { usage: 'pwd', help: tl('systems.shell.where_you_are'), run: (c) => out(c.sh, where(c.sh), 'plain') },
  cd: {
    usage: 'cd <folder> | cd .. | cd / | cd ~', help: tl('systems.shell.change_folder'),
    run(ctx, [w]) {
      const p = parsePath(ctx.sh, w ?? '/');
      if (p.error) throw new Error(`cd: ${p.error}`);
      if (p.file !== null) {
        const exists = entries(ctx.game, ctx.s, p.root, p.dir).some((e) => e.name.toLowerCase() === p.file.toLowerCase());
        throw new Error(`cd: ${w}: ${exists ? 'not a directory' : 'no such file or directory'}`);
      }
      ctx.sh.root = p.root;
      ctx.sh.dir = p.dir;
    },
  },
  ls: {
    usage: 'ls [-l] [-a] [path]', help: tl('systems.shell.list_a_folder'), more: ['-l long listing, -a includes the folders . and ..'],
    run(ctx, args) {
      const long = args.some((a) => a.startsWith('-') && a.includes('l'));
      const all = args.some((a) => a.startsWith('-') && a.includes('a'));
      const path = args.find((a) => !a.startsWith('-')) ?? '.';
      const p = parsePath(ctx.sh, path);
      if (p.error) throw new Error(`ls: ${p.error}`);
      let list = entries(ctx.game, ctx.s, p.root, p.dir);
      if (p.file !== null) {
        list = list.filter((e) => e.name.toLowerCase() === p.file.toLowerCase());
        if (!list.length) throw new Error(`ls: ${path}: no such file`);
      }
      if (all) list = [{ name: '.', kind: 'dir' }, { name: '..', kind: 'dir' }, ...list];
      if (!list.length) return;
      if (long) {
        out(ctx.sh, `total ${list.reduce((n, e) => n + (e.size ?? 0), 0)}`, 'dim');
        list.forEach((e) => longLine(ctx.sh, e, ctx.game));
        return;
      }
      // names in columns, as many as fit a line
      const cell = Math.max(...list.map((e) => e.name.length + (e.kind === 'dir' ? 1 : 0))) + 2;
      const per = Math.max(Math.floor(WIDTH / cell), 1);
      for (let i = 0; i < list.length; i += per) {
        segs(ctx.sh, list.slice(i, i + per).map((e) => [pad(e.name + (e.kind === 'dir' ? '/' : ''), cell), toneOf(e)]));
      }
    },
  },
  cat: {
    usage: 'cat <file>', help: tl('systems.shell.show_a_file_or'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: cat <file>');
      const { e } = target(ctx, w);
      if (e.kind === 'dir') throw new Error(`cat: ${w}: is a directory`);
      if (e.daily) {
        out(ctx.sh, `-- ${e.name} // ${e.lines.length} entries --`, 'head');
        e.lines.forEach((l) => segs(ctx.sh, [[`${stamp(l.minute)}  `, 'dim'], [l.text, 'plain']]));
        return;
      }
      if (e.kind === 'log') {
        segs(ctx.sh, [[`[day ${day(e.minute)} ${stamp(e.minute)}] `, 'dim'], [e.text, e.loud ? 'err' : 'plain']]);
        return;
      }
      if (e.kind === 'exe') throw new Error(`cat: ${w}: binary file // try \`hexdump ${w}\``);
      if (e.enc > 0) throw new Error(`cat: ${w}: encrypted (v${e.enc}) // \`decrypt ${w}\` first`);
      const seed = hash(e.name);
      out(ctx.sh, `-- ${e.name} // ${e.size} GB --`, 'head');
      for (let i = 0; i < 5; i += 1) out(ctx.sh, `${WORDS[(seed >>> (i * 3)) % WORDS.length]}=${(Math.imul(seed, i + 7) >>> 0).toString(16).padStart(8, '0')}${(Math.imul(seed, i + 13) >>> 0).toString(16)}`, 'plain');
      out(ctx.sh, `-- ${Math.round(e.size * 1000)} more records --`, 'dim');
    },
  },
  del: {
    usage: 'del <file> | del *', help: tl('systems.shell.delete_a_file_a'),
    more: ['/files: deletes the file on the host (needs the file deleter)', '/logs: scrubs your own entries, or wipes the logs when it is not yours', '~/downloads: removes the file from your drive'],
    run(ctx, [w]) {
      if (!w) throw new Error('usage: del <file>');
      if (w === '-rf' || w === '/') throw new Error('del: it is dangerous to operate recursively on /  // you would not dare');
      const { sh, game, s } = ctx;
      // `*` takes everything in this folder
      if (w === '*') {
        if (sh.root === '/' && sh.dir === 'files') {
          let n = 0;
          entries(game, s, '/', 'files').forEach((e) => { if (!startTask(game, 'DeleteFile', e.idx)) n += 1; });
          if (!n) throw new Error('nothing could be deleted // `del <file>` gives the reason');
          out(sh, `[+] ${n} files queued for deletion`, 'ok');
          return;
        }
        if (sh.root === '/' && sh.dir === 'logs') {
          begin(ctx, 'WipeLogs', undefined, 'wiping every log on the host');
          return;
        }
        if (sh.root === '~' && sh.dir === 'downloads') {
          const n = game.player.storage.length;
          game.player.storage = [];
          out(sh, `removed ${n} files`, 'ok');
          return;
        }
        throw new Error('del: * works in /files, /logs and ~/downloads');
      }
      const { e } = target(ctx, w);
      if (e.kind === 'dir') throw new Error(`del: ${w}: is a directory`);
      if (e.kind === 'exe') throw new Error('del: apps cannot be removed from here');
      if (e.local && e.kind === 'log') throw new Error('del: your own system log is read-only');
      if (e.local) {
        game.player.storage.splice(e.idx, 1);
        out(sh, `removed ${e.name}`, 'ok');
        return;
      }
      if (e.kind === 'log') {
        if (e.mine) begin(ctx, 'ModifyLogs', undefined, 'scrubbing your entries from the log');
        else begin(ctx, 'WipeLogs', undefined, 'not your entry // wiping the whole log');
        return;
      }
      begin(ctx, 'DeleteFile', e.idx, `deleting ${e.name}`);
    },
  },
  copy: {
    usage: 'copy <file>', help: tl('systems.shell.download_a_host_file'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: copy <file>');
      const { e } = target(ctx, w, ['file']);
      if (e.local) throw new Error('copy: that file is already on your gateway');
      begin(ctx, 'CopyFile', e.idx, `downloading ${e.name} (${e.size} GB) -> ~/downloads`);
    },
  },
  decrypt: {
    usage: 'decrypt <file>', help: tl('systems.shell.open_an_encrypted_file'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: decrypt <file>');
      const { e } = target(ctx, w, ['file']);
      if (e.local) throw new Error('decrypt: pull it from the host, decrypt it there');
      if (!(e.enc > 0)) throw new Error(`decrypt: ${e.name} is not encrypted`);
      begin(ctx, 'DecryptFile', e.idx, `decrypting ${e.name} (v${e.enc})`);
    },
  },
  crack: {
    usage: 'crack [service|port|#n]', help: tl('systems.shell.break_the_password_lock'),
    run(ctx, [w]) {
      const i = serviceIndex(ctx, w);
      const v = ctx.game.world.hosts[ctx.s.target].services[i];
      begin(ctx, 'CrackPassword', i, `cracking ${v.name}:${v.port}`);
    },
  },
  hijack: {
    usage: 'hijack [service|port|#n]', help: tl('systems.shell.steal_a_live_session'),
    run(ctx, [w]) {
      const i = serviceIndex(ctx, w);
      const v = ctx.game.world.hosts[ctx.s.target].services[i];
      begin(ctx, 'HijackSession', i, `replaying a session on ${v.name}:${v.port}`);
    },
  },
  bypass: {
    usage: 'bypass fw|mon|proxy', help: tl('systems.shell.get_past_the_firewall'),
    run(ctx, [w]) {
      const kind = { fw: 'BypassFirewall', firewall: 'BypassFirewall', mon: 'BypassMonitor', monitor: 'BypassMonitor', proxy: 'BypassProxy', px: 'BypassProxy' }[(w ?? '').toLowerCase()];
      if (!kind) throw new Error('usage: bypass fw|mon|proxy');
      begin(ctx, kind, undefined, `${kind.replace('Bypass', '').toLowerCase()} bypass running`);
    },
  },
  ddos: { usage: 'ddos', help: tl('systems.shell.flood_the_host_firewall'), run: (c) => begin(c, 'Ddos', undefined, 'volumetric flood launched') },
  mapnet: { usage: 'mapnet', help: tl('systems.shell.map_the_rest_of'), run: (c) => begin(c, 'MapNetwork', undefined, 'mapping the network') },
  probe: { usage: 'probe', help: tl('systems.shell.harvest_service_account_keys'), run: (c) => begin(c, 'ProbeIam', undefined, 'harvesting service-account keys') },
  escalate: { usage: 'escalate', help: tl('systems.shell.kernel_privilege_escalation_opens'), run: (c) => begin(c, 'EscalateKernel', undefined, 'escalating to root') },
  wipe: { usage: 'wipe', help: tl('systems.shell.wipe_every_log_on'), run: (c) => begin(c, 'WipeLogs', undefined, 'wiping every log on the host') },
  scrub: { usage: 'scrub', help: tl('systems.shell.remove_only_your_own'), run: (c) => begin(c, 'ModifyLogs', undefined, 'scrubbing your entries from the log') },
  nmap: {
    usage: 'nmap', help: tl('systems.shell.port_scan_the_services'),
    run(ctx) {
      const h = ctx.game.world.hosts[ctx.s.target];
      const { sh } = ctx;
      out(sh, `Starting nmap 7.94 ( https://nmap.org ) at day ${day(ctx.game.clock.minutes)} ${stamp(ctx.game.clock.minutes)}`, 'dim');
      out(sh, `Nmap scan report for ${h.name} (${h.ip})`, 'head');
      out(sh, `Host is up (${(0.012 + ctx.s.route.length * 0.018).toFixed(3)}s latency).`, 'plain');
      out(sh, 'PORT       STATE     SERVICE', 'info');
      h.services.forEach((v, i) => {
        segs(sh, [[pad(`${v.port}/tcp`, 11), 'plain'], [pad(v.open ? 'open' : 'filtered', 10), v.open ? 'ok' : 'err'], [`${v.name}${v.open ? '' : `  (lock v${v.password}) #${i + 1}`}`, 'plain']]);
      });
      out(sh, `guards: firewall ${h.firewall}  monitor ${h.monitor}  proxy ${h.proxy}${ctx.s.fwBypassed ? '  [fw down]' : ''}${ctx.s.monBypassed ? '  [mon blind]' : ''}`, 'info');
      out(sh, 'Nmap done: 1 IP address (1 host up) scanned', 'dim');
    },
  },
  ps: {
    usage: 'ps', help: tl('systems.shell.the_tasks_running_on'),
    run(ctx) {
      const { sh, s } = ctx;
      if (!s.tasks.length) {
        out(sh, 'no tasks running', 'dim');
        return;
      }
      out(sh, '  PID  STAT  PROGRESS                        TASK', 'info');
      s.tasks.forEach((t, i) => segs(sh, [[`${pad(1000 + i, 6)}${pad('R', 6)}`, 'dim'], [`${bar(t.progress, 20)} ${pad(`${Math.round(t.progress * 100)}%`, 5)}`, 'ok'], [t.label, 'plain']]));
    },
  },
  trace: {
    usage: 'trace', help: tl('systems.shell.how_close_the_trace'),
    run(ctx) {
      const { s, game, sh } = ctx;
      const warn = traceWarnAt(game);
      segs(sh, [['TRACE ', 'info'], [bar(s.trace, 30), s.trace > 0.75 ? 'err' : s.trace > 0.4 ? 'info' : 'ok'], [` ${Math.round(s.trace * 100)}%  warns at ${Math.round(warn * 100)}%`, 'plain']]);
      out(sh, s.alerted ? `[!] the host is tracing you  rate ${(s.traceRate * 100).toFixed(2)}%/s` : '[i] no alarm raised yet', s.alerted ? 'err' : 'dim');
    },
  },
  top: {
    usage: 'top', help: tl('systems.shell.link_load_heat_trace'),
    run(ctx) {
      const { game, s, sh } = ctx;
      const cap = storage(game.player.gateway);
      out(sh, `top - ${stamp(game.clock.minutes)} up ${Math.floor((s.online ?? 0) / 60)}m ${Math.floor((s.online ?? 0) % 60)}s, ${s.tasks.length} tasks`, 'head');
      segs(sh, [['HEAT   ', 'info'], [bar(game.player.heat / 100, 28), game.player.heat > 70 ? 'err' : 'ok'], [` ${Math.round(game.player.heat)}%`, 'plain']]);
      segs(sh, [['TRACE  ', 'info'], [bar(s.trace, 28), s.trace > 0.6 ? 'err' : 'ok'], [` ${Math.round(s.trace * 100)}%`, 'plain']]);
      segs(sh, [['DRIVE  ', 'info'], [bar(storageUsed(game) / cap, 28), 'ok'], [` ${storageUsed(game)}/${cap} GB`, 'plain']]);
      segs(sh, [['LINK   ', 'info'], [bar(Math.min(copyRate(game.player.gateway) / 40, 1), 28), 'ok'], [` ${copyRate(game.player.gateway).toFixed(1)} GB/s`, 'plain']]);
    },
  },
  netstat: {
    usage: 'netstat', help: tl('systems.shell.the_live_connections_the'),
    run(ctx) {
      const { game, s, sh } = ctx;
      out(sh, 'Proto  Local Address          Foreign Address        State', 'info');
      const hops = [...s.route, s.target].map((id) => game.world.hosts[id]);
      hops.forEach((h, i) => out(sh, `tcp    ${pad(`${game.player.gateway.ip}:${40000 + i}`, 22)}${pad(`${h.ip}:443`, 23)}ESTABLISHED`, i === hops.length - 1 ? 'ok' : 'plain'));
    },
  },
  traceroute: {
    usage: 'traceroute', help: tl('systems.shell.the_hops_your_link'),
    run(ctx) {
      const { game, s, sh } = ctx;
      const hops = [...s.route, s.target].map((id) => game.world.hosts[id]);
      out(sh, `traceroute to ${hops.at(-1).ip}, ${hops.length} hops max`, 'head');
      hops.forEach((h, i) => out(sh, `${pad(i + 1, 3)} ${pad(h.ip, 17)}${pad(h.name.slice(0, 24), 26)}${(4 + (hash(h.ip) % 30) + i * 11).toFixed(1)} ms`, 'plain'));
    },
  },
  ping: {
    usage: 'ping', help: tl('systems.shell.ping_the_host'),
    run(ctx) {
      const { game, s, sh } = ctx;
      const h = game.world.hosts[s.target];
      out(sh, `PING ${h.ip} (${h.name}) 56(84) bytes of data.`, 'head');
      for (let i = 0; i < 4; i += 1) out(sh, `64 bytes from ${h.ip}: icmp_seq=${i + 1} ttl=${64 - s.route.length} time=${(12 + s.route.length * 18 + ((hash(h.ip) >>> i) % 9)).toFixed(1)} ms`, 'plain');
      out(sh, '--- 4 packets transmitted, 4 received, 0% packet loss', 'dim');
    },
  },
  hexdump: {
    usage: 'hexdump <file>', help: tl('systems.shell.a_hex_dump_of'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: hexdump <file>');
      const { e } = target(ctx, w);
      if (e.kind === 'dir') throw new Error(`hexdump: ${w}: is a directory`);
      hexdump(ctx.sh, e.name, e.enc > 0 ? 6 : 8);
      if (e.enc > 0) out(ctx.sh, `[!] high entropy: ${e.name} is encrypted (v${e.enc})`, 'err');
    },
  },
  strings: {
    usage: 'strings <file>', help: tl('systems.shell.readable_strings_found_in'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: strings <file>');
      const { e } = target(ctx, w);
      if (e.enc > 0) {
        out(ctx.sh, `${e.name}: nothing readable // the data is encrypted`, 'dim');
        return;
      }
      const seed = hash(e.name);
      for (let i = 0; i < 6; i += 1) out(ctx.sh, `${WORDS[(seed >>> i) % WORDS.length]}${i % 2 ? '' : `=${(seed >>> (i + 3)).toString(36)}`}`, 'plain');
    },
  },
  file: {
    usage: 'file <file>', help: tl('systems.shell.what_kind_of_file'),
    run(ctx, [w]) {
      if (!w) throw new Error('usage: file <file>');
      const { e } = target(ctx, w);
      const what = e.kind === 'dir' ? 'directory' : e.kind === 'log' ? 'ASCII text, log entry' : e.kind === 'exe' ? `ELF 64-bit executable, version ${e.level}` : e.enc > 0 ? `data, encrypted v${e.enc}` : 'ASCII text, database dump';
      out(ctx.sh, `${e.name}: ${what}`, 'plain');
    },
  },
  df: {
    usage: 'df', help: tl('systems.shell.drive_usage_on_your'),
    run(ctx) {
      const { game, sh } = ctx;
      const g = game.player.gateway;
      const used = storageUsed(game);
      out(sh, 'Filesystem      Size    Used   Avail  Use%  Mounted on', 'info');
      if (sharedDrive(g)) {
        const cap = storage(g);
        out(sh, `C: gateway     ${pad(`${cap}G`, 7)} ${pad(`${used}G`, 7)}${pad(`${cap - used}G`, 7)}${pad(`${Math.round((used / cap) * 100)}%`, 6)}~`, 'plain');
        out(sh, `  of which apps ${appsUsed(game)}G, downloads ${used - appsUsed(game)}G (one drive, shared)`, 'dim');
        return;
      }
      const sys = systemCap(g);
      const dl = downloadCap(g);
      out(sh, `C: system      ${pad(`${sys}G`, 7)} ${pad(`${appsUsed(game)}G`, 7)}${pad(`${sys - appsUsed(game)}G`, 7)}${pad(`${Math.round((appsUsed(game) / sys) * 100)}%`, 6)}~/apps`, 'plain');
      out(sh, `D: storage     ${pad(`${dl}G`, 7)} ${pad(`${used - appsUsed(game)}G`, 7)}${pad(`${dl - (used - appsUsed(game))}G`, 7)}${pad(`${Math.round(((used - appsUsed(game)) / dl) * 100)}%`, 6)}~/downloads`, 'plain');
    },
  },
  whoami: {
    usage: 'whoami', help: tl('systems.shell.who_you_are'),
    run(ctx) {
      const p = ctx.game.player;
      out(ctx.sh, `${p.handle.toLowerCase()}  //  ${rankName(p.rating)}  //  rating ${p.rating}  //  heat ${Math.round(p.heat)}`, 'plain');
    },
  },
  id: { usage: 'id', help: tl('systems.shell.your_uid_on_the'), run: (c) => out(c.sh, `uid=${c.s.fwBypassed ? 0 : 1001}(${c.s.fwBypassed ? 'root' : 'svc-guest'}) gid=0(wheel) groups=0(wheel),27(sudo)`, 'plain') },
  uname: {
    usage: 'uname [-a]', help: tl('systems.shell.the_host_kernel'),
    run(ctx) {
      const h = ctx.game.world.hosts[ctx.s.target];
      out(ctx.sh, `Linux ${h.name.toLowerCase().replace(/\s+/g, '-')} 5.15.0-blackgate #1 SMP PREEMPT x86_64 GNU/Linux`, 'plain');
    },
  },
  ifconfig: {
    usage: 'ifconfig', help: tl('systems.shell.your_gateway_interface'),
    run(ctx) {
      const g = ctx.game.player.gateway;
      out(ctx.sh, 'tun0: flags=4305<UP,POINTOPOINT,RUNNING>  mtu 1500', 'head');
      out(ctx.sh, `      inet ${g.ip}  netmask 255.255.255.255  destination ${ctx.game.world.hosts[ctx.s.target].ip}`, 'plain');
      out(ctx.sh, `      RX/TX through ${ctx.s.route.length} hops  //  spoofed MAC 02:${(hash(g.ip) & 0xff).toString(16).padStart(2, '0')}:de:ad:be:ef`, 'dim');
    },
  },
  sysinfo: {
    usage: 'sysinfo', help: tl('systems.shell.your_rig_in_the'),
    run(ctx) {
      const { game, sh } = ctx;
      const p = game.player;
      const art = ['  ___ _      _   ', ' | _ ) |    /_\\  ', ' | _ \\ |__ / _ \\ ', ' |___/____/_/ \\_\\', '', ''];
      const info = [`${p.handle.toLowerCase()}@blackgate`, `rank   ${rankName(p.rating)}`, `drive  ${storageUsed(game)}/${storage(p.gateway)} GB`, `tools  ${p.tools.length} installed`, `heat   ${Math.round(p.heat)}%`, `route  ${ctx.s.route.length} hops`];
      art.forEach((a, i) => segs(sh, [[pad(a, 22), 'head'], [info[i] ?? '', i === 0 ? 'ok' : 'plain']]));
    },
  },
  burn: {
    usage: 'burn', help: tl('systems.shell.panic_button_drop_every'),
    run(ctx) {
      const err = burn(ctx.game);
      if (err) throw new Error(err);
      out(ctx.sh, '[!] line burned // tasks dropped // the trace crawls', 'err');
    },
  },
  history: { usage: 'history', help: tl('systems.shell.the_commands_typed_this'), run: (c) => c.sh.history.forEach((h, i) => out(c.sh, `${pad(i + 1, 5)}${h}`, 'plain')) },
  echo: { usage: 'echo <text>', help: tl('systems.shell.print_text'), run: (c, a) => out(c.sh, a.join(' '), 'plain') },
  date: { usage: 'date', help: tl('systems.shell.game_time'), run: (c) => out(c.sh, `day ${day(c.game.clock.minutes)}  ${stamp(c.game.clock.minutes)}`, 'plain') },
  clear: { usage: 'clear', help: tl('systems.shell.clear_the_screen'), run: (c) => { c.sh.lines = []; } },
  sudo: { usage: 'sudo <command>', help: tl('systems.shell.nice_try'), run: (c) => out(c.sh, `${c.game.player.handle.toLowerCase()} is not in the sudoers file. This incident will be reported.`, 'err') },
  config: {
    usage: 'config cli on|off', help: tl('systems.shell.start_every_link_on'),
    run(ctx, [what, val]) {
      if (what !== 'cli' || !['on', 'off'].includes(val)) throw new Error('usage: config cli on|off');
      ctx.game.settings.cliDefault = val === 'on';
      out(ctx.sh, `CLI as the default tab: ${val}`, 'ok');
    },
  },
  exit: { usage: 'exit', help: tl('systems.shell.close_the_link'), run: (c) => { out(c.sh, 'logout // closing the link', 'info'); c.sh.want = 'disconnect'; } },
};

/// Other names for the same command.
const ALIAS = {
  rm: 'del', cp: 'copy', download: 'copy', shred: 'del', erase: 'del', unscramble: 'decrypt', ll: 'ls', dir: 'ls', type: 'cat', cls: 'clear', man: 'help', '?': 'help', quit: 'exit', logout: 'exit', disconnect: 'exit',
  services: 'nmap', scan: 'nmap', tasks: 'ps', unlock: 'crack', xxd: 'hexdump', neofetch: 'sysinfo', tracert: 'traceroute', who: 'whoami',
};

/// Runs one typed line: echoes it, runs it and prints what came of it.
export function shellRun(game, sh, line) {
  const text = line.trim();
  if (!text) return;
  sh.history.push(text);
  if (sh.history.length > 100) sh.history.shift();
  const w = words(text);
  const first = w[0].toLowerCase();
  const name = ALIAS[first] ?? first;
  const ctx = { game, s: sh.session, sh };
  sh.lines.push({ segs: [...promptOf(game, sh), [text, 'plain']] });
  try {
    const cmd = COMMANDS[name];
    if (!cmd) throw new Error(`${first}: command not found // type \`help\``);
    const args = w.slice(1);
    cmd.run(ctx, first === 'll' ? ['-l', ...args] : args);
  } catch (err) {
    out(sh, err.message, 'err');
  }
  if (sh.lines.length > 600) sh.lines.splice(0, sh.lines.length - 600);
}

/// Pulls the link log's new lines into the scrollback, so what the tasks do
/// shows up in the shell as it happens.
export function shellSync(sh) {
  const s = sh.session;
  const total = s.pushed ?? s.lines.length;
  const fresh = Math.min(total - sh.seenCount, s.lines.length);
  if (fresh > 0) {
    s.lines.slice(-fresh).forEach((l) => segs(sh, [['[link] ', 'dim'], [l, l.startsWith('>') ? 'info' : /warn|trace|alarm|intercept|honeypot/i.test(l) ? 'err' : 'ok']]));
  }
  sh.seenCount = total;
}

/// The opening banner: the handshake, as it would look on a real operator's screen.
export function shellGreet(game, sh) {
  const s = sh.session;
  const h = game.world.hosts[s.target];
  const art = [
    '  ___ _      _    ___ _  __ ___ _ _____ ___ ',
    ' | _ ) |    /_\\  / __| |/ // __| | |_   _| __|',
    ' | _ \\ |__ / _ \\| (__| \' <| (_ | |__| | | _| ',
    ' |___/____/_/ \\_\\\\___|_|\\_\\\\___|____|_| |___|',
  ];
  art.forEach((l) => out(sh, l, 'ok'));
  out(sh, ' rootshell 1.1 // authorised operators only', 'dim');
  out(sh, '', 'plain');
  out(sh, `[+] tunnel up via ${s.route.length} hop${s.route.length === 1 ? '' : 's'}`, 'ok');
  out(sh, `[+] host fingerprint: ${h.name} (${h.ip})`, 'ok');
  out(sh, `[i] guards  fw=${h.firewall}  mon=${h.monitor}  px=${h.proxy}   services=${h.services.length}   files=${h.files.filter((f) => !f.deleted).length}`, 'info');
  out(sh, '[!] every action leaves a log // wipe your tracks before you leave', 'err');
  out(sh, 'type `help` // Tab completes // `nmap` shows what to break first', 'dim');
  out(sh, '', 'plain');
  sh.greeted = true;
}

const slashStem = (stem) => stem.slice(stem.lastIndexOf('/') + 1);

/// Tab completion: the command, then the names in the folder the word points at.
export function shellComplete(game, sh, line) {
  const w = words(line);
  const fresh = line === '' || /\s$/.test(line);
  const done = fresh ? w : w.slice(0, -1);
  const stem = fresh ? '' : (w.at(-1) ?? '');
  let options;
  let prefix = '';
  if (!done.length) options = [...Object.keys(COMMANDS), ...Object.keys(ALIAS)];
  else {
    const slash = stem.lastIndexOf('/');
    prefix = slash >= 0 ? stem.slice(0, slash + 1) : '';
    const p = parsePath(sh, prefix || '.');
    options = p.error || p.file !== null ? [] : entries(game, sh.session, p.root, p.dir).map((e) => e.name + (e.kind === 'dir' ? '/' : ''));
  }
  const bare = slashStem(stem);
  const hits = options.filter((o) => o.toLowerCase().startsWith(bare.toLowerCase()));
  if (!hits.length) return { line, hits: [] };
  let common = hits[0];
  hits.forEach((x) => { while (!x.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1); });
  const word = prefix + (hits.length === 1 ? (hits[0].endsWith('/') ? hits[0] : `${hits[0]} `) : common);
  return { line: `${done.join(' ')}${done.length ? ' ' : ''}${word}`, hits: hits.length > 1 ? hits : [] };
}

/// The shell's command names, for the tests and the README.
export const SHELL_COMMANDS = Object.keys(COMMANDS);
