// The game runs on a fixed timestep: the simulation never sees a variable
// delta, so the world behaves the same on every machine. The renderer gets
// the leftover time as an interpolation factor.

const STEP = 1 / 60;

/// The most steps one frame may run before the loop gives up catching up.
/// Without it a slow frame turns into an ever growing spiral of work.
const MAX_CATCHUP = 8;

export function startLoop({ step, render, stepSeconds = STEP }) {
  let last = performance.now();
  let carry = 0;
  let running = true;
  let lastError = '';

  function frame(now) {
    if (!running) return;
    // the next frame is booked first, so one bad frame cannot stop the game
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, 0.25);
    last = now;
    carry += elapsed;
    let steps = 0;
    try {
      while (carry >= stepSeconds && steps < MAX_CATCHUP) {
        carry -= stepSeconds;
        steps += 1;
        step(stepSeconds);
      }
      if (steps >= MAX_CATCHUP) carry = 0;
      render(carry / stepSeconds);
    } catch (err) {
      // a render error repeats every frame: say each new one once
      const msg = String(err?.stack ?? err);
      if (msg !== lastError) {
        lastError = msg;
        console.error(err);
      }
    }
  }

  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
    },
  };
}
