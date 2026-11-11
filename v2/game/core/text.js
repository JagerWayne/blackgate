// Canvas text: measuring, drawing, ellipsising and wrapping. The widths are
// cached per font, because the shell measures the same captions every frame.

import { noteCut, noteText } from './tooltip.js';

export const MONO = 'monospace';

/// The sizes the shell is set in. The floor is the body size; the steps up
/// are the emphasis, the heading and the title. A window asks for one of
/// these and gets it, so the interface has a shape instead of a smear.
export const FONT = {
  body: 14, // the detail text: table lines, labels, hints
  emphasis: 16, // the thing being talked about: a name, a value
  heading: 20, // the title of a window or a section
  title: 26, // the one number a window is about
};

/// The size a piece of text is really set at: the request is snapped onto
/// the ladder, so the shell has four sizes and no more. Anything under the
/// floor is body text; a request in between two rungs takes the lower one.
export function fontSize(size) {
  if (size >= 22) return FONT.title;
  if (size >= 17) return FONT.heading;
  if (size >= 15) return FONT.emphasis;
  return FONT.body;
}

/// The measured widths, keyed by font string.
const widths = new Map();

export function fontString(size, family = MONO) {
  return `${fontSize(size)}px ${family}`;
}

/// The width of a string in the given font.
export function measure(ctx, text, size, family = MONO) {
  const font = fontString(size, family);
  let cache = widths.get(font);
  if (!cache) {
    cache = new Map();
    widths.set(font, cache);
  }
  let w = cache.get(text);
  if (w === undefined) {
    if (ctx.font !== font) ctx.font = font;
    w = ctx.measureText(text).width;
    if (cache.size > 4000) cache.clear(); // typed and dynamic text would grow it for ever
    cache.set(text, w);
  }
  return w;
}

/// The height of one line of text.
export function lineHeight(size) {
  return fontSize(size) * 1.42;
}

/// Shortens a string until it fits, with an ellipsis at the end.
export function ellipsize(ctx, text, size, maxWidth, family = MONO) {
  if (measure(ctx, text, size, family) <= maxWidth) return text;
  let out = '';
  for (const ch of text) {
    if (measure(ctx, out + ch + '…', size, family) > maxWidth) break;
    out += ch;
  }
  // the full text is kept for the tooltip
  noteCut(`${out}…`, text);
  return `${out}…`;
}

/// Draws one line. The anchor is a canvas text align and baseline.
export function draw(ctx, text, x, y, size, color, opts = {}) {
  const { align = 'left', baseline = 'top', family = MONO } = opts;
  ctx.save();
  ctx.font = fontString(size, family);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
  // text that was cut short can be hovered for its whole self
  if (typeof text === 'string' && text.endsWith('…')) {
    const w = measure(ctx, text, size, family);
    noteText(text, { x: align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y: baseline === 'middle' ? y - lineHeight(size) / 2 : y, w, h: lineHeight(size) });
  }
}

/// Splits a string into the lines it needs at a given width.
export function wrapLines(ctx, text, size, maxWidth, family = MONO) {
  const words = String(text).split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [''];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const probe = `${line} ${words[i]}`;
    if (measure(ctx, probe, size, family) <= maxWidth) {
      line = probe;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/// Draws a paragraph inside a box and returns the height it used. An
/// unwrapped paragraph stays on one line and is clipped by the caller.
export function paragraph(ctx, text, rect, size, color, opts = {}) {
  const { align = 'left', wrap = true, family = MONO, hl = null } = opts;
  const lines = wrap ? wrapLines(ctx, text, size, rect.width, family) : [String(text)];
  const lh = lineHeight(size);
  // with a highlight colour, {braced} parts are drawn in it, without the
  // braces; a part that wraps stays lit on the next line
  let lit = false;
  lines.forEach((line, i) => {
    const y = rect.y + i * lh;
    if (!hl) {
      draw(ctx, line, rect.x, y, size, color, { align, baseline: 'top', family });
      return;
    }
    let x = rect.x;
    line.split(/([{}])/).forEach((part) => {
      if (part === '{' || part === '}') lit = part === '{';
      else if (part) {
        draw(ctx, part, x, y, size, lit ? hl : color, { baseline: 'top', family });
        x += measure(ctx, part, size, family);
      }
    });
  });
  return lines.length * lh;
}
