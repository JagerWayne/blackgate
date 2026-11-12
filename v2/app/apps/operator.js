import { rankName } from '../../game/core/theme.js';
import { timeScale } from '../../game/state/cheats.js';
import { esc, click, toggle, autoRender } from '../ui.js';
import { t as tl } from '../../game/data/language.js';

const TABS = [['stats', 'Profile'], ['settings', 'Settings']];
// one switch per kind in NOTIFY (game/state/gameHelpers.js)
const NOTE_LABELS = [['money', tl('apps.operator.notify_money')], ['good', tl('apps.operator.notify_good')], ['info', tl('apps.operator.notify_info')], ['bad', tl('apps.operator.notify_bad')], ['heat', tl('apps.operator.notify_heat')]];
const num = (n) => n.toLocaleString('en-US');
const head = (t) => `<h3 class="mb-2 mt-4 border-b border-line pb-1 text-[10px] tracking-widest text-dim">${t}</h3>`;
const tiles = (items, cols) => `<div class="grid gap-3 ${cols}">${items.map(([k, v, tone]) => `<div class="rounded border border-line bg-panel2 p-3"><div class="text-[10px] tracking-widest text-dim">${k}</div><div class="mt-1 text-xl font-bold ${tone}">${v}</div></div>`).join('')}</div>`;
const check = (id, text, on) => `<label class="flex cursor-pointer items-center gap-3 py-1.5 text-xs"><input type="checkbox" data-set="${id}" ${on ? 'checked' : ''} class="h-4 w-4 accent-[#4c9df0]" />${text}</label>`;

function stats(game) {
  const s = game.stats;
  const p = game.player;
  const heat = Math.round(p.heat);
  const top = Math.max(...game.rivals.map((r) => r.rating), p.rating, 1);
  return `<div class="flex items-center gap-4 rounded border border-line bg-panel2 p-4"><i class="grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl font-bold not-italic text-white">${esc(p.handle[0].toUpperCase())}</i>
      <div><div class="text-xl font-bold text-white">${esc(p.handle)}</div><div class="mt-1 text-xs"><span class="rounded bg-accent/20 px-2 py-0.5 text-accent">${rankName(p.rating)}</span> <span class="ml-1 rounded bg-white/10 px-2 py-0.5 text-dim">RATING ${p.rating}</span></div></div></div>
    ${head('RECORD')}${tiles([
      ['MISSIONS COMPLETE', s.missionsDone, 'text-emerald-400'], ['MISSIONS FAILED', s.missionsFailed, s.missionsFailed > 0 ? 'text-danger' : 'text-dim'],
      ['FILES EXTRACTED', s.filesStolen, 'text-accent'], ['LOG SETS WIPED', s.logsWiped, 'text-accent'],
      ['CLEAN ESCAPES', s.tracesEscaped, 'text-emerald-400'], ['GHOST RUNS', s.ghostRuns ?? 0, 'text-violet-300']], 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]')}
    ${head('MONEY AND HEAT')}${tiles([
      ['TOTAL EARNED', `${num(s.earned)} cr`, 'text-warn'], ['BALANCE', `${num(p.credits)} cr`, 'text-warn'],
      ['HEAT', `${heat}/100`, heat > 75 ? 'text-danger' : 'text-white'], ['STORY ACT', `${Math.min(game.story.act, 4)}/4`, 'text-accent']], 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]')}
    ${head('RIVAL OPERATORS')}${game.rivals.map((r) => `<div class="flex items-center gap-3 py-1.5"><span class="w-1/3 truncate">${esc(r.handle)}</span>
      <div class="h-2 flex-1 rounded bg-track"><div class="h-2 rounded bg-violet-400" style="width:${Math.round((r.rating / top) * 100)}%"></div></div><b class="w-10 text-right text-white">${r.rating}</b></div>`).join('')}`;
}

function settings(game) {
  const s = game.settings;
  const btn = (id, text, cls) => `<button data-id="${id}" class="rounded px-4 py-1.5 text-xs font-bold ${cls}">${text}</button>`;
  return `${head('APPEARANCE')}${check('set.fx', 'Screen effects: scanlines, trace pulse, glitch', s.effects !== false)}${check('set.sound', 'Sound', s.sound !== false)}
    ${head('BEHAVIOUR')}${check('set.auto', 'Autosave every 45 seconds', s.autosave)}${check('set.cli', 'Open every link on the CLI tab (for command-line players)', s.cliDefault === true)}${check('set.fast', 'Fast-forward world clock (8x)', timeScale(game) > 1)}
    ${head(tl('apps.operator.notifications'))}${NOTE_LABELS.map(([k, text]) => check(`set.notify.${k}`, text, s.notify?.[k] !== false)).join('')}
    ${head('THE RUN')}<div class="flex gap-2">${btn('set.save', 'SAVE NOW', 'bg-accent text-white hover:brightness-125')}${btn('set.quit', 'SAVE + QUIT', 'border border-line hover:bg-white/10')}</div>`;
}

/// Control Panel: Profile and Settings as two tabs (state.win.operator.suite). The settings write the same
/// game.settings flags through the canvas check box's own toggle event.
export function mountOperator(body, state) {
  const view = () => (state.win.operator ??= {});
  const render = () => {
    const v = view();
    if (!TABS.some(([k]) => k === v.suite)) v.suite = 'stats';
    body.innerHTML = `<div class="flex h-full flex-col"><nav class="flex shrink-0 border-b border-line">${TABS.map(([k, n]) => `<button data-tab="${k}" class="px-4 py-2 text-xs font-bold ${k === v.suite ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${n}</button>`).join('')}</nav>
      <div data-scroll="operator" class="min-h-0 flex-1 overflow-y-auto p-4 text-xs">${v.suite === 'settings' ? settings(state.game) : stats(state.game)}</div></div>`;
  };
  const refresh = autoRender(body, () => {
    const g = state.game;
    return JSON.stringify([view().suite, g.stats, g.player.rating, g.player.credits, Math.round(g.player.heat), g.story.act, g.rivals.map((r) => r.rating), g.settings, timeScale(g)]);
  }, render);
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { view().suite = t.dataset.tab; refresh(); return; }
    const b = e.target.closest('[data-id]');
    if (b) { click(state, b.dataset.id); refresh(); }
  });
  body.addEventListener('change', (e) => {
    if (e.target.dataset.set) { toggle(state, e.target.dataset.set, e.target.checked); refresh(); }
  });
}
