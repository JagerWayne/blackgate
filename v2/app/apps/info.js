import { TOPICS } from './infoText.js';
import { esc, autoRender } from '../ui.js';

// the manual as data: [group, id, title, [html...]]; the plain text of each is kept for the search box
const PAGES = TOPICS.map(([group, id, title, parts]) => {
  const html = parts.join('');
  const text = `${title} ${html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#96;/g, '`').replace(/&[a-z]+;/g, ' ')}`.toLowerCase();
  return { group, id, title, html, text };
});

/// Info: how to play and what every window does. The topic list is on the left with a search box, the picked topic
/// on the right. The picked topic and the search are kept in state.win.info.
export function mountInfo(body, state) {
  const view = () => (state.win.info ??= { topic: PAGES[0].id, q: '' });
  const hits = () => {
    const q = view().q.trim().toLowerCase();
    return q ? PAGES.filter((pg) => q.split(/\s+/).every((w) => pg.text.includes(w))) : PAGES;
  };
  const render = () => {
    const v = view();
    const list = hits();
    const page = PAGES.find((pg) => pg.id === v.topic) ?? PAGES[0];
    const at = PAGES.indexOf(page);
    let group = '';
    const nav = list.map((pg) => {
      const head = pg.group === group ? '' : `<div class="px-3 pb-1 pt-3 text-[10px] tracking-widest text-dim">${pg.group}</div>`;
      group = pg.group;
      return `${head}<button data-topic="${pg.id}" class="block w-full truncate px-3 py-1.5 text-left text-xs ${pg.id === page.id ? 'bg-accent/20 font-bold text-white' : 'text-ink/80 hover:bg-white/10'}">${esc(pg.title)}</button>`;
    }).join('') || '<div class="p-3 text-xs text-dim">Nothing matches that search.</div>';
    const step = (to, label) => (to ? `<button data-topic="${to.id}" class="rounded border border-line px-3 py-1.5 text-xs hover:bg-white/10">${label}</button>` : '<span></span>');
    body.innerHTML = `<div class="flex h-full">
      <aside class="flex w-56 shrink-0 flex-col border-r border-line bg-panel2">
        <div class="shrink-0 p-2"><input data-keep="q" data-q value="${esc(v.q)}" placeholder="Search the manual..." spellcheck="false" class="w-full rounded border border-line bg-deep px-2 py-1.5 text-xs text-white outline-none focus:border-accent" /></div>
        <div data-scroll="info.nav" class="min-h-0 flex-1 overflow-y-auto pb-2">${nav}</div>
      </aside>
      <article data-scroll="info.${page.id}" class="min-w-0 flex-1 select-text overflow-y-auto p-5 text-xs">
        <div class="text-[10px] tracking-widest text-dim">${page.group}</div>
        <h2 class="mb-3 text-xl font-bold text-white">${esc(page.title)}</h2>
        ${page.html}
        <div class="mt-6 flex justify-between border-t border-line pt-3">${step(PAGES[at - 1], `&larr; ${esc(PAGES[at - 1]?.title ?? '')}`)}${step(PAGES[at + 1], `${esc(PAGES[at + 1]?.title ?? '')} &rarr;`)}</div>
      </article></div>`;
  };
  const refresh = autoRender(body, () => JSON.stringify(view()), render);
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-topic]');
    if (t) { view().topic = t.dataset.topic; refresh(); }
  });
  body.addEventListener('input', (e) => {
    if (!e.target.matches('[data-q]')) return;
    const v = view();
    v.q = e.target.value;
    // a search that leaves the picked topic out moves to its first match
    const list = hits();
    if (list.length && !list.some((pg) => pg.id === v.topic)) v.topic = list[0].id;
    refresh();
  });
}
