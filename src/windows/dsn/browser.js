// DeppSpaceNET: the browser of the hidden network. Tabs that close, back and
// forward, an address bar, a relay circuit, a sidebar that is always there,
// and a status bar. It draws in its own dark skin (theme.js) whatever the
// desktop skin; the pages themselves are built in pages.js.

import { drawScrolled } from '../../ui/scroll.js';
import { drawButton } from '../../ui/widgets.js';
import { drawField } from '../../ui/field.js';
import { ghost, flat } from '../../ui/styles.js';
import { section, buttons } from '../../ui/controls.js';
import { draw as drawText, ellipsize } from '../../core/text.js';
import { color, cssA } from '../../core/theme.js';
import { darknet } from '../../data/content.js';
import { buildPage, normalize, listings, myJobs, HOME, MY_JOBS } from './pages.js';
import { haggleOf } from '../../state/haggle.js';
import { NET, KIND_COLOR, netPrimary } from './theme.js';

const LOAD_SECONDS = 0.5;
const MAX_TABS = 6;
const TAB_H = 30;
const BAR_H = 34;
const STATUS_H = 24;
const SIDE_W = 200;
const RELAYS = ['NL', 'IS', 'SG', 'RO', 'CH', 'PA', 'SE', 'MD', 'HK', 'EE', 'CA', 'BR'];

/// The browser's state: its tabs and the circuit, made on first use.
export function browserOf(view) {
  view.tabs ??= [{ url: HOME, back: [], fwd: [], at: -1 }];
  view.active = Math.min(view.active ?? 0, view.tabs.length - 1);
  view.circuit ??= [0, 4, 2];
  return view;
}

/// The tab in front.
function tabOf(view) {
  return browserOf(view).tabs[view.active];
}

/// Goes to an address in the front tab, keeping the way back.
export function navigate(view, url, now = 0) {
  const tab = tabOf(view);
  const to = normalize(url);
  if (to !== tab.url) {
    tab.back.push(tab.url);
    tab.fwd = [];
    tab.url = to;
  }
  tab.at = now;
  view.addr = null;
  view.dropArm = null;
}

/// Closes a tab; the last one stays open.
export function closeTab(view, i) {
  browserOf(view);
  if (view.tabs.length <= 1 || !view.tabs[i]) return;
  view.tabs.splice(i, 1);
  if (view.active >= i) view.active = Math.max(view.active - 1, 0);
}

/// The browser's own buttons and links. Returns true when the id was its own.
export function handleDsnClick(view, id, now) {
  browserOf(view);
  const tab = tabOf(view);
  if (id.startsWith('dsn.go.')) navigate(view, id.slice(7), now);
  else if (id === 'dsn.addr.go') navigate(view, view.addr ?? tab.url, now);
  else if (id === 'dsn.search.go') navigate(view, `search/${encodeURIComponent((view.query ?? '').trim() || ' ')}`, now);
  else if (id === 'dsn.home') navigate(view, HOME, now);
  else if (id === 'dsn.reload') tab.at = now;
  else if (id === 'dsn.back' && tab.back.length) {
    tab.fwd.push(tab.url);
    tab.url = tab.back.pop();
    tab.at = now;
  } else if (id === 'dsn.fwd' && tab.fwd.length) {
    tab.back.push(tab.url);
    tab.url = tab.fwd.pop();
    tab.at = now;
  } else if (id === 'dsn.newtab' && view.tabs.length < MAX_TABS) {
    view.tabs.push({ url: HOME, back: [], fwd: [], at: now });
    view.active = view.tabs.length - 1;
  } else if (id.startsWith('dsn.closetab.')) closeTab(view, Number(id.slice(13)));
  else if (id.startsWith('dsn.tab.')) view.active = Math.min(Number(id.slice(8)), view.tabs.length - 1);
  else if (id === 'dsn.circuit') {
    // a new path through three different relays
    const k = Math.floor(now * 1000);
    view.circuit = [k % 12, (k + 3 + (k % 5)) % 12, (k + 7 + (k % 3)) % 12];
    tab.at = now;
  } else return false;
  return true;
}

/// The tab strip: each tab with its own close button, then +.
function drawTabs(ctx, sk, r, game, view, ui, input, events) {
  ctx.fillStyle = color(sk.deep);
  ctx.fillRect(r.x, r.y, r.w, TAB_H);
  const room = r.w - (view.tabs.length < MAX_TABS ? 36 : 0);
  const tw = Math.min(Math.floor(room / view.tabs.length), 210);
  view.tabs.forEach((t, i) => {
    const on = i === view.active;
    const tr = { x: r.x + i * tw, y: r.y + 3, w: tw - 3, h: TAB_H - 3 };
    ctx.fillStyle = color(on ? sk.panel : sk.panel2);
    ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    if (on) {
      ctx.fillStyle = color(buildPage(game, t.url, view).accent ?? sk.accent);
      ctx.fillRect(tr.x, tr.y, tr.w, 2);
    }
    const title = buildPage(game, t.url, view).title;
    if (drawButton(ctx, ui, sk, `dsn.tab.${i}`, { x: tr.x, y: tr.y, w: tr.w - 24, h: tr.h }, ellipsize(ctx, title, 10.5, tr.w - 40), { ...flat(), dark: { ...flat().dark, text: on ? 'text_hi' : 'dim' }, light: { ...flat().light, text: on ? 'text_hi' : 'dim' } }, input)) {
      events.push({ type: 'click', id: `dsn.tab.${i}` });
    }
    // the close button: the last tab has none
    if (view.tabs.length > 1) {
      const xr = { x: tr.x + tr.w - 24, y: tr.y + 4, w: 20, h: tr.h - 8 };
      if (drawButton(ctx, ui, sk, `dsn.closetab.${i}`, xr, '', flat(), input)) events.push({ type: 'click', id: `dsn.closetab.${i}` });
      // the cross is drawn, not typed, so it reads at any size
      const cx = xr.x + xr.w / 2;
      const cy = xr.y + xr.h / 2;
      ctx.strokeStyle = color(ui.hover === `dsn.closetab.${i}` ? sk.danger : sk.dim);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4);
      ctx.lineTo(cx + 4, cy + 4);
      ctx.moveTo(cx + 4, cy - 4);
      ctx.lineTo(cx - 4, cy + 4);
      ctx.stroke();
    }
  });
  if (view.tabs.length < MAX_TABS && drawButton(ctx, ui, sk, 'dsn.newtab', { x: r.x + view.tabs.length * tw + 4, y: r.y + 4, w: 28, h: TAB_H - 6 }, '+', flat(), input)) {
    events.push({ type: 'click', id: 'dsn.newtab' });
  }
}

/// The toolbar: back, forward, reload, home, the address, the circuit.
function drawBar(ctx, sk, r, game, view, tab, ui, input, events) {
  const y = r.y + 3;
  const btn = (id, text, x, w, style = ghost()) => {
    if (drawButton(ctx, ui, sk, id, { x, y, w, h: 28 }, text, style, input)) events.push({ type: 'click', id });
  };
  btn('dsn.back', '◀', r.x + 4, 30, { ...ghost(), disabled: !tab.back.length });
  btn('dsn.fwd', '▶', r.x + 38, 30, { ...ghost(), disabled: !tab.fwd.length });
  btn('dsn.reload', '⟳', r.x + 72, 30);
  btn('dsn.home', '⌂', r.x + 106, 30);
  const circuitW = 160;
  const addrX = r.x + 144;
  const addrW = Math.max(r.w - (addrX - r.x) - circuitW - 64, 80);
  const typed = drawField(ctx, ui, sk, 'dsn.addr', { x: addrX, y, w: addrW, h: 28 }, view.addr ?? `dsn://${tab.url}`, 'dsn://address', false, input);
  if (typed !== null) view.addr = typed;
  btn('dsn.addr.go', 'GO', addrX + addrW + 4, 44, { ...netPrimary(), isDefault: ui.focus === 'dsn.addr' });
  // the circuit, with a packet that runs along it
  const cx = r.x + r.w - circuitW - 4;
  btn('dsn.circuit', `${view.circuit.map((i) => RELAYS[i]).join(' → ')}  ⟳`, cx, circuitW);
  const t = ((game.uiTime ?? 0) * 0.6) % 1;
  ctx.fillStyle = color(sk.ok);
  ctx.fillRect(cx + 8 + t * (circuitW - 16), y + 25, 4, 2);
}

/// The sidebar: home, MY JOBS, the categories, the brokers, the rest.
function sidebar(game, url) {
  const all = listings(game);
  const here = (u) => normalize(u) === url;
  const item = (u, text, tint) => {
    const style = here(u)
      ? { ...netPrimary() }
      : { ...flat(), dark: { ...flat().dark, text: tint ?? 'text' }, light: { ...flat().light, text: tint ?? 'text' } };
    return buttons([{ id: `dsn.go.${u}`, text, style }]);
  };
  const cats = darknet().categories;
  return [
    item(HOME, '⌂  HUB'),
    item(MY_JOBS, `★  MY JOBS (${myJobs(game).length})`, 'ok'),
    section('MARKET'),
    ...Object.entries(cats).map(([k, c]) => item(`cat/${k}`, `${c.name}  ${all.filter((j) => j.kind === k).length}`, KIND_COLOR[k])),
    section('BROKERS'),
    ...Object.entries(darknet().brokers).map(([, b]) => item(b.domain, b.domain, parseInt(b.accent.slice(1), 16))),
    section('ELSEWHERE'),
    item('board', 'THE BOARD'),
    item('about', 'ABOUT'),
  ];
}

/// Draws the browser.
export function drawDsn(ctx, shellSk, r, game, ui, input, events, view) {
  const sk = NET;
  browserOf(view);
  const tab = tabOf(view);
  const now = game.uiTime ?? 0;
  const page = buildPage(game, tab.url, view);

  // the ground: night, with a faint grid
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = cssA(sk.line, 0.25);
  for (let gx = r.x; gx < r.x + r.w; gx += 32) ctx.fillRect(gx, r.y, 1, r.h);
  for (let gy = r.y; gy < r.y + r.h; gy += 32) ctx.fillRect(r.x, gy, r.w, 1);

  drawTabs(ctx, sk, r, game, view, ui, input, events);
  drawBar(ctx, sk, { x: r.x, y: r.y + TAB_H, w: r.w, h: BAR_H }, game, view, tab, ui, input, events);
  const top = r.y + TAB_H + BAR_H + 4;
  const bottom = r.y + r.h - STATUS_H;
  ctx.fillStyle = color(page.accent ?? sk.accent);
  ctx.fillRect(r.x, top - 3, r.w, 2);

  // the sidebar, when there is room for it
  const side = r.w >= 640;
  if (side) {
    ctx.fillStyle = color(sk.deep);
    ctx.fillRect(r.x, top, SIDE_W, bottom - top);
    drawScrolled(ctx, sk, { x: r.x + 8, y: top + 8, w: SIDE_W - 12, h: bottom - top - 12 }, sidebar(game, tab.url), 'dsn.side', ui, input, events);
  }
  const pageR = { x: r.x + (side ? SIDE_W : 0) + 18, y: top + 12, w: r.w - (side ? SIDE_W : 0) - 30, h: bottom - top - 16 };

  if (now - tab.at < LOAD_SECONDS) {
    const f = Math.min((now - tab.at) / LOAD_SECONDS, 1);
    const hop = Math.min(Math.floor(f * 3), 2);
    drawText(ctx, `routing through ${view.circuit.map((i) => RELAYS[i]).join(' → ')} // relay ${hop + 1} of 3`, pageR.x, pageR.y + 12, 11, color(sk.dim));
    ctx.fillStyle = color(sk.track);
    ctx.fillRect(pageR.x, pageR.y + 36, pageR.w, 6);
    ctx.fillStyle = color(page.accent ?? sk.accent);
    ctx.fillRect(pageR.x, pageR.y + 36, pageR.w * f, 6);
  } else if (page.columns && pageR.w >= 760) {
    const lw = Math.floor(pageR.w * 0.56);
    drawScrolled(ctx, sk, { ...pageR, w: lw }, page.columns[0], `dsn.page.${view.active}.${tab.url}.a`, ui, input, events);
    ctx.fillStyle = color(sk.panel2);
    ctx.fillRect(pageR.x + lw + 10, pageR.y - 4, pageR.w - lw - 10, pageR.h + 4);
    drawScrolled(ctx, sk, { x: pageR.x + lw + 22, y: pageR.y + 4, w: pageR.w - lw - 30, h: pageR.h - 8 }, page.columns[1], `dsn.page.${view.active}.${tab.url}.b`, ui, input, events);
  } else {
    drawScrolled(ctx, sk, pageR, page.controls, `dsn.page.${view.active}.${tab.url}`, ui, input, events);
  }

  // the status bar
  ctx.fillStyle = color(sk.deep);
  ctx.fillRect(r.x, bottom, r.w, STATUS_H);
  const waiting = game.contracts.filter((c) => haggleOf(game, c.id)?.state === 'waiting').length;
  const status = `${listings(game).length} open listings  //  ${myJobs(game).length} of 4 jobs yours  //  ${waiting} repl${waiting === 1 ? 'y' : 'ies'} waiting  //  ${game.player.credits.toLocaleString('en-US')} cr  //  circuit ok`;
  drawText(ctx, ellipsize(ctx, status, 10, r.w - 20), r.x + 10, bottom + 6, 10, color(sk.dim));
}
