// bazaar.nx: selling copied files, and the leaked pastes. Prices, traps and pastes are worked out from the seed and the day,
// so no random draw is spent.

import { seedHash, staffOf } from './sites.js';
import { pastes } from '../data/content.js';
import { pay, toast } from './gameHelpers.js';
import { t as tl } from '../data/language.js';

const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
const day = (game) => Math.floor(game.clock.minutes / 1440);

/// What the market pays for a file: more for big files, plus a steady wobble per file.
export function priceOf(game, f) {
  return 150 + Math.round(f.size * 40) + (seedHash(game, 'price', f.name, f.source ?? '') % 200);
}

/// Whether today's buyer for a file is a trap: about one in twelve.
export function isTrap(game, f) {
  return seedHash(game, 'trap', f.name, day(game)) % 12 === 0;
}

/// Sells the file at a place in storage. An encrypted file does not sell. A trap takes the file, pays nothing and raises heat.
export function sellFile(game, n) {
  const f = game.player.storage[n];
  if (!f) return false;
  if (f.enc > 0) { toast(game, tl('state.bazaar.is_encrypted_nobody_buys', f.name), 'bad'); return false; }
  game.player.storage.splice(n, 1);
  if (isTrap(game, f)) {
    game.player.heat = Math.min(100, game.player.heat + 10);
    toast(game, tl('state.bazaar.the_buyer_for_was', f.name), 'bad');
    return true;
  }
  const price = priceOf(game, f);
  pay(game, price, `sold ${f.name}`);
  toast(game, tl('state.bazaar.sold_for_cr', f.name, price), 'good');
  return true;
}

/// Today's leaked pastes: a staff member's email dump, or a server a company forgot to hide.
export function pastesOf(game) {
  const cos = game.world.companies.map((c, ci) => ci).filter((ci) => staffOf(game, ci).length);
  if (!cos.length) return [];
  return Array.from({ length: 6 }, (_, k) => {
    const ci = cos[seedHash(game, 'paste-co', day(game), k) % cos.length];
    const c = game.world.companies[ci];
    const staff = staffOf(game, ci);
    const who = staff[seedHash(game, 'paste-who', day(game), k) % staff.length];
    const hosts = c.hosts.map((id) => game.world.hosts[id]).filter((h) => !h.internal);
    const host = hosts.length ? hosts[seedHash(game, 'paste-host', day(game), k) % hosts.length] : null;
    const useHost = k % 2 && host ? host : null;
    const list = pastes()[useHost ? 'ssh' : 'mail'];
    const person = game.world.people[who];
    const text = list[seedHash(game, 'paste-text', day(game), k) % list.length]
      .replaceAll('{co}', c.name).replaceAll('{short}', c.short.toLowerCase()).replaceAll('{name}', title(person.name)).replaceAll('{email}', person.email)
      .replaceAll('{role}', useHost ? useHost.domain.split('.')[0] : '').replaceAll('{domain}', useHost?.domain ?? '').replaceAll('{host}', useHost?.name ?? '');
    return { id: k + 1, ci, who, host: useHost, text };
  });
}
