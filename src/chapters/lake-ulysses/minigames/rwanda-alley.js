// Mini-game: the alley behind the neon, on the way to Rwanda. PLACEHOLDER
// CONTENT — the art is generated vectors (scripts/make-placeholder-room.mjs)
// and the captions exercise the class-variation path rather than being final
// prose. See docs/SCENE_TYPES.md for the step contract.
import { mountNpcWalk } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_alley_bg/spr_alley_bg_`, frames: 6, fps: 8, ext: 'svg' };

// Each object reads one of her openers: its glow (and its close-up's wash)
// is the first feeling that opener meets, as YOUR class meets her (kin or
// foe, engine/loadout.js moodFor), the same color as that option's stripe in
// the confrontation. The captions are each class's own read of her,
// colored word and all; none is the right one. One object per class can be
// restored (ui/walkRoom.js), which unlocks her secret opener (rwanda_01_secret).
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
        x: 74, y: 430, w: 88, h: 132,
        sprite: `${SPR}alley_mural.svg`,
        closeup: `${SPR}alley_mural_closeup.svg`,
        opener: 'rwanda_01',
        text: {
          Guns:     'Painted over twice. Whatever it said the first time, somebody was {color:Anger}furious{/color} enough to make it.',
          Bible:    'Somebody painted this carefully, in an alley, for free, and somebody else was {color:Anger}angry{/color} enough to cover it.',
          Crystals: 'The faces in it are all looking slightly off to the left, like something just {color:Surprise}startled{/color} them.',
        },
        restore: {
          by: 'Crystals',
          hint: 'The gray is thin here. Something underneath is pressing back. Brush it.',
          done: 'You rub the gray away with your sleeve. A woman at a bus stop looks out, tired and furious and beautiful.',
        },
      },
      {
        x: 66, y: 208, w: 96, h: 58,
        sprite: `${SPR}alley_neon.svg`,
        closeup: `${SPR}alley_neon_closeup.svg`,
        opener: 'rwanda_01_soft',
        text: {
          Guns:     'Half the letters are dead. The half still lit spells something shorter and meaner, and it\'s {color:Fear}watching{/color} the street.',
          Bible:    'A sign somebody paid for once, back when this was going to work out. Now it\'s {color:Fear}afraid{/color} to go all the way dark.',
          Crystals: 'The dead letters still flicker sometimes, like they\'re {color:Fear}scared{/color} of being forgotten.',
        },
        restore: {
          by: 'Bible',
          hint: 'The dead letters aren\'t dead. They\'re waiting to be asked.',
          done: 'You knock twice on the housing. One by one, every letter comes back on.',
        },
      },
      {
        x: 268, y: 356, w: 54, h: 118,
        sprite: `${SPR}alley_payphone.svg`,
        closeup: `${SPR}alley_payphone_closeup.svg`,
        opener: 'rwanda_01_hard',
        text: {
          Guns:     'Handset cord cut clean. Somebody was {color:Fear}scared{/color} of what the next call would say.',
          Bible:    'A payphone. Still bolted up, still waiting on a quarter from nobody, {color:Fear}dreading{/color} the ring.',
          Crystals: 'You pick it up out of habit. There\'s no tone, just a {color:Anxiety}jitter{/color} in the line you keep holding anyway.',
        },
        restore: {
          by: 'Guns',
          hint: 'The cut is clean. Clean cuts splice. Your hands know a knot that holds.',
          done: 'You strip the ends with your teeth and knot them tight. Somewhere down the line, a dial tone.',
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

export function mount(stageEl, scene, context) {
  return mountNpcWalk(stageEl, scene, context, { steps: STEPS, secretKey: 'rwanda' });
}
