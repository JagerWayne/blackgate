// The welcome screen: the XP blue field, the panel, the operator's details on
// the left, the users on the terminal on the right, and the footer.

import { draw as drawText, ellipsize } from '../core/text.js';
import { color } from '../core/theme.js';
import { logo } from './backdrop.js';
import { drawButton } from '../ui/widgets.js';
import { ghost, solid } from '../ui/controls.js';
import { drawLoginBody } from './loginBody.js';
import { drawUsers } from './loginUsers.js';

export function makeLogin() {
  return { handle: '', seed: '', sel: 0, slots: [], error: '', notice: '', confirmDelete: false };
}

/// The blue field and the panel the screen sits on.
export function drawLogin(ctx, st, sk, w, h, input, ui, events) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2e74d8');
  g.addColorStop(1, '#062a66');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const pw = Math.min(Math.max(w - 16, 160), 1000);
  const ph = Math.min(Math.max(h - 16, 140), 660);
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = color(sk.xp_border);
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

  const compact = ph < 520 || pw < 700;
  const headH = compact ? 64 : 88;
  const footH = ph < 380 ? 56 : 66;
  const bodyY = py + headH;
  const bodyH = ph - headH - footH;
  drawHeader(ctx, sk, px, py, pw, headH, compact);
  drawLoginBody(ctx, st, sk, px, bodyY, pw, bodyH, compact, input, ui, events);
  drawUsers(ctx, st, sk, px, bodyY, pw, bodyH, input, ui, events);
  drawFooter(ctx, st, sk, px, py + ph - footH, pw, footH, input, ui, events);
}

/// The header: the mark, the name and the build stamp.
function drawHeader(ctx, sk, px, py, pw, headH, compact) {
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(px, py, pw, headH);
  ctx.fillStyle = color(sk.accent);
  ctx.fillRect(px, py + headH - 2, pw, 2);
  const size = compact ? 30 : 48;
  const lx = px + (compact ? 14 : 26);
  logo(ctx, lx + size / 2, py + headH / 2, size, sk);
  const tx = lx + size + (compact ? 12 : 22);
  drawText(ctx, 'BLACKGATE', tx, py + headH / 2 - (compact ? 8 : 12), compact ? 18 : 28, color(sk.text_hi), {
    baseline: 'middle',
  });
  drawText(ctx, 'A NETWORK INTRUSION SIMULATION', tx, py + headH / 2 + (compact ? 12 : 16), 9, color(sk.dim), {
    baseline: 'middle',
  });
  drawText(ctx, 'NEXUS ACCESS TERMINAL', px + pw - 24, py + headH / 2 - 12, 10, color(sk.dim), {
    align: 'right',
    baseline: 'middle',
  });
  drawText(ctx, 'SHELL 5.1 // BUILD 0.1', px + pw - 24, py + headH / 2 + 12, 8.5, color(sk.dim), {
    align: 'right',
    baseline: 'middle',
  });
}

/// The footer: the two buttons and the note.
function drawFooter(ctx, st, sk, px, py, pw, footH, input, ui, events) {
  ctx.fillStyle = color(sk.panel2);
  ctx.fillRect(px, py, pw, footH);
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py + 0.5);
  ctx.lineTo(px + pw, py + 0.5);
  ctx.stroke();
  const fpad = pw >= 700 ? 24 : 12;
  const avail = Math.max(pw - fpad * 2, 40);
  const goW = Math.min(Math.max(avail * 0.55, 60), 280);
  const offW = Math.min(Math.max(avail - 8 - goW, 40), 220);
  const bh = Math.min(footH - 14, 38);
  const by = py + (footH - bh) / 2;
  const go = { x: px + fpad, y: by, w: goW, h: bh };
  if (drawButton(ctx, ui, sk, 'login.go', go, ellipsize(ctx, 'ENTER THE NETWORK', 10, goW - 14), { ...solid(), isDefault: true }, input)) {
    events.push({ type: 'click', id: 'login.go' });
  }
  const off = { x: go.x + goW + 8, y: by, w: offW, h: bh };
  if (drawButton(ctx, ui, sk, 'login.off', off, ellipsize(ctx, 'TURN OFF COMPUTER', 9, offW - 14), ghost(), input)) {
    events.push({ type: 'click', id: 'login.off' });
  }
  if (pw >= 700) {
    drawText(ctx, 'ALL ACTIVITY IS SIMULATED', off.x + offW + 18, py + footH / 2, 8.5, color(sk.dim), {
      baseline: 'middle',
    });
  }
  if (st.error) {
    drawText(ctx, ellipsize(ctx, st.error, 9.5, Math.max(pw - 40, 40)), px + pw / 2, py - 14, 9.5, color(sk.danger), {
      align: 'center',
      baseline: 'middle',
    });
  }
  if (st.notice) {
    drawText(ctx, ellipsize(ctx, st.notice, 9.5, Math.max(pw - 40, 40)), px + pw / 2, py + footH + 18, 9.5, color(sk.ok), {
      align: 'center',
      baseline: 'middle',
    });
  }
}
