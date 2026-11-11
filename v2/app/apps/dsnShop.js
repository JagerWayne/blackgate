import { DEPARTMENTS, DELIVERY, MAX_QTY, dealOf, fitsNote, cartLines, cartTotal, cartCount, deliveryFee, arrivalDate, ordersOf } from '../../game/state/eforest.js';
import { logDate } from '../../game/state/logs.js';
import { esc } from '../ui.js';

// eForest in the DOM: the green and orange storefront, drawn from the `dom` descriptors that
// pages/windows/dsn/eforest.js attaches to its blocks. Clicks are the ef.* and dsn.go.* ids it always used.
const GREEN = '#0f3d2e';
const GREEN2 = '#0a2c21';
const ORANGE = '#f59e0b';
const INK = '#10231a';
const DIM = '#52665c';
const LINK = '#0b6e5a';
const PRICE = '#b12704';
const OK = '#1a7f3d';
const TIER = ['#8a97a6', '#4fc27a', '#3f9bf0', '#9a6ae6', '#f0953a', '#e0524f', '#f2cb4c'];
const money = (n) => `${Math.round(n).toLocaleString('en-US')} cr`;
const go = (url, cls, inner, style = '') => `<button data-id="dsn.go.${esc(url)}" class="${cls}" style="${style}">${inner}</button>`;
const act = (id, cls, inner, style = '') => `<button data-id="${esc(id)}" class="${cls}" style="${style}">${inner}</button>`;
const BTN = 'rounded-full px-4 py-1.5 text-xs font-bold hover:brightness-105';
const cart = (id) => act(`ef.add.${id}`, BTN, 'Add to cart', `background:${ORANGE};color:#1a1205`);
const white = 'rounded-xl bg-white p-4';

const stars = (rating) => `<span class="inline-block text-[13px] leading-none" style="color:${ORANGE}" title="${rating.toFixed(1)}">${'★'.repeat(Math.round(rating))}<span class="text-[#c9d4cd]">${'★'.repeat(5 - Math.round(rating))}</span></span>`;

/// The picture of a product: v2/data/images/eforest/products/<kind>.<tier>.png, a grey rectangle until the file exists.
function art(p, h = 120) {
  return `<div class="overflow-hidden rounded-lg bg-[#9aa3ad]" style="height:${h}px"><img src="/images/eforest/products/${esc(p.kind)}.${p.tier}.png" alt="${esc(p.name)}" class="h-full w-full object-contain" /></div>`;
}

function productCard(game, p) {
  const deal = dealOf(game);
  const onDeal = deal.id === p.id;
  return `<div class="flex flex-col rounded-xl bg-white p-2.5 text-xs hover:ring-2 hover:ring-[#f59e0b]">${go(`eforest.nx/p/${p.id}`, 'block text-left', `<div class="relative">${art(p, 130)}${onDeal ? `<span class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style="background:${PRICE}">-25% deal</span>` : ''}</div>
    <div class="mt-2 text-[11px]" style="color:${DIM}">by ${esc(p.brand)}</div><div class="line-clamp-2 h-8 font-bold" style="color:${LINK}">${esc(p.name)}</div>
    <div class="mt-1">${stars(p.rating)} <span style="color:${LINK}">${p.reviews.toLocaleString('en-US')}</span></div>
    <div class="mt-1 text-lg font-bold" style="color:${PRICE}">${money(onDeal ? deal.price : p.price)}${onDeal ? ` <span class="text-[11px] font-normal" style="color:${DIM}">was ${money(p.price)}</span>` : ''}</div>
    <div class="text-[11px]" style="color:${OK}">FREE delivery with Economy</div>`)}<div class="mt-auto pt-2">${cart(p.id)}</div></div>`;
}

const qtyBox = (minus, plus, n) => `<span class="inline-flex items-center gap-2">${act(minus, 'h-7 w-7 rounded bg-[#eef3ef] font-bold', '−')}<b class="w-6 text-center">${n}</b>${act(plus, 'h-7 w-7 rounded bg-[#eef3ef] font-bold', '+')}</span>`;

/// The HTML of an eForest block, or null when the descriptor is not one of these.
export function shopBlock(d) {
  const { game, view } = d;
  switch (d.type) {
    case 'ef-header': return `<header class="flex flex-wrap items-center gap-4 rounded-t-lg px-4 py-3" style="background:${GREEN}">${go('eforest.nx', 'text-2xl font-bold', `<span style="color:${ORANGE}">e</span><span class="text-white">Forest</span>`)}
      <div class="hidden text-xs @lg:block"><div style="color:#9fc2b2">Deliver to</div><b class="text-white">${esc(game.player.handle)}</b></div><div class="ml-auto flex gap-2 text-xs text-white">${go('eforest.nx/orders', 'rounded px-3 py-1 text-left hover:bg-white/10', '<span class="block" style="color:#9fc2b2">Returns</span><b>&amp; Orders</b>')}${go('eforest.nx/cart', 'rounded px-3 py-1.5 font-bold hover:bg-white/10', `Cart <span class="ml-1 rounded-full px-2 py-0.5 text-[#1a1205]" style="background:${ORANGE}">${cartCount(game)}</span>`)}</div></header>`;
    case 'ef-depts': return `<nav class="flex flex-wrap items-center gap-1 px-3 py-1.5 text-xs" style="background:${GREEN2}">${DEPARTMENTS.map(([id, label]) => go(id === 'all' ? 'eforest.nx' : `eforest.nx/s/${id}`, 'rounded px-3 py-1.5 hover:bg-white/10', esc(label), `color:${id === d.here ? '#fff' : '#bcd6c9'};${id === d.here ? `border-bottom:3px solid ${ORANGE}` : ''}`)).join('')}${go(`eforest.nx/p/${dealOf(game).id}`, 'ml-auto px-3 py-1.5 font-bold', "Today's deal", `color:${ORANGE}`)}</nav>`;
    case 'ef-footer': return `<footer class="mt-5 rounded-b-lg p-5 text-xs" style="background:${GREEN}"><b class="text-sm text-white">eForest</b><p style="color:#9fc2b2">Hardware for the network. Pay with credits, pick a delivery, fit it in the Device Manager.</p><p style="color:#7fa898">Economy: free, 3 days  //  Standard: 2 days  //  Next day: tomorrow, for a fee</p></footer>`;
    case 'ef-heading': return `<div class="mt-5 mb-2"><h2 class="text-lg font-bold" style="color:${INK}">${esc(d.text)}</h2>${d.sub ? `<p class="text-xs" style="color:${DIM}">${esc(d.sub)}</p>` : ''}</div>`;
    case 'ef-grid': return d.items.length ? `<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${d.items.map((p) => productCard(game, p)).join('')}</div>` : `<p class="p-2 text-xs" style="color:${DIM}">nothing matches: try another word or department</p>`;
    case 'ef-deal': {
      const deal = dealOf(game);
      return `<section class="mt-3 flex items-center justify-between gap-4 rounded-2xl p-6 text-white" style="background:linear-gradient(90deg,${GREEN},#1d5a43)"><div><span class="rounded-full px-3 py-1 text-[11px] font-bold text-[#1a1205]" style="background:${ORANGE}">DEAL OF THE DAY</span>
        <h2 class="mt-3 text-2xl font-bold">${esc(deal.name)}</h2><div class="text-3xl font-bold" style="color:${ORANGE}">${money(deal.price)}</div><p class="text-xs" style="color:#bcd6c9">was ${money(deal.was)}  //  25% off until midnight</p>
        <div class="mt-3">${go(`eforest.nx/p/${deal.id}`, BTN, 'See the deal', `background:${ORANGE};color:#1a1205`)}</div></div><div class="hidden w-52 @2xl:block">${art(deal, 150)}</div></section>`;
    }
    case 'ef-tiles': return `<div class="grid gap-2.5" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${DEPARTMENTS.filter(([id]) => id !== 'all').map(([id, label]) => go(`eforest.nx/s/${id}`, 'rounded-xl bg-white p-3 text-center text-xs font-bold hover:bg-[#fff6e6]', `<div class="mb-2 h-16 overflow-hidden rounded-lg bg-[#9aa3ad]"><img src="/images/eforest/departments/${id}.png" alt="" class="h-full w-full object-cover" /></div>${esc(label)}`, `color:${INK}`)).join('')}</div>`;
    case 'ef-toolbar': {
      const sorts = [['featured', 'Featured'], ['low', 'Price: low'], ['high', 'Price: high'], ['rating', 'Top rated']];
      const types = [['all', 'All drives'], ['m2', 'M.2 SSD'], ['hdd18', '1.8" HDD'], ['ssd25', '2.5" SSD'], ['hdd25', '2.5" HDD'], ['hdd35_5200', '3.5" 5200'], ['hdd35_7200', '3.5" 7200'], ['hdd35_10000', '3.5" 10000']];
      const pill = (id, text, on, bg) => act(id, 'rounded-full px-3 py-1 text-xs font-bold', esc(text), on ? `background:${bg};color:${bg === ORANGE ? '#1a1205' : '#fff'}` : `background:#fff;color:${LINK}`);
      return `<div class="flex flex-wrap items-center gap-2 pb-2"><b class="mr-auto text-sm" style="color:${INK}">${d.count} result${d.count === 1 ? '' : 's'}</b>${sorts.map(([id, t]) => pill(`ef.sort.${id}`, t, (view.efSort ?? 'featured') === id, GREEN)).join('')}</div>
        ${d.dept === 'drives' ? `<div class="flex flex-wrap gap-1.5 pb-2">${types.map(([id, t]) => pill(`ef.type.${id}`, t, (view.efType ?? 'all') === id, ORANGE)).join('')}</div>` : ''}`;
    }
    case 'ef-crumbs': return go(`eforest.nx/s/${d.p.dept}`, 'my-2 text-xs hover:underline', `&lt; ${esc(DEPARTMENTS.find(([id]) => id === d.p.dept)?.[1] ?? '')}`, `color:${LINK}`);
    case 'ef-product': {
      const p = d.p;
      const note = fitsNote(game, p);
      const deal = dealOf(game);
      const price = deal.id === p.id ? deal.price : p.price;
      const qty = Math.min(Math.max(view.efQty ?? 1, 1), MAX_QTY);
      return `<div class="grid gap-4 @3xl:grid-cols-[260px_1fr_240px]"><div>${art(p, 240)}</div>
        <div class="text-sm"><div class="text-xs" style="color:${LINK}">by ${esc(p.brand)}</div><h1 class="text-2xl font-bold" style="color:${INK}">${esc(p.name)}</h1><div class="mt-1 text-xs">${stars(p.rating)} <span style="color:${LINK}">${p.rating.toFixed(1)} (${p.reviews.toLocaleString('en-US')} ratings)</span></div>
          <hr class="my-3 border-[#d3dfd7]" /><div class="text-2xl font-bold" style="color:${PRICE}">${money(price)}${deal.id === p.id ? ` <span class="text-xs font-normal" style="color:${DIM}">was ${money(p.price)} // deal of the day</span>` : ''}</div>
          <b class="mt-3 block" style="color:${INK}">About this item</b><ul class="mt-1 list-disc space-y-1 pl-5 text-xs" style="color:${INK}">${p.specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <aside class="${white} h-fit text-xs"><div class="text-2xl font-bold" style="color:${PRICE}">${money(price)}</div><p style="color:${OK}">FREE delivery ${esc(arrivalDate(game, 'economy'))}</p><p style="color:${DIM}">Next day: ${esc(arrivalDate(game, 'nextday'))}</p>
          <p class="my-3 font-bold" style="color:${note.ok ? OK : PRICE}">${note.ok ? '✓' : '!'} ${esc(note.text)}</p><div class="mb-3" style="color:${DIM}">Quantity ${qtyBox(`ef.pq.${qty - 1}`, `ef.pq.${qty + 1}`, qty)}</div>
          <div class="space-y-2">${act(`ef.padd.${p.id}`, `${BTN} block w-full`, 'Add to cart', `background:${ORANGE};color:#1a1205`)}${act(`ef.buy.${p.id}`, `${BTN} block w-full`, 'Buy now', 'background:#d98200;color:#1a1205')}</div>
          <p class="mt-3" style="color:${DIM}">Parts arrive in your stock. Fitting takes the machine offline.</p></aside></div>`;
    }
    case 'ef-cart': {
      const lines = cartLines(game);
      const way = view.efWay ?? 'economy';
      const goods = cartTotal(game);
      const fee = deliveryFee(game, way);
      const total = goods + fee;
      const short = game.player.credits < total;
      return `<div class="grid gap-3.5 @3xl:grid-cols-[1fr_300px]"><div class="${white}"><h2 class="text-lg font-bold" style="color:${INK}">${lines.length ? 'Shopping cart' : 'Your eForest cart is empty'}</h2>${lines.length ? '' : `<p class="text-xs" style="color:${DIM}">Pick something from the departments above.</p>`}
        ${lines.map((l) => `<div class="mt-3 flex gap-3 border-t border-[#d3dfd7] pt-3 text-xs"><div class="w-24 shrink-0">${art(l.item, 80)}</div><div class="min-w-0 flex-1">${go(`eforest.nx/p/${l.id}`, 'block truncate text-left text-sm font-bold hover:underline', esc(l.item.name), `color:${LINK}`)}<div style="color:${DIM}">by ${esc(l.item.brand)}  //  ${money(l.each)} each</div><div style="color:${OK}">In stock</div>
          <div class="mt-1 flex items-center gap-3">${qtyBox(`ef.qty.${l.id}.${l.qty - 1}`, `ef.qty.${l.id}.${l.qty + 1}`, l.qty)}${act(`ef.qty.${l.id}.0`, 'hover:underline', 'Delete', `color:${LINK}`)}</div></div><b class="text-base" style="color:${PRICE}">${money(l.line)}</b></div>`).join('')}</div>
        <aside class="${white} h-fit text-xs"><b style="color:${INK}">Delivery</b>${Object.entries(DELIVERY).map(([id, dd]) => { const f = deliveryFee(game, id); return act(`ef.way.${id}`, 'mt-2 block w-full rounded-lg p-2.5 text-left', `<span class="flex justify-between"><span>${id === way ? '◉' : '○'} ${esc(dd.name)}</span><b style="color:${f ? INK : OK}">${f ? money(f) : 'FREE'}</b></span><span class="block" style="color:${DIM}">arrives ${esc(arrivalDate(game, id))}</span>`, `background:${id === way ? '#fff6e6' : '#f4f8f5'};${id === way ? `outline:2px solid ${ORANGE}` : ''}`); }).join('')}
          <div class="mt-3 flex justify-between" style="color:${DIM}"><span>Items</span><span style="color:${INK}">${goods ? money(goods) : 'FREE'}</span></div><div class="flex justify-between" style="color:${DIM}"><span>Delivery</span><span style="color:${INK}">${fee ? money(fee) : 'FREE'}</span></div>
          <hr class="my-2 border-[#d3dfd7]" /><div class="flex justify-between text-sm font-bold"><span style="color:${INK}">Order total</span><span style="color:${PRICE}">${money(total)}</span></div>
          <p class="my-2" style="color:${short ? PRICE : DIM}">${short ? `you have ${money(game.player.credits)}: ${money(total - game.player.credits)} short` : `you have ${money(game.player.credits)}`}</p>
          ${act('ef.checkout', `${BTN} block w-full ${lines.length && !short ? '' : 'opacity-40'}`, 'Place your order', lines.length && !short ? `background:${ORANGE};color:#1a1205` : 'border:1.5px solid #0b6e5a;color:#0b6e5a')}</aside></div>`;
    }
    case 'ef-orders': {
      const orders = ordersOf(game).slice().reverse();
      return `<h2 class="mb-2 text-lg font-bold" style="color:${INK}">Your orders</h2>${orders.length ? '' : `<p class="text-xs" style="color:${DIM}">You have not ordered anything yet.</p>`}${orders.map((o) => {
        const left = Math.max(o.arrives - game.clock.minutes, 0);
        const st = o.delivered ? ['Delivered to your stock', OK] : [`Arriving ${logDate(o.arrives)} (${left >= 1440 ? `${Math.ceil(left / 1440)} days` : `${Math.ceil(left / 60)} hours`})`, '#d98200'];
        return `<div class="${white} mb-3.5 text-xs"><div class="-m-4 mb-3 rounded-t-xl bg-[#eef3ef] p-3" style="color:${DIM}">ORDER #${o.id}  //  placed ${logDate(o.minute)}<br><span style="color:${INK}">${esc(DELIVERY[o.way]?.name ?? 'Delivery')}  //  total ${money(o.total)}</span></div>
          <b class="text-sm" style="color:${st[1]}">${esc(st[0])}</b>${o.lines.map((l) => go(`eforest.nx/p/${l.id}`, 'mt-1 flex w-full justify-between text-left hover:underline', `<span>${l.qty} x ${esc(l.name)}</span><span style="color:${DIM}">${money(l.each * l.qty)}</span>`, `color:${INK}`)).join('')}</div>`;
      }).join('')}`;
    }
    case 'ef-thanks': {
      const o = ordersOf(game).at(-1);
      return `<div class="${white} p-6"><h2 class="text-2xl font-bold" style="color:${INK}"><span style="color:${OK}">✓</span> ${o ? 'Order placed, thank you!' : 'No order yet'}</h2>${o ? `<p class="text-xs" style="color:${DIM}">#${o.id}  //  ${esc(DELIVERY[o.way]?.name ?? '')}  //  ${money(o.total)}</p><p class="mt-3 font-bold" style="color:${OK}">Arriving ${logDate(o.arrives)}</p>
        <p class="mt-2 text-sm" style="color:${INK}">It lands in your stock in the Device Manager. Fitting a part takes the machine offline for a while.</p>
        <div class="mt-4 flex flex-wrap gap-2">${act('ef.dm', BTN, 'Open Device Manager', `background:${GREEN};color:#fff`)}${go('eforest.nx/orders', BTN, 'Your orders', `border:1.5px solid ${LINK};color:${LINK}`)}${go('eforest.nx', BTN, 'Continue shopping', `background:${ORANGE};color:#1a1205`)}</div>` : ''}</div>`;
    }
    default: return null;
  }
}
