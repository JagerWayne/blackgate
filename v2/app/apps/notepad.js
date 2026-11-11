import { padsOf } from '../../game/state/notes.js';
import { esc, click, autoRender } from '../ui.js';
import { maxPads } from '../../game/data/settings.js';

const btn = 'rounded border border-line px-2 py-0.5 text-[11px] enabled:hover:bg-white/10 disabled:opacity-30';

/// Notepad: one tab a pad, a text area bound to game.notes (the open pad's text, which the `notepad`
/// commands also use). NEW, OPEN, DELETE (press twice) and WRAP go through the game's own click handler.
export function mountNotepad(body, state) {
  const view = () => (state.win.notepad ??= {});
  const ta = () => body.querySelector('textarea');
  const send = (id) => { click(state, id); refresh(); };

  function render() {
    const game = state.game;
    const pads = padsOf(game);
    const wrap = game.settings.noteWrap !== false;
    const tabs = pads.map((p, i) => {
      const on = i === game.notepad;
      const sure = view().armed === `note.del.${i}`;
      return `<span class="flex shrink-0 items-center rounded-t border border-b-0 border-line ${on ? 'bg-accent/15' : 'bg-bg/60'}">
        <button data-id="note.open.${i}" class="px-2 py-1 text-xs ${on ? 'text-ink' : 'text-ink/60 hover:text-ink'}">${esc(p.name)}</button>
        <button data-id="note.del.${i}" title="${sure ? 'press again to delete' : 'delete'}" class="px-1.5 py-1 text-xs ${sure ? 'font-bold text-red-300' : 'text-ink/40 hover:text-red-300'}">${sure ? 'SURE?' : '&times;'}</button></span>`;
    }).join('');
    body.innerHTML = `<div class="flex h-full flex-col">
      <div class="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-line px-2 pt-2">${tabs}
        <button data-id="note.new" ${pads.length >= maxPads() ? 'disabled' : ''} class="${btn} mb-1 ml-1">+ NEW</button>
        <button data-id="note.wrap" class="${btn} mb-1 ml-auto">WRAP: ${wrap ? 'ON' : 'OFF'}</button></div>
      <textarea data-keep="note-text" spellcheck="false" placeholder="write down what you find" wrap="${wrap ? 'soft' : 'off'}" class="min-h-0 flex-1 resize-none bg-bg/60 p-3 text-xs text-ink outline-none select-text"></textarea></div>`;
    ta().value = game.notes ?? '';
  }

  // the text area is not in the signature while it has the typing, so a keystroke never redraws it
  const refresh = autoRender(body, () => {
    const g = state.game;
    return JSON.stringify([padsOf(g).map((p) => p.name), g.notepad, g.settings.noteWrap, view().armed, document.activeElement === ta() ? '' : g.notes]);
  }, render);

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) send(b.dataset.id);
  });
  body.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') state.game.notes = e.target.value; });
}
