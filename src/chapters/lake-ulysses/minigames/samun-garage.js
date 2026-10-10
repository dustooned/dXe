// Mini-game: the service bay on the way to Samun. PLACEHOLDER CONTENT — the
// art is generated vectors (scripts/make-placeholder-room.mjs) and the captions
// exercise the class-variation path rather than being final prose. See
// docs/SCENE_TYPES.md for the step contract.
import { mountNpcWalk } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_garage_bg/spr_garage_bg_`, frames: 6, fps: 8, ext: 'svg' };

// Each object reads one of his openers: its glow (and its close-up's wash)
// is the first feeling that opener meets, as YOUR class meets him (kin or
// foe, engine/loadout.js moodFor), the same color as that option's stripe in
// the confrontation. The captions are each class's own read of him,
// colored word and all; none is the right one. One object per class can be
// restored (ui/walkRoom.js), which unlocks his secret opener (samun_01_secret).
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
        x: 256, y: 470, w: 68, h: 46,
        sprite: `${SPR}garage_radio.svg`,
        closeup: `${SPR}garage_radio_closeup.svg`,
        opener: 'samun_01',
        text: {
          Guns:     'On, but tuned to nothing. He wants noise, not a station. Quiet is what he\'s {color:Fear}scared{/color} of.',
          Bible:    'Left playing for the company of it. You have done that yourself, when the quiet got too {color:Fear}frightening{/color}.',
          Crystals: 'Static, at a volume somebody chose carefully. Loud enough to cover a {color:Anxiety}nervous{/color} room. Not too loud.',
        },
        restore: {
          by: 'Crystals',
          hint: 'Under the static there\'s a song trying to get through. Find where it lives.',
          done: 'You roll the dial slow until it opens up: something old, with a horn in it. The room exhales.',
        },
      },
      {
        x: 258, y: 222, w: 66, h: 88,
        sprite: `${SPR}garage_calendar.svg`,
        closeup: `${SPR}garage_calendar_closeup.svg`,
        opener: 'samun_01_soft',
        text: {
          Guns:     'Stopped on a month two years back. Nobody flips it because nobody can stand the {color:Disgust}sight{/color} of the count.',
          Bible:    'Two years behind. Somebody stopped keeping track of the days on purpose, {color:Disgust}sick{/color} of what they added up to.',
          Crystals: 'The same month, over and over, for two years. It almost sounds restful, if you ignore the {color:Anxiety}buzz{/color} under it.',
        },
        restore: {
          by: 'Bible',
          hint: 'Every day since is still owed its page. Somebody should keep the count.',
          done: 'You turn it, month by month, to today. Twenty-four pages. He got through every one of them.',
        },
      },
      {
        x: 72, y: 468, w: 78, h: 112,
        sprite: `${SPR}garage_drum.svg`,
        closeup: `${SPR}garage_drum_closeup.svg`,
        opener: 'samun_01_hard',
        text: {
          Guns:     'Full to the lip. Nobody has hauled this off in a long while. Somebody\'s {color:Anger}sick of it{/color} and won\'t say so.',
          Bible:    'An oil drum used as a trash can, used as a table. It has been three things, and he\'s {color:Fear}afraid{/color} of what it\'s full of.',
          Crystals: 'Something in there is still moving very slowly. You decide not to look closer, and something in your chest goes {color:Fear}cold{/color}.',
        },
        restore: {
          by: 'Guns',
          hint: 'Full to the lip. It\'s heavy. You\'re heavier.',
          done: 'You tip it onto the dolly and walk it out to the curb. The floor under it has not seen light in years.',
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

export function mount(stageEl, scene, context) {
  return mountNpcWalk(stageEl, scene, context, { steps: STEPS, secretKey: 'samun' });
}
