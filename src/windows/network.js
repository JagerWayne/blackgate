// CLOUD GRAPH: the segments of the company the link is in, where you are, and a
// FORGE button on each (the Kerberos forger moves the session there).

import { drawFrame } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, primary } from '../ui/styles.js';
import { FONT } from '../core/text.js';
import { graphNodes } from '../state/hud.js';
import { taskError } from '../systems/sessionTasks.js';

/// Draws the cloud graph window.
export function drawNetwork(ctx, sk, r, game, ui, input, events) {
  const s = game.session;
  const nodes = s && s.phase === 'online' ? graphNodes(game, s) : null;
  const sub = !s ? 'link to a company host to see its network'
    : nodes === null ? 'install the CLOUD GRAPH program (SOFTWARE) to draw the network'
      : `${nodes.length} segments on your map`;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', sub);
  if (!nodes) return;

  // MAP NETWORK reveals the hidden segments (the zero-trust mapper)
  const why = taskError(game, s, 'MapNetwork');
  const mapBtn = { x: body.x, y: body.y, w: 170, h: 28 };
  if (drawButton(ctx, ui, sk, 'net.map', mapBtn, 'MAP NETWORK', why ? ghost() : primary(), input) && !why) {
    events.push({ type: 'click', id: 'net.map' });
  }
  const list = { x: body.x, y: body.y + 38, w: body.w, h: body.h - 38 };
  const rows = nodes.map((n) => {
    const reason = n.here ? '' : taskError(game, s, 'ForgeTicket', n.id) ?? '';
    const cells = [
      { text: n.name, size: FONT.emphasis, color: n.here ? sk.accent : sk.text_hi, col: 0, line: 0 },
      { text: n.ip, size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
      { text: `${n.internal ? 'INTERNAL SEGMENT' : 'FRONT'} // DIFFICULTY ${n.difficulty}${n.here ? ' // YOU ARE HERE' : ''}`, size: FONT.body, color: n.internal ? sk.warn : sk.dim, col: 0, line: 1 },
    ];
    if (reason) cells.push({ text: reason, size: FONT.body, color: sk.warn, col: 0, line: 2 });
    return {
      grid: true,
      cells,
      marker: n.here ? sk.accent : null,
      actions: n.here ? undefined : [{ id: `net.forge.${n.id}`, text: 'FORGE', style: { ...ghost(), disabled: !!reason } }],
    };
  });
  drawTable(ctx, sk, list, {
    id: 'net.nodes',
    columns: [flex('SEGMENT', 0.7), flex('ADDRESS', 0.3, 'right')],
    rows,
    rowH: 62,
    empty: 'no segment of this company is on your map',
  }, ui, input, events);
}
