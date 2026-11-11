// The world: the cities, companies, people, hosts and accounts a seed builds.
// Everything is drawn from one seeded stream, so a seed always gives the
// same network.

import { makeRng, range, nextF32 } from '../core/rng.js';
import { cities } from './content.js';
import { buildCompanies } from './worldCompanies.js';
import { markInternal } from './network.js';
import { onLand, keepHostsOnLand } from './geo.js';
import { relayCount } from './settings.js';

/// Builds the whole world for a seed.
export function generateWorld(seed) {
  const rng = makeRng(BigInt(seed) ^ 0xa5a512349e370001n);
  const hosts = [];
  const companies = [];
  const people = [];
  const accounts = [];
  const usedIps = [];

  // unused since the public hosts take their nearest city, but the draw stays:
  // removing it would shift every later draw and change every seed's world
  const homeCity = range(rng, 0, cities().length);
  const nic = pushPublic(hosts, 'nic', 'nic.nx', '10.0.0.1', 80, 'registry', 0.5, 0.36);
  const news = pushPublic(hosts, 'newswire', 'newswire.nx', '10.0.0.2', 80, 'feed', 0.47, 0.3);
  const blackgate = pushPublic(hosts, 'blackgate', 'blackgate.onion', '10.0.0.66', 666, 'board', 0.52, 0.44);

  // the relays
  for (let i = 0; i < relayCount(); i += 1) {
    const city = range(rng, 0, cities().length);
    const id = mkHost(rng, hosts, companies, null, 'relay', `relay-${String(i).padStart(2, '0')}`, city, [1, 1, 0, 2], usedIps);
    hosts[id].discovered = true;
    hosts[id].name = `${cities()[city].name.toLowerCase()} relay`;
    hosts[id].services.push({ name: 'proxy', port: 1080, kind: 'proxy', password: 0, open: true, visible: true });
    hosts[id].files.push({ name: 'relay_access.log', size: 3, enc: 0, tag: 0, content: 'rotated hourly', deleted: false });
  }

  buildCompanies(rng, hosts, companies, people, accounts, usedIps, mkHost);
  keepHostsOnLand(hosts);
  markInternal({ hosts, companies });
  return { companies, hosts, people, accounts, nic, news, blackgate, homeCity };
}

/// The city closest to a point on the map.
function nearestCity(x, y) {
  let best = 0;
  cities().forEach((c, i) => {
    const b = cities()[best];
    if ((c.x - x) ** 2 + (c.y - y) ** 2 < (b.x - x) ** 2 + (b.y - y) ** 2) best = i;
  });
  return best;
}

/// The public infrastructure hosts.
function pushPublic(hosts, name, domain, ip, port, service, x, y) {
  const id = hosts.length;
  const city = nearestCity(x, y);
  hosts.push({
    id,
    company: null,
    name,
    domain,
    ip,
    kind: 'public',
    proxy: 0, firewall: 0, monitor: 0, trace: 0,
    services: [{ name: service, port, kind: 'web', password: 0, open: true, visible: true }],
    files: [],
    logs: [],
    x, y, city,
    discovered: true,
    relay: false,
  });
  return id;
}

/// Builds one host and puts it in the list.
function mkHost(rng, hosts, companies, company, kind, role, city, sec, usedIps) {
  const id = hosts.length;
  const short = company === null ? 'nx' : companies[company].short;
  let ip = '';
  for (;;) {
    const cand = `${11 + range(rng, 0, 200)}.${range(rng, 0, 256)}.${range(rng, 0, 256)}.${2 + range(rng, 0, 250)}`;
    if (!usedIps.includes(cand)) {
      usedIps.push(cand);
      ip = cand;
      break;
    }
  }
  const c = cities()[city];
  hosts.push({
    id,
    company,
    name: company === null ? role : `${short.toLowerCase()}-${role}`,
    domain: `${role}.${short.toLowerCase()}.nx`,
    ip,
    kind,
    proxy: sec[0], firewall: sec[1], monitor: sec[2], trace: sec[3],
    services: [],
    files: [],
    logs: [],
    x: jitter(c.x, rng, 0.02, 0.96),
    y: jitter(c.y, rng, 0.04, 0.96),
    city,
    discovered: false,
    relay: kind === 'relay',
  });
  return id;
}

/// Nudges a point off the city, in single precision.
function jitter(base, rng, lo, hi) {
  const f = Math.fround;
  const v = f(f(f(base + f(nextF32(rng) * 0.05)) - 0.02));
  return Math.min(Math.max(v, lo), hi);
}
