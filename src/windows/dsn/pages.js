// The pages of DeepSpaceN3T, built from the game each frame. A page is a title,
// an accent colour and a list of the shell's own form controls (a link is a
// flat button whose id carries the address it goes to). A page may also give
// two columns, which a wide browser shows side by side.

import { section, label, para, keyValue, buttons, field, chips, custom, spacer } from '../../ui/controls.js';
import { flat, ghost } from '../../ui/styles.js';
import { draw as drawText, FONT } from '../../core/text.js';
import { darknet, hint } from '../../data/content.js';
import { MISSION_LABEL, CO_LABEL, HOST_LABEL } from '../../data/enums.js';
import { contractLabel } from '../../state/contracts.js';
import { RECORD_LABEL, recordText } from '../../state/gameState.js';
import { broker, haggleOf, haggleOdds, snubbed, INSULT, MAX_ROUNDS } from '../../state/haggle.js';
import { wrapRow } from '../notepad.js';
import { jobCards } from './cards.js';
import { KIND_COLOR, hexOf, netPrimary, netSolid, netDanger } from './theme.js';

export const HOME = 'hub';
export const MY_JOBS = 'jobs';
const ASKS = [10, 25, 50];
const MAX_JOBS = 4;

/// An address without its scheme, trimmed and lower case.
export function normalize(url) {
  return String(url ?? '').trim().replace(/^dsn:\/\//i, '').replace(/\/+$/, '').toLowerCase() || HOME;
}

/// A link: a flat button in the accent colour that goes to an address.
const linkStyle = () => ({ ...flat(), dark: { ...flat().dark, text: 'accent' }, light: { ...flat().light, text: 'accent' } });
const link = (url, text) => ({ id: `dsn.go.${url}`, text, style: linkStyle() });
const links = (items) => buttons(items.map(([url, text]) => link(url, text)));
const money = (n) => `${n.toLocaleString('en-US')} cr`;

/// Lines of text art in a colour, on a dark strip: a site's banner.
function banner(lines, accent) {
  return custom(lines.length * 15 + 14, (ctx, sk, r) => {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = typeof accent === 'number' ? `#${accent.toString(16).padStart(6, '0')}` : accent;
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    lines.forEach((l, i) => drawText(ctx, l, r.x + 10, r.y + 6 + i * 15, 12, accent));
  });
}

/// A heading with a count, in the page's colour.
const heading = (text) => section(text);

/// The jobs on the open market: offered, from clients still dealing.
export function listings(game) {
  return game.contracts.filter((c) => c.state === 'offered' && !c.story && !snubbed(game, c.client));
}

/// The jobs the operator holds.
export function myJobs(game) {
  return game.contracts.filter((c) => c.state === 'accepted' || c.state === 'ready');
}

/// The company a job hits.
function companyOf(game, c) {
  return game.world.hosts[c.target]?.company ?? null;
}

/// A list of jobs as cards, or a line saying there are none.
const cardsOr = (game, jobs, none) => (jobs.length ? jobCards(game, jobs) : label(none, 10.5));

/// The portal: search, the newest and biggest work, the brokers.
function hub(game, view) {
  const all = listings(game);
  const top = [...all].sort((a, b) => b.reward - a.reward);
  const mine = myJobs(game);
  return {
    title: 'hub',
    accent: 0x7fd4ff,
    controls: [
      banner([
        ' ____  ____  _   _ _____ _____ ',
        '|  _ \\/ ___|| \\ | | ____|_   _|',
        '| | | \\___ \\|  \\| |  _|   | |  ',
        '| |_| |___) | |\\  | |___  | |  ',
        '|____/|____/|_| \\_|_____| |_|  ',
        '   THE MARKET FOR THE ANONYMOUS',
      ], '#7fd4ff'),
      field('dsn.search', view.query ?? '', 'search listings, brokers, companies'),
      buttons([{ id: 'dsn.search.go', text: 'SEARCH', style: netPrimary() }]),
      ...(mine.length ? [heading(`YOUR JOBS // ${mine.length} OF ${MAX_JOBS}`), links([[MY_JOBS, `manage your ${mine.length} job${mine.length > 1 ? 's' : ''} → MY JOBS`]])] : []),
      heading(`ON THE MARKET // ${all.length} OPEN`),
      cardsOr(game, top, 'the market is quiet. come back in an hour.'),
      heading('BROKERS'),
      ...Object.entries(darknet().brokers).flatMap(([name, b]) => [
        links([[b.domain, `${b.domain}  // ${name}`]]),
        label(b.tagline, 10, hexOf(b.accent)),
      ]),
      heading('ELSEWHERE'),
      links([['board', 'the undernet board // rumours'], ['about', 'about this network']]),
      label('stay anonymous. bounce your route. never haggle for double.', 9.5, 0x5d6b88),
    ],
  };
}

/// One category: every listing of a kind.
function category(game, kind) {
  const cat = darknet().categories[kind];
  if (!cat) return null;
  const jobs = listings(game).filter((c) => c.kind === kind);
  return {
    title: cat.name.toLowerCase(),
    accent: KIND_COLOR[kind],
    controls: [
      banner([`// ${cat.name}`, `   ${cat.blurb}`], KIND_COLOR[kind]),
      heading(`${jobs.length} OPEN`),
      cardsOr(game, jobs, 'no listings in this category right now'),
    ],
  };
}

/// A broker's own site: their banner, their pitch, their listings.
function brokerSite(game, name, about) {
  const b = broker(name);
  const accent = hexOf(b.accent);
  const jobs = listings(game).filter((c) => c.client === name);
  const off = snubbed(game, name);
  const footer = label(`SIGNED // PGP 4096 // ESCROW 72H // ${b.domain}`, 9, 0x5d6b88);
  const base = [banner(b.banner, b.accent), label(b.tagline, 11, accent)];
  if (about) {
    const temper = b.temper > 1.1 ? 'STUBBORN' : b.temper < 0.95 ? 'FLEXIBLE' : 'FIRM';
    return {
      title: `${b.domain}/about`,
      accent,
      controls: [...base, heading('ABOUT'), para(b.about), keyValue('HAGGLING', temper), links([[b.domain, '< their listings']]), footer],
    };
  }
  return {
    title: b.domain,
    accent,
    controls: [
      ...base,
      heading(off ? 'CLOSED TO YOU' : `LISTINGS // ${jobs.length}`),
      off ? para('You asked for too much. This broker is not dealing with you today.') : cardsOr(game, jobs, 'nothing posted right now'),
      links([[`${b.domain}/about`, 'about us']]),
      footer,
    ],
  };
}

/// The deal panel of a listing: the fee, the asks, the chat with the client.
function dealPanel(game, c, b, view) {
  const hg = haggleOf(game, c.id);
  const accent = hexOf(b.accent);
  const out = [heading('THE DEAL'), keyValue('FEE', money(c.reward), 0xffc857)];
  if (c.state === 'offered') {
    const full = game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length >= MAX_JOBS;
    out.push(buttons([{ id: `dsn.accept.${c.id}`, text: `ACCEPT AT ${money(c.reward)}`, style: { ...netSolid(), disabled: full, isDefault: true } }]));
    if (full) out.push(label(hint('contractCapacity'), 10, 0xffc857));
  } else if (c.state === 'accepted' || c.state === 'ready') {
    out.push(links([[MY_JOBS, 'this job is yours → MY JOBS']]));
  }
  out.push(heading(`CHANNEL // ${c.client}`));
  out.push(chatConsole(c, b, hg));
  if (c.state !== 'offered') return [...out, label('the listing is closed', 10)];
  if (snubbed(game, c.client)) return [...out, label(`${c.client} is not taking your calls`, 10, 0xff6b6b)];
  if (!hg) {
    out.push(para('Ask for a bigger fee. Your rating raises the odds; a bigger ask lowers them. One ask per job; more than double and they pull the listing.', FONT.body));
    ASKS.forEach((pct) => {
      const ask = Math.round(c.reward * (1 + pct / 100));
      out.push(buttons([{ id: `dsn.ask.${c.id}.${pct}`, text: `ASK +${pct}% → ${money(ask)} // ${Math.round(haggleOdds(game, c, ask) * 100)}% chance`, style: ghost() }]));
    });
    out.push(field('dsn.askfield', view.ask ?? '', `or an exact amount, more than ${c.reward}`));
    const typed = Number(view.ask);
    let odds = '';
    if (typed > c.reward) odds = typed / c.reward > INSULT ? 'an insult' : `${Math.round(haggleOdds(game, c, typed) * 100)}% chance`;
    out.push(buttons([{ id: `dsn.askexact.${c.id}`, text: `ASK${odds ? ` // ${odds}` : ''}`, style: ghost() }]));
  } else if (hg.state === 'counter') {
    out.push(buttons([{ id: `dsn.take.${c.id}`, text: `TAKE ${money(hg.counter)} AND ACCEPT`, style: netPrimary() }]));
    if ((hg.round ?? 1) < MAX_ROUNDS) {
      out.push(field('dsn.askfield', view.ask ?? '', `counter: between ${hg.counter} and ${hg.ask}`));
      const typed = Number(view.ask);
      const ok = typed > hg.counter && typed < hg.ask;
      const odds = ok ? ` // ${Math.round(haggleOdds(game, c, typed) * 70)}% chance` : '';
      out.push(buttons([{ id: `dsn.counter.${c.id}`, text: `COUNTER${odds}`, style: { ...ghost(), disabled: !ok } }]));
    } else out.push(label('last offer: take it or walk away', FONT.body, 0xffc857));
  }
  if (hg?.state !== 'waiting') {
    const sure = view.armed === `dsn.decline.${c.id}`;
    out.push(buttons([{ id: `dsn.decline.${c.id}`, text: sure ? 'CONFIRM: WALK AWAY' : 'DECLINE THE JOB', style: sure ? netDanger() : flat() }]));
  }
  return out;
}

/// A listing: the brief and the target on the left, the deal on the right.
function job(game, id, view) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.story) return null;
  const b = broker(c.client);
  const coIdx = companyOf(game, c);
  const co = game.world.companies[coIdx];
  const h = game.world.hosts[c.target];
  const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
  const kind = KIND_COLOR[c.kind];
  const left = [
    banner([`#${c.id} // ${(c.title || contractLabel(c)).toUpperCase()}`], kind),
    chips([[MISSION_LABEL[c.kind], kind], [`${hours}h LEFT`, hours < 6 ? 0xff6b6b : 0x8c9cb8], [c.state === 'offered' ? 'OPEN' : c.state.toUpperCase(), c.state === 'offered' ? 0x5be49b : 0xffc857]]),
    para(c.brief.replace(/[{}]/g, '')),
    heading('TARGET'),
    keyValue('COMPANY', co?.name ?? 'unknown'),
    keyValue('HOST', `${h?.name ?? ''} // ${h?.ip ?? ''}`),
    keyValue('SECURITY', `FW ${h?.firewall ?? 0} / MON ${h?.monitor ?? 0} / PX ${h?.proxy ?? 0}`),
    ...(c.file ? [keyValue('FILE', c.file)] : []),
    ...(c.record ? [keyValue('CHANGE', `${RECORD_LABEL[c.record.field]} → ${recordText(game, c.record.field, c.record.value)}`, 0xffc857)] : []),
    buttons([{ id: `ct.track.${c.id}`, text: 'SHOW ON MAP', style: ghost() }]),
    links([[`lookup/${coIdx}`, `LEAKBASE profile of ${co?.name ?? 'the target'}`], [b.domain, `more from ${c.client}`]]),
  ];
  const right = dealPanel(game, c, b, view);
  return { title: `job/${c.id}`, accent: kind, controls: [...left, ...right], columns: [left, right] };
}

/// MY JOBS: the work in hand, the deals being talked over, and the history.
function jobsPage(game, view) {
  const mine = myJobs(game);
  const talking = game.contracts.filter((c) => c.state === 'offered' && haggleOf(game, c.id) && ['waiting', 'counter'].includes(haggleOf(game, c.id).state));
  const past = game.contracts.filter((c) => ['done', 'paid', 'failed', 'expired'].includes(c.state)).slice(-12).reverse();
  const out = [heading(`IN PROGRESS // ${mine.length} OF ${MAX_JOBS}`)];
  if (!mine.length) out.push(label('no jobs in hand // pick one from the market', 10.5), links([[HOME, 'browse the market']]));
  mine.forEach((c) => {
    const h = game.world.hosts[c.target];
    const linked = game.session?.target === c.target;
    const ready = c.state === 'ready';
    const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
    out.push(
      links([[`job/${c.id}`, `#${c.id}  ${(c.title || contractLabel(c)).toUpperCase()}`]]),
      label(`${money(c.reward)} // ${h?.name ?? ''} (${h?.ip ?? ''}) // ${hours}h left // ${c.client}`, 10),
      chips([[ready ? 'READY TO SUBMIT' : 'WORK NOT DONE', ready ? 0x5be49b : 0xffc857]]),
      buttons([
        { id: `ct.submit.${c.id}`, text: 'SUBMIT WORK', style: { ...netSolid(), disabled: !ready } },
        { id: `ct.link.${c.id}`, text: linked ? 'LINK IS OPEN' : 'LINK NOW', style: { ...netPrimary(), disabled: linked || !!game.session } },
        { id: `ct.track.${c.id}`, text: 'SHOW ON MAP', style: ghost() },
        { id: `dsn.drop.${c.id}`, text: view.dropArm === c.id ? 'SURE? DROP IT' : 'DROP', style: netDanger() },
      ]),
      spacer(8),
    );
  });
  out.push(heading(`NEGOTIATING // ${talking.length}`));
  if (!talking.length) out.push(label('no deals waiting on a reply', 10));
  talking.forEach((c) => out.push(links([[`job/${c.id}`, `#${c.id} ${c.client} // ${haggleOf(game, c.id).state === 'counter' ? `counter-offer ${money(haggleOf(game, c.id).counter)}` : 'waiting for a reply'}`]])));
  out.push(heading('HISTORY'));
  if (!past.length) out.push(label('nothing yet', 10));
  past.forEach((c) => out.push(label(`#${c.id}  ${pad(c.state.toUpperCase(), 9)} ${money(c.reward)} // ${contractLabel(c)} // ${c.client}`, 10, c.state === 'failed' || c.state === 'expired' ? 0xff6b6b : 0x8c9cb8)));
  return { title: 'my jobs', accent: 0x5be49b, controls: [banner(['// MY JOBS', '   your work, your deals, your record'], '#5be49b'), ...out] };
}

const pad = (s, n) => String(s).padEnd(n);

/// A leak site's profile of a company: what the network knows about it.
function lookup(game, idx) {
  const co = game.world.companies[idx];
  if (!co) return null;
  const staff = game.world.people.filter((p) => p.company === idx).length;
  const known = co.hosts.filter((id) => game.world.hosts[id].discovered);
  const onFile = game.world.people.filter((p, i) => p.company === idx && game.intel?.[i]).length;
  const work = listings(game).filter((c) => companyOf(game, c) === idx);
  return {
    title: `leakbase/${co.short}`,
    accent: 0xff6b6b,
    controls: [
      banner(['LEAKBASE // everything they wish you did not know'], '#ff6b6b'),
      heading(co.name.toUpperCase()),
      keyValue('SECTOR', CO_LABEL[co.kind] ?? co.kind),
      para(co.blurb),
      keyValue('STAFF', `${staff} // ${onFile} on your file`),
      buttons([{ id: 'dsn.dossiers', text: 'OPEN DOSSIERS', style: ghost() }]),
      heading(`HOSTS YOU KNOW // ${known.length} OF ${co.hosts.length}`),
      ...known.map((id) => buttons([{ id: `dsn.map.${id}`, text: `${game.world.hosts[id].name} // ${HOST_LABEL[game.world.hosts[id].kind] ?? ''} // show on map`, style: flat() }])),
      label(known.length < co.hosts.length ? 'an OSINT sweep on one of their hosts finds the rest' : 'every host is on your map', 10),
      heading(`WORK AGAINST THEM // ${work.length}`),
      cardsOr(game, work, 'no open listings'),
    ],
  };
}

/// The rumour board: posts that change with the day.
function board(game) {
  const d = darknet();
  const day = Math.floor(game.clock.minutes / 1440);
  const names = Object.keys(d.brokers);
  const cos = game.world.companies;
  const headline = game.news.at(-1)?.headline ?? 'nothing happened';
  const posts = d.forum.map((t, i) => {
    const k = day * 7 + i * 13;
    return t.replace('{client}', names[k % names.length]).replace('{co}', cos[k % cos.length]?.name ?? 'someone').replace('{headline}', headline);
  });
  const shown = posts.map((p, i) => [p, (day * 31 + i * 17) % posts.length]).sort((a, b) => a[1] - b[1]).slice(0, 6);
  return {
    title: 'the undernet board',
    accent: 0xc39bff,
    controls: [
      banner(['>>> THE UNDERNET BOARD <<<', '    trust nobody. post anyway.'], '#c39bff'),
      ...shown.flatMap(([text], i) => [label(`anon_${((day * 97 + i * 31) % 9000) + 1000} // ${i + 1}h ago`, 9.5, 0x8c9cb8), para(text), spacer(6)]),
    ],
  };
}

/// Search: listings, brokers and companies whose words match.
function search(game, q) {
  const w = q.toLowerCase();
  const jobs = listings(game).filter((c) => `${c.title} ${c.brief} ${c.client} ${MISSION_LABEL[c.kind]}`.toLowerCase().includes(w));
  const brokers = Object.entries(darknet().brokers).filter(([n, b]) => `${n} ${b.domain} ${b.tagline}`.toLowerCase().includes(w));
  const cos = game.world.companies.map((c, i) => [c, i]).filter(([c]) => c.name.toLowerCase().includes(w)).slice(0, 8);
  return {
    title: `search: ${q}`,
    accent: 0x7fd4ff,
    controls: [
      heading(`LISTINGS MATCHING "${q}" // ${jobs.length}`),
      cardsOr(game, jobs, 'no listings match'),
      heading('BROKERS'),
      brokers.length ? links(brokers.map(([n, b]) => [b.domain, n])) : label('none', 10),
      heading('COMPANIES'),
      cos.length ? links(cos.map(([c, i]) => [`lookup/${i}`, c.name])) : label('none', 10),
    ],
  };
}

/// About the network.
function about() {
  return {
    title: 'about',
    accent: 0x7fd4ff,
    controls: [
      heading('ABOUT DeepSpaceN3T'),
      para('A hidden network of hidden services. Every page you load is routed through three relays that know only their neighbours. The brokers here post the work; you pick it up, talk them up, and get it done.'),
      para('Rules of the house: no names, no logs, no asking for double.'),
    ],
  };
}

/// The broker whose site lives at a domain, or null.
function brokerAt(game, domain) {
  const named = Object.keys(darknet().brokers).find((n) => darknet().brokers[n].domain === domain);
  return named ?? game.contracts.map((c) => c.client).find((n) => broker(n).domain === domain) ?? null;
}

/// The page for an address, or a 404.
export function buildPage(game, url, view = {}) {
  const u = normalize(url);
  const head = u.split('/')[0];
  const rest = u.split('/').slice(1).join('/');
  let page = null;
  if (u === HOME) page = hub(game, view);
  else if (u === MY_JOBS) page = jobsPage(game, view);
  else if (head === 'cat') page = category(game, rest);
  else if (head === 'job') page = job(game, Number(rest), view);
  else if (head === 'lookup') page = lookup(game, Number(rest));
  else if (u === 'board') page = board(game);
  else if (u === 'about') page = about();
  else if (head === 'search') page = search(game, decodeURIComponent(rest));
  else {
    const name = brokerAt(game, head);
    if (name) page = brokerSite(game, name, rest === 'about');
  }
  if (page) return { ...page, url: u };
  const lines = darknet().notFound;
  return {
    url: u,
    title: '404',
    accent: 0xff6b6b,
    controls: [banner(['404'], '#ff6b6b'), para(lines[u.length % lines.length]), links([[HOME, 'back to the hub']])],
  };
}

const CHAT_PAD = 10;
const CHAT_LH = 18;
let lastCtx = null;

/// The chat with the client, laid out to a width: a header line per message
/// (who and when), then its text wrapped to the bubble.
function chatRows(ctx, log, w) {
  const rows = [];
  log.forEach((m) => {
    const mine = m.who === 'you';
    const t = `${String(Math.floor(m.minute / 60) % 24).padStart(2, '0')}:${String(m.minute % 60).padStart(2, '0')}`;
    rows.push({ head: true, mine, text: `${mine ? 'YOU' : m.who.toUpperCase()}  ${t}` });
    wrapRow(ctx, m.text, w * 0.75 - 16).forEach((line) => rows.push({ mine, text: line }));
    rows.push({ gap: true });
  });
  return rows;
}

/// A chat console: a dark framed box, the client on the left in their colour,
/// you on the right in blue, a status line along the bottom.
function chatConsole(c, b, hg) {
  const log = hg?.log ?? [];
  const status = !hg ? 'channel open // make your ask below'
    : hg.state === 'waiting' ? `${c.client} is typing…`
      : hg.state === 'counter' ? 'counter-offer on the table'
        : c.state === 'offered' ? 'talks over' : 'channel closed';
  // the height needs a context to measure with: the last one drawn with
  const measure = (w) => (lastCtx ? chatRows(lastCtx, log, w).length : log.length * 4);
  return custom((w) => Math.max(measure(w) * CHAT_LH, 30) + CHAT_PAD * 2 + 26, (ctx, sk, r) => {
    lastCtx = ctx;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.clip();
    let y = r.y + CHAT_PAD;
    if (!log.length) drawText(ctx, '-- no messages yet --', r.x + r.w / 2, y + 6, FONT.body, '#55607a', { align: 'center' });
    chatRows(ctx, log, r.w).forEach((row) => {
      if (row.gap) { y += CHAT_LH / 2; return; }
      const x = row.mine ? r.x + r.w - CHAT_PAD : r.x + CHAT_PAD;
      const col = row.head ? '#55607a' : row.mine ? '#7fd4ff' : b.accent;
      drawText(ctx, row.text, x, y, FONT.body, col, { align: row.mine ? 'right' : 'left' });
      y += CHAT_LH;
    });
    ctx.restore();
    // the status line
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(r.x + 1, r.y + r.h - 24, r.w - 2, 23);
    drawText(ctx, `● ${status}`, r.x + CHAT_PAD, r.y + r.h - 12, FONT.body, hg?.state === 'waiting' ? '#ffc857' : '#55607a', { baseline: 'middle' });
  });
}
