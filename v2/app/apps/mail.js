import { contractLabel } from '../../game/state/contracts.js';
import { hhmm } from '../../game/core/clock.js';
import { esc, click, autoRender } from '../ui.js';

const FOLDERS = [
  ['INBOX', 'Inbox', () => true],
  ['UNREAD', 'Unread', (m) => !m.read],
  ['JOBS', 'Job offers', (m) => !!m.contract],
];
const TABS = [['mail', 'Inbox'], ['news', 'News']];
const btn = 'rounded border border-line px-2 py-0.5 text-[11px] enabled:hover:bg-white/10 disabled:opacity-30';
const dayOf = (m) => Math.floor(m / 1440) + 1;
const clockOf = (m) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/// Outlook: the inbox and the newswire as two tabs. State stays in state.win.mail ({suite, mailFolder,
/// mailSel}) like the canvas window; MARK ALL READ and OPEN LINK go through the game's click handler.
export function mountMail(body, state) {
  const view = () => (state.win.mail ??= {});
  const send = (id) => { click(state, id); refresh(); };

  function inboxHtml(game) {
    const v = view();
    const unread = game.mail.filter((m) => !m.read).length;
    const all = game.mail.slice().sort((a, b) => b.minute - a.minute);
    const folder = FOLDERS.find((f) => f[0] === v.mailFolder) ?? FOLDERS[0];
    const mails = all.filter(folder[2]);
    // the reader opens on the newest message of the folder
    if (!mails.some((m) => m.id === v.mailSel)) v.mailSel = mails.length ? mails[0].id : null;
    const m = mails.find((x) => x.id === v.mailSel);
    if (m) m.read = true;
    const contract = m?.contract ? game.contracts.find((c) => c.id === m.contract) : null;
    const rows = mails.map((mm) => {
      const job = mm.contract ? game.contracts.find((c) => c.id === mm.contract) : null;
      return `<li><button data-act="pick" data-id="${mm.id}" class="block w-full border-t border-line px-3 py-2 text-left ${mm.id === v.mailSel ? 'bg-accent/20' : 'hover:bg-white/5'}">
        <span class="flex justify-between gap-2"><b class="${mm.read ? 'font-normal text-ink/60' : 'text-ink'}">${esc(mm.from.split('<')[0].trim())}</b><span class="text-[10px] text-ink/40">DAY ${dayOf(mm.minute)} ${clockOf(mm.minute)}</span></span>
        <span class="block truncate ${mm.read ? '' : 'text-accent'}">${esc(mm.subject)}</span>
        <span class="block truncate text-[10px] ${job ? 'text-amber-300' : 'text-ink/40'}">${job ? `JOB // ${job.state.toUpperCase()}` : esc(mm.body.replace(/\s+/g, ' ').slice(0, 70))}</span></button></li>`;
    }).join('');
    const reader = m ? `<div class="space-y-3 p-4"><h2 class="text-base font-bold">${esc(m.subject)}</h2>
      <div class="flex items-center gap-3"><i class="grid h-9 w-9 place-items-center rounded-full bg-accent font-bold text-bg not-italic">${esc((m.from[0] ?? '?').toUpperCase())}</i><div><b>${esc(m.from.split('<')[0].trim())}</b><div class="text-[10px] text-ink/50">${esc(m.from)} // DAY ${dayOf(m.minute)} ${clockOf(m.minute)}</div></div></div>
      <p class="whitespace-pre-wrap border-t border-line pt-3 text-ink/80 select-text">${esc(m.body)}</p>
      ${contract ? `<section class="space-y-1 rounded border border-line bg-bg/60 p-3"><h3 class="text-[10px] tracking-widest text-ink/50">ATTACHED JOB</h3>
        <div>JOB <b class="text-accent">${esc(contractLabel(contract))}</b></div><div>PAYMENT <b class="text-amber-300">${contract.reward} cr</b></div><div>STATE ${esc(contract.state.toUpperCase())}</div>
        <button data-act="send" data-id="mail.open.${contract.id}" class="mt-1 rounded bg-accent px-3 py-1 font-bold text-bg">OPEN LINK</button></section>` : ''}</div>`
      : '<p class="p-6 text-ink/40">select a message to read it</p>';
    return `<div class="flex h-full flex-col"><div class="flex shrink-0 items-center gap-2 border-b border-line px-2 py-1.5 text-xs"><button data-act="send" data-id="mail.readAll" ${unread ? '' : 'disabled'} class="${btn}">MARK ALL READ</button>
      <span class="ml-auto text-ink/50">${unread} unread // ${game.mail.length} messages</span></div>
      <div class="grid min-h-0 flex-1 grid-cols-[9rem_18rem_1fr]">
        <nav class="border-r border-line py-1">${FOLDERS.map(([k, n, test]) => `<button data-act="folder" data-key="${k}" class="flex w-full justify-between border-l-2 px-3 py-1.5 text-xs ${k === folder[0] ? 'border-accent bg-accent/15' : 'border-transparent text-ink/70 hover:bg-white/5'}"><span>${n}</span><span class="${k === 'UNREAD' && unread ? 'text-accent' : 'text-ink/40'}">${k === 'UNREAD' ? unread : all.filter(test).length}</span></button>`).join('')}</nav>
        <ul data-scroll="maillist" class="overflow-y-auto border-r border-line">${rows || `<li class="p-3 text-ink/40">${folder[0] === 'INBOX' ? 'no mail' : 'nothing in this folder'}</li>`}</ul>
        <div data-scroll="mailread" class="overflow-y-auto">${reader}</div></div></div>`;
  }

  function newsHtml(game) {
    const last = game.news[game.news.length - 1];
    const rows = game.news.slice().reverse().map((n) => `<li class="border-t border-line px-3 py-2"><div class="flex justify-between gap-3"><b>${esc(n.headline)}</b><span class="shrink-0 text-ink/40">${hhmm({ minutes: n.minute })}</span></div><p class="text-ink/60">${esc(n.body)}</p></li>`).join('');
    return `<div class="flex h-full flex-col"><div class="shrink-0 bg-bg px-3 py-1.5 text-[11px]"><b class="mr-3 text-amber-300">LIVE</b>${esc(last ? last.headline : 'the wire is quiet')}</div>
      <ul data-scroll="news" class="min-h-0 flex-1 overflow-y-auto text-xs">${rows || '<li class="p-3 text-ink/40">the wire is quiet</li>'}</ul></div>`;
  }

  function render() {
    const game = state.game;
    const v = view();
    if (!TABS.some(([k]) => k === v.suite)) v.suite = 'mail';
    body.innerHTML = `<div class="flex h-full flex-col"><nav class="flex shrink-0 border-b border-line">${TABS.map(([k, n]) => `<button data-act="tab" data-key="${k}" class="px-4 py-2 text-xs font-bold ${k === v.suite ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${n}</button>`).join('')}</nav>
      <div class="min-h-0 flex-1">${v.suite === 'news' ? newsHtml(game) : inboxHtml(game)}</div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    const v = view();
    return JSON.stringify([v.suite, v.mailFolder, v.mailSel, g.mail.map((m) => [m.id, m.read ? 1 : 0]), g.contracts.map((c) => c.state), g.news.length]);
  }, render);

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const d = b.dataset;
    if (d.act === 'send') send(d.id);
    else if (d.act === 'tab') { view().suite = d.key; refresh(); }
    else if (d.act === 'folder') { view().mailFolder = d.key; refresh(); }
    else if (d.act === 'pick') { view().mailSel = Number(d.id); refresh(); }
  });
}
