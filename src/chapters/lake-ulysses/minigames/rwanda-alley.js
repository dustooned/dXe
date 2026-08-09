// Mini-game: the alley behind the neon, on the way to Rwanda. PLACEHOLDER
// CONTENT — the art is generated vectors (scripts/make-placeholder-room.mjs)
// and the captions exercise the class-variation path rather than being final
// prose. See docs/SCENE_TYPES.md for the step contract.
import { createWalkSequencer } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_alley_bg/spr_alley_bg_`, frames: 6, fps: 8, ext: 'svg' };

const ROOMS = {
  'alley-01': {
    bg: BG,
    intro: {
      Guns:     'Behind the strip. One way in, one way out, and you came in the one way in.',
      Bible:    'Behind the strip. Somebody put a mural on a wall nobody was ever going to look at.',
      Crystals: 'Behind the strip. The neon hums a note that sits just under your teeth.',
    },
    hotspots: [
      {
        x: 66, y: 208, w: 96, h: 58,
        sprite: `${SPR}alley_neon.svg`,
        closeup: `${SPR}alley_neon_closeup.svg`,
        text: {
          Guns:     'Half the letters are dead. The half still lit spells something shorter and meaner.',
          Bible:    'A sign somebody paid for once, back when this was going to work out.',
          Crystals: 'The dead letters still flicker sometimes. Like they forgot they were off.',
        },
      },
      {
        x: 268, y: 356, w: 54, h: 118,
        sprite: `${SPR}alley_payphone.svg`,
        closeup: `${SPR}alley_payphone_closeup.svg`,
        text: {
          Guns:     'Handset cord cut clean. Somebody wanted a call to stop happening.',
          Bible:    'A payphone. Still bolted up, still waiting on a quarter from nobody.',
          Crystals: 'You pick it up out of habit. There is no tone. You keep holding it anyway.',
        },
      },
      {
        x: 74, y: 430, w: 88, h: 132,
        sprite: `${SPR}alley_mural.svg`,
        closeup: `${SPR}alley_mural_closeup.svg`,
        text: {
          Guns:     "Painted over twice. Whatever it said the first time, somebody didn't want it said.",
          Bible:    'Somebody painted this carefully, in an alley, for free. That counts for something.',
          Crystals: 'The faces in it are all looking slightly off to the left. At the same thing.',
        },
      },
    ],
    advance: {
      x: 152, y: 292, w: 96, h: 300,
      sprite: `${SPR}alley_gate.svg`,
      to: null, // last room in this walk step
    },
  },
};

const STEPS = [
  { type: 'walk', rooms: ['alley-01'], roomsById: ROOMS },
  { type: 'gimmick', prompt: { text: 'THE DOG BEHIND THE FENCE' }, response: 'swipe-right' },
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
