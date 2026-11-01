// CONTRACTS: the board of work on offer, the jobs taken and the history.

import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { section, label, para, keyValue, chips, spacer, buttons as buttonRow } from '../ui/controls.js';
import { primary, ghost, solid, danger } from '../ui/styles.js';
import { guardTint } from '../ui/guard.js';
import { hint } from '../data/content.js';
import { contractLabel, contractItems } from '../state/contracts.js';
import { span, minutesUntil } from '../core/clock.js';
import { drawScrolled } from '../ui/scroll.js';
import { FONT } from '../core/text.js';
import { RECORD_LABEL, recordText } from '../state/gameState.js';

const KIND_COLOR = {
  retrieve: 'blue', delete: 'danger', modify: 'warn', transfer: 'ok',
  destroy: 'danger', model: 'violet', story: 'accent',
};

/// Draws the contracts window.
export function drawContracts(ctx, sk, r, game, ui, input, events, view) {
  const tab = view.ctTab ?? 0;
  const offered = game.contracts.filter((c) => c.state === 'offered').length;
  const active = game.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready').length;
  const history = game.contracts.filter((c) => ['done', 'failed', 'expired'].includes(c.state)).length;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'work offered on the network', [
    { id: 'ct.tab.0', label: 'OFFERED', count: offered },
    { id: 'ct.tab.1', label: 'ACTIVE', count: active },
    { id: 'ct.tab.2', label: 'HISTORY', count: history },
  ], tab);
  const [list, detail] = splitPanel(body, 0.42, 300);

  const items = contractItems(game, tab);
  // the pick follows the tab: one this tab does not hold falls to its first
  if (!items.some((c) => c.id === view.ctSel)) view.ctSel = items.length ? items[0].id : 0;
  const selIdx = items.findIndex((c) => c.id === view.ctSel);
  const rows = items.map((c) => {
    const left = minutesUntil(game.clock, c.deadline);
    const due = left < 240 && c.state !== 'offered' ? sk.danger : sk.dim;
    const kind = sk[KIND_COLOR[c.kind] ?? 'accent'];
    // three lines: what and how much, who and by when, the reference
    return {
      grid: true,
      cells: [
        { text: contractLabel(c), size: FONT.emphasis, color: kind, col: 0, line: 0 },
        { text: `${c.reward} cr`, size: FONT.emphasis, color: c.reward > 0 ? sk.warn : sk.dim, align: 'right', col: 1, line: 0 },
        { text: companyOf(game, c), size: FONT.body, color: sk.text_hi, col: 0, line: 1 },
        { text: span(left), size: FONT.body, color: due, align: 'right', col: 1, line: 1 },
        { text: `#${c.id} // ${c.client}`, size: FONT.body, color: sk.dim, col: 0, line: 2 },
      ],
      marker: kind,
    };
  });
  drawTable(ctx, sk, list, {
    id: `ct.list.${tab}`,
    columns: [flex('JOB', 0.66), flex('PAY', 0.34, 'right')],
    rows,
    selected: selIdx,
    rowH: 62,
    empty: 'nothing on this tab',
  }, ui, input, events);

  // the detail
  const inner = detailPane(ctx, sk, detail);
  const c = items.find((x) => x.id === view.ctSel);
  if (!c) {
    emptyNote(ctx, sk, inner, 'no contract selected');
    return;
  }
  const h = game.world.hosts[c.target];
  const left = minutesUntil(game.clock, c.deadline);
  // heading, the brief, then the terms and the target as two blocks of facts
  const controls = [
    label((game.world.companies[h.company]?.name ?? 'INDEPENDENT').toUpperCase(), FONT.heading, sk.text_hi),
    label(`${contractLabel(c)} // ${h.name} // ${h.domain}`, FONT.body, sk.dim),
    chips([[c.state.toUpperCase(), stateColor(sk, c.state)]]),
    spacer(4),
    para(c.brief, FONT.body, sk.text, true, sk.accent),
    section('TERMS'),
    keyValue('PAYMENT', `${c.reward} cr`, sk.warn),
    keyValue('DEADLINE', span(left), left < 240 ? sk.danger : sk.text),
    keyValue('CLIENT', c.client, sk.text),
    section('TARGET'),
    keyValue('HOST', h.ip, sk.accent),
    keyValue('SECURITY', `FW ${h.firewall} / MON ${h.monitor} / PX ${h.proxy}`, guardTint(sk, h)),
    keyValue('OBJECT', c.file ?? c.subject, sk.text),
    ...(c.record ? [keyValue('CHANGE', `${RECORD_LABEL[c.record.field]} \u2192 ${recordText(game, c.record.field, c.record.value)}`, sk.warn)] : []),
    spacer(10),
  ];
  if (c.state === 'offered') {
    const can = game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length < 4;
    controls.push(buttonRow([
      { id: `ct.accept.${c.id}`, text: 'ACCEPT CONTRACT', style: { ...primary(), disabled: !can, isDefault: true } },
      { id: `ct.track.${c.id}`, text: 'SHOW TARGET', style: ghost() },
      { id: `ct.decline.${c.id}`, text: 'DECLINE', style: ghost() },
    ]));
    if (!can) controls.push(label(hint('contractCapacity'), FONT.body, sk.warn));
  } else if (c.state === 'accepted' || c.state === 'ready') {
    // straight to the work: the link opens on the target through the route
    const linked = game.session?.target === c.target;
    controls.push(buttonRow([
      { id: `ct.link.${c.id}`, text: linked ? 'LINK IS OPEN' : 'OPEN THE LINK', style: { ...primary(), disabled: linked || !!game.session } },
      { id: `ct.track.${c.id}`, text: 'SHOW TARGET', style: ghost() },
      { id: `ct.submit.${c.id}`, text: 'SUBMIT WORK', style: { ...solid(), disabled: c.state !== 'ready', isDefault: true } },
      { id: `ct.drop.${c.id}`, text: 'DROP', style: danger() },
    ]));
    if (game.session && !linked) controls.push(label('disconnect the live link to open this one', FONT.body, sk.warn));
    // the work is not done yet: the button says so rather than doing nothing
    if (c.state !== 'ready') controls.push(label(hint('workNotReady'), FONT.body, sk.warn));
  }
  drawScrolled(ctx, sk, inner, controls, 'ct.detail', ui, input, events);
}

/// The company that owns a contract's target host.
function companyOf(game, c) {
  const host = c.target !== undefined ? game.world.hosts[c.target] : null;
  const company = host && host.company !== null ? host.company : 0;
  return game.world.companies[company]?.name ?? '';
}

/// The colour a contract state shows.
export function stateColor(sk, state) {
  switch (state) {
    case 'offered': return sk.dim;
    case 'accepted': return sk.warn;
    case 'ready': return sk.ok;
    default: return sk.dim;
  }
}
