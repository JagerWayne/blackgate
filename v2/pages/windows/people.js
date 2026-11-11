// People: the PEOPLE tab of a live link (the staff of the linked company, with
// the attacks on their phones and inboxes) and the DOSSIERS window (everyone
// on file, from anywhere). Each attack says what it needs and what it gets.

import { drawTable, flex } from '../ui/table.js';
import { splitPanel, detailPane, drawFrame } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { section, label, keyValue, buttons, chips, custom } from '../ui/controls.js';
import { ghost, danger, primary } from '../ui/styles.js';
import { drawField } from '../ui/field.js';
import { drawButton, hit } from '../ui/widgets.js';
import { plate, pill, usage } from '../ui/cards.js';
import { drawPortrait, portraitOf } from '../ui/portrait.js';
import { draw as drawText, ellipsize, FONT } from '../../game/core/text.js';
import { color, cssA } from '../../game/core/theme.js';
import { taskError } from '../../game/systems/sessionTasks.js';
import { intelText, dossiers, spammed, knows, INTEL_FIELDS } from '../../game/state/intel.js';
import { hasSample } from '../../game/state/voice.js';

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

/// The tabs of a profile card.
const CARD_TABS = ['DETAILS', 'ACTIONS', 'JOBS'];

/// How much of a person's dossier is filled in, 0 to 1.
function completeness(game, i) {
  return INTEL_FIELDS.filter((f) => knows(game, i, f.field)).length / INTEL_FIELDS.length;
}

/// The jobs that involve a person's company: their hosts are the targets.
function jobsAbout(game, p) {
  return game.contracts.filter((c) => game.world.hosts[c.target]?.company === p.company && ['offered', 'accepted', 'ready'].includes(c.state));
}

/// The profile card of a person: the portrait and how much is known, then
/// three tabs: the details, the attacks and the jobs that involve them. With
/// no live link to their company, the attacks say where to go.
function drawDossier(ctx, sk, r, game, i, s, ui, input, events, scrollId, view = {}) {
  const inner = detailPane(ctx, sk, r);
  const p = game.world.people[i];
  const co = game.world.companies[p.company]?.name ?? 'their company';
  const which = scrollId.startsWith('dos.') ? 'dos' : 'sess';
  // the header: portrait, name, role and company, access and how much is known
  const face = { x: inner.x, y: inner.y, w: 72, h: 88 };
  drawPortrait(ctx, sk, face, portraitOf(game, i), p.sex);
  const tx = face.x + face.w + 14;
  drawText(ctx, ellipsize(ctx, p.name, FONT.heading, inner.w - 100), tx, face.y + 2, FONT.heading, color(sk.text_hi));
  drawText(ctx, ellipsize(ctx, `${intelText(game, i, 'role')} // ${co}`, FONT.body, inner.w - 100), tx, face.y + 28, FONT.body, color(sk.dim));
  const w1 = pill(ctx, sk, tx, face.y + 54, `ACCESS ${p.clearance}`, sk.accent);
  const known = completeness(game, i);
  drawText(ctx, `${Math.round(known * 100)}% KNOWN`, tx + w1 + 12, face.y + 58, FONT.body, color(sk.dim));
  usage(ctx, sk, { x: tx, y: face.y + 82, w: Math.max(inner.w - 100, 60), h: 6 }, known, sk.ok);
  // the tabs
  const tab = Math.min(view.dTab ?? 0, CARD_TABS.length - 1);
  const ty = face.y + face.h + 10;
  let x = inner.x;
  CARD_TABS.forEach((name, n) => {
    const b = { x, y: ty, w: 92, h: 28 };
    if (drawButton(ctx, ui, sk, `pcard.${which}.${n}`, b, name, n === tab ? primary() : ghost(), input)) events.push({ type: 'click', id: `pcard.${which}.${n}` });
    x += 98;
  });
  const controls = [];
  if (tab === 0) {
    controls.push(section('DOSSIER'));
    INTEL_FIELDS.forEach((f) => {
      const v = intelText(game, i, f.field);
      controls.push(keyValue(f.label, v, v === '???' ? sk.dim : sk.text_hi));
    });
    const tags = status(game, i, sk);
    if (tags.length) controls.push(chips(tags));
  } else if (tab === 1) {
    const hostCo = s?.phase === 'online' ? game.world.hosts[s.target]?.company : null;
    const here = hostCo != null && hostCo === p.company;
    if (!here) controls.push(label(`link to a host of ${co} to work on them`, FONT.body, sk.warn));
    PEOPLE_ACTIONS.forEach((a) => {
      const why = here ? taskError(game, s, a.kind, i) : 'not linked';
      controls.push(buttons([{ id: `ppl.${a.kind}.${i}`, text: a.text, style: { ...ghost(), disabled: !!why } }]));
      controls.push(label(here && why ? `${a.gets} // ${why}` : a.gets, FONT.body, here && why ? sk.warn : sk.dim));
    });
    // only the DOSSIERS window can take someone off file: twice, to be sure
    if (which === 'dos') {
      const sure = view.armed === `dos.del.${i}`;
      controls.push(section('FILE'));
      controls.push(buttons([{ id: `dos.del.${i}`, text: sure ? 'CONFIRM: REMOVE' : 'REMOVE FROM DOSSIERS', style: sure ? danger() : ghost() }]));
      controls.push(label(sure ? 'everything you know about them goes // click again' : 'forget this person: what you found goes, they can be found again', FONT.body, sure ? sk.danger : sk.dim));
    }
  } else {
    const jobs = jobsAbout(game, p);
    controls.push(section(`JOBS ABOUT ${co.toUpperCase()}`));
    if (!jobs.length) controls.push(label('no job in hand or on offer involves this company', FONT.body, sk.dim));
    jobs.forEach((c) => controls.push(keyValue(`#${c.id} ${String(c.kind).toUpperCase()}`, `${c.state.toUpperCase()} // ${c.reward} cr`, c.state === 'offered' ? sk.warn : sk.ok)));
  }
  const top = ty + 38;
  drawScrolled(ctx, sk, { x: inner.x, y: top, w: inner.w, h: Math.max(inner.y + inner.h - top, 20) }, controls, `${scrollId}.${tab}`, ui, input, events);
}

/// The list and the picked person, shared by the tab and the window.
function drawPeopleList(ctx, sk, r, game, s, order, ui, input, events, view, id, empty) {
  const [list, detail] = splitPanel(r, 0.5, 280, { ctx, sk, ui, input, view, key: 'splitPeople' });
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

/// The ways to order the dossiers.
export const DOSSIER_SORTS = [['recent', 'RECENT'], ['name', 'NAME'], ['company', 'COMPANY'], ['access', 'ACCESS'], ['known', 'KNOWN']];

/// The people on file that match the search, in the chosen order.
export function dossierOrder(game, query = '', sort = 'recent') {
  const q = query.trim().toLowerCase();
  const co = (i) => game.world.companies[game.world.people[i].company]?.name ?? '';
  const hay = (i) => [game.world.people[i].name, co(i), intelText(game, i, 'role'), intelText(game, i, 'email')].join(' ').toLowerCase();
  const list = dossiers(game).filter((i) => !q || hay(i).includes(q));
  const name = (i) => game.world.people[i].name;
  const by = {
    recent: (a, b) => (game.intel[b].added ?? 0) - (game.intel[a].added ?? 0) || b - a,
    name: (a, b) => name(a).localeCompare(name(b)),
    company: (a, b) => co(a).localeCompare(co(b)) || name(a).localeCompare(name(b)),
    access: (a, b) => game.world.people[b].clearance - game.world.people[a].clearance || name(a).localeCompare(name(b)),
    known: (a, b) => completeness(game, b) - completeness(game, a) || name(a).localeCompare(name(b)),
  };
  return list.sort(by[sort] ?? by.recent);
}

const ROW = 66;

/// The list of people, each with a portrait; a click picks one.
function peopleList(game, order, sel, sk) {
  return custom(order.length * ROW + 6, (ctx, sk2, r, input, events) => {
    order.forEach((i, k) => {
      const p = game.world.people[i];
      const row = { x: r.x, y: r.y + k * ROW, w: r.w, h: ROW - 6 };
      const on = i === sel;
      plate(ctx, row, on ? cssA(sk.accent, 0.22) : hit(row, input) ? color(sk.raised) : color(sk.panel2), 8);
      if (on) { ctx.fillStyle = color(sk.accent); ctx.fillRect(row.x, row.y + 6, 3, row.h - 12); }
      drawPortrait(ctx, sk, { x: row.x + 10, y: row.y + 6, w: 40, h: 48 }, portraitOf(game, i), p.sex);
      drawText(ctx, ellipsize(ctx, p.name, FONT.emphasis, row.w - 150), row.x + 60, row.y + 6, FONT.emphasis, color(sk.text_hi));
      drawText(ctx, ellipsize(ctx, `${intelText(game, i, 'role')} // ${game.world.companies[p.company]?.name ?? ''}`, FONT.body, row.w - 70), row.x + 60, row.y + 26, FONT.body, color(sk.dim));
      const tags = status(game, i, sk).map(([t]) => t).join(' // ');
      drawText(ctx, ellipsize(ctx, tags || 'LEAD', FONT.body, row.w - 70), row.x + 60, row.y + 44, FONT.body, color(tags ? sk.ok : sk.dim));
      drawText(ctx, `ACCESS ${p.clearance}`, row.x + row.w - 10, row.y + 8, FONT.body, color(sk.dim), { align: 'right' });
      if (input.pressed && hit(row, input)) events.push({ type: 'click', id: `dos.pick.${i}` });
    });
  });
}

/// The DOSSIERS window: everyone on file, with a search box, a sort and a
/// profile card. Attacks work while linked to their company.
export function drawDossiers(ctx, sk, r, game, ui, input, events, view) {
  const all = dossiers(game);
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${all.length} people on file // an OSINT sweep adds leads, PROFILE fills them in`);
  // a person shown from SleekPages: search cleared, the person picked, the box ready to type in
  if (view.focusSearch) {
    ui.focus = 'dos.q';
    ui.caret = (view.q ?? '').length;
    view.focusSearch = false;
  }
  // the toolbar: the search box and the sort
  const box = { x: body.x, y: body.y, w: Math.min(Math.max(body.w * 0.34, 180), 360), h: 30 };
  const typed = drawField(ctx, ui, sk, 'dos.q', box, view.q ?? '', 'search name, company, role or email', false, input);
  if (typed !== null) view.q = typed;
  const sort = view.sort ?? 'recent';
  drawText(ctx, 'SORT', box.x + box.w + 14, box.y + 8, FONT.body, color(sk.dim));
  let x = box.x + box.w + 62;
  DOSSIER_SORTS.forEach(([key, text]) => {
    const w = Math.ceil(text.length * 8.4) + 22;
    if (x + w <= body.x + body.w && drawButton(ctx, ui, sk, `dos.sort.${key}`, { x, y: box.y, w, h: 30 }, text, key === sort ? primary() : ghost(), input)) events.push({ type: 'click', id: `dos.sort.${key}` });
    x += w + 6;
  });
  const order = dossierOrder(game, view.q ?? '', sort);
  view.pplOrder = order;
  if (!order.includes(view.pplSel)) view.pplSel = order[0] ?? null;
  const area = { x: body.x, y: body.y + 40, w: body.w, h: Math.max(body.h - 40, 60) };
  const [list, detail] = splitPanel(area, 0.42, 300, { ctx, sk, ui, input, view, key: 'splitDossier' });
  if (!order.length) {
    drawText(ctx, all.length ? 'nobody matches the search' : 'nobody on file // run an OSINT sweep, or PROFILE someone on a PEOPLE tab', list.x + 6, list.y + 8, FONT.body, color(sk.dim));
    return;
  }
  // a person just shown comes into view in the list
  if (view.scrollTo !== undefined) {
    const at = order.indexOf(view.scrollTo);
    if (at >= 0) ui.scroll.set('dos.list', Math.max(at * ROW - ROW, 0));
    view.scrollTo = undefined;
  }
  drawScrolled(ctx, sk, list, [peopleList(game, order, view.pplSel, sk)], 'dos.list', ui, input, events);
  if (view.pplSel !== null) drawDossier(ctx, sk, detail, game, view.pplSel, game.session, ui, input, events, 'dos.detail', view);
}
