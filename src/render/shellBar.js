// The desktop, the taskbar and the messages that fade away.

import { draw as drawText, ellipsize } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { drawButton } from '../ui/widgets.js';
import { ghost } from '../ui/styles.js';
import { hhmm } from '../core/clock.js';

/// The wallpaper behind the windows.
export function drawDesktop(ctx, sk, r, wallpaper) {
  if (wallpaper) {
    const iw = wallpaper.width;
    const ih = wallpaper.height;
    const scale = Math.max(r.w / iw, r.h / ih);
    ctx.drawImage(wallpaper, r.x + (r.w - iw * scale) / 2, r.y + (r.h - ih * scale) / 2, iw * scale, ih * scale);
  } else {
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    g.addColorStop(0, '#123a6b');
    g.addColorStop(1, '#071b33');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = cssA(0x7fd4c1, 0.08);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = r.x; x < r.x + r.w; x += 64) {
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
  }
  for (let y = r.y; y < r.y + r.h; y += 64) {
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
  }
  ctx.stroke();
}

/// The taskbar along the bottom.
export function drawTaskbar(ctx, game, sk, r, mgr, ui, input, events) {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, color(sk.xp_task_a));
  g.addColorStop(1, color(sk.xp_task_b));
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const start = { x: r.x, y: r.y + 4, w: 104, h: r.h - 8 };
  const startStyle = {
    ...ghost(),
    dark: { fill: 'xp_start_a', hover: 'xp_start_b', border: 'xp_border', text: 'xp_white' },
    light: { fill: 'xp_start_a', hover: 'xp_start_b', border: 'xp_border', text: 'xp_white' },
    size: 11,
    pad: 12,
  };
  if (drawButton(ctx, ui, sk, 'start', start, 'Start', startStyle, input)) {
    events.push({ type: 'click', id: 'start' });
  }
  // the window buttons share the room between Start and the tray, so a full
  // desk shrinks them instead of running them under the clock
  let x = r.x + 110;
  const room = Math.max(r.x + r.w - 160 - 8 - x, 0);
  const n = Math.max(mgr.list.length, 1);
  const unread = game.mail.filter((m) => !m.read).length;
  mgr.list.forEach((w) => {
    const bw = Math.max(Math.min(180, room / n - 4), 36);
    if (x + bw > r.x + r.w - 160 - 4) return;
    const br = { x, y: r.y + 5, w: bw, h: r.h - 10 };
    const style = {
      ...ghost(),
      dark: { fill: 'xp_task_a', hover: 'panel2', border: 'xp_border', text: 'xp_white' },
      light: { fill: 'xp_task_a', hover: 'panel2', border: 'xp_border', text: 'xp_white' },
      size: 9,
      pad: 8,
    };
    const title = w.key === 'mail' && unread ? `${w.title} (${unread})` : w.title;
    if (drawButton(ctx, ui, sk, `task.${w.key}`, br, ellipsize(ctx, title, 9, bw - 12), style, input)) {
      events.push({ type: 'click', id: `task.${w.key}` });
    }
    x += bw + 4;
  });
  const tray = { x: r.x + r.w - 160, y: r.y, w: 160, h: r.h };
  ctx.fillStyle = color(sk.xp_tray);
  ctx.fillRect(tray.x, tray.y, tray.w, tray.h);
  drawText(ctx, hhmm(game.clock), tray.x + 128, tray.y + r.h / 2, 11, color(sk.xp_white), { align: 'right', baseline: 'middle' });
}

/// The messages that fade away.
export function drawToasts(ctx, game, sk, r) {
  game.toasts.forEach((t, i) => {
    const age = game.uiTime - t.born;
    const a = Math.max(0, Math.min(1, (5 - age) / 1.2));
    const w = 380;
    const h = 42;
    const x = r.x + r.w - w - 20;
    const y = r.y + r.h - 80 - i * (h + 6);
    const tint = t.kind === 'bad' ? sk.danger : t.kind === 'good' ? sk.ok : t.kind === 'money' ? sk.warn : sk.accent;
    ctx.fillStyle = cssA(sk.deep, 0.92 * a);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = cssA(tint, 0.8 * a);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // the ground is `deep` in both skins, so the text is the inset colour
    drawText(ctx, ellipsize(ctx, t.text, 9.5, w - 20), x + 10, y + h / 2, 9.5, cssA(sk.inset_text, a), { baseline: 'middle' });
  });
}
