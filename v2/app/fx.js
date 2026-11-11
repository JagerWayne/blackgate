import { SOUNDS, setDrone } from '../game/core/sound.js';
import { traceWarnAt } from '../game/systems/sessionTick.js';

const GLITCH = 0.35;

/// The sounds and the screen effects over the desktop, as in the classic game (pages/render/fx.js, which draws them on
/// the canvas): scanlines, a red pulse at the edges while a trace closes in, a glitch on connect and disconnect, a shake on
/// bad news, and the sound that goes with each thing that happened since the last frame. Settings switch them off
/// (game.settings.sound and game.settings.effects). Returns update(dt), which main.js calls every frame.
export function mountFx(state) {
  const layer = (cls, style = '') => Object.assign(document.createElement('div'), { className: `absolute inset-0 ${cls}` });
  const root = document.createElement('div');
  root.className = 'pointer-events-none fixed inset-0 z-[44]';
  const lines = layer('', '');
  lines.style.background = 'repeating-linear-gradient(0deg, rgb(0 0 0 / 0.10) 0 1px, transparent 1px 3px)';
  const pulse = layer('');
  const flash = layer('');
  const bars = Array.from({ length: 6 }, () => { const b = document.createElement('div'); b.className = 'absolute left-0 w-full'; return b; });
  const hit = layer('');
  root.append(lines, pulse, flash, hit, ...bars);
  document.body.append(root);
  const desktop = document.getElementById('desktop');

  const fx = { linked: false, online: false, tasks: 0, alarmT: 0, glitchT: 0, shake: 0, over: false };

  // a press or a key is heard as the classic game does (a click, or a key tick while typing)
  const heard = () => state.mode === 'play' && state.game && state.game.settings.sound !== false;
  addEventListener('pointerdown', () => { if (heard()) SOUNDS.click(); }, true);
  addEventListener('keydown', (e) => { if (heard() && e.key.length === 1) SOUNDS.key(); }, true);

  return function update(dt) {
    const game = state.game;
    if (!game || state.mode !== 'play') {
      root.hidden = true;
      setDrone(-1);
      return;
    }
    root.hidden = false;
    const s = game.session;
    const sound = game.settings.sound !== false;
    const effects = game.settings.effects !== false;
    const play = (name) => { if (sound) SOUNDS[name](); };

    // what changed since the last frame
    if (!!s !== fx.linked) {
      fx.glitchT = GLITCH;
      play(s ? 'connect' : 'disconnect');
    } else if (s && s.phase === 'online' && !fx.online) {
      fx.glitchT = GLITCH * 0.6;
      play('done');
    }
    const tasks = s?.tasks.length ?? 0;
    if (s && tasks < fx.tasks) play('done');
    else if (s && tasks > fx.tasks) play('start');
    // a toast is heard once: money chimes, bad news warns and shakes the screen
    game.toasts.forEach((t) => {
      if (t.heard) return;
      t.heard = true;
      if (t.kind === 'money') play('money');
      else if (t.kind === 'bad') { play('warn'); fx.shake = 1; if (effects) { hit.classList.remove('hit-flash'); void hit.offsetWidth; hit.classList.add('hit-flash'); } }
    });
    if (game.gameOver && !fx.over) { fx.over = true; fx.shake = 1; }
    if (sound) setDrone(s && s.phase === 'online' ? s.trace : -1);
    else setDrone(-1);
    fx.shake = Math.max(fx.shake - dt * 4, 0);
    fx.linked = !!s;
    fx.online = s?.phase === 'online';
    fx.tasks = tasks;

    // the trace: an alarm that beats faster as it closes in
    const danger = s?.alerted ? s.trace : 0;
    if (s && danger >= traceWarnAt(game)) {
      fx.alarmT -= dt;
      if (fx.alarmT <= 0) {
        if (sound) SOUNDS.alarm(danger);
        fx.alarmT = Math.max(1.2 - danger, 0.25);
      }
    }

    // the pictures
    lines.hidden = !effects;
    desktop.classList.toggle('aberrate', effects && fx.glitchT > 0);
    desktop.style.transform = effects && fx.shake > 0 ? `translate(${((Math.random() - 0.5) * 12 * fx.shake).toFixed(1)}px, ${((Math.random() - 0.5) * 12 * fx.shake).toFixed(1)}px)` : '';
    if (effects && danger > 0) {
      const beat = 0.5 + 0.5 * Math.sin(state.time * (2 + danger * 10));
      const a = Math.min(danger, 1) * (0.15 + 0.35 * beat);
      pulse.style.boxShadow = `inset 0 0 ${Math.round(Math.min(innerWidth, innerHeight) * 0.12)}px 8px rgba(220,30,40,${(a * 1.6).toFixed(3)})`;
    } else pulse.style.boxShadow = 'none';
    if (effects && fx.glitchT > 0) {
      const left = fx.glitchT / GLITCH;
      flash.style.background = `rgba(120,200,255,${(0.10 * left).toFixed(3)})`;
      bars.forEach((b, i) => {
        const k = Math.sin(state.time * 91 + i * 13.7);
        b.style.display = 'block';
        b.style.top = `${((k + 1) / 2) * 100}%`;
        b.style.height = `${2 + Math.abs(Math.sin(state.time * 37 + i)) * 14}px`;
        b.style.transform = `translateX(${(k * 30 * left).toFixed(1)}px)`;
        b.style.background = i % 2 ? `rgba(255,40,90,${(0.25 * left).toFixed(3)})` : `rgba(40,255,200,${(0.25 * left).toFixed(3)})`;
      });
      fx.glitchT -= dt;
    } else {
      flash.style.background = 'transparent';
      bars.forEach((b) => { b.style.display = 'none'; });
    }
  };
}
