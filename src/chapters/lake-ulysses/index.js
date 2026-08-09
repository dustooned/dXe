import { createStore } from '../../shell/state.js';
import { createSceneSequencer } from '../../engine/sceneSequencer.js';
import { recordEnding } from '../../shell/save.js';
import * as questionnaireScene from '../../scenes/questionnaireScene.js';
import * as cutsceneScene from '../../scenes/cutsceneScene.js';
import * as dialogScene from '../../scenes/dialogScene.js';
import * as reckoningScene from '../../scenes/reckoningScene.js';
import * as endingScene from '../../scenes/endingScene.js';
import { ANIMS } from './anims.js';
import { playStaticTransition } from '../../ui/staticTransition.js';

import openingQuote from './content/opening_quote.json';
import bobBaiter from './content/bob_baiter.json';
import prologue from './content/prologue.json';
import therapist from './content/therapist.json';
import deborah from './content/deborah.json';
import rwanda from './content/rwanda.json';
import samun from './content/samun.json';
import rick from './content/rick.json';
import endings from './content/endings.json';

export const id = 'lake-ulysses';
export const title = 'Truth Debt: Lake Ulysses';

// The chapter is just this list, in order. `jumpTo` (see sceneSequencer.js)
// lets a dialog scene skip straight to 'reckoning' when Truth Debt maxes
// out mid-NPC. Adding a cutscene before an NPC, or a mini-game between two,
// is just another entry here — see docs/SCENE_TYPES.md.
//
// Opening call (scenes 3-5) is one continuous unit, and the order matters:
// prologue's last beat is "Your phone buzzes against the gravel," so the
// questionnaire reads as answering that call and the therapist dialog as the
// same call continuing. Running questionnaire before prologue (as it did
// originally) fired the Therapist's diagnosis before the story established
// why she'd be talking to you at all. This shape is meant to be the routine
// chapter opener: you're on site, she buzzes in, she evaluates you.
//
// TODO — mini-games: each remaining NPC gets one immediately before it
// (deborah / rwanda / samun / rick), so the chapter reads as
// explore -> encounter, four times. The `minigame` scene type is built
// (scenes/minigameScene.js) but no content exists yet, so no entries here
// yet — adding one is a single line. See docs/SCENE_TYPES.md for the walk /
// gimmick step design.
const SCENES = [
  { type: 'cutscene', id: 'opening-quote', beats: openingQuote.beats, anims: ANIMS },
  { type: 'cutscene', id: 'bob-baiter', beats: bobBaiter.beats, anims: ANIMS, ambient: '/assets/lake-ulysses/audio/lk_01.mp3' },
  { type: 'cutscene', id: 'prologue', beats: prologue.beats },
  { type: 'questionnaire', id: 'questionnaire' },
  { type: 'dialog', id: 'therapist', npc: therapist },
  { type: 'dialog', id: 'deborah', npc: deborah },
  { type: 'dialog', id: 'rwanda', npc: rwanda },
  { type: 'dialog', id: 'samun', npc: samun },
  { type: 'dialog', id: 'rick', npc: rick },
  { type: 'reckoning', id: 'reckoning' },
  { type: 'ending', id: 'ending', endings },
];

const HANDLERS = {
  questionnaire: questionnaireScene,
  cutscene: cutsceneScene,
  dialog: dialogScene,
  reckoning: reckoningScene,
  ending: endingScene,
};

const initialRunState = {
  integrity: 5,
  trust: 5,
  stability: 5,
  lucidity: 5,
  truthDebt: 0,
  ledger: [],
  bloomsFired: [],
  lakeHealth: 1,
  loadout: 'Guns',
};

export function mount(stageEl, { exit, startSceneId }) {
  const run = createStore(initialRunState);
  const sequencer = createSceneSequencer({
    scenes: SCENES,
    handlers: HANDLERS,
    context: { run, exit, recordEnding, chapterId: id },
    transitionFn: playStaticTransition,
    startSceneId,
  });

  sequencer.mount(stageEl);

  return function unmount() {
    sequencer.unmount();
  };
}
