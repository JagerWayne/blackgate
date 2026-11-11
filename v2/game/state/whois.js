// WHOIS records: what the domain registry says about each company's website.
// Everything is worked out from the world seed, so a record is the same every
// time and nothing is stored. Some companies pay for privacy and their contact
// details read "REDACTED FOR PRIVACY", as on the real thing.

import { siteUrl, seedHash, staffOf } from './sites.js';
import { cities } from '../data/content.js';

/// The registrars a domain can be bought from.
export const REGISTRARS = [
  { name: 'Meridian Registry Ltd', host: 'meridianregistry.nx', iana: 1481 },
  { name: 'NovaDomains Inc.', host: 'novadomains.nx', iana: 2207 },
  { name: 'Blackwater Names LLC', host: 'blackwaternames.nx', iana: 3390 },
  { name: 'Quill & Sons Registrar', host: 'quillandsons.nx', iana: 4122 },
  { name: 'OpenGate Domains', host: 'opengatedomains.nx', iana: 5018 },
];

/// The share of companies (in percent) that hide their contact details.
export const PRIVACY_PERCENT = 45;

/// The day the game's world starts: the registry's "now" moves on from it.
const START = Date.UTC(2027, 2, 12);

/// The address a company's domain is registered as: its site without `www.`.
export function domainOf(c) { return siteUrl(c).replace(/^www\./, ''); }

/// The company whose domain this is, or -1.
export function companyOfDomain(game, domain) {
  const d = String(domain).trim().toLowerCase().replace(/^www\./, '');
  return game.world.companies.findIndex((c) => domainOf(c) === d);
}

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/// The registry's "now", as an ISO date: the world's day plus the game clock.
export function registryNow(game) { return iso(START + (game.clock?.minutes ?? 0) * 60000); }

/// The WHOIS record of a company's domain.
export function whoisRecord(game, ci) {
  const c = game.world.companies[ci];
  if (!c) return null;
  const h = (k, mod) => seedHash(game, `whois${k}`, ci) % mod;
  const registrar = REGISTRARS[h('registrar', REGISTRARS.length)];
  const year = 1996 + h('year', 29);
  const created = Date.UTC(year, h('month', 12), 1 + h('day', 27), h('hour', 24), h('minute', 60), h('second', 60));
  // renewed some time in the 18 months before the world starts, expires 1 to 3 years on
  const updated = START - (10 + h('updated', 540)) * 86400000 + h('uhour', 86400) * 1000;
  const made = new Date(created);
  const expires = Date.UTC(2028 + h('expiry', 3), made.getUTCMonth(), made.getUTCDate(), made.getUTCHours());
  const city = cities()[c.city]?.name ?? '';
  const redacted = h('privacy', 100) < PRIVACY_PERCENT;
  const staff = staffOf(game, ci);
  const admin = staff.length ? staff[h('admin', staff.length)] : null;
  const status = [['clientTransferProhibited'], ['clientTransferProhibited', 'clientDeleteProhibited'], ['ok']][h('status', 3)];
  return {
    ci,
    domain: domainOf(c),
    id: `D${100000 + h('id', 899999)}-NX`,
    registrar: { ...registrar, abuseEmail: `abuse@${registrar.host}`, abusePhone: `+1.555${String(100 + h('abuse', 899))}0` },
    created: iso(created),
    updated: iso(updated),
    expires: iso(expires),
    status,
    nameServers: [`ns1.${registrar.host}`, `ns2.${registrar.host}`],
    dnssec: h('dnssec', 4) === 0 ? 'signedDelegation' : 'unsigned',
    org: c.name,
    city: city.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()),
    country: 'NX',
    redacted,
    admin: redacted ? null : admin,
    hostmaster: `hostmaster@${c.short.toLowerCase()}.nx`,
    phone: `+1.555${String(ci).padStart(2, '0')}0000`,
  };
}

/// The companies whose domain or name matches a search, best match first.
export function whoisSearch(game, query) {
  const q = String(query ?? '').trim().toLowerCase().replace(/^www\./, '');
  if (!q) return [];
  return game.world.companies
    .map((c, ci) => ({ ci, d: domainOf(c), n: c.name.toLowerCase() }))
    .filter((e) => e.d.includes(q) || e.n.includes(q))
    .sort((a, b) => (b.d === q) - (a.d === q) || (b.d.startsWith(q) - a.d.startsWith(q)) || a.d.localeCompare(b.d))
    .map((e) => e.ci);
}
