import { graphNodes } from '../../game/state/hud.js';
import { taskError } from '../../game/systems/sessionTasks.js';
import { intelText, dossiers, spammed, knows, INTEL_FIELDS } from '../../game/state/intel.js';
import { hasSample } from '../../game/state/voice.js';
import { recordsKept, keepsRecord, recordText, RECORD_LABEL } from '../../game/state/gameState.js';
import { PEOPLE_ACTIONS, DOSSIER_SORTS, dossierOrder } from '../../pages/windows/people.js';
import { makeShell, shellRun, shellSync, shellGreet, shellComplete, promptOf } from '../../game/systems/shell.js';
import { portraitOf } from '../../pages/ui/portrait.js';
import { esc } from '../ui.js';

/// A person's portrait from their male or female folder (a grey rectangle when the file is missing, see main.js).
const face = (game, i, size) => `<img src="${esc(String(portraitOf(game, i)).replace(/^\.\/data\//, '/'))}" alt="" class="shrink-0 rounded bg-[#9aa3ad] object-cover ${size}" />`;

// HTML for the Bl@ckG@te tabs that were drawn on the canvas by windows/{network,people,sessionTabs,cli}.js.
// Buttons use data-act="send" data-id=<canvas id>, which blackgate.js sends through the game's click handler.
const btn = 'rounded border border-line px-2 py-0.5 text-[11px] enabled:hover:bg-white/10 disabled:opacity-30';
const primary = 'rounded bg-accent px-2 py-0.5 text-[11px] font-bold text-bg enabled:hover:brightness-110 disabled:opacity-30';
const send = (id, text, cls = btn, off = false, tut = '') => `<button data-act="send" data-id="${id}" ${tut ? `data-tutorial="${tut}"` : ''} ${off ? 'disabled' : ''} class="${cls}">${text}</button>`;
const note = (t, tone = 'text-ink/50') => `<p class="p-3 text-xs ${tone}">${esc(t)}</p>`;

// -- Company Map ----------------------------------------------------------------
export function networkHtml(game) {
  const s = game.session;
  const nodes = s && s.phase === 'online' ? graphNodes(game, s) : null;
  if (!s) return note('link to a company host to see its network');
  if (nodes === null) return note('install the Company Map program (App Store) to draw the network');
  const why = taskError(game, s, 'MapNetwork');
  const rows = nodes.map((n) => {
    const reason = n.here ? '' : taskError(game, s, 'ForgeTicket', n.id) ?? '';
    return `<tr class="border-t border-line ${n.here ? 'bg-accent/10' : ''}"><td class="px-3 py-2"><b class="${n.here ? 'text-accent' : 'text-white'}">${esc(n.name)}</b>
      <div class="text-[10px] ${n.internal ? 'text-amber-300' : 'text-ink/50'}">${n.internal ? 'INTERNAL SEGMENT' : 'FRONT'} // DIFFICULTY ${n.difficulty}${n.here ? ' // YOU ARE HERE' : ''}</div>
      ${reason ? `<div class="text-[10px] text-amber-300">${esc(reason)}</div>` : ''}</td><td class="px-3 text-right text-ink/60">${esc(n.ip)}</td>
      <td class="px-3 text-right">${n.here ? '' : send(`net.forge.${n.id}`, 'FORGE', btn, !!reason)}</td></tr>`;
  }).join('');
  return `<div class="flex h-full flex-col"><div class="flex shrink-0 items-center gap-3 border-b border-line p-2 text-xs">${send('net.map', 'MAP NETWORK', primary, !!why)}<span class="text-ink/50">${nodes.length} segments on your map</span></div>
    <div data-scroll="net" class="min-h-0 flex-1 overflow-y-auto"><table class="w-full text-xs"><tbody>${rows || '<tr><td class="p-3 text-ink/40">no segment of this company is on your map</td></tr>'}</tbody></table></div></div>`;
}

// -- people and dossiers -----------------------------------------------------------
const tagsOf = (game, i) => {
  const it = game.intel?.[i] ?? {};
  return [it.level && `OSINT ${it.level}/4`, hasSample(game, i) && 'VOICE', it.tapped && 'TAPPED', it.inbox && 'INBOX HACKED', it.phishAt !== undefined && 'PHISH SENT', spammed(game, i) && 'SPAMMED'].filter(Boolean);
};
const known = (game, i) => INTEL_FIELDS.filter((f) => knows(game, i, f.field)).length / INTEL_FIELDS.length;

function personRow(game, i, sel, which) {
  const p = game.world.people[i];
  const tags = tagsOf(game, i).join(' // ');
  return `<button data-act="ppick" data-who="${i}" data-w="${which}" class="flex w-full items-start gap-2 border-t border-line px-3 py-2 text-left text-xs ${i === sel ? 'bg-accent/20' : 'hover:bg-white/5'}">${face(game, i, 'h-10 w-10')}<span class="min-w-0 flex-1">
    <span class="flex justify-between"><b class="text-white">${esc(p.name)}</b><span class="text-ink/50">ACCESS ${p.clearance}</span></span>
    <span class="block truncate text-[10px] text-ink/50">${esc(intelText(game, i, 'role'))} // ${esc(game.world.companies[p.company]?.name ?? '')}</span>
    <span class="flex justify-between text-[10px]"><span class="truncate text-ink/70">${esc(intelText(game, i, 'email'))}</span><span class="${tags ? 'text-emerald-400' : 'text-ink/40'}">${tags || 'LEAD'}</span></span></span></button>`;
}

function card(game, i, view, which) {
  const p = game.world.people[i];
  const co = game.world.companies[p.company]?.name ?? 'their company';
  const s = game.session;
  const tab = Math.min(view.dTab ?? 0, 2);
  const k = known(game, i);
  let inner;
  if (tab === 0) {
    inner = INTEL_FIELDS.map((f) => { const v = intelText(game, i, f.field); return `<div class="flex justify-between gap-4 border-b border-line/50 py-1"><span class="text-ink/50">${esc(f.label)}</span><b class="${v === '???' ? 'text-ink/40' : 'text-white'}">${esc(v)}</b></div>`; }).join('')
      + `<div class="flex flex-wrap gap-1 pt-2">${tagsOf(game, i).map((t) => `<span class="rounded bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-300">${t}</span>`).join('')}</div>`;
  } else if (tab === 1) {
    const hostCo = s?.phase === 'online' ? game.world.hosts[s.target]?.company : null;
    const here = hostCo != null && hostCo === p.company;
    inner = `${here ? '' : `<p class="pb-2 text-amber-300">link to a host of ${esc(co)} to work on them</p>`}`
      + PEOPLE_ACTIONS.map((a) => { const why = here ? taskError(game, s, a.kind, i) : 'not linked'; return `<div class="pb-2">${send(`ppl.${a.kind}.${i}`, a.text, btn, !!why)}<div class="${here && why ? 'text-amber-300' : 'text-ink/50'} text-[11px]">${esc(here && why ? `${a.gets} // ${why}` : a.gets)}</div></div>`; }).join('')
      + (which === 'dos' ? (() => { const sure = view.armed === `dos.del.${i}`; return `<h3 class="pt-2 text-[10px] tracking-widest text-ink/50">FILE</h3>${send(`dos.del.${i}`, sure ? 'CONFIRM: REMOVE' : 'REMOVE FROM DOSSIERS', sure ? 'rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white' : btn)}<div class="text-[11px] ${sure ? 'text-red-300' : 'text-ink/50'}">${sure ? 'everything you know about them goes // click again' : 'forget this person: what you found goes, they can be found again'}</div>`; })() : '');
  } else {
    const jobs = game.contracts.filter((c) => game.world.hosts[c.target]?.company === p.company && ['offered', 'accepted', 'ready'].includes(c.state));
    inner = `<h3 class="pb-1 text-[10px] tracking-widest text-ink/50">JOBS ABOUT ${esc(co.toUpperCase())}</h3>${jobs.map((c) => `<div class="flex justify-between border-b border-line/50 py-1"><span class="text-ink/50">#${c.id} ${esc(String(c.kind).toUpperCase())}</span><b class="${c.state === 'offered' ? 'text-amber-300' : 'text-emerald-400'}">${c.state.toUpperCase()} // ${c.reward} cr</b></div>`).join('') || '<p class="text-ink/50">no job in hand or on offer involves this company</p>'}`;
  }
  return `<div class="flex h-full flex-col p-3 text-xs"><div class="flex shrink-0 gap-3">${face(game, i, 'h-20 w-16')}
    <div class="min-w-0"><b class="block truncate text-base text-white">${esc(p.name)}</b><div class="truncate text-ink/50">${esc(intelText(game, i, 'role'))} // ${esc(co)}</div>
      <div class="mt-1"><span class="rounded bg-accent/20 px-2 py-0.5 text-accent">ACCESS ${p.clearance}</span> <span class="text-ink/50">${Math.round(k * 100)}% KNOWN</span></div>
      <div class="mt-1 h-1.5 w-40 rounded bg-track"><div class="h-1.5 rounded bg-emerald-400" style="width:${Math.round(k * 100)}%"></div></div></div></div>
    <div class="mt-3 flex shrink-0 gap-1">${['DETAILS', 'ACTIONS', 'JOBS'].map((n, t) => send(`pcard.${which}.${t}`, n, t === tab ? primary : btn)).join('')}</div>
    <div data-scroll="pcard.${which}.${tab}" class="mt-2 min-h-0 flex-1 overflow-y-auto">${inner}</div></div>`;
}

function split(game, order, view, which, head, empty) {
  if (!order.includes(view.pplSel)) view.pplSel = order[0] ?? null;
  return `<div class="flex h-full flex-col">${head}<div class="grid min-h-0 flex-1 grid-cols-[2fr_3fr]"><div data-scroll="plist.${which}" class="overflow-y-auto border-r border-line">${order.map((i) => personRow(game, i, view.pplSel, which)).join('') || note(empty)}</div>
    <div class="min-h-0">${view.pplSel === null ? '' : card(game, view.pplSel, view, which)}</div></div></div>`;
}

/// PEOPLE tab of a live link: the staff of the linked company. `view` is state.win.blackgate.
export function peopleHtml(game, view) {
  const h = game.world.hosts[game.session.target];
  const order = game.world.people.map((p, i) => i).filter((i) => game.world.people[i].company === h.company);
  return split(game, order, view, 'sess', `<div class="shrink-0 px-3 py-2 text-[11px] text-ink/50">STAFF OF ${esc((game.world.companies[h.company]?.name ?? 'THIS HOST').toUpperCase())} // PROFILE them, then go after their phones and inboxes</div>`, 'nobody works here');
}

/// DOSSIERS tab: everyone on file. `view` is state.win.dossiers.
export function dossiersHtml(game, view) {
  const all = dossiers(game);
  const order = dossierOrder(game, view.q ?? '', view.sort ?? 'recent');
  const head = `<div class="flex shrink-0 flex-wrap items-center gap-2 border-b border-line p-2 text-xs"><input data-keep="dos-q" data-field="dosq" value="${esc(view.q ?? '')}" placeholder="search name, company, role or email" class="w-64 rounded border border-line bg-bg px-2 py-1 outline-none focus:border-accent" />
    <span class="text-ink/50">SORT</span>${DOSSIER_SORTS.map(([k, n]) => send(`dos.sort.${k}`, n, k === (view.sort ?? 'recent') ? primary : btn)).join('')}<span class="ml-auto text-ink/50">${all.length} people on file</span></div>`;
  return split(game, order, view, 'dos', head, all.length ? 'nobody matches the search' : 'nobody on file // run an OSINT sweep, or PROFILE someone on a PEOPLE tab');
}

// -- RECORDS --------------------------------------------------------------------
export function recordsHtml(game, s, view) {
  const h = game.world.hosts[s.target];
  const kept = recordsKept(game, h);
  const open = h.services.some((v) => v.kind === 'records' && v.open);
  if (!kept.length) return note('this host keeps no records');
  if (!open) return note('records service locked // crack records:8443 on the ACCESS tab', 'text-amber-300');
  const jobs = game.contracts.filter((c) => c.kind === 'modify' && c.state === 'accepted' && c.target === s.target && c.record);
  const q = (view.recQuery ?? '').trim().toLowerCase();
  const isGoal = (i) => jobs.some((c) => c.record.person === i);
  const order = game.world.people.map((p, i) => i)
    .filter((i) => kept.some((f) => keepsRecord(game, h, i, f)) && (!q || `${game.world.people[i].name} ${game.world.people[i].ssn} ${game.world.people[i].role} ${game.world.companies[game.world.people[i].company]?.name ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => isGoal(b) - isGoal(a));
  view.recOrder = order;
  if (!order.includes(view.recSel)) view.recSel = order[0] ?? null;
  const shown = ['name', 'ssn', 'role', 'company'];
  const rows = order.map((i) => {
    const p = game.world.people[i];
    const job = jobs.find((c) => c.record.person === i);
    const why = job ? taskError(game, s, 'AlterRecord', job.record) ?? '' : '';
    const rest = kept.filter((f) => !shown.includes(f) && keepsRecord(game, h, i, f)).map((f) => `${RECORD_LABEL[f]} ${recordText(game, f, p[f])}`).join(' // ');
    return `<div data-act="rpick" data-who="${i}" class="cursor-default border-t border-line px-3 py-2 text-xs ${i === view.recSel ? 'bg-accent/20' : 'hover:bg-white/5'} ${job ? 'border-l-4 border-l-accent' : ''}">
      <div class="flex justify-between"><b class="text-white">${esc(p.name)}</b><span class="text-ink/50">${esc(p.ssn)}</span></div>
      <div class="truncate text-[10px] text-ink/50">${esc(p.role)} // ${esc(game.world.companies[p.company]?.name ?? '')}</div>
      <div class="truncate text-[10px] ${p.status === 'DECEASED' ? 'text-red-300' : 'text-amber-300'}">${esc(rest)}</div>
      ${job ? `<div class="mt-1 flex items-center gap-2">${send(`sess.alter.${job.id}`, `ALTER &rarr; ${esc(recordText(game, job.record.field, job.record.value))}`, primary, !!why)}<span class="text-[10px] text-amber-300">${esc(why)}</span></div>` : ''}</div>`;
  }).join('');
  const sel = view.recSel === null ? null : game.world.people[view.recSel];
  const detail = sel ? `<div class="pb-3">${face(game, view.recSel, 'h-36 w-32')}</div>` + ['name', 'sex', 'ssn', 'status', 'criminalRecord', 'company', 'role', 'clearance', 'email', 'social']
    .map((f) => `<div class="flex justify-between gap-4 border-b border-line/50 py-1"><span class="text-ink/50">${RECORD_LABEL[f]}</span><b class="${f === 'status' && sel.status === 'DECEASED' ? 'text-red-300' : 'text-white'}">${esc(recordText(game, f, sel[f]))}</b></div>`).join('') : '';
  return `<div class="flex h-full flex-col"><div class="shrink-0 border-b border-line p-2"><input data-keep="rec-q" data-field="recq" value="${esc(view.recQuery ?? '')}" placeholder="search name, SSN, role, employer" class="w-72 rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent" /></div>
    <div class="grid min-h-0 flex-1 grid-cols-[3fr_2fr]"><div data-scroll="rec" class="overflow-y-auto border-r border-line">${rows || note(q ? `nothing matches "${view.recQuery}"` : 'no records')}</div><div data-scroll="recp" class="overflow-y-auto p-3 text-xs">${detail}</div></div></div>`;
}

// -- CLI --------------------------------------------------------------------------
const TONE = { ok: 'text-emerald-400', err: 'text-red-400', info: 'text-amber-300', head: 'text-accent', dim: 'text-ink/40', dir: 'text-accent', plain: 'text-ink' };

/// The shell for this link (made once per link, in the window state); call each tick so link-log lines flow in.
export function shellOf(view, game, s) {
  if (!view.sh || view.sh.session !== s) view.sh = makeShell(s);
  if (!view.sh.greeted) shellGreet(game, view.sh);
  shellSync(view.sh);
  return view.sh;
}

export function cliHtml(game, s, view) {
  const sh = shellOf(view, game, s);
  const h = game.world.hosts[s.target];
  const line = (l) => (l.segs ? l.segs.map(([t, tone]) => `<span class="${TONE[tone] ?? TONE.plain}">${esc(t)}</span>`).join('') : `<span class="${TONE[l.tone] ?? TONE.plain}">${esc(l.text)}</span>`);
  return `<div class="flex h-full flex-col bg-deep font-mono text-xs"><div class="flex shrink-0 justify-between bg-panel2 px-2 py-1"><span class="text-emerald-400">&#9679; ROOTSHELL // ${esc(h.name)} (${esc(h.ip)})</span>
      <span class="${s.trace > 0.6 ? 'text-red-400' : 'text-ink/50'}">TRACE ${Math.round(s.trace * 100)}%   TASKS ${s.tasks.length}   HEAT ${Math.round(game.player.heat)}%</span></div>
    <div data-scroll="cli" data-pin class="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-all px-2 py-1">${sh.lines.map((l) => `<div>${line(l) || '&nbsp;'}</div>`).join('')}</div>
    <label class="flex shrink-0 gap-1 border-t border-line px-2 py-1">${promptOf(game, sh).map(([t, tone]) => `<span class="whitespace-pre ${TONE[tone] ?? TONE.plain}">${esc(t)}</span>`).join('')}<input data-keep="cli-in" data-field="cli" value="${esc(sh.input)}" autocomplete="off" spellcheck="false" class="min-w-0 flex-1 bg-transparent outline-none" /></label></div>`;
}

/// A key in the CLI line: Enter runs it, Tab completes, Up and Down walk the history. Returns true when it changed the shell.
export function cliKey(e, game, sh, input) {
  if (e.key === 'Enter') {
    if (input.value.trim()) shellRun(game, sh, input.value);
    sh.input = '';
    sh.at = -1;
  } else if (e.key === 'Tab') {
    const { line, hits } = shellComplete(game, sh, input.value);
    sh.input = line;
    if (hits.length) sh.lines.push({ text: hits.join('   '), tone: 'info' });
  } else if (e.key === 'ArrowUp' && sh.history.length) {
    sh.at = sh.at < 0 ? sh.history.length - 1 : Math.max(sh.at - 1, 0);
    sh.input = sh.history[sh.at];
  } else if (e.key === 'ArrowDown' && sh.at >= 0) {
    sh.at += 1;
    sh.input = sh.at < sh.history.length ? sh.history[sh.at] : '';
    if (sh.at >= sh.history.length) sh.at = -1;
  } else if (e.key === 'Escape') sh.input = '';
  else return false;
  e.preventDefault();
  return true;
}

// -- running tasks ----------------------------------------------------------------
export function tasksHtml(s) {
  if (!s.tasks.length) return '';
  return `<div class="pointer-events-auto absolute bottom-24 right-3 z-10 w-72 rounded border border-accent/60 bg-panel p-2 text-[11px] shadow-xl"><div class="mb-1 text-[10px] tracking-widest text-accent">RUNNING TASKS</div>
    ${s.tasks.slice(0, 4).map((t) => { const p = Math.round(Math.min(Math.max(t.progress, 0), 1) * 100); return `<div class="mb-1"><div class="flex justify-between"><span class="truncate ${t.queued ? 'text-ink/50' : 'text-white'}">${esc(t.label)}</span><span class="${t.queued ? 'text-amber-300' : 'text-accent'}">${t.queued ? 'WAITING' : `${p}%`}</span></div><div class="h-1.5 rounded bg-track"><div class="h-1.5 rounded bg-accent" style="width:${t.queued ? 0 : p}%"></div></div></div>`; }).join('')}</div>`;
}
