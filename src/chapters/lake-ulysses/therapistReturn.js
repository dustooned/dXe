// The repeat client: a player who has finished this chapter before doesn't
// sit through the Therapist's tutorial again. Instead he picks up, already
// holding last run's file (save.lastRun, written by endingScene.js), and
// reads it back at you: how wet you came out of the lake, what you did under
// Gabriel's hand, your class then and now. Then the same homework, and off.
// Dark, a little funny, in his voice (docs/HANDOFF.md "Therapist voice").
//
// Returns a cutscene scene that replaces the 'therapist' dialog
// (chapters/lake-ulysses/index.js). PLACEHOLDER lines for the writer pass.
import therapist from './content/therapist.json';
import { ppmFor } from '../../engine/lake.js';

const WET = {
  CLEAN_CUT: 'Your file says you came out of the lake dry. Statistically that\'s rude to everyone else.',
  FUNCTIONAL_MASK: 'Your file says you came out of the lake damp. Damp is fine. Damp is most people.',
  COLLAPSE: 'Your file says you came out of the lake soaked. You\'re still dripping. On my end. Through the phone. Don\'t ask how.',
  LIVING_LIE: 'Your file says you came out of the lake... I\'m going to be honest, that\'s not a person, that\'s a water quality advisory.',
};

const BAPTISM = {
  confessed: "And Gabriel put you under and you came up talking. Most people come up quiet. My note says 'talks underwater.'",
  doubled: "And Gabriel held you under and you still said no. I wrote 'admirable?' in your file. The question mark is doing a lot of work.",
};

const SAME_CLASS = {
  Guns: 'Still the Guns. You brought the same holster to therapy twice.',
  Bible: 'Still the Bible. Same bookmark, same page. I respect a reread.',
  Crystals: 'Still the Crystals. They don\'t recharge if you keep holding them, by the way. I looked it up.',
};

// His class homework from the tutorial, minus the part where he explains
// that he gives homework (you've heard it).
function homeworkFor(cls) {
  const beat = therapist.outro.find((b) => b.when?.class === cls && /I give everyone homework/.test(b.text ?? ''));
  return beat?.text.replace(/^"?I give everyone homework\. Almost nobody does it\. Here's yours anyway\.\s*/, '').replace(/^"|"$/g, '') ?? 'Ask one person about their day. Then wait for the answer.';
}

const say = (text) => ({ speaker: 'THERAPIST', text });

export function therapistReturnScene(lastRun) {
  const ppm = ppmFor(lastRun.truthDebt ?? 0);
  const changedClass = Object.fromEntries(['Guns', 'Bible', 'Crystals'].map((cls) => [cls,
    lastRun.loadout === cls
      ? SAME_CLASS[cls]
      : `Last time, the ${lastRun.loadout ?? 'nothing'}. Now the ${cls}? A rebrand. Bold. Okay.`]));
  const beats = [
    say(`Oh. {pause:300}You again. ${WET[lastRun.endingKey] ?? WET.FUNCTIONAL_MASK} You left at ${ppm} ppm.`),
    lastRun.baptism && say(BAPTISM[lastRun.baptism]),
    say(changedClass),
    say('So you\'re doing the whole lake again. On purpose. I\'m not judging. I\'m writing it down, which is different, legally.'),
    say(Object.fromEntries(['Guns', 'Bible', 'Crystals'].map((cls) => [cls,
      `We did the tutorial. I'm not doing the voices again. Same homework: ${homeworkFor(cls)} Okay. Bye.`]))),
  ].filter(Boolean);
  return { type: 'cutscene', id: 'therapist', beats };
}
