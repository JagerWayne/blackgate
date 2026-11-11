import { software } from '../../game/data/content.js';
import { logFiles, logFile } from '../../game/state/logs.js';
import { storageUsed, downloadsUsed } from '../../game/state/gameHelpers.js';
import { toolSize, appsUsed } from '../../game/state/apps.js';
import { openTextPad } from '../../game/state/notes.js';
import { submitContract } from '../../game/state/contracts.js';
import * as gw from '../../game/state/gateway.js';
import { bus } from '../bridge.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ICON = { folder: ['bg-amber-400', 'DIR'], app: ['bg-accent', 'EXE'], file: ['bg-sky-400', 'FILE'], log: ['bg-violet-400', 'LOG'] };

/// My Computer: the gateway drive as a two-pane explorer. It shows the same three folders as the canvas
/// window (apps, downloads, logs) from the game's own state, and its view lives in state.win.files
/// ({folder, sel}) because the tutorial reads it. Operations call the same game functions the canvas
/// events did: splice on player.storage for DELETE, submitContract, openTextPad for logs.
export function mountFiles(body, state) {
  const view = (state.win.files ??= { folder: null, sel: null });
  let msg = '';
  let sig = '';

  /// The folders and what is in them, built fresh from the game.
  function model() {
    const game = state.game;
    const defs = software();
    const shared = gw.sharedDrive(game.player.gateway);
    const apps = game.player.tools.map((t) => {
      const d = defs.find((x) => x.kind === t.kind);
      return { key: t.kind, name: d?.name ?? t.kind, kind: 'app', type: 'Application', detail: `v${t.level} ${d?.versions[t.level - 1] ?? ''}`, size: `${toolSize(t.kind, t.level)} GB` };
    });
    const downloads = game.player.storage.map((f, i) => {
      const job = game.contracts.find((c) => c.id === f.tag && (c.state === 'accepted' || c.state === 'ready'));
      return {
        key: `f${i}`, index: i, name: f.name, kind: 'file', type: f.name.includes('.') ? `${f.name.split('.').pop().toUpperCase()} file` : 'File',
        detail: `from ${f.source} // ${f.enc > 0 ? 'ENCRYPTED' : 'PLAINTEXT'}${job ? ` // ${job.state === 'ready' ? `job #${job.id} ready to hand in` : `kept for job #${job.id}`}` : ''}`,
        size: `${f.size} GB`, job,
      };
    });
    const logs = logFiles(game).map((f) => ({
      key: `d${f.day}`, day: f.day, name: f.name, kind: 'log', type: 'Text document',
      detail: `${f.entries.length} ${f.entries.length === 1 ? 'entry' : 'entries'} // ${f.entries.at(-1).text}`, size: `${f.size} B`,
    }));
    const folders = [
      { id: 'apps', group: 'C:', name: 'apps', items: apps, empty: 'no software installed' },
      { id: 'downloads', group: shared ? 'C:' : 'D:', name: 'downloads', items: downloads, empty: 'nothing downloaded' },
      { id: 'logs', group: 'C:', name: 'logs', items: logs, empty: 'nothing logged yet' },
    ];
    return { folders, groups: [...new Set(folders.map((f) => f.group))], shared };
  }

  function render() {
    const game = state.game;
    const { folders, groups, shared } = model();
    const group = typeof view.folder === 'string' && view.folder.startsWith('@') && groups.includes(view.folder.slice(1)) ? view.folder.slice(1) : null;
    const open = folders.find((f) => f.id === view.folder) ?? null;
    if (!open && !group) view.folder = null;
    const asFolder = (f) => ({ key: f.id, name: f.name, kind: 'folder', type: 'File folder', detail: `${f.items.length} item${f.items.length === 1 ? '' : 's'}`, size: '' });
    const items = open ? open.items
      : group ? folders.filter((f) => f.group === group).map(asFolder)
        : groups.map((g) => ({ key: `@${g}`, name: g, kind: 'folder', type: 'Local disk', detail: `${folders.filter((f) => f.group === g).length} folders`, size: '' }));
    const picked = items.find((i) => i.key === view.sel) ?? null;

    const g = game.player.gateway;
    const cap = Math.max(gw.storage(g), 1);
    const cards = shared
      ? [['Local Disk (C:)', storageUsed(game), cap]]
      : [['System Drive (C:)', appsUsed(game), Math.max(gw.systemCap(g), 1)], ['Storage (D:)', downloadsUsed(game), Math.max(gw.downloadCap(g), 1)]];
    const drive = ([name, u, c]) => `<div class="min-w-48 flex-1 rounded-lg border border-line bg-bg/60 p-2">
      <div class="flex justify-between text-xs"><b>${esc(name)}</b><span class="${u / c > 0.9 ? 'text-red-400' : 'text-ink/50'}">${c - u} GB free of ${c} GB</span></div>
      <div class="mt-1.5 h-2 overflow-hidden rounded bg-line"><div class="h-full ${u / c > 0.9 ? 'bg-red-500' : 'bg-accent'}" style="width:${Math.min(u / c, 1) * 100}%"></div></div></div>`;

    const node = (id, text, on, depth, count) => `<button data-act="go" data-folder="${id}" data-tutorial="files.x.node.${id}" style="padding-left:${0.5 + depth}rem" class="flex w-full items-center gap-2 py-1 pr-2 text-left text-xs ${on ? 'bg-accent/15 text-ink' : 'text-ink/70 hover:bg-white/5'}"><i class="h-3 w-4 rounded-sm bg-amber-400"></i><span class="flex-1 truncate">${esc(text)}</span>${count == null ? '' : `<span class="text-ink/40">${count}</span>`}</button>`;
    const tree = node('', 'My Computer', !open && !group, 0)
      + groups.map((gr) => node(`@${gr}`, gr, group === gr, 1) + folders.filter((f) => f.group === gr).map((f) => node(f.id, f.name, open?.id === f.id, 2, f.items.length)).join('')).join('');

    const crumbs = ['My Computer', ...(open ? [open.group, open.name] : group ? [group] : [])].join(' › ');
    const row = (it) => {
      const [tint, tag] = ICON[it.kind];
      return `<tr data-act="pick" data-key="${it.key}" data-tutorial="files.x.row.${it.key}" class="cursor-default border-t border-line ${it.key === view.sel ? 'bg-accent/20' : 'hover:bg-white/5'}">
        <td class="px-3 py-1.5"><span class="inline-flex items-center gap-2"><i class="grid h-5 w-6 place-items-center rounded-sm text-[8px] font-bold text-bg ${tint}">${tag}</i>${esc(it.name)}</span></td>
        <td class="px-3 text-ink/60">${esc(it.type)}</td><td class="px-3 text-right text-ink/60">${esc(it.size)}</td><td class="px-3 text-ink/50">${esc(it.detail)}</td></tr>`;
    };

    // the toolbar of the picked item: what the canvas showed as buttons
    let tools = '';
    if (picked?.kind === 'file') {
      if (picked.job) tools = picked.job.state === 'ready' ? `<button data-act="submit" data-job="${picked.job.id}" class="rounded bg-accent px-2 py-0.5 text-xs font-bold text-bg">SUBMIT WORK</button>` : '<span class="text-xs text-ink/50">kept for its job</span>';
      else tools = `<button data-act="del" data-index="${picked.index}" data-tutorial="files.del.${picked.index}" class="rounded border border-red-400/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/20">DELETE</button>`;
    } else if (picked?.kind === 'log') tools = `<button data-act="notepad" data-day="${picked.day}" class="rounded bg-accent px-2 py-0.5 text-xs font-bold text-bg">OPEN IN NOTEPAD</button>`;
    else if (picked?.kind === 'app') tools = '<button data-act="run" data-key="' + picked.key + '" class="rounded bg-accent px-2 py-0.5 text-xs font-bold text-bg">OPEN IN APP STORE</button>';

    body.innerHTML = `<div class="flex h-full flex-col">
      <div class="flex shrink-0 flex-wrap gap-2 border-b border-line p-2">${cards.map(drive).join('')}</div>
      <div class="flex h-9 shrink-0 items-center gap-2 border-b border-line px-2 text-xs">
        <button data-act="up" ${open || group ? '' : 'disabled'} class="rounded border border-line px-2 py-0.5 enabled:hover:bg-white/10 disabled:opacity-30">&uarr; UP</button>
        <span class="flex-1 truncate text-ink/70">${esc(crumbs)}</span>${tools}
      </div>
      ${msg ? `<p class="bg-red-500/15 px-3 py-1 text-xs text-red-300">${esc(msg)}</p>` : ''}
      <div class="grid min-h-0 flex-1 grid-cols-[13rem_1fr]">
        <nav class="overflow-y-auto border-r border-line py-1">${tree}</nav>
        <div class="overflow-y-auto"><table class="w-full text-xs"><thead><tr class="text-left text-[10px] uppercase tracking-widest text-ink/40"><th class="sticky top-0 bg-panel px-3 py-1.5">Name</th><th class="sticky top-0 bg-panel px-3">Type</th><th class="sticky top-0 bg-panel px-3 text-right">Size</th><th class="sticky top-0 bg-panel px-3">Details</th></tr></thead>
          <tbody>${items.map(row).join('') || `<tr><td colspan="4" class="p-3 text-ink/40">${esc(open?.empty ?? 'this folder is empty')}</td></tr>`}</tbody></table></div>
      </div></div>`;
  }

  /// Opens a row: folders navigate, logs go to Notepad, apps to their App Store page.
  function activate(key) {
    // in the drive list or a drive, every row is a folder
    if (!view.folder || view.folder.startsWith('@')) return Object.assign(view, { folder: key, sel: null });
    const open = model().folders.find((f) => f.id === view.folder);
    const it = open?.items.find((i) => i.key === key);
    if (it?.kind === 'log') notepad(it.day);
    else if (it?.kind === 'app') {
      Object.assign((state.win.software ??= {}), { sel: it.key, page: true });
      bus.emit('window', { key: 'software', action: 'open' });
    }
    return null;
  }
  function notepad(day) {
    const f = logFile(state.game, day);
    if (!f) msg = 'that log is gone';
    else if (!openTextPad(state.game, f.name, f.text)) msg = 'every notepad is in use: close one first';
    else bus.emit('window', { key: 'notepad', action: 'open' });
  }

  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const d = b.dataset;
    msg = '';
    if (d.act === 'go') Object.assign(view, { folder: d.folder || null, sel: null });
    else if (d.act === 'up') Object.assign(view, { folder: view.folder?.startsWith('@') || !view.folder ? null : (model().folders.find((f) => f.id === view.folder)?.group ? `@${model().folders.find((f) => f.id === view.folder).group}` : null), sel: null });
    else if (d.act === 'pick') view.sel = d.key;
    else if (d.act === 'del') { state.game.player.storage.splice(Number(d.index), 1); view.sel = null; }
    else if (d.act === 'submit') submitContract(state.game, Number(d.job));
    else if (d.act === 'notepad') notepad(Number(d.day));
    else if (d.act === 'run') activate(d.key);
    sig = '';
    refresh();
  });
  body.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (!tr) return;
    msg = '';
    activate(tr.dataset.key);
    sig = '';
    refresh();
  });

  function refresh() {
    const g = state.game;
    const s = JSON.stringify([view, msg, g.player.storage, g.player.tools, g.log?.length, g.contracts.map((c) => c.state), gw.storage(g.player.gateway)]);
    if (s === sig) return;
    sig = s;
    render();
  }
  const timer = setInterval(() => (body.isConnected ? refresh() : clearInterval(timer)), 200);
  refresh();
}
