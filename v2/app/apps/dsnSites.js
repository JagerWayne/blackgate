import { cities } from '../../game/data/content.js';
import { CO_LABEL } from '../../game/data/enums.js';
import { detailValue, isPublic, knows } from '../../game/state/intel.js';
import { siteUrl, siteTheme, staffOf, aboutText } from '../../game/state/sites.js';
import { copyOf, factsOf } from '../../game/state/siteCopy.js';
import { whoisRecord, registryNow } from '../../game/state/whois.js';
import { openingsOf, pressOf } from '../../game/state/siteInfo.js';
import { portraitOf } from '../../pages/ui/portrait.js';
import { esc } from '../ui.js';

// The company websites, the Business Directory and whois.nx, drawn from the `dom` descriptors that
// src/windows/dsn/{company,whois}.js attach to their blocks. Each site paints itself with its own theme colours.
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const onColor = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#14181f' : '#ffffff'; };
const go = (url, cls, inner, style = '') => `<button data-id="dsn.go.${esc(url)}" class="${cls}" style="${style}">${inner}</button>`;
const pill = (url, text, bg, ink, outline) => go(url, 'rounded-full px-5 py-2 text-xs font-bold hover:brightness-110', esc(text), outline ? `border:1.5px solid ${ink};color:${ink}` : `background:${bg};color:${ink}`);
const card = (t, inner, cls = '') => `<div class="rounded-xl p-5 ${cls}" style="background:${t.card}">${inner}</div>`;
const grid = (min, items) => `<div class="grid gap-3.5" style="grid-template-columns:repeat(auto-fill,minmax(${min}px,1fr))">${items.join('')}</div>`;
const sec = (t, text, sub) => `<div class="mt-6"><h2 class="text-xl font-bold" style="color:${t.ink}">${esc(text)}</h2><i class="mt-1 block h-[3px] w-11" style="background:${t.accent}"></i>${sub ? `<p class="mt-1 text-xs" style="color:${t.dim}">${esc(sub)}</p>` : ''}</div>`;

/// A detail of a person: a link while it is public (a tick once it is in the dossier), a click learns it.
function detail(game, i, field, t) {
  if (!isPublic(game, i, field)) return `<div class="text-xs" style="color:${t.dim}">${field}: private</div>`;
  const p = game.world.people[i];
  const v = field === 'workplace' ? title(detailValue(game, i, field)) : detailValue(game, i, field);
  return `<button data-id="sp.learn.${i}.${field}" class="block max-w-full truncate text-left text-xs hover:underline" style="color:${t.accent}">${knows(game, i, field) ? '✓ ' : ''}${esc(v)}</button>`;
}

function person(game, i, t, tall) {
  const p = game.world.people[i];
  return `<div class="relative rounded-xl p-4" style="background:${t.card}"><i class="absolute inset-x-4 top-0 h-1" style="background:${t.accent}"></i>
    <button data-id="dsn.go.sleekpages/person/${i}" class="block w-full text-left"><img src="${esc(String(portraitOf(game, i)).replace(/^\.\/data\//, '/'))}" alt="" class="h-20 w-20 rounded-lg object-cover" style="background:${rgba(t.accent, 0.18)}" />
      <b class="mt-2 block truncate text-sm" style="color:${t.ink}">${esc(title(p.name))}</b><span class="mt-1 inline-block max-w-full truncate rounded-full px-3 py-0.5 text-xs" style="background:${rgba(t.accent, 0.14)};color:${t.accent}">${esc(title(p.role))}</span></button>
    ${tall ? `<div class="mt-2 space-y-0.5">${detail(game, i, 'workplace', t)}${detail(game, i, 'email', t)}${detail(game, i, 'phone', t)}</div>` : ''}</div>`;
}

/// The HTML of a site block, or null when the descriptor is not one of these.
export function siteBlock(d) {
  const { t, c, ci, game, city } = d;
  switch (d.type) {
    case 'co-header': {
      const pages = [['', 'Home'], ['team', 'Our team'], ['careers', 'Careers'], ['press', 'Press'], ['contact', 'Contact']];
      const stacked = t.layout === 'center';
      return `<header class="flex ${stacked ? 'flex-col items-center gap-3' : 'flex-wrap items-center justify-between gap-3'} rounded-t px-5 py-4" style="background:${t.head};${t.layout === 'side' ? `border-left:8px solid ${t.accent};` : ''}${t.layout === 'banner' ? `border-bottom:3px solid ${t.accent};` : ''}">
        <div class="flex items-center gap-3"><i class="grid h-9 w-9 place-items-center rounded-lg text-lg font-bold not-italic" style="background:${t.headInk};color:${t.head}">${esc(c.name[0].toUpperCase())}</i><b class="text-lg" style="color:${t.headInk}">${esc(c.name)}</b></div>
        <nav class="flex gap-1">${pages.map(([s, n]) => go(`${siteUrl(c)}${s ? `/${s}` : ''}`, 'rounded-full px-4 py-1.5 text-xs hover:brightness-125', n, `color:${t.headInk};${d.sub === s ? `background:${rgba(t.headInk, 0.2)}` : ''}`)).join('')}</nav></header>`;
    }
    case 'co-hero': {
      const centred = t.layout === 'center' || t.layout === 'banner';
      return `<section class="${centred ? 'text-center' : ''} px-9 py-10" style="background:linear-gradient(135deg,${t.head},${rgba(t.accent, 0.55)});color:${t.headInk}">
        <span class="inline-block rounded-full px-3 py-1 text-xs" style="background:${rgba(t.headInk, 0.18)}">${esc(CO_LABEL[c.kind] ?? '')}</span>
        <h1 class="mt-3 max-w-2xl ${centred ? 'mx-auto' : ''} text-3xl font-bold leading-tight">${esc(copyOf(c).tag)}</h1><p class="mt-2 text-sm" style="opacity:.8">${esc(c.name)} // ${esc(city)}</p>
        <div class="mt-5 flex gap-3 ${centred ? 'justify-center' : ''}">${pill(`${siteUrl(c)}/team`, 'Meet our team', t.headInk, t.head)}${pill(`${siteUrl(c)}/contact`, 'Contact us', '', t.headInk, true)}</div></section>`;
    }
    case 'co-figures': return `<div class="mt-4">${grid(150, factsOf(game, ci, staffOf(game, ci).length).map(([v, l]) => card(t, `<i class="mb-2 block h-1 w-9" style="background:${t.accent}"></i><div class="text-2xl font-bold" style="color:${t.accent}">${esc(v)}</div><div class="mt-1 text-[11px] tracking-wider" style="color:${t.dim}">${esc(l.toUpperCase())}</div>`)))}</div>`;
    case 'co-heading': return sec(t, d.text, d.note);
    case 'co-services': return `<div class="mt-3">${grid(220, copyOf(c).services.map(([n, text], k) => card(t, `<i class="grid h-9 w-9 place-items-center rounded-full text-xs not-italic" style="background:${rgba(t.accent, 0.15)};color:${t.accent}">${String(k + 1).padStart(2, '0')}</i><b class="mt-2 block" style="color:${t.ink}">${esc(n)}</b><p class="mt-1 text-xs leading-relaxed" style="color:${t.dim}">${esc(text)}</p>`)))}</div>`;
    case 'co-about': {
      const ink = onColor(t.accent);
      return `<div class="mt-5 grid gap-3.5 @2xl:grid-cols-[3fr_2fr]">${card(t, `<b style="color:${t.accent}">About us</b><p class="mt-2 text-sm leading-relaxed" style="color:${t.ink}">${esc(aboutText(game, ci, city))}</p>`)}
        <div class="rounded-xl p-5" style="background:${t.accent};color:${ink}"><b>Why clients choose us</b><ul class="mt-3 space-y-2 text-sm">${['Specialists, not generalists', `Rooted in ${city}`, 'Discreet and dependable'].map((r) => `<li>✓ ${esc(r)}</li>`).join('')}</ul></div></div>`;
    }
    case 'co-leaders': return `<div class="mt-5"><div class="flex items-end justify-between"><h2 class="text-xl font-bold" style="color:${t.ink}">Leadership</h2>${go(`${siteUrl(c)}/team`, 'text-xs hover:underline', 'See everyone  →', `color:${t.accent}`)}</div><i class="mb-3 mt-1 block h-[3px] w-11" style="background:${t.accent}"></i>${grid(200, staffOf(game, ci).slice(0, 3).map((i) => person(game, i, t, false)))}</div>`;
    case 'co-cta': {
      const ink = onColor(t.accent);
      return `<div class="mt-5 flex items-center justify-between gap-4 rounded-xl p-6" style="background:${t.accent};color:${ink}"><div><b class="text-lg">Ready to work with ${esc(c.name)}?</b><p class="text-sm" style="opacity:.85">Write to us and a real person will answer.</p></div>${pill(`${siteUrl(c)}/contact`, 'Contact us', ink, t.accent)}</div>`;
    }
    case 'co-footer': {
      const link = (u, text) => go(u, 'block text-xs hover:underline', text, `color:${rgba(t.headInk, 0.85)}`);
      return `<footer class="mt-5 rounded-b p-6" style="background:${t.head};color:${t.headInk}"><div class="grid gap-5 @lg:grid-cols-3"><div><b>${esc(c.name)}</b><p class="mt-1 text-xs" style="opacity:.7">${esc(CO_LABEL[c.kind] ?? '')} // ${esc(city)}</p></div>
        <div><div class="mb-1 text-[11px]" style="opacity:.6">PAGES</div>${link(siteUrl(c), 'Home')}${link(`${siteUrl(c)}/team`, 'Our team')}${link(`${siteUrl(c)}/careers`, 'Careers')}${link(`${siteUrl(c)}/press`, 'Press')}${link(`${siteUrl(c)}/contact`, 'Contact')}${link(`whois.nx/${siteUrl(c).replace(/^www\./, '')}`, 'Domain record')}</div>
        <div><div class="mb-1 text-[11px]" style="opacity:.6">REACH US</div><p class="text-xs">reception@${esc(c.short.toLowerCase())}.nx</p><p class="text-xs">+1 (555) 01${String(ci).padStart(2, '0')}-0000</p></div></div>
        <p class="mt-4 border-t pt-3 text-[11px]" style="border-color:${rgba(t.headInk, 0.2)};opacity:.6">© ${esc(c.name)} // ${esc(siteUrl(c))}</p></footer>`;
    }
    case 'co-band': return `<div class="mt-4 rounded-xl p-6" style="background:${t.card};border-left:6px solid ${t.accent}"><h1 class="text-3xl font-bold" style="color:${t.ink}">${esc(d.text)}</h1><p class="mt-1 text-sm" style="color:${t.dim}">${esc(d.note)}</p></div>`;
    case 'co-openings': {
      const jobs = openingsOf(game, ci);
      if (!jobs.length) return card(t, `<p class="text-sm" style="color:${t.dim}">No vacancies at the moment.</p>`, 'mt-4');
      return `<div class="mt-4 space-y-2.5">${jobs.map((j) => card(t, `<div class="flex flex-wrap items-center justify-between gap-2"><b style="color:${t.ink}">${esc(`${j.level} ${j.role}`)}</b><span class="rounded-full px-3 py-0.5 text-[11px]" style="background:${rgba(t.accent, 0.15)};color:${t.accent}">${esc(j.city)}</span></div>
        <p class="mt-1 text-xs" style="color:${t.dim}">Reports to ${j.boss === undefined ? 'the board' : go(`sleekpages/person/${j.boss}`, 'underline', esc(title(game.world.people[j.boss].name)), `color:${t.accent}`)}. Apply through your usual contact at ${esc(c.name)}.</p>`)).join('')}</div>`;
    }
    case 'co-press': return `<div class="mt-4 space-y-2.5">${pressOf(game, ci).map((p) => card(t, `<span class="text-[11px] tracking-wider" style="color:${t.accent}">${esc(p.when.toUpperCase())}</span><b class="mt-1 block" style="color:${t.ink}">${esc(p.headline)}</b><p class="mt-1 text-xs leading-relaxed" style="color:${t.dim}">${esc(p.text)}</p>`)).join('')}</div>`;
    case 'co-team': return `<div class="mt-4">${grid(210, staffOf(game, ci).map((i) => person(game, i, t, true)))}</div>`;
    case 'co-contact': {
      const ink = onColor(t.accent);
      const rows = [['@', 'Email', `reception@${c.short.toLowerCase()}.nx`], ['T', 'Phone', `+1 (555) 01${String(ci).padStart(2, '0')}-0000`], ['A', 'Office', `${city}, head office`], ['H', 'Hours', 'Monday to Friday, 09:00 to 17:30']];
      return `<div class="mt-4 grid gap-3.5 @2xl:grid-cols-[3fr_2fr]">${card(t, `<h2 class="text-xl font-bold" style="color:${t.ink}">Get in touch</h2>${rows.map(([g, l, v]) => `<div class="mt-3 flex items-center gap-3"><i class="grid h-9 w-9 place-items-center rounded-full text-xs not-italic" style="background:${rgba(t.accent, 0.15)};color:${t.accent}">${g}</i><span><span class="block text-[11px]" style="color:${t.dim}">${l.toUpperCase()}</span><b style="color:${t.ink}">${esc(v)}</b></span></div>`).join('')}`)}
        <div class="rounded-xl p-6" style="background:${t.accent};color:${ink}"><h2 class="text-xl font-bold">Prefer a person?</h2><p class="my-3 text-sm" style="opacity:.9">Our team page lists names, roles and direct lines for the people who can help.</p>${pill(`${siteUrl(c)}/team`, 'Meet the team', ink, t.accent)}</div></div>`;
    }
    case 'dir': {
      const rows = d.items.map((it) => {
        if (it.head) return `<div class="mt-4 border-b border-[#d3dbe8] pb-1 text-[11px] tracking-wider text-[#5f6b7a]">${esc((CO_LABEL[it.head] ?? it.head).toUpperCase())}</div>`;
        const th = siteTheme(d.game, it.ci);
        return `<button data-id="dsn.go.${esc(siteUrl(it.c))}" class="mt-1.5 flex w-full items-center gap-3 rounded-lg bg-white p-2.5 text-left hover:bg-[#eef3fb]"><i class="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-bold not-italic" style="background:${th.head};color:${th.headInk}">${esc(it.c.name[0].toUpperCase())}</i>
          <span class="min-w-0 flex-1"><b class="block truncate text-sm text-[#1d2733]">${esc(it.c.name)}</b><span class="text-xs text-[#1f5fbf]">${esc(siteUrl(it.c))}</span></span><span class="hidden text-xs text-[#5f6b7a] @lg:block">${esc(title(cities()[it.c.city]?.name))}</span></button>`;
      }).join('');
      return `<div><div class="rounded-xl p-6 text-white" style="background:linear-gradient(90deg,#1f5fbf,#5b9bf0)"><h1 class="text-3xl font-bold">Business Directory</h1><p class="mt-1 text-sm" style="opacity:.85">${d.cos.length} companies on the network, by industry</p></div>${rows}</div>`;
    }
    case 'w-mast': return `<div class="flex items-center gap-4 rounded-xl bg-[#13233f] p-5"><i class="grid place-items-center rounded-xl bg-[#2d7dff] px-4 py-2 text-2xl font-bold not-italic text-white">W</i><div><b class="text-2xl text-white">whois.nx</b><p class="text-sm text-[#9db4d8]">${esc(d.sub)}</p></div></div>`;
    case 'w-back': return go('whois.nx', 'my-2 text-xs text-[#1f5fbf] hover:text-[#0f3f8a]', '←  search another domain');
    case 'w-none': return `<p class="py-2 text-xs text-[#b3242f]">${esc(d.text)}</p>`;
    case 'w-results': return `<div class="mt-3 text-[11px] tracking-wider text-[#5d6a80]">${esc(d.heading)}</div>${d.list.map((ci2) => { const rec = whoisRecord(d.game, ci2); return `<button data-id="dsn.go.whois.nx/${esc(rec.domain)}" class="mt-1.5 block w-full rounded-lg bg-white p-3 text-left hover:bg-[#e2ebfa]"><b class="text-sm text-[#1f5fbf]">${esc(rec.domain)}</b><span class="block truncate text-xs text-[#5d6a80]">${esc(rec.org)} // registered ${esc(rec.created.slice(0, 4))} // ${esc(rec.registrar.name)}</span></button>`; }).join('')}`;
    case 'w-card': {
      const rec = d.rec;
      const co = game.world.companies[rec.ci];
      const hosts = co.hosts.map((id) => game.world.hosts[id]);
      const known = hosts.filter((h) => h.discovered).length;
      const hardest = hosts.length ? Math.max(...hosts.map((h) => h.firewall + h.monitor + h.proxy)) : 0;
      const row = (k, v) => `<div class="flex gap-3 py-0.5"><span class="w-2/5 shrink-0 text-[#5d6a80]">${esc(k)}:</span>${v}</div>`;
      const lines = d.lines.map((l) => (l.link ? row(l.key, detail(game, l.link.i, l.link.field, { accent: '#1f5fbf', dim: '#5d6a80' }))
        : row(l.key, `<span class="min-w-0 break-words" style="color:${l.value === 'REDACTED FOR PRIVACY' ? '#b3242f' : '#1b2433'}">${esc(l.value)}</span>`))).join('');
      const know = [['SECTOR', CO_LABEL[co.kind] ?? co.kind], ['CITY', title(cities()[co.city]?.name)], ['STAFF', String(game.world.people.filter((p) => p.company === rec.ci).length)], ['HOSTS', `${known} of ${hosts.length} on your map`], ['DEFENCE', known ? `up to ${hardest}` : '???']];
      const lnk = (u, text) => go(u, 'block w-full rounded px-2 py-1 text-left text-xs text-[#7fb5ff] hover:bg-white/10', `${text}  →`);
      return `<div class="mt-3 grid gap-3.5 @3xl:grid-cols-[2fr_1fr]"><div class="rounded-xl bg-white p-5 text-xs"><b class="text-sm text-[#1b2433]">Domain Information for ${esc(rec.domain)}</b><hr class="my-3 border-[#d6deec]" />${lines}<p class="mt-4 text-[#5d6a80]">&gt;&gt;&gt; Last update of WHOIS database: ${esc(registryNow(game))} &lt;&lt;&lt;</p></div>
        <div class="rounded-xl bg-[#13233f] p-4 text-xs"><div class="mb-2 tracking-wider text-[#9db4d8]">WHAT WE KNOW</div>${know.map(([k, v]) => `<div class="flex justify-between py-1"><span class="text-[#9db4d8]">${k}</span><span class="text-white">${esc(v)}</span></div>`).join('')}<div class="mt-3">${lnk(siteUrl(co), 'Website')}${lnk(`${siteUrl(co)}/team`, 'Staff and contacts')}${lnk(`lookup/${rec.ci}`, 'LEAKBASE profile')}</div></div></div>`;
    }
    default: return null;
  }
}
