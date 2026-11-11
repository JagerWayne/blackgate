// Internet XPlorer: the desktop's web browser (the DSNET market, SleekPages).
// Tabs that close, back and forward, one bar for addresses and searches, a
// relay circuit, a rail of places that is always there, and a status bar. It
// draws in its own quiet dark skin (theme.js) whatever the desktop skin; the
// pages themselves are built in pages.js.

import { drawScrolled } from '../../ui/scroll.js';
import { drawButton } from '../../ui/widgets.js';
import { drawField } from '../../ui/field.js';
import { flat } from '../../ui/styles.js';
import { custom } from '../../ui/controls.js';
import { draw as drawText, ellipsize, FONT } from '../../../game/core/text.js';
import { color, cssA } from '../../../game/core/theme.js';
import { darknet } from '../../../game/data/content.js';
import { buildPage, normalize, listings, myJobs, HOME, MY_JOBS, START } from './pages.js';
import { haggleOf, broker } from '../../../game/state/haggle.js';
import { NET, KIND_COLOR, UI_FONT, hexOf, softAccent, netPrimary } from './theme.js';
import { maxTabs } from '../../../game/data/settings.js';
import { t as tl } from '../../../game/data/language.js';

const LOAD_SECONDS = 0.5;
const TAB_H = 36;
const BAR_H = 46;
const STATUS_H = 28;
const RAIL_OPEN = 216;
const RAIL_SHUT = 60;
const RELAYS = ['NL', 'IS', 'SG', 'RO', 'CH', 'PA', 'SE', 'MD', 'HK', 'EE', 'CA', 'BR'];

/// The browser's state: its tabs and the circuit, made on first use.
export function browserOf(view) {
  view.tabs ??= [{ url: START, back: [], fwd: [], at: -1 }];
  view.active = Math.min(view.active ?? 0, view.tabs.length - 1);
  view.circuit ??= [0, 4, 2];
  view.sort ??= 'fee';
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

/// What the address bar means. A known page opens; a typed scheme opens (and
/// may be a 404); anything else, or anything with a space in it, is a search.
export function resolveAddress(game, text) {
  const raw = String(text ?? '').trim();
  if (!raw) return START;
  const u = normalize(raw);
  if (/^(dsn|https?):\/\//i.test(raw)) return u;
  if (!/\s/.test(raw) && (!game || buildPage(game, u).title !== '404')) return u;
  return `search/${encodeURIComponent(raw)}`;
}

/// Closes a tab; the last one stays open.
function closeTab(view, i) {
  browserOf(view);
  if (view.tabs.length <= 1 || !view.tabs[i]) return;
  view.tabs.splice(i, 1);
  if (view.active >= i) view.active = Math.max(view.active - 1, 0);
}

/// The browser's own buttons and links. Returns true when the id was its own.
export function handleDsnClick(view, id, now, game = null) {
  browserOf(view);
  const tab = tabOf(view);
  if (id.startsWith('dsn.go.')) navigate(view, id.slice(7), now);
  // the rail's links have their own ids: a button drawn twice under one id
  // loses its click to whichever copy is drawn first
  else if (id.startsWith('dsn.side.')) navigate(view, id.slice(9), now);
  else if (id === 'dsn.addr.go') navigate(view, resolveAddress(game, view.addr ?? tab.url), now);
  else if (id === 'dsn.search.go') navigate(view, `search/${encodeURIComponent((view.query ?? '').trim() || ' ')}`, now);
  else if (id === 'dsn.home') navigate(view, START, now);
  else if (id === 'dsn.reload') tab.at = now;
  else if (id === 'dsn.rail') view.railOpen = !(view.railOpen ?? view.railShown);
  else if (id.startsWith('dsn.sort.')) view.sort = id.slice(9);
  else if (id === 'dsn.back' && tab.back.length) {
    tab.fwd.push(tab.url);
    tab.url = tab.back.pop();
    tab.at = now;
  } else if (id === 'dsn.fwd' && tab.fwd.length) {
    tab.back.push(tab.url);
    tab.url = tab.fwd.pop();
    tab.at = now;
  } else if (id === 'dsn.newtab' && view.tabs.length < maxTabs()) {
    view.tabs.push({ url: START, back: [], fwd: [], at: now });
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

// -- small drawings -------------------------------------------------------------

/// A line icon in a box: 'back', 'fwd', 'reload', 'home', 'menu', 'close', 'plus'.
function icon(ctx, kind, r, col) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'back') { ctx.moveTo(cx + 3, cy - 6); ctx.lineTo(cx - 3, cy); ctx.lineTo(cx + 3, cy + 6); }
  else if (kind === 'fwd') { ctx.moveTo(cx - 3, cy - 6); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx - 3, cy + 6); }
  else if (kind === 'reload') {
    ctx.arc(cx, cy, 6, Math.PI * 0.25, Math.PI * 1.75);
    ctx.moveTo(cx + 6, cy - 7);
    ctx.lineTo(cx + 6, cy - 2);
    ctx.lineTo(cx + 1, cy - 2);
  } else if (kind === 'home') {
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx, cy - 7);
    ctx.lineTo(cx + 7, cy);
    ctx.moveTo(cx - 5, cy - 1);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.lineTo(cx + 5, cy + 6);
    ctx.lineTo(cx + 5, cy - 1);
  } else if (kind === 'menu') {
    [-5, 0, 5].forEach((dy) => { ctx.moveTo(cx - 7, cy + dy); ctx.lineTo(cx + 7, cy + dy); });
  } else if (kind === 'close') {
    ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4); ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4);
  } else if (kind === 'plus') {
    ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
  }
  ctx.stroke();
  ctx.restore();
}

/// A flat icon button: the id is drawn as a button, the icon over it.
function iconButton(ctx, sk, ui, input, events, id, r, kind, disabled = false, tip = '') {
  const style = { ...flat(), disabled, tip };
  if (drawButton(ctx, ui, sk, id, r, '', style, input)) events.push({ type: 'click', id });
  const hot = ui.hover === id && !disabled;
  icon(ctx, kind, r, color(disabled ? sk.muted : hot ? sk.text_hi : sk.dim));
}

// -- the chrome -------------------------------------------------------------------

/// The tab strip: each tab with its own close button, then +. The front tab
/// shares its colour with the toolbar under it, so the two read as one.
function drawTabs(ctx, sk, r, game, view, ui, input, events) {
  ctx.fillStyle = color(sk.void);
  ctx.fillRect(r.x, r.y, r.w, TAB_H);
  const room = r.w - (view.tabs.length < maxTabs() ? 40 : 0) - 8;
  const tw = Math.min(Math.floor(room / view.tabs.length), 200);
  view.tabs.forEach((t, i) => {
    const on = i === view.active;
    const tr = { x: r.x + 6 + i * tw, y: r.y + 6, w: tw - 2, h: TAB_H - 6 };
    const page = buildPage(game, t.url, view);
    ctx.fillStyle = color(on ? sk.panel : sk.deep);
    ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    if (on) {
      ctx.fillStyle = cssA(page.accent ?? sk.accent, 0.9);
      ctx.fillRect(tr.x, tr.y, tr.w, 2);
    }
    const closable = view.tabs.length > 1;
    const label = { x: tr.x, y: tr.y, w: tr.w - (closable ? 26 : 0), h: tr.h };
    const style = { ...flat(), dark: { ...flat().dark, text: on ? 'text_hi' : 'dim' } };
    if (drawButton(ctx, ui, sk, `dsn.tab.${i}`, label, ellipsize(ctx, page.title, FONT.body, label.w - 20, UI_FONT), style, input)) {
      events.push({ type: 'click', id: `dsn.tab.${i}` });
    }
    // the close button: the last tab has none
    if (closable) {
      const xr = { x: tr.x + tr.w - 26, y: tr.y + 5, w: 22, h: tr.h - 10 };
      if (drawButton(ctx, ui, sk, `dsn.closetab.${i}`, xr, '', flat(), input)) events.push({ type: 'click', id: `dsn.closetab.${i}` });
      icon(ctx, 'close', xr, color(ui.hover === `dsn.closetab.${i}` ? sk.danger : sk.muted));
    }
  });
  if (view.tabs.length < maxTabs()) {
    const nr = { x: r.x + 6 + view.tabs.length * tw + 2, y: r.y + 8, w: 28, h: TAB_H - 10 };
    iconButton(ctx, sk, ui, input, events, 'dsn.newtab', nr, 'plus', false, 'Open a new tab.');
  }
}

/// The toolbar: the rail, back, forward, reload, home, the one bar for
/// addresses and searches, and the circuit.
function drawBar(ctx, sk, r, game, view, tab, rail, ui, input, events) {
  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const y = r.y + 7;
  const sq = (x) => ({ x, y, w: 32, h: 32 });
  let x = r.x + 8;
  if (rail !== null) {
    iconButton(ctx, sk, ui, input, events, 'dsn.rail', sq(x), 'menu', false, rail ? 'Fold the rail away.' : 'Open the rail.');
    x += 38;
  }
  iconButton(ctx, sk, ui, input, events, 'dsn.back', sq(x), 'back', !tab.back.length);
  iconButton(ctx, sk, ui, input, events, 'dsn.fwd', sq(x + 34), 'fwd', !tab.fwd.length);
  iconButton(ctx, sk, ui, input, events, 'dsn.reload', sq(x + 68), 'reload');
  iconButton(ctx, sk, ui, input, events, 'dsn.home', sq(x + 102), 'home');
  const addrX = x + 142;
  const circuitW = r.w >= 760 ? 150 : 96;
  const goW = 48;
  const addrW = Math.max(r.x + r.w - addrX - circuitW - goW - 24, 80);
  const typed = drawField(ctx, ui, sk, 'dsn.addr', { x: addrX, y, w: addrW, h: 32 }, view.addr ?? `dsn://${tab.url}`, 'type an address, or search', false, input);
  if (typed !== null) view.addr = typed;
  const go = { x: addrX + addrW + 6, y, w: goW, h: 32 };
  if (drawButton(ctx, ui, sk, 'dsn.addr.go', go, 'GO', { ...netPrimary(), isDefault: ui.focus === 'dsn.addr' }, input)) events.push({ type: 'click', id: 'dsn.addr.go' });
  if (circuitW) drawCircuit(ctx, sk, { x: go.x + goW + 8, y, w: circuitW, h: 32 }, game, view, ui, input, events);
}

/// The relay circuit: the three countries, with a packet that runs along them.
function drawCircuit(ctx, sk, r, game, view, ui, input, events) {
  const hot = ui.hover === 'dsn.circuit';
  if (drawButton(ctx, ui, sk, 'dsn.circuit', r, '', { ...flat(), tip: tl('windows.dsn.browser.your_route_through_three') }, input)) events.push({ type: 'click', id: 'dsn.circuit' });
  ctx.strokeStyle = color(hot ? sk.line_hi : sk.line);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  const names = view.circuit.map((i) => RELAYS[i]);
  const step = (r.w - 24) / 2;
  names.forEach((n, i) => {
    const px = r.x + 12 + i * step;
    drawText(ctx, n, px, r.y + r.h / 2, FONT.body, color(hot ? sk.text_hi : sk.dim), { align: 'center', baseline: 'middle' });
    if (i < 2 && step > 60) {
      ctx.fillStyle = color(sk.line_hi);
      ctx.fillRect(px + 16, r.y + r.h / 2, step - 32, 1);
    }
  });
  // the packet that runs along the circuit
  const t = ((game.uiTime ?? 0) * 0.5) % 1;
  ctx.fillStyle = color(sk.ok);
  ctx.fillRect(r.x + 14 + t * (r.w - 28), r.y + r.h - 6, 4, 2);
}

// -- the rail -----------------------------------------------------------------------

/// One row of the rail: a button under the whole row, a glyph in a square, a
/// label and a count when the rail is open.
function railRow({ url, text, glyph, tint, count, open, on }) {
  return custom(40, (ctx, sk, r, input, events, st) => {
    const style = on
      ? { ...flat(), dark: { ...flat().dark, fill: 'accent_soft', hover: 'accent_soft' }, tip: text }
      : { ...flat(), tip: text };
    if (drawButton(ctx, st, sk, `dsn.side.${url}`, r, '', style, input)) events.push({ type: 'click', id: `dsn.side.${url}` });
    if (on) {
      ctx.fillStyle = color(sk.accent);
      ctx.fillRect(r.x, r.y + 6, 2, r.h - 12);
    }
    const sq = { x: r.x + 8, y: r.y + 8, w: 24, h: 24 };
    ctx.fillStyle = cssA(tint, on ? 0.28 : 0.16);
    ctx.fillRect(sq.x, sq.y, sq.w, sq.h);
    drawText(ctx, glyph, sq.x + sq.w / 2, sq.y + sq.h / 2 + 1, FONT.body, color(tint), { align: 'center', baseline: 'middle' });
    if (!open) {
      if (count) {
        ctx.fillStyle = color(sk.warn);
        ctx.fillRect(sq.x + sq.w - 4, sq.y - 2, 7, 7);
      }
      return;
    }
    drawText(ctx, ellipsize(ctx, text, FONT.body, r.w - 90, UI_FONT), r.x + 42, r.y + r.h / 2, FONT.body, color(on ? sk.text_hi : sk.text), { baseline: 'middle', family: UI_FONT });
    if (count !== undefined && count !== null) {
      drawText(ctx, String(count), r.x + r.w - 10, r.y + r.h / 2, FONT.body, color(count ? sk.text : sk.muted), { align: 'right', baseline: 'middle' });
    }
  });
}

/// A small title over a block of the rail, shown when the rail is open.
const railHead = (text, open) => custom(open ? 34 : 14, (ctx, sk, r) => {
  if (open) drawText(ctx, text, r.x + 12, r.y + 22, FONT.body, color(sk.muted));
  else {
    ctx.fillStyle = color(sk.line);
    ctx.fillRect(r.x + 14, r.y + 7, r.w - 28, 1);
  }
});

/// The rail: home, MY JOBS, the categories, the brokers, the rest.
function railRows(game, url, open) {
  const all = listings(game);
  const mine = myJobs(game).length;
  const here = (u) => normalize(u) === url;
  const row = (u, text, glyph, tint, count) => railRow({ url: u, text, glyph, tint, count, open, on: here(u) });
  const d = darknet();
  return [
    row(HOME, 'Hub', '⌂', NET.accent),
    row(MY_JOBS, 'My jobs', '★', NET.ok, mine),
    railHead('MARKET', open),
    ...Object.entries(d.categories).map(([k, c]) => row(`cat/${k}`, c.name, c.name[0].toUpperCase(), KIND_COLOR[k], all.filter((j) => j.kind === k).length)),
    railHead('BROKERS', open),
    ...Object.values(d.brokers).map((b) => row(b.domain, b.domain, b.domain[0].toUpperCase(), softAccent(hexOf(b.accent)), all.filter((j) => broker(j.client).domain === b.domain).length)),
    railHead('ELSEWHERE', open),
    row('board', 'The board', '#', NET.violet),
    row('about', 'About', 'i', NET.dim),
  ];
}

// -- the whole browser ---------------------------------------------------------------

/// Draws the browser.
export function drawDsn(ctx, shellSk, r, game, ui, input, events, view) {
  const sk = NET;
  browserOf(view);
  const tab = tabOf(view);
  const now = game.uiTime ?? 0;
  const page = buildPage(game, tab.url, view);

  ctx.fillStyle = color(sk.panel);
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // the market's rail, on the market's pages only, when the window has room
  const hasRail = r.w >= 480 && page.site !== 'web';
  const railOpen = hasRail && (view.railOpen ?? r.w >= 900);
  view.railShown = railOpen;
  const railW = hasRail ? (railOpen ? RAIL_OPEN : RAIL_SHUT) : 0;

  drawTabs(ctx, sk, r, game, view, ui, input, events);
  drawBar(ctx, sk, { x: r.x, y: r.y + TAB_H, w: r.w, h: BAR_H }, game, view, tab, hasRail ? railOpen : null, ui, input, events);
  const top = r.y + TAB_H + BAR_H;
  const bottom = r.y + r.h - STATUS_H;
  ctx.fillStyle = cssA(page.accent ?? sk.accent, 0.55);
  ctx.fillRect(r.x, top, r.w, 1);

  if (hasRail) {
    ctx.fillStyle = color(sk.deep);
    ctx.fillRect(r.x, top + 1, railW, bottom - top - 1);
    ctx.fillStyle = color(sk.line);
    ctx.fillRect(r.x + railW - 1, top + 1, 1, bottom - top - 1);
    drawScrolled(ctx, sk, { x: r.x + 4, y: top + 8, w: railW - 8, h: bottom - top - 12 }, railRows(game, tab.url, railOpen), 'dsn.side', ui, input, events);
  }
  if (page.bg) {
    ctx.fillStyle = page.bg;
    ctx.fillRect(r.x + railW, top + 1, r.w - railW, bottom - top - 1);
  }
  const pageR = { x: r.x + railW + 22, y: top + 16, w: r.w - railW - 40, h: bottom - top - 20 };

  if (now - tab.at < LOAD_SECONDS) {
    const f = Math.min((now - tab.at) / LOAD_SECONDS, 1);
    const hop = Math.min(Math.floor(f * 3), 2);
    drawText(ctx, `routing through ${view.circuit.map((i) => RELAYS[i]).join(' > ')}  //  relay ${hop + 1} of 3`, pageR.x, pageR.y + 12, FONT.body, color(sk.dim));
    ctx.fillStyle = color(sk.track);
    ctx.fillRect(pageR.x, pageR.y + 38, pageR.w, 3);
    ctx.fillStyle = color(page.accent ?? sk.accent);
    ctx.fillRect(pageR.x, pageR.y + 38, pageR.w * f, 3);
  } else if (page.columns && pageR.w >= 760) {
    const lw = Math.floor(pageR.w * 0.56);
    drawScrolled(ctx, sk, { ...pageR, w: lw }, page.columns[0], `dsn.page.${view.active}.${tab.url}.a`, ui, input, events);
    ctx.fillStyle = color(sk.panel2);
    ctx.fillRect(pageR.x + lw + 12, pageR.y - 8, pageR.w - lw - 12 + 18, pageR.h + 12);
    ctx.fillStyle = color(sk.line);
    ctx.fillRect(pageR.x + lw + 12, pageR.y - 8, 1, pageR.h + 12);
    drawScrolled(ctx, sk, { x: pageR.x + lw + 26, y: pageR.y + 2, w: pageR.w - lw - 30, h: pageR.h - 6 }, page.columns[1], `dsn.page.${view.active}.${tab.url}.b`, ui, input, events);
  } else {
    drawScrolled(ctx, sk, pageR, page.controls, `dsn.page.${view.active}.${tab.url}`, ui, input, events);
  }

  drawStatus(ctx, sk, { x: r.x, y: bottom, w: r.w, h: STATUS_H }, game, view, now);
}

/// The status bar: the circuit, the board and the money, in one quiet line.
function drawStatus(ctx, sk, r, game, view, now) {
  ctx.fillStyle = color(sk.deep);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = color(sk.line);
  ctx.fillRect(r.x, r.y, r.w, 1);
  const waiting = game.contracts.filter((c) => haggleOf(game, c.id)?.state === 'waiting').length;
  const cy = r.y + r.h / 2 + 1;
  // a dot that breathes while the circuit is up
  ctx.fillStyle = cssA(sk.ok, 0.55 + 0.35 * Math.sin(now * 2.4));
  ctx.beginPath();
  ctx.arc(r.x + 16, cy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  const credits = `${game.player.credits.toLocaleString('en-US')} cr`;
  const left = `circuit ok  //  ${listings(game).length} listings  //  ${myJobs(game).length} of 4 jobs yours  //  ${waiting} repl${waiting === 1 ? 'y' : 'ies'} waiting`;
  drawText(ctx, ellipsize(ctx, left, FONT.body, r.w - credits.length * 10 - 60), r.x + 28, cy, FONT.body, color(sk.dim), { baseline: 'middle' });
  drawText(ctx, credits, r.x + r.w - 14, cy, FONT.body, color(sk.warn), { align: 'right', baseline: 'middle' });
}
