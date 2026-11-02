// The supply line: the parts and the chassis on sale.

import { drawFrame } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { primary, danger, ghost } from '../ui/styles.js';
import { stockPlan } from '../state/economy.js';
import { chassisDef, componentsOf, hint } from '../data/content.js';
import { FONT, wrapLines } from '../core/text.js';
import * as gw from '../state/gateway.js';

/// Draws the shop half of the gateway window.
export function drawGatewayShop(ctx, sk, r, game, ui, input, events, view, tab, cats, labels) {
  const g = game.player.gateway;
  const migrating = gw.migrating(g, game.clock.minutes);
  const listBody = drawFrame(ctx, sk, r, ui, input, events, '', `SUPPLY LINE // ${game.player.credits} cr to spend`, cats.map((c, i) => ({
    id: `gw.tab.${i}`, label: labels[c],
  })), tab);
  const cat = cats[tab];
  const rows = cat === 'gateway'
    ? chassisRows(sk, game, g, migrating, view.armed)
    : cat === 'stock'
      ? stockRows(sk, game, view.armed)
      : componentRows(ctx, listBody.w - 160, sk, game, g, cat, migrating, view.armed);
  drawTable(ctx, sk, listBody, {
    id: `gw.shop.${tab}`,
    columns: [flex('PART', 0.66), flex('PRICE', 0.34, 'right')],
    rows,
    rowH: 62,
    empty: cat === 'stock' ? 'nothing in stock: parts you take out land here' : 'nothing in this category',
  }, ui, input, events);
}

/// Three lines a chassis: name and price, what it is, its trait. A chassis
/// that cannot be migrated to says why.
function chassisRows(sk, game, g, migrating, armed) {
  return allChassis().map((d) => {
    const fitted = d.tier === g.chassis;
    const why = fitted ? '' : blockReason(game, g, migrating, d.price, 'gateway');
    const cells = [
      { text: d.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${d.price} cr`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: d.note, size: FONT.body, color: sk.dim, col: 0, line: 1 },
      { text: d.trait_name, size: FONT.body, color: sk.accent, col: 0, line: 2 },
    ];
    if (fitted) cells.push({ text: 'FITTED', size: FONT.body, color: sk.accent, align: 'right', col: 1, line: 1 });
    else if (why) cells.push({ text: why, size: FONT.body, color: sk.warn, col: 0, line: 3 });
    // an armed MIGRATE says what it costs before the second click
    const id = `gw.chassis.${d.tier}`;
    const ready = armed === id && !why;
    if (ready) cells.push({ text: `down ${d.migration ?? 0} min; extra parts are lost`, size: FONT.body, color: sk.danger, col: 0, line: 3, span: true });
    const row = { grid: true, cells, marker: ready ? sk.danger : fitted ? sk.accent : null };
    if (!fitted && d.tier > g.chassis) {
      row.actions = [{ id, text: ready ? 'CONFIRM MIGRATE' : 'MIGRATE', style: ready ? danger() : { ...primary(), disabled: !!why } }];
    }
    return row;
  });
}

/// Three lines a part: name and price, what it does, what it is. The row
/// says how many of it are fitted, what a click adds, and what it takes out
/// to stock; one that cannot be fitted says why.
function componentRows(ctx, wrapW, sk, game, g, cat, migrating, armed) {
  return componentsOf(cat).map((d) => {
    const count = gw.partsOf(g, cat).filter((p) => p.level === d.tier).length;
    const plan = gw.fitPlan(g, d);
    const cost = d.price * Math.max(plan.add, 1);
    const why = plan.why || blockReason(game, g, migrating, cost, cat);
    const id = `gw.buy.${cat}.${d.tier}`;
    const swap = plan.out.length > 0;
    const sure = armed === id && !why && swap;
    const stat = cat === 'cpu'
      ? `${d.multiplier}x crypt // ${d.lanes} lanes`
      : cat === 'ram'
        ? `${d.memory} GB // ${d.buffer_speed} MT/s // ${gw.ramSpeedOf(d.tier).toFixed(2)}x speed`
        : cat === 'storage'
          ? `${d.capacity >= 1024 ? `${d.capacity / 1024} TB` : `${d.capacity} GB`} of drive space`
        : cat === 'modem'
          ? `${d.bandwidth} Mb/s // ${d.hops} hops`
          : `trace delay ${d.trace_delay} // +${Math.round(d.raid_shield * 100)}% shield`;
    const cells = [
      { text: d.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${d.price} cr`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: stat, size: FONT.body, color: sk.accent, col: 0, line: 1 },
      { text: d.note, size: FONT.body, color: sk.dim, col: 0, line: 2 },
    ];
    if (count) cells.push({ text: `FITTED ${count}`, size: FONT.body, color: sk.accent, align: 'right', col: 1, line: 1 });
    // what the part does, when the catalogue says: wrapped lines under the note
    const effect = d.effect ? wrapLines(ctx, d.effect, FONT.body, Math.max(wrapW, 120)) : [];
    effect.forEach((text, i) => cells.push({ text, size: FONT.body, color: sk.text, col: 0, line: 3 + i, span: true }));
    const last = 3 + effect.length;
    if (why) {
      // a full set of this model is not a problem to warn about, only a fact
      cells.push({ text: why, size: FONT.body, color: count && plan.why ? sk.dim : sk.warn, col: 0, line: last });
    } else if (swap) {
      const names = plan.out.length > 1 ? `${plan.out.length}x ${plan.out[0].name}` : plan.out[0].name;
      cells.push({ text: `${sure ? 'moves' : hint('swapOut')} ${names}${sure ? ' to stock' : ''}`, size: FONT.body, color: sure ? sk.danger : sk.warn, col: 0, line: last, span: sure });
    } else if (plan.add > 1) {
      cells.push({ text: `adds ${plan.add} sticks // ${cost} cr`, size: FONT.body, color: sk.warn, col: 0, line: last });
    }
    const row = { grid: true, cells, marker: sure ? sk.danger : count ? sk.accent : null };
    // a full set of the fitted model has nothing to buy: no button
    if (!(count && plan.why)) {
      const text = sure ? 'CONFIRM SWAP' : swap ? 'SWAP' : plan.add > 1 ? `ADD ${plan.add}` : 'FIT';
      row.actions = [{ id, text, style: sure ? danger() : { ...primary(), disabled: !!why } }];
    }
    return row;
  });
}

/// Two lines a stocked part: its name and what it sells for, then its kind
/// and why it cannot go back in. FIT puts it back for free; SELL takes two
/// clicks.
function stockRows(sk, game, armed) {
  return (game.player.stock ?? []).map((s, i) => {
    const { why } = stockPlan(game, i);
    const sellId = `gw.stock.sell.${i}`;
    const sure = armed === sellId;
    const cells = [
      { text: s.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${s.value} cr`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: `${gw.kindLabel(s.kind)} // TIER ${s.level}`, size: FONT.body, color: sk.accent, col: 0, line: 1 },
      { text: `sells for ${s.value} cr (${s.pct}%)`, size: FONT.body, color: sure ? sk.danger : sk.dim, col: 0, line: 2 },
    ];
    if (why) cells.push({ text: why, size: FONT.body, color: sk.warn, col: 0, line: 3 });
    return {
      grid: true,
      cells,
      marker: sure ? sk.danger : null,
      actions: [
        { id: `gw.stock.fit.${i}`, text: 'FIT', style: { ...primary(), disabled: !!why } },
        { id: sellId, text: sure ? 'CONFIRM SELL' : 'SELL', style: sure ? danger() : ghost() },
      ],
    };
  });
}

/// Why a part cannot be bought right now, or '' when it can. The machine
/// being reconfigured comes first: nothing can be fitted while it is down.
function blockReason(game, g, migrating, price, cat) {
  if (migrating) return hint('migrating');
  if (game.player.credits < price) return hint('noCredits');
  void cat;
  void g;
  return '';
}

/// The whole chassis catalogue.
function allChassis() {
  const out = [];
  for (let t = 1; t <= 8; t += 1) {
    const d = chassisDef(t);
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= 8) break;
  }
  return out.sort((a, b) => a.tier - b.tier);
}
