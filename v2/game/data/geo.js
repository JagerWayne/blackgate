// Where the land is: the country under a map point, and a way to keep a host off the sea.

import { cities, countries } from './content.js';

/// Is a map point inside a ring of x, y pairs? (even-odd rule)
function inRing(ring, fx, fy) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (yi > fy !== yj > fy && fx < ((xj - xi) * (fy - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/// The country under a map point, or null over the sea.
export function countryAt(fx, fy) {
  return countries().find(({ box: [x0, y0, x1, y1], rings }) =>
    fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1 && rings.some((ring) => inRing(ring, fx, fy))) ?? null;
}

/// A point kept on land: if it is over the sea (or, with `sameAsCity`, in another country than its city), it is pulled
/// back toward the city by halves until it is not. No random draws, so a seed's world keeps its shape.
export function onLand(x, y, city, sameAsCity = true) {
  const f = Math.fround;
  const c = cities()[city];
  const home = sameAsCity ? countryAt(c.x, c.y) : null;
  const ok = (px, py) => { const at = countryAt(px, py); return at !== null && (home === null || at === home); };
  if (ok(x, y)) return [x, y];
  for (let t = 0.5; t > 0.02; t /= 2) {
    const px = f(c.x + (x - c.x) * t);
    const py = f(c.y + (y - c.y) * t);
    if (ok(px, py)) return [px, py];
  }
  // a city on the coast may itself read as sea on the coarse outlines: take the nearest land around it
  for (let r = 0.005; r <= 0.12; r += 0.005) {
    for (let k = 0; k < 16; k += 1) {
      const px = f(c.x + r * Math.cos((k * Math.PI) / 8));
      const py = f(c.y + r * Math.sin((k * Math.PI) / 8));
      if (countryAt(px, py) !== null) return [px, py];
    }
  }
  return [c.x, c.y];
}

/// Puts every host of a world on land (for saves made before hosts were kept off the sea).
export function keepHostsOnLand(hosts) {
  hosts.forEach((h) => { if (cities()[h.city]) [h.x, h.y] = onLand(h.x, h.y, h.city, h.company !== null && h.company !== undefined); });
}
