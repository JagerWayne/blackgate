// whois.nx: the domain registry's lookup site. A search box finds a company's
// domain; its page is a real-looking WHOIS record (registrar, dates, name
// servers, registrant) with what the game knows about the company beside it.
// Companies that pay for privacy show "REDACTED FOR PRIVACY" for their contacts;
// a public contact is a link that puts it in the dossier.

import { custom, field } from '../../ui/controls.js';
import { roundRect } from '../../ui/kit.js';
import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { CO_LABEL } from '../../../game/data/enums.js';
import { cities } from '../../../game/data/content.js';
import { siteUrl } from '../../../game/state/sites.js';
import { isPublic } from '../../../game/state/intel.js';
import { whoisRecord, whoisSearch, companyOfDomain, registryNow } from '../../../game/state/whois.js';
import { detailLink } from './company.js';
import { t as tl } from '../../../game/data/language.js';

const BG = '#eef1f6';
const INK = '#1b2433';
const DIM = '#5d6a80';
const BLUE = '#1f5fbf';
const NAVY = '#13233f';
const inside = (input, r) => input?.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
const press = (input, r) => input?.pressed && inside(input, r);
const go = (events, url) => events.push({ type: 'click', id: `dsn.go.${url}` });
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function plate(ctx, r, fill, radius = 10) {
  ctx.fillStyle = fill;
  roundRect(ctx, r, radius);
  ctx.fill();
}

/// The dark header band with the site's name.
function masthead(sub) {
  return custom(104, (ctx, sk, r) => {
    plate(ctx, { x: r.x, y: r.y, w: r.w, h: 96 }, NAVY, 12);
    plate(ctx, { x: r.x + 22, y: r.y + 22, w: 52, h: 52 }, '#2d7dff', 14);
    drawText(ctx, 'W', r.x + 48, r.y + 48, FONT.title, '#ffffff', { align: 'center', baseline: 'middle' });
    drawText(ctx, 'whois.nx', r.x + 90, r.y + 22, FONT.title, '#ffffff');
    drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w - 110), r.x + 90, r.y + 58, FONT.body, '#9db4d8');
  });
}

/// A result row: the domain, the owner and the registrar.
function resultRows(game, list, heading) {
  const ROW = 56;
  return custom(list.length * ROW + 40, (ctx, sk, r, input, events) => {
    drawText(ctx, heading, r.x + 4, r.y + 6, FONT.body, DIM);
    list.forEach((ci, k) => {
      const rec = whoisRecord(game, ci);
      const row = { x: r.x, y: r.y + 32 + k * ROW, w: r.w, h: ROW - 6 };
      plate(ctx, row, inside(input, row) ? '#e2ebfa' : '#ffffff', 10);
      drawText(ctx, rec.domain, row.x + 16, row.y + 8, FONT.emphasis, BLUE);
      drawText(ctx, ellipsize(ctx, `${rec.org} // registered ${rec.created.slice(0, 4)} // ${rec.registrar.name}`, FONT.body, row.w - 40), row.x + 16, row.y + 30, FONT.body, DIM);
      if (press(input, row)) go(events, `whois.nx/${rec.domain}`);
    });
  });
}

/// The registry's answer, as the lines the real ones use.
export function recordLines(game, rec) {
  const L = [];
  const add = (key, value, link = null) => L.push({ key, value, link });
  const r = rec.registrar;
  add('Domain Name', rec.domain.toUpperCase());
  add('Registry Domain ID', rec.id);
  add('Registrar WHOIS Server', 'whois.nx');
  add('Registrar URL', `https://www.${r.host}`);
  add('Updated Date', rec.updated);
  add('Creation Date', rec.created);
  add('Registry Expiry Date', rec.expires);
  add('Registrar', r.name);
  add('Registrar IANA ID', String(r.iana));
  add('Registrar Abuse Contact Email', r.abuseEmail);
  add('Registrar Abuse Contact Phone', r.abusePhone);
  rec.status.forEach((s) => add('Domain Status', `${s} https://icann.nx/epp#${s}`));
  add('Registry Registrant ID', rec.redacted ? 'REDACTED FOR PRIVACY' : `C${rec.id.slice(1, 7)}-NX`);
  add('Registrant Name', rec.redacted ? 'REDACTED FOR PRIVACY' : 'Domain Administrator');
  add('Registrant Organization', rec.redacted ? 'REDACTED FOR PRIVACY' : rec.org);
  add('Registrant City', rec.redacted ? 'REDACTED FOR PRIVACY' : rec.city);
  add('Registrant Country', rec.country);
  if (rec.redacted) {
    ['Registrant Phone', 'Registrant Email', 'Admin Name', 'Admin Email', 'Tech Email'].forEach((k) => add(k, 'REDACTED FOR PRIVACY'));
  } else {
    add('Registrant Phone', rec.phone);
    add('Registrant Email', rec.hostmaster);
    if (rec.admin !== null) {
      add('Admin Name', title(game.world.people[rec.admin].name));
      const mail = isPublic(game, rec.admin, 'email');
      const tel = isPublic(game, rec.admin, 'phone');
      add('Admin Email', mail ? '' : rec.hostmaster, mail ? { i: rec.admin, field: 'email' } : null);
      add('Admin Phone', tel ? '' : rec.phone, tel ? { i: rec.admin, field: 'phone' } : null);
    } else add('Admin Email', rec.hostmaster);
    add('Tech Email', rec.hostmaster);
  }
  rec.nameServers.forEach((n) => add('Name Server', n.toUpperCase()));
  add('DNSSEC', rec.dnssec);
  return L;
}

const LH = 22;

/// The record card and the game's own notes beside it.
function recordCard(game, rec) {
  const lines = recordLines(game, rec);
  const c = game.world.companies[rec.ci];
  const hosts = c.hosts.map((id) => game.world.hosts[id]);
  const known = hosts.filter((h) => h.discovered).length;
  const staff = game.world.people.filter((p) => p.company === rec.ci).length;
  const hardest = hosts.length ? Math.max(...hosts.map((h) => h.firewall + h.monitor + h.proxy)) : 0;
  const side = (w) => w >= 760;
  const rawH = lines.length * LH + 96;
  return custom((w) => (side(w) ? Math.max(rawH, 300) : rawH + 250) + 12, (ctx, sk, r, input, events) => {
    const wide = side(r.w);
    const lw = wide ? r.w * 0.64 : r.w;
    const raw = { x: r.x, y: r.y, w: lw, h: rawH };
    plate(ctx, raw, '#ffffff', 12);
    drawText(ctx, `Domain Information for ${rec.domain}`, raw.x + 20, raw.y + 16, FONT.emphasis, INK);
    ctx.fillStyle = '#d6deec';
    ctx.fillRect(raw.x + 20, raw.y + 42, raw.w - 40, 1);
    const kw = Math.min(260, raw.w * 0.4);
    lines.forEach((l, k) => {
      const y = raw.y + 56 + k * LH;
      drawText(ctx, `${l.key}:`, raw.x + 20, y, FONT.body, DIM);
      const redacted = l.value === 'REDACTED FOR PRIVACY';
      if (l.link) detailLink(ctx, game, l.link.i, l.link.field, raw.x + 20 + kw, y, raw.w - kw - 40, BLUE, DIM, input, events);
      else drawText(ctx, ellipsize(ctx, l.value, FONT.body, raw.w - kw - 40), raw.x + 20 + kw, y, FONT.body, redacted ? '#b3242f' : INK);
    });
    drawText(ctx, ellipsize(ctx, `>>> Last update of WHOIS database: ${registryNow(game)} <<<`, FONT.body, raw.w - 40), raw.x + 20, raw.y + rawH - 28, FONT.body, DIM);

    // what the game knows about the company
    const box = wide ? { x: r.x + lw + 14, y: r.y, w: r.w - lw - 14, h: 290 } : { x: r.x, y: r.y + rawH + 14, w: r.w, h: 236 };
    plate(ctx, box, NAVY, 12);
    drawText(ctx, 'WHAT WE KNOW', box.x + 18, box.y + 16, FONT.body, '#9db4d8');
    const rows = [
      ['SECTOR', CO_LABEL[c.kind] ?? c.kind],
      ['CITY', title(cities()[c.city]?.name)],
      ['STAFF', String(staff)],
      ['HOSTS', `${known} of ${hosts.length} on your map`],
      ['DEFENCE', known ? `up to ${hardest}` : '???'],
    ];
    rows.forEach(([k, v], i) => {
      drawText(ctx, k, box.x + 18, box.y + 46 + i * 28, FONT.body, '#9db4d8');
      drawText(ctx, ellipsize(ctx, v, FONT.body, box.w * 0.55), box.x + box.w - 18, box.y + 46 + i * 28, FONT.body, '#ffffff', { align: 'right' });
    });
    [['Website', siteUrl(c)], ['Staff and contacts', `${siteUrl(c)}/team`], ['LEAKBASE profile', `lookup/${rec.ci}`]].forEach(([text, url], i) => {
      const b = { x: box.x + 14, y: box.y + 194 + i * 30, w: box.w - 28, h: 26 };
      if (inside(input, b)) plate(ctx, b, 'rgba(255,255,255,0.12)', 8);
      drawText(ctx, `${text}  →`, b.x + 6, b.y + 4, FONT.body, '#7fb5ff');
      if (press(input, b)) go(events, url);
    });
  });
}

/// The whois.nx page for the rest of an address ('' is the search page), or null for a 404.
export function whoisPage(game, rest, view = {}) {
  // each block carries what the DOM needs to draw it again (app/apps/dsnSites.js)
  const D = (control, type, extra = {}) => Object.assign(control, { dom: { type, ...extra } });
  const query = view.whoisQuery ?? '';
  if (!rest) {
    const found = whoisSearch(game, query).slice(0, 12);
    const recent = game.world.companies.map((c, ci) => ci).sort((a, b) => whoisRecord(game, b).created.localeCompare(whoisRecord(game, a).created)).slice(0, 8);
    const controls = [
      D(masthead('look up who owns a domain on the network'), 'w-mast', { sub: tl('windows.dsn.whois.look_up_who_owns') }),
      field('whois.q', query, 'type a domain or a company name: vantasystems.nx'),
    ];
    const heading = `${found.length} domain${found.length === 1 ? '' : 's'} match`;
    if (query.trim()) controls.push(found.length ? D(resultRows(game, found, heading), 'w-results', { game, list: found, heading }) : D(custom(40, (ctx, sk, r) => drawText(ctx, `no domain matches "${query.trim()}"`, r.x + 4, r.y + 8, FONT.body, '#b3242f')), 'w-none', { text: `no domain matches "${query.trim()}"` }));
    else controls.push(D(resultRows(game, recent, 'RECENTLY REGISTERED'), 'w-results', { game, list: recent, heading: 'RECENTLY REGISTERED' }));
    return { title: 'whois.nx', site: 'web', bg: BG, accent: 0x2d7dff, controls };
  }
  const ci = companyOfDomain(game, rest);
  if (ci < 0) return null;
  const rec = whoisRecord(game, ci);
  return {
    title: `whois.nx/${rec.domain}`,
    site: 'web',
    bg: BG,
    accent: 0x2d7dff,
    controls: [
      D(masthead(`registry record for ${rec.domain}`), 'w-mast', { sub: tl('windows.dsn.whois.registry_record_for', rec.domain) }),
      D(custom(40, (ctx, sk, r, input, events) => {
        const b = { x: r.x, y: r.y, w: 190, h: 30 };
        drawText(ctx, '←  search another domain', b.x + 2, b.y + 6, FONT.body, inside(input, b) ? '#0f3f8a' : BLUE);
        if (press(input, b)) go(events, 'whois.nx');
      }), 'w-back'),
      D(recordCard(game, rec), 'w-card', { game, rec, lines: recordLines(game, rec) }),
    ],
  };
}
