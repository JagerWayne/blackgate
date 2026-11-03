// The companies, their hosts, their staff and the bank accounts.

import { range, chance, pick } from '../core/rng.js';
import {
  cities, companyPrefix, companySuffix, firstNames, lastNames, roles,
} from './content.js';
import { CO_LABEL, CO_SEC_BONUS, CO_PREFIX_GROUP } from './enums.js';
import { buildHostContent } from './worldContent.js';
/// The companies, in the order they are built.
const COMPANY_PLAN = [
  'tech', 'bank', 'health', 'retail', 'media', 'tech', 'aiLab', 'gov', 'energy',
  'telecom', 'crypto', 'security', 'logistics', 'university', 'tech', 'bank',
  'retail', 'health', 'aiLab', 'gov', 'media', 'telecom', 'tech', 'bank',
  'crypto', 'retail', 'security', 'logistics', 'aiLab', 'energy', 'university',
  'tech', 'gov', 'health', 'media', 'retail',
  'telecom', 'security', 'energy', 'crypto',
];

/// Everyone in a new world: the staff, then civilians up to this many.
const POPULATION = 2000;

/// What a civilian does, and where their mail lives.
const CIVILIAN_JOBS = [
  'FREELANCER', 'STUDENT', 'RETIREE', 'NURSE', 'TEACHER', 'DRIVER', 'CHEF', 'ARTIST', 'MECHANIC',
  'SHOP ASSISTANT', 'ELECTRICIAN', 'PHOTOGRAPHER', 'BARISTA', 'ACCOUNTANT', 'PLUMBER', 'WRITER',
];
const MAIL_HOSTS = ['mailbox.nx', 'netpost.nx', 'quickmail.nx', 'inbox.nx'];

/// Builds every company, its hosts, its staff and the bank accounts.
export function buildCompanies(rng, hosts, companies, people, accounts, usedIps, mkHost) {
  // two soft companies are always built: the first jobs need hosts with no
  // firewall, monitor or proxy
  let softLeft = 2;
  COMPANY_PLAN.forEach((kind, i) => {    const prefixes = companyPrefix();
    const prefix = prefixes[(i * 7 + 3) % prefixes.length];
    const group = CO_PREFIX_GROUP[kind] ?? 'generic';
    const suffix = companySuffix(group)[i % companySuffix(group).length];
    const name = `${prefix} ${suffix}`;
    const short = `${prefix.slice(0, 3)}${10 + i}`;
    const city = range(rng, 0, cities().length);
    const soft = softLeft > 0 && (CO_SEC_BONUS[kind] ?? 0) === 0;
    if (soft) softLeft -= 1;
    const wealth = 1 + range(rng, 0, 4);
    const idx = companies.length;
    companies.push({
      name,
      short: short.toLowerCase(),
      kind,
      city,
      wealth,
      hosts: [],
      blurb: `${CO_LABEL[kind]} firm headquartered in ${cities()[city].name}.`,
    });

    const baseSec = (CO_SEC_BONUS[kind] ?? 0) + Math.floor(wealth / 2);
    const nHosts = 2 + Math.floor(wealth / 2) + (chance(rng, 0.4) ? 1 : 0);
    const hostRoles = hostRolesFor(kind);
    for (let h = 0; h < nHosts; h += 1) {
      const role = hostRoles[h % hostRoles.length];
      // the last host of a company is its crown jewel and one step harder; the
      // firewall, the monitor and the proxy each reach 5 there
      const core = h === nHosts - 1 ? 1 : 0;
      const sec = soft
        ? [0, 0, 0, 1]
        : [
          Math.min(Math.max(baseSec - 1 + core, 0), 5),
          Math.min(baseSec + core, 5),
          Math.min(Math.max(baseSec - 1 + core, 0), 5),
          Math.min(baseSec + 1, 8),
        ];
      const hid = mkHost(rng, hosts, companies, idx, hostKindFor(kind), role, city, sec, usedIps);
      companies[idx].hosts.push(hid);
      buildHostContent(rng, hosts[hid], kind, role, wealth);
      if (soft) softFile(hosts[hid]);
    }

    // the staff
    const nPeople = 15 + range(rng, 0, 16);
    for (let p = 0; p < nPeople; p += 1) {
      const { name: first, sex } = pick(rng, firstNames());
      const last = pick(rng, lastNames());
      const role = pick(rng, roles());
      people.push({
        name: `${first} ${last}`,
        sex,
        ...personRecord(`${first} ${last}`, people.length),
        company: idx,
        city,
        role,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${short.toLowerCase()}.nx`,
        social: `@${last.toLowerCase()}${range(rng, 10, 99)}`,
        clearance: range(rng, 1, 5),
        leak: `${first.toLowerCase()}${range(rng, 1960, 2006)}${['!', '?', '1', '#'][range(rng, 0, 4)]}`,
      });
    }
  });

  // the civilians: no company, a job of their own, mail at a public provider.
  // Most of them never matter; the world is fuller for them.
  while (people.length < POPULATION) {
    const { name: first, sex } = pick(rng, firstNames());
    const last = pick(rng, lastNames());
    people.push({
      name: `${first} ${last}`,
      sex,
      ...personRecord(`${first} ${last}`, people.length),
      company: null,
      city: range(rng, 0, cities().length),
      role: pick(rng, CIVILIAN_JOBS),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${range(rng, 1, 99)}@${pick(rng, MAIL_HOSTS)}`,
      social: `@${first.toLowerCase()}${last.toLowerCase().slice(0, 3)}${range(rng, 10, 99)}`,
      clearance: 0,
      leak: `${last.toLowerCase()}${range(rng, 1960, 2006)}${['!', '?', '1', '#'][range(rng, 0, 4)]}`,
    });
  }

  // the bank accounts
  companies.forEach((c) => {
    if (c.kind !== 'bank') return;
    const host = c.hosts[0];
    for (let i = 0; i < 14; i += 1) {
      let owner;
      if (chance(rng, 0.4)) {
        owner = `${pick(rng, firstNames()).name} ${pick(rng, lastNames())}`;
      } else {
        const pre = companyPrefix();
        const suf = companySuffix('generic');
        owner = `${pre[range(rng, 0, pre.length)]} ${suf[range(rng, 0, suf.length)]}`;
      }
      accounts.push({
        host,
        number: `NX${String(i).padStart(2, '0')}${range(rng, 100000, 999999)}`,
        owner,
        balance: range(rng, 1200, 900000),
        bank: c.name,
        player: false,
      });
    }
  });
}

/// Gives a host a plain file small enough for a fresh gateway, so the first
/// jobs always have something the operator can take.
function softFile(host) {
  const f = host.files[0];
  if (!f) return;
  f.size = Math.min(f.size, 12);
  f.enc = 0;
}

/// The host names a company of this kind uses.
function hostRolesFor(kind) {
  switch (kind) {
    case 'bank': return ['core', 'clearing', 'audit', 'vault', 'atmnet'];
    case 'aiLab': return ['train', 'infer', 'weights', 'data', 'edge'];
    case 'gov': return ['admin', 'records', 'citizen', 'mail', 'vpn'];
    case 'telecom': return ['edge', 'core', 'billing', 'noc', 'dns'];
    case 'health': return ['records', 'imaging', 'pharmacy', 'billing', 'portal'];
    case 'university': return ['portal', 'research', 'grades', 'library', 'vpn'];
    default: return ['mail', 'files', 'records', 'db', 'vpn'];
  }
}

/// The kind of host a company of this kind runs.
function hostKindFor(kind) {
  switch (kind) {
    case 'bank': return 'bank';
    case 'gov': return 'gov';
    case 'aiLab': return 'aiLab';
    case 'telecom': return 'router';
    default: return 'corporate';
  }
}

/// The offences a criminal record can hold.
export const OFFENCES = ['FRAUD', 'THEFT', 'ASSAULT', 'FORGERY', 'TAX EVASION', 'CYBERCRIME'];

/// The record a person carries: vital status, criminal record and SSN. It is
/// derived from the name and the place in the list, never drawn from the
/// generator, so adding it leaves every host of a seed as it was.
export function personRecord(name, index) {
  let h = 2166136261;
  for (const ch of `${index}:${name}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return {
    status: h % 9 === 0 ? 'DECEASED' : 'ACTIVE',
    criminalRecord: (h >>> 4) % 5 === 0 ? OFFENCES[(h >>> 8) % OFFENCES.length] : 'CLEAN',
    // the last four digits are the place in the list, so no two people share one
    ssn: `${100 + (h % 800)}-${10 + ((h >>> 12) % 90)}-${1000 + index}`,
  };
}
