// Mini-game: the lot outside the bar, on the way to Rick. PLACEHOLDER CONTENT
// — the art is generated vectors (scripts/make-placeholder-room.mjs) and the
// captions exercise the class-variation path rather than being final prose.
// See docs/SCENE_TYPES.md for the step contract.
import { mountNpcWalk } from '../../../engine/walkSequencer.js';

const SPR = '/assets/lake-ulysses/sprites/';

// Coordinates are design-space px against the 390x844 frame — the format real
// art gets handed over in. See docs/ASSET_GUIDELINES.md "Mini-game rooms".
const BG = { base: `${SPR}spr_barlot_bg/spr_barlot_bg_`, frames: 6, fps: 8, ext: 'svg' };

// Each object reads one of his openers: its glow (and its close-up's wash)
// is the first feeling that opener meets, as YOUR class meets him (kin or
// foe, engine/loadout.js moodFor), the same color as that option's stripe in
// the confrontation. The captions are each class's own read of him,
// colored word and all; none is the right one. One object per class can be
// restored (ui/walkRoom.js), which unlocks his secret opener (rick_01_secret).
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
        x: 268, y: 520, w: 56, h: 40,
        sprite: `${SPR}barlot_ashtray.svg`,
        closeup: `${SPR}barlot_ashtray_closeup.svg`,
        opener: 'rick_01',
        text: {
          Guns:     'One brand, all of them. Same man, same spot, every night, waiting on something he\'s {color:Fear}scared{/color} will come.',
          Bible:    'Somebody stands out here alone a lot. Long enough to fill this twice, {color:Fear}afraid{/color} to go home.',
          Crystals: 'Every one of them stubbed out the same careful way. Like a count of something {color:Anxiety}restless{/color}.',
        },
        restore: {
          by: 'Crystals',
          hint: 'Every butt is a minute somebody stood out here alone. The weight of it hums. Let it go.',
          done: 'You tip the ash into the wind. The tray comes up clean and the hum goes quiet.',
        },
      },
      {
        x: 264, y: 232, w: 58, h: 78,
        sprite: `${SPR}barlot_flyer.svg`,
        closeup: `${SPR}barlot_flyer_closeup.svg`,
        opener: 'rick_01_soft',
        text: {
          Guns:     'A benefit ride. For a guy nobody in there will say the name of anymore. Saying it makes them {color:Anxiety}twitchy{/color}.',
          Bible:    'A benefit ride, taped up crooked. They raised the money and then let it hang like something {color:Disgust}shameful{/color}.',
          Crystals: 'The date on it already passed. Nobody took it down. Nobody is going to. It {color:Anxiety}trembles{/color} when the door opens.',
        },
        restore: {
          by: 'Bible',
          hint: 'Taped up crooked, for a man nobody names. He deserves to hang straight.',
          done: 'You peel the tape and set it level. You read his name out loud, once, to nobody.',
        },
      },
      {
        x: 60, y: 470, w: 116, h: 96,
        sprite: `${SPR}barlot_bike.svg`,
        closeup: `${SPR}barlot_bike_closeup.svg`,
        opener: 'rick_01_hard',
        text: {
          Guns:     'Parked across two spaces. That is the whole message, and it\'s {color:Anger}spoiling{/color} for you to answer it.',
          Bible:    'Kept better than the man keeps himself. Everything on it has been touched lately, by hands that were {color:Anger}angry{/color}.',
          Crystals: 'The chrome holds the door light and bends it into something almost soft, over something {color:Anger}hot{/color}.',
        },
        restore: {
          by: 'Guns',
          hint: 'The chain\'s thrown. You\'ve set a chain before. You could do it blind.',
          done: 'You walk the chain back onto the sprocket, tooth by tooth. Grease to the wrist. It will run.',
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

export function mount(stageEl, scene, context) {
  return mountNpcWalk(stageEl, scene, context, { steps: STEPS, secretKey: 'rick' });
}
