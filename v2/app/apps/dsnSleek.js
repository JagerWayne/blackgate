import { cities } from '../../game/data/content.js';
import { isPublic, knows, detailValue } from '../../game/state/intel.js';
import { portraitOf } from '../../pages/ui/portrait.js';
import { esc } from '../ui.js';

// SleekPages in the DOM, drawn from the `dom` descriptors that pages/windows/dsn/sleek.js attaches to its blocks.
const BLUE = '#3b5998';
const INK = '#1c1e21';
const DIM = '#606770';
const title = (s) => String(s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
/// Images are served from v2/data, which Vite publishes at the site root.
const url = (src) => String(src).replace(/^\.\/data\//, '/');
const companyOf = (game, p) => game.world.companies[p.company];
const cityOf = (game, p) => cities()[companyOf(game, p)?.city]?.name ?? 'somewhere';
const go = (to, cls, inner, style = '') => `<button data-id="dsn.go.${esc(to)}" class="${cls}" style="${style}">${inner}</button>`;
const face = (game, i, size) => `<img src="${esc(url(portraitOf(game, i)))}" alt="" class="shrink-0 rounded object-cover" style="width:${size}px;height:${size}px;background:#d0d4db" />`;
const box = 'rounded border border-[#dddfe2] bg-white';

function detail(game, i, field) {
  if (!isPublic(game, i, field)) return `<span style="color:#a0a6b0">${field}: private</span>`;
  const p = game.world.people[i];
  const v = field === 'workplace' ? title(detailValue(game, i, field)) : detailValue(game, i, field);
  return `<button data-id="sp.learn.${i}.${field}" class="text-left hover:underline" style="color:${BLUE}">${knows(game, i, field) ? '✓ ' : ''}${esc(v)}</button>`;
}

/// The HTML of a SleekPages block, or null when the descriptor is not one of these.
export function sleekBlock(d) {
  const { game } = d;
  switch (d.type) {
    case 'sp-top': return `<header class="flex items-center justify-between px-4 py-2.5 text-white" style="background:${BLUE}"><b class="text-xl">sleekpages</b><nav class="flex gap-2 text-xs">${[['sleekpages', 'Feed'], ['sleekpages/people', 'People']].map(([u, t]) => go(u, 'rounded px-4 py-1.5', t, `background:${d.here === u ? '#fff' : '#4a66a0'};color:${d.here === u ? BLUE : '#fff'}`)).join('')}</nav></header>`;
    case 'sp-post': {
      const { post } = d;
      const p = game.world.people[post.who];
      return `<article class="${box} mt-3 overflow-hidden text-xs"><div class="flex items-center gap-3 p-3">${face(game, post.who, 40)}<div>${go(`sleekpages/person/${post.who}`, 'block text-sm font-bold hover:underline', esc(title(p.name)), `color:${BLUE}`)}<span style="color:${DIM}">${post.when} · ${esc(title(cityOf(game, p)))}</span></div></div>
        <p class="px-3.5 pb-2 text-[13px] leading-relaxed" style="color:${INK}">${esc(post.text)}</p><img src="${esc(url(post.image))}" alt="" class="mx-auto block aspect-square w-full max-w-[520px] bg-[#d0d4db] object-cover" />
        <div class="mx-3 flex justify-between border-t border-[#dddfe2] py-2.5" style="color:${DIM}"><span>Like ${post.likes}</span><span>${post.comments} comments</span></div></article>`;
    }
    case 'sp-head': {
      const p = game.world.people[d.i];
      const co = companyOf(game, p);
      return `<section class="${box} mt-3 overflow-hidden"><div class="h-24" style="background:linear-gradient(90deg,${BLUE},#8b9dc3)"></div><div class="-mt-10 flex flex-wrap items-end gap-4 px-5 pb-4"><div class="rounded bg-white p-1">${face(game, d.i, 104)}</div>
        <div class="min-w-0 flex-1 pt-10"><h1 class="text-xl font-bold" style="color:${INK}">${esc(title(p.name))}</h1><p class="text-xs" style="color:${DIM}">${esc(title(p.role))} · ${esc(co ? title(co.name) : '')}</p></div>
        <button data-id="sp.dossier.${d.i}" class="rounded px-4 py-2 text-xs font-bold text-white hover:brightness-110" style="background:${BLUE}">VIEW DOSSIER</button></div></section>`;
    }
    case 'sp-about': return `<section class="${box} mt-3 p-3.5 text-xs"><b class="text-sm" style="color:${INK}">About</b>${d.about.map(([k, v]) => `<div class="mt-2 flex gap-4"><span class="w-20 shrink-0" style="color:${DIM}">${esc(k)}</span>${['social', 'email', 'phone', 'workplace'].includes(v) ? detail(game, d.i, v) : `<span style="color:${INK}">${esc(v)}</span>`}</div>`).join('')}</section>`;
    case 'sp-people': return `<section class="${box} mt-3 text-xs"><div class="p-3.5 text-sm font-bold" style="color:${INK}">${d.q ? `"${esc(d.q)}" // ` : ''}${d.count.toLocaleString('en-US')} people // page ${d.at + 1} of ${d.pages}</div>
      ${d.shown.map((i) => { const p = game.world.people[i]; return go(`sleekpages/person/${i}`, 'flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-[#f2f3f5]', `${face(game, i, 40)}<span class="min-w-0"><b class="block truncate text-sm" style="color:${BLUE}">${esc(title(p.name))}</b><span class="block truncate" style="color:${DIM}">${esc(title(p.role))}${companyOf(game, p) ? ` · ${esc(title(companyOf(game, p).name))}` : ''} · ${esc(title(cityOf(game, p)))}</span></span>`); }).join('')}</section>`;
    default: return null;
  }
}
