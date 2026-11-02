// The setup screen a new profile sees before its desktop: the world it was
// just given is registered company by company, then citizen by citizen, with
// a running log, counters and a bar. The world is already built (in a few
// milliseconds); the screen plays its records back so the operator sees what
// was made. Any key or click runs it four times faster.

import { draw as drawText, ellipsize } from '../core/text.js';
import { cities } from '../data/content.js';
import { CO_LABEL } from '../data/enums.js';
import { portraitOf, drawPortrait } from '../ui/portrait.js';
import { siteUrl } from '../state/sites.js';

/// How long each stage runs, in seconds.
export const STAGES = [
  { key: 'companies', label: 'REGISTERING COMPANIES', secs: 2.2 },
  { key: 'people', label: 'CREATING CITIZENS', secs: 3.6 },
  { key: 'write', label: 'WRITING PROFILE', secs: 0.6 },
];
const LOG_LINES = 14;

export function makeSetup(game) {
  return { game, t: 0, done: false };
}

/// Where the setup is: the stage, how far through it (0..1), and the count of
/// records shown so far in it.
export function setupAt(setup) {
  let t = setup.t;
  for (let i = 0; i < STAGES.length; i += 1) {
    const s = STAGES[i];
    if (t < s.secs || i === STAGES.length - 1) {
      const f = Math.min(t / s.secs, 1);
      const total = s.key === 'companies' ? setup.game.world.companies.length : s.key === 'people' ? setup.game.world.people.length : 1;
      return { stage: i, f, n: Math.floor(f * total), total };
    }
    t -= s.secs;
  }
  return null;
}

/// Advances the setup; true once it has finished.
export function tickSetup(setup, dt, input) {
  const fast = input?.anyKey || input?.down;
  setup.t += dt * (fast ? 4 : 1);
  const total = STAGES.reduce((a, s) => a + s.secs, 0);
  setup.done = setup.t >= total;
  return setup.done;
}

/// The log lines up to the n-th record of a stage.
function logLines(game, stage, n) {
  const w = game.world;
  const lines = [];
  if (stage >= 0) {
    const upto = stage === 0 ? n : w.companies.length;
    for (let i = Math.max(upto - LOG_LINES, 0); i < upto; i += 1) {
      const c = w.companies[i];
      lines.push({ text: `+ ${c.name.padEnd(26)} ${siteUrl(c).padEnd(30)} ${(CO_LABEL[c.kind] ?? c.kind).padEnd(12)} ${cities()[c.city]?.name ?? ''}`, tone: '#7fd4ff' });
    }
  }
  if (stage >= 1) {
    const upto = stage === 1 ? n : w.people.length;
    for (let i = Math.max(upto - LOG_LINES, 0); i < upto; i += 1) {
      const p = w.people[i];
      const at = p.company === null ? 'civilian' : `@ ${w.companies[p.company]?.name}`;
      lines.push({ text: `+ ${p.name.padEnd(24)} ${p.role} ${at}`, tone: p.company === null ? '#93a4b3' : '#5be49b' });
    }
  }
  return lines.slice(-LOG_LINES);
}

/// Draws the setup.
export function drawSetup(ctx, setup, sk, w, h) {
  const game = setup.game;
  const at = setupAt(setup);
  ctx.fillStyle = '#05080c';
  ctx.fillRect(0, 0, w, h);
  const x = Math.max((w - 900) / 2, 24);
  const cw = Math.min(900, w - 48);
  let y = Math.max(h * 0.12, 30);
  drawText(ctx, `NEW PROFILE // ${game.player.handle}`, x, y, 20, '#ffffff');
  drawText(ctx, `building your network // seed ${game.seed}`, x, y + 30, 12, '#93a4b3');
  y += 70;

  // the three stages, each with its counter and bar
  STAGES.forEach((s, i) => {
    const doneStage = i < at.stage;
    const live = i === at.stage;
    const f = doneStage ? 1 : live ? at.f : 0;
    const total = s.key === 'companies' ? game.world.companies.length : s.key === 'people' ? game.world.people.length : 0;
    const count = doneStage ? total : live ? at.n : 0;
    const tint = doneStage ? '#5be49b' : live ? '#ffc857' : '#3f5062';
    drawText(ctx, `${doneStage ? '✓' : live ? '›' : ' '} ${s.label}`, x, y, 13, tint);
    if (total) drawText(ctx, `${count.toLocaleString('en-US')} / ${total.toLocaleString('en-US')}`, x + cw, y, 13, tint, { align: 'right' });
    ctx.fillStyle = '#1a2330';
    ctx.fillRect(x, y + 22, cw, 6);
    ctx.fillStyle = tint;
    ctx.fillRect(x, y + 22, cw * f, 6);
    y += 46;
  });

  // the citizens flick past while they are made
  if (at.stage === 1 && at.n > 0) {
    const size = 64;
    for (let k = 0; k < 8; k += 1) {
      const i = Math.max(at.n - 1 - k, 0);
      const p = game.world.people[i];
      drawPortrait(ctx, sk, { x: x + k * (size + 8), y, w: size, h: size }, portraitOf(game, i), p.sex);
    }
    y += size + 14;
  }

  // the running log
  logLines(game, at.stage, at.n).forEach((l, i) => {
    drawText(ctx, ellipsize(ctx, l.text, 12, cw), x, y + i * 18, 12, l.tone);
  });
  drawText(ctx, 'any key: faster', x + cw, h - 30, 11, '#3f5062', { align: 'right' });
}
