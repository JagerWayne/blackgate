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
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/// The game's sounds by name.
export const SOUNDS = {
  click: () => tone(1800, 0.02, 'square', 0.02),
  key: () => tone(2400, 0.015, 'square', 0.012),
  done: () => { tone(880, 0.07, 'sine', 0.06); tone(1320, 0.1, 'sine', 0.06, 0.07); },
  connect: () => { tone(440, 0.06, 'sawtooth', 0.03); tone(660, 0.06, 'sawtooth', 0.03, 0.06); tone(990, 0.12, 'sawtooth', 0.03, 0.12); },
  disconnect: () => { tone(660, 0.06, 'sawtooth', 0.03); tone(330, 0.15, 'sawtooth', 0.03, 0.06); },
  alarm: () => tone(520, 0.12, 'triangle', 0.07),
};
