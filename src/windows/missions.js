// MISSION BUILDER: a cheat window that builds a job to order. The settings on
// the left; on the right, a searchable list to pick the host, file or person.
// Anything left unset is filled in the way the board would.

import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { drawScrolled } from '../ui/scroll.js';
import { drawTable, flex } from '../ui/table.js';
import { drawField } from '../ui/field.js';
import { section, label, keyValue, buttons, field, check } from '../ui/controls.js';
import { ghost, primary } from '../ui/styles.js';
import { FONT } from '../core/text.js';
import { targetsFor } from '../state/contractTarget.js';
import { jobFiles } from '../state/contractSpawn.js';
import { recordsKept, keepsRecord, recordText, RECORD_LABEL } from '../state/gameState.js';

/// The kinds the builder posts: their names on the market, and what each asks.
const KINDS = [
  ['retrieve', 'DATA HEIST', 'copy a file off the host and bring it home to your gateway'],
  ['delete', 'SCRUBBERS', 'erase one file from the host, so it never existed'],
  ['destroy', 'BURN BOOK', 'wipe the host: every file and every log on it'],
  ['modify', 'PAPERWORK', "rewrite one detail in a person's record: a death, a pardon, a promotion"],
  ['transfer', 'MONEY MOVES', 'move funds out of an account on a bank host'],
  ['model', 'MIND THEFT', 'steal a trained AI model off a lab host'],
];

/// The deadlines on offer, in hours; 0 is the board's usual.
const HOURS = [0, 6, 24, 72, 168];

const on = (flag) => (flag ? primary() : ghost());
const hoursText = (h) => (!h ? 'USUAL' : h < 24 ? `${h}H` : `${h / 24} DAY${h > 24 ? 'S' : ''}`);
const isSet = (v) => v !== undefined && v !== null;

/// Draws the builder.
export function drawMissions(ctx, sk, r, game, ui, input, events, view) {
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'build a job to order and post it to the board');
  const [left, right] = splitPanel(body, 0.52, 320);
  const kind = view.kind ?? 'retrieve';
  const h = isSet(view.host) ? game.world.hosts[view.host] : null;
  const p = isSet(view.person) ? game.world.people[view.person] : null;
  const c = [
    section('KIND'),
    buttons(KINDS.map(([k, text]) => ({ id: `mg.kind.${k}`, text, style: on(kind === k) }))),
    label(KINDS.find(([k]) => k === kind)?.[2] ?? '', FONT.body, sk.dim),
    section('TARGET'),
    keyValue('HOST', h ? `${h.name} // ${h.ip}` : 'RANDOM', h ? sk.accent : sk.dim),
    buttons([
      { id: 'mg.pick.host', text: 'CHOOSE HOST', style: on(view.pick === 'host') },
      { id: 'mg.host.random', text: 'RANDOM', style: ghost() },
    ]),
    section('OBJECTIVE'),
  ];
  if (kind === 'retrieve' || kind === 'delete') {
    c.push(keyValue('FILE', view.file ?? 'RANDOM', view.file ? sk.accent : sk.dim));
    c.push(buttons([
      { id: 'mg.pick.file', text: 'CHOOSE FILE', style: { ...on(view.pick === 'file'), disabled: !h } },
      { id: 'mg.file.random', text: 'RANDOM', style: ghost() },
    ]));
    if (!h) c.push(label('choose a host first to pick one of its files', FONT.body, sk.dim));
  } else if (kind === 'destroy') {
    c.push(label('every file and every log on the host', FONT.body, sk.dim));
  } else if (kind === 'transfer' || kind === 'model') {
    c.push(label(kind === 'transfer' ? 'the account and the amount are set by the job' : 'the model file is set by the job', FONT.body, sk.dim));
  } else {
    c.push(keyValue('PERSON', p ? p.name : 'RANDOM', p ? sk.accent : sk.dim));
    c.push(buttons([
      { id: 'mg.pick.person', text: 'CHOOSE PERSON', style: { ...on(view.pick === 'person'), disabled: !h } },
      { id: 'mg.person.random', text: 'RANDOM', style: ghost() },
    ]));
    if (h && p) {
      // the details this host keeps of this person, then the value to set
      const fields = recordsKept(game, h).filter((f) => keepsRecord(game, h, view.person, f));
      c.push(buttons(fields.map((f) => ({ id: `mg.field.${f}`, text: RECORD_LABEL[f], style: on(view.field === f) }))));
      if (view.field) {
        c.push(keyValue('NOW', recordText(game, view.field, p[view.field]), sk.dim));
        c.push(field('mg.value', view.value ?? '', view.field === 'company' ? 'the new employer, by name' : 'the new value'));
      } else c.push(label('pick a detail, or leave it for a random change', FONT.body, sk.dim));
    } else c.push(label('choose a host and a person to set the exact change', FONT.body, sk.dim));
  }
  c.push(
    section('TERMS'),
    field('mg.reward', view.reward ?? '', 'payout in credits, blank for the usual'),
    buttons(HOURS.map((n) => ({ id: `mg.hours.${n}`, text: hoursText(n), style: on((view.hours ?? 0) === n) }))),
    field('mg.client', view.client ?? '', 'client, blank for a random one'),
    section('BRIEF'),
    field('mg.brief', view.brief ?? '', 'custom brief, blank for a random one'),
    label('{file} {host} {co} are filled in and highlighted', FONT.body, sk.dim),
    check('mg.accept', 'Accept straight away', !!view.accept),
    buttons([
      { id: 'mg.spawn', text: 'SPAWN MISSION', style: primary() },
      { id: 'mg.reset', text: 'RESET', style: ghost() },
    ]),
  );
  if (view.msg) c.push(label(view.msg, FONT.body, view.ok ? sk.ok : sk.warn));
  drawScrolled(ctx, sk, left, c, 'mg.form', ui, input, events);
  drawPicker(ctx, sk, right, game, ui, input, events, view, kind, h);
}

/// The list to pick from: hosts that fit the kind, files a job could name, or
/// people the host keeps a detail of. A click picks; the search narrows it.
function drawPicker(ctx, sk, r, game, ui, input, events, view, kind, h) {
  const inner = detailPane(ctx, sk, r);
  if (!view.pick || (view.pick !== 'host' && !h)) {
    emptyNote(ctx, sk, inner, 'CHOOSE HOST, FILE or PERSON to pick from a list');
    return;
  }
  const typed = drawField(ctx, ui, sk, 'mg.search', { x: inner.x, y: inner.y, w: Math.min(inner.w, 300), h: 26 }, view.search ?? '', 'search', false, input);
  if (typed !== null) view.search = typed;
  if (ui.escFrom === 'mg.search' || (ui.focus === 'mg.search' && input.esc)) view.search = '';
  const q = (view.search ?? '').trim().toLowerCase();
  const has = (text) => !q || text.toLowerCase().includes(q);
  const co = (i) => game.world.companies[i]?.name ?? 'INDEPENDENT';
  let items = [];
  if (view.pick === 'host') {
    items = targetsFor(game, kind, { anyGuard: true }).map((id) => game.world.hosts[id])
      .filter((x) => has(`${x.name} ${x.ip} ${co(x.company)}`))
      .map((x) => [x.id, [x.name, x.ip, `${co(x.company)} // FW ${x.firewall} / MON ${x.monitor} / PX ${x.proxy}`]]);
  } else if (view.pick === 'file') {
    items = jobFiles(game, h, kind).map((i) => h.files[i]).filter((f) => has(f.name))
      .map((f) => [f.name, [f.name, `${f.size} GB`, f.enc > 0 ? `ENCRYPTED v${f.enc}` : 'PLAINTEXT']]);
  } else {
    items = game.world.people.map((x, i) => [x, i])
      .filter(([x, i]) => recordsKept(game, h).some((f) => keepsRecord(game, h, i, f)))
      .filter(([x]) => has(`${x.name} ${x.ssn} ${x.role} ${co(x.company)}`))
      .map(([x, i]) => [i, [x.name, x.ssn, `${x.role} // ${co(x.company)}`]]);
  }
  // what a click on a row picks
  view.pickOrder = items.map(([value]) => value);
  const now = { host: view.host, file: view.file, person: view.person }[view.pick];
  drawTable(ctx, sk, { x: inner.x, y: inner.y + 34, w: inner.w, h: inner.h - 34 }, {
    id: 'mg.list',
    columns: [flex('NAME', 0.62), flex('', 0.38, 'right')],
    rows: items.map(([, [a, b, line]]) => ({
      grid: true,
      cells: [
        { text: a, size: FONT.body, color: sk.text_hi, col: 0, line: 0 },
        { text: b, size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
        { text: line, size: FONT.body, color: sk.dim, col: 0, line: 1, span: true },
      ],
    })),
    selected: view.pickOrder.indexOf(now),
    rowH: 46,
    empty: q ? `nothing matches "${view.search}"` : 'nothing to pick here',
  }, ui, input, events);
}
