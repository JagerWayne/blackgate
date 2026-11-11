// eForest: the hardware store on the network. Everything the Device Manager
// sells is for sale here too, a little cheaper, as a shop with a cart, three
// ways to have it delivered (Economy, Standard, Next day) and orders. An order
// is paid at checkout and arrives in your stock when its delivery is due; from
// there it is fitted in the Device Manager, which takes the machine offline for
// a while. Motherboards and cases are sold as well. The cart and the orders
// live in the run.

import { componentsOf, boards, chassis, forms, componentDef, boardDef, chassisDef } from '../data/content.js';
import { seedHash } from './sites.js';
import { charge, toast } from './gameState.js';
import { stockPart, boardBlock, caseBlock } from './economy.js';
import { logDate } from './logs.js';
import * as gw from './gateway.js';
import { t as tl } from '../data/language.js';

/// The share of the Device Manager's price eForest asks.
const SHOP_RATE = 0.92;
/// The most of one thing in the cart, and the most things in it.
export const MAX_QTY = 9;
export const MAX_LINES = 30;

/// The ways to have an order delivered: the name, how long it takes (game
/// minutes), and what it costs (a share of the goods, at least a minimum).
export const DELIVERY = {
  economy: { name: 'Economy delivery', minutes: 4320, days: 3, rate: 0, min: 0, note: 'free // arrives in 3 days' },
  standard: { name: 'Standard delivery', minutes: 2880, days: 2, rate: 0.03, min: 10, note: 'arrives in 2 days' },
  nextday: { name: 'Next day delivery', minutes: 1440, days: 1, rate: 0.08, min: 30, note: 'arrives tomorrow' },
};

/// The departments, in the order the menu shows them.
export const DEPARTMENTS = [
  ['all', 'All'],
  ['cases', 'Cases'],
  ['boards', 'Motherboards'],
  ['cpus', 'Processors'],
  ['drives', 'Drives'],
  ['network', 'Network cards'],
  ['cards', 'Add-in cards'],
  ['security', 'Security'],
];

const DEPT_OF = { case: 'cases', board: 'boards', cpu: 'cpus', storage: 'drives', modem: 'network', accel: 'cards', fpga: 'cards', hsm: 'cards', security: 'security' };

const BRANDS = ['Vantex', 'Quillcore', 'Nimbus', 'Ironleaf', 'Arcwell', 'Helio', 'Duskfield', 'Brightpath', 'Kestrel', 'Pinegate'];

const gbText = (n) => (n >= 1024 ? `${n / 1024} TB` : `${n} GB`);

/// The lines that say what a product is.
function specsOf(kind, d) {
  if (kind === 'cpu') return [`${d.lanes} thread slots in every socket it fills`, 'every processor in a machine must be the same model', d.note];
  if (kind === 'storage') return [`${gbText(d.capacity)} ${d.form} ${d.rpm ? `hard disk at ${d.rpm} rpm` : 'solid-state drive'}`, `downloads at ${Math.round(d.speed * 100)}% speed`, `as the system drive: apps at ${Math.round(d.sys_speed * 100)}% speed`];
  if (kind === 'modem') return [`${d.bandwidth >= 1000 ? `${d.bandwidth / 1000} Gb/s` : `${d.bandwidth} Mb/s`} download speed`, `carries ${d.hops} relay hops without slowing the link`, d.note];
  if (kind === 'security') return [d.defense || 'security module', d.effect || d.note, `slows a trace by ${d.trace_delay}, absorbs ${Math.round(d.raid_shield * 100)}% of a raid`];
  if (kind === 'board') return [`${forms()[d.form - 1]} size`, `${d.cpu_slots} processor socket${d.cpu_slots > 1 ? 's' : ''} (up to tier ${d.cpu_max})`, `${d.storage_slots} drive bay${d.storage_slots > 1 ? 's' : ''}, up to ${gbText(d.drive_cap)}`, `add-in slots: ${d.accel_slots} booster, ${d.fpga_slots} unlock chip, ${d.hsm_slots} key reader`, `${d.modem_slots} network card slot${d.modem_slots > 1 ? 's' : ''}`];
  if (kind === 'case') return [`${forms()[d.form - 1]} case: takes boards up to ${forms()[d.form - 1]}`, `${d.bays} drive bay${d.bays > 1 ? 's' : ''}, ${d.security_slots} security slot${d.security_slots === 1 ? '' : 's'}`, d.trait_note];
  return [d.effect || d.note, d.note];
}

/// Every product: the parts, the boards and the cases.
export function catalog(game) {
  const out = [];
  const add = (kind, d) => {
    const id = `${kind}.${d.tier}`;
    const h = (k, m) => seedHash(game, `ef${k}`, id) % m;
    out.push({
      id,
      kind,
      tier: d.tier,
      def: d,
      name: d.name,
      dept: DEPT_OF[kind],
      brand: BRANDS[h('brand', BRANDS.length)],
      list: d.price,
      price: Math.max(Math.floor(d.price * SHOP_RATE), d.price ? 1 : 0),
      rating: 3.4 + h('rating', 16) / 10,
      reviews: 12 + h('reviews', 4800),
      specs: specsOf(kind, d).filter(Boolean),
      type: d.drive_type ?? '',
    });
  };
  chassis().forEach((d) => add('case', d));
  boards().forEach((d) => add('board', d));
  ['cpu', 'storage', 'modem', 'accel', 'fpga', 'hsm', 'security'].forEach((kind) => componentsOf(kind).forEach((d) => add(kind, d)));
  // the free Micro PC case and the built-in board are not for sale
  return out.filter((p) => p.price > 0);
}

/// One product by id, or null.
export function productById(game, id) {
  return catalog(game).find((p) => p.id === id) ?? null;
}

/// The day's deal: one product at 25% off, the same all day.
export function dealOf(game) {
  const list = catalog(game).filter((p) => p.price >= 300);
  const day = Math.floor((game.clock?.minutes ?? 0) / 1440);
  const p = list[seedHash(game, 'efdeal', day) % list.length];
  return { ...p, price: Math.floor(p.price * 0.75), was: p.price };
}

/// What a product costs now: the deal's price on the deal, else its own.
export function priceOf(game, id) {
  const p = productById(game, id);
  if (!p) return 0;
  const deal = dealOf(game);
  return deal.id === id ? deal.price : p.price;
}

/// The products of a department that match a search, in a chosen order.
export function browse(game, { dept = 'all', q = '', sort = 'featured', type = 'all' } = {}) {
  const query = q.trim().toLowerCase();
  let list = catalog(game).filter((p) => (dept === 'all' || p.dept === dept) && (type === 'all' || p.type === type));
  if (query) list = list.filter((p) => `${p.name} ${p.brand} ${p.kind} ${p.specs.join(' ')}`.toLowerCase().includes(query));
  const by = {
    featured: (a, b) => b.reviews - a.reviews,
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
  };
  return list.sort(by[sort] ?? by.featured);
}

/// Whether a product fits the machine as it is, and what to say about it.
export function fitsNote(game, p) {
  const g = game.player.gateway;
  if (p.kind === 'board') {
    const why = boardBlock(game, boardDef(p.tier));
    return why ? { ok: false, text: why } : { ok: true, text: 'fits your case and keeps your parts' };
  }
  if (p.kind === 'case') {
    const why = caseBlock(game, chassisDef(p.tier));
    return why ? { ok: false, text: why } : { ok: true, text: 'a bigger case: your board fits it' };
  }
  const plan = gw.fitPlan(g, componentDef(p.kind, p.tier));
  if (plan.why) return { ok: false, text: plan.why };
  return { ok: true, text: plan.out.length ? `fits (it replaces ${plan.out[0].name})` : 'fits a free slot on your board' };
}

// -- the cart ---------------------------------------------------------------------

/// The cart: lines of { id, qty }.
export function cartOf(game) {
  if (!Array.isArray(game.cart)) game.cart = [];
  return game.cart;
}

/// Puts some of a product in the cart. Returns an error, or null.
export function addToCart(game, id, qty = 1) {
  const p = productById(game, id);
  if (!p) return 'eForest does not sell that';
  const cart = cartOf(game);
  const line = cart.find((l) => l.id === id);
  if (!line && cart.length >= MAX_LINES) return `the cart holds ${MAX_LINES} different things at most`;
  const next = (line?.qty ?? 0) + Math.max(Math.floor(qty), 1);
  if (next > MAX_QTY) return `${MAX_QTY} of one thing is the most you can order`;
  if (line) line.qty = next;
  else cart.push({ id, qty: next });
  return null;
}

/// Sets the quantity of a line; zero takes it out.
export function setQty(game, id, qty) {
  const cart = cartOf(game);
  const at = cart.findIndex((l) => l.id === id);
  if (at < 0) return 'it is not in the cart';
  const n = Math.floor(qty);
  if (!(n > 0)) cart.splice(at, 1);
  else cart[at].qty = Math.min(n, MAX_QTY);
  return null;
}

/// The cart's lines with their products and what each line costs.
export function cartLines(game) {
  return cartOf(game).map((l) => {
    const p = productById(game, l.id);
    return p ? { ...l, item: p, each: priceOf(game, l.id), line: priceOf(game, l.id) * l.qty } : null;
  }).filter(Boolean);
}

/// What the goods in the cart cost.
export function cartTotal(game) {
  return cartLines(game).reduce((n, l) => n + l.line, 0);
}

/// How many things are in the cart.
export function cartCount(game) {
  return cartOf(game).reduce((n, l) => n + l.qty, 0);
}

/// What a delivery costs for goods of a price: a share of them, at least a
/// minimum (a case or a board is heavy: the minimum doubles).
export function deliveryFee(game, way, goods = cartTotal(game)) {
  const d = DELIVERY[way];
  if (!d || !goods) return 0;
  const heavy = cartLines(game).some((l) => l.item.kind === 'case' || l.item.kind === 'board');
  return Math.max(Math.ceil(goods * d.rate), d.min * (heavy && d.min ? 2 : 1)) * (d.rate || d.min ? 1 : 0);
}

/// When an order placed now would arrive, as a date.
export function arrivalDate(game, way) {
  return logDate(game.clock.minutes + (DELIVERY[way]?.minutes ?? 0));
}

// -- orders -----------------------------------------------------------------------------

/// The orders placed, oldest first.
export function ordersOf(game) {
  if (!Array.isArray(game.orders)) game.orders = [];
  return game.orders;
}

/// Pays for the cart and places the order with a delivery. Returns an error, or null.
export function checkout(game, way = 'economy') {
  if (!DELIVERY[way]) return 'pick a delivery';
  const lines = cartLines(game);
  if (!lines.length) return 'your cart is empty';
  const goods = lines.reduce((n, l) => n + l.line, 0);
  const fee = deliveryFee(game, way, goods);
  const total = goods + fee;
  if (game.player.credits < total) return `not enough credits: ${total - game.player.credits} cr short`;
  const orders = ordersOf(game);
  const id = (orders.at(-1)?.id ?? 1000) + 1;
  if (!charge(game, total, `eForest order #${id}`)) return 'not enough credits';
  const now = game.clock.minutes;
  const kept = lines.map((l) => ({ id: l.id, kind: l.item.kind, tier: l.item.tier, name: l.item.name, qty: l.qty, each: l.each }));
  orders.push({ id, minute: now, lines: kept, goods, fee, total, way, arrives: now + DELIVERY[way].minutes, delivered: false });
  game.cart = [];
  toast(game, tl('state.eforest.eforest_order_placed_cr', id, total, DELIVERY[way].name.toLowerCase()), 'good');
  return null;
}

/// Delivers every order that is due: its things go into the stock.
export function deliverDue(game) {
  const now = game.clock.minutes;
  let delivered = 0;
  ordersOf(game).forEach((o) => {
    if (o.delivered || o.arrives > now) return;
    o.delivered = true;
    o.lines.forEach((l) => {
      for (let i = 0; i < l.qty; i += 1) stockPart(game, { kind: l.kind, level: l.tier, name: l.name });
    });
    delivered += 1;
    toast(game, tl('state.eforest.eforest_order_has_arrived', o.id, o.lines.reduce((n, l) => n + l.qty, 0)), 'good');
  });
  return delivered;
}
