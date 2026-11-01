// The live link: the route, the tasks running on it and the trace that comes
// with them.

/// Opens a link to a target.
export function makeSession(target, route, connectDur) {
  return {
    target,
    route: route.slice(),
    phase: 'connecting',
    connectT: 0,
    connectDur,
    trace: 0,
    traceRate: 0,
    alerted: false,
    tasks: [],
    lines: [],
    fwBypassed: false,
    monBypassed: false,
    proxyBypassed: false,
    tab: 0,
    selService: null,
    selFile: null,
    started: 0,
    nextLane: 0,
    xferAmount: 0,
    linksFound: 0,
    warned: false,
  };
}

/// Writes a line in the link log.
export function pushLine(session, text) {
  session.lines.push(text);
  if (session.lines.length > 200) session.lines.shift();
}

/// The first task lane that is free.
export function freeLane(session, lanes) {
  for (let l = 0; l < lanes; l += 1) {
    if (!session.tasks.some((t) => t.lane === l)) return l;
  }
  return null;
}
