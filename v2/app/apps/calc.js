import { makeCalc, press } from '../../game/state/calc.js';
import { autoRender } from '../ui.js';

// the keys, row by row: key name and what the button says (as in src/windows/calc.js)
const KEYS = [
  [['C', 'C'], ['neg', '+/-'], ['%', '%'], ['/', '/']],
  [['7', '7'], ['8', '8'], ['9', '9'], ['*', 'x']],
  [['4', '4'], ['5', '5'], ['6', '6'], ['-', '-']],
  [['1', '1'], ['2', '2'], ['3', '3'], ['+', '+']],
  [['0', '0'], ['.', '.'], ['back', 'DEL'], ['=', '=']],
];
const typed = { '=': '=', Enter: '=', Backspace: 'back', c: 'C', C: 'C' };

/// Calculator: the game's own key machine (state/calc.js), kept in state.win.calc.calc. Click the keys or type.
export function mountCalc(body, state) {
  const calc = () => ((state.win.calc ??= {}).calc ??= makeCalc());
  const render = () => {
    const c = calc();
    const style = (k) => (k === '=' ? 'bg-accent text-white' : k.length === 1 && '+-*/'.includes(k) ? 'bg-accent-dim text-white' : 'border border-line hover:bg-white/10');
    body.innerHTML = `<div tabindex="0" class="flex h-full flex-col gap-1.5 p-2 outline-none">
      <div class="shrink-0 rounded bg-deep px-3 py-2 text-right"><div class="h-4 truncate text-[11px] text-dim">${c.line}</div>
        <div class="truncate text-3xl font-bold ${c.entry === 'Error' ? 'text-danger' : 'text-white'}">${c.entry}</div></div>
      <div class="grid min-h-0 flex-1 grid-cols-4 gap-1.5">${KEYS.flat().map(([k, t]) => `<button data-key="${k}" class="rounded text-sm font-bold ${style(k)}">${t}</button>`).join('')}</div></div>`;
  };
  const refresh = autoRender(body, () => JSON.stringify(calc()), render);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (b) { press(calc(), b.dataset.key); refresh(); }
  });
  body.addEventListener('keydown', (e) => {
    const k = typed[e.key] ?? (/^[\d+\-*/.%]$/.test(e.key) ? e.key : null);
    if (k) { e.preventDefault(); press(calc(), k); refresh(); }
  });
}
