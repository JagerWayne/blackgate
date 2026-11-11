import { cities } from '../../game/data/content.js';
import { CO_LABEL } from '../../game/data/enums.js';
import { knows, isPublic } from '../../game/state/intel.js';
import { siteUrl, siteTheme, staffOf, seedHash } from '../../game/state/sites.js';
import { copyOf } from '../../game/state/siteCopy.js';
import { openingsOf, hostRoles } from '../../game/state/siteInfo.js';
import { priceOf } from '../../game/state/bazaar.js';
import { portraitOf } from '../../pages/ui/portrait.js';
import { esc } from '../ui.js';

// LinkedUp, The Bazaar, PasteDump and archive.nx: four sites of their own, drawn from the `dom` descriptors that
// pages/windows/dsn/{web2,web3}.js attach to their pages. Each page is one block with its own header, body and footer, and
// the pages ask the browser for no side panel (site: 'web').
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const go = (url, cls, inner, style = '') => `<button data-id="dsn.go.${esc(url)}" class="${cls}" style="${style}">${inner}</button>`;
const act = (id, cls, inner, style = '') => `<button data-id="${esc(id)}" class="${cls}" style="${style}">${inner}</button>`;
const money = (n) => `${Math.round(n).toLocaleString('en-US')} cr`;
const face = (game, i, size) => `<img src="${esc(String(portraitOf(game, i)).replace(/^\.\/data\//, '/'))}" alt="" class="shrink-0 rounded-full object-cover" style="width:${size}px;height:${size}px;background:#d0d4db" />`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// -- LinkedUp: a professional network, white cards on a pale blue page ------------------------------------------------
const LU = { bg: '#eef1f6', card: '#ffffff', ink: '#1b2430', dim: '#5d6b7d', blue: '#2557a7', line: '#d9e0ea' };

function luShell(inner, here) {
  const tab = (url, text, on) => go(url, 'rounded-full px-4 py-1.5 text-xs font-bold', text, on ? `background:${LU.blue};color:#fff` : `color:${LU.blue}`);
  return `<div class="min-h-full" style="background:${LU.bg};color:${LU.ink}">
    <header class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3" style="border-color:${LU.line}">
      ${go('linkedup.nx', 'flex items-center gap-2 text-xl font-bold', `<i class="grid h-8 w-8 place-items-center rounded-lg not-italic text-white" style="background:${LU.blue}">in</i><span>Linked<span style="color:${LU.blue}">Up</span></span>`)}
      <nav class="flex gap-1">${tab('linkedup.nx', 'Companies', here === 'home')}${tab('directory', 'Business Directory', false)}${tab('sleekpages/people', 'People', false)}</nav></header>
    <main class="mx-auto max-w-5xl px-5 py-5">${inner}</main>
    <footer class="border-t px-5 py-4 text-center text-[11px]" style="border-color:${LU.line};color:${LU.dim}">LinkedUp // the professional network of the DSNET // jobs, people and where they work</footer></div>`;
}

const luCard = (inner, cls = '') => `<div class="rounded-xl border bg-white p-4 ${cls}" style="border-color:${LU.line}">${inner}</div>`;

function luHome(d) {
  const { game } = d;
  const cos = game.world.companies.map((c, ci) => ({ c, ci, jobs: openingsOf(game, ci).length, staff: staffOf(game, ci).length })).sort((a, b) => b.jobs - a.jobs || a.c.name.localeCompare(b.c.name));
  const jobs = cos.reduce((s, x) => s + x.jobs, 0);
  const stat = (v, l) => `<div class="rounded-xl bg-white/15 px-4 py-2 text-center"><b class="block text-xl">${v}</b><span class="text-[11px] opacity-80">${l}</span></div>`;
  return luShell(`<section class="rounded-2xl p-7 text-white" style="background:linear-gradient(120deg,${LU.blue},#4a86d8)"><h1 class="text-3xl font-bold">Find out who works where.</h1><p class="mt-1 max-w-xl text-sm opacity-90">Every company on the network, who is hiring, and the people behind the names.</p>
      <div class="mt-4 flex flex-wrap gap-3">${stat(cos.length, 'COMPANIES')}${stat(jobs, 'OPEN POSITIONS')}${stat(game.world.people.length, 'PEOPLE')}</div></section>
    <h2 class="mb-2 mt-6 text-sm font-bold" style="color:${LU.dim}">COMPANIES HIRING NOW</h2>
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${cos.map(({ c, ci, jobs: j, staff }) => {
      const t = siteTheme(game, ci);
      return luCard(`<div class="flex items-center gap-3"><i class="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg font-bold not-italic" style="background:${t.head};color:${t.headInk}">${esc(c.name[0].toUpperCase())}</i>
        <span class="min-w-0"><b class="block truncate text-sm">${esc(c.name)}</b><span class="block truncate text-[11px]" style="color:${LU.dim}">${esc(CO_LABEL[c.kind] ?? '')} · ${esc(title(cities()[c.city]?.name))}</span></span></div>
        <div class="mt-3 flex items-center justify-between text-xs"><span class="rounded-full px-2.5 py-0.5 font-bold" style="background:${j ? '#e3f1e6' : '#eef1f6'};color:${j ? '#1a7f3d' : LU.dim}">${j} open</span><span style="color:${LU.dim}">${staff} people</span></div>
        ${go(`linkedup.nx/c/${ci}`, 'mt-3 w-full rounded-full border py-1.5 text-xs font-bold hover:bg-[#eef1f6]', 'View company', `border-color:${LU.blue};color:${LU.blue}`)}`);
    }).join('')}</div>`, 'home');
}

function luCompany(d) {
  const { game, ci } = d;
  const c = game.world.companies[ci];
  const t = siteTheme(game, ci);
  const jobs = openingsOf(game, ci);
  const staff = staffOf(game, ci);
  const pill = (url, text) => go(url, 'rounded-full border px-4 py-1.5 text-xs font-bold hover:bg-[#eef1f6]', text, `border-color:${LU.blue};color:${LU.blue}`);
  return luShell(`${go('linkedup.nx', 'mb-3 text-xs hover:underline', '← all companies', `color:${LU.blue}`)}
    ${luCard(`<div class="-m-4 mb-0 h-24 rounded-t-xl" style="background:linear-gradient(120deg,${t.head},${t.accent})"></div>
      <div class="-mt-8 flex flex-wrap items-end gap-4 px-2 pb-1"><i class="grid h-20 w-20 place-items-center rounded-xl border-4 border-white text-3xl font-bold not-italic" style="background:${t.head};color:${t.headInk}">${esc(c.name[0].toUpperCase())}</i>
        <div class="min-w-0 flex-1 pt-8"><h1 class="text-2xl font-bold">${esc(c.name)}</h1><p class="text-xs" style="color:${LU.dim}">${esc(CO_LABEL[c.kind] ?? '')} · ${esc(title(cities()[c.city]?.name))} · ${staff.length} people</p></div>
        <div class="flex gap-2 pt-8">${pill(siteUrl(c), 'Website')}${pill(`archive.nx/${ci}`, 'Old snapshot')}</div></div>`, 'overflow-hidden')}
    <h2 class="mb-2 mt-5 text-sm font-bold" style="color:${LU.dim}">OPEN POSITIONS · ${jobs.length}</h2>
    <div class="grid gap-3 @lg:grid-cols-2">${jobs.length ? jobs.map((j) => luCard(`<b class="text-sm">${esc(`${j.level} ${j.role}`)}</b><p class="mt-1 text-xs" style="color:${LU.dim}">${esc(c.name)} · ${esc(j.city)}</p><p class="mt-2 text-xs">Reports to ${j.boss === undefined ? 'the board' : esc(title(game.world.people[j.boss].name))}</p>`)).join('') : luCard('<p class="text-xs">No vacancies right now.</p>')}</div>
    <h2 class="mb-1 mt-5 text-sm font-bold" style="color:${LU.dim}">PEOPLE · ${staff.length}</h2><p class="mb-2 text-xs" style="color:${LU.dim}">Add where someone works to your dossier. Public emails can be added too.</p>
    <div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${staff.map((i) => {
      const p = game.world.people[i];
      const have = knows(game, i, 'workplace');
      return luCard(`<div class="flex items-center gap-3">${face(game, i, 48)}<span class="min-w-0"><b class="block truncate text-sm">${esc(title(p.name))}</b><span class="block truncate text-[11px]" style="color:${LU.dim}">${esc(title(p.role))}</span></span></div>
        <div class="mt-3 flex flex-col gap-1.5">${act(`sp.learn.${i}.workplace`, 'rounded-full py-1.5 text-xs font-bold hover:brightness-110', have ? '✓ On your dossier' : 'Add workplace to dossier', have ? `background:#e3f1e6;color:#1a7f3d` : `background:${LU.blue};color:#fff`)}
        ${isPublic(game, i, 'email') ? act(`sp.learn.${i}.email`, 'truncate rounded-full border py-1 text-[11px] hover:bg-[#eef1f6]', `${knows(game, i, 'email') ? '✓ ' : ''}${esc(p.email)}`, `border-color:${LU.line};color:${LU.blue}`) : ''}</div>`);
    }).join('')}</div>`, 'company');
}

// -- The Bazaar: a dark amber black market --------------------------------------------------------------------------
const BZ = { bg: '#120e08', panel: '#1c1610', line: '#3a2d1a', amber: '#e0a030', ink: '#f3e9d6', dim: '#a8987a' };

function bazaar(d) {
  const { game } = d;
  const files = game.player.storage.map((f, n) => ({ f, n }));
  const total = files.filter(({ f }) => !(f.enc > 0)).reduce((s, { f }) => s + priceOf(game, f), 0);
  const step = (n, h, t) => `<div class="rounded-xl p-4" style="background:${BZ.panel};border:1px solid ${BZ.line}"><i class="grid h-8 w-8 place-items-center rounded-full text-sm font-bold not-italic" style="background:${BZ.amber};color:#1a1205">${n}</i><b class="mt-2 block text-sm">${h}</b><p class="mt-1 text-xs" style="color:${BZ.dim}">${t}</p></div>`;
  return `<div class="min-h-full" style="background:${BZ.bg};color:${BZ.ink}">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3" style="border-color:${BZ.line};background:${BZ.panel}">
      <b class="text-xl tracking-[0.3em]" style="color:${BZ.amber}">THE BAZAAR</b>
      <span class="flex items-center gap-3 text-xs"><span style="color:${BZ.dim}">YOUR BALANCE</span><b class="rounded-full px-3 py-1" style="background:${BZ.bg};border:1px solid ${BZ.line};color:${BZ.amber}">${money(game.player.credits)}</b></span></header>
    <main class="mx-auto max-w-4xl px-6 py-6">
      <section class="rounded-2xl p-8" style="background:radial-gradient(circle at 80% 20%,rgba(224,160,48,.25),transparent 55%),${BZ.panel};border:1px solid ${BZ.line}">
        <span class="text-[11px] tracking-[0.3em]" style="color:${BZ.amber}">NO NAMES // NO QUESTIONS</span><h1 class="mt-2 text-4xl font-bold">Sell what you took.</h1>
        <p class="mt-2 max-w-lg text-sm" style="color:${BZ.dim}">Bring your copied files. Buyers pay on the spot. Encrypted files do not sell, and not every buyer is who they say.</p>
        <div class="mt-4 flex flex-wrap gap-3 text-xs"><span class="rounded-full px-3 py-1" style="border:1px solid ${BZ.line}">${files.length} file${files.length === 1 ? '' : 's'} on you</span><span class="rounded-full px-3 py-1" style="border:1px solid ${BZ.line}">up to ${money(total)} on offer</span></div></section>
      <h2 class="mb-2 mt-6 text-xs tracking-[0.25em]" style="color:${BZ.dim}">YOUR INVENTORY</h2>
      <div class="overflow-hidden rounded-xl" style="border:1px solid ${BZ.line}">${files.length ? files.map(({ f, n }, k) => {
        const enc = f.enc > 0;
        return `<div class="flex flex-wrap items-center gap-3 px-4 py-3" style="background:${k % 2 ? BZ.bg : BZ.panel}"><i class="grid h-9 w-9 place-items-center rounded not-italic text-xs font-bold" style="background:${BZ.bg};border:1px solid ${BZ.line};color:${BZ.amber}">${esc((f.name.split('.').pop() ?? '').slice(0, 3).toUpperCase())}</i>
          <span class="min-w-0 flex-1"><b class="block truncate text-sm">${esc(f.name)}</b><span class="text-[11px]" style="color:${BZ.dim}">${f.size} GB${f.source ? ` · from ${esc(f.source)}` : ''}${enc ? ' · encrypted' : ''}</span></span>
          <b class="text-sm" style="color:${enc ? BZ.dim : BZ.amber}">${enc ? 'NO OFFER' : money(priceOf(game, f))}</b>
          ${act(`bz.sell.${n}`, 'rounded px-4 py-1.5 text-xs font-bold disabled:opacity-30 hover:brightness-110', 'SELL', `background:${enc ? BZ.line : BZ.amber};color:#1a1205`).replace('<button', enc ? '<button disabled' : '<button')}</div>`;
      }).join('') : `<p class="px-4 py-8 text-center text-sm" style="color:${BZ.dim};background:${BZ.panel}">Nothing to sell. Copy files from a host first.</p>`}</div>
      <h2 class="mb-2 mt-6 text-xs tracking-[0.25em]" style="color:${BZ.dim}">HOW IT WORKS</h2>
      <div class="grid gap-3 @lg:grid-cols-3">${step(1, 'Copy', 'Take files off a host with your link open.')}${step(2, 'Decrypt', 'Buyers pay for what they can read.')}${step(3, 'Sell', 'Price depends on size. About one buyer in twelve is a sting.')}</div>
    </main><footer class="border-t px-6 py-4 text-center text-[11px]" style="border-color:${BZ.line};color:${BZ.dim}">THE BAZAAR // cash only // we were never here</footer></div>`;
}

// -- PasteDump: a dark code-paste site -----------------------------------------------------------------------------
const PD = { bg: '#0d1117', panel: '#161b22', line: '#30363d', ink: '#e6edf3', dim: '#8b949e', red: '#f85149', green: '#3fb950' };

function pasteDump(d) {
  const { game, pastes } = d;
  const lines = (text) => text.split('\n').map((l, n) => `<div class="flex"><span class="w-8 shrink-0 select-none pr-3 text-right" style="color:${PD.dim}">${n + 1}</span><code class="whitespace-pre-wrap break-all">${esc(l)}</code></div>`).join('');
  return `<div class="min-h-full" style="background:${PD.bg};color:${PD.ink}">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3" style="border-color:${PD.line};background:${PD.panel}">
      <b class="text-lg"><span style="color:${PD.red}">paste</span>dump<span style="color:${PD.dim}">.nx</span></b><span class="text-xs" style="color:${PD.dim}">${pastes.length} new today · anonymous · no logs (they say)</span></header>
    <main class="mx-auto grid max-w-5xl gap-5 px-6 py-6 @3xl:grid-cols-[1fr_220px]"><div class="space-y-4">${pastes.map((p) => {
      const c = game.world.companies[p.ci];
      const person = game.world.people[p.who];
      const bytes = p.text.length;
      const foot = p.host
        ? `<span class="rounded px-2 py-1 text-[11px]" style="background:${PD.bg};border:1px solid ${PD.line};color:${PD.green}">$ ping ${esc(p.host.name)}</span><span class="text-[11px]" style="color:${PD.dim}">type it in the Command Prompt</span>`
        : act(`sp.learn.${p.who}.email`, 'rounded px-3 py-1 text-[11px] font-bold hover:brightness-110', `${knows(game, p.who, 'email') ? '✓ filed' : 'File'} ${esc(person.email)}`, `background:${knows(game, p.who, 'email') ? PD.line : PD.red};color:#fff`);
      return `<article class="overflow-hidden rounded-lg" style="background:${PD.panel};border:1px solid ${PD.line}">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs" style="border-bottom:1px solid ${PD.line}"><b>paste #${p.id} — ${esc(c.name)}</b><span style="color:${PD.dim}">anon · ${bytes} bytes · ${p.host ? 'ssh' : 'mail'}</span></div>
        <pre class="overflow-x-auto px-3 py-3 text-xs leading-relaxed" style="background:${PD.bg}">${lines(p.text)}</pre>
        <div class="flex flex-wrap items-center gap-3 px-4 py-2">${foot}</div></article>`;
    }).join('')}</div>
      <aside class="space-y-3 text-xs"><div class="rounded-lg p-4" style="background:${PD.panel};border:1px solid ${PD.line}"><b>About</b><p class="mt-1" style="color:${PD.dim}">New pastes every day. About half are true. Emails can be filed on your dossier; server names are for the Command Prompt.</p></div>
        <div class="rounded-lg p-4" style="background:${PD.panel};border:1px solid ${PD.line}"><b>Today</b><div class="mt-1 space-y-1" style="color:${PD.dim}"><div class="flex justify-between"><span>mail dumps</span><b style="color:${PD.ink}">${pastes.filter((p) => !p.host).length}</b></div><div class="flex justify-between"><span>server leaks</span><b style="color:${PD.ink}">${pastes.filter((p) => p.host).length}</b></div></div></div></aside></main>
    <footer class="border-t px-6 py-4 text-center text-[11px]" style="border-color:${PD.line};color:${PD.dim}">pastedump.nx // we are not responsible for what you paste</footer></div>`;
}

// -- archive.nx: old pages, parchment and ink ------------------------------------------------------------------------
const AR = { bg: '#f6f1e4', card: '#fffdf6', ink: '#2b2418', dim: '#7a6e55', red: '#7a1f1f', line: '#d9cfb4' };

function arShell(inner, sub) {
  return `<div class="min-h-full" style="background:${AR.bg};color:${AR.ink};font-family:Georgia,'Times New Roman',serif">
    <header class="border-b px-6 py-4" style="border-color:${AR.line};background:${AR.card}">${go('archive.nx', 'flex items-baseline gap-3', `<b class="text-2xl" style="color:${AR.red}">archive<span style="color:${AR.dim}">.nx</span></b><i class="text-xs" style="color:${AR.dim}">${esc(sub)}</i>`)}</header>
    <main class="mx-auto max-w-4xl px-6 py-6">${inner}</main>
    <footer class="border-t px-6 py-4 text-center text-[11px] italic" style="border-color:${AR.line};color:${AR.dim}">archive.nx // copies of pages that no longer exist, kept for anyone who asks</footer></div>`;
}

const snapsOf = (game, ci) => {
  const n = 2 + (seedHash(game, 'snaps', ci) % 4);
  const first = 2001 + (seedHash(game, 'snap', ci) % 8);
  return Array.from({ length: n }, (_, k) => ({ year: first + k * 2, month: MONTHS[seedHash(game, 'snapm', ci, k) % 12] }));
};

function arHome(d) {
  const { game } = d;
  const cos = game.world.companies.map((c, ci) => ({ c, ci })).sort((a, b) => a.c.name.localeCompare(b.c.name));
  let last = '';
  return arShell(`<h1 class="text-3xl font-bold">The old network, as it was.</h1><p class="mt-1 text-sm italic" style="color:${AR.dim}">${cos.length} sites saved. Pick a name to see its pages from years ago.</p>
    <div class="mt-5 rounded border" style="border-color:${AR.line};background:${AR.card}">${cos.map(({ c, ci }) => {
      const letter = c.name[0].toUpperCase();
      const head = letter !== last ? `<div class="px-4 py-1 text-xs font-bold" style="background:${AR.bg};color:${AR.red}">${letter}</div>` : '';
      last = letter;
      const snaps = snapsOf(game, ci);
      return `${head}${go(`archive.nx/${ci}`, 'flex w-full items-center justify-between border-t px-4 py-2 text-left text-sm hover:bg-[#f6f1e4]', `<span><b>${esc(c.name)}</b> <i class="text-xs" style="color:${AR.dim}">${esc(siteUrl(c))}</i></span><span class="text-xs" style="color:${AR.dim}">${snaps.length} snapshots · ${snaps[0].year}–${snaps.at(-1).year}</span>`, `border-color:${AR.line}`)}`;
    }).join('')}</div>`, 'a library of old pages');
}

function arSnap(d) {
  const { game, ci } = d;
  const c = game.world.companies[ci];
  const t = siteTheme(game, ci);
  const snaps = snapsOf(game, ci);
  const at = Math.min(d.at ?? snaps.length - 1, snaps.length - 1);
  const s = snaps[at];
  const servers = c.hosts.map((id) => game.world.hosts[id]).filter((h) => !h.internal);
  const copy = copyOf(c);
  return arShell(`${go('archive.nx', 'mb-3 text-xs underline', '← all sites', `color:${AR.red}`)}
    <div class="rounded border px-4 py-3 text-sm" style="border-color:${AR.line};background:${AR.card}"><b>${esc(siteUrl(c))}</b> — saved ${s.month} ${s.year}
      <div class="mt-2 flex flex-wrap items-center gap-1 text-xs">${snaps.map((x, k) => go(`archive.nx/${ci}/${k}`, 'rounded px-2 py-0.5', String(x.year), k === at ? `background:${AR.red};color:#fff` : `border:1px solid ${AR.line};color:${AR.dim}`)).join('')}<span class="ml-2" style="color:${AR.dim}">${snaps.length} snapshots</span>${go(siteUrl(c), 'ml-auto text-xs underline', "see today's site", `color:${AR.red}`)}</div></div>
    <div class="mt-4 overflow-hidden rounded border-2" style="border-color:${AR.line};filter:sepia(.55) contrast(.95)">
      <div class="px-5 py-3 text-white" style="background:${t.head}"><b class="text-lg">${esc(c.name)}</b></div>
      <div class="px-5 py-6" style="background:#fff;color:#222;font-family:Arial,sans-serif"><h2 class="text-2xl font-bold">${esc(copy.tag)}</h2><p class="mt-1 text-sm text-gray-600">${esc(CO_LABEL[c.kind] ?? '')} · ${esc(title(cities()[c.city]?.name))}</p>
        <ul class="mt-3 list-disc pl-5 text-sm">${copy.services.map(([n]) => `<li>${esc(n)}</li>`).join('')}</ul></div>
      <div class="px-5 py-4 text-xs" style="background:#eee;color:#444;font-family:Arial,sans-serif"><b>Our servers</b> <span class="text-gray-500">(footer, ${s.year})</span>
        <div class="mt-1 grid gap-x-4 gap-y-0.5 font-mono @lg:grid-cols-2">${servers.length ? servers.map((h) => `<span>${esc(h.domain)}</span>`).join('') : '<span>none listed</span>'}</div></div></div>
    <p class="mt-3 text-xs italic" style="color:${AR.dim}">Roles on the old page: ${esc(hostRoles(game, ci).join(', ') || 'none')}. Addresses were not saved; try the names with ping.</p>`, 'a snapshot');
}

/// The HTML of one of these sites' blocks, or null when the descriptor is not one of them.
export function webBlock(d) {
  switch (d.type) {
    case 'lu-home': return luHome(d);
    case 'lu-company': return luCompany(d);
    case 'bz-page': return bazaar(d);
    case 'pd-page': return pasteDump(d);
    case 'ar-home': return arHome(d);
    case 'ar-snap': return arSnap(d);
    default: return null;
  }
}
