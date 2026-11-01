// The skin: the semantic palette every part of the shell reads through.
// Two runtime skins: "Luna" (light) and "Royale Noir" (dark).
//
// The colours are plain numbers, 0xRRGGBB, so they can be mixed. The render
// turns them into CSS strings with `css` and `cssA`.

export function color(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/// A colour with an alpha, 0..1.
export function cssA(hex, a) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

/// Two colours mixed; `t` runs from 0 (a) to 1 (b).
export function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const f = (x, y) => Math.round(x + (y - x) * k);
  const r = f((a >> 16) & 0xff, (b >> 16) & 0xff);
  const g = f((a >> 8) & 0xff, (b >> 8) & 0xff);
  const bl = f(a & 0xff, b & 0xff);
  return (r << 16) | (g << 8) | bl;
}

// `muted` is a tint for marks on a dark ground (a map pin, a glow). Text that
// has to be read uses `dim`, which clears 4.5:1 on the panel in both skins.
const LIGHT = {
  void: 0x04060a, deep: 0x0a1622, panel: 0xece9d8, panel2: 0xf5f4ec, raised: 0xdfdaca,
  line: 0xaca899, line_hi: 0x7f9db9, text: 0x1d1d1d, text_hi: 0x000000, dim: 0x63615c,
  muted: 0x9c988c, accent: 0x2069d8, accent_dim: 0xbed7fa, accent_soft: 0xc9dcf7,
  warn: 0xe68b00, danger: 0xd9463e, ok: 0x1f8a3b, blue: 0x316ac5, violet: 0x8467c9,
  track: 0xd3cfba,
  xp_title_a: 0x0058e6, xp_title_b: 0x3a93ff, xp_title_in: 0x7697e7, xp_border: 0x003c74,
  xp_task_a: 0x3168d5, xp_task_b: 0x1e4fc4, xp_tray: 0x0f57be, xp_start_a: 0x3c9f3c,
  xp_start_b: 0x267a26, xp_sel: 0x316ac5, xp_white: 0xffffff, menu_bg: 0xffffff,
  menu_side: 0xd3e5fa, xp_green: 0x4cbb17, inset: 0x0a1622, inset_text: 0xe8f3f8,
  inset_dim: 0x9ab0c0, inset_accent: 0x74b7ff,
};

// `muted` is a tint for marks on a dark ground (a map pin, a glow). Text that
// has to be read uses `dim`, which clears 4.5:1 on the panel in both skins.
const DARK = {
  void: 0x050505, deep: 0x121212, panel: 0x454545, panel2: 0x4e4e4e, raised: 0x5a5a5a,
  line: 0x2b2b2b, line_hi: 0x6e6e6e, text: 0xededed, text_hi: 0xffffff, dim: 0xc4c4c4,
  muted: 0x8a8a8a, accent: 0x4c9df0, accent_dim: 0x27406b, accent_soft: 0x2e4a7c,
  warn: 0xf0a030, danger: 0xe86058, ok: 0x3dbb60, blue: 0x5aa0f0, violet: 0xa78be0,
  track: 0x2b2b2b,
  xp_title_a: 0x232733, xp_title_b: 0x3a4152, xp_title_in: 0x4a4a4a, xp_border: 0x10141c,
  xp_task_a: 0x2a2e38, xp_task_b: 0x181b22, xp_tray: 0x20242e, xp_start_a: 0x2f7a2f,
  xp_start_b: 0x1e551e, xp_sel: 0x2e4c86, xp_white: 0xffffff, menu_bg: 0x2a2a2a,
  menu_side: 0x23272f, xp_green: 0x4cbb17, inset: 0x151515, inset_text: 0xe4e4e4,
  inset_dim: 0x9e9e9e, inset_accent: 0x74b7ff,
};

let dark = false;

export function setDark(value) {
  dark = !!value;
}

export function isDark() {
  return dark;
}

/// The active palette.
export function theme() {
  return dark ? DARK : LIGHT;
}

/// The success and quality ramp, used for security levels and ratings.
export function levelColor(level) {
  switch (level) {
    case 0: return 0x6e6e6e;
    case 1:
    case 2: return 0x3aa655;
    case 3: return 0x3b8fd4;
    case 4: return 0x8a63c9;
    case 5: return 0xe08a1e;
    case 6: return 0xe06a2b;
    default: return 0xd9453e;
  }
}

/// The rank an operator rating earns.
export function rankName(rating) {
  if (rating <= 9) return 'SCRIPT KIDDIE';
  if (rating <= 19) return 'FREELANCER';
  if (rating <= 34) return 'OPERATOR';
  if (rating <= 54) return 'PROFESSIONAL';
  if (rating <= 79) return 'GHOST';
  if (rating <= 119) return 'BLACKGATE ELITE';
  return 'LEGEND';
}
