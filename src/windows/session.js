// Bl@ckG@te: the remote-control client. The link, the target, the tasks that
// run on it and the trace that comes with them.

import { draw as drawText, ellipsize, FONT } from '../core/text.js';
import { color, cssA } from '../core/theme.js';
import { drawFrame, splitPanel, detailPane, emptyNote } from '../ui/panel.js';
import { ghost } from '../ui/styles.js';
import { drawButton } from '../ui/widgets.js';
import { drawScrolled } from '../ui/scroll.js';
import { section, label, keyValue, meter } from '../ui/controls.js';
import { routeLines } from '../state/session.js';
import { guardTint } from '../ui/guard.js';
import { HOST_LABEL } from '../data/enums.js';
import { drawAccess, drawFiles, drawLogs, drawRecords } from './sessionTabs.js';
import { sessionActionControls } from './sessionActions.js';
import { contractLabel } from '../state/contracts.js';
import { traceWarnAt } from '../systems/sessionTick.js';
import { demand, slots, throttle, OVERLOAD_SECS } from '../systems/compute.js';
import { RECORD_LABEL, recordText } from '../state/gameState.js';
import { hint } from '../data/content.js';
import { taskRow } from '../ui/taskFx.js';
import { drawPeople } from './people.js';

/// The height of the link log along the bottom.
const LOG_H = 124;

/// Draws the remote-control window.
export function drawSession(ctx, sk, r, game, ui, input, events, view) {
  const s = game.session;
  const body = drawFrame(ctx, sk, r, ui, input, events, '', s
    ? `inside ${game.world.hosts[s.target].name}`
    : 'no live link');
  if (!s) {
    emptyNote(ctx, sk, body, 'pick a host on the NEXUS MAP and open a link');
    return;
  }
  const h = game.world.hosts[s.target];
  // the log takes its own strip at the bottom; the panes sit above it
  const top = { x: body.x, y: body.y, w: body.w, h: Math.max(body.h - LOG_H - 10, 60) };
  const [left, right] = splitPanel(top, 0.32, 240);

  // -- the left: the target, the link and its tasks, then the way out ---------
  const pane = detailPane(ctx, sk, left);
  const traceTint = s.trace > 0.75 ? sk.danger : s.trace > 0.4 ? sk.warn : sk.ok;
  const controls = [
    label(h.name, 15, sk.text_hi),
    label(HOST_LABEL[h.kind] ?? '', 9.5, sk.dim),
    section('TARGET'),
    keyValue('ADDRESS', h.ip, sk.accent),
    keyValue('GUARD', `FW ${h.firewall} / MON ${h.monitor} / PX ${h.proxy}`, guardTint(sk, h)),
  ];
  // the job this host is for, and what it asks
  const jobs = game.contracts.filter((c) => c.target === s.target && (c.state === 'accepted' || c.state === 'ready'));
  if (jobs.length) {
    controls.push(section('JOB'));
    jobs.forEach((c) => {
      controls.push(keyValue(`#${c.id} ${contractLabel(c)}`, c.state === 'ready' ? 'DONE // SUBMIT IT' : 'IN HAND', c.state === 'ready' ? sk.ok : sk.warn));
      controls.push(keyValue('OBJECT', c.kind === 'destroy' ? hint('destroyObjective') : c.file ?? c.subject ?? '', sk.accent));
      // the change is made from the RECORDS tab, on the person's row
      if (c.record) controls.push(keyValue('CHANGE', `${RECORD_LABEL[c.record.field]} \u2192 ${recordText(game, c.record.field, c.record.value)}`, sk.warn));
    });
  }
  // the trace, with a tick where the security unit warns
  const warn = traceWarnAt(game);
  controls.push(section('LINK'));
  controls.push(keyValue('STATE', s.phase === 'online' ? 'LINK UP' : 'NEGOTIATING', sk.ok));
  controls.push(meter(`TRACE ${(s.trace * 100).toFixed(0)}% // WARNS AT ${Math.round(warn * 100)}%`, s.trace, traceTint, warn));
  // the actions that work on the host itself
  controls.push(...sessionActionControls(game, sk, s));
  controls.push(section(`THREAD SLOTS // ${demand(game, s)}/${slots(game)}`));
  const slow = throttle(game, s);
  if (slow < 1) {
    const drop = s.overload ? ` // a bypass drops in ${Math.ceil(OVERLOAD_SECS - s.overload)}s` : '';
    controls.push(label(`overloaded // tasks run at ${Math.round(slow * 100)}%${drop}`, 9.5, sk.warn));
  }
  if (!s.tasks.length) controls.push(label('no tasks running', 10, sk.dim));
  s.tasks.forEach((t) => controls.push(taskRow(t, game.uiTime ?? 0)));
  const scroll = { x: pane.x, y: pane.y, w: pane.w, h: Math.max(pane.h - 36, 20) };
  drawScrolled(ctx, sk, scroll, controls, 'sess.side', ui, input, events);
  const disc = { x: pane.x, y: pane.y + pane.h - 26, w: pane.w - 6, h: 26 };
  if (drawButton(ctx, ui, sk, 'sess.disconnect', disc, 'DISCONNECT', ghost(), input)) {
    events.push({ type: 'click', id: 'sess.disconnect' });
  }

  // -- the right: the services, the files and the logs -----------------------
  const tabs = [
    { id: 'sess.tab.0', label: 'ACCESS' },
    { id: 'sess.tab.1', label: 'FILES' },
    { id: 'sess.tab.2', label: 'LOGS' },
    { id: 'sess.tab.3', label: 'RECORDS' },
    { id: 'sess.tab.4', label: 'PEOPLE' },
  ];
  // the host shows nothing until the link is up
  if (s.phase !== 'online') {
    const pane = drawFrame(ctx, sk, right, ui, input, events, '', 'the host answers once the link is up');
    drawScrolled(ctx, sk, pane, [
      section('NEGOTIATING LINK'),
      meter(`HANDSHAKE ${Math.round(Math.min(s.connectT / s.connectDur, 1) * 100)}%`, Math.min(s.connectT / s.connectDur, 1), sk.accent),
      section(s.route.length ? `ROUTE // ${s.route.length} hops` : 'ROUTE // direct, no hops'),
      ...routeLines(game, s).map((l) => label(l.text, FONT.body, l.done ? sk.ok : sk.warn)),
    ], 'sess.wait', ui, input, events);
  } else {
    const tab = view.tab ?? 0;
    const rightBody = drawFrame(ctx, sk, right, ui, input, events, '', '', tabs, tab);
    if (tab === 0) drawAccess(ctx, sk, rightBody, game, s, ui, input, events);
    else if (tab === 1) drawFiles(ctx, sk, rightBody, game, s, ui, input, events);
    else if (tab === 2) drawLogs(ctx, sk, rightBody, game, s, ui, input, events);
    else if (tab === 3) drawRecords(ctx, sk, rightBody, game, s, ui, input, events, view);
    else drawPeople(ctx, sk, rightBody, game, s, ui, input, events, view);
  }

  // -- the link log ----------------------------------------------------------
  const log = { x: body.x, y: body.y + body.h - LOG_H, w: body.w, h: LOG_H };
  ctx.fillStyle = color(sk.inset);
  ctx.fillRect(log.x, log.y, log.w, log.h);
  drawText(ctx, 'LINK LOG', log.x + 10, log.y + 7, 9, color(sk.inset_dim));
  s.lines.slice(-5).forEach((line, i) => {
    drawText(ctx, ellipsize(ctx, line, 10, log.w - 20), log.x + 10, log.y + 26 + i * 20, 10, cssA(sk.inset_text, 0.92));
  });
}
