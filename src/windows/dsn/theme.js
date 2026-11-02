// The look of DeppSpaceNET: one dark "night-net" skin inside the browser,
// whatever the desktop skin is, and a colour for each kind of work.

/// The browser's palette: the same tokens as the shell's skins, so every
/// control draws with it unchanged.
export const NET = {
  void: 0x05070d, deep: 0x080c18, panel: 0x0b1020, panel2: 0x131a2e, raised: 0x1c2642,
  line: 0x26314f, line_hi: 0x3d4d78, text: 0xd3dceb, text_hi: 0xffffff, dim: 0x8c9cb8,
  muted: 0x5d6b88, accent: 0x7fd4ff, accent_dim: 0x1d4a66, accent_soft: 0x173a52,
  warn: 0xffc857, danger: 0xff6b6b, ok: 0x5be49b, blue: 0x7fd4ff, violet: 0xc39bff,
  track: 0x1c2642,
  inset: 0x070a14, inset_text: 0xd3dceb, inset_dim: 0x8c9cb8, inset_accent: 0x7fd4ff,
};

/// The colour of each kind of work: the stripe of its cards and its tags.
export const KIND_COLOR = {
  retrieve: 0x7fd4ff,
  delete: 0x9fb3c8,
  modify: 0xffc857,
  transfer: 0x5be49b,
  destroy: 0xff6b6b,
  model: 0xc39bff,
  story: 0xffffff,
};

/// A colour string from a data file ('#7fd4ff') as a number.
export const hexOf = (s) => (typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16));

/// A button style the same in both desktop skins: the portal is always dark.
const both = (fill, hover, border, text) => {
  const s = { fill, hover, border, text };
  return { dark: s, light: s, size: 11, pad: 8, radius: 2 };
};

/// The portal's buttons: blue for going on, green for taking the work, red for dropping it.
export const netPrimary = () => both(0x1d4a66, 0x2a6a90, 0x7fd4ff, 0xffffff);
export const netSolid = () => both(0x1f6b45, 0x28915c, 0x5be49b, 0xffffff);
export const netDanger = () => both(0x4a1f26, 0x6a2a33, 0xff6b6b, 0xffb3b3);
