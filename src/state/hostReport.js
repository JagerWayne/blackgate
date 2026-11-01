// The visited-hosts report: every machine the operator has connected to, as
// plain JSON: its security, services, logs (marking the operator's) and files
// (copied, deleted, decrypted). The desktop app writes it on every save.

/// The report for a run.
export function hostReport(game) {
  const me = game.player.gateway.ip;
  return {
    operator: game.player.handle,
    minute: game.clock.minutes,
    gateway: me,
    hosts: game.world.hosts
      .filter((h) => h.firstVisit !== undefined)
      .map((h) => ({
        ip: h.ip,
        name: h.name,
        domain: h.domain,
        kind: h.kind,
        firstVisit: h.firstVisit,
        lastVisit: h.lastVisit,
        security: { proxy: h.proxy, firewall: h.firewall, monitor: h.monitor, trace: h.trace },
        services: h.services.map((v) => ({ name: v.name, port: v.port, kind: v.kind, open: !!v.open })),
        logs: h.logs.map((l) => ({ minute: l.minute, ip: l.ip, text: l.text, mine: l.ip === me })),
        files: h.files.map((f) => ({
          name: f.name,
          size: f.size,
          encrypted: f.enc > 0,
          decrypted: !!f.decrypted,
          copied: !!f.copied,
          deleted: !!f.deleted,
        })),
      })),
  };
}
