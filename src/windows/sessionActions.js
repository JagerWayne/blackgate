// The actions a link can carry out on the host itself: the bypasses and the
// wipe of the logs. The buttons and the words that say why one of them
// cannot run come from the data folder, one file per action.

import { section, label, spacer, buttons as buttonRow } from '../ui/controls.js';
import { primary, ghost } from '../ui/styles.js';
import { sessionActions, hint } from '../data/content.js';
import { toolLevel } from '../state/gameState.js';
import { roomFor } from '../systems/compute.js';

/// The host action block for the left pane of the session window.
export function sessionActionControls(game, sk, s) {
  const controls = [section('HOST ACTIONS')];
  const items = [];
  const reasons = [];
  // every host action takes one thread slot
  const busy = !roomFor(game, s, 'WipeLogs');
  for (const spec of sessionActions()) {
    const why = busy ? hint('allLanesBusy') : whyNot(game, s, spec);
    items.push({
      id: `sess.task.${spec.kind}`,
      text: spec.label,
      style: { ...(why ? ghost() : primary()), disabled: !!why },
    });
    if (why) reasons.push([spec.label, why]);
  }
  controls.push(buttonRow(items));
  if (reasons.length) {
    controls.push(spacer(4));
    reasons.forEach(([name, why]) => {
      controls.push(label(`${name} // ${why}`, 9.5, sk.warn));
    });
  }
  // a sabotage job has to end with a clean host: every action leaves a log
  if (sabotageOn(game, s)) {
    controls.push(spacer(4));
    controls.push(label(hint('destroyWarning'), 9.5, sk.danger));
    controls.push(label(hint('destroyOrder'), 9.5, sk.warn));
  }
  return controls;
}

/// Is a sabotage job live on the host this link is on?
function sabotageOn(game, s) {
  return game.contracts.some((c) => (c.state === 'accepted' || c.state === 'ready')
    && c.kind === 'destroy' && c.target === s.target);
}

/// Why an action cannot run right now, or '' when it can.
function whyNot(game, s, spec) {
  const h = game.world.hosts[s.target];
  if (!h) return 'no such host';
  const lvl = toolLevel(game, spec.tool);
  const r = spec.reasons ?? {};
  switch (spec.kind) {
    case 'BypassFirewall':
      if (!h.firewall) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.firewall - 1) return r.weak ?? '';
      if (s.fwBypassed) return r.done ?? '';
      return '';
    case 'BypassMonitor':
      if (!h.monitor) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.monitor) return r.weak ?? '';
      if (s.monBypassed) return r.done ?? '';
      return '';
    case 'BypassProxy':
      if (!h.proxy) return r.none ?? '';
      if (lvl === 0) return r.noTool ?? '';
      if (lvl < h.proxy) return r.weak ?? '';
      if (s.proxyBypassed) return r.done ?? '';
      return '';
    case 'WipeLogs':
      if (lvl === 0) return r.noTool ?? '';
      if (!h.logs.length) return r.none ?? '';
      return '';
    case 'ModifyLogs':
      if (lvl === 0) return r.noTool ?? '';
      if (!h.logs.some((l) => l.ip === game.player.gateway.ip)) return r.none ?? '';
      return '';
    default:
      return '';
  }
}
