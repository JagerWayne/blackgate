import { targetsFor } from '../../game/state/contractTarget.js';
import { jobFiles } from '../../game/state/contractSpawn.js';
import { recordsKept, keepsRecord, recordText, RECORD_LABEL } from '../../game/state/gameState.js';
import { esc, click, edit, toggle, select, autoRender } from '../ui.js';

// The kinds the builder posts: their names on the market, and what each asks.
const KINDS = [
  ['retrieve', 'DATA HEIST', 'copy a file off the host and bring it home to your gateway'],
  ['delete', 'SCRUBBERS', 'erase one file from the host, so it never existed'],
  ['destroy', 'BURN BOOK', 'wipe the host: every file and every log on it'],
  ['modify', 'PAPERWORK', "rewrite one detail in a person's record: a death, a pardon, a promotion"],
  ['transfer', 'MONEY MOVES', 'move funds out of an account on a bank host'],
  ['model', 'MIND THEFT', 'steal a trained AI model off a lab host'],
];
const HOURS = [0, 6, 24, 72, 168];
const hoursText = (h) => (!h ? 'USUAL' : h < 24 ? `${h}H` : `${h / 24} DAY${h > 24 ? 'S' : ''}`);
const isSet = (v) => v !== undefined && v !== null;
const btn = (id, text, on = false, off = false) => `<button data-id="${id}" ${off ? 'disabled' : ''} class="rounded px-3 py-1 text-[11px] font-bold disabled:opacity-30 ${on ? 'bg-accent text-bg' : 'border border-line enabled:hover:bg-white/10'}">${text}</button>`;
const sec = (t) => `<h3 class="pb-1 pt-4 text-[10px] tracking-widest text-ink/50">${t}</h3>`;
const note = (t, tone = 'text-ink/50') => `<p class="py-1 text-[11px] ${tone}">${esc(t)}</p>`;
const kv = (k, v, set) => `<div class="flex justify-between gap-4 border-b border-line/50 py-1"><span class="text-ink/50">${k}</span><b class="${set ? 'text-accent' : 'text-ink/50'}">${esc(v)}</b></div>`;
const row = (...x) => `<div class="flex flex-wrap gap-2 py-1">${x.join('')}</div>`;
const input = (field, value, hint) => `<input data-keep="mg-${field}" data-field="mg.${field}" value="${esc(value ?? '')}" placeholder="${esc(hint)}" class="my-1 w-full rounded border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent" />`;

/// Mission Builder: the cheat window that builds a job to order. State is state.win.missions, the same as
/// the canvas builder; every button and field sends its mg.* event to the game's own handler, which posts the job.
export function mountMissions(body, state) {
  const V = () => (state.win.missions ??= {});

  /// The picker's rows: hosts that fit the kind, files a job could name, or people the host keeps a detail of.
  function items(game, view, kind, h) {
    const q = (view.search ?? '').trim().toLowerCase();
    const has = (text) => !q || text.toLowerCase().includes(q);
    const co = (i) => game.world.companies[i]?.name ?? 'INDEPENDENT';
    if (view.pick === 'host') {
      return targetsFor(game, kind, { anyGuard: true }).map((id) => game.world.hosts[id]).filter((x) => has(`${x.name} ${x.ip} ${co(x.company)}`))
        .map((x) => [x.id, x.name, x.ip, `${co(x.company)} // FW ${x.firewall} / MON ${x.monitor} / PX ${x.proxy}`]);
    }
    if (view.pick === 'file') {
      return jobFiles(game, h, kind).map((i) => h.files[i]).filter((f) => has(f.name)).map((f) => [f.name, f.name, `${f.size} GB`, f.enc > 0 ? `ENCRYPTED v${f.enc}` : 'PLAINTEXT']);
    }
    return game.world.people.map((x, i) => [x, i]).filter(([, i]) => recordsKept(game, h).some((f) => keepsRecord(game, h, i, f)))
      .filter(([x]) => has(`${x.name} ${x.ssn} ${x.role} ${co(x.company)}`)).map(([x, i]) => [i, x.name, x.ssn, `${x.role} // ${co(x.company)}`]);
  }

  function form(game, view, kind, h, p) {
    const c = [sec('KIND'), row(...KINDS.map(([k, t]) => btn(`mg.kind.${k}`, t, kind === k))), note(KINDS.find(([k]) => k === kind)?.[2] ?? ''),
      sec('TARGET'), kv('HOST', h ? `${h.name} // ${h.ip}` : 'RANDOM', !!h), row(btn('mg.pick.host', 'CHOOSE HOST', view.pick === 'host'), btn('mg.host.random', 'RANDOM')), sec('OBJECTIVE')];
    if (kind === 'retrieve' || kind === 'delete') {
      c.push(kv('FILE', view.file ?? 'RANDOM', !!view.file), row(btn('mg.pick.file', 'CHOOSE FILE', view.pick === 'file', !h), btn('mg.file.random', 'RANDOM')));
      if (!h) c.push(note('choose a host first to pick one of its files'));
    } else if (kind === 'destroy') c.push(note('every file and every log on the host'));
    else if (kind === 'transfer' || kind === 'model') c.push(note(kind === 'transfer' ? 'the account and the amount are set by the job' : 'the model file is set by the job'));
    else {
      c.push(kv('PERSON', p ? p.name : 'RANDOM', !!p), row(btn('mg.pick.person', 'CHOOSE PERSON', view.pick === 'person', !h), btn('mg.person.random', 'RANDOM')));
      if (h && p) {
        const fields = recordsKept(game, h).filter((f) => keepsRecord(game, h, view.person, f));
        c.push(row(...fields.map((f) => btn(`mg.field.${f}`, RECORD_LABEL[f], view.field === f))));
        if (view.field) c.push(kv('NOW', recordText(game, view.field, p[view.field]), false), input('value', view.value, view.field === 'company' ? 'the new employer, by name' : 'the new value'));
        else c.push(note('pick a detail, or leave it for a random change'));
      } else c.push(note('choose a host and a person to set the exact change'));
    }
    c.push(sec('TERMS'), input('reward', view.reward, 'payout in credits, blank for the usual'), row(...HOURS.map((n) => btn(`mg.hours.${n}`, hoursText(n), (view.hours ?? 0) === n))), input('client', view.client, 'client, blank for a random one'),
      sec('BRIEF'), input('brief', view.brief, 'custom brief, blank for a random one'), note('{file} {host} {co} are filled in and highlighted'),
      `<label class="flex items-center gap-2 py-1 text-xs"><input type="checkbox" data-check="mg.accept" ${view.accept ? 'checked' : ''} />Accept straight away</label>`,
      row(btn('mg.spawn', 'SPAWN MISSION', true), btn('mg.reset', 'RESET')));
    if (view.msg) c.push(note(view.msg, view.ok ? 'text-emerald-400' : 'text-amber-300'));
    return c.join('');
  }

  function picker(game, view, kind, h) {
    if (!view.pick || (view.pick !== 'host' && !h)) return note('CHOOSE HOST, FILE or PERSON to pick from a list');
    const list = items(game, view, kind, h);
    view.pickOrder = list.map(([v]) => v);
    const now = { host: view.host, file: view.file, person: view.person }[view.pick];
    const rows = list.map(([v, a, b, line], i) => `<button data-pick="${i}" class="block w-full border-t border-line px-3 py-2 text-left text-xs ${v === now ? 'bg-accent/20' : 'hover:bg-white/5'}"><span class="flex justify-between"><b class="text-white">${esc(a)}</b><span class="text-ink/50">${esc(b)}</span></span><span class="block truncate text-[10px] text-ink/50">${esc(line)}</span></button>`).join('');
    return `<div class="p-2">${input('search', view.search, 'search')}</div><div data-scroll="mg-list" class="min-h-0 flex-1 overflow-y-auto">${rows || note((view.search ?? '').trim() ? `nothing matches "${view.search}"` : 'nothing to pick here')}</div>`;
  }

  function render() {
    const game = state.game;
    const view = V();
    const kind = view.kind ?? 'retrieve';
    const h = isSet(view.host) ? game.world.hosts[view.host] : null;
    const p = isSet(view.person) ? game.world.people[view.person] : null;
    body.innerHTML = `<div class="flex h-full flex-col"><p class="shrink-0 border-b border-line px-4 py-2 text-[11px] text-ink/50">build a job to order and post it to the board</p>
      <div class="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr]"><div data-scroll="mg-form" class="overflow-y-auto px-4 pb-4 text-xs">${form(game, view, kind, h, p)}</div><div class="flex min-h-0 flex-col border-l border-line">${picker(game, view, kind, h)}</div></div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    const { pickOrder, ...rest } = V(); // pickOrder is what render() writes, so it must not trigger a redraw
    return JSON.stringify([rest, g.world.hosts.reduce((n, x) => n + (x.discovered ? 1 : 0), 0), g.contracts.length]);
  }, render);

  body.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { select(state, 'mg.list', Number(pick.dataset.pick)); refresh(); return; }
    const x = e.target.closest('[data-id]');
    if (x && !x.disabled) { click(state, x.dataset.id); refresh(); }
  });
  body.addEventListener('input', (e) => { const f = e.target.dataset.field; if (f) { edit(state, f, e.target.value); if (f === 'mg.search') refresh(); } });
  body.addEventListener('change', (e) => { if (e.target.dataset.check) { toggle(state, e.target.dataset.check, e.target.checked); refresh(); } });
}
