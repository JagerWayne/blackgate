// eForest, the hardware store of the network, as a website: a green and orange
// storefront with a search, departments, a deal of the day, product pages with
// a "fits your machine" check, a cart, three deliveries and an orders page.
// Nothing here changes the game: it draws pages and sends clicks (ef.*), which
// events.js turns into cart and order changes.

import { custom, field } from '../../ui/controls.js';
import { roundRect } from '../../ui/kit.js';
import { draw as drawText, ellipsize, wrapLines, FONT } from '../../../game/core/text.js';
import { logDate } from '../../../game/state/logs.js';
import {
  DEPARTMENTS, DELIVERY, MAX_QTY, browse, productById, dealOf, fitsNote, cartLines, cartTotal, cartCount,
  deliveryFee, arrivalDate, ordersOf,
} from '../../../game/state/eforest.js';

const GREEN = '#0f3d2e';
const GREEN2 = '#0a2c21';
const GREEN3 = '#1d5a43';
const ORANGE = '#f59e0b';
const ORANGE_D = '#d98200';
const BG = '#e8efea';
const INK = '#10231a';
const DIM = '#52665c';
const LINE = '#d3dfd7';
const LINK = '#0b6e5a';
const PRICE = '#b12704';
const OK = '#1a7f3d';
const TIER = ['#8a97a6', '#4fc27a', '#3f9bf0', '#9a6ae6', '#f0953a', '#e0524f', '#f2cb4c'];

const inside = (input, r) => input?.mouse && input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h;
const press = (input, r) => input?.pressed && inside(input, r);
const go = (events, url) => events.push({ type: 'click', id: `dsn.go.${url}` });
const act = (events, id) => events.push({ type: 'click', id });
const money = (n) => `${Math.round(n).toLocaleString('en-US')} cr`;

function plate(ctx, r, fill, radius = 10) {
  ctx.fillStyle = fill;
  roundRect(ctx, r, radius);
  ctx.fill();
}

/// A button: orange to add to the cart, deeper orange to buy, outlined or dark otherwise.
function button(ctx, r, text, kind, input) {
  const hot = inside(input, r);
  const fill = kind === 'buy' ? (hot ? '#e08a00' : ORANGE_D) : kind === 'cart' ? (hot ? '#ffb733' : ORANGE) : kind === 'dark' ? (hot ? GREEN3 : GREEN) : null;
  if (fill) plate(ctx, r, fill, r.h / 2);
  else {
    ctx.strokeStyle = LINK;
    ctx.lineWidth = 1.5;
    roundRect(ctx, { x: r.x + 0.75, y: r.y + 0.75, w: r.w - 1.5, h: r.h - 1.5 }, r.h / 2);
    ctx.stroke();
    if (hot) plate(ctx, r, 'rgba(11,110,90,0.1)', r.h / 2);
  }
  drawText(ctx, text, r.x + r.w / 2, r.y + r.h / 2, FONT.body, kind === 'dark' ? '#ffffff' : fill ? '#1a1205' : LINK, { align: 'center', baseline: 'middle' });
  return press(input, r);
}

/// A five-point star path of radius r.
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

/// Five stars, filled to a rating. Returns the width they took.
function stars(ctx, x, y, rating, r = 8) {
  for (let i = 0; i < 5; i += 1) {
    const cx = x + r + i * (r * 2 + 2);
    ctx.fillStyle = '#c9d4cd';
    starPath(ctx, cx, y, r);
    ctx.fill();
    const frac = Math.min(Math.max(rating - i, 0), 1);
    if (frac > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r, y - r, r * 2 * frac, r * 2);
      ctx.clip();
      ctx.fillStyle = ORANGE;
      starPath(ctx, cx, y, r);
      ctx.fill();
      ctx.restore();
    }
  }
  return 5 * (r * 2 + 2);
}

// -- the artwork of a product ----------------------------------------------------------

/// A picture of the product, drawn from simple shapes, in the colour of its tier.
function art(ctx, p, r) {
  plate(ctx, r, '#f4f8f5', 10);
  const t = TIER[(Math.max(p.tier, 1) - 1) % TIER.length];
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = Math.min(r.w, r.h) * 0.62;
  const box = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(cx + x, cy + y, w, h); };
  const frame = (x, y, w, h, c = 'rgba(0,0,0,0.35)') => { ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.strokeRect(cx + x + 0.5, cy + y + 0.5, w - 1, h - 1); };
  const dot = (x, y, rad, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx + x, cy + y, rad, 0, Math.PI * 2); ctx.fill(); };
  const kind = p.kind;
  if (kind === 'cpu') {
    box(-s / 2, -s / 2, s, s, '#cfd6dd'); frame(-s / 2, -s / 2, s, s);
    box(-s / 2, -s / 2, s, s * 0.22, t);
    box(-s * 0.22, -s * 0.12, s * 0.44, s * 0.44, '#8e99a4');
    for (let i = 1; i < 8; i += 1) { ctx.fillStyle = '#b5922e'; ctx.fillRect(cx - s / 2 + (s * i) / 8, cy - s / 2 - 6, 3, 6); ctx.fillRect(cx - s / 2 + (s * i) / 8, cy + s / 2, 3, 6); }
  } else if (kind === 'storage') {
    const ssd = !p.def.rpm;
    if (p.type === 'm2') {
      box(-s * 0.62, -s * 0.16, s * 1.24, s * 0.32, '#1d2a24'); frame(-s * 0.62, -s * 0.16, s * 1.24, s * 0.32);
      box(-s * 0.62, -s * 0.16, 7, s * 0.32, '#c9a53c');
      box(-s * 0.3, -s * 0.1, s * 0.22, s * 0.2, '#3a4a42'); box(0, -s * 0.1, s * 0.22, s * 0.2, '#3a4a42');
      box(s * 0.3, -s * 0.12, s * 0.2, s * 0.24, t);
    } else {
      const w = String(p.type).startsWith('hdd35') ? s * 1.1 : p.type === 'hdd18' ? s * 0.8 : s * 0.95;
      const h = w * 0.7;
      box(-w / 2, -h / 2, w, h, ssd ? '#cdd5dc' : '#bcc6cf'); frame(-w / 2, -h / 2, w, h);
      if (ssd) { box(-w * 0.34, -h * 0.28, w * 0.5, h * 0.56, '#f2f5f7'); box(-w * 0.34, -h * 0.28, 5, h * 0.56, t); } else {
        dot(-w * 0.12, 0, h * 0.34, '#8b96a1'); dot(-w * 0.12, 0, h * 0.1, '#e9edf0');
        ctx.strokeStyle = '#4b5660'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + w * 0.3, cy - h * 0.3); ctx.lineTo(cx - w * 0.04, cy - h * 0.04); ctx.stroke();
        box(w * 0.16, h * 0.22, w * 0.26, h * 0.14, t);
      }
      box(w / 2 - 12, -h * 0.12, 8, h * 0.24, '#c9a53c');
    }
  } else if (kind === 'modem') {
    if (p.tier >= 4) {
      ctx.strokeStyle = '#6b7882'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * 0.46, Math.PI * 0.15, Math.PI * 0.85, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.12); ctx.lineTo(cx + s * 0.28, cy - s * 0.4); ctx.stroke();
      box(-3, -s * 0.1, 6, s * 0.5, '#6b7882'); box(-s * 0.3, s * 0.38, s * 0.6, 6, '#6b7882'); dot(s * 0.28, -s * 0.4, 5, t);
    } else {
      box(-s * 0.5, -s * 0.3, s, s * 0.6, '#3a4852'); frame(-s * 0.5, -s * 0.3, s, s * 0.6);
      for (let i = 0; i < 8; i += 1) box(-s * 0.36 + i * (s * 0.09), -s * 0.18, 4, s * 0.14, '#c9a53c');
      dot(-s * 0.4, -s * 0.24, 3, '#4cf08a'); dot(s * 0.4, -s * 0.24, 3, t);
      box(-s * 0.3, 0, s * 0.6, s * 0.2, t);
    }
  } else if (kind === 'accel' || kind === 'fpga' || kind === 'hsm') {
    box(-s * 0.62, -s * 0.3, s * 1.24, s * 0.6, '#16304a'); frame(-s * 0.62, -s * 0.3, s * 1.24, s * 0.6, '#2fa77a');
    box(-s * 0.62, -s * 0.3, s * 1.24, 5, t);
    for (let i = 0; i < 12; i += 1) box(-s * 0.56 + i * (s * 0.1), s * 0.3, 4, 8, '#c9a53c');
    if (kind === 'accel') { dot(0, -s * 0.02, s * 0.2, '#6b7882'); dot(0, -s * 0.02, s * 0.05, '#16304a'); } else if (kind === 'fpga') {
      for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) box(-s * 0.16 + i * s * 0.13, -s * 0.18 + j * s * 0.13, s * 0.09, s * 0.09, t);
    } else {
      ctx.strokeStyle = t; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx - s * 0.12, cy - s * 0.02, s * 0.1, 0, Math.PI * 2); ctx.stroke(); box(-s * 0.02, -s * 0.03, s * 0.32, 4, t);
    }
  } else if (kind === 'security') {
    ctx.fillStyle = t;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx + s * 0.42, cy - s * 0.3); ctx.lineTo(cx + s * 0.42, cy + s * 0.08); ctx.lineTo(cx, cy + s * 0.5); ctx.lineTo(cx - s * 0.42, cy + s * 0.08); ctx.lineTo(cx - s * 0.42, cy - s * 0.3);
    ctx.closePath(); ctx.fill();
    box(-s * 0.13, -s * 0.06, s * 0.26, s * 0.2, '#ffffff');
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy - s * 0.06, s * 0.09, Math.PI, 0); ctx.stroke();
  } else if (kind === 'board') {
    const f = p.def.form;
    const w = s * (0.7 + f * 0.1);
    const h = s * (0.7 + f * 0.07);
    box(-w / 2, -h / 2, w, h, '#14513c'); frame(-w / 2, -h / 2, w, h, '#c9a53c');
    for (let i = 0; i < Math.min(p.def.cpu_slots, 4); i += 1) box(-w * 0.4 + i * (w * 0.18), -h * 0.38, w * 0.14, w * 0.14, '#1b1f26');
    for (let i = 0; i < Math.min(p.def.storage_slots, 6); i += 1) box(-w * 0.42 + i * (w * 0.13), h * 0.12, w * 0.09, h * 0.2, '#c9a53c');
    box(-w * 0.42, h * 0.38, w * 0.84, 4, '#2fa77a'); dot(w * 0.34, 0, 4, t);
  } else {
    const wide = p.def.form >= 5;
    const w = wide ? s * 1.3 : s * 0.62;
    const h = wide ? s * 0.5 : s * 1.1;
    box(-w / 2, -h / 2, w, h, '#2a3a33'); frame(-w / 2, -h / 2, w, h, '#6b7d73');
    box(-w / 2 + 4, -h / 2 + 4, w - 8, wide ? h - 8 : h * 0.18, '#36483f');
    const bays = Math.min(p.def.bays ?? 4, 8);
    for (let i = 0; i < bays; i += 1) {
      if (wide) box(-w / 2 + 14 + i * ((w - 28) / bays), -h / 2 + 14, (w - 28) / bays - 5, h - 28, '#51635a');
      else box(-w / 2 + 8, -h / 2 + h * 0.26 + i * (h * 0.09), w - 16, h * 0.06, '#51635a');
    }
    dot(w / 2 - 10, h / 2 - 10, 3, '#4cf08a'); box(-w / 2 + 6, -h / 2 + 6, 10, 4, t);
  }
}

// -- the parts every page has ----------------------------------------------------------

/// The top bar: logo, who it delivers to, orders and the cart.
function header(game) {
  const count = cartCount(game);
  return custom(70, (ctx, sk, r, input, events) => {
    ctx.fillStyle = GREEN;
    ctx.fillRect(r.x, r.y, r.w, 62);
    // the logo: a little tree and the name
    const logo = { x: r.x + 14, y: r.y + 8, w: 160, h: 46 };
    ctx.fillStyle = ORANGE;
    [[0, 0.1, 0.6], [0.1, 0.35, 0.8], [0.18, 0.62, 1]].forEach(([top, base, w]) => {
      ctx.beginPath();
      ctx.moveTo(logo.x + 22, logo.y + 4 + top * 30);
      ctx.lineTo(logo.x + 22 + 17 * w, logo.y + 14 + base * 30);
      ctx.lineTo(logo.x + 22 - 17 * w, logo.y + 14 + base * 30);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#7a4a1d';
    ctx.fillRect(logo.x + 19, logo.y + 34, 6, 8);
    drawText(ctx, 'e', logo.x + 46, logo.y + 8, FONT.title, ORANGE);
    drawText(ctx, 'Forest', logo.x + 62, logo.y + 8, FONT.title, '#ffffff');
    if (press(input, logo)) go(events, 'eforest.nx');
    if (r.w >= 620) {
      drawText(ctx, 'Deliver to', r.x + 200, r.y + 14, FONT.body, '#9fc2b2');
      drawText(ctx, ellipsize(ctx, game.player.handle, FONT.emphasis, 130), r.x + 200, r.y + 32, FONT.emphasis, '#ffffff');
    }
    // orders and the cart, on the right
    const cart = { x: r.x + r.w - 120, y: r.y + 8, w: 106, h: 46 };
    const orders = { x: r.x + r.w - 220, y: r.y + 8, w: 92, h: 46 };
    if (inside(input, cart)) plate(ctx, cart, 'rgba(255,255,255,0.12)', 8);
    if (inside(input, orders)) plate(ctx, orders, 'rgba(255,255,255,0.12)', 8);
    // the basket
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cart.x + 8, cart.y + 16); ctx.lineTo(cart.x + 14, cart.y + 16); ctx.lineTo(cart.x + 20, cart.y + 34); ctx.lineTo(cart.x + 38, cart.y + 34); ctx.lineTo(cart.x + 42, cart.y + 20); ctx.lineTo(cart.x + 15, cart.y + 20);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cart.x + 24, cart.y + 39, 2.5, 0, Math.PI * 2); ctx.arc(cart.x + 35, cart.y + 39, 2.5, 0, Math.PI * 2); ctx.fill();
    plate(ctx, { x: cart.x + 26, y: cart.y + 3, w: 22, h: 18 }, ORANGE, 9);
    drawText(ctx, String(count), cart.x + 37, cart.y + 12, FONT.body, '#1a1205', { align: 'center', baseline: 'middle' });
    drawText(ctx, 'Cart', cart.x + 56, cart.y + 14, FONT.emphasis, '#ffffff');
    drawText(ctx, 'Returns', orders.x + 8, orders.y + 6, FONT.body, '#9fc2b2');
    drawText(ctx, '& Orders', orders.x + 8, orders.y + 24, FONT.emphasis, '#ffffff');
    if (press(input, cart)) go(events, 'eforest.nx/cart');
    if (press(input, orders)) go(events, 'eforest.nx/orders');
  });
}

/// The department bar under it.
function departments(dept, game) {
  return custom(46, (ctx, sk, r, input, events) => {
    ctx.fillStyle = GREEN2;
    ctx.fillRect(r.x, r.y, r.w, 40);
    let x = r.x + 10;
    DEPARTMENTS.forEach(([id, label]) => {
      const w = Math.ceil(label.length * 8.4) + 26;
      if (x + w > r.x + r.w - 140) return;
      const b = { x, y: r.y + 4, w, h: 32 };
      if (inside(input, b)) plate(ctx, b, 'rgba(255,255,255,0.1)', 6);
      drawText(ctx, label, b.x + w / 2, b.y + 16, FONT.body, id === dept ? '#ffffff' : '#bcd6c9', { align: 'center', baseline: 'middle' });
      if (id === dept) { ctx.fillStyle = ORANGE; ctx.fillRect(b.x + 10, b.y + 29, w - 20, 3); }
      if (press(input, b)) go(events, id === 'all' ? 'eforest.nx' : `eforest.nx/s/${id}`);
      x += w + 2;
    });
    const deal = dealOf(game);
    const d = { x: r.x + r.w - 130, y: r.y + 4, w: 120, h: 32 };
    drawText(ctx, "Today's deal", d.x + d.w / 2, d.y + 16, FONT.body, ORANGE, { align: 'center', baseline: 'middle' });
    if (press(input, d)) go(events, `eforest.nx/p/${deal.id}`);
  });
}

/// The page foot.
function footer() {
  return custom(130, (ctx, sk, r) => {
    ctx.fillStyle = GREEN;
    ctx.fillRect(r.x, r.y + 20, r.w, 100);
    drawText(ctx, 'eForest', r.x + 24, r.y + 38, FONT.emphasis, '#ffffff');
    drawText(ctx, ellipsize(ctx, 'Hardware for the network. Pay with credits, pick a delivery, fit it in the Device Manager.', FONT.body, r.w - 48), r.x + 24, r.y + 64, FONT.body, '#9fc2b2');
    drawText(ctx, ellipsize(ctx, 'Economy: free, 3 days  //  Standard: 2 days  //  Next day: tomorrow, for a fee', FONT.body, r.w - 48), r.x + 24, r.y + 88, FONT.body, '#7fa898');
  });
}

/// A heading above a block of products.
function heading(text, sub) {
  return custom(sub ? 58 : 44, (ctx, sk, r) => {
    drawText(ctx, text, r.x + 4, r.y + 6, FONT.heading, INK);
    if (sub) drawText(ctx, ellipsize(ctx, sub, FONT.body, r.w - 8), r.x + 4, r.y + 32, FONT.body, DIM);
  });
}

// -- a grid of product cards -------------------------------------------------------------

const CARD_W = 228;
const CARD_H = 338;

/// Products as cards: a picture, a name, stars, a price and a button.
function grid(game, items) {
  const across = (w) => Math.max(1, Math.floor((w + 12) / (CARD_W + 12)));
  const deal = dealOf(game);
  return custom((w) => Math.max(Math.ceil(items.length / across(w)), 1) * (CARD_H + 12) + 4, (ctx, sk, r, input, events) => {
    const n = across(r.w);
    const cw = (r.w - (n - 1) * 12) / n;
    if (!items.length) drawText(ctx, 'nothing matches: try another word or department', r.x + 6, r.y + 10, FONT.body, DIM);
    items.forEach((p, k) => {
      const c = { x: r.x + (k % n) * (cw + 12), y: r.y + Math.floor(k / n) * (CARD_H + 12), w: cw, h: CARD_H };
      plate(ctx, c, '#ffffff', 12);
      if (inside(input, c)) { ctx.strokeStyle = ORANGE; ctx.lineWidth = 2; roundRect(ctx, { x: c.x + 1, y: c.y + 1, w: c.w - 2, h: c.h - 2 }, 12); ctx.stroke(); }
      art(ctx, p, { x: c.x + 10, y: c.y + 10, w: c.w - 20, h: 138 });
      const onDeal = deal.id === p.id;
      if (onDeal) { plate(ctx, { x: c.x + 16, y: c.y + 16, w: 90, h: 22 }, PRICE, 11); drawText(ctx, '-25% deal', c.x + 61, c.y + 27, FONT.body, '#ffffff', { align: 'center', baseline: 'middle' }); }
      drawText(ctx, `by ${p.brand}`, c.x + 14, c.y + 156, FONT.body, DIM);
      const lines = wrapLines(ctx, p.name, FONT.emphasis, c.w - 28);
      lines.slice(0, 2).forEach((l, i) => drawText(ctx, i === 1 && lines.length > 2 ? ellipsize(ctx, `${l}...`, FONT.emphasis, c.w - 28) : l, c.x + 14, c.y + 176 + i * 22, FONT.emphasis, LINK));
      const sw = stars(ctx, c.x + 14, c.y + 236, p.rating, 7);
      drawText(ctx, p.reviews.toLocaleString('en-US'), c.x + 14 + sw + 6, c.y + 229, FONT.body, LINK);
      const price = onDeal ? deal.price : p.price;
      drawText(ctx, money(price), c.x + 14, c.y + 252, FONT.heading, PRICE);
      if (onDeal) drawText(ctx, `was ${money(p.price)}`, c.x + c.w - 14, c.y + 258, FONT.body, DIM, { align: 'right' });
      drawText(ctx, 'FREE delivery with Economy', c.x + 14, c.y + 282, FONT.body, OK);
      const b = { x: c.x + 14, y: c.y + c.h - 40, w: c.w - 28, h: 30 };
      const area = { x: c.x, y: c.y, w: c.w, h: c.h - 46 };
      if (button(ctx, b, 'Add to cart', 'cart', input)) act(events, `ef.add.${p.id}`);
      else if (press(input, area)) go(events, `eforest.nx/p/${p.id}`);
    });
  });
}

// -- the pages ------------------------------------------------------------------------------

/// The deal of the day, as a wide banner.
function dealBanner(game) {
  const deal = dealOf(game);
  return custom(214, (ctx, sk, r, input, events) => {
    const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
    g.addColorStop(0, GREEN);
    g.addColorStop(1, GREEN3);
    ctx.fillStyle = g;
    roundRect(ctx, { x: r.x, y: r.y, w: r.w, h: 202 }, 14);
    ctx.fill();
    plate(ctx, { x: r.x + 22, y: r.y + 20, w: 140, h: 26 }, ORANGE, 13);
    drawText(ctx, 'DEAL OF THE DAY', r.x + 92, r.y + 33, FONT.body, '#1a1205', { align: 'center', baseline: 'middle' });
    drawText(ctx, ellipsize(ctx, deal.name, FONT.title, r.w * 0.5), r.x + 22, r.y + 62, FONT.title, '#ffffff');
    drawText(ctx, money(deal.price), r.x + 22, r.y + 104, FONT.title, ORANGE);
    drawText(ctx, ellipsize(ctx, `was ${money(deal.was)}  //  25% off until midnight`, FONT.body, r.w * 0.5), r.x + 22, r.y + 140, FONT.body, '#bcd6c9');
    if (button(ctx, { x: r.x + 22, y: r.y + 160, w: 160, h: 32 }, 'See the deal', 'cart', input)) go(events, `eforest.nx/p/${deal.id}`);
    if (r.w >= 560) art(ctx, deal, { x: r.x + r.w - 230, y: r.y + 14, w: 210, h: 174 });
  });
}

/// A stand-in product to draw a department's picture.
const SAMPLE = {
  cases: { kind: 'case', tier: 4, type: '', def: { form: 4, bays: 4 } },
  boards: { kind: 'board', tier: 3, type: '', def: { form: 4, cpu_slots: 2, storage_slots: 4 } },
  cpus: { kind: 'cpu', tier: 3, type: '', def: {} },
  drives: { kind: 'storage', tier: 3, type: 'ssd25', def: { rpm: 0 } },
  network: { kind: 'modem', tier: 2, type: '', def: {} },
  cards: { kind: 'accel', tier: 3, type: '', def: {} },
  security: { kind: 'security', tier: 3, type: '', def: {} },
};

/// The department tiles of the home page.
function tiles() {
  return custom(124, (ctx, sk, r, input, events) => {
    const list = DEPARTMENTS.filter(([id]) => id !== 'all');
    const n = Math.max(2, Math.min(list.length, Math.floor(r.w / 130)));
    const cw = (r.w - (n - 1) * 10) / n;
    list.slice(0, n).forEach(([id, label], i) => {
      const c = { x: r.x + i * (cw + 10), y: r.y, w: cw, h: 112 };
      plate(ctx, c, inside(input, c) ? '#fff6e6' : '#ffffff', 12);
      art(ctx, SAMPLE[id], { x: c.x + 8, y: c.y + 8, w: c.w - 16, h: 68 });
      drawText(ctx, label, c.x + c.w / 2, c.y + 94, FONT.body, INK, { align: 'center', baseline: 'middle' });
      if (press(input, c)) go(events, `eforest.nx/s/${id}`);
    });
  });
}

const TYPES = [['all', 'All drives'], ['m2', 'M.2 SSD'], ['hdd18', '1.8" HDD'], ['ssd25', '2.5" SSD'], ['hdd25', '2.5" HDD'], ['hdd35_5200', '3.5" 5200'], ['hdd35_7200', '3.5" 7200'], ['hdd35_10000', '3.5" 10000']];

/// The sort and the filter above a list.
function toolbar(count, view, dept) {
  return custom(dept === 'drives' ? 90 : 52, (ctx, sk, r, input, events) => {
    drawText(ctx, `${count} result${count === 1 ? '' : 's'}`, r.x + 4, r.y + 8, FONT.emphasis, INK);
    const sorts = [['featured', 'Featured'], ['low', 'Price: low'], ['high', 'Price: high'], ['rating', 'Top rated']];
    let x = r.x + r.w;
    [...sorts].reverse().forEach(([id, text]) => {
      const w = Math.ceil(text.length * 8.4) + 22;
      x -= w + 6;
      if (x < r.x + 130) return;
      const on = (view.efSort ?? 'featured') === id;
      const b = { x, y: r.y + 2, w, h: 28 };
      plate(ctx, b, on ? GREEN : '#ffffff', 14);
      drawText(ctx, text, b.x + w / 2, b.y + 14, FONT.body, on ? '#ffffff' : LINK, { align: 'center', baseline: 'middle' });
      if (press(input, b)) act(events, `ef.sort.${id}`);
    });
    if (dept === 'drives') {
      let tx = r.x;
      TYPES.forEach(([id, text]) => {
        const w = Math.ceil(text.length * 8.4) + 20;
        const on = (view.efType ?? 'all') === id;
        const b = { x: tx, y: r.y + 44, w, h: 28 };
        plate(ctx, b, on ? ORANGE : '#ffffff', 14);
        drawText(ctx, text, b.x + w / 2, b.y + 14, FONT.body, on ? '#1a1205' : LINK, { align: 'center', baseline: 'middle' });
        if (press(input, b)) act(events, `ef.type.${id}`);
        tx += w + 6;
      });
    }
  });
}

/// A product's own page: the picture, the details and the buy box.
function productView(game, p, view) {
  const note = fitsNote(game, p);
  const deal = dealOf(game);
  const price = deal.id === p.id ? deal.price : p.price;
  const qty = Math.min(Math.max(view.efQty ?? 1, 1), MAX_QTY);
  const wide = (w) => w >= 780;
  return custom((w) => (wide(w) ? Math.max(430, 200 + p.specs.length * 54 + 60) : 760 + p.specs.length * 44), (ctx, sk, r, input, events) => {
    const w = wide(r.w);
    const artR = { x: r.x, y: r.y, w: w ? 300 : r.w, h: w ? 300 : 260 };
    art(ctx, p, artR);
    const mx = w ? r.x + 316 : r.x;
    const mw = w ? r.w - 316 - 266 : r.w;
    let y = w ? r.y : r.y + artR.h + 16;
    drawText(ctx, `by ${p.brand}`, mx, y, FONT.body, LINK);
    y += 24;
    wrapLines(ctx, p.name, FONT.title, mw).slice(0, 3).forEach((l) => { drawText(ctx, l, mx, y, FONT.title, INK); y += 32; });
    const sw = stars(ctx, mx, y + 8, p.rating, 9);
    drawText(ctx, `${p.rating.toFixed(1)}  (${p.reviews.toLocaleString('en-US')} ratings)`, mx + sw + 8, y, FONT.body, LINK);
    y += 28;
    ctx.fillStyle = LINE;
    ctx.fillRect(mx, y, mw, 1);
    y += 14;
    drawText(ctx, money(price), mx, y, FONT.title, PRICE);
    if (deal.id === p.id) drawText(ctx, ellipsize(ctx, `was ${money(p.price)}  //  deal of the day`, FONT.body, mw - 150), mx + 150, y + 8, FONT.body, DIM);
    y += 46;
    drawText(ctx, 'About this item', mx, y, FONT.emphasis, INK);
    y += 26;
    p.specs.forEach((s) => {
      wrapLines(ctx, s, FONT.body, mw - 20).slice(0, 3).forEach((l, i) => {
        if (!i) { ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(mx + 5, y + 8, 3, 0, Math.PI * 2); ctx.fill(); }
        drawText(ctx, l, mx + 18, y, FONT.body, INK);
        y += 22;
      });
      y += 4;
    });
    // the buy box
    const bb = w ? { x: r.x + r.w - 250, y: r.y, w: 250, h: 372 } : { x: r.x, y: y + 12, w: r.w, h: 372 };
    plate(ctx, bb, '#ffffff', 12);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    roundRect(ctx, { x: bb.x + 0.5, y: bb.y + 0.5, w: bb.w - 1, h: bb.h - 1 }, 12);
    ctx.stroke();
    drawText(ctx, money(price), bb.x + 16, bb.y + 14, FONT.title, PRICE);
    drawText(ctx, ellipsize(ctx, `FREE delivery ${arrivalDate(game, 'economy')}`, FONT.body, bb.w - 32), bb.x + 16, bb.y + 52, FONT.body, OK);
    drawText(ctx, ellipsize(ctx, `Next day: ${arrivalDate(game, 'nextday')}`, FONT.body, bb.w - 32), bb.x + 16, bb.y + 74, FONT.body, DIM);
    plate(ctx, { x: bb.x + 16, y: bb.y + 100, w: 20, h: 20 }, note.ok ? OK : PRICE, 10);
    drawText(ctx, note.ok ? '✓' : '!', bb.x + 26, bb.y + 110, FONT.body, '#ffffff', { align: 'center', baseline: 'middle' });
    drawText(ctx, ellipsize(ctx, note.text, FONT.body, bb.w - 56), bb.x + 44, bb.y + 102, FONT.body, note.ok ? OK : PRICE);
    drawText(ctx, 'Quantity', bb.x + 16, bb.y + 142, FONT.body, DIM);
    const minus = { x: bb.x + 16, y: bb.y + 164, w: 34, h: 32 };
    const plus = { x: bb.x + 116, y: bb.y + 164, w: 34, h: 32 };
    plate(ctx, minus, '#eef3ef', 8); plate(ctx, plus, '#eef3ef', 8);
    drawText(ctx, '-', minus.x + 17, minus.y + 16, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
    drawText(ctx, '+', plus.x + 17, plus.y + 16, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
    drawText(ctx, String(qty), bb.x + 83, bb.y + 180, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
    if (press(input, minus)) act(events, `ef.pq.${qty - 1}`);
    if (press(input, plus)) act(events, `ef.pq.${qty + 1}`);
    if (button(ctx, { x: bb.x + 16, y: bb.y + 216, w: bb.w - 32, h: 36 }, 'Add to cart', 'cart', input)) act(events, `ef.padd.${p.id}`);
    if (button(ctx, { x: bb.x + 16, y: bb.y + 262, w: bb.w - 32, h: 36 }, 'Buy now', 'buy', input)) act(events, `ef.buy.${p.id}`);
    drawText(ctx, 'Parts arrive in your stock.', bb.x + 16, bb.y + 316, FONT.body, DIM);
    drawText(ctx, ellipsize(ctx, 'Fitting takes the machine offline.', FONT.body, bb.w - 32), bb.x + 16, bb.y + 338, FONT.body, DIM);
  });
}

/// The cart: its lines, and the box with the delivery and the total.
function cartView(game, view) {
  const lines = cartLines(game);
  const way = view.efWay ?? 'economy';
  const goods = cartTotal(game);
  const fee = deliveryFee(game, way);
  const total = goods + fee;
  const wide = (w) => w >= 720;
  return custom((w) => (wide(w) ? Math.max(lines.length * 112 + 110, 460) : lines.length * 112 + 560), (ctx, sk, r, input, events) => {
    const w = wide(r.w);
    const lw = w ? r.w - 330 : r.w;
    plate(ctx, { x: r.x, y: r.y, w: lw, h: Math.max(lines.length * 112 + 70, 120) }, '#ffffff', 12);
    drawText(ctx, lines.length ? 'Shopping cart' : 'Your eForest cart is empty', r.x + 20, r.y + 16, FONT.heading, INK);
    if (!lines.length) drawText(ctx, 'Pick something from the departments above.', r.x + 20, r.y + 52, FONT.body, DIM);
    lines.forEach((l, i) => {
      const y = r.y + 56 + i * 112;
      ctx.fillStyle = LINE;
      ctx.fillRect(r.x + 20, y - 6, lw - 40, 1);
      art(ctx, l.item, { x: r.x + 20, y, w: 96, h: 96 });
      const nameR = { x: r.x + 128, y, w: Math.max(lw - 128 - 130, 80), h: 26 };
      drawText(ctx, ellipsize(ctx, l.item.name, FONT.emphasis, nameR.w), nameR.x, y + 2, FONT.emphasis, LINK);
      if (press(input, nameR)) go(events, `eforest.nx/p/${l.id}`);
      drawText(ctx, ellipsize(ctx, `by ${l.item.brand}  //  ${money(l.each)} each`, FONT.body, nameR.w), r.x + 128, y + 28, FONT.body, DIM);
      drawText(ctx, 'In stock', r.x + 128, y + 50, FONT.body, OK);
      const minus = { x: r.x + 128, y: y + 68, w: 28, h: 26 };
      const plus = { x: r.x + 196, y: y + 68, w: 28, h: 26 };
      plate(ctx, minus, '#eef3ef', 6); plate(ctx, plus, '#eef3ef', 6);
      drawText(ctx, '-', minus.x + 14, minus.y + 13, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
      drawText(ctx, '+', plus.x + 14, plus.y + 13, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
      drawText(ctx, String(l.qty), r.x + 176, y + 81, FONT.emphasis, INK, { align: 'center', baseline: 'middle' });
      const del = { x: r.x + 236, y: y + 70, w: 70, h: 22 };
      drawText(ctx, 'Delete', del.x, del.y + 2, FONT.body, LINK);
      if (press(input, minus)) act(events, `ef.qty.${l.id}.${l.qty - 1}`);
      if (press(input, plus)) act(events, `ef.qty.${l.id}.${l.qty + 1}`);
      if (press(input, del)) act(events, `ef.qty.${l.id}.0`);
      drawText(ctx, money(l.line), r.x + lw - 20, y + 4, FONT.heading, PRICE, { align: 'right' });
    });
    // the order box
    const box = w ? { x: r.x + lw + 14, y: r.y, w: 316, h: 440 } : { x: r.x, y: r.y + lines.length * 112 + 90, w: r.w, h: 440 };
    plate(ctx, box, '#ffffff', 12);
    drawText(ctx, 'Delivery', box.x + 18, box.y + 16, FONT.emphasis, INK);
    Object.entries(DELIVERY).forEach(([id, d], i) => {
      const o = { x: box.x + 14, y: box.y + 46 + i * 62, w: box.w - 28, h: 54 };
      const on = id === way;
      plate(ctx, o, on ? '#fff6e6' : '#f4f8f5', 10);
      if (on) { ctx.strokeStyle = ORANGE; ctx.lineWidth = 2; roundRect(ctx, { x: o.x + 1, y: o.y + 1, w: o.w - 2, h: o.h - 2 }, 10); ctx.stroke(); }
      ctx.strokeStyle = on ? ORANGE_D : '#9aa9a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x + 16, o.y + 27, 7, 0, Math.PI * 2); ctx.stroke();
      if (on) { ctx.fillStyle = ORANGE_D; ctx.beginPath(); ctx.arc(o.x + 16, o.y + 27, 3.5, 0, Math.PI * 2); ctx.fill(); }
      const f = deliveryFee(game, id);
      drawText(ctx, d.name, o.x + 34, o.y + 8, FONT.body, INK);
      drawText(ctx, f ? money(f) : 'FREE', o.x + o.w - 10, o.y + 8, FONT.body, f ? INK : OK, { align: 'right' });
      drawText(ctx, ellipsize(ctx, `arrives ${arrivalDate(game, id)}`, FONT.body, o.w - 44), o.x + 34, o.y + 30, FONT.body, DIM);
      if (press(input, o)) act(events, `ef.way.${id}`);
    });
    let y = box.y + 46 + 3 * 62 + 10;
    [['Items', goods], ['Delivery', fee]].forEach(([k, v]) => {
      drawText(ctx, k, box.x + 18, y, FONT.body, DIM);
      drawText(ctx, v ? money(v) : 'FREE', box.x + box.w - 18, y, FONT.body, INK, { align: 'right' });
      y += 24;
    });
    ctx.fillStyle = LINE;
    ctx.fillRect(box.x + 18, y, box.w - 36, 1);
    y += 12;
    drawText(ctx, 'Order total', box.x + 18, y, FONT.emphasis, INK);
    drawText(ctx, money(total), box.x + box.w - 18, y, FONT.emphasis, PRICE, { align: 'right' });
    y += 30;
    const short = game.player.credits < total;
    drawText(ctx, ellipsize(ctx, short ? `you have ${money(game.player.credits)}: ${money(total - game.player.credits)} short` : `you have ${money(game.player.credits)}`, FONT.body, box.w - 36), box.x + 18, y, FONT.body, short ? PRICE : DIM);
    y += 30;
    if (button(ctx, { x: box.x + 18, y, w: box.w - 36, h: 38 }, 'Place your order', lines.length && !short ? 'cart' : 'ghost', input) && lines.length) act(events, 'ef.checkout');
  });
}

/// What an order says about where it is.
function statusOf(game, o) {
  if (o.delivered) return { text: 'Delivered to your stock', color: OK };
  const left = Math.max(o.arrives - game.clock.minutes, 0);
  return { text: `Arriving ${logDate(o.arrives)} (${left >= 1440 ? `${Math.ceil(left / 1440)} days` : `${Math.ceil(left / 60)} hours`})`, color: ORANGE_D };
}

/// The orders placed.
function ordersView(game) {
  const orders = ordersOf(game).slice().reverse();
  const H = (o) => 96 + o.lines.length * 24;
  return custom(Math.max(orders.reduce((n, o) => n + H(o) + 14, 0), 100) + 50, (ctx, sk, r, input, events) => {
    drawText(ctx, 'Your orders', r.x + 4, r.y + 6, FONT.heading, INK);
    if (!orders.length) { drawText(ctx, 'You have not ordered anything yet.', r.x + 4, r.y + 46, FONT.body, DIM); return; }
    let y = r.y + 44;
    orders.forEach((o) => {
      const c = { x: r.x, y, w: r.w, h: H(o) };
      plate(ctx, c, '#ffffff', 12);
      plate(ctx, { x: c.x, y: c.y, w: c.w, h: 44 }, '#eef3ef', 12);
      const st = statusOf(game, o);
      drawText(ctx, `ORDER #${o.id}  //  placed ${logDate(o.minute)}`, c.x + 16, c.y + 8, FONT.body, DIM);
      drawText(ctx, ellipsize(ctx, `${DELIVERY[o.way]?.name ?? 'Delivery'}  //  total ${money(o.total)}`, FONT.body, c.w - 32), c.x + 16, c.y + 26, FONT.body, INK);
      drawText(ctx, st.text, c.x + 16, c.y + 54, FONT.emphasis, st.color);
      o.lines.forEach((l, i) => {
        const lr = { x: c.x + 16, y: c.y + 84 + i * 24, w: c.w - 32, h: 22 };
        drawText(ctx, ellipsize(ctx, `${l.qty} x ${l.name}`, FONT.body, lr.w - 110), lr.x, lr.y, FONT.body, inside(input, lr) ? LINK : INK);
        drawText(ctx, money(l.each * l.qty), lr.x + lr.w, lr.y, FONT.body, DIM, { align: 'right' });
        if (press(input, lr)) go(events, `eforest.nx/p/${l.id}`);
      });
      y += H(o) + 14;
    });
  });
}

/// The thank-you after an order.
function thanksView(game) {
  const o = ordersOf(game).at(-1);
  return custom(260, (ctx, sk, r, input, events) => {
    plate(ctx, { x: r.x, y: r.y, w: r.w, h: 244 }, '#ffffff', 12);
    plate(ctx, { x: r.x + 24, y: r.y + 24, w: 44, h: 44 }, OK, 22);
    drawText(ctx, '✓', r.x + 46, r.y + 46, FONT.heading, '#ffffff', { align: 'center', baseline: 'middle' });
    drawText(ctx, o ? 'Order placed, thank you!' : 'No order yet', r.x + 84, r.y + 28, FONT.title, INK);
    if (!o) return;
    drawText(ctx, ellipsize(ctx, `#${o.id}  //  ${DELIVERY[o.way]?.name}  //  ${money(o.total)}`, FONT.body, r.w - 110), r.x + 84, r.y + 66, FONT.body, DIM);
    drawText(ctx, `Arriving ${logDate(o.arrives)}`, r.x + 24, r.y + 100, FONT.emphasis, OK);
    drawText(ctx, ellipsize(ctx, 'It lands in your stock in the Device Manager. Fitting a part takes the machine offline for a while.', FONT.body, r.w - 48), r.x + 24, r.y + 130, FONT.body, INK);
    if (button(ctx, { x: r.x + 24, y: r.y + 170, w: 190, h: 36 }, 'Open Device Manager', 'dark', input)) act(events, 'ef.dm');
    if (button(ctx, { x: r.x + 228, y: r.y + 170, w: 130, h: 36 }, 'Your orders', 'ghost', input)) go(events, 'eforest.nx/orders');
    if (button(ctx, { x: r.x + 372, y: r.y + 170, w: 190, h: 36 }, 'Continue shopping', 'cart', input)) go(events, 'eforest.nx');
  });
}

/// A line of crumbs above a product.
function crumbs(p) {
  return custom(34, (ctx, sk, r, input, events) => {
    const dept = DEPARTMENTS.find(([id]) => id === p.dept)?.[1] ?? '';
    const b = { x: r.x, y: r.y, w: Math.ceil(dept.length * 8.4) + 30, h: 24 };
    drawText(ctx, `< ${dept}`, b.x + 4, b.y + 4, FONT.body, inside(input, b) ? '#0f3f8a' : LINK);
    if (press(input, b)) go(events, `eforest.nx/s/${p.dept}`);
  });
}

/// The eForest page for the rest of an address, or null for a 404.
/// '' is the home page (or the results of a search), s/<department> a
/// department, p/<id> a product, cart, orders and thanks.
export function eforestPage(game, rest, view = {}) {
  const [part, arg] = rest.split('/');
  const query = view.efQuery ?? '';
  const search = field('ef.q', query, 'Search eForest: drives, processors, boards, cases...');
  // each block carries what the DOM needs to draw it again (app/apps/dsnShop.js)
  const D = (control, type, extra = {}) => Object.assign(control, { dom: { type, game, view, ...extra } });
  const wrap = (here, ...body) => ({ title: 'eforest.nx', site: 'web', bg: BG, accent: 0xf59e0b, controls: [D(header(game), 'ef-header'), D(departments(here, game), 'ef-depts', { here }), ...body, D(footer(), 'ef-footer')] });
  const H = (text, sub) => D(heading(text, sub), 'ef-heading', { text, sub });
  const G = (items) => D(grid(game, items), 'ef-grid', { items });
  if (!part || part === 'home') {
    if (query.trim()) {
      const found = browse(game, { q: query, sort: view.efSort });
      return wrap('all', search, H(`Results for "${query.trim()}"`, `${found.length} product${found.length === 1 ? '' : 's'}`), G(found));
    }
    const best = browse(game, {}).slice(0, 8);
    const fits = browse(game, { sort: 'rating' }).filter((p) => !['case', 'board'].includes(p.kind) && fitsNote(game, p).ok).slice(0, 4);
    return wrap('all', search, D(dealBanner(game), 'ef-deal'), H('Shop by department'), D(tiles(), 'ef-tiles'), H('Best sellers'), G(best), ...(fits.length ? [H('Fits your machine', 'parts your board has a free slot for'), G(fits)] : []));
  }
  if (part === 's') {
    const dept = DEPARTMENTS.some(([id]) => id === arg) ? arg : 'all';
    const found = browse(game, { dept, q: query, sort: view.efSort, type: dept === 'drives' ? view.efType : 'all' });
    const name = DEPARTMENTS.find(([id]) => id === dept)[1];
    return wrap(dept, search, H(name, query.trim() ? `matching "${query.trim()}"` : ''), D(toolbar(found.length, view, dept), 'ef-toolbar', { count: found.length, dept }), G(found));
  }
  if (part === 'p') {
    const p = productById(game, arg);
    if (!p) return null;
    return wrap(p.dept, search, D(crumbs(p), 'ef-crumbs', { p }), D(productView(game, p, view), 'ef-product', { p }));
  }
  if (part === 'cart') return wrap('', D(cartView(game, view), 'ef-cart'));
  if (part === 'orders') return wrap('', D(ordersView(game), 'ef-orders'));
  if (part === 'thanks') return wrap('', D(thanksView(game), 'ef-thanks'));
  return null;
}
