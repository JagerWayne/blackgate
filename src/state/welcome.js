// The message the broker sends with a new gate.

export function welcomeBody(handle) {
  return `${handle},

You are in. Blackgate is a broker, not a charity: we route work to operators who deliver, and we forget operators who do not.

Start on DeppSpaceNET, the hidden job market. Read the brief, check the target's security, and do not sit on a connection longer than you must. Every action you take writes a log somewhere, and logs are what get people caught.

You have 4,000 credits and a gate that would embarrass a student. Fix that with the money you earn.

Rules:
  1. Never accept a job whose tools you cannot run.
  2. Trace is not a warning, it is a clock.
  3. Wipe your own tail.

- WARDEN`;
}
