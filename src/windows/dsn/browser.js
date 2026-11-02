// DeppSpaceNET: the browser of the hidden network. Tabs, back and forward, an
// address bar, a relay circuit, and pages that take a moment to route. The
// pages themselves are built in pages.js; this file is the browser around them.

import { drawFrame } from '../../ui/panel.js';
import { drawScrolled } from '../../ui/scroll.js';
import { drawButton } from '../../ui/widgets.js';
import { drawField } from '../../ui/field.js';
import { ghost, primary } from '../../ui/styles.js';
import { draw as drawText, ellipsize } from '../../core/text.js';
import { color, cssA } from '../../core/theme.js';
import { buildPage, normalize, HOME } from './pages.js';

const LOAD_SECONDS = 0.6;
const MAX_TABS = 3;
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
  } else if (id.startsWith('dsn.closetab.') && view.tabs.length > 1) {
    view.tabs.splice(Number(id.slice(13)), 1);
    view.active = Math.min(view.active, view.tabs.length - 1);
  } else if (id.startsWith('dsn.tab.')) view.active = Number(id.slice(8));
  else if (id === 'dsn.circuit') {
    // a new path through three different relays
    const k = Math.floor(now * 1000);
    view.circuit = [k % 12, (k + 3 + (k % 5)) % 12, (k + 7 + (k % 3)) % 12];
    tab.at = now;
  } else return false;
  view.addr = id === 'dsn.addr.go' ? null : view.addr;
  return true;
}

/// Draws the browser.
export function drawDsn(ctx, sk, r, game, ui, input, events, view) {
  browserOf(view);
  const tab = tabOf(view);
  const now = game.uiTime ?? 0;
  const page = buildPage(game, tab.url, view);
  const tabs = view.tabs.map((t, i) => ({ id: `dsn.tab.${i}`, label: ellipsize(ctx, buildPage(game, t.url, view).title, 10, 150) }));
  if (view.tabs.length < MAX_TABS) tabs.push({ id: 'dsn.newtab', label: '+' });
  const body = drawFrame(ctx, sk, r, ui, input, events, '', '', tabs, view.active);

  // the toolbar: back, forward, reload, home, the address, the circuit
  const y = body.y;
  const btn = (id, text, x, w, style = ghost()) => {
    if (drawButton(ctx, ui, sk, id, { x, y, w, h: 28 }, text, { ...style, disabled: style.disabled }, input)) events.push({ type: 'click', id });
  };
  btn('dsn.back', '◀', body.x, 30, { ...ghost(), disabled: !tab.back.length });
  btn('dsn.fwd', '▶', body.x + 34, 30, { ...ghost(), disabled: !tab.fwd.length });
  btn('dsn.reload', '⟳', body.x + 68, 30);
  btn('dsn.home', '⌂', body.x + 102, 30);
  const circuitW = 150;
  const addrX = body.x + 140;
  const addrW = Math.max(body.w - (addrX - body.x) - circuitW - 60, 80);
  const shown = view.addr ?? `dsn://${tab.url}`;
  const typed = drawField(ctx, ui, sk, 'dsn.addr', { x: addrX, y, w: addrW, h: 28 }, shown, 'dsn://address', false, input);
  if (typed !== null) view.addr = typed;
  btn('dsn.addr.go', 'GO', addrX + addrW + 4, 44, { ...primary(), isDefault: ui.focus === 'dsn.addr' });
  const cx = body.x + body.w - circuitW;
  if (drawButton(ctx, ui, sk, 'dsn.circuit', { x: cx, y, w: circuitW, h: 28 }, `${view.circuit.map((i) => RELAYS[i]).join(' → ')} ⟳`, ghost(), input)) {
    events.push({ type: 'click', id: 'dsn.circuit' });
  }

  // the page: a stripe of the site's colour, then the page or the routing bar
  const pageR = { x: body.x, y: y + 36, w: body.w, h: body.h - 36 };
  ctx.fillStyle = cssA(page.accent, 0.06);
  ctx.fillRect(pageR.x, pageR.y, pageR.w, pageR.h);
  ctx.fillStyle = color(page.accent);
  ctx.fillRect(pageR.x, pageR.y, pageR.w, 3);
  const loading = now - tab.at < LOAD_SECONDS;
  if (loading) {
    const f = Math.min((now - tab.at) / LOAD_SECONDS, 1);
    const hop = Math.min(Math.floor(f * 3), 2);
    drawText(ctx, `routing through ${view.circuit.map((i) => RELAYS[i]).join(' → ')} // relay ${hop + 1} of 3`, pageR.x + 16, pageR.y + 24, 11, color(sk.dim));
    ctx.fillStyle = cssA(page.accent, 0.25);
    ctx.fillRect(pageR.x + 16, pageR.y + 48, pageR.w - 32, 6);
    ctx.fillStyle = color(page.accent);
    ctx.fillRect(pageR.x + 16, pageR.y + 48, (pageR.w - 32) * f, 6);
    return;
  }
  const inner = { x: pageR.x + 14, y: pageR.y + 12, w: Math.min(pageR.w - 28, 860), h: pageR.h - 18 };
  drawScrolled(ctx, sk, inner, page.controls, `dsn.page.${view.active}.${tab.url}`, ui, input, events);
}
