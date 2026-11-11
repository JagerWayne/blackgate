// The look of DSNET: one dark, quiet skin inside the browser, whatever the
// desktop skin is. Slate blues with a single steel-cyan accent, hairline
// borders and muted status colours: the hacker mood comes from the monospace
// figures and the prompts, not from bright neon.

/// The browser's palette: the same tokens as the shell's skins, so every
/// control draws with it unchanged.
export const NET = {
  void: 0x080b11, deep: 0x0b1019, panel: 0x0e141f, panel2: 0x131b28, raised: 0x1a2434,
  line: 0x1f2a3b, line_hi: 0x30405a, text: 0xc6d0dd, text_hi: 0xeef2f7, dim: 0x808ea4,
  muted: 0x5a677d, accent: 0x62a8c4, accent_dim: 0x183544, accent_soft: 0x12293a,
  warn: 0xc9a45c, danger: 0xc9707a, ok: 0x62b58c, blue: 0x62a8c4, violet: 0x9b8bc4,
  track: 0x1a2434,
  inset: 0x080c13, inset_text: 0xc6d0dd, inset_dim: 0x808ea4, inset_accent: 0x62a8c4,
};

/// The face the headings and body copy are set in; figures and labels stay
/// in the game's monospace.
export const UI_FONT = "'Segoe UI', system-ui, Tahoma, sans-serif";

/// The colour of each kind of work: the stripe of its cards and its tags.
export const KIND_COLOR = {
  retrieve: 0x62a8c4,
  delete: 0x8497ad,
  modify: 0xc9a45c,
  transfer: 0x62b58c,
  destroy: 0xc9707a,
  model: 0x9b8bc4,
  story: 0xdfe6ee,
};

/// A colour string from a data file ('#7fd4ff') as a number.
export const hexOf = (s) => (typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16));

/// A broker's accent, softened toward the panel so no site shouts.
export const softAccent = (s) => {
  const n = hexOf(s);
  const mixc = (a, b) => Math.round(a * 0.7 + b * 0.3);
  const r = mixc((n >> 16) & 0xff, 0xc6);
  const g = mixc((n >> 8) & 0xff, 0xd0);
  const b = mixc(n & 0xff, 0xdd);
  return (r << 16) | (g << 8) | b;
};

/// A portal button style.
const both = (fill, hover, border, text) => {
  const s = { fill, hover, border, text };
  return { dark: s, size: 11, pad: 8, radius: 4 };
};

/// The portal's buttons: blue for going on, green for taking the work, red for dropping it.
export const netPrimary = () => both(0x183a4d, 0x20506a, 0x62a8c4, 0xeef2f7);
export const netSolid = () => both(0x1a4a37, 0x236348, 0x62b58c, 0xeef2f7);
export const netDanger = () => both(0x3d2227, 0x562f36, 0xc9707a, 0xf0c4c8);
