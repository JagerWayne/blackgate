// The end of a run: the screen dims, the ending is told, and the operator can
// start again or go back to the last save.

import { draw as drawText, paragraph } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { drawButton } from '../ui/widgets.js';
import { solid, ghost } from '../ui/styles.js';

/// The title and the story of each ending.
const ENDINGS = {
  caught: [
    'TRACE COMPLETE',
    'Your route collapsed. ARCLIGHT was already inside the relay when you opened the link. '
      + 'The operator handle is burned. The gateway is evidence now.',
  ],
  raided: [
    'DOOR KICKED IN',
    'Enough residual evidence accumulated to justify a physical visit. '
      + 'They took the hardware. They took the drives. They left the chair.',
  ],
};

/// Draws the ending over the shell. The buttons push `over.again` and
/// `over.load`.
export function drawOver(ctx, sk, w, h, game, ui, input, events) {
  ctx.fillStyle = 'rgba(2,4,6,0.88)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(680, w - 32);
  const ph = Math.min(420, h - 32);
  const p = { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
  const tint = sk.danger;
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = cssA(tint, 0.9);
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
  ctx.fillStyle = color(tint);
  ctx.fillRect(p.x, p.y, p.w, 2);

  const [title, story] = ENDINGS[game.gameOver] ?? ['RUN OVER', ''];
  drawText(ctx, title, p.x + p.w / 2, p.y + 54, 22, color(tint), { align: 'center', baseline: 'middle' });
  paragraph(ctx, story, { x: p.x + 50, y: p.y + 96, width: p.w - 100 }, 12, color(sk.text));
  const s = game.stats;
  const line = `JOBS ${s.missionsDone}   FAILED ${s.missionsFailed}   BREACHES ${s.hostsBreached}   `
    + `FILES ${s.filesStolen}   EARNED ${s.earned}   RATING ${game.player.rating}`;
  drawText(ctx, line, p.x + p.w / 2, p.y + p.h - 118, 10, color(sk.dim), { align: 'center', baseline: 'middle' });

  const bw = Math.min(260, (p.w - 48) / 2);
  const by = p.y + p.h - 78;
  const again = { x: p.x + p.w / 2 - bw - 8, y: by, w: bw, h: 40 };
  const load = { x: p.x + p.w / 2 + 8, y: by, w: bw, h: 40 };
  if (drawButton(ctx, ui, sk, 'over.again', again, 'NEW CAMPAIGN', solid(), input)) {
    events.push({ type: 'click', id: 'over.again' });
  }
  if (drawButton(ctx, ui, sk, 'over.load', load, 'LOAD LAST SAVE', ghost(), input)) {
    events.push({ type: 'click', id: 'over.load' });
  }
}
