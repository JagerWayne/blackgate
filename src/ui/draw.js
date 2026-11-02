// The form renderer: it walks the placed controls, draws each one and
// collects what the operator did.

import { draw as drawText, ellipsize, paragraph } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { placeButtons, placeChips } from './layout.js';
import { drawButton, drawCheck, hit } from './widgets.js';
import { drawField, drawMeter } from './field.js';
import { LINE_H } from './controls.js';

/// Draws a form. `placed` comes from `placeControls`; the events are pushed
/// onto the array as the operator works the controls.
export function drawControls(ctx, placed, sk, input, st, events) {
  placed.forEach(({ control, x, y, w, h }) => {
    const r = { x, y, w, h };
    switch (control.kind) {
      case 'section': {
        drawText(ctx, ellipsize(ctx, control.text, 16, Math.max(w, 20)), x, y, 16, color(sk.dim));
        if (control.rule) {
          ctx.strokeStyle = color(sk.line);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y + 24);
          ctx.lineTo(x + w, y + 24);
          ctx.stroke();
        }
        break;
      }
      case 'label': {
        const align = control.align ?? 'left';
        const px = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
        drawText(ctx, ellipsize(ctx, control.text, control.size, Math.max(w, 20)), px, y, control.size, color(control.color ?? sk.text), {
          align,
        });
        break;
      }
      case 'para':
        paragraph(ctx, control.text, { x, y, width: w }, control.size, color(control.color ?? sk.text), {
          wrap: control.wrap !== false,
          hl: control.hl ? color(control.hl) : null,
        });
        break;
      case 'keyValue':
        drawKeyValue(ctx, sk, r, control);
        break;
      case 'buttons': {
        const { placed: spots } = placeButtons(ctx, x, y, w, control.items);
        spots.forEach((spot) => {
          const br = { x: spot.x, y: spot.y, w: spot.w, h: spot.h };
          if (drawButton(ctx, st, sk, spot.item.id, br, spot.item.text, spot.item.style, input)) {
            events.push({ type: 'click', id: spot.item.id });
          }
        });
        break;
      }
      case 'check': {
        const on = drawCheck(ctx, st, sk, control.id, r, control.text, control.on, input);
        if (on !== null) events.push({ type: 'toggle', id: control.id, value: on });
        break;
      }
      case 'field': {
        const value = drawField(ctx, st, sk, control.id, r, control.value, control.hint, control.secret, input);
        if (value !== null) events.push({ type: 'edit', id: control.id, value });
        break;
      }
      case 'meter':
        drawMeter(ctx, sk, r, control.label, control.frac, control.color, control.mark);
        break;
      case 'custom':
        control.draw(ctx, sk, { x, y, w, h: typeof control.height === 'function' ? control.height(w) : control.height }, input, events, st);
        break;
      case 'chips': {
        const { placed: spots } = placeChips(ctx, x, y, w, control.items);
        spots.forEach((spot) => {
          ctx.fillStyle = cssA(spot.color ?? sk.accent, 0.15);
          ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
          ctx.strokeStyle = cssA(spot.color ?? sk.accent, 0.5);
          ctx.lineWidth = 1;
          ctx.strokeRect(spot.x + 0.5, spot.y + 0.5, spot.w - 1, spot.h - 1);
          drawText(ctx, ellipsize(ctx, spot.text, 14, spot.w - 6), spot.x + spot.w / 2, spot.y + spot.h / 2, 14, color(spot.color ?? sk.accent), {
            align: 'center',
            baseline: 'middle',
          });
        });
        break;
      }
      case 'divider': {
        ctx.strokeStyle = color(sk.line);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  });
}

/// A key on the left, its value on the right.
function drawKeyValue(ctx, sk, r, control) {
  drawText(ctx, control.key, r.x, r.y + 1, 14, color(sk.dim));
  drawText(ctx, ellipsize(ctx, control.value, 14, r.w * 0.62), r.x + r.w, r.y, 14, color(control.color ?? sk.text), {
    align: 'right',
  });
}
