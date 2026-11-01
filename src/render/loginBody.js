// The left column of the welcome screen: the operator handle. Every new run
// gets a random world.

import { draw as drawText } from '../core/text.js';
import { color } from '../core/theme.js';
import { drawField } from '../ui/field.js';

/// Draws the operator's details.
export function drawLoginBody(ctx, st, sk, px, py, pw, ph, compact, input, ui, events) {
  const pad = compact ? 14 : 28;
  const leftW = Math.min(Math.max(pw * 0.38, 200), 380);
  const innerW = Math.max(leftW - pad * 2, 52);
  const lx = px + pad;
  let y = py + 16;

  drawText(ctx, 'OPERATOR HANDLE', lx, y, 9, color(sk.dim), { baseline: 'middle' });
  y += 16;
  const handle = drawField(
    ctx, ui, sk, 'login.handle',
    { x: lx, y, w: innerW, h: 34 },
    st.handle, 'HANDLE', false, input,
  );
  if (handle !== null) {
    st.handle = handle;
    events.push({ type: 'edit', id: 'login.handle', value: handle });
  }
  y += 48;

  // the helper notes only when the column has room left over
  if (py + ph - y >= 70 && !compact) {
    [
      'every new session builds a new random network.',
      'your first jobs only need the installed v1 kit.',
    ].forEach((line, i) => {
      drawText(ctx, line, lx, y + i * 20, 8.5, color(sk.dim));
    });
  }
}
