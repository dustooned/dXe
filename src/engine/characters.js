// The standard way a character is drawn and animated.
//
// Every NPC avatar is a set of named STATES, 192x192, 1-bit look, transparent.
// A state is either a still (one PNG) or a loop (numbered frames), and the
// art files for a character are listed in its manifest
// (src/chapters/lake-ulysses/characters/<npc>.json, written by
// scripts/import-character-gifs.mjs). Whatever isn't drawn yet falls back, so
// a character with only an idle and a talk loop already works everywhere:
//   asked-for state -> its fallbacks -> idle -> nothing (the letter avatar).
//
// How they move (ui/characterAnimator.js, ui/npcPortrait.js):
//   rest       their `idle` still, held: a calm face with the MOUTH SHUT. Nothing
//              moves, so the screen stays calm. (With no idle drawn, frame 0 of
//              the talk loop: so draw that frame mouth shut.)
//   speaking   the talk loop, ONLY while quoted speech is drawing. Never for
//              narration, directions or a pause. talk_<emotion> if drawn.
//   waiting    on the player's turn: wait_<emotion>, a short anticipation that
//              plays once and holds its last frame (a still is just held).
//   reacting   react_<kind>, played once the moment your answer lands, before
//              they speak: they take your words (hit, truth, lie, warm, cold).
// Frames are 100 ms each unless the manifest says otherwise (fps).
//
// The standard list below is also the artist's checklist (docs/CHARACTER_ART.md
// and docs/ASSET_REFERENCE.html): draw each state for each NPC.
import { EMOTION_ORDER } from './loadout.js';

export const CHARACTER_SIZE = 192;
export const TRAUMA_BEATS = 5;

// state -> where to look if it isn't drawn
export const STATES = {
  idle: [],
  talk: ['idle'],
  // Speaking in each feeling (a loop, like talk)
  ...Object.fromEntries(EMOTION_ORDER.map((e) => [`talk_${e.toLowerCase()}`, ['talk', 'idle']])),
  // Waiting on you in each feeling (anticipation: plays once, holds)
  ...Object.fromEntries(EMOTION_ORDER.map((e) => [`wait_${e.toLowerCase()}`, ['idle']])),
  // How your answer landed (played once, a moment before they speak)
  react_truth: ['idle'],   // a true answer arrives
  react_lie: ['idle'],     // a comforting lie arrives
  react_hit: ['idle'],     // a big swing (strong hit)
  react_warm: ['idle'],    // they turn toward you (a bid)
  react_cold: ['idle'],    // they close up
  // Big moments
  connect: ['react_warm', 'idle'],     // the stay-in-touch bust
  pushaway: ['react_cold', 'idle'],    // pushed away at the end
  ...Object.fromEntries(Array.from({ length: TRAUMA_BEATS }, (_, i) => [`trauma_${i + 1}`, ['connect', 'idle']])),
};
export const STATE_NAMES = Object.keys(STATES);

// The Therapist wears a different hat on each call (his own stills 1-3 and
// a talk loop per hat); everyone else has none.
export const THERAPIST_HATS = ['bunny', 'derby', 'fez', 'jester', 'old_man', 'pork_pie', 'sombrero', 'top'];

const manifests = {};

// { './characters/therapist.json': { npc, art } , ... } from import.meta.glob
export function registerCharacterArt(modules) {
  for (const mod of Object.values(modules)) {
    const m = mod.default ?? mod;
    if (m?.npc) manifests[m.npc.toLowerCase()] = m;
  }
}

const dirOf = (npc) => `/assets/lake-ulysses/characters/${npc}`;

// A hat's own names for the two core states.
function hatted(state, hat) {
  if (!hat) return [state];
  return { idle: [`${hat}_3`], talk: [`${hat}_talk`] }[state] ?? [state];
}

// -> { kind: 'still', key, url } | { kind: 'anim', key, base, frames, fps, ext: 'png' } | null
export function characterArt(npcName, state = 'idle', { hat = null } = {}) {
  const npc = String(npcName).toLowerCase();
  const m = manifests[npc];
  if (!m) return null;
  const chain = [state, ...(STATES[state] ?? ['idle'])];
  for (const s of chain) {
    // The Therapist's own set: his idle is the shut-mouth still, `_3` (`_1` is the
    // open mouth, `_2` a blink).
    for (const key of [...hatted(s, hat), ...(s === 'idle' ? ['neutral_3'] : s === 'talk' ? ['neutral_talk'] : [])]) {
      const piece = m.art[key];
      if (!piece) continue;
      // `key` is the piece that was found (after fallbacks), so a caller can tell
      // a real wait_anger from the idle it fell back to.
      if (piece.frames > 1) return { kind: 'anim', key, base: `${dirOf(npc)}/${key}/${key}_`, frames: piece.frames, fps: piece.fps ?? 10, ext: 'png' };
      return { kind: 'still', key, url: `${dirOf(npc)}/${key}.png` };
    }
  }
  return null;
}

// The held face when nothing is happening: their idle still (mouth shut), else
// frame 0 of their talk loop.
export function restArt(npcName, { hat = null } = {}) {
  const idle = characterArt(npcName, 'idle', { hat });
  if (idle) return idle;
  const talk = characterArt(npcName, 'talk', { hat });
  if (talk?.kind === 'anim') return { ...talk, kind: 'frame', frame: 0 };
  return null;
}

// Which states a character has art for, against the standard list: what is
// still to draw. (Used by tests and the asset reference.)
export function missingStates(npcName) {
  const m = manifests[String(npcName).toLowerCase()];
  return STATE_NAMES.filter((s) => !(m?.art[s] || (s === 'idle' && m?.art.neutral_3) || (s === 'talk' && m?.art.neutral_talk)));
}

// The Therapist's hats are a visual gag on his dry, neutral voice: he never
// mentions the hat, and the hat is always a little too appropriate. Each rule
// is a moment and the hat that fits it (first match wins; a hat is never worn
// twice in a row; no match means he comes bare-headed, which is the baseline).
//   kind: what the call is. 'scope' / 'mask' / 'friend' are his coach calls,
//   'call' is you ringing him, 'voicemail' is him not picking up, 'return' is
//   his "you again" call on a repeat playthrough (with `ending`).
export const HAT_RULES = [
  { hat: 'sombrero', why: 'his voicemail: out of office, taking a siesta', when: (c) => c.kind === 'voicemail' },
  { hat: 'top', why: 'you came out of the lake clean: he dressed for the occasion', when: (c) => c.kind === 'return' && c.ending === 'CLEAN_CUT' },
  { hat: 'derby', why: 'you came out of the lake damp: sensible, professional, a little disappointed', when: (c) => c.kind === 'return' && c.ending === 'FUNCTIONAL_MASK' },
  { hat: 'old_man', why: 'you came out of the lake soaked: he is tired on your behalf', when: (c) => c.kind === 'return' && c.ending === 'COLLAPSE' },
  { hat: 'pork_pie', why: 'you came out of the lake a water-quality advisory: he is investigating', when: (c) => c.kind === 'return' && c.ending === 'LIVING_LIE' },
  { hat: 'jester', why: 'a mask, or you are on a lie streak: he is not laughing, the hat is', when: (c) => c.kind === 'mask' || (c.lieStreak ?? 0) >= 2 },
  { hat: 'pork_pie', why: 'the lake is dirty (debt 6+): a noir detective on the case', when: (c) => (c.truthDebt ?? 0) >= 6 },
  { hat: 'sombrero', why: 'your Wi-Fi is fogged: a sun-struck siesta in the haze', when: (c) => (c.lucidity ?? 5) < 4 },
  { hat: 'old_man', why: 'your battery is nearly empty: he is tired for you', when: (c) => (c.stability ?? 5) <= 2 },
  { hat: 'bunny', why: 'your Bars are low and he is gentle about it, which is funnier', when: (c) => (c.trust ?? 5) <= 3 },
  { hat: 'fez', why: 'a new friend joined your phone: welcome to the club', when: (c) => c.kind === 'friend' },
  { hat: 'derby', why: 'the first real battle: he is being professional about it', when: (c) => c.kind === 'scope' },
  { hat: 'top', why: 'the lake is clean (debt 2 or less): he is dressed for the occasion', when: (c) => (c.truthDebt ?? 0) <= 2 },
];

// -> { hat: 'fez' | null, why }. `last` is the hat he wore on his previous call.
export function hatForContext(ctx) {
  const rule = HAT_RULES.find((r) => r.hat !== ctx.last && r.when(ctx));
  return rule ? { hat: rule.hat, why: rule.why } : { hat: null, why: 'bare-headed: nothing calls for a hat' };
}

// A random hat, never the same twice in a row. (A fallback; hatForContext is the gag.)
export function hatFor(seed) {
  return THERAPIST_HATS[Math.abs(Number(seed) || 0) % THERAPIST_HATS.length];
}
