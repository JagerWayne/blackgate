// The tabs of the remote-control client: the services, the files and the logs.

import { drawTable, flex } from '../ui/table.js';
import { drawExplorer } from '../ui/explorer.js';
import { draw as drawText } from '../../game/core/text.js';
import { color } from '../../game/core/theme.js';
import { primary } from '../ui/styles.js';
import { drawField } from '../ui/field.js';
import { splitPanel, detailPane } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { keyValue } from '../ui/controls.js';
import { drawPortrait, portraitOf } from '../ui/portrait.js';
import { SERVICE_LABEL } from '../../game/data/enums.js';
import { taskError } from '../../game/systems/sessionTasks.js';
import { toolName } from '../../game/state/toolEffects.js';
import { toolLevel, storageUsed, recordsKept, keepsRecord, recordText, RECORD_LABEL } from '../../game/state/gameState.js';
import { hasHsm, downloadCap } from '../../game/state/gateway.js';
import { downloadFree } from '../../game/state/gameHelpers.js';
import { authOf, AUTH_LABEL, AUTH_LEVEL } from '../../game/data/auth.js';
import { copyRate } from '../../game/state/transfer.js';
import { voiceAdmin, hasSample } from '../../game/state/voice.js';
import { t as tl } from '../../game/data/language.js';

/// The services tab: two lines a service, its port and lock, then its kind.
/// A service that cannot be cracked says why.
export function drawAccess(ctx, sk, r, game, s, ui, input, events) {
  const mine = toolLevel(game, 'PasswordCracker');
  const rows = game.world.hosts[s.target].services.map((svc, i) => {
    const voice = svc.kind === 'voice';
    const who = voice ? voiceAdmin(game, game.world.hosts[s.target]) : null;
    const sampled = who !== null && hasSample(game, who);
    // a voice lock is opened by a recording: call the admin, then play it back
    const step = sampled ? 'PlayVoiceprint' : 'RecordVoice';
    // behind MFA the way in is the session, not the password
    const auth = authOf(svc);
    const mfa = auth === 'mfa' || auth === 'session';
    const why = svc.open ? '' : taskError(game, s, voice ? step : mfa ? 'HijackSession' : 'CrackPassword', i) ?? '';
    const lockText = mfa ? AUTH_LABEL[auth] : auth === 'token' ? `TOKEN // LOCK v${svc.password}` : `LOCK v${svc.password}`;
    const cells = [
      { text: `${svc.name}:${svc.port}`, size: 10.5, color: svc.open ? sk.ok : sk.text_hi, col: 0, line: 0 },
      { text: svc.open ? (svc.tokenLeft === undefined ? 'OPEN' : `TOKEN ${Math.ceil(svc.tokenLeft)}s`) : lockText, size: 9.5, color: svc.open ? (svc.tokenLeft !== undefined && svc.tokenLeft < 10 ? sk.danger : sk.ok) : sk.warn, align: 'right', col: 1, line: 0 },
      { text: SERVICE_LABEL[svc.kind] ?? '', size: 9, color: sk.dim, col: 0, line: 1 },
    ];
    // the lock beside the breaker that has to beat it
    if (!svc.open && voice) {
      const lvl = toolLevel(game, 'VoiceAnalyser');
      const admin = who === null ? 'NO ADMIN' : `ADMIN ${game.world.people[who].name.toUpperCase()}${sampled ? ' // RECORDED' : ''}`;
      // the admin's name takes the place of the kind: a voice lock says so in its name
      cells[2] = { text: admin, size: 9, color: sampled ? sk.ok : sk.dim, col: 0, line: 1 };
      cells.push({ text: `YOUR VOICE COPIER v${lvl}`, size: 9, color: lvl >= svc.password ? sk.ok : sk.danger, align: 'right', col: 1, line: 1 });
    } else if (!svc.open && mfa) {
      const lvl = toolLevel(game, 'SessionHijacker');
      cells.push({ text: `YOUR LOGIN BYPASS v${lvl}`, size: 9, color: lvl >= AUTH_LEVEL[auth] ? sk.ok : sk.danger, align: 'right', col: 1, line: 1 });
    } else if (!svc.open) {
      const hsm = auth === 'token' ? ` // HSM ${hasHsm(game.player.gateway) ? 'FITTED' : 'MISSING'}` : '';
      cells.push({ text: `YOUR BREAKER v${mine}${hsm}`, size: 9, color: mine >= svc.password && (auth !== 'token' || hasHsm(game.player.gateway)) ? sk.ok : sk.danger, align: 'right', col: 1, line: 1 });
    }
    if (why) cells.push({ text: why, size: 9, color: sk.warn, col: 0, line: 2 });
    // an ALTERATION job needs this service open
    return {
      grid: true,
      cells,
      marker: svc.open ? sk.ok : null,
      // a right click on a service offers what opens its lock
      hint: tl('windows.sessionTabs.sess_svc', i),
      menu: () => lockMenu(game, s, svc, i, { voice, sampled, mfa, auth }),
    };
  });
  drawTable(ctx, sk, r, {
    id: 'sess.services',
    columns: [flex('SERVICE', 0.65), flex('STATE', 0.35, 'right')],
    rows,
    rowH: 46,
    empty: 'no services',
  }, ui, input, events);
}

/// The menu of a right click on a service: the one app that opens its lock, with
/// the lock's version against the installed one.
export function lockMenu(game, s, svc, i, { voice, sampled, mfa, auth }) {
  if (svc.open) return [{ text: 'service already open' }];
  const [tool, task, id, text, need] = voice
    ? ['VoiceAnalyser', sampled ? 'PlayVoiceprint' : 'RecordVoice', sampled ? `sess.voice.${i}` : `sess.record.${i}`, sampled ? 'Play the voiceprint' : "Record the admin's voice", svc.password]
    : mfa
      ? ['SessionHijacker', 'HijackSession', `sess.hijack.${i}`, 'Hijack the session', AUTH_LEVEL[auth]]
      : ['PasswordCracker', 'CrackPassword', `sess.crack.${i}`, 'Crack the password', svc.password];
  const have = toolLevel(game, tool);
  if (!have) return [{ text: `install the ${toolName(tool)} first: get it in the App Store` }];
  return [{ id, text, note: `LOCK v${need} // YOURS v${have}`, why: taskError(game, s, task, i) ?? undefined }];
}

/// The menu of a right click on a file: copy, delete and, when it is encrypted,
/// decrypt; each only when its app is installed.
export function fileMenu(game, s, f, i) {
  const items = [['FileCopier', 'CopyFile', 'sess.copy', 'Copy to my computer'], ['FileDeleter', 'DeleteFile', 'sess.del', 'Delete the file'], ...(f.enc > 0 ? [['Decrypter', 'DecryptFile', 'sess.decrypt', 'Decrypt the file']] : [])]
    .filter(([tool]) => toolLevel(game, tool) > 0)
    .map(([, task, id, text]) => ({ id: `${id}.${i}`, text, why: taskError(game, s, task, i) ?? undefined }));
  return items.length ? items : [{ text: 'no file app installed: get one in the App Store' }];
}

/// The menu of a right click on a log: wipe them all, or only the operator's own.
export function logMenu(game, s) {
  const items = [['LogDeleter', 'WipeLogs', 'Delete all logs'], ['LogModifier', 'ModifyLogs', 'Scrub my own logs']]
    .filter(([tool]) => toolLevel(game, tool) > 0)
    .map(([, task, text]) => ({ id: `sess.task.${task}`, text, why: taskError(game, s, task) ?? undefined }));
  return items.length ? items : [{ text: 'no log app installed: get one in the App Store' }];
}

/// The explorer view the storage tab keeps in the window's state: the folder
/// it is in and the file picked.
function viewOf(view) {
  return ((view.xf ??= {}).files ??= { folder: 'files', sel: null });
}

/// The host as a small file explorer: a `files` folder and a `logs` folder.
/// A file that cannot be copied or burned says why in the status bar.
function drawHost(ctx, sk, r, game, s, ui, input, events, view) {
  const h = game.world.hosts[s.target];
  const free = Math.max(downloadFree(game), 0);
  const rate = copyRate(game.player.gateway);
  const files = h.files
    .map((f, i) => [f, i])
    .filter(([f]) => !f.deleted)
    .map(([f, i]) => {
      const copyWhy = taskError(game, s, 'CopyFile', i) ?? '';
      const delWhy = taskError(game, s, 'DeleteFile', i) ?? '';
      const slow = f.size > free || f.size / rate > (s.windowLeft ?? Infinity);
      return {
        key: `f${i}`,
        name: f.name,
        kind: 'file',
        // the seconds a copy takes: red when the host's window shuts first
        detail: `${f.enc > 0 ? `ENCRYPTED v${f.enc}` : 'PLAINTEXT'} // ${Math.ceil(f.size / rate)}s to copy`,
        detailTint: slow ? sk.danger : f.enc > 0 ? sk.warn : undefined,
        size: `${f.size} GB`,
        note: [copyWhy && `copy: ${copyWhy}`, delWhy && delWhy !== copyWhy && `delete: ${delWhy}`].filter(Boolean).join(' // ') || undefined,
        // a right click on a file offers copy, delete and, when it is encrypted, decrypt
        menu: () => fileMenu(game, s, f, i),
      };
    });
  // what the host wrote down, newest first
  const logs = h.logs.slice(-120).reverse().map((l, i) => ({
    key: `l${i}`,
    name: `${stamp(l.minute)}.log`,
    kind: 'log',
    detail: `${l.ip} // ${l.text}`,
    detailTint: l.loud ? sk.danger : undefined,
    size: '',
    marker: l.loud ? sk.danger : null,
    menu: () => logMenu(game, s),
  }));
  drawExplorer(ctx, sk, r, ui, input, events, {
    id: 'sess.x',
    root: `${h.name} (${h.ip})`,
    status: { text: `GATEWAY // ${free} GB FREE OF ${downloadCap(game.player.gateway)} // ${rate.toFixed(1)} GB/s`, tint: free > 0 ? sk.dim : sk.danger },
    folders: [
      { id: 'files', name: 'files', items: files, empty: 'no files' },
      { id: 'logs', name: 'logs', items: logs, empty: 'the host has written nothing down // wipe logs with an app from INSTALLED APPS' },
    ],
  }, viewOf(view));
}

/// The storage tab: the host as a file explorer.
export function drawFiles(ctx, sk, r, game, s, ui, input, events, view = {}) {
  drawHost(ctx, sk, r, game, s, ui, input, events, view);
}

/// The time of day a log line was written at.
function stamp(minute) {
  const m = minute % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/// The ALTERATION jobs in hand on this link's host.
function alterations(game, s) {
  return game.contracts.filter((c) => c.kind === 'modify' && c.state === 'accepted' && c.target === s.target && c.record);
}

/// The records tab: the people this host keeps a field of, three lines each,
/// the job's person first with the one ALTER button. Locked, it says how in.
export function drawRecords(ctx, sk, r, game, s, ui, input, events, view = {}) {
  const h = game.world.hosts[s.target];
  const kept = recordsKept(game, h);
  const open = h.services.some((v) => v.kind === 'records' && v.open);
  const note = !kept.length ? 'this host keeps no records' : !open ? 'records service locked // crack records:8443 on the ACCESS tab' : '';
  if (note) {
    drawText(ctx, note, r.x + 4, r.y + 2, 9.5, color(kept.length ? sk.warn : sk.dim));
    return;
  }
  // the search box, the same as the map's: Escape clears it
  const typed = drawField(ctx, ui, sk, 'rec.search', { x: r.x, y: r.y, w: Math.min(r.w, 320), h: 26 }, view.recQuery ?? '', 'search name, SSN, role, employer', false, input);
  if (typed !== null) view.recQuery = typed;
  if (ui.escFrom === 'rec.search' || (ui.focus === 'rec.search' && input.esc)) view.recQuery = '';
  const q = (view.recQuery ?? '').trim().toLowerCase();
  const matches = (p) => !q || `${p.name} ${p.ssn} ${p.role} ${game.world.companies[p.company]?.name ?? ''}`.toLowerCase().includes(q);
  const [list, detail] = splitPanel({ x: r.x, y: r.y + 34, w: r.w, h: r.h - 34 }, 0.6, 280, { ctx, sk, ui, input, view, key: 'splitRecords' });
  const jobs = alterations(game, s);
  const isGoal = (i) => jobs.some((c) => c.record.person === i);
  const tint = (v) => (v === 'DECEASED' ? sk.danger : v === 'ACTIVE' ? sk.ok : v === 'CLEAN' ? sk.dim : sk.warn);
  // lines 1 and 2 already show the name, the SSN, the role and the employer
  const shown = ['name', 'ssn', 'role', 'company'];
  const order = game.world.people.map((p, i) => i)
    .filter((i) => kept.some((f) => keepsRecord(game, h, i, f)) && matches(game.world.people[i]))
    .sort((a, b) => isGoal(b) - isGoal(a));
  const rows = order.map((i) => {
    const p = game.world.people[i];
    const job = jobs.find((c) => c.record.person === i);
    const rest = kept.filter((f) => !shown.includes(f) && keepsRecord(game, h, i, f));
    const cells = [
      { text: p.name, size: 10.5, color: sk.text_hi, col: 0, line: 0 },
      { text: p.ssn, size: 9.5, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: `${p.role} // ${game.world.companies[p.company]?.name ?? ''}`, size: 9, color: sk.dim, col: 0, line: 1 },
      { text: rest.map((f) => `${RECORD_LABEL[f]} ${recordText(game, f, p[f])}`).join(' // '), size: 9, color: tint(p.status === 'DECEASED' ? 'DECEASED' : p.criminalRecord), col: 0, line: 2 },
    ];
    if (!job) return { grid: true, cells };
    const why = taskError(game, s, 'AlterRecord', job.record) ?? '';
    if (why) cells.push({ text: why, size: 9, color: sk.warn, align: 'right', col: 1, line: 2 });
    return {
      grid: true,
      cells,
      marker: sk.accent,
      actions: [{ id: `sess.alter.${job.id}`, text: tl('windows.sessionTabs.alter', recordText(game, job.record.field, job.record.value)), style: { ...primary(), disabled: !!why } }],
    };
  });
  // the rows a click picks from, and the person picked (the first, at first)
  view.recOrder = order;
  if (!order.includes(view.recSel)) view.recSel = order[0] ?? null;
  drawTable(ctx, sk, list, {
    id: 'sess.records',
    columns: [flex('PERSON', 0.65), flex('SSN', 0.35, 'right')],
    rows,
    selected: order.indexOf(view.recSel),
    rowH: 58,
    empty: q ? `nothing matches "${view.recQuery}"` : 'no records',
  }, ui, input, events);
  if (view.recSel !== null) drawPerson(ctx, sk, detail, game, view.recSel, ui, input, events);
}

/// The picked person: the portrait, then every detail on record.
function drawPerson(ctx, sk, r, game, i, ui, input, events) {
  const inner = detailPane(ctx, sk, r);
  const p = game.world.people[i];
  const w = Math.min(inner.w, 180);
  const face = { x: inner.x, y: inner.y, w, h: Math.round(w * 1.2) };
  drawPortrait(ctx, sk, face, portraitOf(game, i), p.sex);
  const fields = ['name', 'sex', 'ssn', 'status', 'criminalRecord', 'company', 'role', 'clearance', 'email', 'social'];
  const controls = fields.map((f) => keyValue(RECORD_LABEL[f], recordText(game, f, p[f]), f === 'status' && p.status === 'DECEASED' ? sk.danger : sk.text));
  drawScrolled(ctx, sk, { x: inner.x, y: face.y + face.h + 10, w: inner.w, h: Math.max(inner.y + inner.h - face.y - face.h - 10, 20) }, controls, 'rec.person', ui, input, events);
}
