// Plays a character's art on one <img>, with exact frame timing.
//
// Three things, and nothing else:
//   hold(art)   show one frame and stay on it (a still, or frame N of a loop).
//   loop(art)   play the frames over and over, frame 0 first and for its full
//               time (the mouth starts exactly where the held rest frame was).
//   once(art)   play the frames once, hold the last, then call onEnd.
//
// Timing is measured from a clock that starts when the animation starts and
// stops while the game is paused (shell/pauseBus.js), so a frame is never
// cut short or skipped by a slow tick, and a paused game doesn't advance. The
// frame shown is always floor(elapsed / frameTime), never a counter that can
// drift. Frames are preloaded the first time an animation is asked for, so a
// loop never flickers waiting on an image.
import { isPaused, onPauseChange } from '../shell/pauseBus.js';

const PAD = (n) => String(n).padStart(4, '0');
const loaded = new Set();

export function frameUrl(art, i) {
  if (art.kind === 'still') return art.url;
  return `${art.base}${PAD(i)}.${art.ext ?? 'png'}`;
}

function preload(art) {
  const n = art.kind === 'anim' || art.kind === 'frame' ? art.frames : 1;
  for (let i = 0; i < n; i++) {
    const u = frameUrl(art, i);
    if (loaded.has(u)) continue;
    loaded.add(u);
    new Image().src = u;
  }
}

export function createCharacterAnimator(img) {
  let raf = null;
  let art = null;
  let mode = 'hold';
  let frameMs = 100;
  let elapsed = 0;       // ms of animation time (pauses excluded)
  let last = 0;          // performance.now() at the last tick
  let shown = -1;
  let onEnd = null;
  let ended = false;

  const stopRaf = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
  const show = (i) => {
    if (i === shown) return;
    shown = i;
    img.src = frameUrl(art, i);
  };

  function tick(now) {
    // Its picture left the page (a re-render, a closed scene): stop for good,
    // so nothing keeps animating something nobody can see.
    if (!img.isConnected) { stopRaf(); return; }
    raf = requestAnimationFrame(tick);
    const dt = now - last;
    last = now;
    if (isPaused()) return;
    elapsed += Math.min(dt, 250); // a long stall (a hidden tab) doesn't skip ahead
    const n = art.frames;
    const f = Math.floor(elapsed / frameMs);
    if (mode === 'loop') {
      show(f % n);
    } else if (mode === 'once') {
      // Every frame, the last included, gets its full time before it ends.
      show(Math.min(f, n - 1));
      if (f >= n) {
        stopRaf();
        if (!ended) { ended = true; onEnd?.(); }
      }
    }
  }

  function start(next, m, cb) {
    stopRaf();
    art = next;
    mode = m;
    onEnd = cb ?? null;
    ended = false;
    shown = -1;
    elapsed = 0;
    frameMs = 1000 / (art.fps ?? 10);
    preload(art);
    show(0);
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  // Game paused: the clock above stops by itself (tick skips while paused);
  // on resume, don't count the time the tab sat there.
  const offPause = onPauseChange((paused) => { if (!paused) last = performance.now(); });

  return {
    hold(next, frame = 0) {
      stopRaf();
      art = next;
      mode = 'hold';
      shown = -1;
      preload(art);
      show(art.kind === 'still' ? 0 : Math.min(frame ?? art.frame ?? 0, art.frames - 1));
    },
    loop(next) { if (mode === 'loop' && art?.base === next.base) return; start(next, 'loop'); },
    once(next, cb) {
      if (next.kind === 'still') { this.hold(next); setTimeout(() => cb?.(), 220); return; }
      start(next, 'once', cb);
    },
    get frame() { return shown; },
    get mode() { return mode; },
    destroy() { stopRaf(); offPause(); },
  };
}

// How long a once() of this art takes, in ms (a still is a short beat).
export function durationOf(art) {
  if (!art || art.kind === 'still') return art ? 220 : 0;
  return Math.round((art.frames / (art.fps ?? 10)) * 1000);
}
