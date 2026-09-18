// SO — the counterpart to IT (engine/itBlooms.js, engine/itEmotionLean.js).
// See docs/IT_DESIGN.md's "SO — the doubt rebuttal" section for the full
// design writeup; this file is just the paired content.
//
// IT states with dread-certainty — magnifies, names a cost, names a pattern.
// SO doesn't comfort and doesn't argue the opposite conclusion; it just
// won't let IT's claim stand unquestioned. That's deliberately not the same
// move as reassurance: a reassuring voice takes a side (it's fine, don't
// worry). SO takes no side. It just makes sure nothing gets to feel settled,
// in either direction — the actual clinical hallmark of doubt in obsessive
// thought patterns (historically "folie du doute," the doubting disease) is
// that it doesn't resolve toward belief OR disbelief, it just keeps
// reopening the question.
//
// PLACEHOLDER PROSE, same bar as itBlooms.js/itEmotionLean.js — one rebuttal
// per existing IT line, not final writing. SO always fires as a direct
// answer to whatever IT just said (dialogScene.js chains the two popups),
// never on its own schedule, so every entry here exists specifically to
// contradict its IT counterpart, not to stand alone.

export const SO_BLOOM_TEXT = {
  3: {
    Guns: "Cost you how. You don't even know the price yet — you're just assuming there is one.",
    Bible: 'One thing isn’t a pattern. Who told you it was — her, or you?',
    Crystals: "Will you, though. Or will you decide later that you didn't feel anything at all.",
  },
  6: {
    Guns: "Hiding it from who. Nobody's counting but you.",
    Bible: 'Should it? Or does it just feel that way because you’re looking for something to worry about.',
    Crystals: "Louder, or you're just listening for it now. Those aren't the same thing.",
  },
  8: {
    Guns: "Says who. It's the same size it's always been — you're the one that changed.",
    Bible: 'Do you, though. Or did you just decide that’s how the story goes.',
    Crystals: 'Should, according to what. You made that number up.',
  },
  10: {
    Guns: 'Answer to who. Nobody actually asked you anything.',
    Bible: 'Built, or it just happened and you needed a story with you at the center of it.',
    Crystals: "Or it was always this size and you're only noticing it now that you're looking.",
  },
};

const SO_EMOTION_LEAN_TEXT = {
  Guns: {
    Anger: "Feels like it. Doesn't mean it is. You haven't actually checked.",
    Fear: "How do you know nothing's coming. You're not exactly a reliable narrator on that one.",
    Anticipation: 'Or you arrive fine and just don’t notice, because you’re too busy checking if you have.',
    neutral: "Interesting, or just true. Not everything means something.",
  },
  Bible: {
    Trust: "Earned by whose measure. You don't actually have a way to check that.",
    Disgust: "Recoils, or notices fast. You've decided which one it is without any real evidence.",
    Anticipation: 'Or you’re guessing like everyone else and calling it certainty after the fact.',
    neutral: "Is it, though. Or is it just not an answer at all, and you're the one insisting it means something.",
  },
  Crystals: {
    Joy: "Isn't there? Or did you just stop looking before you found it.",
    Sadness: "Heavy, or honest. You're the one deciding it doesn't fit.",
    Surprise: 'Or you never really expected anything, and you’re only calling it "stopped" now.',
    neutral: "Isn't it, though. Maybe it's exactly nothing, and you just don't want it to be.",
  },
};

// Same resolution shape as itEmotionLean.js's emotionLeanText() — returns
// the already-resolved plain string for this class + dominant emotion, so
// dialogScene.js can hand it straight to createItPopup the same way.
export function soEmotionLeanText(loadout, dominantEmotion) {
  const rows = SO_EMOTION_LEAN_TEXT[loadout] ?? SO_EMOTION_LEAN_TEXT.Guns;
  return rows[dominantEmotion] ?? rows.neutral;
}
