// The button styles. The colours are given per skin: the dark skin is drawn
// at runtime, so a style cannot bake one skin's colours into itself.

import { FONT } from '../core/text.js';

export function ghost() {
  return {
    dark: { fill: null, hover: 'raised', border: 'line', text: 'text' },
    light: { fill: null, hover: 'raised', border: 'line', text: 'text' },
    size: FONT.body,
    pad: 8,
    radius: 2,
    disabled: false,
    mono: true,
    glow: false,
  };
}

export function primary() {
  return {
    ...ghost(),
    dark: { fill: 0x2a4a7c, hover: 0x37609c, border: 0x3c6fb0, text: 0xbfd8ff },
    light: { fill: 0xe3eefc, hover: 0xc6ddf9, border: 0x003c74, text: 0x0a246a },
  };
}

export function solid() {
  return {
    ...ghost(),
    dark: { fill: 'xp_title_a', hover: 'xp_title_b', border: 'xp_border', text: 'xp_white' },
    light: { fill: 'xp_title_a', hover: 'xp_title_b', border: 'xp_border', text: 'xp_white' },
  };
}

export function danger() {
  return {
    ...ghost(),
    dark: { fill: 0x4a2220, hover: 0x63302c, border: 'danger', text: 0xf3a49c },
    light: { fill: 0xf2dcda, hover: 0xe9c2be, border: 'danger', text: 0xa3271f },
  };
}

export function flat() {
  return {
    ...ghost(),
    dark: { fill: null, hover: 'panel2', border: null, text: 'dim' },
    light: { fill: null, hover: 'panel2', border: null, text: 'dim' },
  };
}
