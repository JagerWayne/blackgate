// The skin: the semantic palette every part of the shell reads through.
// One skin: "Royale Noir", a dark navy slate.
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
// has to be read uses `dim`, which clears 4.5:1 on the panel.
const DARK = {
  void: 0x050810, deep: 0x0e1420, panel: 0x1d2433, panel2: 0x263046, raised: 0x32405c,
  line: 0x38466a, line_hi: 0x5a6e98, text: 0xe9eef8, text_hi: 0xffffff, dim: 0xb0bcd2,
  muted: 0x8795b0, accent: 0x4c9df0, accent_dim: 0x27406b, accent_soft: 0x2e4a7c,
  warn: 0xf0a030, danger: 0xe86058, ok: 0x3dbb60, blue: 0x5aa0f0, violet: 0xa78be0,
  track: 0x2c3750,
  xp_title_a: 0x1f2a44, xp_title_b: 0x3a4f80, xp_title_in: 0x2c3650, xp_border: 0x0c111c,
  xp_task_a: 0x232c42, xp_task_b: 0x141a29, xp_tray: 0x1a2133, xp_start_a: 0x2f7a2f,
  xp_start_b: 0x1e551e, xp_sel: 0x2e4c86, xp_white: 0xffffff, menu_bg: 0x1a2133,
  menu_side: 0x202a42, xp_green: 0x4cbb17, inset: 0x121826, inset_text: 0xe4eaf6,
  inset_dim: 0x9aa8c2, inset_accent: 0x74b7ff,
};

/// The palette.
export function theme() {
  return DARK;
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
