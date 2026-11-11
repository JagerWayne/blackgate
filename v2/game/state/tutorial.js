// The tutorial every new run starts with: five lessons, all on one practice
// server that exists only for them and is destroyed when they are done.
//   1  install the necessary software (the four basic tools)
//   2  copy a file from the server
//   3  delete a file on the server
//   4  delete the server's log files, then leave
//   5  delete a file from your own storage
// A lesson that pays (2 to 5) pays when it is done. The steps are read from the
// game each frame, so they follow what the operator really did, not the order
// they were meant to do it in. The tutorial cannot be left except by the cheat
// that skips it (skipTutorial), which gives the software and the money.

import { pushMail, hasTool, toast, adjust } from './gameHelpers.js';
import { findWindow } from './windows.js';
import { software } from '../data/content.js';
import { toolPrice } from './economy.js';
import { authOf } from '../data/auth.js';
import { companyAt } from './sites.js';
import { t as tl } from '../data/language.js';

/// The basic tools, in the order the equip lesson buys them, and what each is for.
export const KIT = [
  ['FileCopier', 'It copies files from a host onto your gateway. Every theft job needs it.'],
  ['LogDeleter', 'It wipes the log lines your visit leaves on a host. Logs are what get people caught.'],
  ['FileDeleter', 'It deletes a file on a host for good. Some jobs ask for a file to be destroyed.'],
  ['PasswordCracker', 'It tries passwords until a locked service opens. Most hosts lock their services.'],
];

/// What the basic tools cost: the run starts with this much cash on top of its 4,000.
export function kitCost() {
  return KIT.reduce((sum, [kind]) => sum + toolPrice(software().find((d) => d.kind === kind), 1), 0);
}

/// The lessons: a title for the panel and what finishing each pays.
export const LESSONS = [
  { title: 'INSTALL THE SOFTWARE', reward: 0 },
  { title: 'COPY A FILE', reward: 600 },
  { title: 'DELETE A FILE', reward: 700 },
  { title: 'DELETE THE LOG FILES', reward: 500 },
  { title: 'CLEAN YOUR STORAGE', reward: 300 },
];

/// All the money the lessons pay.
export const tutorialPay = () => LESSONS.reduce((n, l) => n + l.reward, 0);

/// The practice server's files: the first is for the copy lesson, the second for the delete lesson.
const FILES = [
  { name: 'visitor_list.txt', size: 2, enc: 0, tag: 0, content: 'PRACTICE // VISITOR LIST', deleted: false },
  { name: 'old_memo.doc', size: 3, enc: 0, tag: 0, content: 'PRACTICE // OLD MEMO', deleted: false },
  { name: 'budget_notes.xls', size: 4, enc: 0, tag: 0, content: 'PRACTICE // BUDGET NOTES', deleted: false },
];

/// The practice server's address on the network.
export const SERVER_IP = '10.9.9.9';

/// The practice server: an open machine with no guards, three files and no logs.
/// It is added after the world, so nothing the seed made moves.
function makeServer(game) {
  const id = game.world.hosts.length;
  game.world.hosts.push({
    id,
    company: null,
    name: 'practice-rig',
    domain: 'practice.nx',
    ip: SERVER_IP,
    kind: 'public',
    proxy: 0, firewall: 0, monitor: 0, trace: 0,
    services: [{ name: 'ssh', port: 22, kind: 'admin', password: 0, open: true, visible: true }],
    files: FILES.map((f) => ({ ...f })),
    logs: [],
    x: 0.5, y: 0.5, city: 0,
    discovered: true,
    relay: false,
    tutorial: true,
  });
  return id;
}

/// The practice server of the running tutorial, or null once it is gone.
export function serverOf(game) {
  const id = game.tutorial?.server;
  const h = id === undefined ? null : game.world.hosts[id];
  return h?.tutorial ? h : null;
}

/// Destroys the practice server: any link to it closes, and nothing keeps its address.
export function destroyServer(game) {
  const h = serverOf(game);
  if (!h) return;
  if (game.session?.target === h.id) game.session = null;
  const gone = (x) => x !== h.id;
  game.player.bounce = game.player.bounce.filter(gone);
  game.favorites = (game.favorites ?? []).filter(gone);
  (game.routes ?? []).forEach((r) => { r.hops = r.hops.filter(gone); });
  game.world.hosts.splice(h.id, 1);
  game.tutorial.server = undefined;
}

/// Starts the tutorial on a new run and builds its practice server. A run that
/// starts with the basic tools already installed is past the first lesson.
export function startTutorial(game) {
  game.tutorial = { on: true, lesson: 1, step: 0, min: false, endArm: false, left: false, server: makeServer(game), paid: [], stored: 0 };
}

/// All four basic tools are installed.
const kitInstalled = (game) => KIT.every(([kind]) => hasTool(game, kind));

/// Has the operator done what lesson `n` asks?
function lessonDone(game, n) {
  const h = serverOf(game);
  switch (n) {
    case 1: return kitInstalled(game);
    case 2: return game.player.storage.some((f) => f.name === FILES[0].name);
    case 3: return !!h && h.files.find((f) => f.name === FILES[1].name)?.deleted === true;
    case 4: return !!h && h.logs.length === 0 && !game.session;
    case 5: return game.player.storage.length < game.tutorial.stored;
    default: return true;
  }
}

/// Pays lesson `n` once.
function pay(game, n) {
  const tut = game.tutorial;
  const reward = LESSONS[n - 1].reward;
  if (tut.paid.includes(n)) return;
  tut.paid.push(n);
  if (!reward) return;
  adjust(game, reward, `tutorial lesson ${n}`);
  toast(game, tl('state.tutorial.lesson_complete_cr', n, reward), 'good');
}

/// Gets lesson `n` ready: the storage lesson needs something in the storage to delete.
function enter(game, n) {
  const tut = game.tutorial;
  tut.lesson = n;
  tut.step = 0;
  if (n === 5) {
    if (!game.player.storage.length) game.player.storage.push({ name: 'practice_copy.txt', size: 1, source: SERVER_IP, enc: 0, tag: 0 });
    tut.stored = game.player.storage.length;
  }
}

/// The last lesson is done: the server is destroyed and the board is the operator's.
function finish(game) {
  destroyServer(game);
  game.tutorial.on = false;
  toast(game, tl('state.tutorial.tutorial_complete_the_practice'), 'good');
  pushMail(game, {
    id: 0,
    from: 'WARDEN <warden@blackgate.onion>',
    subject: 'THE PRACTICE RIG IS GONE',
    body: 'That was the last lesson. I have wiped the practice server: it does not exist any more, and nothing you did on it is on any record.\n\nThe board is yours. Read the brief, check the target, and wipe your own tail.\n\n- WARDEN',
    minute: game.clock.minutes,
    read: false,
    contract: null,
    kind: 'normal',
    attachment: null,
  });
}

/// The cheat that skips the tutorial: the software and the money its lessons
/// give are handed over at once (software not yet installed is paid for from the
/// cash set aside for it), and the practice server is destroyed. Returns why it cannot.
export function skipTutorial(game) {
  const tut = game.tutorial;
  if (!tut?.on) return 'no tutorial is running';
  KIT.forEach(([kind]) => {
    if (hasTool(game, kind)) return;
    game.player.tools.push({ kind, level: 1 });
    adjust(game, -toolPrice(software().find((d) => d.kind === kind), 1), 'tutorial software');
  });
  for (let n = 1; n <= LESSONS.length; n += 1) pay(game, n);
  finish(game);
  return null;
}

/// The pages of Internet XPlorer that are websites: they have no rail.
const WEB = new Set(['start', 'sleekpages', 'directory', 'eforest.nx', 'eforest', 'whois.nx', 'whois']);
export const onWeb = (game, url) => WEB.has(url.split('/')[0]) || companyAt(game, url.split('/')[0]) >= 0;

/// The App Store's grid, or a tool's page: what to press to get a tool's tile in
/// reach. The Home entry first when another category is showing.
const storeIds = (view, kind) => {
  const sw = view.win.software ?? {};
  if ((sw.filter ?? 'ALL') !== 'ALL') return ['sw.nav.ALL'];
  return sw.page ? ['sw.back'] : [`sw.${kind}`];
};

/// The locked services a first-level Password Breaker can open.
export const crackable = (h) => h.services
  .map((s, i) => (!s.open && s.password <= 1 && s.kind !== 'voice' && authOf(s) === 'password' ? i : -1))
  .filter((i) => i >= 0);

/// What the steps of every lesson share: finding windows, reaching the server
/// and its files, and the lit ids that go with them.
function helpers(game, view) {
  const h = serverOf(game);
  const t = h?.id;
  const open = (key) => {
    const w = findWindow(view.windows, key);
    return !!w && !w.min;
  };
  // a closed window is lit on the desktop and in the Start menu; the Start
  // button is lit too, since a window on top can hide the desktop icons
  const opener = (key) => [`win.${key}`, ...(view.startOpen ? [] : ['start'])];
  // the STORAGE tab is lit until it is the one showing
  const storageTab = () => (view.win.blackgate?.tab === 1 ? [] : ['sess.tab.1']);
  const live = () => game.session?.target === t;
  const fileAt = (name) => h.files.findIndex((f) => f.name === name && !f.deleted);
  // the STORAGE tab's explorer: which folder is open and which file is picked
  const explorer = () => view.win.blackgate?.xf?.files ?? { folder: 'files', sel: null };
  // the file to pick: open the files folder first when another is showing
  const pickIds = (name) => [...storageTab(), ...(explorer().folder === 'files' ? [`sess.x.row.f${fileAt(name)}`] : ['sess.x.node.files', 'sess.x.row.files'])];
  // a right click opens a menu on its target: the target is lit first, then the menu's item
  const menuOn = (key) => view.ui?.ctx?.key === key;
  const onFile = (name, itemId, text, done) => ({
    text,
    ids: () => (menuOn(`sess.x.row.f${fileAt(name)}`) ? [itemId(fileAt(name))] : pickIds(name)),
    done,
    needsLink: true,
  });
  // reaching the server: open Bl@ckG@te, the Nexus Map tab, then the row and LINK
  const toLink = () => {
    if (!open('blackgate')) return opener('blackgate');
    if (view.win.blackgate?.suite !== 'map') return ['suite.blackgate.map'];
    // once per lesson the map picks the machine and scrolls its row into view
    const key = `lesson-${game.tutorial.lesson}`;
    if (view.tutAimed !== key) {
      view.tutAimed = key;
      Object.assign(view.win.map ??= {}, { sel: t, kind: 'all', query: '', follow: true, glide: true, tab: 'HOSTS' });
    }
    return [`host.${t}`, `map.go.${t}`];
  };
  const link = {
    text: `Link to the practice server, ${h?.name} (${h?.ip}). Open Bl@ckG@te, pick the Nexus Map tab, find the machine in the HOSTS list and press LINK.`,
    ids: toLink,
    done: live,
  };
  return { h, open, opener, link, onFile, menuOn };
}

/// The equip lesson: the App Store, then each basic tool in turn.
function installSteps(game, view) {
  const { open, opener } = helpers(game, view);
  // the App Store: the grid of tools, or one tool's page (BACK leads from a page to the grid)
  const onPage = () => !!view.win.software?.page;
  const toGrid = (kind) => () => (!open('software') ? opener('software') : storeIds(view, kind));
  const toInstall = (kind) => () => (!open('software') ? opener('software') : onPage() ? [`sw.buy.${kind}.1`] : storeIds(view, kind));
  const steps = [{
    text: 'Your gateway is empty. Software does the hacking, and you buy it in the App Store. Open it.',
    ids: () => opener('software'),
    done: () => open('software') || hasTool(game, KIT[0][0]),
  }];
  KIT.forEach(([kind, blurb]) => {
    const def = software().find((d) => d.kind === kind);
    const price = toolPrice(def, 1).toLocaleString('en-US');
    steps.push(
      { text: `${def.name} (${price} cr). ${blurb} Pick it in the App Store.`, ids: toGrid(kind), done: () => hasTool(game, kind) || view.win.software?.sel === kind },
      { text: `Press INSTALL to buy the ${def.name}.`, ids: toInstall(kind), done: () => hasTool(game, kind) },
    );
  });
  return Object.assign(steps, { link: null });
}

/// The steps of the storage lesson: My Computer, the downloads folder, a file, DELETE.
function storageSteps(game, view) {
  const { open, opener } = helpers(game, view);
  const dropped = () => lessonDone(game, 5);
  const win = () => view.win.files ?? {};
  const picked = () => (/^f\d+$/.test(win().sel ?? '') ? Number(win().sel.slice(1)) : -1);
  return [
    { text: 'Files you copy land on your own drive. Open My Computer to look at them.', ids: () => opener('files'), done: () => open('files') || dropped() },
    { text: 'Open the downloads folder: that is where copied files are kept.', ids: () => ['files.x.node.downloads'], done: () => win().folder === 'downloads' || dropped() },
    { text: 'Pick a file in the list. Anything will do.', ids: () => ['files.x.row.f0'], done: () => picked() >= 0 || dropped() },
    { text: 'Press DELETE in the bar above the list. Storage is limited: delete what you no longer need.', ids: () => [`files.del.${picked()}`], done: dropped },
  ];
}

/// The steps of lesson `n`.
function lessonSteps(game, view, n) {
  if (n === 1) return installSteps(game, view);
  if (n === 5) return Object.assign(storageSteps(game, view), { link: null });
  const { h, link, onFile, menuOn } = helpers(game, view);
  const leave = {
    text: 'The logs are clear. Now press DISCONNECT to close the link.',
    ids: () => ['sess.disconnect'],
    done: () => !game.session,
  };
  const wipe = {
    text: 'Everything you do leaves log lines on the machine, and logs are what raise your heat. Right-click the host name at the top left of the link and choose WIPE LOGS to remove them.',
    ids: () => (menuOn('sess.host') ? ['sess.task.WipeLogs'] : ['sess.host']),
    done: () => h.logs.length === 0,
    needsLink: true,
  };
  const steps = {
    2: [link, onFile(FILES[0].name, (i) => `sess.copy.${i}`, `Open the STORAGE tab, right-click ${FILES[0].name} in the list and choose Copy to my computer.`, () => lessonDone(game, 2))],
    3: [link, onFile(FILES[1].name, (i) => `sess.del.${i}`, `Open the STORAGE tab, right-click ${FILES[1].name} in the list and choose Delete the file.`, () => lessonDone(game, 3))],
    4: [wipe, leave],
  }[n];
  return Object.assign(steps, { link });
}

/// The step the operator is on: its text, the ids to light, and where it
/// stands in the script. Moves on over every lesson already done, paying each.
/// Null when the tutorial is over. The script cannot be left (but for the
/// cheat): the practice server is built again if a save lacks it, and the file
/// to copy is put back if it was lost.
export function tickTutorial(game, view) {
  const tut = game.tutorial;
  if (!tut?.on) return null;
  // a run saved with the older, job-based tutorial joins the lessons at the start
  if (tut.lesson === undefined) Object.assign(tut, { lesson: 1, step: 0, paid: [], stored: 0, server: undefined });
  if (!serverOf(game)) tut.server = makeServer(game);
  const h = serverOf(game);
  if (tut.lesson <= 2 && !lessonDone(game, 2)) h.files[0].deleted = false;
  while (tut.lesson <= LESSONS.length && lessonDone(game, tut.lesson)) {
    pay(game, tut.lesson);
    if (tut.lesson === LESSONS.length) {
      finish(game);
      return null;
    }
    enter(game, tut.lesson + 1);
  }
  const steps = lessonSteps(game, view, tut.lesson);
  tut.step = Math.min(tut.step, steps.length - 1);
  while (tut.step < steps.length - 1 && steps[tut.step].done()) tut.step += 1;
  let step = steps[tut.step];
  // a step that needs the link falls back to getting it again
  if (step.needsLink && !game.session) step = { ...steps.link, text: `You are not linked. ${steps.link.text}` };
  return { lesson: tut.lesson, title: LESSONS[tut.lesson - 1].title, n: tut.step + 1, total: steps.length, text: step.text, ids: step.ids() };
}
