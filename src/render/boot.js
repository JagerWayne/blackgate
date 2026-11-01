// The boot screen: the BIOS log types itself out, the mark sits in the
// middle, and the shell waits for the operator to connect.

import { backdrop, logo } from './backdrop.js';
import { draw } from '../core/text.js';
import { color, cssA } from '../core/theme.js';

/// The log lines, each with the colour it is written in.
const LINES = [
  { text: 'BLACKGATE BIOS 4.11 // NODE 0x4F2A', color: () => 0x93a4b3 },
  { text: 'cold boot ................. ok', color: (sk) => sk.ok },
  { text: 'identity spoof ............ ok', color: (sk) => sk.ok },
  { text: 'traffic relay ............ 7 hops', color: () => 0x93a4b3 },
  { text: 'NEXUS uplink .............. established', color: (sk) => sk.accent },
  { text: 'polymorphic shell ......... resident', color: () => 0x93a4b3 },
  { text: 'counter-forensics ......... armed', color: (sk) => sk.warn },
  { text: '> awaiting operator credentials', color: (sk) => sk.xp_white },
];

/// How long the log takes to type itself out, and when the prompt appears.
const REVEAL_RATE = 12;
const PROMPT_AFTER = 2.4;
const READY_AFTER = 6;

export function makeBoot() {
  return { t: 0, done: false };
}

/// Advances the boot. It ends when the operator connects, or on its own.
export function tickBoot(boot, dt, input) {
  boot.t += dt;
  if (!boot.done && (boot.t > READY_AFTER || input.pressed || input.enter)) {
    boot.done = true;
  }
  return boot.done;
}

/// Draws the boot screen.
export function drawBoot(ctx, boot, w, h, sk) {
  backdrop(ctx, w, h, sk);
  const reveal = Math.floor(boot.t * REVEAL_RATE);
  LINES.forEach((line, i) => {
    if (i > reveal) return;
    const take = Math.max(0, (reveal - i) * 2);
    draw(ctx, line.text.slice(0, take), 80, 110 + i * 24, 13, color(line.color(sk)));
  });
  logo(ctx, w / 2, h / 2 - 40, 96, sk);
  draw(ctx, 'BLACKGATE', w / 2, h / 2 + 40, 26, color(sk.xp_white), { align: 'center' });
  draw(ctx, 'A NETWORK INTRUSION SIMULATION', w / 2, h / 2 + 72, 10, color(0x93a4b3), {
    align: 'center',
  });
  if (boot.t > PROMPT_AFTER) {
    const pulse = Math.sin(boot.t * 0.7 * Math.PI * 2) * 0.5 + 0.5;
    draw(ctx, 'CLICK TO CONNECT', w / 2, h - 70, 10, cssA(sk.muted, 0.4 + pulse * 0.6), {
      align: 'center',
    });
  }
}
