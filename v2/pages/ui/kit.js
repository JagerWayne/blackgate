// The helpers the widgets share: the state that survives between frames, the
// hit test, and the colours of a style for the skin that is on screen.


/// The widget state that survives between frames: what is hot, what is held
/// down, which field has the caret.
export function makeUiState() {
  return {
    hover: null, active: null, focus: null, caret: 0, scroll: new Map(),
    // the keyboard: the text fields drawn this frame (Tab walks them), the
    // button Enter presses, and the one Enter has fired for this frame
    fields: [], lastFields: [], defaultId: null, lastDefault: null, fire: null,
    // the tutorial's highlights: the ids to light, and the boxes noted this frame
    hint: null, hintRects: [],
    // the ids of the controls drawn this frame, when a test wants them
    seen: null,
  };
}

/// Is the pointer over a rectangle?
export function hit(r, input) {
  return (
    input.inside &&
    input.mouse.x >= r.x &&
    input.mouse.x < r.x + r.w &&
    input.mouse.y >= r.y &&
    input.mouse.y < r.y + r.h
  );
}

/// The input a covered widget sees: the same frame with no pointer and no
/// clicks, so only the widget on top reacts. A held button and the pointer's
/// position stay, so a drag in progress carries on; the keys stay, because
/// they go to the focused field wherever the pointer is.
export function blind(input) {
  return { ...input, inside: false, pressed: false, released: false, rightPressed: false, scroll: 0 };
}

/// The concrete colours of a style.
export function resolveStyle(style, sk) {
  const src = style.dark;
  const pick = (v) => (typeof v === 'string' ? sk[v] : v);
  const one = (v) => (v === null || v === undefined ? null : pick(v));
  return {
    fill: one(src.fill),
    hover: pick(src.hover),
    border: one(src.border),
    text: pick(src.text),
    size: style.size,
    pad: style.pad,
    radius: style.radius,
    disabled: !!style.disabled,
    mono: style.mono !== false,
    glow: !!style.glow,
  };
}

/// Mixes two colours; the shell uses it for the button bevels.
export function mixHex(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const f = (x, y) => Math.round(x + (y - x) * k);
  return (
    (f((a >> 16) & 0xff, (b >> 16) & 0xff) << 16) |
    (f((a >> 8) & 0xff, (b >> 8) & 0xff) << 8) |
    f(a & 0xff, b & 0xff)
  );
}

/// Darkens a colour the way the shell dims a disabled face.
export function gamma(hex, k) {
  const f = (v) => Math.round(Math.pow(v / 255, 2.2) * 255 * k);
  return (f((hex >> 16) & 0xff) << 16) | (f((hex >> 8) & 0xff) << 8) | f(hex & 0xff);
}

/// A rectangle with rounded corners, falling back to a square one.
export function roundRect(ctx, r, radius) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  else ctx.rect(r.x, r.y, r.w, r.h);
}
