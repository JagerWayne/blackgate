// GATEWAY: the chassis and what is fitted in it.

import { drawFrame, splitPanel, detailPane, sectionHead } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { section, label, keyValue, buttons } from '../ui/controls.js';
import { ghost, danger, primary } from '../ui/styles.js';
import { relocateError } from '../systems/physical.js';
import { storageUsed } from '../state/gameState.js';
import * as gw from '../state/gateway.js';
import { drawScrolled } from '../ui/scroll.js';
import { drawGatewayShop } from './gatewayShop.js';
import { measureControls } from '../ui/layout.js';
import { removePlan } from '../state/economy.js';
import { FONT } from '../core/text.js';

/// Draws the gateway window.
export function drawGateway(ctx, sk, r, game, ui, input, events, view) {
  const tab = view.tab ?? 0;
  const cats = ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security', 'gateway', 'stock'];
  const stocked = game.player.stock?.length ?? 0;
  const labels = {
    cpu: 'COMPUTE', accel: 'ACCEL', fpga: 'FPGA', hsm: 'HSM', storage: 'STORAGE', modem: 'MODEM', security: 'SECURITY', gateway: 'CHASSIS',
    stock: stocked ? `STOCK ${stocked}` : 'STOCK',
  };
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'your chassis, its parts and the supply line');
  const [left, right] = splitPanel(body, 0.44, 300);

  // -- the machine: what it is, then what it can do ---------------------------
  const g = game.player.gateway;
  const chassis = gw.chassisOf(g);
  const migrating = gw.migrating(g, game.clock.minutes);
  const controls = [
    label(chassis.name, FONT.heading, sk.text_hi),
    label(`TIER ${chassis.tier} // ${chassis.trait_name}`, FONT.body, sk.accent),
  ];
  if (migrating) {
    controls.push(label(`RECONFIGURING // ${gw.migrateLeft(g, game.clock.minutes)} MINUTES LEFT`, FONT.body, sk.warn));
  }
  // the numbers the operator checks every job, in a compact grid
  const stats = [
    ['THREAD SLOTS', String(gw.lanes(g))],
    ['CRYPTO SPEED', `${(gw.crypt(g) * gw.fpga(g)).toFixed(1)}x`],
    ['STORAGE', `${storageUsed(game)}/${gw.storage(g)} GB`],
    ['LINK', `${gw.bandwidth(g)} Mb/s`],
    ['DEFENSE SLOTS', `${gw.usedSlots(g, 'security')}/${gw.slotsFor(g, 'security')}`],
    ['CLEAN HOPS', String(gw.hops(g))],
    ['DEFENCE', gw.defense(g)],
    ['PUBLIC IP', g.ip],
  ];
  controls.push(section('MACHINE'));
  controls.push(...stats.map(([k, v]) => keyValue(k, v, sk.text)));
  // the Van can drive away from an investigation; the button says why it cannot
  if (chassis.mobile) {
    const why = relocateError(game);
    controls.push(buttons([{ id: 'gw.relocate', text: 'RELOCATE', style: { ...(why ? ghost() : primary()), disabled: !!why } }]));
    controls.push(label(why ?? 'two hours on the road; the investigation loses the trail', FONT.body, why ? sk.dim : sk.warn));
  }

  // the machine card is as tall as what it says, so no number hides under a
  // scroll; the fitted parts (and the slots they fill) list under it
  const need = measureControls(ctx, controls, Math.max(left.w - 18, 40)) + 20;
  const cardH = Math.min(Math.max(need, 150), Math.max(left.h - 150, 150));
  const inner = detailPane(ctx, sk, { x: left.x, y: left.y, w: left.w, h: cardH });
  drawScrolled(ctx, sk, inner, controls, 'gw.chassis', ui, input, events);

  const below = sectionHead(ctx, sk, { x: left.x, y: left.y + cardH + 10, w: left.w, h: left.h - cardH - 10 }, `FITTED PARTS // ${g.parts.length}`);
  const rows = g.parts.map((p, i) => {
    // an armed REMOVE says what comes back before the second click
    const id = `gw.sell.${i}`;
    const sure = view.armed === id;
    const taking = sure ? removePlan(game, i).length : 0;
    const cells = [
      { text: p.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `T${p.level}`, size: FONT.body, color: sk.accent, align: 'right', col: 1, line: 0 },
      { text: `${gw.kindLabel(p.kind)} // ${gw.usedSlots(g, p.kind)} of ${gw.slotsFor(g, p.kind)} slots`, size: FONT.body, color: sk.dim, col: 0, line: 1 },
    ];
    // an armed REMOVE says where the part goes (RAM drops to an allowed count)
    if (sure) cells.push({ text: taking > 1 ? `moves ${taking} sticks to stock` : 'moves to stock', size: FONT.body, color: sk.danger, col: 0, line: 2, span: true });
    return {
      grid: true,
      cells,
      marker: sure ? sk.danger : null,
      actions: [{ id, text: sure ? 'CONFIRM' : 'REMOVE', style: sure ? danger() : ghost() }],
    };
  });
  drawTable(ctx, sk, below, {
    id: 'gw.fitted',
    columns: [flex('FITTED', 0.76), flex('T', 0.24, 'right')],
    rows,
    rowH: 46,
    empty: 'the chassis is empty',
  }, ui, input, events);

  drawGatewayShop(ctx, sk, right, game, ui, input, events, view, tab, cats, labels);
}
