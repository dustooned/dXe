// One switch for "the game is paused" (shell/orientationPause.js flips it when
// a phone is held sideways). Timers that move the story or pace the player
// use later()/cancelLater() instead of setTimeout/clearTimeout: while paused
// their clocks stop, and each resumes with the time it had left.
let paused = false;
let pausedAt = 0;
let nextHandle = 1;
const timers = new Map(); // handle -> { fn, remaining, start, id }
const listeners = new Set();

export function isPaused() {
  return paused;
}

// fn(paused, pausedForMs) — pausedForMs is 0 on pause, the length of the
// pause on resume (for anything that measures elapsed time itself).
export function onPauseChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function arm(handle, t) {
  t.start = performance.now();
  t.id = setTimeout(() => {
    timers.delete(handle);
    t.fn();
  }, t.remaining);
}

export function later(fn, ms) {
  const handle = nextHandle++;
  const t = { fn, remaining: ms, start: 0, id: null };
  timers.set(handle, t);
  if (!paused) arm(handle, t);
  return handle;
}

export function cancelLater(handle) {
  const t = timers.get(handle);
  if (!t) return;
  clearTimeout(t.id);
  timers.delete(handle);
}

export function setPaused(next) {
  if (next === paused) return;
  paused = next;
  const now = performance.now();
  if (next) {
    pausedAt = now;
    for (const t of timers.values()) {
      clearTimeout(t.id);
      t.remaining = Math.max(0, t.remaining - (now - t.start));
    }
  } else {
    for (const [handle, t] of [...timers]) arm(handle, t);
  }
  const forMs = next ? 0 : now - pausedAt;
  listeners.forEach((fn) => fn(next, forMs));
}
