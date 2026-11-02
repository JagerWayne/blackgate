// The pages of DeppSpaceNET, built from the game each frame. A page is a title,
// an accent colour and a list of the shell's own form controls: a link is a
// flat button whose id carries the address it goes to.

import { section, label, para, keyValue, buttons, field, chips, divider, custom, spacer } from '../../ui/controls.js';
import { flat, ghost, primary, solid } from '../../ui/styles.js';
import { draw as drawText, FONT } from '../../core/text.js';
import { darknet } from '../../data/content.js';
import { MISSION_LABEL, CO_LABEL, HOST_LABEL } from '../../data/enums.js';
import { contractLabel } from '../../state/contracts.js';
import { broker, haggleOf, haggleOdds, snubbed, INSULT } from '../../state/haggle.js';

export const HOME = 'hub';
const ASKS = [10, 25, 50];

/// An address without its scheme, trimmed and lower case.
export function normalize(url) {
  return String(url ?? '').trim().replace(/^dsn:\/\//i, '').replace(/\/+$/, '').toLowerCase() || HOME;
}

/// A link: a flat button that goes to an address.
const link = (url, text) => ({ id: `dsn.go.${url}`, text, style: { ...flat(), dark: { ...flat().dark, text: 'accent' }, light: { ...flat().light, text: 'accent' } } });
const links = (items) => buttons(items.map(([url, text]) => link(url, text)));
const money = (n) => `${n.toLocaleString('en-US')} cr`;
const hex = (s) => parseInt(String(s).replace('#', ''), 16);

/// Lines of text art in a colour: a site's banner.
function banner(lines, accent) {
  return custom(lines.length * 15 + 10, (ctx, sk, r) => {
    // a dark strip, so the art reads the same in both skins
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    lines.forEach((l, i) => drawText(ctx, l, r.x + 8, r.y + 5 + i * 15, 12, accent));
  });
}

/// The jobs on the open market: offered, from clients still dealing.
function listings(game) {
  return game.contracts.filter((c) => c.state === 'offered' && !c.story && !snubbed(game, c.client));
}

/// The company a job hits.
function companyOf(game, c) {
  return game.world.hosts[c.target]?.company ?? null;
}

/// Difficulty as five stars.
function stars(d) {
  const n = Math.max(1, Math.min(d ?? 1, 5));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/// One listing as a card: what, for how much, by when, by whom.
function card(game, c) {
  const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
  const co = game.world.companies[companyOf(game, c)]?.name ?? 'unknown';
  const hg = haggleOf(game, c.id);
  return [
    links([[`job/${c.id}`, `#${c.id}  ${(c.title || contractLabel(c)).toUpperCase()}`]]),
    label(`${MISSION_LABEL[c.kind]} // ${co} // ${money(c.reward)} // ${hours}h left // ${stars(c.difficulty)}${hg ? ` // ${hg.state.toUpperCase()}` : ''}`, 9.5),
    links([[broker(c.client).domain, `posted by ${c.client}`]]),
    spacer(4),
  ];
}

/// The portal: search, categories, featured work, the brokers.
function hub(game, view) {
  const all = listings(game);
  const cats = darknet().categories;
  const top = [...all].sort((a, b) => b.reward - a.reward).slice(0, 3);
  return {
    title: 'DeppSpaceNET // hub',
    accent: 0x7fd4ff,
    controls: [
      banner([
        ' ___                ___                    _  _ ___ _____ ',
        '|   \\ ___ _ __ _ __/ __|_ __  __ _ __ ___| \\| | __|_   _|',
        '| |) / -_) \'_ \\ \'_ \\__ \\ \'_ \\/ _` / _/ -_) .` | _|  | |  ',
        '|___/\\___| .__/ .__/___/ .__/\\__,_\\__\\___|_|\\_|___| |_|  ',
        '         |_|  |_|      |_|   the hidden market for quiet work',
      ], '#7fd4ff'),
      field('dsn.search', view.query ?? '', 'search listings, brokers, companies'),
      buttons([{ id: 'dsn.search.go', text: 'SEARCH', style: primary() }]),
      section(`CATEGORIES // ${all.length} OPEN LISTINGS`),
      ...Object.entries(cats).flatMap(([kind, cat]) => [
        links([[`cat/${kind}`, `${cat.name} (${all.filter((c) => c.kind === kind).length})`]]),
        label(cat.blurb, 9.5),
      ]),
      section('FEATURED // THE BIGGEST FEES'),
      ...(top.length ? top.flatMap((c) => card(game, c)) : [label('the market is quiet. come back in an hour.', 9.5)]),
      section('BROKERS'),
      ...Object.entries(darknet().brokers).flatMap(([name, b]) => [
        links([[b.domain, `${b.domain}  // ${name}`]]),
        label(b.tagline, 9.5),
      ]),
      section('ELSEWHERE'),
      links([['board', 'the undernet board // rumours'], ['about', 'about this network']]),
      divider(),
      label('stay anonymous. bounce your route. never haggle for double.', 9.5),
    ],
  };
}

/// One category: every listing of a kind.
function category(game, kind) {
  const cat = darknet().categories[kind];
  if (!cat) return null;
  const jobs = listings(game).filter((c) => c.kind === kind);
  return {
    title: `${cat.name} // DeppSpaceNET`,
    accent: 0x7fd4ff,
    controls: [
      section(cat.name),
      para(cat.blurb),
      ...(jobs.length ? jobs.flatMap((c) => card(game, c)) : [label('no listings in this category right now', 9.5)]),
      links([[HOME, '< back to the hub']]),
    ],
  };
}

/// A broker's own site: their banner, their pitch, their listings.
function brokerSite(game, name, about) {
  const b = broker(name);
  const jobs = listings(game).filter((c) => c.client === name);
  const off = snubbed(game, name);
  const base = [banner(b.banner, b.accent), label(b.tagline, 10.5, hex(b.accent))];
  if (about) {
    const temper = b.temper > 1.1 ? 'STUBBORN' : b.temper < 0.95 ? 'FLEXIBLE' : 'FIRM';
    return {
      title: `${b.domain}/about`,
      accent: hex(b.accent),
      controls: [...base, section('ABOUT'), para(b.about), keyValue('HAGGLING', temper), links([[b.domain, '< listings']])],
    };
  }
  let body;
  if (off) body = [para('You asked for too much. This broker is not dealing with you today.')];
  else if (jobs.length) body = jobs.flatMap((c) => card(game, c));
  else body = [label('nothing posted right now', 9.5)];
  return {
    title: b.domain,
    accent: hex(b.accent),
    controls: [
      ...base,
      section(off ? 'CLOSED TO YOU' : `LISTINGS // ${jobs.length}`),
      ...body,
      links([[`${b.domain}/about`, 'about us'], [HOME, 'hub']]),
    ],
  };
}

/// The negotiation part of a listing: the channel with the client.
function channel(game, c, b, view) {
  const hg = haggleOf(game, c.id);
  const out = [section(`CHANNEL // ${c.client}`)];
  // the chat, on a dark strip like a terminal, so it reads in both skins
  const log = hg?.log ?? [];
  if (log.length) {
    out.push(custom(log.length * 18 + 12, (ctx, sk, r) => {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      log.forEach((m, i) => {
        const mine = m.who === 'you';
        drawText(ctx, `${mine ? '>' : '<'} ${m.who.toUpperCase()}: ${m.text}`, r.x + 8, r.y + 6 + i * 18, 11, mine ? '#7fd4ff' : b.accent);
      });
    }));
  }
  if (c.state !== 'offered') return [...out, label('this listing is closed', 9.5)];
  if (snubbed(game, c.client)) return [...out, label(`${c.client} is not taking your calls`, 9.5, 0xe06c75)];
  if (!hg) {
    out.push(para('Contact the client to ask for a bigger fee. The higher your rating, the likelier a yes; the bigger the ask, the likelier a no. One ask per job. Ask for more than double and they pull the listing.', FONT.body));
    out.push(buttons(ASKS.map((pct) => {
      const ask = Math.round(c.reward * (1 + pct / 100));
      return { id: `dsn.ask.${c.id}.${pct}`, text: `+${pct}% → ${money(ask)} (${Math.round(haggleOdds(game, c, ask) * 100)}%)`, style: ghost() };
    })));
    out.push(field('dsn.askfield', view.ask ?? '', `or an exact amount, more than ${c.reward}`));
    const typed = Number(view.ask);
    let odds = '';
    if (typed > c.reward) odds = typed / c.reward > INSULT ? 'an insult' : `${Math.round(haggleOdds(game, c, typed) * 100)}% chance`;
    out.push(buttons([{ id: `dsn.askexact.${c.id}`, text: `ASK${odds ? ` // ${odds}` : ''}`, style: ghost() }]));
  } else if (hg.state === 'waiting') {
    out.push(label(`${c.client} is typing…`, 10, hex(b.accent)));
  } else if (hg.state === 'counter') {
    out.push(buttons([{ id: `dsn.take.${c.id}`, text: `TAKE ${money(hg.counter)} AND ACCEPT`, style: primary() }]));
  }
  return out;
}

/// A listing: the brief, the terms, the target, and the chat with the client.
function job(game, id, view) {
  const c = game.contracts.find((x) => x.id === id);
  if (!c || c.story) return null;
  const b = broker(c.client);
  const coIdx = companyOf(game, c);
  const co = game.world.companies[coIdx];
  const hours = Math.max(Math.floor((c.deadline - game.clock.minutes) / 60), 0);
  const open = c.state === 'offered';
  const controls = [
    section(`#${c.id} // ${(c.title || contractLabel(c)).toUpperCase()}`),
    chips([[MISSION_LABEL[c.kind], hex(b.accent)], [stars(c.difficulty), 0xe5c07b], [open ? 'OPEN' : c.state.toUpperCase(), open ? 0x9be564 : 0xe06c75]]),
    para(c.brief.replace(/[{}]/g, '')),
    keyValue('FEE', money(c.reward)),
    keyValue('WINDOW', `${hours} hours`),
    keyValue('TARGET', `${co?.name ?? 'unknown'} // ${game.world.hosts[c.target]?.name ?? ''}`),
    links([[`lookup/${coIdx}`, `leak profile of ${co?.name ?? 'the target'}`], [b.domain, `client: ${c.client}`]]),
  ];
  if (open) controls.push(buttons([{ id: `dsn.accept.${c.id}`, text: `ACCEPT AT ${money(c.reward)}`, style: solid() }]));
  controls.push(...channel(game, c, b, view));
  controls.push(links([[`cat/${c.kind}`, `< ${darknet().categories[c.kind]?.name ?? 'category'}`], [HOME, 'hub']]));
  return { title: `job/${c.id} // ${b.domain}`, accent: hex(b.accent), controls };
}

/// A leak site's profile of a company: what the network knows about it.
function lookup(game, idx) {
  const co = game.world.companies[idx];
  if (!co) return null;
  const staff = game.world.people.filter((p) => p.company === idx).length;
  const known = co.hosts.filter((id) => game.world.hosts[id].discovered);
  const onFile = game.world.people.filter((p, i) => p.company === idx && game.intel?.[i]).length;
  const work = listings(game).filter((c) => companyOf(game, c) === idx);
  return {
    title: `leakbase.dsn/${co.short}`,
    accent: 0xe06c75,
    controls: [
      banner(['LEAKBASE // everything they wish you did not know'], '#e06c75'),
      section(co.name.toUpperCase()),
      keyValue('SECTOR', CO_LABEL[co.kind] ?? co.kind),
      para(co.blurb),
      keyValue('STAFF', `${staff} // ${onFile} on your file`),
      buttons([{ id: 'dsn.dossiers', text: 'OPEN DOSSIERS', style: ghost() }]),
      section(`HOSTS YOU KNOW // ${known.length} OF ${co.hosts.length}`),
      ...known.map((id) => buttons([{ id: `dsn.map.${id}`, text: `${game.world.hosts[id].name} // ${HOST_LABEL[game.world.hosts[id].kind] ?? ''} // show on map`, style: flat() }])),
      label(known.length < co.hosts.length ? 'an OSINT sweep on one of their hosts finds the rest' : 'every host is on your map', 9.5),
      section('WORK AGAINST THEM'),
      ...(work.length ? work.flatMap((c) => card(game, c)) : [label('no open listings', 9.5)]),
      links([[HOME, 'hub']]),
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
    title: 'board.dsn // the undernet board',
    accent: 0xc792ea,
    controls: [
      banner(['>>> THE UNDERNET BOARD <<<', '    trust nobody. post anyway.'], '#c792ea'),
      ...shown.flatMap(([text], i) => [label(`anon_${((day * 97 + i * 31) % 9000) + 1000} // ${i + 1}h ago`, 9, 0x888888), para(text), spacer(4)]),
      links([[HOME, 'hub']]),
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
    title: `search // ${q}`,
    accent: 0x7fd4ff,
    controls: [
      section(`RESULTS FOR "${q}"`),
      ...(jobs.length ? jobs.flatMap((c) => card(game, c)) : [label('no listings match', 9.5)]),
      section('BROKERS'),
      brokers.length ? links(brokers.map(([n, b]) => [b.domain, n])) : label('none', 9.5),
      section('COMPANIES'),
      cos.length ? links(cos.map(([c, i]) => [`lookup/${i}`, c.name])) : label('none', 9.5),
      links([[HOME, 'hub']]),
    ],
  };
}

/// About the network.
function about() {
  return {
    title: 'about // DeppSpaceNET',
    accent: 0x7fd4ff,
    controls: [
      section('ABOUT DeppSpaceNET'),
      para('A hidden network of hidden services. Every page you load is routed through three relays that know only their neighbours. The brokers here post the work; you pick it up, talk them up, and get it done.'),
      para('Rules of the house: no names, no logs, no asking for double.'),
      links([[HOME, 'hub']]),
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
    title: '404 // DeppSpaceNET',
    accent: 0xe06c75,
    controls: [section('404'), para(lines[u.length % lines.length]), links([[HOME, 'back to the hub']])],
  };
}
