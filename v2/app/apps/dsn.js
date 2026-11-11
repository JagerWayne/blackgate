import { buildPage, listings, myJobs, HOME, MY_JOBS } from '../../pages/windows/dsn/pages.js';
import { browserOf } from '../../pages/windows/dsn/browser.js';
import { NET, KIND_COLOR, hexOf, softAccent } from '../../pages/windows/dsn/theme.js';
import { darknet } from '../../game/data/content.js';
import { MISSION_LABEL } from '../../game/data/enums.js';
import { contractLabel } from '../../game/state/contracts.js';
import { broker, haggleOf } from '../../game/state/haggle.js';
import { esc, click, edit, toggle, autoRender } from '../ui.js';
import { siteBlock } from './dsnSites.js';
import { shopBlock } from './dsnShop.js';
import { sleekBlock } from './dsnSleek.js';
import { webBlock } from './dsnWeb.js';
import { maxTabs } from '../../game/data/settings.js';

// Internet XPlorer in the DOM. The pages are still built by src/windows/dsn/* as lists of form controls;
// this file draws those controls as HTML. A `custom` control carries a `dom` descriptor (see the Object.assign
// calls in the dsn page files) that says what block it is; a block without one shows a placeholder until ported.
const hex = (n) => (typeof n === 'number' ? `#${n.toString(16).padStart(6, '0')}` : NET[n] !== undefined ? `#${NET[n].toString(16).padStart(6, '0')}` : '#c6d0dd');
const RELAYS = ['NL', 'IS', 'SG', 'RO', 'CH', 'PA', 'SE', 'MD', 'HK', 'EE', 'CA', 'BR'];
const money = (n) => `${n.toLocaleString('en-US')} cr`;
const nbtn = 'tac rounded border px-3 py-1 text-[11px] font-bold tracking-wider disabled:opacity-30 enabled:hover:brightness-125';
const cardBox = 'node rounded border border-[#1f2a3b] bg-[#131b28]/80 transition-all duration-200 ease-out hover:border-cyan-400/50 hover:bg-[#1a2434] hover:shadow-[0_0_14px_-2px_rgba(34,211,238,0.35)]';

function button(it) {
  const s = it.style ?? {};
  const d = s.dark ?? {};
  const dis = s.disabled ? 'disabled' : '';
  const tip = s.tip ? `title="${esc(s.tip)}"` : '';
  if (typeof d.fill === 'number') return `<button data-id="${esc(it.id)}" ${dis} ${tip} class="${nbtn}" style="background:${hex(d.fill)};border-color:${hex(d.border)};color:${hex(d.text)}">${esc(it.text)}</button>`;
  if (d.border) return `<button data-id="${esc(it.id)}" ${dis} ${tip} class="${nbtn} border-[#30405a] text-[#c6d0dd] enabled:hover:bg-white/5">${esc(it.text)}</button>`;
  return `<button data-id="${esc(it.id)}" ${dis} ${tip} class="px-1 py-0.5 text-left text-[12px] hover:underline disabled:opacity-30" style="color:${hex(d.text)}">${esc(it.text)}</button>`;
}

const jobCard = (game, c) => {
  const kind = hex(KIND_COLOR[c.kind] ?? NET.accent);
  const b = broker(c.client);
  const co = game.world.companies[game.world.hosts[c.target]?.company]?.name ?? 'unknown';
  const hg = haggleOf(game, c.id);
  const tag = c.state === 'accepted' ? ['YOURS', 'ok'] : c.state === 'ready' ? ['READY', 'ok']
    : hg ? { waiting: ['REPLY PENDING', 'warn'], counter: ['COUNTER', 'warn'], yes: ['FEE AGREED', 'ok'], no: ['REFUSED', 'danger'] }[hg.state] ?? null : null;
  const left = Math.max(c.deadline - game.clock.minutes, 0);
  const frac = Math.min(left / (72 * 60), 1);
  const late = left < 360;
  const d = Math.max(1, Math.min(c.difficulty ?? 1, 5));
  return `<div class="${cardBox} relative flex h-[156px] flex-col p-3 pl-4 text-xs"><i class="absolute inset-y-0 left-0 w-0.5" style="background:${kind}"></i>
    <div class="flex justify-between"><span class="truncate" style="color:${kind}">${esc(MISSION_LABEL[c.kind] ?? '')} // #${c.id}</span><b class="text-[#c9a45c]">${money(c.reward)}</b></div>
    <b class="mt-1 truncate text-sm text-[#eef2f7]">${esc((c.title || contractLabel(c)).toUpperCase())}</b>
    <div class="mt-1 flex justify-between"><span class="truncate" style="color:${hex(softAccent(b.accent))}">${esc(c.client)} vs ${esc(co)}</span>${tag ? `<span style="color:${hex(NET[tag[1]])}">${tag[0]}</span>` : ''}</div>
    <div class="mt-2 flex items-center gap-2"><div class="h-[3px] flex-1 bg-[#1a2434]"><div class="h-[3px]" style="width:${Math.round(frac * 100)}%;background:${hex(late ? NET.danger : frac < 0.35 ? NET.warn : NET.ok)}"></div></div><span class="${late ? 'text-[#c9707a]' : 'text-[#808ea4]'}">${Math.floor(left / 60)}h</span>
      <span class="flex gap-0.5">${[0, 1, 2, 3, 4].map((i) => `<i class="h-2 w-2 ${i < d ? 'bg-[#c9a45c]' : 'bg-[#30405a]'}"></i>`).join('')}</span></div>
    <div class="mt-auto flex gap-2"><button data-id="dsn.go.job/${c.id}" class="${nbtn} flex-1 border-[#30405a] text-[#c6d0dd] hover:bg-white/5">VIEW</button>${c.state === 'offered' ? `<button data-id="dsn.accept.${c.id}" class="${nbtn} flex-1" style="background:#1a4a37;border-color:#62b58c;color:#eef2f7">ACCEPT</button>` : ''}</div></div>`;
};

const tiles = (list) => `<div class="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">${list.join('')}</div>`;

/// The HTML of a `custom` control by its dom descriptor.
function block(c) {
  const d = c.dom;
  if (!d) return `<p class="rounded border border-dashed border-[#30405a] p-3 text-xs text-[#5a677d]">${esc(c.text ?? 'this block')} is not ported to the DOM yet</p>`;
  const site = siteBlock(d) ?? shopBlock(d) ?? sleekBlock(d) ?? webBlock(d);
  if (site !== null) return site;
  if (d.type === 'header') {
    const a = hex(d.accent ?? NET.accent);
    return `<header class="relative border-b border-[#1f2a3b] pb-3 pl-4"><i class="absolute inset-y-1 left-0 w-[3px]" style="background:${a}"></i>
      <div class="text-[11px] text-[#5a677d]">&gt; ${esc(d.path)}</div><div class="flex items-start justify-between gap-3"><h1 class="text-2xl font-bold text-[#eef2f7]">${esc(d.title)}</h1>
      ${d.tag ? `<span class="shrink-0 border px-2 py-1 text-[11px]" style="border-color:${a}88;color:${a}">${esc(d.tag)}</span>` : ''}</div>${d.sub ? `<div class="text-xs text-[#808ea4]">${esc(d.sub)}</div>` : ''}</header>`;
  }
  if (d.type === 'heading') return `<div class="mt-4 flex justify-between border-b border-[#1f2a3b] pb-1 text-[11px] text-[#808ea4]"><span>${esc(d.text)}</span><span class="text-[#5a677d]">${esc(d.note)}</span></div>`;
  if (d.type === 'tiles') return tiles(d.items.map((it) => `<div class="rounded border border-[#1f2a3b] bg-[#131b28] p-3"><div class="text-[11px] text-[#808ea4]">${esc(it.label)}</div><div class="text-xl font-bold" style="color:${hex(it.tone ?? NET.text_hi)}">${esc(String(it.value))}</div></div>`));
  if (d.type === 'cards') return `<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">${d.jobs.map((j) => jobCard(d.game, j)).join('')}</div>`;
  if (d.type === 'brokers') {
    const all = listings(d.game);
    return tiles(Object.entries(darknet().brokers).map(([name, b]) => { const t = hex(softAccent(b.accent)); return `<button data-id="dsn.go.${b.domain}" title="${esc(name)}: ${esc(b.tagline)}" class="${cardBox} relative h-[82px] p-3 pl-4 text-left"><i class="absolute inset-y-0 left-0 w-0.5" style="background:${t}"></i>
      <img src="/images/brokers/${esc(b.domain)}.png" alt="" class="float-left mr-2 h-8 w-8 rounded object-cover" /><div class="flex justify-between"><b style="color:${t}">${esc(b.domain)}</b><span class="text-xs text-[#c6d0dd]">${all.filter((j) => j.client === name).length} open</span></div><div class="text-xs text-[#808ea4]">${esc(name)}</div><div class="truncate text-xs text-[#5a677d]">${esc(b.tagline)}</div></button>`; }));
  }
  if (d.type === 'sites') return tiles(d.sites.map(([url, name, desc, glyph, tint]) => `<button data-id="dsn.go.${url}" title="${esc(name)}: ${esc(desc)}" class="${cardBox} flex h-[88px] items-start gap-3 p-3 text-left"><i class="grid h-9 w-9 shrink-0 place-items-center text-lg font-bold not-italic" style="background:${hex(tint)}2e;color:${hex(tint)}">${glyph}</i>
    <span class="min-w-0"><b class="block truncate text-sm text-[#eef2f7]">${esc(name)}</b><span class="text-xs text-[#808ea4]">${esc(desc)}</span></span></button>`));
  if (d.type === 'jobrow') {
    const { c: j, actions, ready, hours, h } = d;
    const at = ready ? 1 : 0;
    return `<div class="${cardBox} relative p-4 text-xs"><i class="absolute inset-y-0 left-0 w-0.5" style="background:${hex(KIND_COLOR[j.kind])}"></i>
      <div class="flex justify-between"><button data-id="dsn.go.job/${j.id}" class="truncate text-left text-sm font-bold text-[#eef2f7] hover:text-[#62a8c4]">#${j.id}  ${esc((j.title || contractLabel(j)).toUpperCase())}</button><b class="text-[#c9a45c]">${money(j.reward)}</b></div>
      <div class="text-[#808ea4]">${esc(h?.name ?? '')} (${esc(h?.ip ?? '')})  //  ${hours}h left  //  ${esc(j.client)}</div>
      <div class="my-2 flex gap-2">${['ACCEPTED', 'READY', 'PAID'].map((t, i) => `<div class="w-24"><div class="h-[3px]" style="background:${i <= at ? hex(i === at ? (ready ? NET.ok : NET.warn) : NET.dim) : '#30405a'}"></div><div class="${i === at ? 'text-[#eef2f7]' : 'text-[#5a677d]'}">${t}</div></div>`).join('')}</div>
      <div class="flex flex-wrap gap-2">${actions.map(button).join('')}</div></div>`;
  }
  if (d.type === 'chat') {
    const tint = hex(softAccent(d.b.accent));
    const msgs = d.log.map((m) => { const mine = m.who === 'you'; return `<div class="${mine ? 'text-right' : ''} mb-2"><div class="text-[10px] text-[#5a677d]">${mine ? 'YOU' : esc(m.who.toUpperCase())}  ${String(Math.floor(m.minute / 60) % 24).padStart(2, '0')}:${String(m.minute % 60).padStart(2, '0')}</div><div style="color:${mine ? hex(NET.accent) : tint}">${esc(m.text)}</div></div>`; }).join('');
    return `<div class="border border-[#30405a] bg-[#080c13] text-xs"><div class="p-3">${msgs || '<p class="text-center text-[#5a677d]">-- no messages yet --</p>'}</div><div class="bg-[#0b1019] px-3 py-1 ${d.hg?.state === 'waiting' ? 'text-[#c9a45c]' : 'text-[#5a677d]'}">&#9679; ${esc(d.status)}</div></div>`;
  }
  return '';
}

/// A list of controls as HTML.
function controls(list) {
  return list.map((c) => {
    switch (c.kind) {
      case 'section': return `<h3 class="mt-4 text-[10px] tracking-widest text-[#808ea4]">${esc(c.text)}</h3>`;
      case 'label': return `<p class="py-0.5 text-xs" style="color:${c.color != null ? hex(c.color) : '#808ea4'}">${esc(c.text)}</p>`;
      case 'para': return `<p class="py-1 text-[13px] leading-relaxed" style="color:${c.color != null ? hex(c.color) : '#c6d0dd'}">${esc(c.text).replace(/\{([^}]*)\}/g, '<b class="text-[#eef2f7]">$1</b>')}</p>`;
      case 'keyValue': return `<div class="flex justify-between gap-4 border-b border-[#1f2a3b]/60 py-1 text-xs"><span class="text-[#808ea4]">${esc(c.key)}</span><b style="color:${c.color != null ? hex(c.color) : '#eef2f7'}">${esc(c.value)}</b></div>`;
      case 'buttons': return `<div class="flex flex-wrap gap-2 py-1">${c.items.map(button).join('')}</div>`;
      case 'chips': return `<div class="flex flex-wrap gap-1.5 py-1">${c.items.map(([t, col]) => `<span class="rounded border px-2 py-0.5 text-[10px] font-bold" style="color:${hex(col)};border-color:${hex(col)}66">${esc(t)}</span>`).join('')}</div>`;
      case 'field': return `<input data-keep="${esc(c.id)}" data-field="${esc(c.id)}" value="${esc(c.value)}" placeholder="${esc(c.hint)}" ${c.secret ? 'type="password"' : ''} class="my-1 w-full rounded border border-[#30405a] bg-[#080c13] px-2 py-1.5 text-xs text-[#eef2f7] outline-none focus:border-[#62a8c4]" />`;
      case 'area': return `<textarea data-keep="${esc(c.id)}" data-field="${esc(c.id)}" placeholder="${esc(c.hint)}" rows="4" class="my-1 w-full rounded border border-[#30405a] bg-[#080c13] px-2 py-1.5 text-xs text-[#eef2f7] outline-none">${esc(c.value)}</textarea>`;
      case 'check': return `<label class="flex items-center gap-2 py-1 text-xs"><input type="checkbox" data-check="${esc(c.id)}" ${c.on ? 'checked' : ''} />${esc(c.text)}</label>`;
      case 'meter': return `<div class="py-1 text-xs"><div class="text-[#808ea4]">${esc(c.label)}</div><div class="h-2 rounded bg-[#1a2434]"><div class="h-2 rounded bg-[#62a8c4]" style="width:${Math.round(Math.min(c.frac, 1) * 100)}%"></div></div></div>`;
      case 'divider': return '<hr class="my-2 border-[#1f2a3b]" />';
      case 'spacer': return `<div style="height:${c.height}px"></div>`;
      default: return block(c);
    }
  }).join('');
}

/// The rail of the market's pages: hub, my jobs, the categories, the brokers.
function rail(game, url) {
  const all = listings(game);
  const d = darknet();
  const row = (u, text, glyph, tint, count, icon) => `<button data-id="dsn.go.${u}" class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-white/5 ${u === url ? 'bg-[#12293a] text-[#eef2f7]' : 'text-[#c6d0dd]'}">${icon ? `<img src="${icon}" alt="" class="h-6 w-6 shrink-0 rounded object-cover" />` : `<i class="grid h-6 w-6 shrink-0 place-items-center text-[11px] not-italic" style="background:${hex(tint)}29;color:${hex(tint)}">${glyph}</i>`}<span class="flex-1 truncate">${esc(text)}</span>${count != null ? `<span class="${count ? '' : 'text-[#5a677d]'}">${count}</span>` : ''}</button>`;
  const head = (t) => `<div class="px-3 pb-1 pt-3 text-[10px] tracking-widest text-[#5a677d]">${t}</div>`;
  return row(HOME, 'Hub', '⌂', NET.accent) + row(MY_JOBS, 'My jobs', '★', NET.ok, myJobs(game).length) + head('MARKET')
    + Object.entries(d.categories).map(([k, c]) => row(`cat/${k}`, c.name, c.name[0].toUpperCase(), KIND_COLOR[k], all.filter((j) => j.kind === k).length, `/images/categories/${k}.png`)).join('')
    + head('BROKERS') + Object.values(d.brokers).map((b) => row(b.domain, b.domain, b.domain[0].toUpperCase(), softAccent(hexOf(b.accent)), all.filter((j) => broker(j.client).domain === b.domain).length, `/images/brokers/${b.domain}.png`)).join('')
    + head('ELSEWHERE') + row('board', 'The board', '#', NET.violet) + row('about', 'About', 'i', NET.dim);
}

/// Internet XPlorer: tabs, address bar, rail, page and status bar. State is state.win.dsn, as on the canvas.
export function mountDsn(body, state) {
  const view = () => browserOf((state.win.dsn ??= {}));
  const tabOf = (v) => v.tabs[v.active];

  body.classList.add('crt-on'); // the window powers up once, when it is opened

  function render() {
    const game = state.game;
    const v = view();
    const tab = tabOf(v);
    const page = buildPage(game, tab.url, v);
    const a = hex(page.accent ?? NET.accent);
    const loading = game.uiTime - tab.at < 0.5;
    const hasRail = page.site !== 'web';
    const waiting = game.contracts.filter((c) => haggleOf(game, c.id)?.state === 'waiting').length;
    const nb = (id, t, off, tip) => `<button data-id="${id}" ${off ? 'disabled' : ''} title="${tip ?? ''}" class="grid h-8 w-8 place-items-center rounded text-[#808ea4] enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-30">${t}</button>`;
    const tabs = v.tabs.map((t, i) => `<div class="flex min-w-0 max-w-[200px] flex-1 items-center border-t-2 text-xs ${i === v.active ? 'bg-[#0e141f] text-[#eef2f7]' : 'border-transparent bg-[#0b1019] text-[#808ea4]'}" ${i === v.active ? `style="border-color:${a}"` : ''}>
      <button data-id="dsn.tab.${i}" class="min-w-0 flex-1 truncate px-3 py-2 text-left">${esc(buildPage(game, t.url, v).title)}</button>${v.tabs.length > 1 ? `<button data-id="dsn.closetab.${i}" class="px-2 hover:text-[#c9707a]">&times;</button>` : ''}</div>`).join('');
    const main = loading
      ? `<div class="p-6 text-xs text-[#808ea4]">routing through ${v.circuit.map((i) => RELAYS[i]).join(' &gt; ')}  //  relay 2 of 3<div class="relative mt-3 h-[3px] overflow-hidden bg-[#1a2434]"><div class="ping-bar absolute h-[3px] w-1/4" style="background:${a};box-shadow:0 0 10px ${a}"></div></div></div>`
      : page.columns ? `<div class="@container h-full"><div class="grid h-full @3xl:grid-cols-[1.3fr_1fr]"><div data-scroll="dsn-a-${v.active}-${tab.url}" class="overflow-y-auto p-5">${controls(page.columns[0])}</div><div data-scroll="dsn-b-${v.active}-${tab.url}" class="overflow-y-auto border-l border-[#1f2a3b] bg-[#131b28] p-5">${controls(page.columns[1])}</div></div></div>`
        : `<div data-scroll="dsn-${v.active}-${tab.url}" class="h-full overflow-y-auto p-5">${controls(page.controls)}</div>`;
    body.innerHTML = `<div class="cyber @container flex h-full flex-col bg-[#0e141f] text-[#c6d0dd] [font-family:'Segoe_UI',system-ui,sans-serif]">
      <div class="flex shrink-0 gap-0.5 bg-[#080b11] px-1.5 pt-1.5">${tabs}${v.tabs.length < maxTabs() ? nb('dsn.newtab', '+', false, 'Open a new tab.') : ''}</div>
      <div class="flex shrink-0 items-center gap-1 border-b bg-[#0e141f] p-1.5" style="border-color:${a}8c">${nb('dsn.back', '&#8249;', !tab.back.length)}${nb('dsn.fwd', '&#8250;', !tab.fwd.length)}${nb('dsn.reload', '&#8635;')}${nb('dsn.home', '&#8962;')}
        <input data-keep="dsn-addr" data-field="addr" value="${esc(v.addr ?? `dsn://${tab.url}`)}" placeholder="type an address, or search" class="mx-1 min-w-0 flex-1 rounded border border-[#30405a] bg-[#080c13] px-3 py-1.5 text-xs text-[#eef2f7] outline-none focus:border-[#62a8c4]" />
        <button data-id="dsn.addr.go" class="${nbtn}" style="background:#183a4d;border-color:#62a8c4;color:#eef2f7">GO</button>
        <button data-id="dsn.circuit" title="Your route through three relays. Click for a new one." class="ml-1 hidden border border-[#1f2a3b] px-2 py-1.5 text-[11px] text-[#808ea4] hover:text-white @2xl:block">${v.circuit.map((i) => `<b class="text-cyan-300">${RELAYS[i]}</b>`).join('<i class="flow mx-1.5 inline-block h-px w-5 align-middle"></i>')}</button></div>
      <div class="flex min-h-0 flex-1">${hasRail ? `<nav data-scroll="dsn-rail" class="hidden w-52 shrink-0 overflow-y-auto border-r border-[#1f2a3b] bg-[#0b1019] py-2 @2xl:block">${rail(game, tab.url)}</nav>` : ''}<main class="min-w-0 flex-1" ${page.bg ? `style="background:${page.bg}"` : ''}>${main}</main></div>
      <div class="flex shrink-0 justify-between border-t border-[#1f2a3b] bg-[#0b1019] px-3 py-1 text-[11px] text-[#808ea4]"><span><i class="animate-pulse text-[#62b58c] [text-shadow:0_0_8px_#62b58c]">&#9679;</i> circuit ok  //  ${listings(game).length} listings  //  ${myJobs(game).length} of 4 jobs yours  //  ${waiting} repl${waiting === 1 ? 'y' : 'ies'} waiting</span><b class="text-[#c9a45c]">${money(game.player.credits)}</b></div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    const v = view();
    const tab = tabOf(v);
    const { addr, ...rest } = v; // typing in the address bar must not redraw it under the caret
    return JSON.stringify([rest, tab.url, g.uiTime - tab.at < 0.5, g.contracts.map((c) => [c.id, c.state, c.reward, haggleOf(g, c.id)?.state, haggleOf(g, c.id)?.log?.length]), g.player.credits, Math.floor(g.clock.minutes / 15), g.news.length]);
  }, render);

  body.addEventListener('click', (e) => {
    const x = e.target.closest('[data-id]');
    if (!x || x.disabled) return;
    click(state, x.dataset.id);
    refresh();
  });
  body.addEventListener('input', (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    if (f === 'addr') view().addr = e.target.value;
    else { edit(state, f, e.target.value); refresh(); }
  });
  body.addEventListener('change', (e) => {
    if (e.target.dataset.check) { toggle(state, e.target.dataset.check, e.target.checked); refresh(); }
  });
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const f = e.target.dataset?.field;
    if (f === 'addr') { click(state, 'dsn.addr.go'); refresh(); }
    else if (f === 'dsn.search') { click(state, 'dsn.search.go'); refresh(); }
  });
}
