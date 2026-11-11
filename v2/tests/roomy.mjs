// Test helper: the Micro PC's 64 GB download drive is too small for most of the
// game's tests, so they swap it for a big solid-state drive. The parts are set
// directly, as the rules (what the board takes) are not what these tests are about.
export function roomy(g) {
  const d = g.player.gateway.parts.find((p) => p.kind === 'storage' && !p.fixed);
  d.level = 7;
  d.name = 'M.2 SSD 2 TB';
  return g;
}
