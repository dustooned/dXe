// Composes the text shown after a swipe: the node's authored npcReaction plus
// one short coda drawn from a shared table, keyed by the FEELZ emotion the
// player picked and by which side they swiped.
//
// One table covers every node in the game — an authored reaction stays the
// scene's real writing, and the coda is the part that answers the wheel. This
// is why a new NPC needs no extra work to respond to all 8 emotions.
//
// The codas describe *delivery* — how the line left you, how it sat in the
// room — never whether the choice was right. Same rule the fx intensity
// follows: weight, not verdict.
//
// PLACEHOLDER PROSE. The table shape is the design; the lines exist to cover
// all 16 combinations, not as final writing.

const CODAS = {
  Joy: {
    truth: 'It came out lighter than the thing deserved.',
    lie: 'You enjoyed how easy that was. You notice yourself enjoying it.',
  },
  Trust: {
    truth: 'You handed it over whole, without checking who was holding it.',
    lie: 'You said it the way you say things to people who believe you.',
  },
  Fear: {
    truth: 'You got it out before you could take it back.',
    lie: 'You heard the safer version leave your mouth and let it go.',
  },
  Surprise: {
    truth: "You weren't planning to say that. It was already said.",
    lie: 'The lie arrived fully built, and you had no memory of building it.',
  },
  Sadness: {
    truth: 'Quieter than you meant. It landed anyway.',
    lie: "You said it gently, which somehow made it worse.",
  },
  Disgust: {
    truth: 'You could taste it on the way out.',
    lie: 'Something in you turned away while your mouth kept going.',
  },
  Anger: {
    truth: 'Harder than you meant it. You do not take it back.',
    lie: 'You put an edge on it so nobody would look too closely.',
  },
  Anticipation: {
    truth: 'You were already braced for what comes after.',
    lie: 'You were three moves ahead before the sentence finished.',
  },
};

export function reactionCoda(emotion, swipeKey) {
  return CODAS[emotion]?.[swipeKey] ?? null;
}

// Falls back to the authored line alone when no emotion was in play, so a
// scene that doesn't use the dartboard reads exactly as it did before.
export function composeReaction(npcReaction, emotion, swipeKey) {
  const coda = reactionCoda(emotion, swipeKey);
  return coda ? `${npcReaction}\n\n${coda}` : npcReaction;
}
