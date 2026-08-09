// Renders one mini-game room: a looping bg sprite with interactive object
// sprites layered over it. See docs/SCENE_TYPES.md for the interaction design
// and docs/ASSET_GUIDELINES.md for the art hand-off spec.
//
// Objects are separate sprites (never painted into the bg) because tapping one
// scales it up, which a flat background frame can't do.
//
// room shape:
//   { bg: {base, frames, fps, ext?},
//     hotspots: [{ x, y, w, h, sprite, closeup, text: {Guns,Bible,Crystals} }],
//     advance:  { x, y, w, h, sprite, to } }
//
// x/y/w/h are DESIGN-SPACE PIXELS against the 390x844 frame — the numbers
// straight off the artboard. They're converted to percentages here so the room
// scales with the canvas; nothing pixel-valued ever reaches a style property.
import { createSpriteAnimator } from './spriteAnimator.js';
import { createTypewriter } from './typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick } from '../shell/audio.js';

const FRAME_W = 390;
const FRAME_H = 844;

function place(el, { x, y, w, h }) {
  el.style.left   = `${(x / FRAME_W) * 100}%`;
  el.style.top    = `${(y / FRAME_H) * 100}%`;
  el.style.width  = `${(w / FRAME_W) * 100}%`;
  el.style.height = `${(h / FRAME_H) * 100}%`;
}

// Caption text is authored per class. Falls back to the first available
// variant so a half-authored room still renders instead of showing blank.
function captionFor(text, loadout) {
  if (typeof text === 'string') return text;
  return text?.[loadout] ?? Object.values(text ?? {})[0] ?? '';
}

export function createWalkRoom(room, { loadout, onAdvance }) {
  // playTypewriterTick() no-ops until its buffer is loaded. In normal play a
  // cutscene has already preloaded it, but a deep link straight to a mini-game
  // would render every caption silently — don't depend on scene order.
  preloadTypewriterTick();

  const el = document.createElement('div');
  el.className = 'dx-room';

  const bg = document.createElement('img');
  bg.className = 'dx-room__bg';
  bg.alt = '';
  el.appendChild(bg);
  const bgAnimator = createSpriteAnimator(bg, room.bg);

  // Which hotspots have been inspected. Room-local by design — this is
  // ephemeral UI state, not run state (same convention as dialog/cutscene).
  const seen = new Set();
  let closeupEl = null;
  let typewriter = null;

  const advanceEl = document.createElement('button');
  advanceEl.type = 'button';
  advanceEl.className = 'dx-room__object dx-room__advance';
  advanceEl.hidden = true;
  advanceEl.innerHTML = `<img src="${room.advance.sprite}" alt="">`;
  place(advanceEl, room.advance);
  advanceEl.addEventListener('click', () => {
    if (advanceEl.hidden) return;
    onAdvance(room.advance.to);
  });

  function revealAdvanceIfDone() {
    if (seen.size < room.hotspots.length) return;
    if (!advanceEl.hidden) return;
    advanceEl.hidden = false;
    // Animate in rather than snapping — this is the "you can move on" hint.
    advanceEl.classList.add('is-revealing');
  }

  function closeCloseup() {
    typewriter?.destroy();
    typewriter = null;
    closeupEl?.remove();
    closeupEl = null;
  }

  function openCloseup(spot) {
    closeCloseup();
    closeupEl = document.createElement('div');
    closeupEl.className = 'dx-room__closeup';

    const img = document.createElement('img');
    img.className = 'dx-room__closeup-img';
    img.src = spot.closeup;
    img.alt = '';
    closeupEl.appendChild(img);

    const box = document.createElement('div');
    box.className = 'dx-room__closeup-text';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.appendChild(p);
    closeupEl.appendChild(box);

    el.appendChild(closeupEl);
    typewriter = createTypewriter(p, captionFor(spot.text, loadout), {
      onChar: playTypewriterTick,
    });

    // First tap finishes the draw, second dismisses — same language as
    // cutscene beats, so the gesture is already learned.
    closeupEl.addEventListener('click', () => {
      if (typewriter && !typewriter.isDone()) typewriter.finish();
      else closeCloseup();
    });
  }

  room.hotspots.forEach((spot, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dx-room__object';
    btn.innerHTML = `<img src="${spot.sprite}" alt="">`;
    place(btn, spot);
    btn.addEventListener('click', () => {
      // Retrigger the pop even on a repeat tap — objects stay re-inspectable
      // forever, so the feedback shouldn't go dead after the first time.
      btn.classList.remove('is-popping');
      void btn.offsetWidth;
      btn.classList.add('is-popping');
      seen.add(i);
      revealAdvanceIfDone();
      openCloseup(spot);
    });
    el.appendChild(btn);
  });

  el.appendChild(advanceEl);

  return {
    el,
    destroy() {
      closeCloseup();
      bgAnimator.destroy();
    },
  };
}
