// Voice locks: a voiceprint service opens only to its admin's voice. The
// operator calls the admin, records them, then plays the recording back
// through the VOICE ANALYSER. No breaker can crack one.

/// The person a host's voice lock answers to: the staffer of the host's
/// company with the highest clearance. Read from the world, never drawn, so a
/// seed stays the same.
export function voiceAdmin(game, host) {
  let best = null;
  game.world.people.forEach((p, i) => {
    if (p.company !== host.company) return;
    if (best === null || p.clearance > game.world.people[best].clearance) best = i;
  });
  return best;
}

/// The file a recording of a person is kept in.
export function sampleName(person) {
  return `voice_${person.name.toLowerCase().replace(/[^a-z]+/g, '_')}.vp`;
}

/// Whether the gateway holds a recording of the person.
export function hasSample(game, index) {
  return game.player.storage.some((f) => f.tag === 'voice' && f.person === index);
}
