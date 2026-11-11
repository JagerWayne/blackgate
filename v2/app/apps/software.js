import { software, unlocks } from '../../game/data/content.js';
import { toolPrice, buyTool } from '../../game/state/economy.js';
import { versionEffect, NO_TASK } from '../../game/state/toolEffects.js';
import { toolSize } from '../../game/state/apps.js';
import { systemFree } from '../../game/state/gameHelpers.js';
import { familyOf, plainOf, CATEGORIES, neededTool } from '../../pages/windows/software.js';

const NAV = [['ALL', 'Home'], ['INSTALLED', 'Installed'], ['SHOP', 'Available']];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const cr = (n) => `${n.toLocaleString('en-US')} cr`;
const initials = (name) => {
  const w = name.split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
};
/// The tool's picture: v2/data/images/software/<kind>.png, a grey rectangle until the file exists.
const icon = (d, tint, size) => `<div class="shrink-0 overflow-hidden rounded-lg bg-[#9aa3ad]" style="width:${size}px;height:${size}px"><img src="/images/software/${d.kind}.png" alt="" class="h-full w-full object-cover" /></div>`;
const pips = (n, have, tint) => Array.from({ length: n }, (_, i) => `<i class="h-1.5 w-3 rounded-sm" style="background:${i < have ? hex(tint) : '#1f2b3a'}"></i>`).join('');

/// The App Store. Reads the game's tools, money and drive; INSTALL calls the game's own buyTool().
/// It keeps its view in state.win.software ({filter, sel, page}), the same place the canvas window
/// did, because the tutorial reads it. Ids on data-tutorial are the ones the tutorial lights.
export function mountSoftware(body, state) {
  const view = (state.win.software ??= {});
  let error = '';
  let sig = '';

  const levelOf = (kind) => state.game.player.tools.find((t) => t.kind === kind)?.level ?? 0;

  function cardHtml(d, have) {
    const [fam, tint] = familyOf(d.kind);
    const next = have + 1;
    return `<article class="flex flex-col gap-2 rounded-lg border border-line bg-bg/60 p-3 hover:border-accent/60">
      <button data-act="open" data-kind="${d.kind}" data-tutorial="sw.${d.kind}" class="flex gap-3 text-left">
        ${icon(d, tint, 48)}
        <span class="min-w-0"><b class="block truncate text-ink">${esc(d.name)}</b>
          <span class="text-[11px]" style="color:${hex(tint)}">${esc(plainOf(fam))}</span></span>
      </button>
      <p class="line-clamp-2 min-h-8 text-[11px] text-ink/60">${esc(d.use ?? d.short)}</p>
      <div class="flex items-center justify-between gap-2">
        <span class="flex gap-0.5" title="tier ${have} of ${d.versions.length}">${pips(d.versions.length, have, tint)}</span>
        ${next <= d.versions.length
    ? `<button data-act="buy" data-kind="${d.kind}" data-level="${next}" class="rounded bg-accent/20 px-2 py-1 text-[11px] font-bold text-accent hover:bg-accent/30">${have ? 'UPDATE' : 'INSTALL'} ${cr(toolPrice(d, next))}</button>`
    : '<span class="text-[11px] font-bold text-emerald-400">INSTALLED</span>'}
      </div>
    </article>`;
  }

  function pageHtml(d, have) {
    const game = state.game;
    const [fam, tint] = familyOf(d.kind);
    const next = have + 1;
    const need = unlocks()[next - 1] ?? 0;
    const extra = toolSize(d.kind, next) - toolSize(d.kind, have);
    const free = Math.max(systemFree(game), 0);
    let buy;
    if (next > d.versions.length) buy = '<p class="text-emerald-400">fully updated</p>';
    else if (game.player.rating < need) buy = `<p class="text-ink/50">${esc(d.versions[next - 1] ?? `V${next}`)} needs rating ${need} (you have ${game.player.rating})</p>`;
    else {
      const idle = versionEffect(d.kind, 1) === NO_TASK;
      const why = extra > free ? `needs ${extra} GB on the gateway drive, ${free} GB free`
        : idle ? 'not for sale: no task uses this tool yet'
          : game.player.credits < toolPrice(d, next) ? `${cr(toolPrice(d, next) - game.player.credits)} short` : '';
      buy = `<button data-act="buy" data-kind="${d.kind}" data-level="${next}" data-tutorial="sw.buy.${d.kind}.${next}" ${why ? 'disabled' : ''} class="rounded bg-accent px-4 py-2 font-bold text-bg enabled:hover:brightness-110 disabled:opacity-40">${have ? 'UPDATE TO' : 'INSTALL'} V${next} ${esc(d.versions[next - 1] ?? '')} // ${cr(toolPrice(d, next))}</button>
        ${why ? `<p class="mt-1 text-amber-300">${esc(why)}</p>` : ''}`;
    }
    const versions = d.versions.map((v, i) => {
      const lvl = i + 1;
      const lock = game.player.rating < (unlocks()[i] ?? 0);
      const st = have >= lvl ? '<b class="text-emerald-400">INSTALLED</b>' : lock ? `<span class="text-ink/40">RATING ${unlocks()[i]}</span>` : `<span class="text-amber-300">${cr(toolPrice(d, lvl))}</span>`;
      return `<tr class="border-t border-line"><td class="py-1.5 pr-3">V${lvl} ${esc(v)}</td><td class="pr-3 text-ink/60">${esc(versionEffect(d.kind, lvl))} // ${toolSize(d.kind, lvl)} GB</td><td class="text-right">${st}</td></tr>`;
    }).join('');
    return `<div class="flex flex-col gap-4 p-4">
      <div class="flex gap-4">${icon(d, tint, 88)}
        <div><span class="text-[11px]" style="color:${hex(tint)}">${esc(plainOf(fam))}</span>
          <h2 class="text-lg font-bold text-ink">${esc(d.name)}</h2>
          <p class="text-ink/60">${have ? `installed // version ${have} of ${d.versions.length}` : 'not installed'}</p>
          <span class="mt-1 flex gap-0.5">${pips(d.versions.length, have, tint)}</span></div></div>
      <div>${buy}</div>
      <section><h3 class="text-[10px] tracking-widest text-ink/50">USE IT WHEN</h3><p>${esc(d.use ?? d.short)}</p></section>
      <section><h3 class="text-[10px] tracking-widest text-ink/50">WHAT IT DOES</h3><p>${esc(d.desc)}${d.tech ? `<br><span class="text-ink/50">hackers call this a ${esc(d.tech)}</span>` : ''}</p></section>
      <table class="w-full text-xs"><caption class="pb-1 text-left text-[10px] tracking-widest text-ink/50">VERSIONS</caption><tbody>${versions}</tbody></table>
    </div>`;
  }

  function render() {
    const game = state.game;
    const tools = software();
    const filter = view.filter ?? 'ALL';
    const picked = tools.find((t) => t.kind === (view.sel ?? tools[0]?.kind));
    const page = !!view.page && !!picked;
    const nav = (k, text) => `<button data-act="nav" data-key="${k}" data-tutorial="sw.nav.${k}" class="w-full border-l-2 px-3 py-1.5 text-left text-xs ${k === filter ? 'border-accent bg-accent/15 text-ink' : 'border-transparent text-ink/70 hover:bg-white/5'}">${text}</button>`;
    const shown = tools.filter((d) => {
      const have = levelOf(d.kind);
      if (filter === 'ALL') return true;
      if (filter === 'INSTALLED') return have > 0;
      if (filter === 'SHOP') return have < d.versions.length;
      return familyOf(d.kind)[0] === filter;
    });
    const needed = filter === 'ALL' && !page ? neededTool(game, tools, levelOf) : null;
    body.innerHTML = `<div class="grid h-full grid-cols-[10rem_1fr]">
      <aside class="overflow-y-auto border-r border-line py-2">
        ${NAV.map(([k, t]) => nav(k, t)).join('')}
        <h3 class="px-3 pb-1 pt-4 text-[10px] tracking-widest text-ink/40">CATEGORIES</h3>
        ${CATEGORIES.map((c) => nav(c, esc(plainOf(c)))).join('')}
      </aside>
      <div class="flex min-h-0 flex-col">
        <header class="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
          ${page ? '<button data-act="back" data-tutorial="sw.back" class="rounded border border-line px-2 py-0.5 text-xs hover:bg-white/10">&lt; BACK</button>' : '<h2 class="font-bold">App Store</h2>'}
          <span class="text-amber-300">${cr(game.player.credits)}</span>
        </header>
        ${error ? `<p class="bg-red-500/15 px-4 py-1 text-xs text-red-300">${esc(error)}</p>` : ''}
        <div class="min-h-0 flex-1 overflow-y-auto">${page ? pageHtml(picked, levelOf(picked.kind))
    : `<div class="p-4">${needed ? `<button data-act="open" data-kind="${needed.d.kind}" class="mb-3 block w-full rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-left"><b class="text-[10px] tracking-widest text-amber-300">YOUR JOB NEEDS</b><br>${esc(needed.d.name)} // ${esc(needed.why)}</button>` : ''}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">${shown.map((d) => cardHtml(d, levelOf(d.kind))).join('') || '<p class="text-ink/40">nothing here</p>'}</div></div>`}</div>
      </div></div>`;
  }

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act, kind, key, level } = b.dataset;
    error = '';
    if (act === 'nav') Object.assign(view, { filter: key, page: false });
    else if (act === 'back') view.page = false;
    else if (act === 'open') Object.assign(view, { sel: kind, page: true });
    else if (act === 'buy') error = buyTool(state.game, kind, Number(level)) ?? '';
    sig = '';
    refresh();
  });

  // redraw only when something the store shows has changed
  function refresh() {
    const g = state.game;
    const s = JSON.stringify([view.filter, view.sel, view.page, error, g.player.credits, g.player.tools, g.player.rating, systemFree(g), g.contracts.length]);
    if (s === sig) return;
    sig = s;
    render();
  }
  const timer = setInterval(() => (body.isConnected ? refresh() : clearInterval(timer)), 200);
  refresh();
}
