// IT's lines for Truth Debt's bloom-event thresholds (engine/debtEngine.js's
// BLOOM_THRESHOLDS). PLACEHOLDER PROSE — one line per class per threshold,
// written to exercise the class-voice split (docs/IT_DESIGN.md), not final
// writing. Keyed by threshold rather than nested under an NPC: a bloom is
// about the player's accumulated debt, not any one encounter, so it reads
// the same regardless of which NPC's scene it interrupts.
export const BLOOM_IT_TEXT = {
  3: {
    Guns: "That's the first one that'll cost you. Small, but it's on the books now.",
    Bible: 'You just told a comfortable lie. That is how it starts — one, then it is a pattern.',
    Crystals: 'Something in you just went a little quieter. You will notice it later.',
  },
  6: {
    Guns: "You're not even hiding it anymore.",
    Bible: "Somebody's words are still in your head. That should worry you.",
    Crystals: "It's getting louder in here. All the things you didn't say.",
  },
  8: {
    Guns: 'This is the part where it stops being small.',
    Bible: "You're not going to walk away from this clean. You know that now.",
    Crystals: 'Everything feels closer to the surface than it should.',
  },
  10: {
    Guns: 'Out of room. Time to answer for it.',
    Bible: 'This is the reckoning you built, one comfortable lie at a time.',
    Crystals: "There's nowhere left to put it. It's all coming up at once.",
  },
};
