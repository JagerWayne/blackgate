import { HOST_LABEL, SERVICE_LABEL } from '../../game/data/enums.js';
import { MAP_FILTERS, mapHosts, filterCount } from '../../game/state/mapQuery.js';
import { savedRoutes, hopNumber, maxHops } from '../../game/state/routes.js';
import { hops as cleanHops, downloadCap } from '../../game/state/gateway.js';
import { routeFactor, toolLevel } from '../../game/state/gameState.js';
import { downloadFree } from '../../game/state/gameHelpers.js';
import { copyRate } from '../../game/state/transfer.js';
import { surfaceText, routeText } from '../../game/state/hud.js';
import { routeLines } from '../../game/state/session.js';
import { traceWarnAt } from '../../game/systems/sessionTick.js';
import { demand, slots } from '../../game/systems/compute.js';
import { taskError } from '../../game/systems/sessionTasks.js';
import { authOf, AUTH_LABEL } from '../../game/data/auth.js';
import { TRAITS, traitOf } from '../../game/data/traits.js';
import { hostMenu, sabotageNotes } from '../../pages/windows/sessionActions.js';
import { fileMenu, logMenu, lockMenu } from '../../pages/windows/sessionTabs.js';
import { voiceAdmin, hasSample } from '../../game/state/voice.js';
import { drawMapWorld } from '../../pages/windows/mapWorld.js';
import { makeInput, attach, endFrame } from '../../game/systems/input.js';
import { theme } from '../../game/core/theme.js';
import { esc, click, autoRender, showMenu } from '../ui.js';
import { networkHtml, dossiersHtml, peopleHtml, recordsHtml, cliHtml, cliKey, shellOf, tasksHtml } from './hostTabs.js';
import { maxRoutes } from '../../game/data/settings.js';

const TABS = [['map', 'Nexus Map'], ['link', 'Live Link'], ['network', 'Company Map'], ['dossiers', 'Dossiers']];
const LINK_TABS = ['ACCESS', 'STORAGE', 'RECORDS', 'PEOPLE', 'CLI'];
const btn = 'rounded border border-line px-2 py-0.5 text-[11px] enabled:hover:bg-white/10 disabled:opacity-30';
const primary = 'rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-bg enabled:hover:brightness-110 disabled:opacity-30';
const stamp = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ownerOf = (game, h) => (h.company !== null && h.company !== undefined ? game.world.companies[h.company]?.name ?? '' : '');

/// Bl@ckG@te: the Nexus Map and the Live Link. Everything the buttons do goes through the game's own
/// click handler with the canvas ids, and the state lives where the canvas windows kept it
/// (state.win.blackgate, state.win.map), because the tutorial reads it.
export function mountBlackgate(body, state) {
  const V = () => (state.win.blackgate ??= {}); // the game replaces this object when a link opens, so never hold it
  const mv = (state.win.map ??= {});
  const dv = () => (state.win.dossiers ??= {});
  const xf = () => ((V().xf ??= {}).files ??= { folder: 'files', sel: null });
  const send = (id) => { click(state, id); refresh(); };
  let refresh = () => {};
  const world = Object.assign(document.createElement('canvas'), { className: 'absolute inset-0 h-full w-full' });
  const worldInput = makeInput();
  attach(world, worldInput, { addEventListener() {} }); // the pointer only: the page's keys are the game's, not the map's

  // -- Nexus Map ------------------------------------------------------------------
  function hostRow(game, h) {
    const hop = hopNumber(game, h.id);
    const full = game.player.bounce.length >= maxHops(game);
    return `<tr data-act="selhost" data-id="${h.id}" data-tutorial="host.${h.id}" class="cursor-default border-t border-line ${h.id === mv.sel ? 'bg-accent/20' : 'hover:bg-white/5'}">
      <td class="px-3 py-1.5">${game.favorites.includes(h.id) ? '<span class="text-amber-300">&#9733;</span> ' : ''}<b>${esc(h.name)}</b>
        <div class="text-[10px] text-ink/50">${esc(HOST_LABEL[h.kind] ?? '')}${ownerOf(game, h) ? ` // ${esc(ownerOf(game, h))}` : ''}${hop ? ` // <span class="text-amber-300">HOP ${hop}</span>` : ''}</div></td>
      <td class="px-3 text-right text-accent">${esc(h.ip)}</td>
      <td class="whitespace-nowrap px-3 text-right"><button data-act="map" data-id="map.hop.${h.id}" ${!hop && full ? 'disabled' : ''} class="${btn}">${hop ? '-HOP' : '+HOP'}</button>
        <button data-act="map" data-id="map.go.${h.id}" data-tutorial="map.go.${h.id}" class="${primary}">LINK</button></td></tr>`;
  }

  function hostCard(game) {
    const h = mv.sel !== undefined && mv.sel !== null ? game.world.hosts[mv.sel] : null;
    if (!h?.discovered) return '<p class="p-3 text-ink/40">pick a host in the list</p>';
    const fav = game.favorites.includes(h.id);
    return `<div class="space-y-1 p-3 text-xs">
      <div class="flex items-center gap-2"><button data-act="map" data-id="map.fav.${h.id}" class="${fav ? 'text-amber-300' : 'text-ink/40'} text-lg" title="favourite">&#9733;</button><b class="text-sm">${esc(h.name)}</b></div>
      <div class="text-ink/60">${esc(HOST_LABEL[h.kind] ?? '')} // ${esc(h.ip)}</div>
      <div>OWNER <span class="text-ink/70">${esc(ownerOf(game, h) || 'INDEPENDENT')}</span></div>
      ${surfaceText(game, { target: h.id }) ? `<div class="text-accent">${esc(surfaceText(game, { target: h.id }))}</div>` : ''}</div>`;
  }

  function routeTab(game) {
    const route = game.player.bounce;
    const clean = cleanHops(game.player.gateway);
    const pick = mv.sel !== undefined && mv.sel !== null ? game.world.hosts[mv.sel] : null;
    const canAdd = pick?.discovered && !route.includes(pick.id) && route.length < maxHops(game);
    const hops = route.map((id, i) => {
      const h = game.world.hosts[id];
      const ok = i < clean;
      return `<li class="rounded border-l-4 bg-bg/60 p-2 ${ok ? 'border-emerald-400' : 'border-red-400'}"><b>${i + 1} ${esc(h?.name ?? '?')}</b>
        <div class="text-[10px] ${ok ? 'text-ink/50' : 'text-red-300'}">${esc(h?.ip ?? '')}${ok ? '' : ' // past your clean hops: slows the link'}</div>
        <div class="mt-1 flex gap-1"><button data-act="map" data-id="map.up.${i}" ${i === 0 ? 'disabled' : ''} class="${btn}">UP</button><button data-act="map" data-id="map.down.${i}" ${i === route.length - 1 ? 'disabled' : ''} class="${btn}">DOWN</button><button data-act="map" data-id="map.show.${id}" class="${btn}">SHOW</button><button data-act="map" data-id="map.hop.${id}" class="${btn}">REMOVE</button></div></li>`;
    }).join('');
    return `<div class="space-y-2 p-3 text-xs"><b>BOUNCE ROUTE // ${route.length} of ${maxHops(game)} hops</b>
      <p class="text-ink/50">each hop hides you behind another machine: a trace has to walk back through every one</p>
      <ol class="space-y-1">${hops || '<li class="text-amber-300">no hops yet: links go straight from your gateway. Press +HOP on a host.</li>'}</ol>
      <div>TRACE SPEED <b class="text-emerald-400">${Math.round(routeFactor(game) * 100)}%</b> // RELAY HOPS ${Math.min(route.length, clean)} / ${clean}</div>
      <div class="flex gap-1"><button data-act="map" data-id="map.addsel" ${canAdd ? '' : 'disabled'} class="${primary}">${pick?.discovered ? `ADD ${esc(pick.name)}` : 'ADD PICKED HOST'}</button>
        <button data-act="map" data-id="map.route.save" ${!route.length || savedRoutes(game).length >= maxRoutes() ? 'disabled' : ''} class="${primary}">SAVE ROUTE</button>
        <button data-act="map" data-id="map.route.clear" ${route.length ? '' : 'disabled'} class="${btn}">CLEAR</button></div></div>`;
  }

  function savedTab(game) {
    const rows = savedRoutes(game).map((s, i) => `<li class="flex items-center justify-between gap-2 border-t border-line p-2"><span><b>${esc(s.name)}</b> <span class="text-ink/50">${s.hops.length} hops</span><br><span class="text-[10px] text-ink/50">${esc(s.hops.map((id) => game.world.hosts[id]?.name ?? '?').join(' > '))}</span></span>
      <span class="flex gap-1"><button data-act="map" data-id="map.route.load.${i}" class="${primary}">USE</button><button data-act="map" data-id="map.route.del.${i}" class="${btn}">DELETE</button></span></li>`).join('');
    return `<ul class="text-xs">${rows || `<li class="p-3 text-ink/40">no routes kept yet // build one on the ROUTE tab and SAVE it (up to ${maxRoutes()})</li>`}</ul>`;
  }

  function mapHtml(game) {
    const hosts = mapHosts(game, mv);
    const route = game.player.bounce;
    const tab = ['HOSTS', 'ROUTE', 'SAVED'].includes(mv.tab) ? mv.tab : 'HOSTS';
    const count = { HOSTS: hosts.length, ROUTE: route.length, SAVED: savedRoutes(game).length };
    const pane = tab === 'ROUTE' ? routeTab(game) : tab === 'SAVED' ? savedTab(game)
      : `<div class="grid h-full grid-rows-[1fr_auto]"><div data-scroll="hosts" class="overflow-y-auto"><table class="w-full text-xs"><tbody>${hosts.map((h) => hostRow(game, h)).join('') || `<tr><td class="p-3 text-ink/40">${mv.query ? `nothing matches "${esc(mv.query)}"` : 'nothing in this filter'}</td></tr>`}</tbody></table></div><div class="max-h-48 overflow-y-auto border-t border-line">${hostCard(game)}</div></div>`;
    return `<div class="flex h-full flex-col">
      <div class="flex shrink-0 items-center gap-2 border-b border-line p-2 text-xs">
        <input data-keep="map-search" data-field="query" value="${esc(mv.query ?? '')}" placeholder="search name, address, owner, kind" class="w-64 rounded border border-line bg-bg px-2 py-1 outline-none focus:border-accent" />
        <select data-field="kind" class="rounded border border-line bg-bg px-2 py-1">${MAP_FILTERS.map(([k, n]) => `<option value="${k}" ${k === (mv.kind ?? 'all') ? 'selected' : ''}>${n} ${filterCount(game, k)}</option>`).join('')}</select>
        <span class="ml-auto text-ink/50">${game.world.hosts.filter((h) => h.discovered).length} hosts found // route ${route.length} of ${maxHops(game)} hops</span></div>
      <div class="grid min-h-0 flex-1 grid-cols-[3fr_2fr]">
        <div data-mapslot class="relative min-h-0 border-r border-line"></div>
        <div class="flex min-h-0 flex-col">
          <div class="flex shrink-0 gap-1 border-b border-line p-2">${['HOSTS', 'ROUTE', 'SAVED'].map((t) => `<button data-act="map" data-id="map.tab.${t}" class="${t === tab ? primary : btn}">${t} ${count[t]}</button>`).join('')}</div>
          <div class="min-h-0 flex-1 overflow-y-auto" data-scroll="mappane">${pane}</div></div></div></div>`;
  }

  // -- Live Link ------------------------------------------------------------------
  function accessTab(game, s) {
    const h = game.world.hosts[s.target];
    const mine = toolLevel(game, 'PasswordCracker');
    const rows = h.services.map((svc, i) => {
      const auth = authOf(svc);
      const lock = svc.open ? (svc.tokenLeft === undefined ? 'OPEN' : `TOKEN ${Math.ceil(svc.tokenLeft)}s`) : auth === 'mfa' || auth === 'session' ? AUTH_LABEL[auth] : `LOCK v${svc.password}`;
      return `<tr data-ctx="svc" data-i="${i}" data-tutorial="sess.svc.${i}" class="border-t border-line hover:bg-white/5"><td class="px-3 py-1.5 ${svc.open ? 'text-emerald-400' : ''}"><b>${esc(svc.name)}:${svc.port}</b><div class="text-[10px] text-ink/50">${esc(SERVICE_LABEL[svc.kind] ?? '')}</div></td>
        <td class="px-3 text-right ${svc.open ? 'text-emerald-400' : 'text-amber-300'}">${lock}${svc.open ? '' : `<div class="text-[10px] text-ink/50">YOUR BREAKER v${mine}</div>`}</td></tr>`;
    }).join('');
    return `<table class="w-full text-xs"><tbody>${rows || '<tr><td class="p-3 text-ink/40">no services</td></tr>'}</tbody></table><p class="p-3 text-[11px] text-ink/40">right-click a locked service to open it</p>`;
  }

  function storageTab(game, s) {
    const h = game.world.hosts[s.target];
    const x = xf();
    const free = Math.max(downloadFree(game), 0);
    const rate = copyRate(game.player.gateway);
    // NAME header: click toggles A-Z / Z-A; unsorted keeps the host's order (logs newest first)
    const dir = x.sort === 'desc' ? -1 : 1;
    const byName = (a, b) => dir * a.localeCompare(b, undefined, { numeric: true });
    const files = h.files.map((f, i) => [f, i]).filter(([f]) => !f.deleted);
    const logs = h.logs.slice(-120).reverse();
    if (x.sort) {
      files.sort(([a], [b]) => byName(a.name, b.name));
      logs.sort((a, b) => byName(stamp(a.minute), stamp(b.minute)));
    }
    const node = (id, text, on, n) => `<button data-act="xnode" data-folder="${id}" data-tutorial="sess.x.node.${id}" class="flex w-full items-center gap-2 px-3 py-1 text-left text-xs ${on ? 'bg-accent/15' : 'hover:bg-white/5'}"><i class="h-3 w-4 rounded-sm bg-amber-400"></i><span class="flex-1 truncate">${esc(text)}</span>${n == null ? '' : `<span class="text-ink/40">${n}</span>`}</button>`;
    const fileRows = files.map(([f, i]) => {
      const copyWhy = taskError(game, s, 'CopyFile', i) ?? '';
      const delWhy = taskError(game, s, 'DeleteFile', i) ?? '';
      const slow = f.size > free || f.size / rate > (s.windowLeft ?? Infinity);
      return `<tr data-ctx="file" data-i="${i}" data-act="xpick" data-key="f${i}" data-tutorial="sess.x.row.f${i}" class="cursor-default border-t border-line ${x.sel === `f${i}` ? 'bg-accent/20' : 'hover:bg-white/5'}"><td class="px-3 py-1.5"><b>${esc(f.name)}</b>${copyWhy || delWhy ? `<div class="text-[10px] text-amber-300">${esc([copyWhy && `copy: ${copyWhy}`, delWhy && delWhy !== copyWhy && `delete: ${delWhy}`].filter(Boolean).join(' // '))}</div>` : ''}</td>
        <td class="px-3 ${slow ? 'text-red-300' : f.enc > 0 ? 'text-amber-300' : 'text-ink/60'}">${f.enc > 0 ? `ENCRYPTED v${f.enc}` : 'PLAINTEXT'} // ${Math.ceil(f.size / rate)}s to copy</td><td class="px-3 text-right text-ink/60">${f.size} GB</td></tr>`;
    }).join('');
    const logRows = logs.map((l, i) => `<tr data-ctx="log" data-act="xpick" data-key="l${i}" data-tutorial="sess.x.row.l${i}" class="cursor-default border-t border-line ${x.sel === `l${i}` ? 'bg-accent/20' : 'hover:bg-white/5'}"><td class="px-3 py-1.5 ${l.loud ? 'text-red-300' : ''}">${stamp(l.minute)}.log</td><td class="px-3 text-ink/60" colspan="2">${esc(l.ip)} // ${esc(l.text)}</td></tr>`).join('');
    const inFiles = x.folder !== 'logs';
    return `<div class="flex h-full flex-col"><div class="shrink-0 border-b border-line px-3 py-1 text-[11px] ${free > 0 ? 'text-ink/50' : 'text-red-300'}">GATEWAY // ${free} GB FREE OF ${downloadCap(game.player.gateway)} // ${rate.toFixed(1)} GB/s // right-click a file or the logs</div>
      <div class="grid min-h-0 flex-1 grid-cols-[11rem_1fr]"><nav class="border-r border-line py-1">${node('root', `${h.name} (${h.ip})`, false)}${node('files', 'files', inFiles, files.length)}${node('logs', 'logs', !inFiles, logs.length)}</nav>
      <div data-scroll="xplore" class="overflow-y-auto"><table class="w-full text-xs"><thead><tr><th class="px-3 py-1 text-left"><button data-act="xsort" class="text-[10px] tracking-widest text-ink/50 hover:text-ink">NAME ${x.sort === 'desc' ? '&#9660;' : x.sort === 'asc' ? '&#9650;' : ''}</button></th><th></th><th></th></tr></thead><tbody>${(inFiles ? fileRows : logRows) || `<tr><td class="p-3 text-ink/40">${inFiles ? 'no files' : 'the host has written nothing down'}</td></tr>`}</tbody></table></div></div></div>`;
  }

  function headHtml(game, s, h) {
    const warn = traceWarnAt(game);
    const jobs = game.contracts.filter((c) => c.target === s.target && (c.state === 'accepted' || c.state === 'ready'));
    const pct = Math.round(s.trace * 100);
    const burnOff = s.phase !== 'online' || !!s.burned;
    return `<header class="flex items-start gap-4 border-b border-line bg-bg/40 p-3 text-xs">
      <div data-ctx="host" data-tutorial="sess.host" class="min-w-0 flex-1"><b class="text-sm">${esc(h.name)}</b><div class="text-accent">${esc(HOST_LABEL[h.kind] ?? '')} // ${esc(h.ip)}</div><div class="text-[10px] text-ink/40">right-click the host for bypasses, network tools and the logs</div></div>
      <div class="w-48"><div>TRACE ${pct}% // WARNS AT ${Math.round(warn * 100)}%</div><div class="mt-1 h-2 overflow-hidden rounded bg-line"><div class="h-full ${s.trace > warn || s.trace > 0.75 ? 'bg-red-500' : s.trace > 0.4 ? 'bg-amber-400' : 'bg-emerald-400'}" style="width:${pct}%"></div></div>
        <div class="mt-1 ${s.phase === 'online' ? 'text-emerald-400' : 'text-amber-300'}">${s.phase === 'online' ? 'LINK UP' : 'NEGOTIATING'}${s.windowLeft !== undefined ? ` // WINDOW ${Math.max(Math.ceil(s.windowLeft), 0)}s` : ''}</div></div>
      <div class="w-44 text-ink/70">${jobs.length ? `JOB #${jobs[0].id}<br><b class="${jobs[0].state === 'ready' ? 'text-emerald-400' : 'text-amber-300'}">${jobs[0].state === 'ready' ? 'DONE // SUBMIT IT' : 'IN HAND'}</b>` : 'no job on this host'}</div>
      <div class="flex flex-col gap-1"><button data-act="send" data-id="sess.burn" ${burnOff ? 'disabled' : ''} class="${btn}">${s.burned ? 'BURNED' : 'BURN LINE'}</button><button data-act="send" data-id="sess.disconnect" data-tutorial="sess.disconnect" class="${btn}">DISCONNECT</button></div></header>`;
  }

  function linkHtml(game) {
    const s = game.session;
    if (!s) return '<p class="p-6 text-ink/50">no live link: pick a host on the NEXUS MAP and open a link</p>';
    const h = game.world.hosts[s.target];
    const trait = traitOf(h);
    const notes = [...sabotageNotes(game, s).map((n) => `<p class="${n.tone === 'danger' ? 'text-red-300' : 'text-amber-300'}">${esc(n.text)}</p>`),
      ...(trait ? [`<p><b class="text-amber-300">${TRAITS[trait].label}</b> <span class="text-ink/50">${esc(TRAITS[trait].note)}</span></p>`] : []),
      ...[surfaceText(game, s), routeText(game, s)].filter(Boolean).map((t) => `<p class="text-accent">${esc(t)}</p>`)].join('');
    // a new link starts on the CLI tab for operators who asked for it
    if (V().cliSeen !== s) {
      V().cliSeen = s;
      if (game.settings.cliDefault) V().tab = 4;
    }
    const tab = V().tab ?? 0;
    let inner;
    if (s.phase !== 'online') {
      const p = Math.round(Math.min(s.connectT / s.connectDur, 1) * 100);
      inner = `<div class="space-y-2 p-4 text-xs"><b>NEGOTIATING LINK // HANDSHAKE ${p}%</b><div class="h-2 overflow-hidden rounded bg-line"><div class="h-full bg-accent" style="width:${p}%"></div></div>${routeLines(game, s).map((l) => `<div class="${l.done ? 'text-emerald-400' : 'text-amber-300'}">${esc(l.text)}</div>`).join('')}</div>`;
    } else {
      const tabs = LINK_TABS.map((t, i) => `<button data-act="send" data-id="sess.tab.${i}" data-tutorial="sess.tab.${i}" class="px-3 py-1.5 text-xs ${i === tab ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${t}</button>`).join('');
      inner = `<div class="flex h-full flex-col"><div class="flex shrink-0 border-b border-line">${tabs}</div><div data-scroll="linktab" class="min-h-0 flex-1 overflow-y-auto">${[accessTab, storageTab, null, null, null][tab]?.(game, s) ?? ''}${tab === 2 ? recordsHtml(game, s, V()) : tab === 3 ? peopleHtml(game, V()) : tab === 4 ? cliHtml(game, s, V()) : ''}</div></div>${tasksHtml(s)}`;
    }
    return `<div class="flex h-full flex-col">${headHtml(game, s, h)}${notes ? `<div class="shrink-0 space-y-1 border-b border-line p-2 text-[11px]">${notes}</div>` : ''}<div class="relative min-h-0 flex-1">${inner}</div>
      <footer class="shrink-0 border-t border-line bg-bg p-2 text-[10px]"><div class="mb-1 flex justify-between text-ink/40"><span>LINK LOG</span><span>TASK SLOTS ${demand(game, s)}/${slots(game)}</span></div>${s.lines.slice(-5).map((l) => `<div class="truncate text-emerald-300/90">${esc(l)}</div>`).join('')}</footer></div>`;
  }

  // -- the window -----------------------------------------------------------------
  function render() {
    const game = state.game;
    if (!TABS.some(([k]) => k === V().suite)) V().suite = game.session ? 'link' : 'map';
    const content = V().suite === 'map' ? mapHtml(game) : V().suite === 'link' ? linkHtml(game) : V().suite === 'network' ? networkHtml(game) : dossiersHtml(game, dv());
    body.innerHTML = `<div class="flex h-full flex-col"><nav class="flex shrink-0 border-b border-line">${TABS.map(([k, n]) => `<button data-act="send" data-id="suite.blackgate.${k}" data-tutorial="suite.blackgate.${k}" class="px-4 py-2 text-xs font-bold ${k === V().suite ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${n}</button>`).join('')}</nav><div class="min-h-0 flex-1">${content}</div></div>`;
    // the world map is one canvas kept between redraws: put it back in its slot
    body.querySelector('[data-mapslot]')?.append(world);
    const pin = body.querySelector('[data-pin]');
    if (pin) pin.scrollTop = pin.scrollHeight;
    if (dv().focusSearch) {
      body.querySelector('[data-keep="dos-q"]')?.focus();
      dv().focusSearch = false;
    }
    // a host picked from elsewhere (the tutorial, SHOW) is scrolled to once
    if (mv.follow && V().suite === 'map') {
      body.querySelector(`[data-act="selhost"][data-id="${mv.sel}"]`)?.scrollIntoView({ block: 'center' });
      mv.follow = false;
    }
  }

  const digest = () => {
    const g = state.game;
    const s = g.session;
    const h = s ? g.world.hosts[s.target] : null;
    if (s?.phase === 'online' && V().suite === 'link' && V().tab === 4) shellOf(V(), g, s); // pulls link-log lines into the CLI
    const sh = V().sh;
    return JSON.stringify([dv().q, dv().sort, dv().pplSel, dv().dTab, dv().armed, dv().focusSearch, V().pplSel, V().dTab, V().recSel, V().recQuery, sh?.lines.length, g.intel,
      s?.tasks.map((t) => [t.label, Math.round(t.progress * 50), t.queued]), V().suite, V().tab, V().xf, mv.sel, mv.query, mv.kind, mv.tab, mv.follow, g.favorites, g.player.bounce, savedRoutes(g).length,
      g.world.hosts.reduce((n, x) => n + (x.discovered ? 1 : 0), 0), g.player.tools, g.contracts.map((c) => c.state), g.player.storage.length,
      s && [s.target, s.phase, Math.round(s.trace * 100), Math.ceil(s.windowLeft ?? 0), Math.round((s.connectT ?? 0) * 4), s.lines.length, s.burned, s.tasks.length,
        h.files.map((f) => (f.deleted ? 1 : 0)).join(''), h.logs.length, h.services.map((v) => (v.open ? 1 : 0)).join(''), h.services.map((v) => Math.ceil(v.tokenLeft ?? 0)).join(',')]]);
  };
  refresh = autoRender(body, digest, render);

  // the world map: the canvas drawing of the Nexus Map (windows/mapWorld.js), unchanged. It reads its own
  // pointer through the game's input module; a click on a pin sets mv.sel, which the host list follows.
  const timer = setInterval(() => {
    if (!body.isConnected) return clearInterval(timer);
    const slot = body.querySelector('[data-mapslot]');
    if (!slot || V().suite !== 'map') return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = slot.clientWidth;
    const h = slot.clientHeight;
    if (!w || !h) return;
    if (world.width !== Math.round(w * dpr) || world.height !== Math.round(h * dpr)) {
      world.width = Math.round(w * dpr);
      world.height = Math.round(h * dpr);
    }
    const g = world.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMapWorld(g, theme(), { x: 0, y: 0, w, h }, state.game, mv, worldInput, new Set(mapHosts(state.game, mv).map((x) => x.id)));
    endFrame(worldInput);
  }, 33);

  // -- input ----------------------------------------------------------------------
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const d = b.dataset;
    if (d.act === 'send' || d.act === 'map') send(d.id);
    else if (d.act === 'selhost') { mv.sel = Number(d.id); mv.glide = true; refresh(); }
    else if (d.act === 'xnode') { Object.assign(xf(), { folder: d.folder === 'root' ? 'files' : d.folder, sel: null }); refresh(); }
    else if (d.act === 'xpick') { xf().sel = d.key; refresh(); }
    else if (d.act === 'xsort') { const x = xf(); x.sort = x.sort === 'asc' ? 'desc' : 'asc'; x.sel = null; refresh(); }
    else if (d.act === 'ppick') { (d.w === 'dos' ? dv() : V()).pplSel = Number(d.who); refresh(); }
    else if (d.act === 'rpick') { V().recSel = Number(d.who); refresh(); }
  });
  body.addEventListener('input', (e) => {
    const f = e.target.dataset.field;
    if (f === 'query') { mv.query = e.target.value; refresh(); }
    else if (f === 'dosq') { dv().q = e.target.value; refresh(); }
    else if (f === 'recq') { V().recQuery = e.target.value; refresh(); }
    else if (f === 'cli' && V().sh) V().sh.input = e.target.value;
  });
  body.addEventListener('keydown', (e) => {
    if (e.target.dataset.field !== 'cli' || !V().sh) return;
    const sh = V().sh;
    if (cliKey(e, state.game, sh, e.target)) {
      // `exit` closes the link the way the button does
      if (sh.want === 'disconnect') { sh.want = null; click(state, 'sess.disconnect'); }
      refresh();
    }
  });
  body.addEventListener('change', (e) => { if (e.target.dataset.field === 'kind') { mv.kind = e.target.value; refresh(); } });
  body.addEventListener('contextmenu', (e) => {
    const t = e.target.closest('[data-ctx]');
    const game = state.game;
    const s = game.session;
    if (!t || !s) return;
    e.preventDefault();
    const h = game.world.hosts[s.target];
    const i = Number(t.dataset.i);
    let items;
    let key;
    if (t.dataset.ctx === 'host') { items = hostMenu(game, s); key = 'sess.host'; }
    else if (t.dataset.ctx === 'file') { items = fileMenu(game, s, h.files[i], i); key = `sess.x.row.f${i}`; }
    else if (t.dataset.ctx === 'log') { items = logMenu(game, s); key = t.dataset.tutorial; }
    else {
      const svc = h.services[i];
      const auth = authOf(svc);
      const voice = svc.kind === 'voice';
      const who = voice ? voiceAdmin(game, h) : null;
      items = lockMenu(game, s, svc, i, { voice, sampled: who !== null && hasSample(game, who), mfa: auth === 'mfa' || auth === 'session', auth });
      key = `sess.svc.${i}`;
    }
    // the tutorial reads ui.ctx to know a menu is open on a row, and lights the item in it
    state.ui.ctx = { key };
    showMenu(items, e.clientX, e.clientY, (id) => id && send(id), () => { state.ui.ctx = null; });
  });
}
