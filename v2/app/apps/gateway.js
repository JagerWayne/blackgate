import * as gw from '../../game/state/gateway.js';
import { componentDef, boardDef, chassisDef, forms } from '../../game/data/content.js';
import { relocateError } from '../../game/systems/physical.js';
import { keepReason, slotBlock, transferMinutes, stockPlan } from '../../game/state/economy.js';
import { buildOf, buildStage, buildLeft, kitMissing, kitMinutes, buildBoardBlock, buildPartBlock, migrationPlan } from '../../game/state/build.js';
import { metrics } from '../../pages/windows/gateway.js';
import { GROUPS, slotId } from '../../pages/windows/gatewayBoard.js';
import { partStat, kindName, stockEntries } from '../../pages/windows/gatewayShop.js';
import { changeText } from '../../pages/windows/gatewaySlot.js';
import { esc, click, autoRender } from '../ui.js';
import { t as tl } from '../../game/data/language.js';

const TIER = ['#8a97a6', '#4fc27a', '#3f9bf0', '#9a6ae6', '#f0953a', '#e0524f', '#f2cb4c'];
const tier = (l) => TIER[(Math.max(l, 1) - 1) % TIER.length];
const gb = (n) => (n >= 1024 ? `${Math.round(n / 102.4) / 10} TB` : `${n} GB`);
const KINDS = ['cpu', 'accel', 'fpga', 'hsm', 'storage', 'modem', 'security'];
const SORTS = ['VALUE', 'TIER', 'KIND'];
const TONE = { ok: 'text-emerald-400', warn: 'text-amber-300', dim: 'text-ink/50', danger: 'text-red-300', accent: 'text-accent' };

const bt = (id, text, { why = '', kind = 'ghost' } = {}) => `<button data-id="${id}" ${why ? `disabled title="${esc(why)}"` : ''} class="rounded px-3 py-1 text-[11px] font-bold disabled:opacity-30 ${kind === 'primary' ? 'bg-accent text-bg enabled:hover:brightness-110' : kind === 'danger' ? 'bg-red-600 text-white' : 'border border-line enabled:hover:bg-white/10'}">${text}</button>`;
const chip = (t, tone = 'ok') => `<span class="rounded px-2 py-0.5 text-[10px] font-bold ${tone === 'ok' ? 'bg-emerald-400/20 text-emerald-300' : tone === 'warn' ? 'bg-amber-300/20 text-amber-300' : 'bg-accent/20 text-accent'}">${t}</span>`;
const row = ({ title, right, sub, note, tone = 'warn', actions = [], mark = false }) => `<div class="flex items-center gap-3 border-t border-line px-3 py-2 text-xs ${mark ? 'border-l-4 border-l-red-400' : ''}">
  <div class="min-w-0 flex-1"><div class="flex justify-between gap-3"><b class="truncate text-white">${esc(title)}</b>${right ? `<span class="text-amber-300">${esc(right)}</span>` : ''}</div>
  ${sub ? `<div class="text-accent">${esc(sub)}</div>` : ''}${note ? `<div class="${TONE[tone]}">${esc(note)}</div>` : ''}</div><div class="flex shrink-0 gap-1">${actions.join('')}</div></div>`;

/// Device Manager: header, metric tiles, the motherboard, and SLOT / STOCK / BUILD. State is state.win.gateway
/// (slot, mode, tab, stk, bld, armed), the same the canvas window keeps, and every button sends its gw.* id
/// to the game's own handler, which owns the two-click arming of anything that sells or scraps.
export function mountGateway(body, state) {
  const V = () => (state.win.gateway ??= {});

  function board(game, rig) {
    const g = rig ?? game.player.gateway;
    const prefix = rig ? 'gw.bslot' : 'gw.slot';
    const sel = rig ? V().bld?.pick : V().slot;
    const groups = GROUPS.map((grp) => {
      const slots = gw.slotsFor(g, grp.kind);
      const cells = Array.from({ length: Math.max(slots, 1) }, (_, n) => {
        const part = gw.partsOf(g, grp.kind)[n];
        const locked = n >= slots;
        const on = sel?.kind === grp.kind && sel?.n === n;
        const name = locked ? 'NO SLOT' : part ? `${grp.kind === 'storage' ? `${gw.driveName(g, part)} // ` : ''}${part.name}` : 'EMPTY';
        return `<button data-id="${rig ? `${prefix}.${grp.kind}.${n}` : slotId(grp.kind, n)}" ${locked ? 'disabled' : ''} class="relative min-h-14 w-28 overflow-hidden rounded border px-2 pb-1 pt-4 text-left text-[10px] leading-tight ${on ? 'border-yellow-300 bg-yellow-300/15' : 'border-emerald-200/40 enabled:hover:bg-white/10'} ${locked ? 'bg-black/35 opacity-60' : 'bg-black/25'}">
          <i class="absolute left-1 top-0.5 not-italic text-emerald-100/70">${locked ? '' : `${grp.ref}${n + 1}`}</i>${part ? `<i class="absolute inset-y-0 left-0 w-1" style="background:${tier(part.level)}"></i>` : ''}
          <span class="${part ? 'text-white' : 'text-emerald-100/60'}">${esc(name)}</span></button>`;
      }).join('');
      return `<div><div class="pb-1 text-[10px] tracking-widest text-emerald-100/80">${grp.title}${slots ? '' : '  -  NONE'}</div><div class="flex flex-wrap gap-2">${cells}</div></div>`;
    }).join('');
    return `<div class="space-y-3 rounded border-2 border-yellow-600/70 bg-gradient-to-b from-[#15503b] to-[#0c3526] p-4">${groups}<div class="text-right text-[10px] text-emerald-100/40">${esc(gw.boardOf(g).name.toUpperCase())}</div></div>`;
  }

  function inspector(game) {
    const g = game.player.gateway;
    const v = V();
    const sel = v.slot;
    if (!sel) return '<div class="p-4 text-xs"><b class="text-sm text-white">NO SLOT PICKED</b><p class="mt-1 text-ink/50">Click a slot on the board. You can then fit a part from stock, replace what is in it, or take it out. Buy new parts on eForest; they arrive in STOCK.</p></div>';
    const { kind, n } = sel;
    const index = gw.slotIndex(g, kind, n);
    const part = g.parts[index];
    const def = part ? componentDef(kind, part.level) : null;
    const stocked = (game.player.stock ?? []).filter((s) => s.kind === kind).length;
    const keep = part ? keepReason(game, index) : '';
    const busy = gw.migrating(g, game.clock.minutes) ? 'the chassis is being reconfigured' : '';
    const sure = v.armed === 'gw.do.sell';
    const detail = [part ? `<b class="text-sm text-white">${esc(part.name)}</b>` : '<b class="text-sm text-ink/50">EMPTY // nothing fitted</b>',
      part?.fixed ? '<p class="text-amber-300">SOLDERED ON // part of the board</p>' : '',
      def ? `<p>${esc(partStat(def, kind))}</p>` : '',
      def && !def.onboard ? `<p class="text-amber-300">NEW PRICE ${def.price} cr <span class="text-ink/50">// SELLS FOR ABOUT ${Math.floor(def.price * 0.3)}-${Math.floor(def.price * 0.55)} cr</span></p>` : '',
      part && kind === 'storage' ? `<p class="text-accent">${esc(gw.driveName(g, part))} (${gw.sharedDrive(g) || gw.systemDrive(g) === part ? 'C:' : 'D:'})</p>` : ''].join('');
    const acts = part
      ? [bt('gw.do.store', 'STORE', { why: keep || busy }), bt('gw.do.sell', sure ? 'CONFIRM SELL' : 'SELL', { why: sure ? '' : keep || busy, kind: sure ? 'danger' : 'ghost' }),
        bt('gw.mode.stock', `REPLACE FROM STORAGE (${stocked})`, { why: part.fixed ? 'soldered to the board: it cannot be replaced' : stocked ? '' : 'nothing of this kind in storage', kind: v.mode === 'stock' ? 'primary' : 'ghost' })]
      : [bt('gw.eforest', 'BUY ON eFOREST'), bt('gw.mode.stock', `FIT FROM STORAGE (${stocked})`, { why: stocked ? '' : 'nothing of this kind in storage', kind: v.mode === 'stock' ? 'primary' : 'ghost' })];
    const msg = keep || (sure ? `sells ${part.name} for a share of its price, for good` : '');
    let list = '';
    if (v.mode === 'stock') {
      list = `<h3 class="px-3 pt-3 text-[10px] tracking-widest text-ink/50">STORAGE</h3>${(game.player.stock ?? []).map((s, i) => {
        if (s.kind !== kind) return '';
        const why = slotBlock(game, kind, s.level, index);
        const copy = kind === 'storage' && index >= 0 && gw.systemDrive(g) === g.parts[index];
        const change = why ? '' : changeText(kind, g.parts[index], s);
        return row({ title: s.name, right: `${s.value} cr`, sub: tl('apps.gateway.tier', s.level), note: why || (copy ? `copies the apps over // offline ${transferMinutes(game)} min` : change), tone: why ? 'warn' : copy ? 'warn' : 'ok', actions: [bt(`gw.do.stock.${i}`, index >= 0 ? 'SWAP IN' : 'FIT', { why, kind: 'primary' })] });
      }).join('') || '<p class="p-3 text-xs text-ink/50">nothing of this kind in storage</p>'}`;
    }
    return `<div class="p-3 text-xs"><div class="mb-1 flex justify-between text-[10px] tracking-widest text-ink/50"><span>${gw.kindLabel(kind)} SLOT ${n + 1} OF ${gw.slotsFor(g, kind)}</span><span>${part ? `TIER ${part.level}` : ''}</span></div>
      <div class="space-y-1 rounded border border-line bg-panel2 p-3">${detail}</div><h3 class="pb-1 pt-3 text-[10px] tracking-widest text-ink/50">WHAT TO DO</h3><div class="flex flex-wrap gap-2">${acts.join('')}</div>
      ${msg ? `<p class="pt-2 ${sure ? 'text-red-300' : 'text-amber-300'}">${esc(msg)}</p>` : ''}</div>${list}`;
  }

  function stock(game) {
    const v = V();
    const stk = (v.stk ??= { kind: 'all', sort: 0 });
    const all = game.player.stock ?? [];
    const kinds = [...new Set(all.map((s) => s.kind))].sort();
    if (stk.kind !== 'all' && !kinds.includes(stk.kind)) stk.kind = 'all';
    if (!all.length) return `<div class="p-4 text-xs text-ink/50">Nothing in stock. Order parts, boards and cases on eForest:<div class="mt-3">${bt('gw.eforest', 'OPEN eFOREST', { kind: 'primary' })}</div></div>`;
    const total = all.reduce((n, s) => n + s.value, 0);
    const rows = stockEntries(game, stk).map(({ s, i }) => {
      const { why } = stockPlan(game, i);
      const sell = `gw.stock.sell.${i}`;
      const sure = v.armed === sell;
      return row({ title: s.name, right: `${s.value} cr`, sub: tl('apps.gateway.tier_2', kindName(s.kind), s.level), note: sure ? `click again to sell for ${s.value} cr (${s.pct}%)` : why || 'FITS NOW', tone: sure ? 'danger' : why ? 'warn' : 'ok', mark: sure,
        actions: [bt(`gw.stock.fit.${i}`, 'FIT', { why, kind: 'primary' }), bt(sell, sure ? 'CONFIRM SELL' : 'SELL', { kind: sure ? 'danger' : 'ghost' })] });
    }).join('');
    return `<div class="p-3 text-xs"><div class="text-ink/50">${all.length} ITEMS // RESALE ${total.toLocaleString('en-US')} cr // ${game.player.credits.toLocaleString('en-US')} cr TO SPEND</div>
      <div class="mt-2 flex flex-wrap gap-1">${[['all', 'ALL'], ...kinds.map((k) => [k, kindName(k)])].map(([k, n]) => bt(`gw.stk.kind.${k}`, n, { kind: k === stk.kind ? 'primary' : 'ghost' })).join('')}<span class="ml-auto">${bt('gw.stk.sort', `SORT: ${SORTS[stk.sort]}`)}</span></div></div>${rows || '<p class="p-3 text-xs text-ink/50">nothing of this kind in stock</p>'}`;
  }

  const specs = (rig) => [['THREAD SLOTS', String(gw.lanes(rig))], ['UNLOCK SPEED', `${(gw.crypt(rig) * gw.fpga(rig)).toFixed(1)}x`], ['SYS DRIVE', gb(gw.sharedDrive(rig) ? gw.storage(rig) : gw.systemCap(rig))],
    ['STR DRIVES', gw.sharedDrive(rig) ? 'shared' : gb(gw.downloadCap(rig))], ['INTERNET', `${gw.bandwidth(rig)} Mb/s`], ['RELAY HOPS', String(gw.hops(rig))], ['DEFENCE', gw.defense(rig)]];

  function build(game) {
    const v = V();
    const bld = (v.bld ??= { page: 'main', take: [], pick: null });
    const b = buildOf(game);
    const stage = buildStage(game);
    const missing = b ? kitMissing(game) : [];
    const partsDone = !!b && !missing.filter((m) => m !== 'a board').length;
    const at = { none: 0, kit: !b?.board ? 1 : partsDone ? 3 : 2, assembling: 3, ready: 4 }[stage];
    const stepper = `<div class="flex gap-1 p-3 text-[10px] font-bold">${['CASE', 'BOARD', 'PARTS', 'ASSEMBLE', 'MIGRATE'].map((l, i) => `<span class="flex-1 rounded px-2 py-1 text-center ${i < at ? 'bg-emerald-400/20 text-emerald-300' : i === at ? 'bg-accent text-bg' : 'bg-white/5 text-ink/40'}">${l}</span>`).join('')}</div>`;
    const back = row({ title: '< BACK TO THE KIT', actions: [bt('gw.bld.page.main', 'BACK')] });
    const store = (t) => row({ title: t, sub: tl('apps.gateway.it_has_to_be'), actions: [bt('gw.eforest', 'OPEN eFOREST')] });
    const stocks = (f) => (game.player.stock ?? []).map((s, i) => [s, i]).filter(([s]) => f(s));
    const locked = stage !== 'kit' ? 'the kit is being assembled' : '';
    let head = '';
    let rows = '';
    let foot = '';
    if (stage === 'assembling') { const total = kitMinutes(b); const left = buildLeft(game); head = `<div class="mx-3 mb-2 rounded border border-line bg-panel2 p-3 text-xs"><div class="flex justify-between"><b>ASSEMBLING</b><span class="text-ink/50">${left} of ${total} min left</span></div><div class="mt-2 h-2 rounded bg-track"><div class="h-2 rounded bg-accent" style="width:${Math.round((1 - left / total) * 100)}%"></div></div></div>`; }
    if (!b) {
      rows = row({ title: 'NO BUILD UNDER WAY', note: 'A new machine is made from parts you already own: a case, a board, a processor, a network card and a drive. Buy them on eForest; they arrive in STOCK.', tone: 'dim' })
        + (stocks((s) => s.kind === 'case').map(([s, i]) => { const fixed = chassisDef(s.level)?.fixed_board; return row({ title: s.name, right: 'IN STOCK', sub: tl('apps.gateway.case'), note: fixed ? 'its board is built in: it cannot start a build' : '', actions: [bt(`gw.bld.start.${i}`, 'START BUILD', { why: fixed ? 'fixed board' : '', kind: 'primary' })] }); }).join('') || store('NO CASE IN STOCK'));
    } else if (bld.page === 'board' && stage === 'kit') {
      rows = back + (stocks((s) => s.kind === 'board').map(([s, i]) => { const why = buildBoardBlock(game, s.level); const d = boardDef(s.level); return row({ title: s.name, right: 'IN STOCK', sub: d ? `${d.cpu_slots} processors up to T${d.cpu_max} // ${d.storage_slots} drives // ${d.modem_slots} line${d.modem_slots > 1 ? 's' : ''}` : '', note: why || 'fits this case', tone: why ? 'warn' : 'ok', actions: [bt(`gw.bld.board.${i}`, 'FIT', { why, kind: 'primary' })] }); }).join('') || store('NO BOARD IN STOCK'));
    } else if (bld.page.startsWith('add.') && stage === 'kit') {
      const kind = bld.page.slice(4);
      rows = back + (stocks((s) => s.kind === kind).map(([s, i]) => { const why = buildPartBlock(game, kind, s.level); return row({ title: s.name, right: 'IN STOCK', sub: tl('apps.gateway.tier_3', s.level), note: why || 'fits the kit', tone: why ? 'warn' : 'ok', actions: [bt(`gw.bld.use.${kind}.${i}`, 'FIT', { why, kind: 'primary' })] }); }).join('') || store(`NO ${kindName(kind)} IN STOCK`));
    } else if (bld.page === 'migrate' && stage === 'ready') {
      const plan = migrationPlan(game, bld.take);
      const now = specs(game.player.gateway);
      const after = specs({ chassis: b.chassis, board: b.board, parts: plan.parts });
      const sure = v.armed === 'gw.bld.go';
      head = `<div class="mx-3 mb-2 grid grid-cols-2 gap-x-6 rounded border border-line bg-panel2 p-3 text-xs"><b class="col-span-2 pb-1 text-[10px] tracking-widest text-ink/50">NOW -> AFTER MIGRATION // offline ${plan.minutes || '?'} min</b>${now.map(([l, was], i) => `<div class="flex justify-between"><span class="text-ink/50">${l}</span><span class="${was === after[i][1] ? 'text-ink/60' : 'text-emerald-400'}">${was === after[i][1] ? was : `${was} -> ${after[i][1]}`}</span></div>`).join('')}</div>`;
      rows = back + row({ title: plan.why ? 'CANNOT MIGRATE YET' : `READY // OFFLINE ${plan.minutes} MINUTES`, sub: tl('apps.gateway.parts_in_the_new', plan.parts.length, plan.left.length), note: plan.why || (sure ? 'click again: the machine goes offline while the data is copied' : "the new machine takes over this one's apps and public IP"), tone: plan.why || sure ? 'danger' : 'dim', mark: sure, actions: [bt('gw.bld.go', sure ? 'CONFIRM' : 'MIGRATE', { why: plan.why, kind: sure ? 'danger' : 'primary' })] })
        + game.player.gateway.parts.map((p, i) => { const stays = p.kind === 'storage' && p.fixed; const on = bld.take.includes(i); return row({ title: p.name, right: kindName(p.kind), sub: tl('apps.gateway.tier_4', p.level, p.fixed ? ' // soldered' : ''), note: stays ? 'stays with the old board' : on ? 'MOVES to the new machine' : 'goes to stock', tone: on ? 'ok' : 'dim', actions: stays ? [] : [bt(`gw.bld.tick.${i}`, on ? 'LEAVE' : 'MOVE', { kind: on ? 'ghost' : 'primary' })] }); }).join('');
    } else {
      const c = chassisDef(b.chassis);
      const bd = b.board ? boardDef(b.board) : null;
      rows = row({ title: c.name, right: 'CASE  OK', sub: tl('apps.gateway.drive_bays_security_slots', c.bays, c.security_slots, c.migration) })
        + row({ title: bd ? bd.name : 'BOARD  REQUIRED', right: bd ? 'BOARD  OK' : 'MISSING', sub: bd ? `${bd.cpu_slots} processors up to T${bd.cpu_max} // ${bd.storage_slots} drives // drives up to ${gb(bd.drive_cap)}` : 'every part needs a board first', actions: [bt('gw.bld.page.board', bd ? 'CHANGE' : 'PICK BOARD', { why: locked, kind: bd ? 'ghost' : 'primary' })] })
        + b.parts.map((p, i) => row({ title: p.name, right: kindName(p.kind), sub: tl('apps.gateway.tier_3', p.level), actions: [bt(`gw.bld.rm.${i}`, 'TO STOCK', { why: locked })] })).join('')
        + (b.board ? KINDS.map((kind) => { const slots = gw.slotsFor(b, kind); if (!slots) return ''; const used = gw.usedSlots(b, kind); const need = ['cpu', 'modem', 'storage'].includes(kind) && !used; return row({ title: `${kindName(kind)}  ${used}/${slots}`, right: need ? 'REQUIRED' : used < slots ? 'OPTIONAL' : 'FULL', sub: used < slots ? 'free slot' : 'all slots used', actions: [bt(`gw.bld.page.add.${kind}`, 'PICK', { why: locked || (used >= slots ? 'all slots full' : ''), kind: need ? 'primary' : 'ghost' })] }); }).join('') : '');
      const note = { kit: missing.length ? [`still needs ${missing.join(', ')}`, 'warn'] : [`kit complete // ${kitMinutes(b)} min to assemble`, 'ok'], assembling: [`assembling // ${buildLeft(game)} min left; the live machine keeps working`, 'dim'], ready: ['assembly done // pick what moves across', 'ok'] }[stage];
      const scrap = v.armed === 'gw.bld.cancel';
      foot = `<div class="sticky bottom-0 flex items-center gap-2 border-t border-line bg-panel p-2 text-xs"><span class="flex-1 ${TONE[note[1]]}">${esc(note[0])}</span>${stage === 'kit' ? bt('gw.bld.assemble', 'ASSEMBLE', { why: missing.length ? `still needs ${missing.join(', ')}` : '', kind: 'primary' }) : ''}${stage === 'ready' ? bt('gw.bld.page.migrate', 'MIGRATE...', { kind: 'primary' }) : ''}${bt('gw.bld.cancel', scrap ? 'CONFIRM SCRAP' : 'SCRAP', { kind: scrap ? 'danger' : 'ghost' })}</div>`;
    }
    return `${stepper}${head}${rows}${foot}`;
  }

  function render() {
    const game = state.game;
    const g = game.player.gateway;
    const v = V();
    const chassis = gw.chassisOf(g);
    const now = game.clock.minutes;
    const migrating = gw.migrating(g, now);
    const stage = buildStage(game);
    const b = buildOf(game);
    const tab = Math.min(v.tab ?? 0, 2);
    const stocked = game.player.stock?.length ?? 0;
    const tabs = [`SLOT`, `STOCK${stocked ? ` ${stocked}` : ''}`, b ? 'BUILD *' : 'BUILD'];
    const why = chassis.mobile ? relocateError(game) : '';
    const tiles = metrics(game).map(([l, val, o]) => `<div class="min-w-32 flex-1 rounded border border-line bg-panel2 p-2"><div class="text-[10px] tracking-widest text-ink/50">${l}</div><div class="text-lg font-bold ${o.tone === 'warn' ? 'text-amber-300' : 'text-white'}">${esc(val)}</div>
      ${o.frac != null ? `<div class="h-1 rounded bg-track"><div class="h-1 rounded bg-accent" style="width:${Math.round(Math.min(o.frac, 1) * 100)}%"></div></div>` : ''}<div class="truncate text-[10px] text-ink/50">${esc(o.sub ?? '')}</div></div>`).join('');
    const rig = tab === 2 && b?.board ? board(game, b) : null;
    body.innerHTML = `<div data-scroll="gw" class="h-full overflow-y-auto p-3 text-xs">
      <div class="flex flex-wrap items-center gap-2"><b class="text-lg text-white">${esc(chassis.name)}</b>${chip(migrating ? `RECONFIGURING ${gw.migrateLeft(g, now)} MIN` : 'ONLINE', migrating ? 'warn' : 'ok')}
        ${stage === 'kit' ? chip('KIT OPEN', 'accent') : stage === 'assembling' ? chip(`BUILDING ${buildLeft(game)} MIN`, 'accent') : stage === 'ready' ? chip('BUILD READY') : ''}
        <span class="ml-auto flex gap-2">${chassis.mobile ? bt('gw.relocate', 'RELOCATE', { why, kind: 'primary' }) : ''}${bt('gw.eforest', 'BUY ON eFOREST', { kind: 'primary' })}</span></div>
      <div class="pb-2 text-ink/50">${esc(`${forms()[chassis.form - 1]} CASE // ${gw.boardOf(g).name} // ${chassis.trait_name} // IP ${g.ip}`)}</div>
      <div class="flex flex-wrap gap-2">${tiles}</div>
      <div class="mt-3 flex flex-wrap items-start gap-3"><div class="min-w-[22rem] flex-[1_1_22rem]">${rig ?? board(game)}</div>
        <div class="min-w-[22rem] flex-[1_1_22rem] rounded border border-line"><nav class="flex border-b border-line">${tabs.map((t, i) => `<button data-id="gw.tab.${i}" class="flex-1 px-3 py-2 text-[11px] font-bold ${i === tab ? 'border-b-2 border-accent text-ink' : 'text-ink/60 hover:text-ink'}">${t}</button>`).join('')}</nav>
          ${tab === 1 ? stock(game) : tab === 2 ? build(game) : inspector(game)}</div></div></div>`;
  }

  const refresh = autoRender(body, () => {
    const g = state.game;
    const v = V();
    return JSON.stringify([v.slot, v.mode, v.tab, v.stk, v.bld, v.armed, g.player.gateway, g.player.stock, g.player.credits, g.clock.minutes, buildStage(g)]);
  }, render);
  body.addEventListener('click', (e) => {
    const x = e.target.closest('[data-id]');
    if (!x || x.disabled) return;
    click(state, x.dataset.id);
    refresh();
  });
}
