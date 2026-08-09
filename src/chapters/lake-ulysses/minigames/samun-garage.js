// Mini-game: the service bay on the way to Samun. PLACEHOLDER CONTENT — the
// art is generated vectors (scripts/make-placeholder-room.mjs) and the captions
// exercise the class-variation path rather than being final prose. See
// docs/SCENE_TYPES.md for the step contract.
import { createWalkSequencer } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_garage_bg/spr_garage_bg_`, frames: 6, fps: 8, ext: 'svg' };

const ROOMS = {
  'garage-01': {
    bg: BG,
    intro: {
      Guns:     'The bay is open and nobody came out to see who pulled in. That tells you plenty.',
      Bible:    'The bay is open. Tools laid out in order, like somebody meant to come back to them.',
      Crystals: 'The bay is open, and the whole room smells like something that used to be running.',
    },
    hotspots: [
      {
        x: 72, y: 468, w: 78, h: 112,
        sprite: `${SPR}garage_drum.svg`,
        closeup: `${SPR}garage_drum_closeup.svg`,
        text: {
          Guns:     'Full to the lip. Nobody has hauled this off in a long, long while.',
          Bible:    'An oil drum used as a trash can, used as a table. It has been three things.',
          Crystals: 'Something in there is still moving very slowly. You decide not to look closer.',
        },
      },
      {
        x: 258, y: 222, w: 66, h: 88,
        sprite: `${SPR}garage_calendar.svg`,
        closeup: `${SPR}garage_calendar_closeup.svg`,
        text: {
          Guns:     'Stopped on a month two years back. Nobody flips it because nobody is counting.',
          Bible:    'Two years behind. Somebody stopped keeping track of the days on purpose.',
          Crystals: 'The same month, over and over, for two years. It almost sounds restful.',
        },
      },
      {
        x: 256, y: 470, w: 68, h: 46,
        sprite: `${SPR}garage_radio.svg`,
        closeup: `${SPR}garage_radio_closeup.svg`,
        text: {
          Guns:     'On, but tuned to nothing. He wants noise, not a station.',
          Bible:    'Left playing for the company of it. You have done that yourself.',
          Crystals: 'Static, at a volume somebody chose carefully. Loud enough. Not too loud.',
        },
      },
    ],
    advance: {
      x: 150, y: 286, w: 100, h: 300,
      sprite: `${SPR}garage_bay.svg`,
      to: null, // last room in this walk step
    },
  },
};

const STEPS = [
  { type: 'walk', rooms: ['garage-01'], roomsById: ROOMS },
  { type: 'gimmick', prompt: { text: 'DUCK THE HOIST' }, response: 'swipe-left' },
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
