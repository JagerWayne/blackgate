// OSINT: profiles, phones and inboxes, and what each attack gets.
// Run with: node --test tests/*.mjs
import { roomy } from './roomy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initContent } from '../game/data/content.js';
import { makeGame } from '../game/state/gameState.js';
import { connect } from '../game/systems/sessionTick.js';
import { tick } from '../game/systems/tick.js';
import { startTask } from '../game/systems/sessionTasks.js';
import { hiddenHost, intelOf, knows, intelTick, phoneOf, PHISH_MINUTES, dossiers } from '../game/state/intel.js';
import { hasSample, voiceAdmin } from '../game/state/voice.js';
import { makeTerm, run } from '../game/systems/commands.js';

await initContent();

/// A run linked to a company host, with the tools at a level.
function linked(level = 5) {
  const g = roomy(makeGame('OSINT', 7));
  const kinds = ['OsintSweep', 'VoiceAnalyser', 'SpoofKit', 'CredentialStuff', 'PasswordCracker'];
  g.player.tools = g.player.tools.filter((t) => !kinds.includes(t.kind));
  kinds.forEach((kind) => g.player.tools.push({ kind, level }));
  const id = g.world.hosts.findIndex((h) => h.company !== undefined && h.company !== null && g.world.people.some((p) => p.company === h.company));
  assert.equal(connect(g, id), null);
  g.session.phase = 'online';
  const h = g.world.hosts[id];
  const staff = g.world.people.map((p, i) => i).filter((i) => g.world.people[i].company === h.company);
  return { g, h, staff };
}

const finish = (g) => { for (let n = 0; n < 400 && g.session.tasks.length; n += 1) tick(g, 0.25); };

test('PROFILE finds more the better the OSINT tool', () => {
  const { g, staff } = linked(2);
  const i = staff[0];
  assert.ok(!knows(g, i, 'email'));
  assert.equal(startTask(g, 'Profile', i), null);
  finish(g);
  assert.ok(knows(g, i, 'email') && knows(g, i, 'phone'));
  assert.ok(!knows(g, i, 'leak'), 'v2 does not reach leaked passwords');
  assert.match(startTask(g, 'Profile', i), /found all it can/);
  assert.ok(dossiers(g).includes(i), 'on file');
});

test('every phone and inbox attack needs the detail first', () => {
  const { g, staff } = linked();
  const i = staff[0];
  for (const kind of ['CallRecord', 'SpoofCall', 'TapPhone']) assert.match(startTask(g, kind, i), /phone unknown/, kind);
  for (const kind of ['HackInbox', 'Phish', 'Spam']) assert.match(startTask(g, kind, i), /email unknown/, kind);
});

test('a person of another company needs a link to their company', () => {
  const { g, h } = linked();
  const other = g.world.people.findIndex((p) => p.company !== h.company);
  assert.match(startTask(g, 'Profile', other), /link to a host of/);
});

test('a call records their voice; a tap opens a lock their clearance reaches', () => {
  const { g, staff } = linked();
  const i = staff.reduce((a, b) => (g.world.people[b].clearance > g.world.people[a].clearance ? b : a));
  intelOf(g, i).level = 4;
  assert.equal(startTask(g, 'SpoofCall', i), null);
  finish(g);
  assert.ok(hasSample(g, i));
  const mails = g.mail.length;
  assert.equal(startTask(g, 'TapPhone', i), null);
  finish(g);
  assert.ok(g.intel[i].tapped);
  assert.ok(g.mail.length > mails, 'the tap reports by mail');
});

test('a tap needs the advanced Fake Identity Kit', () => {
  const { g, staff } = linked(1);
  intelOf(g, staff[0]).level = 2;
  assert.match(startTask(g, 'TapPhone', staff[0]), /Fake Identity Kit/);
});

test('the leaked password opens the inbox, and the mail names the company', () => {
  const { g, staff } = linked();
  const i = staff[0];
  intelOf(g, i).level = 4;
  // this company logs in with a password alone; behind MFA stuffing is blocked (tests/mfa.test.mjs)
  g.world.hosts.forEach((h) => h.services.forEach((v) => { v.auth = 'password'; }));
  assert.equal(startTask(g, 'HackInbox', i), null);
  finish(g);
  assert.ok(g.intel[i].inbox);
  assert.ok(g.mail.some((m) => m.subject.startsWith('INTERCEPTED')));
  staff.forEach((j) => assert.ok(g.intel[j], 'colleagues become leads'));
});

test('a phish lands three hours later, the same way every time', () => {
  const { g, staff } = linked();
  const i = staff[0];
  intelOf(g, i).level = 1;
  assert.equal(startTask(g, 'Phish', i), null);
  finish(g);
  const it = g.intel[i];
  assert.notEqual(it.phishAt, undefined);
  const taken = it.phishTaken;
  intelTick(g);
  assert.notEqual(it.phishAt, undefined, 'not yet');
  g.clock.minutes += PHISH_MINUTES;
  intelTick(g);
  assert.equal(it.phishAt, undefined);
  assert.equal(!!it.inbox, taken);
  assert.ok(g.mail.some((m) => m.subject.startsWith(taken ? 'PHISH TAKEN' : 'PHISH IGNORED')));
});

test("spam on the host's admin slows the next link's trace", () => {
  const { g, h } = linked();
  const admin = voiceAdmin(g, h);
  const plain = linked();
  plain.g.session.phase = 'connecting';
  plain.g.session.connectT = plain.g.session.connectDur;
  tick(plain.g, 0.01);
  intelOf(g, admin).level = 1;
  assert.equal(startTask(g, 'Spam', admin), null);
  finish(g);
  g.session = null;
  assert.equal(connect(g, h.id ?? g.world.hosts.indexOf(h)), null);
  g.session.connectT = g.session.connectDur;
  tick(g, 0.01);
  assert.ok(g.session.traceRate < plain.g.session.traceRate, 'slower trace');
});

test('phones are worked out from the SSN', () => {
  const g = roomy(makeGame('OSINT', 7));
  const p = g.world.people[0];
  assert.match(phoneOf(p), /^\+1 \(\d{3}\) 55\d-\d{4}$/);
  assert.equal(phoneOf(p), phoneOf({ ...p }));
});

test('ppl commands profile and show a person', () => {
  const { g, staff } = linked();
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const term = makeTerm();
  run(state, term, 'ppl staff', { x: 0, y: 0, w: 1600, h: 900 });
  run(state, term, 'ppl profile #1', { x: 0, y: 0, w: 1600, h: 900 });
  assert.equal(g.session.tasks[0].kind, 'Profile');
  finish(g);
  run(state, term, 'ppl show #1', { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(term.lines.some((l) => l.text.includes(g.world.people[staff[0]].email)));
});

test('DOSSIERS: a person can be removed from file, with a second press to confirm', async () => {
  const { handleEvents } = await import('../game/systems/events.js');
  const { intelOf, dossiers, learn, knows } = await import('../game/state/intel.js');
  const { makeGame } = await import('../game/state/gameState.js');
  const state = { game: makeGame('DEL', 3), win: {}, windows: { list: [] }, ui: {} };
  const g = state.game;
  intelOf(g, 4);
  learn(g, 4, 'email');
  assert.ok(dossiers(g).includes(4));
  handleEvents(state, [{ type: 'click', id: 'dos.del.4' }], { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(dossiers(g).includes(4), 'the first press only arms it');
  handleEvents(state, [{ type: 'click', id: 'dos.del.4' }], { x: 0, y: 0, w: 1600, h: 900 });
  assert.ok(!dossiers(g).includes(4), 'gone from file');
  assert.equal(knows(g, 4, 'email'), false, 'what was found is forgotten');
});

test('a known email gives away unlisted company hosts, to the CLI only', () => {
  const g = roomy(makeGame('OSINT', 7));
  const h = g.world.hosts.find((x) => x.company !== null && !x.discovered && g.world.people.some((p) => p.company === x.company));
  const who = g.world.people.findIndex((p) => p.company === h.company);
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const box = { x: 0, y: 0, w: 1600, h: 900 };
  assert.equal(hiddenHost(g, h.name), null);
  run(state, makeTerm(), `bg connect ${h.name}`, box);
  assert.equal(g.session, null);
  intelOf(g, who).known = { email: true };
  assert.equal(hiddenHost(g, h.name), h);
  run(state, makeTerm(), `bg connect ${h.name}`, box);
  assert.ok(g.session);
  assert.equal(h.discovered, true);
});

test('ping answers for known and email-derived hosts, and times out on strangers', () => {
  const g = roomy(makeGame('OSINT', 7));
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const box = { x: 0, y: 0, w: 1600, h: 900 };
  const known = g.world.hosts.find((x) => x.discovered);
  const t = makeTerm();
  run(state, t, `ping ${known.ip}`, box);
  assert.ok(t.lines.some((l) => /^Reply from/.test(l.text)));
  const t2 = makeTerm();
  run(state, t2, 'ping 203.0.113.9', box);
  assert.ok(t2.lines.some((l) => /timed out/.test(l.text)));
  assert.equal(known.discovered, true);
});

test('every host stands on land, and a ping that is answered puts a hidden host on the map', async () => {
  const { countryAt } = await import('../game/data/geo.js');
  for (const seed of [1, 7, 42]) {
    const g = makeGame('GEO', seed);
    const wet = g.world.hosts.filter((h) => h.company !== null && countryAt(h.x, h.y) === null);
    assert.equal(wet.length, 0, `seed ${seed}: ${wet.map((h) => h.name)}`);
  }
  const g = roomy(makeGame('OSINT', 7));
  const h = g.world.hosts.find((x) => x.company !== null && !x.discovered && g.world.people.some((p) => p.company === x.company));
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const box = { x: 0, y: 0, w: 1600, h: 900 };
  run(state, makeTerm(), `ping ${h.ip}`, box);
  assert.equal(h.discovered, false); // an IP nobody told you gets no answer
  run(state, makeTerm(), `ping ${h.name}`, box);
  assert.equal(h.discovered, true); // a name answers, no email needed
});

test('ls, dir, cd and cls move between your storage and the linked host', () => {
  const { g, h } = linked();
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const box = { x: 0, y: 0, w: 1600, h: 900 };
  const t = makeTerm();
  g.player.storage.length = 0;
  run(state, t, 'dir', box);
  assert.equal(t.lines.at(-1).text, '(empty)');
  run(state, t, 'cd nowhere', box);
  assert.match(t.lines.at(-1).text, /no such place/);
  run(state, t, `cd ${h.name}`, box);
  assert.equal(t.cwd, 'remote');
  run(state, t, 'ls', box);
  assert.equal(t.last.kind, 'rfile');
  run(state, t, 'cd ..', box);
  assert.equal(t.cwd, 'local');
  run(state, t, 'cls', box);
  assert.equal(t.lines.length, 0);
});

test('shell aliases and nmap, traceroute, cat, ps work from the prompt', () => {
  const { g, h } = linked();
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const box = { x: 0, y: 0, w: 1600, h: 900 };
  const say = (line) => { const t = makeTerm(); t.cwd = 'remote'; run(state, t, line, box); return t.lines.map((l) => l.text).join('\n'); };
  assert.match(say(`nmap ${h.name}`), /Nmap scan report/);
  assert.match(say(`traceroute ${h.ip}`), /traceroute to/);
  assert.match(say('ps'), /no processes|PID/);
  assert.match(say('pwd'), new RegExp(h.name));
  assert.match(say('nmap 203.0.113.9'), /Failed to resolve/);
  assert.match(say('hydra'), /started|already|every password lock/);
  assert.match(say('df'), /GB/);
  const f = h.files.find((x) => !x.deleted && !x.enc && x.content);
  if (f) assert.match(say(`cat ${f.name}`), new RegExp(f.content.split('\n')[0].slice(0, 6)));
});

test('company careers and press pages, LinkedUp and nslookup build and feed the dossier', async () => {
  const { buildPage } = await import('../pages/windows/dsn/pages.js');
  const { openingsOf, pressOf, namesOf } = await import('../game/state/siteInfo.js');
  const { siteUrl } = await import('../game/state/sites.js');
  const g = roomy(makeGame('WEB', 7));
  const ci = g.world.companies.findIndex((c, i) => g.world.people.some((p) => p.company === i));
  const site = siteUrl(g.world.companies[ci]);
  for (const url of [`${site}/careers`, `${site}/press`, 'linkedup.nx', `linkedup.nx/c/${ci}`, 'nslookup.nx']) {
    const page = buildPage(g, url, {});
    assert.ok(page.controls.length >= 1, url);
    assert.notEqual(page.title, '404', url);
  }
  assert.equal(JSON.stringify(openingsOf(g, ci)), JSON.stringify(openingsOf(g, ci)));
  assert.equal(pressOf(g, ci).length >= 2, true);
  // a lookup never gives an address for a host that is not on the map
  namesOf(g, ci).forEach((n) => assert.equal(n.ip === null, !g.world.hosts[n.id].discovered));
  const q = buildPage(g, 'nslookup.nx', { nsQuery: g.world.companies[ci].name });
  assert.ok(q.controls.some((c) => c.kind === 'keyValue'));
  // the staff buttons put the workplace on file
  const who = g.world.people.findIndex((p) => p.company === ci);
  const lu = buildPage(g, `linkedup.nx/c/${ci}`, {});
  assert.equal(lu.site, 'web'); // no DSNET side panel
  assert.equal(lu.controls[0].dom.type, 'lu-company');
  const { webBlock } = await import('../app/apps/dsnWeb.js');
  assert.match(webBlock(lu.controls[0].dom), new RegExp(`sp\.learn\.${who}\.workplace`));
});

test('bazaar sells, a sting costs heat, and pastedump and archive build', async () => {
  const { buildPage } = await import('../pages/windows/dsn/pages.js');
  const { sellFile, priceOf, isTrap } = await import('../game/state/bazaar.js');
  const g = roomy(makeGame('BZ', 7));
  g.player.storage.length = 0;
  g.player.storage.push({ name: 'a.csv', size: 2, enc: 1 }, { name: 'b.csv', size: 2, enc: 0 });
  const before = g.player.credits;
  assert.equal(sellFile(g, 0), false);
  const trap = isTrap(g, g.player.storage[1]);
  assert.equal(sellFile(g, 1), true);
  if (trap) assert.equal(g.player.credits, before);
  else assert.equal(g.player.credits, before + priceOf(g, { name: 'b.csv', size: 2 }));
  for (const url of ['bazaar.nx', 'pastedump.nx', 'archive.nx', 'archive.nx/0', 'board']) assert.notEqual(buildPage(g, url, {}).title, '404', url);
  assert.equal(buildPage(g, 'archive.nx/9999', {}).title, '404');
});

test('the board: post, replies arrive, a thread opens, a tip costs money and puts an email on file', async () => {
  const { buildPage } = await import('../pages/windows/dsn/pages.js');
  const { postThread, minePosts, buyTip, tipOf, feedOf, TIP_PRICE } = await import('../game/state/board.js');
  const g = roomy(makeGame('BD', 7));
  assert.equal(postThread(g, ' '), false);
  const heat = g.player.heat;
  assert.equal(postThread(g, 'anyone selling a mail export?'), true);
  assert.equal(g.player.heat, heat + 2);
  assert.equal(minePosts(g)[0].replies.length, 0);
  g.clock.minutes += 45;
  assert.equal(minePosts(g)[0].replies.length, 2);
  assert.equal(feedOf(g).length, 8);
  for (let i = 0; i < 8; i += 1) assert.notEqual(buildPage(g, `board/${i}`, {}).title, '404');
  assert.equal(buildPage(g, 'board/99', {}).title, '404');
  g.player.credits = 1000;
  const before = g.player.credits;
  assert.equal(buyTip(g, 0), true);
  assert.equal(g.player.credits, before - TIP_PRICE);
  assert.ok(tipOf(g, 0));
  assert.equal(buyTip(g, 0), false);
  assert.equal(g.player.credits, before - TIP_PRICE);
  g.player.credits = 5;
  assert.equal(buyTip(g, 1), false);
});

test('the world map draws (country outlines, pins) without throwing', async () => {
  const { drawMapWorld } = await import('../pages/windows/mapWorld.js');
  const { stubCtx } = await import('./stubCanvas.mjs');
  const g = roomy(makeGame('MAP', 7));
  const sk = new Proxy({}, { get: () => 0x88aacc });
  const view = {};
  drawMapWorld(stubCtx(), sk, { x: 0, y: 0, w: 900, h: 500 }, g, view, { mouse: { x: 10, y: 10 } });
});

test('ping lines come with real-time delays that the prompt waits out', () => {
  const g = roomy(makeGame('PING', 7));
  const state = { game: g, windows: { list: [], zTop: 10 }, win: {}, ui: {}, input: {}, view: { w: 1600, h: 900 } };
  const t = makeTerm();
  const before = Date.now();
  run(state, t, `ping ${g.world.hosts.find((x) => x.discovered).ip}`, { x: 0, y: 0, w: 1600, h: 900 });
  const replies = t.lines.filter((l) => /^Reply from/.test(l.text));
  assert.equal(replies.length, 4);
  assert.ok(replies[0].at >= before && replies[3].at - replies[0].at >= 2000);
  assert.equal(t.lines.at(-1).at >= replies[3].at, true);
});

test('paste texts come from data/pastes.json and fill their placeholders', async () => {
  const { pastesOf } = await import('../game/state/bazaar.js');
  const { pastes } = await import('../game/data/content.js');
  assert.ok(pastes().mail.length >= 3 && pastes().ssh.length >= 3);
  const g = roomy(makeGame('PST', 7));
  const list = pastesOf(g);
  assert.equal(list.length, 6);
  list.forEach((p) => assert.doesNotMatch(p.text, /\{[a-z]+\}/));
  assert.ok(list.some((p) => p.host && p.text.includes(p.host.domain)));
  assert.ok(list.some((p) => !p.host && p.text.includes(g.world.people[p.who].email)));
});

test('the four site templates render HTML and ask for no DSNET side panel', async () => {
  const { buildPage } = await import('../pages/windows/dsn/pages.js');
  const { webBlock } = await import('../app/apps/dsnWeb.js');
  const g = roomy(makeGame('TPL', 7));
  g.player.storage.push({ name: 'x.csv', size: 3, enc: 0 }, { name: 'y.csv', size: 1, enc: 1 });
  for (const url of ['linkedup.nx', 'linkedup.nx/c/0', 'bazaar.nx', 'pastedump.nx', 'archive.nx', 'archive.nx/0', 'archive.nx/0/1']) {
    const page = buildPage(g, url, {});
    assert.equal(page.site, 'web', url);
    const html = webBlock(page.controls[0].dom);
    assert.ok(html && html.length > 500, url);
    assert.doesNotMatch(html, /undefined|NaN/, url);
  }
  assert.match(webBlock(buildPage(g, 'bazaar.nx', {}).controls[0].dom), /bz\.sell\.0/);
});

test('mainsettings.json matches the built-in defaults, bad values fall back, and the world numbers are used', async () => {
  const { defaultSettings, setting, maxProfiles } = await import('../game/data/settings.js');
  const { content } = await import('../game/data/content.js');
  const { generateWorld } = await import('../game/data/world.js');
  const file = content().mainsettings;
  const { _note, ...values } = file;
  // the file lists every setting once, each in its range (its numbers may be changed on purpose, so they are not compared with the defaults)
  const { settingList, flatSettings } = await import('../game/data/settings.js');
  const { language, ...numbers } = flatSettings(values);
  const flat = numbers;
  assert.equal(language, 'en');
  assert.deepEqual(Object.keys(flat).sort(), settingList().map((x) => x.path).sort());
  settingList().forEach(({ path, min, max }) => assert.ok(flat[path] >= min && flat[path] <= max, path));
  assert.deepEqual(Object.keys(defaultSettings()).sort(), Object.keys(values).sort());
  assert.equal(maxProfiles(), flat['profiles.max']);
  const keep = content().mainsettings;
  try {
    content().mainsettings = { profiles: { max: 'lots' }, world: { companies: 12, population: 300, relays: -5 } };
    assert.equal(setting('profiles.max'), 4); // text: default
    assert.equal(setting('world.relays'), 10); // out of range: default
    const w = generateWorld(7);
    assert.equal(w.companies.length, 12);
    assert.equal(w.people.length, 300);
  } finally {
    content().mainsettings = keep;
  }
  const w = generateWorld(7);
  assert.equal(w.companies.length, flat['world.companies']);
  assert.equal(w.people.length, flat['world.population']);
});

test('the settings editor applies a good draft, refuses a bad one, and writes the file text', async () => {
  const { applySettings, currentSettings, settingsText, flatSettings, setting } = await import('../game/data/settings.js');
  const { content } = await import('../game/data/content.js');
  const keep = content().mainsettings;
  try {
    const draft = { ...currentSettings(), 'profiles.max': '6', 'jobs.maxActive': 5 };
    assert.deepEqual(applySettings(draft), []);
    assert.equal(setting('profiles.max'), 6);
    assert.equal(setting('jobs.maxActive'), 5);
    assert.equal(flatSettings(JSON.parse(settingsText()))['profiles.max'], 6);
    const bad = applySettings({ ...draft, 'world.companies': '3', 'bank.loanDays': 'x', 'jobs.maxActive': 2.5 });
    assert.equal(bad.length, 3);
    assert.equal(setting('profiles.max'), 6); // a refused draft changes nothing
  } finally {
    content().mainsettings = keep;
  }
});

test('every tl("key") in the code is in en.json, every key is used, and t() fills and falls back', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { t, languageCode, languages } = await import('../game/data/language.js');
  const en = JSON.parse(fs.readFileSync(new URL('../data/language/en.json', import.meta.url), 'utf8'));
  const used = new Set();
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\btl\('([^']+)'/g)) used.add(m[1]);
  });
  ['app', 'game', 'pages'].forEach((d) => walk(new URL(`../${d}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
  const missing = [...used].filter((k) => !(k in en));
  assert.deepEqual(missing, [], `keys used but not in en.json: ${missing.slice(0, 5)}`);
  const unused = Object.keys(en).filter((k) => !used.has(k));
  assert.deepEqual(unused, [], `keys in en.json that no code uses: ${unused.slice(0, 5)}`);
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(t('header.breach', 12), 'BREACH // 12s');
  assert.ok(languageCode() in languages());
});

test('notifications: every kind is shown until the Control Panel switches it off; heat alerts have their own switch', async () => {
  const { toastShown, NOTIFY } = await import('../game/state/gameHelpers.js');
  const g = { settings: {} };
  for (const kind of ['money', 'good', 'info', 'bad']) assert.equal(toastShown(g, { kind }), true, `${kind} is on by default`);
  g.settings.notify = { info: false, heat: false };
  assert.equal(toastShown(g, { kind: 'info' }), false);
  assert.equal(toastShown(g, { kind: 'bad' }), true, 'the other kinds are untouched');
  assert.equal(toastShown(g, { kind: 'bad', topic: 'heat' }), false, 'a heat alert follows its topic, not its kind');
  assert.deepEqual(NOTIFY, ['money', 'good', 'info', 'bad', 'heat']);
});
