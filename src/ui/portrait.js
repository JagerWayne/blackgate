// Portraits: a face for every person, picked from the image folders, and the
// placeholder while it loads or when a folder is empty.

import { portraits } from '../data/content.js';
import { color } from '../core/theme.js';

const BASE = './data/images/people/';

/// The placeholder for each sex.
export const PLACEHOLDER = { M: `${BASE}ph-male.jpg`, F: `${BASE}ph-female.jpg` };

/// The portrait of a person. Picked from the world seed and the place in the
/// list, so it is the same every time and survives a change of name; a change
/// of sex picks from the other folder.
export function portraitOf(game, index) {
  const sex = game.world.people[index]?.sex === 'F' ? 'F' : 'M';
  const folder = sex === 'F' ? 'female' : 'male';
  const list = portraits()?.[folder] ?? [];
  if (!list.length) return PLACEHOLDER[sex];
  let h = 2166136261;
  for (const ch of `${game.seed}:${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `${BASE}${folder}/${list[h % list.length]}`;
}

/// The images loaded so far, by path.
const cache = new Map();
/// How long a failed load waits before it is tried again.
const RETRY_MS = 30000;

/// A loaded image, or null while it loads (or where there is no browser).
export function loadedImage(src) {
  if (typeof Image === 'undefined') return null;
  let img = cache.get(src);
  // a load that failed is tried again after a while, not shown as missing for ever
  if (img?.failedAt && Date.now() - img.failedAt > RETRY_MS) img = null;
  if (!img) {
    img = new Image();
    img.onerror = () => {
      img.failedAt = Date.now();
      console.warn('portrait: could not load', src);
    };
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/// Draws a portrait filling a box, cropped to fit; the placeholder until the
/// photo has loaded.
export function drawPortrait(ctx, sk, r, src, sex) {
  ctx.fillStyle = color(sk.inset);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const img = loadedImage(src) ?? loadedImage(PLACEHOLDER[sex === 'F' ? 'F' : 'M']);
  if (img) {
    const s = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const sw = r.w / s;
    const sh = r.h / s;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = color(sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}
