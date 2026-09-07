// IT's read on the player's own FEELZ pattern — not the NPC's, this time.
// Fires once per NPC encounter (dialogScene.js, at the end of that NPC's
// node graph), keyed by class and by whichever emotion the player has
// leaned on most across the whole run so far (engine/loadout.js's
// getDominantEmotion()). PLACEHOLDER PROSE — one line per class per loaded
// emotion, plus one neutral fallback per class, written to exercise the
// split, not final writing.
//
// The neutral line fires when there's no unique leader — a genuine spread,
// not a tie the game has to arbitrarily break. It's written calmer and more
// detached than the emotion-specific lines on purpose: less anxious, still
// removed — IT noticing an absence of pattern is a different beat than IT
// noticing a pattern, and shouldn't just reuse the same jittery register.
const EMOTION_LEAN_IT_TEXT = {
  Guns: {
    Anger: "You keep reaching for anger. It's the only one that feels like doing something.",
    Fear: "You keep bracing. Every single time. Even when nothing's coming.",
    Anticipation: "You're already three moves ahead of whatever just happened. You never actually arrive.",
    neutral: "You didn't lead with anything. Not once. Interesting, that.",
  },
  Bible: {
    Trust: 'You keep handing it over. Every time. Whether or not it was earned.',
    Disgust: 'Something in you recoils first and asks questions later. Every single time.',
    Anticipation: "You've decided how this ends before it does. You always have.",
    neutral: "You didn't commit to a read on any of it. That's its own kind of answer.",
  },
  Crystals: {
    Joy: "You keep reaching for the light version. Even when there isn't one.",
    Sadness: 'You keep landing here. Heavy, every time, whether the moment asked for it or not.',
    Surprise: "Nothing lands where you expect it to. You've stopped expecting.",
    neutral: "You felt all of it a little. None of it all the way. That's not nothing.",
  },
};

// Returns the already-resolved line for this player's class + dominant
// emotion — a plain string, not a { Guns, Bible, Crystals } object, since
// the caller already knows the class (createItPopup's `text` accepts a
// plain string same as it accepts the object form; see ui/itPopup.js).
export function emotionLeanText(loadout, dominantEmotion) {
  const rows = EMOTION_LEAN_IT_TEXT[loadout] ?? EMOTION_LEAN_IT_TEXT.Guns;
  return rows[dominantEmotion] ?? rows.neutral;
}
