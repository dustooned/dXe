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

const DEFAULT_TIMEOUT_MS = 2600;
const RESOLVE_HOLD_MS = 620; // let the flourish land before moving on

const FRAME_W = 390;
const FRAME_H = 844;

export function createQuickBeat(step, { onDone }) {
  const el = document.createElement('div');
  el.className = 'dx-beat';

  const prompt = document.createElement('p');
  prompt.className = 'dx-beat__prompt';
  prompt.textContent = step.prompt?.text ?? '';
  el.appendChild(prompt);

  let resolved = false;
  let detachSwipe = null;
  let timeoutTimer = null;
  let holdTimer = null;

  function resolve(matched) {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeoutTimer);
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
    target.addEventListener('click', (e) => { e.stopPropagation(); resolve(true); });
    el.appendChild(target);
    // Tapping anywhere else still resolves it — just as a miss.
    el.addEventListener('click', () => resolve(false));
  } else {
    const want = step.response === 'swipe-left' ? 'left' : 'right';
    detachSwipe = attachSwipe(el, {
      onEnd: (dir) => {
        if (dir === null) return; // too small to count as a swipe; keep waiting
        resolve(dir === want);
      },
    });
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
