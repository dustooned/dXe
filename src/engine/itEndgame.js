// IT's line for the chapter's terminal beat, the Ending.
// PLACEHOLDER PROSE, one line per class, not final writing.
// It's the { Guns, Bible, Crystals } object shape ui/itPopup.js's
// resolveItText() already expects, since there's no second axis (emotion,
// threshold) to key on here — just the class.

// (The Reckoning's own IT line was retired when the Reckoning became Pastor
// Gabriel's baptism: IT and SO now appear there as his gatekeepers, from
// content/pastor.json's `gate` section. See docs/IT_DESIGN.md.)

// Shown once the ending's body text finishes drawing, before "BACK TO
// MENU" appears — IT gets the actual last word of the chapter.
export const ENDING_IT_TEXT = {
  Guns: 'You already knew how this ended. You just needed to watch it happen.',
  Bible: "Whatever you're telling yourself about this right now — that's the last lie. Or the first true thing. Your call.",
  Crystals: 'Something in you is going to carry this a while. Let it.',
};

// SO answers IT's last word, same class split. PLACEHOLDER PROSE.
export const ENDING_SO_TEXT = {
  Guns: "Or you didn't know anything, and you're only calling it knowing now that it's over.",
  Bible: "Or it's neither, and you're making it mean something because the alternative is worse.",
  Crystals: "Or it's gone by Tuesday. You've carried heavier and forgotten it faster.",
};
