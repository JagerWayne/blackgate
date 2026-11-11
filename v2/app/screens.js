import { cities } from '../game/data/content.js';
import { CO_LABEL } from '../game/data/enums.js';
import { siteUrl } from '../game/state/sites.js';
import { saveRun } from '../game/state/save.js';
import { toast } from '../game/state/gameHelpers.js';
import { portraitOf } from '../pages/ui/portrait.js';
import { esc } from './ui.js';
import { t as tl } from '../game/data/language.js';

// The three screens around the desktop, as in the classic game (pages/render/{boot,setup,off}.js): the BIOS log that types
// itself out, the setup that plays back the world a new profile was just given, and the black POWER OFF screen.
// state.mode says which one is up ('boot', 'setup', 'off'); sync(dt) is called every frame by main.js.

// -- boot -----------------------------------------------------------------------
const BOOT_LINES = [
  ['BLACKGATE BIOS 4.11 // NODE 0x4F2A', 'text-[#93a4b3]'],
  ['cold boot ................. ok', 'text-emerald-400'],
  ['identity spoof ............ ok', 'text-emerald-400'],
  ['traffic relay ............ 7 hops', 'text-[#93a4b3]'],
  ['NEXUS uplink .............. established', 'text-accent'],
  ['polymorphic shell ......... resident', 'text-[#93a4b3]'],
  ['counter-forensics ......... armed', 'text-warn'],
  ['> awaiting operator credentials', 'text-white'],
];
const REVEAL_RATE = 12;
const PROMPT_AFTER = 2.4;
const READY_AFTER = 6;

// -- setup ----------------------------------------------------------------------
const STAGES = [
  { key: 'companies', label: 'REGISTERING COMPANIES', secs: 2.2 },
  { key: 'people', label: 'CREATING CITIZENS', secs: 3.6 },
  { key: 'write', label: 'WRITING PROFILE', secs: 0.6 },
];
const LOG_LINES = 14;
const SETUP_TOTAL = STAGES.reduce((a, s) => a + s.secs, 0);

/// Where the setup is: the stage, how far through it (0..1), and how many records of it are shown.
function setupAt(game, t) {
  for (let i = 0; i < STAGES.length; i += 1) {
    const s = STAGES[i];
    if (t < s.secs || i === STAGES.length - 1) {
      const f = Math.min(t / s.secs, 1);
      const total = s.key === 'companies' ? game.world.companies.length : s.key === 'people' ? game.world.people.length : 1;
      return { stage: i, f, n: Math.floor(f * total), total };
    }
    t -= s.secs;
  }
  return null;
}

/// The log lines up to the n-th record of a stage.
function logLines(game, stage, n) {
  const w = game.world;
  const lines = [];
  const upto = (cur, all) => (stage === cur ? n : all);
  for (let i = Math.max(upto(0, w.companies.length) - LOG_LINES, 0); i < upto(0, w.companies.length); i += 1) {
    const c = w.companies[i];
    lines.push([`+ ${c.name.padEnd(26)} ${siteUrl(c).padEnd(30)} ${(CO_LABEL[c.kind] ?? c.kind).padEnd(12)} ${cities()[c.city]?.name ?? ''}`, 'text-[#7fd4ff]']);
  }
  if (stage >= 1) {
    for (let i = Math.max(upto(1, w.people.length) - LOG_LINES, 0); i < upto(1, w.people.length); i += 1) {
      const p = w.people[i];
      const at = p.company === null ? 'civilian' : `@ ${w.companies[p.company]?.name}`;
      lines.push([`+ ${p.name.padEnd(24)} ${p.role} ${at}`, p.company === null ? 'text-[#93a4b3]' : 'text-[#5be49b]']);
    }
  }
  return lines.slice(-LOG_LINES);
}

/// Mounts the three screens over the page. Returns { sync(dt) }.
export function mountScreens(state) {
  const root = document.createElement('div');
  root.className = 'fixed inset-0 z-[47] font-mono';
  root.hidden = true;
  document.body.append(root);

  // any key or click: the boot connects, the setup runs faster, the machine turns back on
  let pressed = false;
  let lastInput = -1;
  const poke = () => { pressed = true; lastInput = performance.now(); };
  addEventListener('pointerdown', poke, true);
  addEventListener('keydown', poke, true);

  let booted = -1; // time the boot started
  let sig = '';
  const show = (html, key) => { if (key !== sig) { sig = key; root.innerHTML = html; } };

  return {
    sync(dt) {
      const press = pressed;
      pressed = false;
      const mode = state.mode;
      root.hidden = !(mode === 'boot' || mode === 'setup' || mode === 'off');
      if (root.hidden) { sig = ''; booted = -1; return; }

      if (mode === 'boot') {
        if (booted < 0) booted = 0;
        booted += dt;
        if (booted > READY_AFTER || press) { state.mode = 'login'; root.hidden = true; sig = ''; booted = -1; return; }
        const reveal = Math.floor(booted * REVEAL_RATE);
        const lines = BOOT_LINES.map(([text, tone], i) => (i > reveal ? '' : `<div class="${tone}">${esc(text.slice(0, Math.max(0, (reveal - i) * 2)))}&nbsp;</div>`)).join('');
        const prompt = booted > PROMPT_AFTER ? `<div class="absolute inset-x-0 bottom-16 text-center text-[11px] tracking-[0.3em] text-dim" style="opacity:${(0.4 + (Math.sin(booted * 0.7 * Math.PI * 2) * 0.5 + 0.5) * 0.6).toFixed(2)}">CLICK TO CONNECT</div>` : '';
        show(`<div class="absolute inset-0 bg-[#050810] bg-[radial-gradient(60rem_36rem_at_50%_45%,rgb(76_157_240/.16),transparent_60%)]"></div>
          <div class="absolute left-20 top-24 text-[13px] leading-6">${lines}</div>
          <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"><div class="text-7xl font-bold text-accent [text-shadow:0_0_24px_rgb(76_157_240/.8)]">&#9651;</div><div class="mt-4 text-3xl font-bold tracking-[0.2em] text-white">BLACKGATE</div><div class="mt-2 text-[10px] tracking-[0.3em] text-[#93a4b3]">A NETWORK INTRUSION SIMULATION</div></div>${prompt}`, `boot${reveal}${booted > PROMPT_AFTER ? Math.round(booted * 10) : ''}`);
        return;
      }

      if (mode === 'off') {
        // a key or a click turns the machine back on, straight to the welcome screen
        if (press) { state.mode = 'login'; root.hidden = true; sig = ''; return; }
        show('<div class="absolute inset-0 grid place-items-center bg-black text-center"><div><div class="text-lg tracking-widest text-[#5d7286]">POWER OFF</div><div class="mt-3 text-[10px] text-[#3f5062]">Press Alt + F4 to exit or any key to reboot</div></div></div>', 'off');
        return;
      }

      // setup: the world the new profile was given is registered, then saved, then the desktop comes up
      const s = state.setup;
      if (!s) { state.mode = 'play'; return; }
      s.t += dt * (performance.now() - lastInput < 400 ? 4 : 1);
      if (s.t >= SETUP_TOTAL) {
        saveRun(s.game);
        (globalThis.blackgate?.dataFallbacks?.() ?? []).forEach((f) => toast(s.game, tl('screens.unreadable_using_the_built', f), 'bad'));
        state.setup = null;
        state.mode = 'play';
        state.ui.focus = null;
        root.hidden = true;
        sig = '';
        return;
      }
      const game = s.game;
      const at = setupAt(game, s.t);
      const bars = STAGES.map((st, i) => {
        const done = i < at.stage;
        const live = i === at.stage;
        const f = done ? 1 : live ? at.f : 0;
        const total = st.key === 'companies' ? game.world.companies.length : st.key === 'people' ? game.world.people.length : 0;
        const count = done ? total : live ? at.n : 0;
        const tone = done ? '#5be49b' : live ? '#ffc857' : '#3f5062';
        return `<div class="mb-4"><div class="flex justify-between text-[13px]" style="color:${tone}"><span>${done ? '✓' : live ? '›' : '&nbsp;'} ${st.label}</span>${total ? `<span>${count.toLocaleString('en-US')} / ${total.toLocaleString('en-US')}</span>` : ''}</div>
          <div class="mt-1.5 h-1.5 bg-[#1a2330]"><div class="h-1.5" style="width:${(f * 100).toFixed(1)}%;background:${tone}"></div></div></div>`;
      }).join('');
      const faces = at.stage === 1 && at.n > 0
        ? `<div class="mb-3 flex gap-2">${Array.from({ length: 8 }, (_, k) => { const i = Math.max(at.n - 1 - k, 0); return `<img src="${esc(String(portraitOf(game, i)).replace(/^\.\/data\//, '/'))}" alt="" class="h-16 w-16 bg-[#9aa3ad] object-cover" />`; }).join('')}</div>` : '';
      const log = logLines(game, at.stage, at.n).map(([text, tone]) => `<div class="whitespace-pre truncate ${tone}">${esc(text)}</div>`).join('');
      show(`<div class="absolute inset-0 overflow-hidden bg-[#05080c]"><div class="mx-auto mt-[10vh] w-[min(900px,calc(100vw-3rem))]"><div class="text-xl text-white">NEW PROFILE // ${esc(game.player.handle)}</div><div class="mb-6 mt-1 text-xs text-[#93a4b3]">building your network // seed ${esc(game.seed)}</div>
        ${bars}${faces}<div class="text-xs leading-[18px]">${log}</div></div><div class="absolute bottom-6 right-8 text-[11px] text-[#3f5062]">any key: faster</div></div>`, `setup${at.stage}.${at.n}.${Math.round(at.f * 50)}`);
    },
  };
}
