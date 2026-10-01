// Character voices: SAM, the 1982 Software Automatic Mouth (sam-js, a
// reverse-engineered port; see docs/HANDOFF.md for the license caveat).
// Only ever single words or short exclamations — a bark under the text,
// never a reading of it. Rendered live: SAM is pure and deterministic, so
// every device hears the same thing, and each line is cached after its
// first render.
//
// Where they play (dialogScene.js):
//   up / down / flat  the NPC's reaction to your answer, by how it landed
//   greet / bye       picking up and hanging up a phone call (phone-filtered)
//   farewell          sending you off, once they have trusted you and you swap
//                     numbers (the stay-in-touch bust)
import SamJs from 'sam-js';
import { playSamples } from './audio.js';

// SAM's four knobs, per character. Lower pitch numbers are higher voices.
const VOICES = {
  // Tired, nasal, kind: forty clients deep.
  THERAPIST: { speed: 84, pitch: 74, throat: 110, mouth: 105 },
  // Church-greeter bright, a little wobbly underneath.
  DEBORAH: { speed: 80, pitch: 38, throat: 145, mouth: 150 },
  // Dry, unhurried, done explaining herself.
  RWANDA: { speed: 78, pitch: 54, throat: 140, mouth: 172 },
  // Quick and bouncy, deflecting with a grin.
  SAMUN: { speed: 62, pitch: 58, throat: 150, mouth: 178 },
  // Low and clipped, proving something.
  RICK: { speed: 88, pitch: 92, throat: 100, mouth: 112 },
};

// What each of them says. Spelled for SAM's ear, not the reader's.
const LINES = {
  THERAPIST: { greet: 'Browning.', bye: 'Take care.', up: 'Mmm hmm.', down: 'Hmm.', flat: 'Okay.', hello: 'Hello?' },
  DEBORAH: { farewell: 'God bless you, sweetheart.', greet: 'Hello, dear!', bye: 'Bless you.', up: 'Oh, honey.', down: 'Well!', flat: 'Mmm.' },
  RWANDA: { farewell: 'Dont be a stranger.', greet: 'Yeah?', bye: 'Later.', up: 'Huh.', down: 'Right.', flat: 'Sure.' },
  SAMUN: { farewell: 'Catch you later, man!', greet: 'Yo!', bye: 'Peace!', up: 'Ha!', down: 'Oof.', flat: 'Yeah yeah.' },
  RICK: { farewell: 'Watch yourself out there.', greet: 'What.', bye: 'Yep.', up: 'Heh.', down: 'Tsk.', flat: 'Uh huh.' },
};

const SAM_RATE = 22050;
const cache = new Map();

function render(who, text) {
  const key = `${who}|${text}`;
  if (!cache.has(key)) {
    try {
      cache.set(key, new SamJs(VOICES[who]).buf32(text) || null);
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key);
}

export function hasVoice(who) {
  return !!VOICES[who];
}

// Says one of `who`'s lines. `phone` runs it through a telephone band;
// `delayMs` waits first; `cut` (0..1) stops it partway, for a call that
// drops mid-word; `gain` scales it. Returns the line's length in ms (0 if
// there's nothing to say).
export function say(who, key, { phone = false, delayMs = 0, cut = 1, gain = 1 } = {}) {
  const text = LINES[who]?.[key];
  if (!text) return 0;
  const samples = render(who, text);
  if (!samples?.length) return 0;
  playSamples(samples, SAM_RATE, { delayMs, phone, cut, gain });
  return Math.round((samples.length / SAM_RATE) * 1000 * cut);
}

// The reaction bark for how an answer landed: positive, negative, or
// neither (by how far it moved their TRU and STB together).
export function bark(who, delta, opts) {
  return say(who, delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', opts);
}
