const root = document.getElementById('spotlight');
let step = null;
let raf = 0;
let scrolled = false;

const PAD = 6;
const meet = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
const empty = (b) => b.right <= b.left || b.bottom <= b.top;

/// Where a target really is on screen: its rect, the box its scrolling or clipping ancestors (a window's
/// body, a list) let it show in, and whether another window sits over it.
function measure(el) {
  const rect = el.getBoundingClientRect();
  let box = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p);
    if (o.overflowX !== 'visible' || o.overflowY !== 'visible') box = meet(box, p.getBoundingClientRect());
  }
  const vis = meet(rect, box);
  if (empty(vis)) return { rect, box, vis: null };
  const top = document.elementFromPoint((vis.left + vis.right) / 2, (vis.top + vis.bottom) / 2);
  const covered = !!top && !root.contains(top) && !el.contains(top) && !top.contains(el);
  return { rect, box, vis: covered ? null : vis };
}

/// Scrolls the lists around a target (only the ones that really scroll, never a window's fixed layout) until it shows.
function reveal(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p);
    const r = el.getBoundingClientRect();
    const b = p.getBoundingClientRect();
    if (/auto|scroll/.test(o.overflowY)) p.scrollTop += r.top < b.top ? r.top - b.top : r.bottom > b.bottom ? r.bottom - b.bottom : 0;
    if (/auto|scroll/.test(o.overflowX)) p.scrollLeft += r.left < b.left ? r.left - b.left : r.right > b.right ? r.right - b.right : 0;
  }
}

function place() {
  if (!step) return;
  const t = document.querySelector(step.target);
  const ring = root.querySelector('[data-ring]');
  const card = root.querySelector('[data-card]');
  const m = t ? measure(t) : null;
  // cut off or scrolled out of its list: bring it into reach once, then follow wherever it ends up
  if (t && !scrolled && m.rect.width > 0 && (!m.vis || m.vis.right - m.vis.left < m.rect.width - 1 || m.vis.bottom - m.vis.top < m.rect.height - 1)) {
    scrolled = true;
    reveal(t);
  }
  // the ring never leaves the area the target is shown in; no ring when it is not on screen (small, closed, or under another window)
  const r = m?.vis ? meet({ left: m.vis.left - PAD, top: m.vis.top - PAD, right: m.vis.right + PAD, bottom: m.vis.bottom + PAD }, m.box) : null;
  ring.hidden = !r;
  if (r) Object.assign(ring.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.right - r.left}px`, height: `${r.bottom - r.top}px` });
  if (view.dock) {
    // docked by the player in a bottom corner, out of the way of whatever is lit
    Object.assign(card.style, { transform: '', top: 'auto', bottom: '52px', left: view.dock === 'left' ? '12px' : 'auto', right: view.dock === 'right' ? '12px' : 'auto' });
  } else if (!r) {
    card.style.cssText = 'left:50%;top:40%;transform:translate(-50%,-50%)';
  } else {
    // the card sits beside the target so it never covers the icons under it; below or above when there is no room at the side
    Object.assign(card.style, { transform: '', bottom: 'auto', right: 'auto' });
    if (r.right + 18 + card.offsetWidth < innerWidth) {
      card.style.left = `${r.right + 18}px`;
      card.style.top = `${Math.min(Math.max(8, r.top), innerHeight - card.offsetHeight - 8)}px`;
    } else {
      const below = r.bottom + 12 + card.offsetHeight < innerHeight;
      card.style.left = `${Math.min(Math.max(8, r.left), innerWidth - card.offsetWidth - 8)}px`;
      card.style.top = `${below ? r.bottom + 12 : Math.max(8, r.top - 12 - card.offsetHeight)}px`;
    }
  }
  raf = requestAnimationFrame(place); // follows the target while its window is dragged
}

/// Shows { target, title, text } or hides on null. The screen is dimmed a little by a steady shadow around
/// the ring (only the border pulses), and the ring ignores the mouse, so the player clicks the real control.
export function spotlight(next) {
  cancelAnimationFrame(raf);
  step = next;
  scrolled = false;
  root.innerHTML = '';
  root.classList.toggle('hidden', !next);
  if (!next) return;
  root.innerHTML = `
    <div data-ring class="pointer-events-none absolute rounded-md" style="box-shadow:0 0 0 9999px rgb(0 0 0 / .3)">
      <i class="absolute inset-0 animate-pulse rounded-md ring-2 ring-accent"></i></div>
    <aside data-card class="pointer-events-auto absolute w-72 rounded-md border border-accent/60 bg-panel p-3 shadow-xl">
      <div class="flex items-start gap-1"><h3 class="flex-1 text-xs font-bold tracking-widest text-accent"></h3>
        <button data-act="follow" title="Follow what is lit again." class="grid h-5 w-5 place-items-center rounded text-xs hover:bg-white/10">&#9678;</button>
        <button data-act="side" title="Move this window to the other corner." class="grid h-5 w-5 place-items-center rounded text-xs hover:bg-white/10"></button>
        <button data-act="min" title="Tuck this window away." class="grid h-5 w-5 place-items-center rounded text-xs hover:bg-white/10"></button></div>
      <div data-body><p class="mt-1 text-xs leading-relaxed text-ink"></p>
        <div class="mt-2 h-1 bg-track"><div data-progress class="h-1 bg-accent"></div></div></div>
    </aside>`;
  root.querySelector('h3').textContent = next.title ?? '';
  root.querySelector('p').textContent = next.text ?? '';
  root.querySelector('[data-progress]').style.width = `${Math.round((next.progress ?? 0) * 100)}%`;
  paint();
  place();
}

/// What the player has done to the card: tucked it away (title bar only) or docked it in a bottom corner.
const view = { min: false, dock: null };

/// Shows the card's buttons and body as the player left them.
function paint() {
  const card = root.querySelector('[data-card]');
  if (!card) return;
  card.querySelector('[data-body]').hidden = view.min;
  card.querySelector('[data-act="min"]').innerHTML = view.min ? '&#9650;' : '&#9660;';
  card.querySelector('[data-act="side"]').innerHTML = view.dock === 'left' ? '&#9654;' : '&#9664;';
  card.querySelector('[data-act="follow"]').hidden = !view.dock;
}

root.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'min') view.min = !view.min;
  // the first press docks it at the left (where it was probably in the way), then it flips between the two corners
  else if (act === 'side') view.dock = view.dock === 'left' ? 'right' : 'left';
  else if (act === 'follow') view.dock = null;
  paint();
  place();
});
