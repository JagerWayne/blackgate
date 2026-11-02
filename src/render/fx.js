// The screen effects over the desktop: scanlines, a red pulse at the edges
// while a trace closes in, a glitch on connect and disconnect, and the sounds
// that go with what happened this frame. SYSTEM switches each off.

import { SOUNDS } from '../core/sound.js';
import { traceWarnAt } from '../systems/sessionTick.js';

const GLITCH = 0.35;

/// What the effects remember between frames.
export function makeFx() {
  return { linked: false, online: false, tasks: 0, alarmT: 0, glitchT: 0, lines: null };
}

/// Plays this frame's sounds and draws the effects over the screen.
export function drawFx(ctx, w, h, state, dt) {
  const { game, input } = state;
  if (!game) return;
  const fx = (state.fx ??= makeFx());
  const s = game.session;
  const sound = game.settings.sound !== false;
  const play = (name) => { if (sound) SOUNDS[name](); };

  // what changed since the last frame
  if (input.pressed) play('click');
  else if (input.typed) play('key');
  if (!!s !== fx.linked) {
    fx.glitchT = GLITCH;
    play(s ? 'connect' : 'disconnect');
  } else if (s && s.phase === 'online' && !fx.online) {
    fx.glitchT = GLITCH * 0.6;
    play('done');
  }
  const tasks = s?.tasks.length ?? 0;
  if (s && tasks < fx.tasks) play('done');
  fx.linked = !!s;
  fx.online = s?.phase === 'online';
  fx.tasks = tasks;

  // the trace: an alarm that beats faster as it closes in
  const danger = s?.alerted ? s.trace : 0;
  if (s && danger >= traceWarnAt(game)) {
    fx.alarmT -= dt;
    if (fx.alarmT <= 0) {
      play('alarm');
      fx.alarmT = Math.max(1.2 - danger, 0.25);
    }
  }

  if (game.settings.effects === false) return;
  scanlines(ctx, w, h, fx);
  if (danger > 0) edgePulse(ctx, w, h, danger, state.time);
  if (fx.glitchT > 0) {
    glitch(ctx, w, h, fx.glitchT / GLITCH, state.time);
    fx.glitchT -= dt;
  }
}

/// Fine dark lines across the whole screen, drawn once to a pattern.
function scanlines(ctx, w, h, fx) {
  if (!fx.lines && typeof ctx.createPattern === 'function' && globalThis.document) {
    const tile = document.createElement('canvas');
    tile.width = 4;
    tile.height = 3;
    const t = tile.getContext('2d');
    t.fillStyle = 'rgba(0,0,0,0.10)';
    t.fillRect(0, 0, 4, 1);
    fx.lines = ctx.createPattern(tile, 'repeat');
  }
  if (!fx.lines) return;
  ctx.fillStyle = fx.lines;
  ctx.fillRect(0, 0, w, h);
}

/// A red glow at the edges, beating faster and redder as the trace grows.
function edgePulse(ctx, w, h, trace, time) {
  const beat = 0.5 + 0.5 * Math.sin(time * (2 + trace * 10));
  const a = Math.min(trace, 1) * (0.15 + 0.35 * beat);
  const band = Math.min(w, h) * 0.12;
  const sides = [
    [0, 0, 0, band, 0, 0, w, band],
    [0, h, 0, h - band, 0, h - band, w, band],
    [0, 0, band, 0, 0, 0, band, h],
    [w, 0, w - band, 0, w - band, 0, band, h],
  ];
  sides.forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(220,30,40,${a})`);
    g.addColorStop(1, 'rgba(220,30,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  });
}

/// A short burst of torn bands and a flash.
function glitch(ctx, w, h, left, time) {
  ctx.fillStyle = `rgba(120,200,255,${0.10 * left})`;
  ctx.fillRect(0, 0, w, h);
  const n = 6;
  for (let i = 0; i < n; i += 1) {
    const k = Math.sin(time * 91 + i * 13.7);
    const y = ((k + 1) / 2) * h;
    const bh = 2 + Math.abs(Math.sin(time * 37 + i)) * 14;
    ctx.fillStyle = i % 2 ? `rgba(255,40,90,${0.25 * left})` : `rgba(40,255,200,${0.25 * left})`;
    ctx.fillRect(k * 30 * left, y, w, bh);
  }
}
