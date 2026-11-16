// "Making of" content for the History page (shell/history.js). Plain data:
// edit freely. Excerpts are hand-picked short lines, never whole documents.
// Keep the real town unnamed.
//
// Each phase: when, title, text, optional excerpt { quote, source },
// optional then/now, optional image (old vs new art later).

export const INTRO = 'Dream Xtreme is set in a lake town in the high desert. It has no name in the game. The real one is a place where JT Vernon used to live, and the story is drawn from true events there, and from the strange ones.';

export const PHASES = [
  {
    when: 'Before 2026',
    title: 'The first concept',
    text: 'It started as a much bigger game, "Medical Underground." It was set aside, but some of its people and ideas carried forward.',
    // excerpt: { quote: '…', source: 'Game Concept' },  // TODO: pick a line
  },
  {
    when: 'Before 2026',
    title: 'The bible',
    text: "T' and JT Vernon pulled the lore, the FEELZ app and the first demo script into one document, built around the town and what happened there.",
    excerpt: { quote: 'A mobile, swipe-left/right story game about the debt every lie creates.', source: 'DX Bible' },
    then: 'The wheel starts almost monochrome, with one tiny pixel lit in Fear.',
    now: 'The wheel starts with your class\'s feelings, and people you meet give you more.',
  },
  {
    when: 'Before 2026',
    title: 'Cutting to a demo',
    text: 'The build spec narrowed everything down to something that could ship: three people to meet and a couple of endings.',
    then: 'A React and PixiJS stack.',
    now: 'Plain JavaScript in the browser, nothing to install.',
  },
  {
    when: 'Jul 2026',
    title: 'First build',
    text: 'The game was scaffolded as an interactive zine and went live on dreamxtre.me the same day.',
    excerpt: { quote: 'Initial scaffold: shell, scene sequencer, demo chapter', source: 'first commit' },
  },
  {
    when: 'Sep 2026',
    title: 'FEELZ grows',
    text: 'The phone app became the heart of the game. People give you feelings, the wheel fills, and lying starts to cost.',
  },
  {
    when: 'Oct 2026',
    title: 'Faces and sound',
    text: 'Character art, the rebuilt ending, the title screen, stop-motion loops and the music pipeline.',
  },
  {
    when: 'Nov 2026',
    title: 'Teaching by doing',
    text: 'The Therapist became the tutorial: he calls after your first connection instead of explaining everything up front.',
  },
];
