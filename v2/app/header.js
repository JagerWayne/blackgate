import { rankName } from '../game/core/theme.js';
import { band } from '../game/systems/physical.js';
import { timeScale } from '../game/state/cheats.js';
import { hhmm, weekday, dateLine, day } from '../game/core/clock.js';
import { click, esc } from './ui.js';
import { t as tl } from '../game/data/language.js';
import { allowDebug } from '../game/data/settings.js';

const btn = 'h-6 rounded border border-line px-2 text-[11px] tracking-wider transition-all duration-200 ease-out hover:border-accent/60 hover:bg-white/10 active:scale-95';
const hot = 'shine relative overflow-hidden h-6 rounded border border-accent bg-accent px-2 text-[11px] font-bold tracking-wider text-white shadow-md shadow-accent/40 transition-all duration-200 ease-out hover:brightness-110 active:scale-95';

/// The tray at the right of the taskbar: the heat bar, ACTIVE jobs, speed and pause, credits (Cr), rating (Rt) and the world
/// clock (rest the pointer on it for the full date). Also wires the BL@CKG@TE name on the desktop, which opens the Debug menu.
/// Returns update(), which main.js calls every tick; it redraws only when something shown has changed.
export function mountHeader(state) {
  const el = document.getElementById('tray');
  const brand = document.getElementById('brand');
  brand.lastElementChild.textContent = tl('header.nexus_operations');
  if (allowDebug()) brand.title = tl('header.brand_tip');
  else brand.style.pointerEvents = 'none'; // no Debug menu to open
  let last = '';
  const prev = {};

  function update() {
    const g = state.game;
    const active = g.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready').length;
    const scale = timeScale(g);
    const heat = Math.min(Math.max(g.player.heat / 100, 0), 1);
    const b = band(g);
    const label = { green: tl('header.heat_clear'), yellow: tl('header.heat_recon'), red: tl('header.breach', Math.ceil(g.raid?.left ?? 0)) }[b] ?? tl('header.heat');
    const date = `${weekday(g.clock)} ${dateLine(g.clock)} // DAY ${day(g.clock) + 1}`;
    const key = JSON.stringify([g.player.handle, g.player.rating, g.player.credits, Math.round(g.player.heat), b, label, hhmm(g.clock), date, scale, g.paused, active]);
    if (key === last) return;
    last = key;
    const tone = b === 'red' ? 'text-danger' : b === 'yellow' ? 'text-warn' : 'text-dim';
    const bar = heat > 0.75 ? 'bg-danger' : heat > 0.4 ? 'bg-warn' : 'bg-accent';
    el.innerHTML = `
      <span class="flex shrink-0 items-center gap-2 whitespace-nowrap" title="${esc(label)}"><span class="${tone}">${label}</span>
        <i class="block h-2 w-20 border border-line bg-track"><i class="block h-full ${bar} ${heat > 0.75 ? 'animate-pulse' : ''}" style="width:${heat * 100}%"></i></i><span class="w-6 text-dim">${Math.round(g.player.heat)}</span></span>
      <button data-id="hdr.contracts" class="${btn} whitespace-nowrap">${tl('header.active', active)}</button>
      <button data-id="hdr.speed" class="${scale > 1 ? hot : btn}">${scale}x</button>
      <button data-id="hdr.pause" class="${btn}">${g.paused ? '&#9654;' : '&#10073;&#10073;'}</button>
      <span class="whitespace-nowrap" title="${esc(tl('header.credits'))}"><span class="text-dim">${tl('header.cr')}</span> <b data-k="credits" class="text-white">${esc(g.player.credits)}</b></span>
      <span class="whitespace-nowrap" title="${esc(`${tl('header.rating')} // ${g.player.handle} // ${rankName(g.player.rating)}`)}"><span class="text-dim">${tl('header.rt')}</span> <b data-k="rating" class="text-white">${esc(g.player.rating)}</b></span>
      <b class="shrink-0 text-white" title="${esc(date)}">${hhmm(g.clock)}</b>`;
    // value changes: the number pops and a +N/-N drifts up (CSS only; reads state, never writes it)
    for (const k of ['credits', 'rating']) {
      const v = g.player[k], node = el.querySelector(`[data-k=${k}]`);
      if (prev[k] !== undefined && v !== prev[k] && node) {
        node.classList.add('bump');
        const r = node.getBoundingClientRect(), d = v - prev[k];
        document.body.append(Object.assign(document.createElement('div'), { textContent: `${d > 0 ? '+' : ''}${d}`, className: `float-up ${d > 0 ? 'text-emerald-300' : 'text-danger'}`, style: `left:${r.left}px;top:${r.top - 16}px` }));
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
  brand.addEventListener('click', () => click(state, 'hdr.cheat'));
  return update;
}
