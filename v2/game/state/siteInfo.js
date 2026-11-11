// What the extra websites say about a company: vacancies, press releases and the names a lookup shows. Everything is worked
// out from the seed, the company and its people, so no random draw is spent and an old save reads the same.

import { cities } from '../data/content.js';
import { seedHash, staffOf } from './sites.js';

const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());
const LEVELS = ['Junior', 'Senior', 'Lead'];

/// The vacancies of a company: a few of the roles it already employs, with the person the post reports to.
export function openingsOf(game, ci) {
  const c = game.world.companies[ci];
  const staff = staffOf(game, ci);
  const roles = [...new Set(staff.map((i) => game.world.people[i].role))];
  if (!roles.length) return [];
  const n = Math.min(roles.length, 2 + (seedHash(game, 'jobs', ci) % 3));
  const from = seedHash(game, 'jobs-at', ci) % roles.length;
  return Array.from({ length: n }, (_, k) => {
    const role = roles[(from + k) % roles.length];
    const boss = staff.find((i) => game.world.people[i].role === role);
    return { role: title(role), level: LEVELS[seedHash(game, 'lvl', ci, k) % LEVELS.length], boss, city: title(cities()[c.city]?.name) };
  });
}

/// The role names of a company's hosts that face the outside (`files` for `files.mal14.nx`).
export function hostRoles(game, ci) {
  return game.world.companies[ci].hosts.map((id) => game.world.hosts[id]).filter((h) => !h.internal).map((h) => h.domain.split('.')[0]);
}

/// Three press releases. One of them mentions a server by its role.
export function pressOf(game, ci) {
  const c = game.world.companies[ci];
  const staff = staffOf(game, ci);
  const roles = hostRoles(game, ci);
  const city = title(cities()[seedHash(game, 'pr-city', ci) % cities().length]?.name);
  const boss = staff.length ? game.world.people[staff[0]] : null;
  const role = roles.length ? roles[seedHash(game, 'pr-host', ci) % roles.length] : 'data';
  const week = (k) => `Week ${1 + (seedHash(game, 'pr-week', ci, k) % 52)}`;
  return [
    { when: week(0), headline: `${c.name} opens a new office in ${city}`, text: `The company says the new site will house a small team and a meeting room for local clients.` },
    boss && { when: week(1), headline: `${c.name} appoints ${title(boss.name)} as ${title(boss.role)}`, text: `${title(boss.name)} joins the leadership team and will report to the board.` },
    { when: week(2), headline: `${c.name} upgrades its ${role} servers`, text: `Customers may see short interruptions while the ${role} systems move to new hardware.` },
  ].filter(Boolean);
}

/// The names a lookup shows for a company: about six in ten of its outside hosts, and the address only of hosts the operator has already found.
export function namesOf(game, ci) {
  return game.world.companies[ci].hosts.map((id) => game.world.hosts[id])
    .filter((h) => !h.internal && (h.discovered || seedHash(game, 'ns', h.id) % 100 < 60))
    .map((h) => ({ name: h.domain, ip: h.discovered ? h.ip : null, id: h.id }));
}
