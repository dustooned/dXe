// Mini-game: the walk to Deborah's door. PLACEHOLDER CONTENT — the art is
// generated vectors (scripts/make-placeholder-room.mjs) and the captions are
// written to exercise the class-variation path, not to be final prose.
//
// This is a normal scene handler, lazy-loaded by scenes/minigameScene.js. It
// owns nothing except its STEPS list and hands the chapter's own onComplete
// straight to the walk sequencer.
import { createWalkSequencer } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_hallway_bg/spr_hallway_bg_`, frames: 6, fps: 8, ext: 'svg' };

const ROOMS = {
  'hallway-01': {
    bg: BG,
    hotspots: [
      {
        x: 78, y: 250, w: 74, h: 96,
        sprite: `${SPR}hallway_diploma.svg`,
        closeup: `${SPR}hallway_diploma_closeup.svg`,
        text: {
          Guns:     'A diploma. Crooked. Nobody in this building straightened it, including her.',
          Bible:    "A diploma. Class of '09. She earned that, whatever else is true.",
          Crystals: 'A diploma, tilted. Something in here gave up a long time before today.',
        },
      },
      {
        x: 150, y: 596, w: 108, h: 44,
        sprite: `${SPR}hallway_doormat.svg`,
        closeup: `${SPR}hallway_doormat_closeup.svg`,
        text: {
          Guns:     "A doormat that says GO AWAY. She means it. That's fine, so do you.",
          Bible:    'A doormat that says GO AWAY, in a font that is trying to be funny about it.',
          Crystals: 'A doormat that says GO AWAY. Somebody bought that as a joke and then stopped laughing.',
        },
      },
      {
        x: 262, y: 214, w: 52, h: 62,
        sprite: `${SPR}hallway_lightbulb.svg`,
        closeup: `${SPR}hallway_lightbulb_closeup.svg`,
        text: {
          Guns:     'Bulb is dying. Nobody replaced it. Nobody will.',
          Crystals: 'The bulb keeps almost going out. It has been almost going out for months.',
          Bible:    'A bulb on its way out. Someone should see to that.',
        },
      },
    ],
    advance: {
      x: 148, y: 300, w: 100, h: 280,
      sprite: `${SPR}hallway_door.svg`,
      to: null, // last room in this walk step
    },
  },
};

const STEPS = [
  { type: 'walk', rooms: ['hallway-01'], roomsById: ROOMS },
  { type: 'gimmick', prompt: { text: 'THE SMELL — GET PAST IT' }, response: 'swipe-left' },
];

export function mount(stageEl, scene, { run, onComplete }) {
  const sequencer = createWalkSequencer({
    steps: STEPS,
    stageEl,
    loadout: run.get().loadout,
    onComplete,
  });
  sequencer.start();

  return function unmount() {
    sequencer.destroy();
  };
}
