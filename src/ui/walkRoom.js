// Renders one mini-game room: a looping bg sprite with interactive object
// sprites layered over it. See docs/SCENE_TYPES.md for the interaction design
// and docs/ASSET_GUIDELINES.md for the art hand-off spec.
//
// Objects are separate sprites (never painted into the bg) because tapping one
// scales it up, which a flat background frame can't do.
//
// room shape:
//   { bg: {base, frames, fps, ext?},
//     intro?:   string | {Guns,Bible,Crystals},
//     npcClass?: 'Guns' | 'Bible' | 'Crystals',   ← whose room: badges the close-ups
//     hotspots: [{ x, y, w, h, sprite, closeup, text: {Guns,Bible,Crystals},
//                  mood?,      ← a feeling (resolved for this player's class):
//                                the object's tint and its close-up's tint
//                  restore?: { by, hint, done } }],
//     advance:  { x, y, w, h, sprite, to } }
//
// Restoring: once every object has been opened, the one your class restores
// (restore.by) starts calling in your class's color. Open it again, the hint
// line says how your class would see to it, and tapping the picture does it:
// your class's sound, the done line, a stamp in your class's words, and
// onRestore() (the minigame records it; the confrontation reads it).
//
// x/y/w/h are DESIGN-SPACE PIXELS against the 390x844 frame — the numbers
// straight off the artboard. They're converted to percentages here so the room
// scales with the canvas; nothing pixel-valued ever reaches a style property.
import { createSpriteAnimator } from './spriteAnimator.js';
import { createTypewriter } from './typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick, playClassSigil } from '../shell/audio.js';
import { CLASSES, classColor, emotionColor } from '../engine/loadout.js';

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

export function createWalkRoom(room, { loadout, onAdvance, restored = false, onRestore }) {
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
  // The object this player's class restores here, if any.
  const mine = room.hotspots.findIndex((spot) => spot.restore?.by === loadout);
  let isRestored = restored;
  const buttons = [];
  el.style.setProperty('--cls', classColor(loadout));
  const allSeen = () => seen.size >= room.hotspots.length;

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

  // Everything opened: your class's object starts calling.
  function callIfReady() {
    if (mine < 0 || isRestored || !allSeen()) return;
    buttons[mine].classList.add('is-calling');
  }

  function revealAdvanceIfDone() {
    callIfReady();
    if (!allSeen()) return;
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

  function openCloseup(spot, i) {
    closeCloseup();
    closeupEl = document.createElement('div');
    closeupEl.className = 'dx-room__closeup';

    // The picture, and their feeling laid over it the way old consoles
    // recolored a sprite: a flat tint cut to the picture's own shape.
    const art = document.createElement('div');
    art.className = 'dx-room__closeup-art';
    const img = document.createElement('img');
    img.className = 'dx-room__closeup-img';
    img.src = spot.closeup;
    img.alt = '';
    art.appendChild(img);
    if (spot.mood) {
      const tint = document.createElement('div');
      tint.className = 'dx-room__tint';
      tint.style.setProperty('--sprite', `url("${spot.closeup}")`);
      art.appendChild(tint);
      art.style.setProperty('--mood', emotionColor(spot.mood));
    }
    closeupEl.appendChild(art);

    // Whose room this is.
    if (CLASSES[room.npcClass]) {
      const badge = document.createElement('span');
      badge.className = 'dx-room__closeup-badge';
      badge.style.setProperty('--npc-cls', classColor(room.npcClass));
      badge.textContent = CLASSES[room.npcClass].glyph;
      closeupEl.appendChild(badge);
    }

    const restorable = i === mine && !isRestored && allSeen();
    if (i === mine && isRestored) art.classList.add('is-restored');
    if (restorable) {
      art.classList.add('is-restorable');
      art.addEventListener('click', (e) => {
        if (!art.classList.contains('is-restorable')) return;
        e.stopPropagation();
        if (typewriter && !typewriter.isDone()) { typewriter.finish(); return; }
        restore(art, p, spot);
      });
    }

    const box = document.createElement('div');
    box.className = 'dx-room__closeup-text';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.appendChild(p);
    closeupEl.appendChild(box);

    el.appendChild(closeupEl);
    const caption = captionFor(spot.text, loadout);
    const hint = restorable ? captionFor(spot.restore.hint, loadout) : '';
    typewriter = createTypewriter(p, hint ? `${caption} {pause:300}${hint}` : caption, {
      onChar: playTypewriterTick,
    });

    // First tap finishes the draw, second dismisses — same language as
    // cutscene beats, so the gesture is already learned.
    closeupEl.addEventListener('click', () => {
      if (typewriter && !typewriter.isDone()) typewriter.finish();
      else closeCloseup();
    });
  }

  // Your class sees to it: the sound, the done line, the stamp.
  function restore(art, p, spot) {
    isRestored = true;
    art.classList.remove('is-restorable');
    art.classList.add('is-restored', 'is-restoring');
    buttons[mine].classList.remove('is-calling');
    buttons[mine].classList.add('is-restored');
    playClassSigil(loadout);
    typewriter?.destroy();
    p.textContent = '';
    typewriter = createTypewriter(p, captionFor(spot.restore.done, loadout), { onChar: playTypewriterTick });
    const stamp = document.createElement('span');
    stamp.className = 'dx-room__stamp';
    stamp.textContent = `${CLASSES[loadout].glyph} ${CLASSES[loadout].restored}`;
    closeupEl.appendChild(stamp);
    onRestore?.();
  }

  room.hotspots.forEach((spot, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dx-room__object';
    btn.innerHTML = `<img src="${spot.sprite}" alt="">`;
    if (spot.mood) {
      // Their feeling as a flat sprite tint (see the close-up).
      const tint = document.createElement('span');
      tint.className = 'dx-room__tint';
      tint.style.setProperty('--sprite', `url("${spot.sprite}")`);
      btn.appendChild(tint);
      btn.classList.add('has-mood');
      btn.style.setProperty('--mood', emotionColor(spot.mood));
    }
    if (i === mine && isRestored) btn.classList.add('is-restored');
    buttons.push(btn);
    place(btn, spot);
    btn.addEventListener('click', () => {
      // Retrigger the pop even on a repeat tap — objects stay re-inspectable
      // forever, so the feedback shouldn't go dead after the first time.
      btn.classList.remove('is-popping');
      void btn.offsetWidth;
      btn.classList.add('is-popping');
      seen.add(i);
      revealAdvanceIfDone();
      openCloseup(spot, i);
    });
    el.appendChild(btn);
  });

  el.appendChild(advanceEl);

  // Entry caption, if this room has one. Same two-tap gesture as a close-up:
  // finish the draw, then dismiss into the room. It covers the hotspots while
  // it's up, so the descriptive beat can't be tapped through by accident.
  let introEl = null;
  let introTypewriter = null;

  function closeIntro() {
    introTypewriter?.destroy();
    introTypewriter = null;
    introEl?.remove();
    introEl = null;
  }

  if (room.intro) {
    introEl = document.createElement('div');
    introEl.className = 'dx-room__intro';

    const box = document.createElement('div');
    box.className = 'dx-room__intro-text';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.appendChild(p);
    introEl.appendChild(box);
    el.appendChild(introEl);

    introTypewriter = createTypewriter(p, captionFor(room.intro, loadout), {
      onChar: playTypewriterTick,
    });

    introEl.addEventListener('click', () => {
      if (introTypewriter && !introTypewriter.isDone()) introTypewriter.finish();
      else closeIntro();
    });
  }

  return {
    el,
    destroy() {
      closeIntro();
      closeCloseup();
      bgAnimator.destroy();
    },
  };
}
