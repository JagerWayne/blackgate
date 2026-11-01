// SOFTWARE: the tools installed on the gate and the shop they come from.

import { drawFrame, splitPanel, detailPane } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { software, unlocks } from '../data/content.js';
import { SW_PRICE_MULT } from '../data/enums.js';
import { section, label, para, keyValue, divider, spacer, buttons as buttonRow } from '../ui/controls.js';
import { primary } from '../ui/styles.js';
import { drawScrolled } from '../ui/scroll.js';
import { FONT } from '../core/text.js';
import { versionEffect, NO_TASK } from '../state/toolEffects.js';
import { toolRam } from '../systems/sessionTasks.js';

/// Draws the software window.
export function drawSoftware(ctx, sk, r, game, ui, input, events, view) {
  const owned = game.player.tools.length;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `breakers, bypasses and the versions of each // ${owned} installed`);
  const [list, detail] = splitPanel(body, 0.44, 300);

  const tools = software();
  const picked = view.sel ?? tools[0]?.kind;
  // two lines a tool: its name and version or price, then what it does
  const rows = tools.map((d) => {
    const have = game.player.tools.find((t) => t.kind === d.kind);
    return {
      grid: true,
      cells: [
        { text: d.name, size: FONT.emphasis, color: have ? sk.text_hi : sk.text, col: 0, line: 0 },
        { text: have ? `v${have.level} INSTALLED` : `${d.price} cr`, size: FONT.body, color: have ? sk.accent : sk.warn, align: 'right', col: 1, line: 0 },
        { text: d.short, size: FONT.body, color: sk.dim, col: 0, line: 1 },
      ],
      marker: have ? sk.accent : null,
    };
  });
  drawTable(ctx, sk, list, {
    id: 'sw.list',
    columns: [flex('TOOL', 0.6), flex('OWNED', 0.4, 'right')],
    rows,
    selected: tools.findIndex((t) => t.kind === picked),
    rowH: 46,
    empty: 'nothing in the shop',
  }, ui, input, events);

  // the picked tool: what it does, every version and what it takes, the buy
  const inner = detailPane(ctx, sk, detail);
  const d = tools.find((t) => t.kind === picked);
  if (!d) return;
  const have = game.player.tools.find((t) => t.kind === d.kind)?.level ?? 0;
  const unlock = unlocks();
  const priceOf = (level) => Math.floor(d.price * SW_PRICE_MULT[level]);
  const nameOf = (level) => d.versions[level - 1] ?? `V${level}`;
  const controls = [
    label(d.name, FONT.heading, sk.text_hi),
    label(d.short, FONT.body, sk.dim),
    divider(),
    para(d.desc, FONT.body, sk.text),
    section('VERSIONS'),
  ];
  for (let level = 1; level <= 5; level += 1) {
    const need = unlock[level - 1] ?? 0;
    const state = have >= level ? 'INSTALLED' : game.player.rating < need ? `NEEDS RATING ${need}` : `${priceOf(level)} cr`;
    const tint = have >= level ? sk.ok : game.player.rating < need ? sk.dim : sk.warn;
    // the version's number and name, what it costs or needs, and what it does
    controls.push(keyValue(`V${level} ${nameOf(level)}`, state, tint));
    controls.push(label(versionEffect(d.kind, level), FONT.body, sk.dim));
  }
  // a buy button for every version above the one installed that the rating allows
  const offers = [];
  const idle = versionEffect(d.kind, 1) === NO_TASK;
  for (let level = have + 1; level <= 5; level += 1) {
    if (game.player.rating < (unlock[level - 1] ?? 0)) break;
    offers.push({
      id: `sw.buy.${d.kind}.${level}`,
      text: `${nameOf(level)} // ${priceOf(level)} cr`,
      style: { ...primary(), disabled: game.player.credits < priceOf(level) || idle },
    });
  }
  if (offers.length) {
    controls.push(spacer(8));
    controls.push(buttonRow(offers));
    if (idle) controls.push(label('not for sale: no task uses this tool yet', FONT.body, sk.warn));
  }
  controls.push(section('CPU'));
  controls.push(keyValue('RAM WHILE RUNNING', `${toolRam(d)} GB`, sk.warn));
  drawScrolled(ctx, sk, inner, controls, 'sw.detail', ui, input, events);
}
