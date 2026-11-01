// The welcome screen, drawn after the Windows XP one: dark bands top and
// bottom, the lighter blue field between, the mark and the hint on the left
// of the divider, the users on the right, and "Turn off computer" bottom left.

import { draw as drawText, ellipsize } from '../core/text.js';
import { logo } from './backdrop.js';
import { drawButton } from '../ui/widgets.js';
import { roundRect } from '../ui/kit.js';
import { drawLoginBody } from './loginBody.js';
import { drawUsers, SANS, BARE } from './loginUsers.js';

export function makeLogin() {
  return { handle: '', sel: 0, slots: [], error: '', notice: '', confirmDelete: false };
}

/// The whole screen.
export function drawLogin(ctx, st, sk, w, h, input, ui, events) {
  const topH = Math.round(Math.max(44, h * 0.12));
  const botH = Math.round(Math.max(56, h * 0.13));
  const midY = topH + 2;
  const midH = h - topH - botH - 4;

  ctx.fillStyle = '#5a7edc';
  ctx.fillRect(0, midY, w, midH);
  // the soft light in the upper left of the field
  const glow = ctx.createRadialGradient(w * 0.18, midY, 0, w * 0.18, midY, Math.max(w * 0.45, 200));
  glow.addColorStop(0, 'rgba(160,190,245,0.85)');
  glow.addColorStop(1, 'rgba(90,126,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, midY, w, midH);

  ctx.fillStyle = '#00309c';
  ctx.fillRect(0, 0, w, topH);
  ctx.fillRect(0, h - botH, w, botH);
  band(ctx, topH, w, ['#00309c', '#9bb8f0', '#ffffff', '#9bb8f0', '#00309c']);
  band(ctx, h - botH - 2, w, ['#00309c', '#f8b048', '#fcd28a', '#f8b048', '#00309c']);

  // the divider down the middle, faded at both ends
  const cx = Math.round(w / 2);
  const dv = ctx.createLinearGradient(0, midY + 20, 0, midY + midH - 20);
  dv.addColorStop(0, 'rgba(255,255,255,0)');
  dv.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  dv.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = dv;
  ctx.fillRect(cx, midY + 20, 1, midH - 40);

  // left of the divider: the mark, the name and the hint, set against it
  const big = w >= 900 && midH >= 360;
  const ly = midY + midH / 2;
  const rx = cx - (big ? 32 : 16);
  const mark = big ? 72 : 48;
  const hint = big ? 15 : 12;
  logo(ctx, rx - mark / 2, ly - (big ? 70 : 50), mark, { accent: 0xffffff });
  drawText(ctx, 'BLACKGATE', rx, ly - (big ? 12 : 12), big ? 34 : 24, '#ffffff', { align: 'right', baseline: 'middle', family: SANS });
  drawText(ctx, ellipsize(ctx, 'To begin, click your user name', hint, cx - 24, SANS), rx, ly + (big ? 26 : 16), hint, '#ffffff', {
    align: 'right', baseline: 'middle', family: SANS,
  });

  const gap = big ? 32 : 16;
  const list = { x: cx + gap, y: midY + 12, w: Math.min(w - cx - gap - 16, 420), h: midH - 24 };
  const at = drawUsers(ctx, st, sk, list, input, ui, events);
  drawLoginBody(ctx, st, sk, list, at, input, ui, events);
  drawFooter(ctx, st, sk, w, h - botH, botH, input, ui, events);
}

/// A 2px rule that fades along its stops.
function band(ctx, y, w, stops) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, 2);
}

/// The bottom band: "Turn off computer" on the left, notes on the right.
function drawFooter(ctx, st, sk, w, y, botH, input, ui, events) {
  const s = 26;
  const ix = 24;
  const iy = y + (botH - s) / 2;
  const r = { x: ix - 4, y: iy - 4, w: s + 150, h: s + 8 };
  if (drawButton(ctx, ui, sk, 'login.off', r, '', BARE, input)) events.push({ type: 'click', id: 'login.off' });
  // the red tile with the power mark
  ctx.fillStyle = ui.hover === 'login.off' ? '#f2672e' : '#d8481a';
  roundRect(ctx, { x: ix, y: iy, w: s, h: s }, 4);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ix + s / 2, iy + s / 2 + 1, 7, -Math.PI / 3, (Math.PI * 4) / 3);
  ctx.moveTo(ix + s / 2, iy + 5);
  ctx.lineTo(ix + s / 2, iy + s / 2 + 1);
  ctx.stroke();
  drawText(ctx, 'Turn off computer', ix + s + 10, iy + s / 2, 13, '#ffffff', { baseline: 'middle', family: SANS });

  const tint = st.error ? '#ffb4a8' : st.notice ? '#b8f0b0' : '#c9d8f8';
  const text = st.error || st.notice || 'After you log on, the network is yours. All activity is simulated.';
  const room = w - (ix + s + 180) - 24;
  if (room > 60) {
    drawText(ctx, ellipsize(ctx, text, 11, room, SANS), w - 24, y + botH / 2, 11, tint, { align: 'right', baseline: 'middle', family: SANS });
  }
}
