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
import { characterArt, restArt } from '../engine/characters.js';
import { createCharacterAnimator, durationOf, frameUrl } from './characterAnimator.js';

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
// states, the portrait is a small state machine on one <img>:
//   rest       the first frame of their talk loop, held (nothing moves)
//   speaking   the talk loop, only while quoted speech is drawing: speak(true/
//              false), fed by the typewriter (typewriterText.js onSpeech). A
//              brief grace keeps the mouth moving through the gaps between
//              words, but a real pause or narration closes it.
//   waiting    setMood(feeling): their wait_<feeling> anticipation, played once
//              and held, while it's your turn
//   reacting   react('hit' | 'truth' | 'lie' | 'warm' | 'cold'): that state
//              played once the moment your answer lands; returns how long it
//              takes (0 with no art) so a caller can let it finish
// `hat` picks the Therapist's hat for this call. setState('trauma_2') holds any
// other drawn state until setState(null).
export const MOUTH_GRACE_MS = 90;

export function createNpcPortrait(npcName, accentColor, portraitUrl, { hat = null } = {}) {
  const el = document.createElement('div');
  el.className = 'dx-portrait';
  el.style.setProperty('--accent', accentColor || 'var(--color-white)');

  let maskLayer = null;
  let teardown = null;
  const none = () => {};
  let speak = none;
  let setMood = none;
  let react = () => 0;
  let setState = none;

  const rest = restArt(npcName, { hat });
  if (rest) {
    const img = document.createElement('img');
    img.className = 'dx-portrait__img dx-portrait__art';
    img.alt = npcName;
    el.appendChild(img);
    const anim = createCharacterAnimator(img);
    const art = (state, emotion) => characterArt(npcName, emotion ? `${state}_${emotion}` : state, { hat });
    let mood = null;
    let held = null;       // a named state set by setState
    let speaking = false;
    let reacting = false;
    let stopTimer = null;

    const show = () => {
      if (reacting) return;
      if (speaking) {
        const t = (mood && art('talk', mood)) || art('talk');
        if (t?.kind === 'anim') { anim.loop(t); return; }
      }
      if (held) { const h = art(held); if (h) { h.kind === 'anim' ? anim.once(h) : anim.hold(h); return; } }
      const w = mood ? art('wait', mood) : null;
      if (w?.key.startsWith('wait_')) { w.kind === 'anim' ? anim.once(w) : anim.hold(w); return; }
      anim.hold(rest, rest.frame ?? 0);
    };
    show();

    speak = (on) => {
      clearTimeout(stopTimer);
      if (on) { if (!speaking) { speaking = true; show(); } return; }
      // Off: only after a short grace, so the mouth doesn't flicker shut in the
      // gap between two words.
      stopTimer = setTimeout(() => { speaking = false; show(); }, MOUTH_GRACE_MS);
    };
    setMood = (m) => { mood = m ? String(m).toLowerCase() : null; show(); };
    setState = (s) => { held = s; show(); };
    react = (kind) => {
      const r = art(`react_${kind}`);
      if (!r?.key.startsWith('react_')) return 0; // nothing drawn for it: no reaction beat
      const ms = durationOf(r);
      reacting = true;
      const done = () => { reacting = false; show(); };
      if (r.kind === 'anim') anim.once(r, done); else { anim.hold(r); setTimeout(done, ms); }
      return ms;
    };
    teardown = () => { clearTimeout(stopTimer); anim.destroy(); };
    maskLayer = document.createElement('div');
    maskLayer.className = 'dx-portrait__mood';
    if (rest.kind === 'still') maskLayer.style.setProperty('--mask-url', `url('${rest.url}')`);
    else maskLayer.style.setProperty('--mask-url', `url('${frameUrl(rest, 0)}')`);
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

  const api = {
    el,
    nameplate,
    speak,
    setMood,
    react,
    setState,
    destroy() { teardown?.(); },
    // Called after each resolved dialog choice with audio.getLeitmotifMood() —
    // no-ops when there's no portrait image (maskLayer is null).
    updateMood(mood) {
      if (maskLayer) maskLayer.style.setProperty('--mood-color', moodToColor(mood));
    },
  };
  el._portrait = api; // so a typewriter's speech can reach it (dialogScene markSpeaking)
  return api;
}
