// IT and SO get sharper as the lake gets worse. Whatever they're saying in
// an encounter, a closing line is added once the water reaches HIGH, and it
// turns crueler through CONTAMINATED and OVER LIMIT. Clean water leaves
// their lines alone: detached observers, not yet interested in you.
// PLACEHOLDER PROSE.
import { statusFor } from './lake.js';

const TAGS = {
  it: {
    HIGH: [
      "That's going to cost you. You know that, right?",
      'Keep a running total. We are.',
      'The water noticed. Just so you know.',
    ],
    CONTAMINATED: [
      "You're getting good at this. Should that scare you?",
      "Remember when this felt hard? We don't.",
      "Look at the fish. Go on. Look.",
    ],
    'OVER LIMIT': [
      "Keep going. The water's almost ready for you.",
      "He's already wading out. He can smell it on you.",
      'Nearly there. Hold your breath. Practice.',
    ],
  },
  so: {
    HIGH: [
      "Or it's fine. Probably. Most things are, until they aren't.",
      "Or it's not that bad. Say that again. Louder.",
    ],
    CONTAMINATED: [
      'Or you stopped noticing a while ago. Which is it?',
      "Or this is just who you are now. Doesn't that feel better?",
    ],
    'OVER LIMIT': [
      'Or you want to go under. Easier than swimming.',
      "Or you were always going to end up in the water. We just watched.",
    ],
  },
};

const last = {};
function pick(list, key) {
  const options = list.length > 1 ? list.filter((l) => l !== last[key]) : list;
  const line = options[Math.floor(Math.random() * options.length)];
  last[key] = line;
  return line;
}

// `text` is already resolved to a plain string.
export function sharpen(text, voice, truthDebt) {
  const status = statusFor(truthDebt ?? 0);
  const tags = TAGS[voice === 'so' ? 'so' : 'it'][status];
  if (!tags || !text) return text;
  return `${text} ${pick(tags, `${voice}:${status}`)}`;
}
