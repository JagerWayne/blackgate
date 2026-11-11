import { initContent } from '../game/data/content.js';
import { applySettings, flatSettings } from '../game/data/settings.js';
import { makeInput } from '../game/systems/input.js';
import { makeUiState } from '../pages/ui/kit.js';
import { WINDOWS, makeWindows, openWindow, closeWindow, minimizeWindow, toggleMax } from '../game/state/windows.js';
import { tick } from '../game/systems/tick.js';
import { tickTutorial } from '../game/state/tutorial.js';
import { makeTerm, run, complete, promptOf } from '../game/systems/commands.js';
import { bus, actions } from './bridge.js';
import { reconcile, mounts } from './windows.js';
import { spotlight } from './spotlight.js';
import { iconUrl } from './icons.js';
import { mountHeader } from './header.js';
import { hhmm } from '../game/core/clock.js';
import { saveOnLeave, saveRun } from '../game/state/save.js';
import { toast } from '../game/state/gameHelpers.js';
import { mountLogin, makeLoginState } from './login.js';
import { click } from './ui.js';
import { mountKeys } from './keys.js';
import { mountTooltips } from './tooltips.js';
import { mountFx } from './fx.js';
import { mountScreens } from './screens.js';
import { t as tl } from '../game/data/language.js';

await initContent();
// the browser build keeps the Debug window's settings in the browser's storage; the Windows app reads its own copy of the file
try {
  const stored = globalThis.blackgate ? null : localStorage.getItem('blackgate.mainsettings');
  if (stored) applySettings(flatSettings(JSON.parse(stored)));
} catch {}

// A picture that cannot be found (a file not added yet) shows a grey rectangle. 'error' does not bubble, so listen on capture.
const GREY = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1 1"><rect width="1" height="1" fill="#9aa3ad"/></svg>')}`;
addEventListener('error', (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && !img.dataset.grey) { img.dataset.grey = '1'; img.src = GREY; }
}, true);

// The same state object the canvas build keeps (src/main.js), so commands and the tutorial work unchanged.
// It starts at the welcome screen with no game: LOAD or START on it sets state.game and mode 'play'.
const state = {
  view: { w: innerWidth, h: innerHeight }, wallpaper: null, input: makeInput(), ui: makeUiState(),
  windows: makeWindows(), game: null, login: makeLoginState(),
  win: {}, mode: 'boot', time: 0, setup: null,
};
saveOnLeave(window, state);
const desk = () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight - 40 });

// -- Command Prompt: the same term and run() the canvas prompt uses ----------------
const term = () => ((state.win.terminal ??= {}).term ??= makeTerm());
// each app's code is its own chunk, fetched the first time its window opens
const lazy = (file, fn) => (body, def) => import(`./apps/${file}.js`).then((m) => m[fn](body, state, def));
mounts.terminal = lazy('terminal', 'mountTerminal');
mounts.software = lazy('software', 'mountSoftware');
mounts.files = lazy('files', 'mountFiles');
mounts.blackgate = lazy('blackgate', 'mountBlackgate');
mounts.notepad = lazy('notepad', 'mountNotepad');
mounts.mail = lazy('mail', 'mountMail');
mounts.bank = lazy('bank', 'mountBank');
mounts.cheats = lazy('cheats', 'mountCheats');
mounts.operator = lazy('operator', 'mountOperator');
mounts.calc = lazy('calc', 'mountCalc');
mounts.info = lazy('info', 'mountInfo');
mounts.gateway = lazy('gateway', 'mountGateway');
mounts.dsn = lazy('dsn', 'mountDsn');
mounts.missions = lazy('missions', 'mountMissions');
Object.assign(actions, {
  run: (line) => run(state, term(), line, desk()),
  complete: (line) => complete({ game: state.game }, line),
  term,
  prompt: () => promptOf(state.game, term()),
});

// -- Windows: chrome clicks go to the game's manager; reconcile() reads it back each frame ----
const apply = { open: openWindow, min: minimizeWindow, max: toggleMax, close: closeWindow };
bus.on('window', ({ key, action }) => apply[action]?.(state.windows, key, desk()));

// Desktop icons: every visible app in the game's registry. Ids match the ones the tutorial lights.
const icons = document.getElementById('icons');
for (const d of WINDOWS.filter((w) => !w.hidden)) {
  const b = document.createElement('button');
  b.className = 'pointer-events-auto flex w-20 flex-col items-center gap-1 rounded p-1 text-center text-[11px] leading-tight text-white [text-shadow:0_1px_2px_#000] hover:bg-white/10';
  b.dataset.tutorial = `win.${d.key}`;
  b.innerHTML = `<img src="${iconUrl(d.key)}" alt="" class="h-12 w-12" draggable="false" /><span></span>`;
  b.lastChild.textContent = d.title;
  // a desktop icon opens on a double click, as on a desktop
  b.ondblclick = () => bus.emit('window', { key: d.key, action: 'open' });
  icons.append(b);
}

// Start menu: the same registry, in a popover. state.startOpen is what the tutorial reads to light the button.
const start = document.getElementById('start');
const menu = document.getElementById('startmenu');
start.dataset.tutorial = 'start';
const setMenu = (on) => {
  state.startOpen = on;
  menu.hidden = !on;
  start.setAttribute('aria-expanded', on);
};
for (const d of WINDOWS.filter((w) => !w.hidden)) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.className = 'flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs hover:bg-[#2e4c86]';
  b.dataset.tutorial = `win.${d.key}`;
  b.innerHTML = `<img src="${iconUrl(d.key)}" alt="" class="h-6 w-6" draggable="false" /><span></span>`;
  b.lastChild.textContent = d.title;
  b.onclick = () => { setMenu(false); bus.emit('window', { key: d.key, action: 'open' }); };
  li.append(b);
  document.getElementById('startlist').append(li);
}
start.onclick = (e) => { e.stopPropagation(); setMenu(menu.hidden); };
// Save game and Log off (which saves first, then returns to the welcome screen) use the game's own ids
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  setMenu(false);
  click(state, b.dataset.id);
});
mountKeys(state, { closeMenu: () => setMenu(false) });
mountTooltips();
document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== start) setMenu(false); });

// -- Tutorial: the game's own step -> spotlight. The step's ids are the canvas ones; the DOM
// shows whichever of them it has an element for (data-tutorial="<id>") and otherwise a centred card.
let shown = '';
const showStep = (step) => {
  const key = step && `${step.lesson}.${step.n}.${step.text}.${step.ids}`;
  if (key === shown) return;
  shown = key;
  spotlight(step && {
    title: `LESSON ${step.lesson}: ${step.title}  (${step.n}/${step.total})`,
    text: step.text,
    progress: (step.lesson - 1 + (step.n - 1) / step.total) / 5, // how far through the five lessons
    target: step.ids.map((id) => `[data-tutorial="${id}"]`).join(',') || '#desktop',
  });
};

// Toasts: the game pushes {text, kind} onto game.toasts and drops each after 5 s; this just shows them.
const toasts = document.getElementById('toasts');
const TOAST = { bad: 'border-red-400 text-red-200', good: 'border-emerald-400 text-emerald-200' };
let toastKey = '';
const showToasts = (list) => {
  const key = list.map((t) => t.text).join('\n');
  if (key === toastKey) return;
  toastKey = key;
  toasts.replaceChildren(...list.map((t) => Object.assign(document.createElement('div'), { textContent: t.text, className: `toast-in rounded-lg border bg-panel/85 px-3 py-2 text-xs shadow-lg backdrop-blur-md ${TOAST[t.kind] ?? 'border-accent text-ink'}` })));
};

const clock = document.getElementById('clock');
const updateHeader = mountHeader(state);
const updateFx = mountFx(state);
const screens = mountScreens(state);
const login = mountLogin(state);
login.start();
let last = performance.now();
let autosaveT = 0;
let saveWarned = false;
// a timer, not requestAnimationFrame: the DOM needs no vsync, and the game keeps running in a hidden window
setInterval(() => {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  state.time += dt;
  try {
    screens.sync(dt); // boot, setup and power off; it moves state.mode on, so it runs before the welcome screen syncs
    login.sync();
    if (state.mode !== 'play' || !state.game) {
      // at the welcome screen: no game runs, and whatever was on the desk is cleared away
      showStep(null);
      reconcile(state.windows);
      updateFx(dt);
      return;
    }
    tick(state.game, dt);
    updateFx(dt);
    // an ended run is never saved over the last good one
    if (state.game.settings.autosave && !state.game.gameOver) {
      autosaveT += dt;
      if (autosaveT > 45) {
        autosaveT = 0;
        const ok = saveRun(state.game);
        // warn once per run of failures, not every 45 seconds
        if (!ok && !saveWarned) toast(state.game, tl('main.save_failed_browser_storage'), 'bad');
        saveWarned = !ok;
      }
    }
    // a window opened by the old name of a merged app (news, settings...) asks for its tab; the canvas shell hands it over in drawPlay
    for (const w of state.windows.list) if (w.sub) { (state.win[w.key] ??= {}).suite = w.sub; w.sub = null; }
    reconcile(state.windows);
    showStep(state.game.gameOver ? null : tickTutorial(state.game, state));
    clock.textContent = hhmm(state.game.clock);
    updateHeader();
    showToasts(state.game.toasts);
  } catch (err) {
    console.error('frame failed', err); // keep the loop alive: one bad frame must not freeze the desktop
  }
}, 33);
