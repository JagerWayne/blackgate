// Two more sites, built from the shell's own controls (the DOM draws those with no extra code): LinkedUp, where the staff and
// vacancies of every company are, and nslookup.nx, which turns a company into the host names it shows to the outside.

import { field, keyValue, para, label, custom } from '../../ui/controls.js';
import { flat } from '../../ui/styles.js';
import { FONT } from '../../../game/core/text.js';
import { NET } from './theme.js';
import { pageHeader, heading } from './shared.js';
import { siteUrl, staffOf } from '../../../game/state/sites.js';
import { knows, isPublic } from '../../../game/state/intel.js';
import { openingsOf, namesOf } from '../../../game/state/siteInfo.js';
import { whoisSearch } from '../../../game/state/whois.js';
import { t as tl } from '../../../game/data/language.js';

const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase());

/// linkedup.nx: the companies that are hiring, and a company's people. Drawn by app/apps/dsnWeb.js as a site of its own, with no side panel.
export function linkedUpPage(game, rest) {
  const m = /^c\/(\d+)$/.exec(rest);
  if (rest && !m) return null;
  const D = (type, extra = {}) => Object.assign(custom(40, () => {}), { dom: { type, game, ...extra } });
  const site = { site: 'web', bg: '#eef1f6', accent: 0x2557a7 };
  if (!m) return { title: 'linkedup.nx', ...site, controls: [D('lu-home')] };
  const ci = Number(m[1]);
  const c = game.world.companies[ci];
  if (!c) return null;
  return { title: `linkedup.nx/${c.short.toLowerCase()}`, ...site, controls: [D('lu-company', { ci })] };
}

/// nslookup.nx: the host names a company shows to the outside. Not all of them, and no address for a host you have not found.
export function nsLookupPage(game, view = {}) {
  const q = view.nsQuery ?? '';
  const found = q.trim() ? whoisSearch(game, q).slice(0, 5) : [];
  const out = [
    pageHeader({ path: 'dsn://nslookup.nx', title: 'nslookup.nx', sub: tl('windows.dsn.web2.what_a_company_shows'), accent: NET.ok }),
    field('ns.q', q, 'type a company name or domain: vantasystems.nx'),
  ];
  if (!q.trim()) out.push(para('Type any name found here after ping in the Command Prompt. An answer puts the host on your map.'));
  else if (!found.length) out.push(label(`no company matches "${q.trim()}"`, FONT.body, NET.danger));
  found.forEach((ci) => {
    const c = game.world.companies[ci];
    const names = namesOf(game, ci);
    out.push(heading(c.name.toUpperCase(), `${names.length} name${names.length === 1 ? '' : 's'}`));
    names.forEach((n) => out.push(keyValue(n.name, n.ip ?? 'resolves // no address on record')));
    out.push(label('other hosts may exist that this index does not list', FONT.body, NET.dim));
  });
  return { title: 'nslookup.nx', accent: NET.ok, controls: out };
}
