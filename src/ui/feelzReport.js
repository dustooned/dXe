// The FEELZ clinical read: diagnoses, interpretations and the case note,
// consolidated into the ending's fax record by ui/feelzRecord.js. (It used
// to be its own full page of the ending.) The app's read on the player, in
// its own flat clinical voice: the first and only place the game names the
// player's class, as a diagnosis. PLACEHOLDER PROSE for
// the interpretations and case notes; the structure is the point.
//
// Everything here is already tracked on the run: loadout (class),
// emotionCounts (every FEELZ pick), choices (truth/lie per node, keyed
// `<npc>_<node>`). Nothing new is recorded for it.
import { emotionsForClass, getDominantEmotion } from '../engine/loadout.js';

// The class, as FEELZ files it. Each description doubles as a hint at the
// player character's own battle.
export const DIAGNOSES = {
  Guns: {
    name: 'Reactive-Protective Type',
    code: 'FP-01',
    summary: 'Threat-first processing. Converts fear into readiness, readiness into force. Grief presents as anger.',
  },
  Bible: {
    name: 'Devotional-Rigid Type',
    code: 'FP-02',
    summary: 'Certainty as coping. Revulsion used as a boundary. Anxiety managed by rules, and rules by more rules.',
  },
  Crystals: {
    name: 'Porous-Expressive Type',
    code: 'FP-03',
    summary: "High emotional permeability. Absorbs others' states, presents bright. Surprise used to deflect.",
  },
};

// Class × the emotion the player leaned on most. `neutral` = no unique lead.
const INTERPRETATIONS = {
  Guns: {
    Anger: 'Led with anger. Consistent with profile. Anger here functions as protection, not aggression.',
    Fear: 'Led with fear. Client braces early and often. The threat is rarely where they are looking.',
    Sadness: 'Led with sadness. Atypical for profile. Client may be closer to grief than intake suggested.',
    neutral: 'No dominant emotion. Client withheld a lead. Guarded, or undecided.',
  },
  Bible: {
    Anxiety: 'Led with anxiety. Client rehearses outcomes before they arrive. Structure lowers it. So does honesty.',
    Disgust: 'Led with disgust. Client sets boundaries by recoiling. Useful. Also lonely.',
    Fear: 'Led with fear. Faith and fear presented together more than once. Client may not tell them apart.',
    neutral: 'No dominant emotion. Client kept every feeling at the same careful distance.',
  },
  Crystals: {
    Happy: 'Led with happiness. Brightness used as a default setting, including where it did not fit.',
    Anxiety: 'Led with anxiety. Underneath the openness, client is monitoring constantly.',
    Surprise: 'Led with surprise. Client keeps being caught off guard by their own reactions.',
    neutral: 'No dominant emotion. Client felt a little of everything and committed to none of it.',
  },
};

function caseNote(truths, lies) {
  if (!truths && !lies) return 'Insufficient data. Client did not engage.';
  if (!lies) return 'Client was honest in every recorded exchange. Follow up: at what cost.';
  if (lies <= truths) return 'Mixed disclosure. Client lies selectively, usually to keep the peace. Continue monitoring.';
  return 'Client deferred. Again. Most recorded exchanges were not true. The lake has the rest.';
}

// { person: { truth, lie } } from run.choices, in the order first met.
function honestyByPerson(choices = {}) {
  const people = {};
  for (const [nodeId, side] of Object.entries(choices)) {
    const who = nodeId.split('_')[0];
    people[who] ??= { truth: 0, lie: 0 };
    people[who][side] += 1;
  }
  return people;
}

export function buildReport(state) {
  const loadout = DIAGNOSES[state.loadout] ? state.loadout : 'Guns';
  const counts = state.emotionCounts ?? {};
  const dominant = getDominantEmotion(counts);
  const people = honestyByPerson(state.choices);
  const truths = Object.values(people).reduce((n, p) => n + p.truth, 0);
  const lies = Object.values(people).reduce((n, p) => n + p.lie, 0);
  return {
    loadout,
    diagnosis: DIAGNOSES[loadout],
    counts,
    dominant,
    interpretation: INTERPRETATIONS[loadout][dominant] ?? INTERPRETATIONS[loadout].neutral,
    people,
    truths,
    lies,
    note: caseNote(truths, lies),
    collected: emotionsForClass(loadout, state.unlocked ?? []),
  };
}
