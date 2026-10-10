// Mini-game: the walk to Deborah's door. PLACEHOLDER CONTENT — the art is
// generated vectors (scripts/make-placeholder-room.mjs) and the captions are
// written to exercise the class-variation path, not to be final prose.
//
// This is a normal scene handler, lazy-loaded by scenes/minigameScene.js. It
// owns nothing except its STEPS list and hands the chapter's own onComplete
// straight to the walk sequencer.
import { mountNpcWalk } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_hallway_bg/spr_hallway_bg_`, frames: 6, fps: 8, ext: 'svg' };

// Each object reads one of her openers: its glow (and its close-up's wash) is
// the first feeling that opener meets, as YOUR class meets her (kin or foe,
// engine/loadout.js moodFor) — the same color as that option's chip in the
// confrontation. The captions are each class's own read of her, colored word
// and all; none is the right one. One object per class can be restored
// (walkRoom.js), which unlocks her secret opener (deborah_01_secret).
const ROOMS = {
  'hallway-01': {
    bg: BG,
    intro: {
      Guns:     "Third floor. The stairwell door behind you doesn't latch. Nobody in this building would hear a thing.",
      Bible:    'Third floor. Somebody swept this hallway recently. Somebody up here is still trying.',
      Crystals: 'Third floor. The air is thick with something that has been sitting here a long time.',
    },
    // The first room teaches the colors (walkRoom.js, only with TIPS on).
    tip: {
      clear: 'Everything in here is tinted by how she will feel when you knock. Look closely. Then look twice.',
      fogged: 'Everything in here looks warm or grey. The warm things are what she would like to hear.',
    },
    hotspots: [
      {
        x: 78, y: 250, w: 74, h: 96,
        sprite: `${SPR}hallway_diploma.svg`,
        closeup: `${SPR}hallway_diploma_closeup.svg`,
        sound: 'creak',
        opener: 'deborah_01',
        text: {
          Guns:     "A diploma. Crooked. Nobody straightened it, including her. That isn't lazy. That's {color:Sadness}weight{/color}.",
          Bible:    "A diploma. Class of '09. Hung where she has to pass it every day, and too {color:Fear}afraid{/color} to take it down.",
          Crystals: 'A diploma, tilted. The frame has gone {color:Sadness}heavy{/color}, like it is sinking into the wall.',
        },
        restore: {
          by: 'Guns',
          hint: 'Crooked is fixable. Your hands already know how.',
          done: 'You square it up. Level. Somebody should have done that a long time ago.',
        },
      },
      {
        x: 150, y: 596, w: 108, h: 44,
        sprite: `${SPR}hallway_doormat.svg`,
        closeup: `${SPR}hallway_doormat_closeup.svg`,
        sound: 'scuff',
        opener: 'deborah_01_hard',
        text: {
          Guns:     "A doormat that says GO AWAY. She means it. There's a {color:Anger}fight{/color} in that, somewhere.",
          Bible:    "A doormat that says GO AWAY, in a font trying to be funny about it. It isn't funny. It's {color:Anger}furious{/color}.",
          Crystals: 'A doormat that says GO AWAY. Somebody bought it as a joke and then stopped laughing. It hums {color:Anger}hot{/color}.',
        },
        restore: {
          by: 'Bible',
          hint: 'There is lettering on the underside. Somebody meant it to be turned.',
          done: 'You turn it over. WELCOME, in faded letters, like it was waiting to be read.',
        },
      },
      {
        x: 262, y: 214, w: 52, h: 62,
        sprite: `${SPR}hallway_lightbulb.svg`,
        closeup: `${SPR}hallway_lightbulb_closeup.svg`,
        sound: 'buzz',
        opener: 'deborah_01_soft',
        text: {
          Guns:     'Bulb is dying. Nobody replaced it. Somebody keeps {color:Anxiety}checking{/color} it, though. The switch is worn shiny.',
          Bible:    'A bulb on its way out. Someone should see to that. Someone has been {color:Anxiety}meaning to{/color} for months.',
          Crystals: 'The bulb keeps almost going out. It has been almost going out for months, {color:Anxiety}jittering{/color} like a nerve.',
        },
        restore: {
          by: 'Crystals',
          hint: "It's buzzing at a pitch you can feel in your palms. Hold it.",
          done: 'You hold it. The flicker slows down to your breathing, and then it stays.',
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
  { type: 'gimmick', prompt: { text: 'THE SMELL — GET PAST IT' }, response: 'swipe-left', sound: 'cough' },
];

export function mount(stageEl, scene, context) {
  return mountNpcWalk(stageEl, scene, context, { steps: STEPS, secretKey: 'deborah' });
}
