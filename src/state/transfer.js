// The pipe: how fast a copy goes, and how long a hard host keeps the link open.

import { bandwidth } from './gateway.js';

/// The gigabytes a second a gigabit of uplink moves, after the overhead of the
/// protocol and the game's own pace.
const GB_PER_GBPS = 1.2;

/// The host difficulty at which a time window starts, the seconds it is there,
/// the seconds each further step takes off, and the shortest it gets.
const WINDOW_FROM = 6;
const WINDOW_START = 90;
const WINDOW_STEP = 15;
const WINDOW_MIN = 45;

/// How fast the gateway copies a file, in GB a second.
export function copyRate(gw) { return bandwidth(gw) / 1000 * GB_PER_GBPS; }

/// The seconds a host leaves the link open once it is up, or null when it
/// does not time sessions out (its difficulty is firewall + monitor + proxy).
export function exfilWindow(h) {
  const d = h.firewall + h.monitor + h.proxy;
  return d < WINDOW_FROM ? null : Math.max(WINDOW_START - WINDOW_STEP * (d - WINDOW_FROM), WINDOW_MIN);
}
