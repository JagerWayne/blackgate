import { label, para, keyValue, buttons, spacer } from '../../ui/controls.js';
import { flat, ghost } from '../../ui/styles.js';
import { darknet } from '../../data/content.js';
import { MISSION_LABEL, CO_LABEL, HOST_LABEL } from '../../data/enums.js';
import { HOME, links, banner, heading } from './shared.js';
import { listings, companyOf, cardsOr } from './market.js';

/// A leak site's profile of a company: what the network knows about it.
export function lookup(game, idx) {
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
export function board(game) {
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
export function search(game, q) {
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
export function about() {
  return {
    title: 'about',
    accent: 0x7fd4ff,
    controls: [
      heading('ABOUT DSNET'),
      para('A hidden network of hidden services. Every page you load is routed through three relays that know only their neighbours. The brokers here post the work; you pick it up, talk them up, and get it done.'),
      para('Rules of the house: no names, no logs, no asking for double.'),
    ],
  };
}

/// The start page: the two sites this machine knows.
export function startPage() {
  return {
    title: 'start',
    accent: 0x7fd4ff,
    site: 'web',
    controls: [
      banner(['INTERNET XPLORER', '   where do you want to go today?'], '#7fd4ff'),
      heading('BOOKMARKS'),
      links([[HOME, 'DSNET  //  the market for the anonymous: jobs, brokers, fees']]),
      label('the hidden market where clients post work', 10),
      links([['sleekpages', 'SleekPages  //  the social network: who works where, who posts what']]),
      label('people put their lives online. some of them leave the door open.', 10),
      links([['directory', 'Business Directory  //  the websites of every company on the network']]),
      label('about us, our team, contact: the staff pages are a gift to anyone looking', 10),
    ],
  };
}
