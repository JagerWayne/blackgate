// The XP frame: the header along the top.

import { draw as drawText, measure, FONT } from '../core/text.js';
import { color } from '../core/theme.js';
import { logo } from './backdrop.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, primary } from '../ui/styles.js';
import { rankName } from '../core/theme.js';
import { hhmm, weekday, dateLine, day } from '../core/clock.js';
import { hit } from '../ui/kit.js';
import { timeScale } from '../state/cheats.js';
import { band } from '../systems/physical.js';

import { HEADER_H } from '../state/desk.js';

export { HEADER_H, BAR_H } from '../state/desk.js';

// the desktop and the taskbar live in their own file
export { drawDesktop, drawTaskbar, drawToasts } from './shellBar.js';

/// The header: the brand, the operator, the money and the clock.
export function drawHeader(ctx, game, sk, r, ui, input, events) {
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h - 0.5);
  ctx.lineTo(r.x + r.w, r.y + r.h - 0.5);
  ctx.stroke();

  // the cluster on the right is measured first: the rest has to stop short
  const active = game.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready').length;
  const unread = game.mail.filter((m) => !m.read).length;
  const showActive = r.w >= 520;
  const showMail = r.w >= 660;
  const showSpeed = r.w >= 340;
  let clusterW = 30;
  if (showSpeed) clusterW += 70;
  if (showActive) clusterW += 130;
  if (showMail) clusterW += 130;
  const clusterLeft = r.x + r.w - 12 - clusterW;
  const limit = clusterLeft - 12;

  // the logo is the way into the cheat menu: it lights up under the pointer
  const lb = { x: r.x + 8, y: r.y + 8, w: 38, h: HEADER_H - 16 };
  if (hit(lb, input)) {
    ctx.fillStyle = color(sk.accent_dim);
    ctx.fillRect(lb.x, lb.y, lb.w, lb.h);
    if (input.pressed) events.push({ type: 'click', id: 'hdr.cheat' });
  }
  logo(ctx, r.x + 27, r.y + HEADER_H / 2, 30, sk);
  let x = r.x + 50;
  // the brand takes the room of its wider line, so the next block clears it
  const brandW = Math.max(measure(ctx, 'BLACKGATE', FONT.emphasis), measure(ctx, 'NEXUS OPERATIONS', FONT.body)) + 18;
  if (x + brandW <= limit) {
    drawText(ctx, 'BLACKGATE', x, r.y + 19, FONT.emphasis, color(sk.text_hi), { baseline: 'middle' });
    drawText(ctx, 'NEXUS OPERATIONS', x, r.y + 39, FONT.body, color(sk.dim), { baseline: 'middle' });
    x += brandW;
  }

  const rank = rankName(game.player.rating);
  const hw = Math.max(measure(ctx, game.player.handle, FONT.emphasis), measure(ctx, rank, FONT.body)) + 20;
  if (x + hw <= limit) {
    drawText(ctx, game.player.handle, x, r.y + 19, FONT.emphasis, color(sk.text_hi), { baseline: 'middle' });
    drawText(ctx, rank, x, r.y + 39, FONT.body, color(sk.accent), { baseline: 'middle' });
    x += hw;
  }
  const credits = String(game.player.credits);
  const cw = Math.max(measure(ctx, credits, FONT.emphasis), measure(ctx, 'CREDITS', FONT.body)) + 38;
  if (x + cw <= limit) {
    drawText(ctx, credits, x + 22, r.y + 19, FONT.emphasis, color(sk.text_hi), { baseline: 'middle' });
    drawText(ctx, 'CREDITS', x + 22, r.y + 39, FONT.body, color(sk.dim), { baseline: 'middle' });
    x += cw;
  }
  const rating = String(game.player.rating);
  const rw = Math.max(measure(ctx, rating, FONT.emphasis), measure(ctx, 'RATING', FONT.body)) + 38;
  if (x + rw <= limit) {
    drawText(ctx, rating, x + 22, r.y + 19, FONT.emphasis, color(sk.text_hi), { baseline: 'middle' });
    drawText(ctx, 'RATING', x + 22, r.y + 39, FONT.body, color(sk.dim), { baseline: 'middle' });
    x += rw;
  }
  if (x + 170 <= limit) {
    // the perimeter sensors turn the label into the band they read
    const bandNow = band(game);
    const bandLabel = { green: 'HEAT // CLEAR', yellow: 'HEAT // RECON', red: `BREACH // ${Math.ceil(game.raid?.left ?? 0)}s` }[bandNow];
    drawText(ctx, bandLabel ?? 'HEAT', x, r.y + 17, FONT.body, color(bandNow === 'red' ? sk.danger : bandNow === 'yellow' ? sk.warn : sk.dim), { baseline: 'middle' });
    const heat = Math.min(Math.max(game.player.heat / 100, 0), 1);
    const hc = heat > 0.75 ? sk.danger : heat > 0.4 ? sk.warn : sk.accent;
    // the track is a groove the same colour as every other meter's
    ctx.fillStyle = color(sk.track);
    ctx.fillRect(x, r.y + 28, 130, 10);
    ctx.fillStyle = color(hc);
    ctx.fillRect(x, r.y + 28, 130 * heat, 10);
    ctx.strokeStyle = color(sk.line);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, r.y + 28.5, 129, 9);
    drawText(ctx, String(Math.round(game.player.heat)), x + 138, r.y + 33, FONT.body, color(sk.dim), { baseline: 'middle' });
    x += 170;
  }
  const clock = hhmm(game.clock);
  const date = `${weekday(game.clock)} ${dateLine(game.clock)} // DAY ${day(game.clock) + 1}`;
  const kw = Math.max(measure(ctx, clock, FONT.emphasis), measure(ctx, date, FONT.body)) + 12;
  if (x + kw <= limit) {
    drawText(ctx, clock, x, r.y + 19, FONT.emphasis, color(sk.text_hi), { baseline: 'middle' });
    drawText(ctx, date, x, r.y + 39, FONT.body, color(sk.dim), { baseline: 'middle' });
  }

  // the cluster
  let bx = clusterLeft;
  if (showSpeed) {
    const sp = { x: bx, y: r.y + 14, w: 58, h: 28 };
    const scale = timeScale(game);
    if (drawButton(ctx, ui, sk, 'hdr.speed', sp, `${scale}x`, scale > 1 ? primary() : ghost(), input)) {
      events.push({ type: 'click', id: 'hdr.speed' });
    }
    bx += 70;
  }
  const pb = { x: bx, y: r.y + 14, w: 28, h: 28 };
  if (drawButton(ctx, ui, sk, 'hdr.pause', pb, game.paused ? '\u25B6' : '\u2016', ghost(), input)) {
    game.paused = !game.paused;
  }
  bx += 38;
  if (showActive) {
    const ab = { x: bx, y: r.y + 14, w: 118, h: 28 };
    if (drawButton(ctx, ui, sk, 'hdr.contracts', ab, `ACTIVE ${active}`, ghost(), input)) {
      events.push({ type: 'click', id: 'hdr.contracts' });
    }
    bx += 130;
  }
  // unread mail is where new work arrives: it lights up while there is some
  if (showMail) {
    const mb = { x: bx, y: r.y + 14, w: 118, h: 28 };
    if (drawButton(ctx, ui, sk, 'hdr.mail', mb, `MAIL ${unread}`, unread ? primary() : ghost(), input)) {
      events.push({ type: 'click', id: 'hdr.mail' });
    }
  }
}
