// IT and SO leaning on the player's pace: stalling on a choice, or racing
// through. Pure pressure — none of this changes a stat, a branch or the
// lake; it's texture, never a verdict (docs/IT_DESIGN.md). PLACEHOLDER PROSE.
//
// Stalling: the clock starts when the card and wheel appear and resets per
// node. One nudge at each mark, alternating voices, then silence.
// Rushing: FAST_STREAK answers in a row under FAST_MS from the card
// appearing, or SKIM_STREAK lines in a row tapped short while drawing —
// each said once per whole run (run.pressureSaid), never during the
// Therapist tutorial, after that answer's reaction. SO's skim reply points
// at the text speed setting, so the jab comes with a way out.

export const STALL_MARKS = [
  { ms: 30000, voice: 'it', pool: 'stall1' },
  { ms: 45000, voice: 'so', pool: 'stall2' },
  { ms: 60000, voice: 'it', pool: 'stall3' },
  { ms: 75000, voice: 'so', pool: 'stall4' },
];
export const FAST_MS = 2000;
export const FAST_STREAK = 3;
export const SKIM_STREAK = 4;

const POOLS = {
  stall1: [
    "Still there? The card's not going anywhere. Neither are they.",
    "Take your time. It's not like anyone's watching. (We're watching.)",
    "You've gone quiet. That's usually when it gets interesting.",
    "Waiting them out? They've waited longer than you have.",
  ],
  stall2: [
    'Or maybe not answering is the answer. Ever think about that?',
    "Or you're not stuck. You just don't like either one.",
    "Or they didn't notice the pause. People are generous with silence. Sometimes.",
    "Or this is the most honest you've been all day.",
  ],
  stall3: [
    "Clock's running. The lake doesn't pause for you.",
    "They're reading your face right now. What's it saying?",
    'Every second you wait is its own kind of answer.',
    "Left or right. It's two directions. You've done harder.",
  ],
  stall4: [
    'Pick the wrong one. Pick the right one. Just pick. We\'re bored.',
    "Fine. Sit in it. We'll be here.",
    "Or don't. We'll stop asking. That's not the same as it not mattering.",
    'Or maybe you want someone to choose for you. Nobody\'s coming.',
  ],
  fastIt: [
    'Whoa. Did you even read that?',
    "That was fast. Faster than they said it.",
    "You're answering before they've finished being a person.",
  ],
  fastSo: [
    "Or you already knew. Or you don't care. Hard to tell from here.",
    "Or you're just good at this. Sure. Let's go with that.",
    "Or slow is scarier. Fast means you don't have to feel it.",
  ],
  skimIt: [
    'Skimming. People can tell, you know.',
    "You keep cutting them off. Mid-sentence. Every time.",
    "They're still talking. You've already left.",
  ],
  skimSo: [
    "Or just turn the text speed up. It's in the gear.",
    "Or you read fast. There's a setting for that. Gear, top right.",
  ],
};

// Random line from a pool, never the same one twice in a row.
const lastUsed = {};
export function pressureLine(pool) {
  const lines = POOLS[pool] ?? [];
  const options = lines.length > 1 ? lines.filter((l) => l !== lastUsed[pool]) : lines;
  const line = options[Math.floor(Math.random() * options.length)] ?? '';
  lastUsed[pool] = line;
  return line;
}
