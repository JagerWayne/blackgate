// Sound: short tones made in the browser, so the game ships no sound files.
// The audio starts on the operator's first click or key, as browsers ask.

let audio = null;

/// The audio context, made on first use. Null where there is no Web Audio
/// (node, the tests) or the browser refuses it.
function context() {
  if (audio) return audio;
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audio = new Ctor();
  } catch {
    return null;
  }
  return audio;
}

let master = null;
let lastTap = 0;

/// The one output every sound goes through, with a compressor so stacked
/// tones do not clip.
function bus(a) {
  if (!master) {
    const comp = a.createDynamicsCompressor();
    master = a.createGain();
    master.gain.value = 0.8;
    master.connect(comp).connect(a.destination);
  }
  return master;
}

/// A held hum for the live link: silent below zero, louder and more detuned
/// as the trace (0..1) closes in.
export function setDrone(level) {
  const a = context();
  if (!a) return;
  if (!drone) {
    const g = a.createGain();
    g.gain.value = 0;
    const o2 = a.createOscillator();
    [a.createOscillator(), o2].forEach((o) => {
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o.connect(g);
      o.start();
    });
    g.connect(bus(a));
    drone = { g, o2 };
  }
  const t = a.currentTime;
  // quiet: the hum is a bed under the work, not the loudest thing in the room
  drone.g.gain.setTargetAtTime(level < 0 ? 0 : 0.004 + Math.min(level, 1) * 0.012, t, 0.3);
  drone.o2.frequency.setTargetAtTime(55 + Math.max(level, 0) * 6, t, 0.3);
}
let drone = null;

/// One tone: a pitch in Hz, a length in seconds, a wave shape and a volume.
export function tone(freq, dur = 0.08, wave = 'square', vol = 0.05, delay = 0) {
  const a = context();
  if (!a) return;
  if (a.state === 'suspended') a.resume?.();
  const at = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(bus(a));
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/// Runs a keystroke or click sound at most once per 30 ms, so key repeat
/// cannot stack voices.
function tap(fn) {
  const now = globalThis.performance?.now() ?? 0;
  if (now - lastTap < 30) return;
  lastTap = now;
  fn();
}

/// The game's sounds by name.
export const SOUNDS = {
  click: () => tap(() => tone(1800, 0.02, 'square', 0.02)),
  key: () => tap(() => tone(2400, 0.015, 'square', 0.012)),
  done: () => { tone(880, 0.07, 'sine', 0.06); tone(1320, 0.1, 'sine', 0.06, 0.07); },
  connect: () => { tone(440, 0.06, 'sawtooth', 0.03); tone(660, 0.06, 'sawtooth', 0.03, 0.06); tone(990, 0.12, 'sawtooth', 0.03, 0.12); },
  disconnect: () => { tone(660, 0.06, 'sawtooth', 0.03); tone(330, 0.15, 'sawtooth', 0.03, 0.06); },
  // the alarm climbs in pitch as the trace closes in (d is 0..1)
  alarm: (d = 0) => tone(420 + d * 500, 0.1 + d * 0.05, 'triangle', 0.07),
  money: () => [988, 1319, 1760].forEach((f, i) => tone(f, 0.09, 'sine', 0.06, i * 0.06)),
  warn: () => { tone(300, 0.25, 'sawtooth', 0.06); tone(280, 0.25, 'sawtooth', 0.06, 0.12); },
  deny: () => tone(140, 0.12, 'square', 0.05),
  start: () => tone(1100, 0.04, 'square', 0.03),
};
