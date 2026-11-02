// The companies' public websites: an address made from the name, one of ten
// looks picked from the seed, and the staff a company shows the world.

/// The ten looks a company site can have.
export const THEMES = [
  { name: 'CORPORATE BLUE', bg: '#f4f6fa', card: '#ffffff', ink: '#1d2733', dim: '#5f6b7a', accent: '#1f5fbf', head: '#1f5fbf', headInk: '#ffffff', layout: 'left' },
  { name: 'MIDNIGHT', bg: '#0e1420', card: '#172033', ink: '#e6ecf5', dim: '#8d9bb3', accent: '#59a6ff', head: '#0a0f18', headInk: '#59a6ff', layout: 'center' },
  { name: 'FOREST', bg: '#f1f5ef', card: '#ffffff', ink: '#1f2d1f', dim: '#5d6e5b', accent: '#2f7d3a', head: '#2f7d3a', headInk: '#ffffff', layout: 'banner' },
  { name: 'SUNSET', bg: '#fff7f0', card: '#ffffff', ink: '#33231a', dim: '#7a6152', accent: '#e0682a', head: '#e0682a', headInk: '#ffffff', layout: 'center' },
  { name: 'MONOCHROME', bg: '#ffffff', card: '#f5f5f5', ink: '#111111', dim: '#666666', accent: '#111111', head: '#111111', headInk: '#ffffff', layout: 'side' },
  { name: 'ROYAL', bg: '#f6f3fb', card: '#ffffff', ink: '#271b3a', dim: '#6b5d80', accent: '#6a3fb5', head: '#3b2366', headInk: '#e9dcff', layout: 'left' },
  { name: 'TERMINAL', bg: '#060a06', card: '#0c140c', ink: '#9cf59c', dim: '#4f8a4f', accent: '#36d936', head: '#0c140c', headInk: '#36d936', layout: 'side' },
  { name: 'OCEAN', bg: '#eef8fb', card: '#ffffff', ink: '#12313b', dim: '#557480', accent: '#0f8aa8', head: '#0f8aa8', headInk: '#ffffff', layout: 'banner' },
  { name: 'CRIMSON', bg: '#fbf3f3', card: '#ffffff', ink: '#2e1416', dim: '#7c5658', accent: '#b3242f', head: '#7d1820', headInk: '#ffffff', layout: 'center' },
  { name: 'SAND', bg: '#f8f4ea', card: '#fffdf7', ink: '#3a3222', dim: '#7a6e55', accent: '#a5832e', head: '#efe6cf', headInk: '#3a3222', layout: 'left' },
];

/// A number from the seed and some words: the same every time.
export function seedHash(game, ...parts) {
  let h = 2166136261;
  for (const ch of `${game.seed}:${parts.join(':')}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/// A company's web address.
export function siteUrl(c) {
  return `www.${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.nx`;
}

/// The look of a company's site.
export function siteTheme(game, ci) {
  return THEMES[seedHash(game, 'theme', ci) % THEMES.length];
}

/// The company a site address belongs to, or -1.
export function companyAt(game, addr) {
  const a = addr.replace(/^www\./, '');
  return game.world.companies.findIndex((c) => siteUrl(c).replace(/^www\./, '') === a);
}

/// The people on a company's books.
export function staffOf(game, ci) {
  const out = [];
  game.world.people.forEach((p, i) => {
    if (p.company === ci) out.push(i);
  });
  return out;
}

/// What a company says about itself.
const ABOUT = {
  lead: [
    'Founded on a simple idea: do the work properly, and the rest follows.',
    'For over two decades we have quietly kept the lights on for people who never think about us.',
    'We are a team of specialists who believe in long relationships and short meetings.',
    'Trusted by clients across the network, we combine experience with fresh thinking.',
  ],
  tail: [
    'Our people are our greatest asset. Meet some of them below.',
    'We are always hiring. If you are good at what you do, write to us.',
    'Security, discretion and reliability are at the heart of everything we do.',
    'We are proud of where we come from, and prouder of where we are going.',
  ],
};

/// The about-us text of a company, two or three sentences.
export function aboutText(game, ci, cityName) {
  const c = game.world.companies[ci];
  const pick = (list, k) => list[seedHash(game, k, ci) % list.length];
  return `${c.blurb ?? `${c.name} is based in ${cityName}.`} ${pick(ABOUT.lead, 'lead')} ${pick(ABOUT.tail, 'tail')}`;
}
