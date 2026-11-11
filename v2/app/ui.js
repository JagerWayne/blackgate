import { handleEvents } from '../game/systems/events.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const desk = () => ({ x: 0, y: 0, w: innerWidth, h: innerHeight - 40 });

/// Sends a canvas-style event through the game's own handler, so a DOM button does exactly what the
/// canvas button with the same id did.
export const click = (state, id) => handleEvents(state, [{ type: 'click', id }], desk());
/// A text field changed: the same event the canvas field makes.
export const edit = (state, id, value) => handleEvents(state, [{ type: 'edit', id, value }], desk());
/// A row was picked in a list: the same event the canvas table makes.
export const select = (state, id, index) => handleEvents(state, [{ type: 'select', id, index }], desk());
/// A check box moved: the same event the canvas check box makes.
export const toggle = (state, id, value) => handleEvents(state, [{ type: 'toggle', id, value }], desk());

/// Redraws `render` whenever `sig()` changes, and keeps what the player was doing across the redraw:
/// the focused field (data-keep) with its caret, and the scroll of every [data-scroll] box.
/// Returns a function that forces a redraw.
export function autoRender(body, sig, render) {
  let last = null;
  const run = () => {
    const s = sig();
    if (s === last) return;
    last = s;
    const f = document.activeElement;
    const keep = body.contains(f) ? f.dataset?.keep : null;
    const caret = keep && f.setSelectionRange ? [f.selectionStart, f.selectionEnd] : null;
    const scrolls = [...body.querySelectorAll('[data-scroll]')].map((e) => [e.dataset.scroll, e.scrollTop]);
    render();
    scrolls.forEach(([k, v]) => { const e = body.querySelector(`[data-scroll="${k}"]`); if (e) e.scrollTop = v; });
    if (keep) {
      const e = body.querySelector(`[data-keep="${keep}"]`);
      e?.focus();
      if (caret && e?.setSelectionRange) e.setSelectionRange(...caret);
    }
  };
  const timer = setInterval(() => (body.isConnected ? run() : clearInterval(timer)), 200);
  run();
  return () => { last = null; run(); };
}

let menu = null;
let closeMenu = null;

export function hideMenu() {
  menu?.remove();
  menu = null;
  document.removeEventListener('pointerdown', closeMenu, true);
  closeMenu?.cb?.();
}

/// A right-click menu: items are { id, text, note, why }. An item with a `why` (or no id) is greyed.
/// Each item carries data-tutorial=<id> so the tutorial can ring it. onClose runs when it goes away.
export function showMenu(items, x, y, pick, onClose) {
  hideMenu();
  menu = document.createElement('ul');
  menu.className = 'fixed z-[60] w-64 overflow-hidden rounded border border-accent/60 bg-panel py-1 text-xs shadow-2xl';
  menu.style.left = `${Math.min(x, innerWidth - 270)}px`;
  menu.style.top = `${Math.min(y, innerHeight - 40 - items.length * 40)}px`;
  for (const it of items) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'block w-full px-3 py-1.5 text-left enabled:hover:bg-accent/20 disabled:text-ink/40';
    b.disabled = !it.id || !!it.why;
    if (it.id) b.dataset.tutorial = it.id;
    b.innerHTML = `<span></span>${it.note ? '<small class="block text-ink/50"></small>' : ''}${it.why ? '<small class="block text-amber-300"></small>' : ''}`;
    b.querySelector('span').textContent = it.text;
    if (it.note) b.querySelector('small').textContent = it.note;
    if (it.why) b.querySelector('small:last-child').textContent = it.why;
    b.onclick = () => { hideMenu(); pick(it.id); };
    li.append(b);
    menu.append(li);
  }
  document.body.append(menu);
  closeMenu = (e) => { if (!menu?.contains(e.target)) hideMenu(); };
  closeMenu.cb = onClose;
  document.addEventListener('pointerdown', closeMenu, true);
}
