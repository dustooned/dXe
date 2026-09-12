// Music theory for the confrontation polychord. Pure math — no Web Audio,
// no DOM — so every claim in docs/STAT_MATH.md's harmonic section can be
// checked in Node before anything is audible.
//
// The model: an NPC sounds their own tonic as a fixed root voice. Each
// feeling the player has loaded sounds as another voice above it, placed
// by how many circle-of-fifths hops it sits from that root. One number
// (`resolution`, -1..+1) moves every feeling voice at once:
//
//   +1  full alignment   -> every voice collapses onto the root: unison
//    0  neutral          -> voices stack in perfect fifths: no third, so
//                          neither major nor minor, deliberately tonally
//                          ambiguous (quartal/quintal harmony)
//   -1  complete detach  -> every voice lands on the tritone against a
//                          root that is still sounding: the exact
//                          antipode of the circle, equidistant either
//                          direction you walk it
//
// Both extremes are exact positions, not approximations — that's what
// makes "maximum dissonance" a calculable place rather than a vibe.

// Hops, not semitones, is the "how related" axis. 6 hops is the tritone,
// the furthest any pitch can get from a root on the circle of fifths.
export const MAX_HOPS = 6;

// Root motion per harmonic function, in hops. Every modulation is one
// fourth/fifth — the strongest root motion in functional harmony, and the
// IV -> V -> I shape a confrontation walks from opening to resolution.
export const FUNCTION_HOPS = {
  predominant: -1,
  dominant: 1,
  tonic: 0,
};

const NOTE_SEMITONES = {
  C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4,
  'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2,
};

export function noteToFrequency(note) {
  const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) throw new Error(`Bad note name: "${note}"`);
  const [, name, octaveStr] = match;
  const semitoneFromA4 = NOTE_SEMITONES[name] + (Number(octaveStr) - 4) * 12;
  return 440 * Math.pow(2, semitoneFromA4 / 12);
}

// Semitone offset for N hops around the circle of fifths, folded within one
// octave. Hop count — not the raw semitone jump — is the "how related"
// axis: 0 hops is the tonic itself, 6 hops lands on the tritone, the least
// related point on the circle (same distance either direction you walk).
// The actual semitone jump per hop doesn't grow smoothly (1 hop is a fifth
// away in pitch, 2 hops folds to a major second — chromatic closeness and
// harmonic relatedness are different axes in real music theory), so hop
// count is what should read as "more in tune / more clashing," not the
// size of the jump.
//
// Used for bending a single melodic line (a leitmotif note), where the
// minimal chromatic distance is what you want so the melody doesn't leap
// an octave. Chord voicing uses voiceSemitones() below instead, which
// deliberately does NOT minimize — a chord wants its voices spread.
export function fifthsSemitoneOffset(hops) {
  const n = Math.min(MAX_HOPS, Math.abs(hops));
  const raw = (n * 7) % 12;
  const folded = raw > 6 ? raw - 12 : raw;
  return Math.sign(hops) * folded;
}

// Where a feeling voice sits right now, in hops from the root.
//
// Rounded on purpose. Voicing math below folds with `% VOICE_SPAN`, and
// feeding it a fractional hop would put voices between semitones — every
// chord slightly out of tune, and the tritone endpoint no longer landing
// exactly on the tritone. Rounding means the chord moves in discrete,
// exactly-tuned steps, which is also how harmony actually moves.
export function voiceHop(baseHop, resolution) {
  const raw = resolution >= 0
    ? baseHop * (1 - resolution)                        // -> 0, the root
    : baseHop + (MAX_HOPS - baseHop) * -resolution;     // -> 6, the tritone
  return Math.round(raw);
}

// Two octaves. Folding by a multiple of 12 preserves pitch class, which is
// what keeps the unison exact: voices that share a hop fold to the same
// number rather than to octave-displaced copies of it.
const VOICE_SPAN = 24;

// Semitones above the root for a voice at `hop`. Unlike
// fifthsSemitoneOffset this walks real ascending fifths (7 semitones per
// hop) and only folds to keep the chord in a playable register, so the
// neutral voicing comes out as a genuine stack of fifths rather than a
// cluster of minimal intervals.
export function voiceSemitones(hop) {
  return (hop * 7) % VOICE_SPAN;
}

// The chord as it stands right now.
//
// `tonicNote` is the NPC's root (e.g. 'A3'), `fn` one of FUNCTION_HOPS,
// `voiceCount` how many feelings the player has loaded. Returns the root
// frequency separately from the feeling voices because they're different
// dramatic objects: the root is the NPC, the voices are the player.
export function chordFor({ tonicNote, fn = 'tonic', resolution = 0, voiceCount = 3 }) {
  const functionHops = FUNCTION_HOPS[fn] ?? 0;
  // The function's own modulation is a melodic move of the whole key
  // centre, so it uses the minimal-distance folding — the root shouldn't
  // leap an octave just because the cadence advanced a step.
  const rootSemitones = fifthsSemitoneOffset(functionHops);
  const rootFrequency = noteToFrequency(tonicNote) * Math.pow(2, rootSemitones / 12);

  const hops = [];
  const voices = [];
  for (let i = 1; i <= voiceCount; i++) {
    const hop = voiceHop(i, resolution);
    hops.push(hop);
    voices.push(rootFrequency * Math.pow(2, voiceSemitones(hop) / 12));
  }

  // Averaged over the feeling voices only. The root is always at hop 0, so
  // including it would cap dissonance below 1 and the "complete detachment"
  // endpoint would never actually read as 1.
  const dissonance = hops.reduce((sum, h) => sum + Math.abs(h), 0) / (hops.length * MAX_HOPS);

  return { rootFrequency, voices, hops, dissonance };
}

// The pitch class a phrase is actually centred on, by total sounding time —
// the note the melody spends the most of itself on. Lets an NPC's harmonic
// root come from the melody a composer already wrote rather than being a
// second thing to author and keep in sync.
export function tonicFromPhrase(notes, fallback = 'A') {
  if (!notes?.length) return fallback;
  const byPitchClass = new Map();
  for (const { note, durationMs } of notes) {
    const pitchClass = note.replace(/-?\d+$/, '');
    byPitchClass.set(pitchClass, (byPitchClass.get(pitchClass) ?? 0) + durationMs);
  }
  let best = fallback;
  let bestDuration = -1;
  for (const [pitchClass, total] of byPitchClass) {
    if (total > bestDuration) {
      best = pitchClass;
      bestDuration = total;
    }
  }
  return best;
}
