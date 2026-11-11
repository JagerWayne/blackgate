import { actions } from '../bridge.js';

const TONE = { echo: 'text-accent', err: 'text-red-400 sev', ok: 'text-emerald-400 sev', head: 'text-ink', info: 'text-amber-300 sev' };

/// The Command Prompt: renders the game's own terminal scrollback and sends lines to its command runner.
export function mountTerminal(body) {
  body.innerHTML = `
    <div class="cyber grid h-full grid-rows-[1fr_auto] bg-black/60">
      <div data-log class="overflow-y-auto whitespace-pre-wrap p-3 text-xs text-ink/80 select-text"></div>
      <form class="flex gap-2 border-t border-line p-2">
        <span data-prompt class="text-accent">local:~&gt;</span>
        <input data-tutorial="terminal.input" autocomplete="off" spellcheck="false" class="term-input flex-1 bg-transparent outline-none placeholder:text-ink/30" placeholder="type a command, or help" />
      </form>
    </div>`;
  const log = body.querySelector('[data-log]');
  const input = body.querySelector('input');
  let at = -1;

  const prompt = body.querySelector('[data-prompt]');
  let timer = 0;
  const draw = () => {
    clearTimeout(timer);
    prompt.textContent = `${actions.prompt()}>`;
    const now = Date.now();
    const all = actions.term().lines;
    const later = all.filter((l) => l.at > now);
    if (later.length) timer = setTimeout(draw, Math.max(Math.min(...later.map((l) => l.at)) - now, 16));
    log.replaceChildren(...all.filter((l) => !(l.at > now)).map((l) => {
      const d = document.createElement('div');
      d.className = TONE[l.tone] ?? '';
      const tag = /breach|trace|alert/i.test(l.text) && l.tone !== 'echo' ? 'BREACH' : { err: 'WARN', ok: ' OK ', info: 'INFO' }[l.tone];
      if (tag) d.dataset.tag = `[${tag}]`;
      d.textContent = l.text;
      return d;
    }));
    log.scrollTop = log.scrollHeight;
  };

  body.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim()) actions.run(input.value);
    input.value = '';
    at = -1;
    draw();
  };
  input.onkeydown = (e) => {
    const h = actions.term().history;
    if (e.key === 'ArrowUp' && h.length) at = at < 0 ? h.length - 1 : Math.max(at - 1, 0);
    else if (e.key === 'ArrowDown' && at >= 0) at = at + 1 < h.length ? at + 1 : -1;
    else if (e.key === 'Tab') {
      e.preventDefault();
      const { line, hits } = actions.complete(input.value);
      input.value = line;
      if (hits.length) log.append(Object.assign(document.createElement('div'), { className: TONE.info, textContent: hits.join('   ') }));
      return;
    } else return;
    e.preventDefault();
    input.value = at < 0 ? '' : h[at];
  };
  draw();
  input.focus();
}

/// Table helper for the other apps: head is labels, rows are arrays of trusted HTML cells.
export function table(head, rows) {
  const th = head.map((h) => `<th class="sticky top-0 bg-panel px-3 py-1.5 text-left text-[10px] uppercase tracking-widest text-ink/50">${h}</th>`).join('');
  const tr = rows.map((r) => `<tr class="border-t border-line hover:bg-white/5">${r.map((c) => `<td class="px-3 py-1.5">${c}</td>`).join('')}</tr>`).join('');
  return `<div class="h-full overflow-y-auto"><table class="w-full"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
