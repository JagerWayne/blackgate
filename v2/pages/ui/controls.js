// The form model: a window is a list of controls. The controls are plain
// data, the layout measures them and the renderer draws them.

import { FONT } from '../../game/core/text.js';

// -- shared metrics ---------------------------------------------------------

/// The height of a button or an input field.
export const CONTROL_H = 30;
/// The height of one text line inside a table row.
export const LINE_H = 22;
/// The gap between two controls.
export const GAP = 8;
/// The extra space above a section heading.
export const SECTION_GAP = 20;
/// The smallest width a control may be squeezed into before it wraps.
export const MIN_CONTROL_W = 60;
/// The gap between wrapped button lines.
export const WRAP_GAP = 6;

// -- the controls ------------------------------------------------------------

export function section(text, rule = true) {
  return { kind: 'section', text, rule };
}

export function label(text, size = FONT.body, color = null) {
  return { kind: 'label', text, size, color, align: 'left' };
}

/// `hl`, a colour, draws the {braced} parts of the text in it.
export function para(text, size = FONT.body, color = null, wrap = true, hl = null) {
  return { kind: 'para', text, size, color, align: 'left', wrap, hl };
}

export function keyValue(key, value, color = null) {
  return { kind: 'keyValue', key, value, color };
}

/// A row of buttons: `{ id, text, style }` each.
export function buttons(items) {
  return { kind: 'buttons', items };
}

export function check(id, text, on) {
  return { kind: 'check', id, text, on };
}

export function field(id, value, hint = '', secret = false) {
  return { kind: 'field', id, value, hint, secret };
}

export function area(id, value, hint = '') {
  return { kind: 'area', id, value, hint };
}

/// A labelled bar. `mark`, a fraction, draws a tick where something happens
/// (the trace meter marks where the security unit warns).
export function meter(label, frac, color = null, mark = null) {
  return { kind: 'meter', label, frac, color, mark };
}

/// A row of small coloured tags: `[text, colour]` each.
export function chips(items) {
  return { kind: 'chips', items };
}

/// A row the caller draws itself: `draw(ctx, sk, rect)`, `height` tall.
export function custom(height, draw) {
  return { kind: 'custom', height, draw };
}

export function divider() {
  return { kind: 'divider' };
}

export function spacer(height) {
  return { kind: 'spacer', height };
}

// The button styles live in their own file.
export { ghost, primary, solid, danger, flat } from './styles.js';
