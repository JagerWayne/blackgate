// MAIL: the list of messages on the left, the one that is picked on the right.

import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { drawScrolled } from '../ui/scroll.js';
import { section, label, para, keyValue, spacer, buttons as buttonRow, divider } from '../ui/controls.js';
import { primary, ghost } from '../ui/styles.js';
import { contractLabel } from '../state/contracts.js';
import { hint } from '../data/content.js';
import { FONT } from '../core/text.js';

/// Draws the mail window.
export function drawMail(ctx, sk, r, game, ui, input, events, view) {
  const unread = game.mail.filter((m) => !m.read).length;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${unread} unread // ${game.mail.length} messages`);
  const [list, read] = splitPanel(body, 0.42, 300);
  const mails = game.mail.slice().sort((a, b) => b.minute - a.minute);
  // the reader opens on the newest message
  if (view.mailSel === undefined || view.mailSel === null) {
    view.mailSel = mails.length ? mails[0].id : 0;
  }
  const selIdx = mails.findIndex((m) => m.id === view.mailSel);
  // who and when, then the subject across the whole row, then the job's state
  const rows = mails.map((m) => {
    const from = m.from.split('<')[0].trim();
    const job = m.contract ? game.contracts.find((c) => c.id === m.contract) : null;
    const cells = [
      { text: from, size: FONT.body, color: sk.dim, col: 0, line: 0 },
      { text: `DAY ${dayOf(m.minute)} ${clockOf(m.minute)}`, size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: m.subject, size: FONT.emphasis, color: m.read ? sk.text : sk.text_hi, col: 0, line: 1, span: true },
    ];
    if (job) cells.push({ text: job.state.toUpperCase(), size: FONT.body, color: sk.accent, col: 0, line: 2 });
    return { grid: true, cells, marker: m.read ? null : sk.accent };
  });
  drawTable(ctx, sk, list, {
    id: 'mail.list',
    columns: [flex('FROM', 0.52), flex('WHEN', 0.48, 'right')],
    rows,
    selected: selIdx,
    rowH: 46,
    empty: 'no mail',
  }, ui, input, events);

  // the reader
  const inner = detailPane(ctx, sk, read);
  const m = mails.find((x) => x.id === view.mailSel);
  if (!m) {
    emptyNote(ctx, sk, inner, 'no message selected');
    return;
  }
  m.read = true;
  const contract = m.contract ? game.contracts.find((c) => c.id === m.contract) : null;
  const controls = [
    ...(unread ? [buttonRow([{ id: 'mail.readAll', text: 'MARK ALL READ', style: ghost() }])] : []),
    label(m.subject, FONT.heading, sk.text_hi),
    label(`${m.from}   //   DAY ${dayOf(m.minute)} ${clockOf(m.minute)}`, FONT.body, sk.dim),
    divider(),
    para(m.body, FONT.body, sk.text, true, sk.accent),
  ];
  if (contract) {
    controls.push(section('CONTRACT'));
    controls.push(keyValue('JOB', contractLabel(contract), sk.accent));
    controls.push(keyValue('PAYMENT', `${contract.reward} cr`, sk.warn));
    controls.push(keyValue('STATE', contract.state.toUpperCase(), sk.text));
    controls.push(spacer(10));
    if (contract.state === 'offered') {
      // the board takes four jobs at a time; the button says so when it is full
      const can = game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length < 4;
      controls.push(buttonRow([
        { id: `mail.accept.${contract.id}`, text: 'ACCEPT', style: { ...primary(), disabled: !can } },
        { id: `mail.track.${contract.id}`, text: 'SHOW TARGET', style: ghost() },
        { id: `mail.decline.${contract.id}`, text: 'DECLINE', style: ghost() },
      ]));
      if (!can) controls.push(label(hint('contractCapacity'), FONT.body, sk.warn));
    } else if (contract.state === 'accepted' || contract.state === 'ready') {
      controls.push(buttonRow([{ id: `mail.track.${contract.id}`, text: 'SHOW TARGET', style: ghost() }]));
    }
  }
  drawScrolled(ctx, sk, inner, controls, 'mail.read', ui, input, events);
}

/// The day of the run a minute falls on, from 1.
function dayOf(minute) {
  return Math.floor(minute / 1440) + 1;
}

/// The time of day a minute falls on.
function clockOf(minute) {
  const m = minute % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
