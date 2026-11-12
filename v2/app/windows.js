import { WINDOWS, ordered } from '../game/state/windows.js';
import { bus } from './bridge.js';
import { iconUrl } from './icons.js';
import { showMenu } from './ui.js';
import { t as tl } from '../game/data/language.js';

// The game's window manager (state.windows) is the single source of truth. The DOM never decides
// anything: a click emits bus 'window' {key, action}, main.js applies it to the manager, and
// reconcile() makes the DOM match the manager every frame. So a window the game opens, closes,
// minimizes or maximizes (a command, the tutorial) shows up here exactly like one the player did.

const defs = new Map(WINDOWS.map((d) => [d.key, d]));
const open = new Map(); // key -> { el, task }
let focused = null;

/// App mounts by window key: (body, def) => void. Anything not listed gets a placeholder.
export const mounts = {};

const $ = (id) => document.getElementById(id);
const btn = 'grid h-5 w-5 place-items-center rounded text-xs hover:bg-white/10';
const emit = (key, action) => bus.emit('window', { key, action });

// the task row scrolls sideways; the mouse wheel does it too
$('tasks').addEventListener('wheel', (e) => { e.currentTarget.scrollLeft += e.deltaY + e.deltaX; e.preventDefault(); }, { passive: false });

/// How much of a dragged window must stay on the desk.
const MARGIN = 10;

function drag(el, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || el.dataset.max) return;
    const dx = e.clientX - el.offsetLeft, dy = e.clientY - el.offsetTop;
    handle.setPointerCapture(e.pointerId);
    // a window can leave the desk on any side, but MARGIN px of it stay in view so its title bar can be grabbed again;
    // the top stops at the desk's edge (the title bar must never leave the screen)
    const move = (m) => {
      const desk = el.parentElement;
      el.style.left = `${Math.min(Math.max(m.clientX - dx, MARGIN - el.offsetWidth), desk.clientWidth - MARGIN)}px`;
      el.style.top = `${Math.min(Math.max(m.clientY - dy, 0), desk.clientHeight - MARGIN)}px`;
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', move), { once: true });
  });
}

function build(key, n) {
  const def = defs.get(key);
  const el = document.createElement('section');
  el.className = 'pointer-events-auto absolute flex flex-col overflow-hidden win-in rounded-lg border border-line bg-panel/95 shadow-2xl shadow-black/60 ring-1 ring-accent/10 backdrop-blur-sm transition-shadow duration-200 hover:shadow-accent/20';
  Object.assign(el.style, { left: `${70 + n * 28}px`, top: `${20 + n * 28}px`, width: `${def.w * 0.8}px`, height: `${def.h * 0.8}px`, minWidth: `${Math.min(def.minW, 320)}px`, minHeight: `${Math.min(def.minH, 200)}px`, resize: 'both' });
  el.dataset.tutorial = `window.${key}`;
  el.innerHTML = `
    <header class="flex h-8 shrink-0 cursor-move items-center gap-2 border-b border-accent/20 bg-gradient-to-r from-[#1f2a44] to-[#2c3650] px-2">
      <img src="${iconUrl(key)}" alt="" class="h-4 w-4" draggable="false" />
      <h2 class="flex-1 truncate text-xs font-bold tracking-widest uppercase"></h2>
      <button data-act="min" class="${btn}" aria-label="Minimize">&minus;</button>
      <button data-act="max" class="${btn}" aria-label="Maximize">&#9633;</button>
      <button data-act="close" class="${btn} hover:bg-red-500/60" aria-label="Close">&times;</button>
    </header>
    <div data-body class="min-h-0 flex-1 overflow-hidden"></div>`;
  el.querySelector('h2').textContent = def.title;
  $('windows').append(el);

  const task = document.createElement('button');
  task.className = 'flex h-7 w-44 max-w-44 shrink-0 items-center gap-2 truncate rounded border border-line bg-[#232c42] px-3 text-left text-[10px] text-white transition-all duration-200 ease-out hover:border-accent/60 hover:bg-panel2 active:scale-95';
  task.innerHTML = `<img src="${iconUrl(key)}" alt="" class="h-4 w-4 shrink-0" draggable="false" /><span class="truncate"></span>`;
  task.lastElementChild.textContent = def.title;
  task.onclick = () => emit(key, focused === key ? 'min' : 'open');
  // right click: bring the window forward (restoring it if minimised) or close it
  task.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showMenu([{ id: 'open', text: tl('windows.bring_to_front') }, { id: 'close', text: tl('windows.end_task') }], e.clientX, e.clientY, (act) => emit(key, act));
  });
  $('tasks').append(task);
  task.scrollIntoView({ inline: 'nearest', block: 'nearest' });

  el.addEventListener('pointerdown', () => focused !== key && emit(key, 'open'), true);
  drag(el, el.firstElementChild);
  el.firstElementChild.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act) emit(key, act);
  });
  const mount = mounts[key];
  if (mount) mount(el.querySelector('[data-body]'), def);
  else el.querySelector('[data-body]').innerHTML = '<p class="p-4 text-ink/60"></p>', el.querySelector('p').textContent = def.about;
  open.set(key, { el, task });
}

function setMax(el, on) {
  if (!!el.dataset.max === on) return;
  if (on) {
    el.dataset.max = 1;
    el.dataset.box = [el.style.left, el.style.top, el.style.width, el.style.height].join('|');
    Object.assign(el.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
  } else {
    delete el.dataset.max;
    [el.style.left, el.style.top, el.style.width, el.style.height] = el.dataset.box.split('|');
  }
}

/// Makes the DOM windows match the game's window manager: opens, closes, minimizes, maximizes, stacks and focuses.
export function reconcile(mgr) {
  const keys = new Set(mgr.list.map((w) => w.key));
  for (const [key, w] of open) {
    if (keys.has(key)) continue;
    w.el.remove();
    w.task.remove();
    open.delete(key);
  }
  for (const w of mgr.list) {
    if (!open.has(w.key) && defs.has(w.key)) build(w.key, open.size);
    const o = open.get(w.key);
    if (!o) continue;
    o.el.hidden = !!w.min;
    o.el.style.zIndex = w.z;
    setMax(o.el, !!w.max);
  }
  focused = ordered(mgr).at(-1)?.key ?? null;
  for (const [key, o] of open) {
    const on = key === focused;
    o.el.classList.toggle('border-accent', on);
    o.el.classList.toggle('border-line', !on);
    o.el.firstElementChild.classList.toggle('to-[#3a4f80]', on);
    o.el.firstElementChild.classList.toggle('to-[#2c3650]', !on);
    // the front window's tab looks pressed
    o.task.classList.toggle('bg-[#32405c]', on);
    o.task.classList.toggle('shadow-inner', on);
  }
}
