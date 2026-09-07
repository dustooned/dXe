// IT's lines for the two terminal beats — the Reckoning and the Ending.
// PLACEHOLDER PROSE, one line per class each, not final writing.
// Both are the { Guns, Bible, Crystals } object shape ui/itPopup.js's
// resolveItText() already expects, since there's no second axis (emotion,
// threshold) to key on here — just the class.

// Shown once, before the first Reckoning card — "IT is loudest here"
// (docs/IT_DESIGN.md).
export const RECKONING_IT_TEXT = {
  Guns: "Here it is. Everything you didn't want to carry, waiting to be carried anyway.",
  Bible: 'This is the part where you find out what you actually believe, not what you said you did.',
  Crystals: "All of it, at once. You don't get to feel this in pieces anymore.",
};

// Shown once the ending's body text finishes drawing, before "BACK TO
// MENU" appears — IT gets the actual last word of the chapter.
export const ENDING_IT_TEXT = {
  Guns: 'You already knew how this ended. You just needed to watch it happen.',
  Bible: "Whatever you're telling yourself about this right now — that's the last lie. Or the first true thing. Your call.",
  Crystals: 'Something in you is going to carry this a while. Let it.',
};
