// IT and SO as observers, not commentators. They only speak up at the end
// of an encounter when they've noticed something *new* about the player —
// a finding — instead of after every NPC regardless. Fewer interruptions,
// and each one means something changed.
//
// The voice is the spotlight effect (Gilovich et al., 2000: people
// overestimate how much others notice and judge them) turned real: the
// paranoia is correct, somebody *is* keeping score. But they never admit
// to being against you. They're just observers, citing the lake's reading
// like a lab report, counting down to the end of the tunnel.
//
// Findings, in priority order (at most one per encounter, and none if a
// bloom already interrupted this encounter — dialogScene.js):
//   1. pattern flip — this encounter leaned the other way (truth vs. lie)
//      from the last encounter that leaned at all
//   2. lean shift   — the run's dominant FEELZ emotion changed since IT last
//      read it (the existing emotion-lean lines, engine/itEmotionLean.js)
// {ppm} / {status} are filled from the live lake reading (engine/lake.js).
//
// PLACEHOLDER PROSE, class-neutral: observers don't change their register
// for whoever they're watching.

export const FLIP_TEXT = {
  lie: {
    it: 'Finding: more lies than truths this time. Lake is reading {ppm}. We are only reporting it.',
    so: 'Nobody said anything was wrong. It is just a number, going up.',
  },
  truth: {
    it: 'Finding: more truth than not, this time. Noted. Dated.',
    so: 'We will see if it holds. We are very patient. Lake is reading {ppm}.',
  },
};

// Which way an encounter leaned: 'truth', 'lie', or null for an even split.
export function encounterSide(swipes) {
  const lies = swipes.filter((s) => s === 'lie').length;
  const truths = swipes.length - lies;
  if (lies === truths) return null;
  return lies > truths ? 'lie' : 'truth';
}
