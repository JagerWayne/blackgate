// Measures the controls into rectangles. The height of a control depends on
// the width it is given, so the measure pass and the draw pass have to agree:
// the layout is measured once and the drawing uses the same numbers.

import { measure, wrapLines, lineHeight, FONT } from '../core/text.js';
import { GAP, SECTION_GAP, CONTROL_H, MIN_CONTROL_W, WRAP_GAP } from './controls.js';

/// The width a button needs for its caption.
export function buttonWidth(ctx, item) {
  const size = item.style?.size ?? FONT.body;
  const pad = item.style?.pad ?? 8;
  return Math.max(measure(ctx, item.text, size) + pad * 2 + 4, 44);
}

/// Places a row of buttons, wrapping onto as many lines as it needs.
export function placeButtons(ctx, left, top, width, items) {
  const w = Math.max(width, MIN_CONTROL_W);
  const out = [];
  let x = left;
  let y = top;
  let lines = 1;
  items.forEach((item) => {
    const bw = Math.min(buttonWidth(ctx, item), w);
    if (x > left && x + bw > left + w) {
      x = left;
      y += CONTROL_H + WRAP_GAP;
      lines += 1;
    }
    out.push({ item, x, y, w: bw, h: CONTROL_H });
    x += bw + GAP;
  });
  const h = lines * CONTROL_H + (lines - 1) * WRAP_GAP;
  return { placed: out, height: h };
}

/// Places a row of small tags.
export function placeChips(ctx, left, top, width, items) {
  const out = [];
  let x = left;
  let y = top;
  let lines = 1;
  items.forEach(([text, tint]) => {
    const w = Math.min(measure(ctx, text, FONT.body) + 14, Math.max(width, 20));
    if (x > left && x + w > left + width) {
      x = left;
      y += 24 + 6;
      lines += 1;
    }
    out.push({ text, color: tint, x, y, w, h: 24 });
    x += w + 5;
  });
  const h = lines * 24 + (lines - 1) * 6;
  return { placed: out, height: h };
}

/// The height one control takes at a given width.
export function heightOf(ctx, control, width, top, bottom, rest) {
  switch (control.kind) {
    case 'section':
      return 28 + GAP;
    case 'label':
      return lineHeight(control.size) + GAP - 4;
    case 'para': {
      const lines = control.wrap
        ? wrapLines(ctx, control.text, control.size, width).length
        : 1;
      return lines * lineHeight(control.size) + GAP - 4;
    }
    case 'keyValue':
      return 28;
    case 'buttons':
      return placeButtons(ctx, 0, 0, width, control.items).height + GAP;
    case 'check':
      return CONTROL_H + GAP - 4;
    case 'field':
      return CONTROL_H + GAP;
    case 'area':
      return rest === 0 ? Math.max(bottom - top, 80) : 120 + GAP;
    case 'meter':
      return 34 + GAP - 6;
    case 'chips':
      return placeChips(ctx, 0, 0, width, control.items).height + GAP - 4;
    case 'divider':
      return GAP + 4;
    case 'spacer':
      return control.height;
    case 'custom':
      // a height can follow the width, for rows that wrap (a grid of cards)
      return (typeof control.height === 'function' ? control.height(width) : control.height) + GAP - 6;
    default:
      return 0;
  }
}

/// Measures and places every control. Returns the rectangles and the height
/// the form takes.
export function placeControls(ctx, controls, width, top, bottom) {
  const w = Math.max(width, 1);
  const placed = [];
  let y = top;
  controls.forEach((control, pos) => {
    let h = heightOf(ctx, control, w, y, bottom, controls.length - pos - 1);
    if (control.kind === 'section' && y > top) y += SECTION_GAP - GAP;
    placed.push({ control, x: 0, y, w, h });
    y += h;
  });
  return { placed, height: y - top };
}

/// The height a form would take at a width, without placing it.
export function measureControls(ctx, controls, width) {
  return placeControls(ctx, controls, width, 0, 1e6).height;
}
