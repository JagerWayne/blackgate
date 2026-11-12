import { listSlots, deleteRun, profilesFull, safeName, takePurged } from '../game/state/save.js';
import { startRun } from '../game/state/startRun.js';
import { dailySeed, dailyMod } from '../game/state/daily.js';
import { buildText, justUpdated, VERSION } from '../game/version.js';
import { ENDINGS } from '../pages/render/over.js';
import { toast } from '../game/state/gameHelpers.js';
import { esc, click, autoRender } from './ui.js';
import { maxProfiles, population } from '../game/data/settings.js';
import { t as tl } from '../game/data/language.js';

/// The welcome screen's state: the same shape the canvas build keeps in state.login, because the game's
/// own code (log off, new campaign, start run) reads and writes it.
export function makeLoginState() {
  const st = { handle: '', sel: 0, slots: [], error: '', notice: '', confirmDelete: false, daily: false };
  const was = justUpdated();
  if (was) st.notice = `Updated to v${VERSION} (was v${was})`;
  if (takePurged()) st.notice = 'Your old save is from an earlier version and will not load. It has been removed // start a new game';
  return st;
}

const tile = (on, attrs, letter, title, sub, extra = '') => `<div ${attrs} class="flex cursor-pointer items-center gap-4 rounded p-3 ${on ? 'bg-[#00309c]/90' : 'hover:bg-white/10'}">
  <i class="grid h-12 w-12 shrink-0 place-items-center rounded border-2 border-white/80 bg-[#2b8fd6] text-xl font-bold not-italic text-white">${esc(letter)}</i>
  <div class="min-w-0 flex-1"><b class="block truncate text-base text-white">${title}</b><span class="block truncate text-xs text-[#d6e4ff]">${sub}</span>${extra}</div></div>`;

/// The welcome screen (#login) and the ending (#over). Returns { sync }, which main.js calls every tick:
/// it shows the right one for state.mode and the game's gameOver, and keeps the saved list fresh.
export function mountLogin(state) {
  const el = document.getElementById('login');
  const over = document.getElementById('over');
  const st = () => state.login;
  const refreshSlots = () => {
    st().slots = listSlots();
    // a saved run is picked first, so Enter never starts over it by accident
    st().sel = st().slots.length ? 1 : 0;
  };

  /// The line under the handle box and whether it warns: what starting with the typed handle would do.
  function handleHint() {
    const l = st();
    const name = l.handle.trim() || 'OPERATOR';
    const same = l.slots.find((s) => safeName(s.handle) === safeName(name));
    const full = profilesFull(l.slots, l.handle);
    const line = same ? `replaces the saved run of ${same.handle}`
      : full ? `${maxProfiles()} profiles in use // delete one first` : `profile ${l.slots.length + 1} of ${maxProfiles()} // a new world of ${population().toLocaleString('en-US')} people`;
    return { line, warn: !!(same || full) };
  }

  function render() {
    const l = st();
    const { line, warn } = handleHint();
    const dm = dailyMod(dailySeed());
    const slots = l.slots.slice(0, maxProfiles()).map((s, i) => {
      const on = l.sel === i + 1;
      return tile(on, `data-act="pick" data-sel="${i + 1}"`, s.handle[0] ?? '?', esc(s.handle), `${esc(s.rank)} &middot; ${s.credits} cr &middot; day ${s.day}`,
        on ? `<div class="mt-2 flex gap-2"><button data-act="go" class="rounded bg-[#2f7a2f] px-4 py-1 text-xs font-bold text-white hover:brightness-125">LOAD &rarr;</button>
          <button data-act="delete" class="rounded border border-white/70 px-3 py-1 text-xs text-white ${l.confirmDelete ? 'bg-red-700' : 'bg-[#2a55c0]'} hover:brightness-125">${l.confirmDelete ? 'Confirm delete' : 'Delete save'}</button></div>` : '');
    }).join('');
    const on = l.sel === 0;
    el.innerHTML = `<div class="flex h-full flex-col text-white">
      <div class="flex h-14 shrink-0 items-center justify-end bg-[#00309c] px-6 text-xs text-[#c9d8f8]">BLACKGATE v${esc(buildText())}</div>
      <div class="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-[#5a7edc] bg-[radial-gradient(circle_at_18%_0%,rgb(160_190_245/.85),transparent_55%)]">
        <div class="w-full max-w-xl space-y-1 px-4">
          <h1 class="pb-4 text-center text-4xl font-bold tracking-widest">BLACKGATE</h1>
          <p class="pb-2 text-center text-sm text-[#e8f0ff]">To begin, click your user name</p>
          ${slots}
          ${tile(on, 'data-act="pick" data-sel="0"', '+', 'New session', on ? '' : 'a random world', on ? `<div class="mt-2 flex items-center gap-2">
            <input data-keep="login-handle" data-field="handle" value="${esc(l.handle)}" maxlength="16" placeholder="type a handle" class="min-w-0 flex-1 rounded border border-white/60 bg-white px-2 py-1 text-sm text-black outline-none" />
            <button data-act="daily" class="rounded border border-white/70 px-2 py-1 text-xs ${l.daily ? 'bg-[#2f7a2f]' : 'bg-[#2a55c0]'}">Daily: ${l.daily ? 'ON' : 'OFF'}</button>
            <button data-act="go" class="rounded bg-[#2f7a2f] px-4 py-1 text-xs font-bold hover:brightness-125">START &rarr;</button></div>
            <div data-hint class="mt-1 text-[11px] ${warn ? 'text-[#ff9a86]' : 'text-[#d6e4ff]'}">${esc(l.daily ? `daily world // ${dm.label}: ${dm.text}` : line)}</div>` : '')}
          ${l.notice ? `<p class="pt-3 text-center text-xs text-[#ffe9a8]">${esc(l.notice)}</p>` : ''}
        </div></div>
      <div class="flex h-16 shrink-0 items-center justify-end border-t-2 border-[#f8b048] bg-[#00309c] px-6"><button data-act="off" class="rounded border border-white/70 bg-[#2a55c0] px-4 py-1.5 text-xs font-bold text-white hover:brightness-125">Turn off</button></div></div>`;
  }

  const refresh = autoRender(el, () => JSON.stringify([st().sel, st().slots, st().confirmDelete, st().daily, st().notice]), render);

  function go() {
    const l = st();
    const fresh = l.sel === 0;
    // four profiles at most: a new handle needs a free one
    if (fresh && profilesFull(l.slots, l.handle)) {
      l.notice = `${maxProfiles()} profiles in use // delete one to make a new profile`;
      return refresh();
    }
    state.game = startRun(state, innerWidth, innerHeight);
    l.notice = '';
    // a new operator watches their world being made (screens.js), then gets their save file
    if (fresh) {
      state.setup = { game: state.game, t: 0 };
      state.mode = 'setup';
      return null;
    }
    (globalThis.blackgate?.dataFallbacks?.() ?? []).forEach((f) => toast(state.game, tl('login.unreadable_using_the_built', f), 'bad'));
    state.mode = 'play';
    state.ui.focus = null;
    return null;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-sel]');
    if (!b) return;
    const l = st();
    const act = b.dataset.act;
    if (act === 'go') { go(); return; }
    if (act === 'off') { state.mode = 'off'; return; }
    if (act === 'daily') l.daily = !l.daily;
    else if (act === 'delete') {
      // two presses: the first arms it, the second throws the save away
      if (l.confirmDelete) {
        const gone = deleteRun(l.slots[l.sel - 1]?.handle);
        refreshSlots();
        l.confirmDelete = false;
        l.notice = gone ? 'saved run deleted' : 'the save could not be deleted';
      } else l.confirmDelete = true;
    } else if (b.dataset.sel !== undefined && Number(b.dataset.sel) !== l.sel) {
      l.sel = Number(b.dataset.sel);
      l.confirmDelete = false;
    }
    refresh();
  });
  // typing only touches the hint under the box: a full redraw on every key made the screen flash
  el.addEventListener('input', (e) => {
    if (e.target.dataset.field !== 'handle') return;
    st().handle = e.target.value;
    const hint = el.querySelector('[data-hint]');
    if (!hint || st().daily) return;
    const { line, warn } = handleHint();
    hint.textContent = line;
    hint.classList.toggle('text-[#ff9a86]', warn);
    hint.classList.toggle('text-[#d6e4ff]', !warn);
  });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.field === 'handle') go(); });

  // the ending: told over the desk, with the two ways on
  over.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) click(state, b.dataset.id);
  });
  let overShown = null;
  const syncOver = () => {
    const key = state.mode === 'play' && state.game?.gameOver ? state.game.gameOver : null;
    if (key === overShown) return;
    overShown = key;
    over.hidden = !key;
    if (!key) return;
    const g = state.game;
    const [title, story] = ENDINGS[key] ?? ['RUN OVER', ''];
    const s = g.stats;
    over.innerHTML = `<div class="max-w-xl rounded border border-danger/80 bg-panel p-8 text-center shadow-2xl"><h2 class="text-2xl font-bold text-danger"></h2><p class="my-4 text-sm"></p>
      <p class="text-[11px] text-dim">JOBS ${s.missionsDone} &nbsp; FAILED ${s.missionsFailed} &nbsp; BREACHES ${s.hostsBreached} &nbsp; FILES ${s.filesStolen} &nbsp; EARNED ${s.earned} &nbsp; RATING ${g.player.rating}</p>
      <div class="mt-6 flex justify-center gap-3"><button data-id="over.again" class="rounded bg-accent px-5 py-2 font-bold text-white">NEW CAMPAIGN</button><button data-id="over.load" class="rounded border border-line px-5 py-2 hover:bg-white/10">LOAD LAST SAVE</button></div></div>`;
    over.querySelector('h2').textContent = title;
    over.querySelector('p').textContent = story;
  };

  let wasLogin = false;
  return {
    sync() {
      const login = state.mode === 'login';
      if (login && !wasLogin) refreshSlots();
      wasLogin = login;
      el.hidden = !login;
      syncOver();
    },
    start() { refreshSlots(); wasLogin = true; el.hidden = false; refresh(); },
  };
}
