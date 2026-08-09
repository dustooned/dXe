// Mini-game: the lot outside the bar, on the way to Rick. PLACEHOLDER CONTENT
// — the art is generated vectors (scripts/make-placeholder-room.mjs) and the
// captions exercise the class-variation path rather than being final prose.
// See docs/SCENE_TYPES.md for the step contract.
import { createWalkSequencer } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_barlot_bg/spr_barlot_bg_`, frames: 6, fps: 8, ext: 'svg' };

const ROOMS = {
  'barlot-01': {
    bg: BG,
    intro: {
      Guns:     'Gravel lot. Six bikes, one door, and everyone inside already knows the sound of a stranger.',
      Bible:    'Gravel lot. Somebody has been coming here on the same night every week for years.',
      Crystals: 'Gravel lot. The bass through the wall arrives in your chest before your ears.',
    },
    hotspots: [
      {
        x: 60, y: 470, w: 116, h: 96,
        sprite: `${SPR}barlot_bike.svg`,
        closeup: `${SPR}barlot_bike_closeup.svg`,
        text: {
          Guns:     'Parked across two spaces. That is the whole message, and it is meant for you.',
          Bible:    'Kept better than the man keeps himself. Everything on it has been touched lately.',
          Crystals: 'The chrome holds the door light and bends it into something almost soft.',
        },
      },
      {
        x: 268, y: 520, w: 56, h: 40,
        sprite: `${SPR}barlot_ashtray.svg`,
        closeup: `${SPR}barlot_ashtray_closeup.svg`,
        text: {
          Guns:     'One brand, all of them. Same man, same spot, every night, waiting on something.',
          Bible:    'Somebody stands out here alone a lot. Long enough to fill this twice.',
          Crystals: 'Every one of them stubbed out the same careful way. Like a count of something.',
        },
      },
      {
        x: 264, y: 232, w: 58, h: 78,
        sprite: `${SPR}barlot_flyer.svg`,
        closeup: `${SPR}barlot_flyer_closeup.svg`,
        text: {
          Guns:     'A benefit ride. For a guy nobody in there will say the name of anymore.',
          Bible:    'A benefit ride, taped up crooked. They raised the money. That happened.',
          Crystals: 'The date on it already passed. Nobody took it down. Nobody is going to.',
        },
      },
    ],
    advance: {
      x: 152, y: 288, w: 96, h: 296,
      sprite: `${SPR}barlot_door.svg`,
      to: null, // last room in this walk step
    },
  },
};

const STEPS = [
  { type: 'walk', rooms: ['barlot-01'], roomsById: ROOMS },
  { type: 'gimmick', prompt: { text: 'SOMEONE SHOULDERS PAST' }, response: 'swipe-right' },
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
