import { SPEEDS, SKIPS, timeScale, cheatsOf } from '../../game/state/cheats.js';
import { rankName } from '../../game/core/theme.js';
import { RATING_MAX } from '../../game/data/enums.js';
import { esc, click, autoRender } from '../ui.js';
import { languages, languageCode, t as tl } from '../../game/data/language.js';
import { settingList, currentSettings, defaultSettings, flatSettings, applySettings, settingsText } from '../../game/data/settings.js';

const TABS = [tl('debug.tab_player'), tl('debug.tab_world'), tl('debug.tab_switches'), tl('debug.tab_settings')];
const GROUPS = [['profiles', 'PROFILES'], ['world', 'WORLD (NEW WORLDS ONLY)'], ['player', 'NEW PLAYER'], ['routes', 'ROUTES'], ['jobs', 'JOBS'], ['notepad', 'NOTEPAD'], ['browser', 'BROWSER'], ['bank', 'BANK']];
/// Keeps the editor's changes where they are read again: the player's copy in the Windows app, the browser's storage otherwise.
function persist(text) {
  if (globalThis.blackgate?.writeSettings) return globalThis.blackgate.writeSettings(text);
  try { localStorage.setItem('blackgate.mainsettings', text); return true; } catch { return false; }
}
const money = (n) => n.toLocaleString('en-US');
const signed = (n) => `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`;
const skipName = (m) => (m >= 1440 ? `+${m / 1440} DAY` : `+${m / 60}H`);
const sec = (t) => `<h3 class="pb-1 pt-3 text-[10px] tracking-widest text-ink/50">${t}</h3>`;
const note = (t, tone = 'text-dim') => `<p class="py-1 text-[11px] ${tone}">${esc(t)}</p>`;
const b = (id, text, mode = 'ghost') => `<button data-id="${id}" class="rounded px-3 py-1 text-xs font-bold ${mode === 'on' ? 'bg-accent text-white' : mode === 'solid' ? 'bg-accent-dim text-white hover:brightness-125' : 'border border-line hover:bg-white/10'}">${text}</button>`;
const row = (...x) => `<div class="flex flex-wrap gap-2 py-1">${x.join('')}</div>`;
const kv = (k, v) => `<div class="flex justify-between gap-4 py-1"><span class="text-dim">${k}</span><b class="text-white">${v}</b></div>`;
const toggle = (id, name, flag, text) => `${row(b(id, `${name}: ${flag ? 'ON' : 'OFF'}`, flag ? 'on' : 'ghost'))}${note(text)}`;
const action = (id, name, text) => `${row(b(id, name))}${note(text)}`;

/// The cheat menu behind the BLACKGATE logo: PLAYER, WORLD and SWITCHES under a status line.
/// Same cheat.* ids as the canvas window, so every button runs the game's own cheat code.
export function mountCheats(body, state) {
  const view = () => (state.win.cheats ??= {});

  /// The SETTINGS tab: one number box per setting of mainsettings.json, with its default and range.
  function settingsColumns() {
    const v = view();
    const draft = (v.draft ??= currentSettings());
    const group = ([key, name]) => `${sec(name)}${settingList().filter((s) => s.path.startsWith(`${key}.`)).map((s) => `<label class="flex items-center justify-between gap-3 py-1"><span class="min-w-0"><span class="text-white">${esc(s.path.split('.')[1])}</span><span class="block text-[10px] text-dim">default ${s.def}, from ${s.min} to ${s.max}</span></span>
        <input type="number" data-setting="${s.path}" data-keep="set-${s.path}" value="${esc(draft[s.path])}" min="${s.min}" max="${s.max}" step="${s.whole ? 1 : 'any'}" class="w-28 rounded border border-line bg-bg px-2 py-1 text-right text-xs outline-none focus:border-accent" /></label>`).join('')}`;
    const langs = Object.entries(languages()).map(([code, name]) => `<option value="${esc(code)}" ${code === draft.language ? 'selected' : ''}>${esc(name)} (${esc(code)})</option>`).join('');
    const picker = `${sec('LANGUAGE')}<label class="flex items-center justify-between gap-3 py-1"><span class="text-white">language file</span><select data-language data-keep="set-language" class="w-40 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent">${langs}</select></label>${row('<button data-set="page" class="rounded border border-line px-3 py-1 text-xs font-bold hover:bg-white/10">RELOAD NOW</button>')}${note(draft.language !== languageCode() ? 'SAVE, then reload: the words are read when the page loads.' : `now using ${languageCode()}; files are in data/language/`)}`;
    const left = `${picker}${GROUPS.slice(0, 4).map(group).join('')}`;
    const right = `${GROUPS.slice(4).map(group).join('')}${sec('FILE')}
      ${row('<button data-set="save" class="rounded bg-accent px-3 py-1 text-xs font-bold text-white hover:brightness-110">SAVE</button>', '<button data-set="reload" class="rounded border border-line px-3 py-1 text-xs font-bold hover:bg-white/10">UNDO CHANGES</button>', '<button data-set="defaults" class="rounded border border-line px-3 py-1 text-xs font-bold hover:bg-white/10">DEFAULTS</button>')}
      ${v.settingsMsg ? note(v.settingsMsg.text, v.settingsMsg.ok ? 'text-emerald-400' : 'text-red-400') : ''}
      ${note('SAVE applies at once and keeps the file for the next start. World numbers (companies, people, relays) only shape a NEW world; saved worlds keep theirs.')}`;
    return [left, right];
  }

  function column(tab, game) {
    if (tab === 3) return settingsColumns();
    const p = game.player;
    const c = cheatsOf(game);
    const scale = timeScale(game);
    const heat = Math.round(p.heat);
    if (tab === 1) {
      return [`${sec('TIME')}${kv('CLOCK SPEED', game.paused ? 'PAUSED' : `${scale}x`)}
        ${row(b('cheat.pause', 'PAUSE', game.paused ? 'on' : 'ghost'), ...SPEEDS.map((n) => b(`cheat.time.${n}`, `${n}x`, !game.paused && n === scale ? 'on' : 'ghost')))}
        ${row(...SKIPS.map((m) => b(`cheat.skip.${m}`, skipName(m))))}
        ${note(game.session ? 'close the link to skip time' : 'a skip runs every minute: deadlines, offers and the wire', game.session ? 'text-warn' : 'text-dim')}`,
      `${sec('MISSIONS')}${row(b('cheat.missions', 'OPEN MISSION BUILDER', 'on'))}${note('build a job to order: kind, target, objective, payout, deadline, client, brief')}`];
    }
    if (tab === 2) {
      return [`${sec('SWITCHES')}${toggle('cheat.heat.freeze', 'FREEZE HEAT', c.freezeHeat !== null, 'heat holds where it is')}${toggle('cheat.trace.freeze', 'FREEZE TRACE', c.freezeTrace, 'a trace never closes in')}`,
        `${sec('ONE-OFFS')}${action('cheat.map', 'REVEAL THE MAP', 'every host shows on the map')}${action('cheat.tools', 'EVERY TOOL AT V5', 'you own every tool, at its best version')}
        ${action('cheat.tutorial', 'SKIP THE TUTORIAL', game.tutorial?.on ? "the basic software and the lessons' money are yours at once, and the practice server is destroyed" : 'no tutorial is running')}${action('cheat.gateway', 'MAX THE GATEWAY', 'best chassis, every slot filled')}`];
    }
    return [`${sec('MONEY')}${kv('CREDITS', `${money(p.credits)} cr`)}
      ${row(...[1000, 10000, 100000].map((n) => b(`cheat.money.${n}`, signed(n), 'solid')))}${row(...[-1000, -10000].map((n) => b(`cheat.money.${n}`, signed(n))))}
      <input data-keep="cheat-money" value="${esc(view().money ?? '')}" placeholder="an exact amount, e.g. 250000" class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent" />
      ${row(b('cheat.money.set', 'SET AMOUNT', 'on'))}`,
    `${sec('HEAT')}${kv('HEAT', `${heat}${c.freezeHeat !== null ? ' // FROZEN' : ''}`)}
      ${row(...[0, 25, 50, 75].map((n) => b(`cheat.heat.set.${n}`, String(n))))}${row(b('cheat.heat.nudge.-10', '−10'), b('cheat.heat.nudge.10', '+10'), b('cheat.heat.freeze', `FREEZE: ${c.freezeHeat !== null ? 'ON' : 'OFF'}`, c.freezeHeat !== null ? 'on' : 'ghost'))}
      ${note('a raid starts at 100: the menu stops at 99')}
      ${sec('RATING')}${kv('RATING', `${p.rating} // ${rankName(p.rating)}`)}${row(...[-10, -1, 1, 10].map((n) => b(`cheat.rating.${n}`, n > 0 ? `+${n}` : `−${-n}`)))}${note(`from 0 to ${RATING_MAX}`)}`];
  }

  function render() {
    const game = state.game;
    const tab = view().tab ?? 0;
    const p = game.player;
    const status = `${money(p.credits)} cr  //  HEAT ${Math.round(p.heat)}  //  CLOCK ${game.paused ? 'PAUSED' : `${timeScale(game)}x`}  //  RATING ${p.rating}`;
    const [left, right] = column(tab, game);
    body.innerHTML = `<div class="flex h-full flex-col"><nav class="flex shrink-0 border-b border-line">${TABS.map((t, i) => `<button data-id="cheat.tab.${i}" class="px-4 py-2 text-xs font-bold ${i === tab ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${t}</button>`).join('')}</nav>
      <div class="shrink-0 px-4 pt-2 text-xs text-accent">${esc(status)}</div>
      <div data-scroll="cheats" class="grid min-h-0 flex-1 grid-cols-1 gap-x-8 overflow-y-auto px-4 pb-4 text-xs md:grid-cols-2"><div>${left}</div><div>${right}</div></div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    return JSON.stringify([view().tab, view().settingsMsg, view().settingsRev, g.player.credits, Math.round(g.player.heat), g.player.rating, g.paused, timeScale(g), cheatsOf(g), !!g.session, g.tutorial?.on]);
  }, render);

  body.addEventListener('click', (e) => {
    const s = e.target.closest('[data-set]');
    if (s) {
      const v = view();
      if (s.dataset.set === 'page') { globalThis.location?.reload(); return; }
      if (s.dataset.set === 'defaults') { v.draft = flatSettings(defaultSettings()); v.settingsMsg = null; }
      else if (s.dataset.set === 'reload') { v.draft = currentSettings(); v.settingsMsg = null; }
      else {
        const problems = applySettings(v.draft ?? {});
        if (problems.length) v.settingsMsg = { ok: false, text: problems.join(' // ') };
        else {
          v.settingsMsg = persist(settingsText()) ? { ok: true, text: 'saved' } : { ok: false, text: 'applied for this session, but the file could not be written' };
          v.draft = currentSettings();
        }
      }
      v.settingsRev = (v.settingsRev ?? 0) + 1;
      refresh();
      return;
    }
    const x = e.target.closest('[data-id]');
    if (!x) return;
    click(state, x.dataset.id);
    refresh();
  });
  body.addEventListener('input', (e) => {
    if (e.target.dataset.keep === 'cheat-money') view().money = e.target.value;
    if (e.target.dataset.setting) (view().draft ??= currentSettings())[e.target.dataset.setting] = e.target.value;
  });
  body.addEventListener('change', (e) => {
    if (e.target.dataset.language !== undefined) { (view().draft ??= currentSettings()).language = e.target.value; view().settingsRev = (view().settingsRev ?? 0) + 1; refresh(); }
  });
}
