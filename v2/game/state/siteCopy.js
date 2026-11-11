// What a company's website says, by industry: a headline and three services.
// The numbers on a site (founded, offices, clients) come from the seed.

import { seedHash } from './sites.js';

/// A headline and three [title, text] services for each kind of company.
export const COPY = {
  tech: ['Software that just works.', [['Custom software', 'Applications built around the way your teams really work.'], ['Cloud hosting', 'Fast, monitored servers with a person on call all night.'], ['Support desk', 'Real engineers answer, and they stay until it is fixed.']]],
  bank: ['Your money, in careful hands.', [['Savings and deposits', 'Accounts that grow slowly, safely and without surprises.'], ['Business lending', 'Loans decided by people who read the whole application.'], ['Private banking', 'Discreet advice for clients with a lot to protect.']]],
  health: ['Care that comes first.', [['Clinics and check-ups', 'Same-week appointments with doctors who know your name.'], ['Laboratory services', 'Accurate results, delivered the day the sample arrives.'], ['Patient records', 'Your history, kept private and available when you need it.']]],
  retail: ['Everything you need, delivered.', [['Online store', 'Thousands of products with honest descriptions and fair prices.'], ['Fast delivery', 'Order before noon and it arrives tomorrow.'], ['Easy returns', 'Changed your mind? Send it back, no questions asked.']]],
  media: ['Stories that travel further.', [['News and features', 'Reporting you can trust, from people who were there.'], ['Studio production', 'Audio, video and print made to a high standard.'], ['Advertising', 'Reach the right readers without annoying them.']]],
  aiLab: ['Intelligence, applied carefully.', [['Applied research', 'Models built for hard problems, tested before they are trusted.'], ['Data platforms', 'Clean, labelled and well-governed data at any scale.'], ['Model audits', 'Independent checks on what your systems really do.']]],
  gov: ['Serving the public.', [['Citizen services', 'Licences, permits and records, handled in one place.'], ['Public safety', 'Coordination between agencies, day and night.'], ['Open records', 'Reports and figures published for anyone to read.']]],
  energy: ['Power you can rely on.', [['Generation', 'Steady supply from a mix of modern plants.'], ['Grid operations', 'Monitoring and repair crews on duty every hour.'], ['Efficiency advice', 'Cut your bills with a plan that fits your site.']]],
  telecom: ['Always connected.', [['Mobile plans', 'Clear prices and coverage where you actually live.'], ['Fibre broadband', 'Fast, symmetrical lines for homes and offices.'], ['Business networks', 'Private links with guaranteed uptime.']]],
  crypto: ['Digital assets, made simple.', [['Trading', 'Deep markets and low fees for every coin we list.'], ['Custody', 'Cold storage with insured vaults and clear audits.'], ['Payments', 'Send value anywhere in minutes.']]],
  security: ['We keep the doors locked.', [['Penetration testing', 'We break in first, so nobody else can.'], ['Monitoring', 'Round-the-clock watch on your systems and your premises.'], ['Incident response', 'When something goes wrong, we are on site within hours.']]],
  logistics: ['Moving the world, on time.', [['Freight', 'Road, rail, sea and air with one booking.'], ['Warehousing', 'Secure storage close to your customers.'], ['Tracking', 'Know where every parcel is, minute by minute.']]],
  university: ['Where ideas begin.', [['Degrees', 'Undergraduate and graduate programmes taught by working researchers.'], ['Research', 'Open labs, shared equipment and room to be curious.'], ['Student life', 'Housing, clubs and support for every year of study.']]],
};

/// The headline and the services of a company.
export function copyOf(c) {
  const [tag, services] = COPY[c.kind] ?? ['Quietly getting it done.', [['Consulting', 'Advice from people with real experience.'], ['Delivery', 'Projects finished on time and on budget.'], ['Support', 'We stay in touch after the work is done.']]];
  return { tag, services };
}

/// The figures on a site's home page.
export function factsOf(game, ci, staff) {
  return [
    [String(1965 + (seedHash(game, 'founded', ci) % 48)), 'Founded'],
    [String(staff), 'People'],
    [String(1 + (seedHash(game, 'offices', ci) % 9)), 'Offices'],
    [(120 + (seedHash(game, 'clients', ci) % 880)).toLocaleString('en-US'), 'Clients'],
  ];
}
