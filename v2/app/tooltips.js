import { tipFor } from '../game/core/tooltip.js';

const DELAY = 350;

/// Hover tips for the whole desktop, like the classic game's (game/core/tooltip.js): rest the pointer on something
/// for a moment and its full text appears. Three sources, none needing code at the place that draws it:
///   - a title="" or data-tip="" on the element (a title is moved to data-tip so the browser's own tip stays quiet),
///   - the game's table of button tips, by data-id (tipFor),
///   - text cut short with an ellipsis, which shows in full.
export function mountTooltips() {
  const box = document.createElement('div');
  box.className = 'pointer-events-none fixed z-[70] hidden max-w-[340px] whitespace-pre-line border border-accent bg-panel px-2 py-1.5 text-xs leading-snug text-white shadow-xl';
  document.body.append(box);
  let timer = 0;
  let current = null;
  let x = 0;
  let y = 0;

  function find(from) {
    const t = from.closest('[title], [data-tip]');
    if (t) {
      if (t.title) { t.dataset.tip = t.title; t.removeAttribute('title'); }
      if (t.dataset.tip) return { el: t, text: t.dataset.tip };
    }
    const b = from.closest('[data-id]');
    const known = b && tipFor(b.dataset.id);
    if (known) return { el: b, text: known };
    for (let n = from, i = 0; n && n !== document.body && i < 4; n = n.parentElement, i += 1) {
      if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow === 'ellipsis') return { el: n, text: n.textContent.trim() };
    }
    return null;
  }
  const place = () => {
    box.style.left = `${Math.min(x + 14, innerWidth - box.offsetWidth - 4)}px`;
    box.style.top = `${y + 20 + box.offsetHeight > innerHeight ? y - box.offsetHeight - 8 : y + 20}px`;
  };
  const hide = () => {
    clearTimeout(timer);
    current = null;
    box.classList.add('hidden');
  };

  document.addEventListener('pointerover', (e) => {
    const hit = e.target instanceof Element ? find(e.target) : null;
    if (hit?.el === current?.el) return;
    hide();
    if (!hit) return;
    current = hit;
    x = e.clientX;
    y = e.clientY;
    timer = setTimeout(() => {
      box.textContent = hit.text;
      box.classList.remove('hidden');
      place();
    }, DELAY);
  });
  document.addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    if (!box.classList.contains('hidden')) place();
  });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) hide(); });
  document.addEventListener('scroll', hide, true);
}
