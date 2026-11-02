// The tabs of the remote-control client: the services, the files and the logs.

import { drawTable, flex } from '../ui/table.js';
import { draw as drawText } from '../core/text.js';
import { color } from '../core/theme.js';
import { ghost, primary } from '../ui/styles.js';
import { drawField } from '../ui/field.js';
import { splitPanel, detailPane } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { keyValue } from '../ui/controls.js';
import { drawPortrait, portraitOf } from '../ui/portrait.js';
import { SERVICE_LABEL } from '../data/enums.js';
import { taskError } from '../systems/sessionTasks.js';
import { toolLevel, storageUsed, recordsKept, keepsRecord, recordText, RECORD_LABEL } from '../state/gameState.js';
import { storage } from '../state/gateway.js';
import { voiceAdmin, hasSample } from '../state/voice.js';

/// The services tab: two lines a service, its port and lock, then its kind.
/// A service that cannot be cracked says why.
export function drawAccess(ctx, sk, r, game, s, ui, input, events) {
  const mine = toolLevel(game, 'PasswordCracker');
  const goal = alterations(game, s).length > 0;
  const rows = game.world.hosts[s.target].services.map((svc, i) => {
    const voice = svc.kind === 'voice';
    const who = voice ? voiceAdmin(game, game.world.hosts[s.target]) : null;
    const sampled = who !== null && hasSample(game, who);
    // a voice lock is opened by a recording: call the admin, then play it back
    const step = sampled ? 'PlayVoiceprint' : 'RecordVoice';
    const why = svc.open ? '' : taskError(game, s, voice ? step : 'CrackPassword', i) ?? '';
    const cells = [
      { text: `${svc.name}:${svc.port}`, size: 10.5, color: svc.open ? sk.ok : sk.text_hi, col: 0, line: 0 },
      { text: svc.open ? 'OPEN' : `LOCK v${svc.password}`, size: 9.5, color: svc.open ? sk.ok : sk.warn, align: 'right', col: 1, line: 0 },
      { text: SERVICE_LABEL[svc.kind] ?? '', size: 9, color: sk.dim, col: 0, line: 1 },
    ];
    // the lock beside the breaker that has to beat it
    if (!svc.open && voice) {
      const lvl = toolLevel(game, 'VoiceAnalyser');
      const admin = who === null ? 'NO ADMIN' : `ADMIN ${game.world.people[who].name.toUpperCase()}${sampled ? ' // RECORDED' : ''}`;
      // the admin's name takes the place of the kind: a voice lock says so in its name
      cells[2] = { text: admin, size: 9, color: sampled ? sk.ok : sk.dim, col: 0, line: 1 };
      cells.push({ text: `YOUR ANALYSER v${lvl}`, size: 9, color: lvl >= svc.password ? sk.ok : sk.danger, align: 'right', col: 1, line: 1 });
    } else if (!svc.open) {
      cells.push({ text: `YOUR BREAKER v${mine}`, size: 9, color: mine >= svc.password ? sk.ok : sk.danger, align: 'right', col: 1, line: 1 });
    }
    if (why) cells.push({ text: why, size: 9, color: sk.warn, col: 0, line: 2 });
    // an ALTERATION job needs this service open
    const objective = goal && svc.kind === 'records';
    if (objective) cells.push({ text: 'OBJECTIVE', size: 9, color: sk.accent, align: 'right', col: 1, line: 2 });
    return {
      grid: true,
      cells,
      marker: svc.open ? sk.ok : objective ? sk.accent : null,
      actions: svc.open ? undefined : [voice
        ? { id: sampled ? `sess.voice.${i}` : `sess.record.${i}`, text: sampled ? 'VOICEPRINT' : 'RECORD', style: { ...ghost(), disabled: !!why } }
        : { id: `sess.crack.${i}`, text: 'CRACK', style: { ...ghost(), disabled: !!why } }],
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

/// The files tab: two lines a file, its name and size, then its encryption.
/// A file that cannot be copied or burned says why.
export function drawFiles(ctx, sk, r, game, s, ui, input, events) {
  const h = game.world.hosts[s.target];
  // the room left on the gateway, over the list of what could fill it
  const cap = storage(game.player.gateway);
  const free = Math.max(cap - storageUsed(game), 0);
  drawText(ctx, `GATEWAY // ${free} GB FREE OF ${cap}`, r.x + 4, r.y + 2, 9.5, color(free > 0 ? sk.dim : sk.danger));
  const listR = { x: r.x, y: r.y + 24, w: r.w, h: Math.max(r.h - 24, 20) };
  // the files a job in hand asks for
  const wanted = new Set(game.contracts
    .filter((c) => c.target === s.target && (c.state === 'accepted' || c.state === 'ready') && c.file)
    .map((c) => c.file));
  const rows = h.files
    .map((f, i) => [f, i])
    .filter(([f]) => !f.deleted)
    .map(([f, i]) => {
      const copyWhy = taskError(game, s, 'CopyFile', i) ?? '';
      const delWhy = taskError(game, s, 'DeleteFile', i) ?? '';
      const goal = wanted.has(f.name);
      const cells = [
        { text: f.name, size: 10.5, color: sk.text_hi, col: 0, line: 0 },
        { text: `${f.size} GB`, size: 9.5, color: f.size > free ? sk.danger : sk.warn, align: 'right', col: 1, line: 0 },
        { text: f.enc > 0 ? `ENCRYPTED v${f.enc}` : 'PLAINTEXT', size: 9, color: f.enc > 0 ? sk.danger : sk.dim, col: 0, line: 1 },
      ];
      if (goal) cells.push({ text: 'OBJECTIVE', size: 9, color: sk.accent, align: 'right', col: 1, line: 1 });
      if (copyWhy) cells.push({ text: copyWhy, size: 9, color: sk.warn, col: 0, line: 2 });
      if (delWhy && delWhy !== copyWhy) {
        cells.push({ text: delWhy, size: 9, color: sk.warn, col: 0, line: copyWhy ? 3 : 2 });
      }
      return {
        grid: true,
        cells,
        marker: goal ? sk.accent : null,
        actions: [
          // an encrypted file has to be opened before it can be taken
          ...(f.enc > 0 ? [{ id: `sess.decrypt.${i}`, text: 'DECRYPT', style: { ...ghost(), disabled: !!taskError(game, s, 'DecryptFile', i) } }] : []),
          { id: `sess.copy.${i}`, text: 'COPY', style: { ...ghost(), disabled: !!copyWhy } },
          { id: `sess.del.${i}`, text: 'BURN', style: { ...ghost(), disabled: !!delWhy } },
        ],
      };
    });
  drawTable(ctx, sk, listR, {
    id: 'sess.files',
    columns: [flex('FILE', 0.65), flex('SIZE', 0.35, 'right')],
    rows,
    rowH: 46,
    empty: 'no files',
  }, ui, input, events);
}

/// The logs tab: what the host wrote down, newest first.
export function drawLogs(ctx, sk, r, game, s, ui, input, events) {
  const h = game.world.hosts[s.target];
  const rows = h.logs.slice(-120).reverse().map((l) => ({
    grid: true,
    cells: [
      { text: stamp(l.minute), size: 9.5, color: sk.dim, col: 0, line: 0 },
      { text: l.ip, size: 9.5, color: sk.accent, col: 1, line: 0 },
      { text: l.text, size: 9.5, color: l.loud ? sk.danger : sk.text, col: 2, line: 0 },
    ],
    marker: l.loud ? sk.danger : null,
  }));
  // the wipe lives in the panel on the left: the note says so
  const footH = rows.length ? 22 : 0;
  drawTable(ctx, sk, { x: r.x, y: r.y, w: r.w, h: Math.max(r.h - footH, 20) }, {
    id: 'sess.logs',
    columns: [flex('WHEN', 0.16), flex('ADDRESS', 0.34), flex('ENTRY', 0.5)],
    rows,
    rowH: 30,
    empty: 'the host has written nothing down',
  }, ui, input, events);
  if (footH) {
    drawText(ctx, 'wipe them from HOST ACTIONS on the left', r.x + 4, r.y + r.h - 18, 9, color(sk.dim));
  }
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
  const [list, detail] = splitPanel({ x: r.x, y: r.y + 34, w: r.w, h: r.h - 34 }, 0.6, 280);
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
    cells.push({ text: 'OBJECTIVE', size: 9, color: sk.accent, align: 'right', col: 1, line: 1 });
    if (why) cells.push({ text: why, size: 9, color: sk.warn, align: 'right', col: 1, line: 2 });
    return {
      grid: true,
      cells,
      marker: sk.accent,
      actions: [{ id: `sess.alter.${job.id}`, text: `ALTER \u2192 ${recordText(game, job.record.field, job.record.value)}`, style: { ...primary(), disabled: !!why } }],
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
