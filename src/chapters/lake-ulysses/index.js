import { createStore } from '../../shell/state.js';
import { createSceneSequencer } from '../../engine/sceneSequencer.js';
import { recordEnding } from '../../shell/save.js';
import * as cutsceneScene from '../../scenes/cutsceneScene.js';
import * as dialogScene from '../../scenes/dialogScene.js';
import * as reckoningScene from '../../scenes/reckoningScene.js';
import * as endingScene from '../../scenes/endingScene.js';

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
const SCENES = [
  { type: 'cutscene', id: 'prologue', beats: prologue.beats },
  { type: 'dialog', id: 'therapist', npc: therapist },
  { type: 'dialog', id: 'deborah', npc: deborah },
  { type: 'dialog', id: 'rwanda', npc: rwanda },
  { type: 'dialog', id: 'samun', npc: samun },
  { type: 'dialog', id: 'rick', npc: rick },
  { type: 'reckoning', id: 'reckoning' },
  { type: 'ending', id: 'ending', endings },
];

const HANDLERS = {
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
};

export function mount(stageEl, { exit }) {
  const run = createStore(initialRunState);
  const sequencer = createSceneSequencer({
    scenes: SCENES,
    handlers: HANDLERS,
    context: { run, exit, recordEnding, chapterId: id },
  });

  sequencer.mount(stageEl);

  return function unmount() {
    sequencer.unmount();
  };
}
