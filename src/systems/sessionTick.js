// The live link: the route, the trace that comes with it and the cover-up.

import { makeSession, pushLine } from '../state/session.js';
import { note, discover, routeFactor, toolLevel } from '../state/gameState.js';
import { bandwidth, hops, traceFactor, warnAt, heatFactor } from '../state/gateway.js';
import { completeTask } from './sessionComplete.js';
import { voiceAdmin } from '../state/voice.js';
import { spammed, SPAM_TRACE } from '../state/intel.js';

/// Opens a link to a target.
export function connect(game, target) {
  if (game.gameOver) return 'run is over';
  if (game.session) return 'already connected';
  if (game.player.gateway.migrateUntil > game.clock.minutes) return 'chassis is being reconfigured';
  discover(game, target);
  const hopCount = game.player.bounce.length;
  const modem = bandwidth(game.player.gateway);
  const clean = hops(game.player.gateway);
  const penalty = hopCount > clean ? 1 + 0.35 * (hopCount - clean) : 1;
  const connectDur = Math.max((1.2 + hopCount * 0.5 + 12 / Math.sqrt(modem || 1)) * penalty, 1);
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
    const kept = heat * heatFactor(game.player.gateway);
    game.player.heat = Math.min(game.player.heat + kept, 100);
    note(game, `residual evidence: +${kept.toFixed(1)} heat`);
  } else if (s.alerted) {
    game.stats.tracesEscaped += 1;
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
        * (1 + 0.1 * h.proxy) * traceFactor(game.player.gateway);
      // an admin buried in spam answers the alarm late
      const admin = voiceAdmin(game, h);
      if (admin !== null && spammed(game, admin)) {
        s.traceRate *= SPAM_TRACE;
        pushLine(s, 'admin buried in spam // trace slowed');
      }
      pushLine(s, `connected // ${h.ip}`);
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
  s.tasks.forEach((t, i) => {
    const load = Math.max(1 - 0.05 * (s.tasks.length - 1), 0.6);
    t.progress += (dt / t.dur) * load;
    if (t.progress >= 1) done.push(i);
  });
  done.reverse().forEach((i) => {
    const task = s.tasks.splice(i, 1)[0];
    completeTask(game, s, task);
  });
  // a trace frozen from the cheat menu holds where it is
  if (s.alerted && !game.cheats?.freezeTrace) {
    let rate = s.traceRate;
    if (s.monBypassed) rate *= 0.3;
    else if (game.world.hosts[s.target].monitor === 0) rate *= 0.55;
    rate *= 1 + 0.06 * s.tasks.length;
    s.trace = Math.min(s.trace + rate * dt, 1);
    const warn = traceWarnAt(game);
    if (s.trace >= warn && !s.warned) {
      s.warned = true;
      note(game, 'security unit // trace warning');
      game.toasts.push({ text: 'Security unit: a trace is closing in', kind: 'bad', born: game.uiTime });
    }
  }
  // the trace landed: the link is seized and the run is over
  if (s.trace >= 1) {
    game.gameOver = 'caught';
    note(game, 'TRACE COMPLETE // connection seized');
    game.session = null;
  }
}

/// Where the trace warning fires: the security part's mark, 5% earlier for
/// every version of TRACE.
export function traceWarnAt(game) {
  return warnAt(game.player.gateway) - 0.05 * toolLevel(game, 'TraceTracker');
}
