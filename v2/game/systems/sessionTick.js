// The live link: the route, the trace that comes with it and the cover-up.

import { makeSession, pushLine } from '../state/session.js';
import { note, discover, routeFactor, toolLevel } from '../state/gameState.js';
import { bandwidth, chassisOf, fpga, hops, traceFactor, triangulation, warnAt, heatFactor } from '../state/gateway.js';
import { exfilWindow } from '../state/transfer.js';
import { isInternal } from '../data/network.js';
import { tokenTick, dropTokens } from './tokens.js';
import { heatGain, wipeStorage } from './physical.js';
import { completeTask } from './sessionComplete.js';
import { schedule } from './compute.js';
import { voiceAdmin } from '../state/voice.js';
import { spammed, SPAM_TRACE } from '../state/intel.js';
import { perk } from '../state/perks.js';
import { traitOf, isNight } from '../data/traits.js';
import { pay } from '../state/gameHelpers.js';

/// A link that closes with the trace this far along slipped the net.
export const CLOSE_CALL = 0.7;
/// The trace speeds up past this mark; below it the rise is flat.
const TRACE_CURVE_FROM = 0.66;
/// What burning the line costs in heat, and how long the trace crawls.
export const BURN_HEAT = 6;
const BURN_SECS = 10;

/// Panic button: every task drops and the trace crawls for a while.
export function burn(game) {
  const s = game.session;
  if (!s || s.phase !== 'online' || s.burned) return 'nothing to burn';
  s.burned = true;
  s.tasks = [];
  s.burnLeft = BURN_SECS;
  game.player.heat = Math.min(game.player.heat + BURN_HEAT, 100);
  pushLine(s, 'line burned // tasks dropped // the trace crawls');
  note(game, `line burned: +${BURN_HEAT} heat`);
  return null;
}

/// Opens a link to a target.
export function connect(game, target) {
  if (game.gameOver) return 'run is over';
  if (game.session) return 'already connected';
  if (game.player.gateway.migrateUntil > game.clock.minutes) return 'chassis is being reconfigured';
  if (isInternal(game.world.hosts[target])) return 'internal segment // link to another host of this company and forge a ticket';
  discover(game, target);
  const hopCount = game.player.bounce.length;
  const modem = bandwidth(game.player.gateway);
  const clean = hops(game.player.gateway);
  const penalty = hopCount > clean ? 1 + 0.35 * (hopCount - clean) : 1;
  const connectDur = Math.max((1.2 + hopCount * 0.5 + 12 / Math.sqrt(modem || 1)) * penalty / fpga(game.player.gateway), 1);
  const targetName = game.world.hosts[target].name;
  const s = makeSession(target, game.player.bounce, connectDur);
  s.started = game.clock.minutes;
  pushLine(s, `link: negotiating route to ${targetName}`);
  if (hopCount > 0) pushLine(s, `route: ${hopCount} hops`);
  if (penalty > 1) pushLine(s, `warning: route exceeds ${clean} clean hops`);
  game.session = s;
  note(game, `connecting to ${targetName}`);
  return null;
}

/// Closes the link. The logs left behind become passive heat.
export function disconnect(game) {
  const s = game.session;
  if (!s) return;
  game.session = null;
  dropTokens(game, s.target);
  note(game, 'link terminated');
  let heat = 0;
  // a log adds heat once, on the link that closes after it
  const fresh = (logs) => {
    const mine = logs.filter((l) => l.ip === game.player.gateway.ip && !l.counted);
    mine.forEach((l) => { l.counted = true; });
    return mine.length;
  };
  s.route.forEach((hop) => {
    heat += fresh(game.world.hosts[hop].logs) * 1.1;
  });
  heat += fresh(game.world.hosts[s.target].logs) * 2;
  if (heat > 0) {
    const kept = heat * heatFactor(game.player.gateway) * heatGain(game);
    game.player.heat = Math.min(game.player.heat + kept, 100);
    note(game, `residual evidence: +${kept.toFixed(1)} heat`);
  } else if (s.alerted) {
    game.stats.tracesEscaped += 1;
  } else {
    game.stats.ghostRuns = (game.stats.ghostRuns ?? 0) + 1;
  }
  // slipping away from a trace this close pays, once per host so it cannot be farmed
  const host = game.world.hosts[s.target];
  if (s.alerted && s.trace >= CLOSE_CALL && !host.closeCalled) {
    host.closeCalled = true;
    const bonus = Math.round(50 * s.trace * s.trace);
    pay(game, bonus, 'close call');
    game.toasts.push({ text: `+${bonus} cr // close call`, kind: 'money', born: game.uiTime });
  }
  game.contracts.forEach((c) => {
    if (c.state !== 'accepted' || c.target !== s.target || c.kind !== 'destroy') return;
    const h = game.world.hosts[s.target];
    if (h.files.every((f) => f.deleted) && h.logs.length === 0) c.state = 'ready';
  });
}

/// Runs the link: the handshake, the tasks and the trace.
export function sessionTick(game, dt) {
  const s = game.session;
  if (!s) return;
  if (s.phase === 'connecting') {
    s.connectT += dt;
    if (s.connectT >= s.connectDur) {
      s.phase = 'online';
      const h = game.world.hosts[s.target];
      s.traceRate = 0.0032 * Math.max(h.trace, 1) * routeFactor(game)
        * (1 + 0.1 * h.proxy) * traceFactor(game.player.gateway) * perk(game, 'trace');
      // an admin buried in spam answers the alarm late
      const admin = voiceAdmin(game, h);
      if (admin !== null && spammed(game, admin)) {
        s.traceRate *= SPAM_TRACE;
        pushLine(s, 'admin buried in spam // trace slowed');
      }
      pushLine(s, `connected // ${h.ip}`);
      if (traitOf(h) === 'paranoid') {
        s.alerted = true;
        pushLine(s, 'paranoid host // the trace starts at once');
      }
      // a hard host closes the link on its own clock
      const window = exfilWindow(h);
      if (window !== null) {
        s.windowLeft = window;
        pushLine(s, `warning: the host drops sessions after ${window}s`);
      }
      // the link leaves a log on every machine it passes through; it stays
      // until the operator scrubs or wipes it, and counts as heat on leaving
      new Set([...s.route, s.target]).forEach((id) => {
        const host = game.world.hosts[id];
        host.logs.push({ minute: game.clock.minutes, ip: game.player.gateway.ip, text: 'session open', loud: false });
        host.firstVisit ??= game.clock.minutes;
        host.lastVisit = game.clock.minutes;
      });
      if (h.firewall > 0) pushLine(s, 'warning: host firewall active');
      if (h.monitor > 0) pushLine(s, 'warning: intrusion monitor active');
    }
    return;
  }
  const done = [];
  // only the tasks the thread slots hold are processing; the others wait
  schedule(game, s);
  s.tasks.forEach((t, i) => {
    if (t.queued) return;
    t.progress += dt / t.dur;
    if (t.progress >= 1) done.push(i);
  });
  done.reverse().forEach((i) => {
    const task = s.tasks.splice(i, 1)[0];
    completeTask(game, s, task);
  });
  schedule(game, s);
  if (s.burnLeft > 0) s.burnLeft -= dt;
  adminWatch(game, s, dt);
  s.online = (s.online ?? 0) + dt;
  if (s.windowLeft !== undefined) {
    s.windowLeft -= dt;
    if (s.windowLeft <= 0) {
      note(game, 'session timed out // the host closed the link');
      game.toasts.push({ text: 'Session timed out: the host closed the link', kind: 'bad', born: game.uiTime });
      disconnect(game);
      return;
    }
  }
  tokenTick(game, s, dt);
  // a dish has no wire to trace, but the satellite gives it away after a while
  const found = triangulation(game.player.gateway);
  if (found && !s.triangulated && s.online >= found) {
    s.triangulated = true;
    s.alerted = true;
    s.traceRate *= 3;
    pushLine(s, 'orbital triangulation // the dish is being located');
  }
  // a trace frozen from the cheat menu holds where it is
  if (s.alerted && !game.cheats?.freezeTrace) {
    let rate = s.traceRate;
    if (s.monBypassed) rate *= 0.3;
    else if (game.world.hosts[s.target].monitor === 0) rate *= 0.55;
    rate *= 1 + 0.06 * s.tasks.length;
    if (traitOf(game.world.hosts[s.target]) === 'nightshift' && isNight(game.clock.minutes)) rate *= 1.5;
    // the last stretch runs away, unless the line was just burned
    rate *= 1 + 1.5 * Math.max(0, s.trace - TRACE_CURVE_FROM);
    if (s.burnLeft > 0) rate *= 0.2;
    s.trace = Math.min(s.trace + rate * dt, 1);
    const warn = traceWarnAt(game);
    if (s.trace >= warn && !s.warned) {
      s.warned = true;
      note(game, 'security unit // trace warning');
      game.toasts.push({ text: 'Security unit: a trace is closing in', kind: 'bad', born: game.uiTime });
    }
  }
  // the trace landed: the link is seized and the run is over, unless the rig
  // is a rented server whose provider pulls the plug and wipes it
  if (s.trace >= 1) {
    game.session = null;
    dropTokens(game, s.target);
    if (chassisOf(game.player.gateway).vps) {
      wipeStorage(game);
      note(game, 'TRACE COMPLETE // the provider wiped the server // the files are gone');
      game.toasts.push({ text: 'Trace complete: the VPS was wiped, the link is gone', kind: 'bad', born: game.uiTime });
      return;
    }
    game.gameOver = 'caught';
    note(game, 'TRACE COMPLETE // connection seized');
  }
}

/// The admin on duty: a link that keeps making noise gets noticed. A warning
/// comes first, then the trace doubles, unless the monitor is blind.
function adminWatch(game, s, dt) {
  if (s.monBypassed || s.noticing < 0) return;
  const h = game.world.hosts[s.target];
  const loud = s.tasks.some((t) => t.loud);
  s.heatSense = Math.max((s.heatSense ?? 0) + (loud ? dt : -dt * 0.5), 0);
  if (s.noticing === undefined && s.heatSense > 6 / (1 + h.monitor)) {
    s.noticing = 3;
    pushLine(s, 'admin console: unusual activity flagged');
    game.toasts.push({ text: 'The admin is looking', kind: 'bad', born: game.uiTime });
  } else if (s.noticing > 0 && (s.noticing -= dt) <= 0) {
    s.noticing = -1;
    s.alerted = true;
    s.traceRate *= 2;
    pushLine(s, 'admin intervened // the trace doubles');
  }
}

/// Where the trace warning fires: the security part's mark, 5% earlier for
/// every version of TRACE.
export function traceWarnAt(game) {
  return warnAt(game.player.gateway) - 0.05 * toolLevel(game, 'TraceTracker');
}
