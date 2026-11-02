// People: the PEOPLE tab of a live link (the staff of the linked company, with
// the attacks on their phones and inboxes) and the DOSSIERS window (everyone
// on file, from anywhere). Each attack says what it needs and what it gets.

import { drawTable, flex } from '../ui/table.js';
import { splitPanel, detailPane, drawFrame } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { section, label, keyValue, buttons, chips } from '../ui/controls.js';
import { ghost, danger } from '../ui/styles.js';
import { drawPortrait, portraitOf } from '../ui/portrait.js';
import { draw as drawText } from '../core/text.js';
import { color } from '../core/theme.js';
import { taskError } from '../systems/sessionTasks.js';
import { intelText, dossiers, spammed, INTEL_FIELDS } from '../state/intel.js';
import { hasSample } from '../state/voice.js';

/// The attacks, in the order they make sense: find out, then the phone, then
/// the inbox.
export const PEOPLE_ACTIONS = [
  { kind: 'Profile', text: 'PROFILE', gets: 'OSINT: their email, role, phone, social and leaked password' },
  { kind: 'CallRecord', text: 'CALL + RECORD', gets: 'a voice recording for voice locks; leaves a call log' },
  { kind: 'SpoofCall', text: 'SPOOFED CALL', gets: 'the recording, posing as their IT desk: no log, slower' },
  { kind: 'TapPhone', text: 'TAP PHONE', gets: 'hear their calls: a password they read out opens a lock' },
  { kind: 'HackInbox', text: 'HACK INBOX', gets: 'their mail: the company hosts, colleagues, saved passwords' },
  { kind: 'Phish', text: 'PHISH', gets: 'a fake reset mail: if they bite within 3h, the inbox is yours' },
  { kind: 'Spam', text: 'SPAM', gets: 'bury their inbox for a day: if they run the host, its trace slows' },
];

/// What has been done to a person, as tags.
function status(game, i, sk) {
  const it = game.intel?.[i] ?? {};
  const tags = [];
  if (it.level) tags.push([`OSINT ${it.level}/4`, sk.accent]);
  if (hasSample(game, i)) tags.push(['VOICE', sk.ok]);
  if (it.tapped) tags.push(['TAPPED', sk.ok]);
  if (it.inbox) tags.push(['INBOX HACKED', sk.ok]);
  if (it.phishAt !== undefined) tags.push(['PHISH SENT', sk.warn]);
  if (spammed(game, i)) tags.push(['SPAMMED', sk.warn]);
  return tags;
}

/// One row of a person: the name, what is known, and what has been done.
function personRow(game, i, sk) {
  const p = game.world.people[i];
  const tags = status(game, i, sk).map(([t]) => t).join(' // ');
  return {
    grid: true,
    cells: [
      { text: p.name, size: 10.5, color: sk.text_hi, col: 0, line: 0 },
      { text: `CLEARANCE ${p.clearance}`, size: 9.5, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: `${intelText(game, i, 'role')} // ${game.world.companies[p.company]?.name ?? ''}`, size: 9, color: sk.dim, col: 0, line: 1 },
      { text: `${intelText(game, i, 'email')} // ${intelText(game, i, 'phone')}`, size: 9, color: sk.text, col: 0, line: 2 },
      { text: tags || 'LEAD', size: 9, color: tags ? sk.ok : sk.dim, align: 'right', col: 1, line: 2 },
    ],
  };
}

/// The detail of a person: the portrait, the dossier, then the attacks. With
/// no live link to their company, the attacks say where to go.
function drawDossier(ctx, sk, r, game, i, s, ui, input, events, scrollId, view = {}) {
  const inner = detailPane(ctx, sk, r);
  const p = game.world.people[i];
  const co = game.world.companies[p.company]?.name ?? 'their company';
  const w = Math.min(inner.w, 110);
  const face = { x: inner.x, y: inner.y, w, h: Math.round(w * 1.2) };
  drawPortrait(ctx, sk, face, portraitOf(game, i), p.sex);
  drawText(ctx, p.name, face.x + w + 12, face.y + 4, 13, color(sk.text_hi));
  drawText(ctx, co, face.x + w + 12, face.y + 26, 10, color(sk.dim));
  drawText(ctx, `CLEARANCE ${p.clearance}`, face.x + w + 12, face.y + 46, 10, color(sk.dim));
  const controls = [
    section('DOSSIER'),
    ...INTEL_FIELDS.map((f) => {
      const v = intelText(game, i, f.field);
      return keyValue(f.label, v, v === '???' ? sk.dim : sk.text_hi);
    }),
  ];
  const tags = status(game, i, sk);
  if (tags.length) controls.push(chips(tags));
  controls.push(section('OPERATIONS'));
  const hostCo = s?.phase === 'online' ? game.world.hosts[s.target]?.company : null;
  const here = hostCo != null && hostCo === p.company;
  if (!here) controls.push(label(`link to a host of ${co} to work on them`, 9.5, sk.warn));
  PEOPLE_ACTIONS.forEach((a) => {
    const why = here ? taskError(game, s, a.kind, i) : 'not linked';
    controls.push(buttons([{ id: `ppl.${a.kind}.${i}`, text: a.text, style: { ...ghost(), disabled: !!why } }]));
    controls.push(label(here && why ? `${a.gets} // ${why}` : a.gets, 9, here && why ? sk.warn : sk.dim));
  });
  // only the DOSSIERS window can take someone off file: twice, to be sure
  if (scrollId.startsWith('dos.')) {
    const sure = view.armed === `dos.del.${i}`;
    controls.push(section('FILE'));
    controls.push(buttons([{ id: `dos.del.${i}`, text: sure ? 'CONFIRM: REMOVE' : 'REMOVE FROM DOSSIERS', style: sure ? danger() : ghost() }]));
    controls.push(label(sure ? 'everything you know about them goes // click again' : 'forget this person: what you found goes, they can be found again', 9, sure ? sk.danger : sk.dim));
  }
  const top = face.y + face.h + 10;
  drawScrolled(ctx, sk, { x: inner.x, y: top, w: inner.w, h: Math.max(inner.y + inner.h - top, 20) }, controls, scrollId, ui, input, events);
}

/// The list and the picked person, shared by the tab and the window.
function drawPeopleList(ctx, sk, r, game, s, order, ui, input, events, view, id, empty) {
  const [list, detail] = splitPanel(r, 0.5, 280);
  view.pplOrder = order;
  if (!order.includes(view.pplSel)) view.pplSel = order[0] ?? null;
  drawTable(ctx, sk, list, {
    id,
    columns: [flex('PERSON', 0.65), flex('ACCESS', 0.35, 'right')],
    rows: order.map((i) => personRow(game, i, sk)),
    selected: order.indexOf(view.pplSel),
    rowH: 58,
    empty,
  }, ui, input, events);
  if (view.pplSel !== null) drawDossier(ctx, sk, detail, game, view.pplSel, s, ui, input, events, `${id}.detail`, view);
}

/// The PEOPLE tab: the staff of the linked host's company.
export function drawPeople(ctx, sk, r, game, s, ui, input, events, view) {
  const h = game.world.hosts[s.target];
  const co = game.world.companies[h.company]?.name ?? 'THIS HOST';
  const order = game.world.people.map((p, i) => i).filter((i) => game.world.people[i].company === h.company);
  drawText(ctx, `STAFF OF ${co.toUpperCase()} // PROFILE them, then go after their phones and inboxes`, r.x + 4, r.y + 2, 9.5, color(sk.dim));
  drawPeopleList(ctx, sk, { x: r.x, y: r.y + 24, w: r.w, h: r.h - 24 }, game, s, order, ui, input, events, view, 'sess.people', 'nobody works here');
}

/// The DOSSIERS window: everyone on file. Attacks work while linked to their company.
export function drawDossiers(ctx, sk, r, game, ui, input, events, view) {
  const order = dossiers(game);
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${order.length} people on file // an OSINT sweep adds leads, PROFILE fills them in`);
  drawPeopleList(ctx, sk, body, game, game.session, order, ui, input, events, view, 'dos.list', 'nobody on file // run an OSINT sweep, or PROFILE someone on a PEOPLE tab');
}
