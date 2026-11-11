// The message the broker sends with a new gate.

export function welcomeBody(handle, bare = false) {
  return `${handle},

You are in. Blackgate is a broker, not a charity: we route work to operators who deliver, and we forget operators who do not.

Start on DSNET, the hidden job market. Read the brief, check the target's security, and do not sit on a connection longer than you must. Every action you take writes a log somewhere, and logs are what get people caught.

${bare
    ? 'Your gate is empty: no software at all. I have put the price of the basic tools in your account, and the tutorial walks you through buying them, then five short lessons on a practice server that I wipe when you are done. What is left, 4,000 credits, is yours to run with.'
    : 'You have 4,000 credits and a gate that would embarrass a student. Fix that with the money you earn.'}

Rules:
  1. Never accept a job whose tools you cannot run.
  2. Trace is not a warning, it is a clock.
  3. Wipe your own tail.

- WARDEN`;
}
