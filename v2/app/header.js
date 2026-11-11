import { rankName } from '../game/core/theme.js';
import { band } from '../game/systems/physical.js';
import { timeScale } from '../game/state/cheats.js';
import { hhmm, weekday, dateLine, day } from '../game/core/clock.js';
import { click, esc } from './ui.js';
import { t as tl } from '../game/data/language.js';

const btn = 'h-7 rounded border border-line px-3 text-[11px] tracking-wider transition-all duration-200 ease-out hover:border-accent/60 hover:scale-105 hover:bg-white/10 hover:shadow-md hover:shadow-accent/20 active:scale-95';
const hot = 'shine relative overflow-hidden h-7 rounded border border-accent bg-accent px-3 text-[11px] font-bold tracking-wider text-white shadow-md shadow-accent/40 transition-all duration-200 ease-out hover:scale-105 hover:brightness-110 active:scale-95';
const stat = (value, label, k = '') => `<div class="leading-tight"><b data-k="${k}" class="block text-sm text-white">${esc(value)}</b><span class="text-[11px] text-dim">${label}</span></div>`;

/// The status bar across the top, as the canvas header: brand, operator and rank, credits, rating, heat,
/// the world clock, and the speed, pause, ACTIVE and MAIL buttons. The logo opens the Debug menu.
/// Returns update(), which main.js calls every tick; it redraws only when something shown has changed.
export function mountHeader(state) {
  const el = document.getElementById('header');
  let last = '';
  const prev = {};

  function update() {
    const g = state.game;
    const active = g.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready').length;
    const unread = g.mail.filter((m) => !m.read).length;
    const scale = timeScale(g);
    const heat = Math.min(Math.max(g.player.heat / 100, 0), 1);
    const b = band(g);
    const label = { green: tl('header.heat_clear'), yellow: tl('header.heat_recon'), red: tl('header.breach', Math.ceil(g.raid?.left ?? 0)) }[b] ?? tl('header.heat');
    const date = `${weekday(g.clock)} ${dateLine(g.clock)} // DAY ${day(g.clock) + 1}`;
    const key = JSON.stringify([g.player.handle, g.player.rating, g.player.credits, Math.round(g.player.heat), b, label, hhmm(g.clock), date, scale, g.paused, active, unread]);
    if (key === last) return;
    last = key;
    const tone = b === 'red' ? 'text-danger' : b === 'yellow' ? 'text-warn' : 'text-dim';
    const bar = heat > 0.75 ? 'bg-danger' : heat > 0.4 ? 'bg-warn' : 'bg-accent';
    el.innerHTML = `
      <button data-id="hdr.cheat" title="BLACKGATE // Nexus Operations: your desk. The logo opens the Debug menu." class="grid h-10 w-10 place-items-center rounded hover:bg-accent-dim">
        <svg viewBox="0 0 32 32" class="h-7 w-7"><path d="M4 6h24L16 28z" fill="none" stroke="#4c9df0" stroke-width="2"/><path d="M10 10h12l-6 11z" fill="#4c9df0" opacity=".5"/></svg></button>
      <div class="flex min-w-0 flex-1 items-center gap-8 overflow-hidden">
        <div class="leading-tight"><b class="block text-sm tracking-[0.25em] text-white [text-shadow:0_0_10px_var(--color-accent)]">BLACKGATE</b><span class="text-[11px] text-dim">${tl('header.nexus_operations')}</span></div>
        <div class="leading-tight"><b class="block text-sm text-white">${esc(g.player.handle)}</b><span class="text-[11px] text-accent">${esc(rankName(g.player.rating))}</span></div>
        ${stat(g.player.credits, tl('header.credits'), 'credits')}${stat(g.player.rating, tl('header.rating'), 'rating')}
        <div class="w-44 shrink-0"><span class="block text-[11px] ${tone}">${label}</span>
          <span class="flex items-center gap-2"><i class="block h-2.5 w-32 border border-line bg-track"><i class="block h-full ${bar} ${heat > 0.75 ? 'animate-pulse' : ''}" style="width:${heat * 100}%"></i></i><span class="text-[11px] text-dim">${Math.round(g.player.heat)}</span></span></div>
        ${stat(hhmm(g.clock), date)}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button data-id="hdr.speed" class="${scale > 1 ? hot : btn}">${scale}x</button>
        <button data-id="hdr.pause" class="${btn}">${g.paused ? '&#9654;' : '&#10073;&#10073;'}</button>
        <button data-id="hdr.contracts" class="${btn} w-28">${tl('header.active', active)}</button>
        <button data-id="hdr.mail" class="${unread ? hot : btn} w-28">${tl('header.mail', unread)}</button>
      </div>`;
    // value changes: the number pops and a +N/-N drifts up (CSS only; reads state, never writes it)
    for (const k of ['credits', 'rating']) {
      const v = g.player[k], node = el.querySelector(`[data-k=${k}]`);
      if (prev[k] !== undefined && v !== prev[k] && node) {
        node.classList.add('bump');
        const r = node.getBoundingClientRect(), d = v - prev[k];
        document.body.append(Object.assign(document.createElement('div'), { textContent: `${d > 0 ? '+' : ''}${d}`, className: `float-up ${d > 0 ? 'text-emerald-300' : 'text-danger'}`, style: `left:${r.left}px;top:${r.bottom}px` }));
      }
      prev[k] = v;
    }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    if (b.dataset.id === 'hdr.pause') state.game.paused = !state.game.paused;
    else click(state, b.dataset.id);
    update();
  });
  return update;
}
