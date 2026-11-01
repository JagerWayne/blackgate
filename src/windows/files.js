// STORAGE: what has been copied onto the gateway.

import { drawFrame } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { drawMeter } from '../ui/field.js';
import { ghost, solid } from '../ui/styles.js';
import { FONT } from '../core/text.js';
import * as gw from '../state/gateway.js';

/// Draws the storage window.
export function drawFiles(ctx, sk, r, game, ui, input, events) {
  const used = game.player.storage.reduce((n, f) => n + f.size, 0);
  const cap = Math.max(gw.storage(game.player.gateway), 1);
  const frac = Math.min(Math.max(used / cap, 0), 1);
  const body = drawFrame(ctx, sk, r, ui, input, events, '', 'files copied onto the gateway');

  // how full the gateway is
  const bar = { x: body.x, y: body.y, w: Math.max(body.w - 8, 20), h: 36 };
  drawMeter(ctx, sk, bar, `GATEWAY STORAGE // ${used} OF ${cap} GB`, frac, frac > 0.9 ? sk.danger : sk.accent);

  // two lines a file: its name and size, then where it came from
  const list = { x: body.x, y: body.y + 42, w: body.w, h: body.h - 42 };
  const rows = game.player.storage.map((f, i) => {
    const job = game.contracts.find((c) => c.id === f.tag && (c.state === 'accepted' || c.state === 'ready'));
    const cells = [
      { text: f.name, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
      { text: `${f.size} GB`, size: FONT.body, color: sk.warn, align: 'right', col: 1, line: 0 },
      { text: `from ${f.source} // ${f.enc > 0 ? 'ENCRYPTED' : 'PLAINTEXT'}`, size: FONT.body, color: sk.dim, col: 0, line: 1 },
    ];
    if (job) {
      cells.push({ text: job.state === 'ready' ? `JOB #${job.id} // READY` : `JOB #${job.id}`, size: FONT.body, color: job.state === 'ready' ? sk.ok : sk.accent, align: 'right', col: 1, line: 1 });
    }
    // a file that finishes a job hands it in from here; a file on a job is kept
    let actions = [{ id: `files.del.${i}`, text: 'DELETE', style: ghost() }];
    if (job) actions = job.state === 'ready' ? [{ id: `ct.submit.${job.id}`, text: 'SUBMIT WORK', style: solid() }] : undefined;
    return { grid: true, cells, marker: job?.state === 'ready' ? sk.ok : null, actions };
  });
  drawTable(ctx, sk, list, {
    id: 'files.list',
    columns: [flex('FILE', 0.7), flex('SIZE', 0.3, 'right')],
    rows,
    rowH: 46,
    empty: 'nothing staged on the gateway',
  }, ui, input, events);
}
