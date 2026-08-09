// The "Quick Beat" gimmick: one reusable, data-only template shared by every
// mini-game. See docs/SCENE_TYPES.md.
//
// A prompt appears; the player answers with a swipe or a tap on a target.
// ANY response resolves it, including a timeout — there is no fail state and
// no stat effect. Matching only changes the cosmetic flourish, using the same
// intensity-only fx language as dialog swipes (never right/wrong coded).
//
// step shape:
//   { prompt: { text }, response: 'swipe-left' | 'swipe-right', timeoutMs? }
//   { prompt: { text }, target: { x, y, w, h }, timeoutMs? }
import { attachSwipe } from '../shell/input.js';
import * as fx from '../shell/fx.js';

// Long enough to read the prompt, not just react to it — these are text
// prompts, and text has to be parsed before it can be answered.
const DEFAULT_TIMEOUT_MS = 3600;
const RESOLVE_HOLD_MS = 620; // let the flourish land before moving on

// Lower than the swipe card's 90px default. That threshold suits a deliberate
// dialog choice; this is a reflex beat on a ~375px-wide canvas, where 90px is
// a quarter of the screen.
const SWIPE_THRESHOLD_PX = 45;

// A near-miss tap still counts. Without this, an exploratory tap a few pixels
// outside the box is an instant miss with no forgiveness.
const TARGET_SLOP_PX = 24;

const FRAME_W = 390;
const FRAME_H = 844;

const ARROW = { left: '←', right: '→' };

export function createQuickBeat(step, { onDone }) {
  const el = document.createElement('div');
  el.className = 'dx-beat';

  const want = step.response === 'swipe-left' ? 'left' : 'right';

  const prompt = document.createElement('p');
  prompt.className = 'dx-beat__prompt';
  // Show the direction rather than making the player infer it from prose.
  // Without this the first encounter with any swipe beat is a coin flip.
  const text = step.prompt?.text ?? '';
  prompt.textContent = step.target ? text
    : want === 'left' ? `${ARROW.left}  ${text}`
    : `${text}  ${ARROW.right}`;
  el.appendChild(prompt);

  let resolved = false;
  let detachSwipe = null;
  let timeoutTimer = null;
  let holdTimer = null;

  // Once the player commits to a gesture the clock stops. Otherwise a swipe
  // started at 3.5s gets its own timeout fired mid-drag, the miss flourish
  // plays, and the pointerup lands on a dead no-op — punishing a player who
  // did the right thing, in a beat that can't be failed.
  function stopClock() {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }

  function resolve(matched) {
    if (resolved) return;
    resolved = true;
    stopClock();
    detachSwipe?.();
    detachSwipe = null;

    // Intensity, not correctness: a clean hit reads as a sharp beat, a miss
    // as a stumble. Neither is a penalty.
    if (matched) {
      fx.flash('weak');
      el.classList.add('is-hit');
    } else {
      fx.shake('weak');
      el.classList.add('is-miss');
    }

    holdTimer = setTimeout(onDone, RESOLVE_HOLD_MS);
  }

  if (step.target) {
    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'dx-beat__target';
    target.style.left   = `${(step.target.x / FRAME_W) * 100}%`;
    target.style.top    = `${(step.target.y / FRAME_H) * 100}%`;
    target.style.width  = `${(step.target.w / FRAME_W) * 100}%`;
    target.style.height = `${(step.target.h / FRAME_H) * 100}%`;
    el.appendChild(target);

    // Hit-test with slop instead of relying on the button's own click, so a
    // tap just outside the art still reads as intent.
    el.addEventListener('click', (e) => {
      const r = target.getBoundingClientRect();
      const hit = e.clientX >= r.left - TARGET_SLOP_PX && e.clientX <= r.right + TARGET_SLOP_PX
               && e.clientY >= r.top  - TARGET_SLOP_PX && e.clientY <= r.bottom + TARGET_SLOP_PX;
      resolve(hit);
    });
  } else {
    detachSwipe = attachSwipe(el, {
      threshold: SWIPE_THRESHOLD_PX,
      onDrag(dx) {
        // The dialog swipe card moves under the finger; this did not, so the
        // player had no signal their input was landing. Match that language.
        stopClock();
        prompt.style.transform = `translateX(${dx * 0.5}px)`;
        prompt.classList.toggle('is-committing', Math.abs(dx) >= SWIPE_THRESHOLD_PX);
      },
      onEnd: (dir) => {
        prompt.style.transform = '';
        prompt.classList.remove('is-committing');
        if (dir === null) {
          // Too small to count as a swipe — but the click that follows will
          // pass the beat, so this only needs to restart the clock for a drag
          // that never became a tap either.
          if (!resolved) {
            timeoutTimer = setTimeout(() => resolve(false), step.timeoutMs ?? DEFAULT_TIMEOUT_MS);
          }
          return;
        }
        resolve(dir === want);
      },
    });

    // A tap passes the beat too. These are pacing beats, not reflex tests, so
    // the swipe is the flavor of the moment rather than a requirement — a
    // player who doesn't want to swipe should never be stuck waiting out the
    // clock. It resolves as a hit: tapping is a deliberate answer, not a miss.
    // A completed swipe has already set `resolved`, so this can't double-fire.
    el.addEventListener('click', () => resolve(true));
  }

  timeoutTimer = setTimeout(() => resolve(false), step.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return {
    el,
    destroy() {
      clearTimeout(timeoutTimer);
      clearTimeout(holdTimer);
      detachSwipe?.();
    },
  };
}
