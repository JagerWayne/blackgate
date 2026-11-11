// The deterministic PCG32 generator: the same seed always draws the same
// numbers, on every machine, so a world seed always builds the same world.
//
// The state is a 64-bit value and a 64-bit increment. JavaScript has no
// 64-bit integer, so the arithmetic runs on BigInt; the draws themselves are
// plain numbers.

const MASK64 = (1n << 64n) - 1n;
const MASK32 = 0xffffffffn;
const MULT = 6364136223846793005n;
const WARMUP = 0x853c49e6748fea9bn;

/// The generator state. `state` and `inc` are BigInt.
export function makeRng(seed, inc) {
  const s = BigInt(seed) & MASK64;
  const rng = {
    state: (s + WARMUP) & MASK64,
    inc: inc === undefined ? ((s << 1n) | 1n) & MASK64 : BigInt(inc) & MASK64,
  };
  nextU32(rng);
  return rng;
}

/// The next 32-bit draw.
export function nextU32(rng) {
  const old = rng.state;
  rng.state = (old * MULT + rng.inc) & MASK64;
  const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & MASK32);
  const rot = Number((old >> 59n) & 31n);
  if (rot === 0) return xorshifted >>> 0;
  return ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0;
}

/// Uniform in [0, 1).
export function nextF32(rng) {
  return (nextU32(rng) >>> 8) / 16777216;
}

/// Uniform in [lo, hi).
export function range(rng, lo, hi) {
  if (hi <= lo) return lo;
  return lo + (nextU32(rng) % (hi - lo));
}

/// True with the given probability.
export function chance(rng, p) {
  return nextF32(rng) < p;
}

/// A random index below `len`.
export function pickIdx(rng, len) {
  if (len <= 0) return 0;
  return nextU32(rng) % len;
}

/// A random element of an array.
export function pick(rng, items) {
  if (!items || items.length === 0) return undefined;
  return items[pickIdx(rng, items.length)];
}

/// Shuffles an array in place.
export function shuffle(rng, items) {
  for (let i = items.length - 1; i >= 1; i -= 1) {
    const j = pickIdx(rng, i + 1);
    const t = items[i];
    items[i] = items[j];
    items[j] = t;
  }
  return items;
}

/// The generator as it is written to a save file.
export function rngToJson(rng) {
  return { state: rng.state.toString(), inc: rng.inc.toString() };
}

/// The generator as it is read back from a save file.
export function rngFromJson(v) {
  if (!v) return makeRng(1);
  return {
    state: BigInt(v.state ?? '0') & MASK64,
    inc: BigInt(v.inc ?? '1') & MASK64,
  };
}
