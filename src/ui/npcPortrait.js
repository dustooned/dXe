// Colored-initial placeholder until real portrait art lands (see docs/CONTENT_SCHEMA.md
// asset spec) — an NPC's content JSON can carry a `portrait` path once art exists,
// authored via the manuscript's `PORTRAIT:` header (SCRIPT_FORMAT.md); omitting it
// keeps today's placeholder.
//
// Mood mask: once a real portrait image exists, its own light/dark values become a
// CSS mask over a solid color layer — same live-value pattern as the leitmotif's
// fifths bend (shell/audio.js's getLeitmotifMood()), just visual instead of audible.
// Prototyped and confirmed working against real production art before this was
// wired in for real (see the Mood Mask Lab artifact). No-op with no portrait image:
// there's nothing to mask yet on the colored-letter placeholder.
import { characterArt } from '../engine/characters.js';
import { createSpriteAnimator } from './spriteAnimator.js';

const MOOD_CLAMP = 6;
const NEUTRAL = [242, 242, 240];
const TENSE = [255, 59, 59];
const RESONANT = [0, 230, 168];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function moodToColor(mood) {
  const m = Math.max(-MOOD_CLAMP, Math.min(MOOD_CLAMP, mood));
  if (m === 0) return `rgb(${NEUTRAL.join(',')})`;
  const t = Math.abs(m) / MOOD_CLAMP;
  const target = m < 0 ? TENSE : RESONANT;
  const rgb = [0, 1, 2].map((i) => lerp(NEUTRAL[i], target[i], t));
  return `rgb(${rgb.join(',')})`;
}

// Standard character art (engine/characters.js): when the NPC has drawn
// states, the portrait shows their idle and plays their talk loop while they
// speak (dialogScene marks that with the .is-speaking class, which this watches).
// `hat` picks the Therapist's hat for this call. setState('feel_anger') etc.
// swaps to another drawn state and back to idle/talk after.
export function createNpcPortrait(npcName, accentColor, portraitUrl, { hat = null } = {}) {
  const el = document.createElement('div');
  el.className = 'dx-portrait';
  el.style.setProperty('--accent', accentColor || 'var(--color-white)');

  let maskLayer = null;
  let teardown = null;
  let setState = () => {};

  const idleArt = characterArt(npcName, 'idle', { hat });
  if (idleArt) {
    const img = document.createElement('img');
    img.className = 'dx-portrait__img dx-portrait__art';
    img.alt = npcName;
    el.appendChild(img);
    let animator = null;
    let held = null; // a state the caller set (an emotion, a reaction)
    const show = (art) => {
      animator?.destroy();
      animator = null;
      if (art?.kind === 'anim') animator = createSpriteAnimator(img, art);
      else if (art?.kind === 'still') img.src = art.url;
    };
    const refresh = () => {
      const speaking = el.classList.contains('is-speaking');
      show(characterArt(npcName, held ?? (speaking ? 'talk' : 'idle'), { hat }) ?? idleArt);
    };
    refresh();
    const watch = new MutationObserver(refresh);
    watch.observe(el, { attributes: true, attributeFilter: ['class'] });
    setState = (state) => { held = state; refresh(); };
    teardown = () => { watch.disconnect(); animator?.destroy(); };
    maskLayer = document.createElement('div');
    maskLayer.className = 'dx-portrait__mood';
    if (idleArt.kind === 'still') maskLayer.style.setProperty('--mask-url', `url('${idleArt.url}')`);
    el.appendChild(maskLayer);
  } else if (portraitUrl) {
    const img = document.createElement('img');
    img.className = 'dx-portrait__img';
    img.src = portraitUrl;
    img.alt = npcName;
    el.appendChild(img);

    maskLayer = document.createElement('div');
    maskLayer.className = 'dx-portrait__mood';
    maskLayer.style.setProperty('--mask-url', `url('${portraitUrl}')`);
    el.appendChild(maskLayer);
  } else {
    el.textContent = npcName.charAt(0).toUpperCase();
  }

  const nameplate = document.createElement('div');
  nameplate.className = 'dx-nameplate';
  nameplate.textContent = npcName;

  return {
    el,
    nameplate,
    setState,
    destroy() { teardown?.(); },
    // Called after each resolved dialog choice with audio.getLeitmotifMood() —
    // no-ops when there's no portrait image (maskLayer is null).
    updateMood(mood) {
      if (maskLayer) maskLayer.style.setProperty('--mood-color', moodToColor(mood));
    },
  };
}
