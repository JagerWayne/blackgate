// NEWSWIRE: the live ticker and the stories on the wire.

import { draw as drawText, ellipsize, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawFrame } from '../ui/panel.js';
import { drawTable, flex } from '../ui/table.js';
import { hhmm } from '../core/clock.js';

/// Draws the newswire window.
export function drawNews(ctx, sk, r, game, ui, input, events) {
  const body = drawFrame(ctx, sk, r, ui, input, events, '', `${game.news.length} stories on the wire // newest first`);

  // the ticker: the latest headline in a dark band
  const ticker = { x: body.x, y: body.y, w: body.w, h: 28 };
  ctx.fillStyle = color(sk.inset);
  ctx.fillRect(ticker.x, ticker.y, ticker.w, ticker.h);
  const last = game.news[game.news.length - 1];
  drawText(ctx, 'LIVE', ticker.x + 10, ticker.y + ticker.h / 2, 10, color(sk.warn), { baseline: 'middle' });
  drawText(ctx, ellipsize(ctx, last ? last.headline : 'the wire is quiet', 10, ticker.w - 70), ticker.x + 52, ticker.y + ticker.h / 2, 10, color(sk.inset_text), { baseline: 'middle' });

  // two lines a story: the headline with its time, then the body
  const list = { x: body.x, y: body.y + 38, w: body.w, h: body.h - 38 };
  const rows = game.news
    .slice()
    .reverse()
    .map((n) => ({
      grid: true,
      cells: [
        { text: n.headline, size: FONT.emphasis, color: sk.text_hi, col: 0, line: 0 },
        { text: hhmm({ minutes: n.minute }), size: FONT.body, color: sk.dim, align: 'right', col: 1, line: 0 },
        { text: n.body, size: FONT.body, color: sk.dim, col: 0, line: 1 },
      ],
    }));
  drawTable(ctx, sk, list, {
    id: 'news.list',
    columns: [flex('STORY', 0.86), flex('WHEN', 0.14, 'right')],
    rows,
    rowH: 46,
    empty: 'the wire is quiet',
  }, ui, input, events);
}
