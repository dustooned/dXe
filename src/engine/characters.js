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
// The standard list below is also the artist's checklist (docs/CHARACTER_ART.md
// and docs/ASSET_REFERENCE.html): draw each state for each NPC.
import { EMOTION_ORDER } from './loadout.js';

export const CHARACTER_SIZE = 192;
export const TRAUMA_BEATS = 5;

// state -> where to look if it isn't drawn
export const STATES = {
  idle: [],
  talk: ['idle'],
  // How they feel right now (their MOOD): one still per feeling
  ...Object.fromEntries(EMOTION_ORDER.map((e) => [`feel_${e.toLowerCase()}`, ['idle']])),
  // How your answer landed
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
  return { idle: [`${hat}_1`], talk: [`${hat}_talk`] }[state] ?? [state];
}

// -> { kind: 'still', url } | { kind: 'anim', base, frames, fps, ext: 'png' } | null
export function characterArt(npcName, state = 'idle', { hat = null } = {}) {
  const npc = String(npcName).toLowerCase();
  const m = manifests[npc];
  if (!m) return null;
  const chain = [state, ...(STATES[state] ?? ['idle'])];
  for (const s of chain) {
    for (const key of [...hatted(s, hat), ...(s === 'idle' ? ['neutral_1'] : s === 'talk' ? ['neutral_talk'] : [])]) {
      const piece = m.art[key];
      if (!piece) continue;
      if (piece.frames > 1) return { kind: 'anim', base: `${dirOf(npc)}/${key}/${key}_`, frames: piece.frames, fps: piece.fps ?? 10, ext: 'png' };
      return { kind: 'still', url: `${dirOf(npc)}/${key}.png` };
    }
  }
  return null;
}

// Which states a character has art for, against the standard list: what is
// still to draw. (Used by tests and the asset reference.)
export function missingStates(npcName) {
  const m = manifests[String(npcName).toLowerCase()];
  return STATE_NAMES.filter((s) => !(m?.art[s] || (s === 'idle' && m?.art.neutral_1) || (s === 'talk' && m?.art.neutral_talk)));
}

// A hat for this call: a different one each time, never the same twice in a row.
export function hatFor(seed) {
  return THERAPIST_HATS[Math.abs(Number(seed) || 0) % THERAPIST_HATS.length];
}
