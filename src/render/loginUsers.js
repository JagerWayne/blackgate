// The right column of the welcome screen: the users on this terminal, the
// details of the one that is picked, and the button that deletes a save.

import { draw as drawText, ellipsize, measure } from '../core/text.js';
import { color } from '../core/theme.js';
import { hit, drawButton } from '../ui/widgets.js';
import { ghost, danger, solid } from '../ui/styles.js';
import { safeName } from '../state/save.js';

/// Draws the user list and the detail box under it.
export function drawUsers(ctx, st, sk, px, py, pw, ph, input, ui, events) {
  const rightX = px + Math.min(Math.max(pw * 0.38, 200), 380) + 1;
  const rightW = px + pw - rightX;
  if (rightW < 120) return;
  drawText(ctx, 'USERS', rightX + 14, py + 16, 9, color(sk.dim), { baseline: 'middle' });
  const handle = (st.handle.trim() || 'OPERATOR').toUpperCase();
  const detH = ph >= 240 ? 104 : 0;
  const listBottom = py + ph - detH - 8;
  const rowH = 44;
  let ly = py + 40;

  // the new session
  if (ly + rowH <= listBottom) {
    const rr = { x: rightX, y: ly, w: rightW - 12, h: rowH };
    if (hit(rr, input) && input.pressed) {
      st.sel = 0;
      st.confirmDelete = false;
    }
    drawUserRow(ctx, sk, rr, st.sel === 0, 'NEW SESSION  //  ' + handle, '', '>');
    ly += rowH + 8;
  }

  if (st.slots.length === 0) {
    drawText(ctx, 'no saved operators on this terminal', rightX + 10, ly + 8, 9.5, color(sk.dim), {
      baseline: 'middle',
    });
  } else {
    st.slots.forEach((s, i) => {
      if (ly + rowH > listBottom) return;
      const rr = { x: rightX, y: ly, w: rightW - 12, h: rowH };
      if (hit(rr, input) && input.pressed) {
        st.sel = i + 1;
        st.confirmDelete = false;
      }
      const meta = `${s.rank}   ${s.credits} cr   day ${s.day}`;
      drawUserRow(ctx, sk, rr, st.sel === i + 1, s.handle, meta, '>');
      ly += rowH + 8;
    });
  }

  // the details of the picked user
  if (detH > 0) {
    const det = { x: rightX, y: py + ph - detH - 2, w: rightW - 12, h: detH - 2 };
    ctx.fillStyle = color(sk.inset);
    ctx.fillRect(det.x, det.y, det.w, det.h);
    ctx.strokeStyle = color(sk.line);
    ctx.lineWidth = 1;
    ctx.strokeRect(det.x + 0.5, det.y + 0.5, det.w - 1, det.h - 1);
    const ix = det.x + 12;
    const iy = det.y + 10;
    if (st.sel === 0) {
      drawText(ctx, 'NEW SESSION', ix, iy, 9.5, color(sk.inset_accent));
      const seed = st.seed.trim() || 'random';
      drawText(ctx, ellipsize(ctx, `handle ${handle} // world seed ${seed}`, 8.5, det.w - 24), ix, iy + 22, 8.5, color(sk.inset_dim));
      // one save per operator: a new run under a saved handle is written over it
      const same = st.slots.find((s) => safeName(s.handle) === safeName(handle));
      if (same) drawText(ctx, ellipsize(ctx, `replaces the saved run of ${same.handle}`, 8.5, det.w - 24), ix, iy + 40, 8.5, color(sk.danger));
    } else {
      const s = st.slots[st.sel - 1];
      if (s) {
        drawText(ctx, s.handle, ix, iy, 9.5, color(sk.inset_accent));
        const line = `${s.rank} // ${s.credits} credits // day ${s.day} // slot ${s.slot}`;
        drawText(ctx, ellipsize(ctx, line, 8.5, det.w - 24), ix, iy + 22, 8.5, color(sk.inset_dim));
        // the button that throws the save away, in two steps
        const bw = 190;
        const btn = { x: det.x + det.w - bw - 12, y: det.y + det.h - 44, w: bw, h: 34 };
        const armed = st.confirmDelete;
        if (drawButton(ctx, ui, sk, 'login.delete', btn, armed ? 'CONFIRM DELETE' : 'DELETE SAVE', armed ? danger() : solid(), input)) {
          events.push({ type: 'click', id: 'login.delete' });
        }
      }
    }
  }
}

/// One row of the user list.
function drawUserRow(ctx, sk, r, selected, title, meta, arrow) {
  ctx.fillStyle = color(selected ? sk.accent_dim : sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color(selected ? sk.accent : sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  const metaW = meta ? measure(ctx, meta, 9) + 20 : 0;
  const name = ellipsize(ctx, title, 11, Math.max(r.w - 40 - metaW, 20));
  drawText(ctx, name, r.x + 16, r.y + r.h / 2, 11, color(sk.text_hi), { baseline: 'middle' });
  if (meta) {
    const short = ellipsize(ctx, meta, 9, Math.max(r.w - 60 - metaW, 20));
    drawText(ctx, short, r.x + r.w - 34, r.y + r.h / 2, 9, color(sk.dim), {
      align: 'right',
      baseline: 'middle',
    });
  }
  drawText(ctx, arrow, r.x + r.w - 14, r.y + r.h / 2, 10, color(sk.dim), {
    align: 'right',
    baseline: 'middle',
  });
}
