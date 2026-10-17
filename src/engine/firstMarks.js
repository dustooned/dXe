// First choices that matter (Phase 11 step 6): the FEELZ install and the
// intake leave a mark you can see and hear for the rest of the run. Each
// choice gets a ripple when it's made (ui/ripple.js), and then:
//
//   username        how the lake's fish swim (dart / drift / stop and start)
//   face refused    the fish keep low and shy
//   voice refused   the tank goes quiet (no bubbles)
//   intake answers  the lake's surface: more "feel it / sit with it" answers
//                   (left) still water, more "handle it / do something"
//                   (right) choppy water
//   permissions     one line in Deborah's hallway calls back to them
//
// None of it is a verdict, and none of it moves a meter: it's atmosphere
// that remembers you (docs/PHASE_11.md step 6).

// The install's username options (content/feelz_install.json) -> swim style.
export const SWIM = { lakeboy_88: 'dart', DampButFine: 'drift', STILL_RINGING: 'halt' };

const refused = (answer) => typeof answer === 'string' && /DON.?T/i.test(answer);

// The lake gauge's classes for this run (ui/lakeGauge.js marks).
export function lakeMarks(state = {}) {
  const marks = [];
  const swim = SWIM[state.handle];
  if (swim) marks.push(`is-swim-${swim}`);
  if (refused(state.permFace)) marks.push('is-shy');
  if (refused(state.permVoice)) marks.push('is-hushed');
  const lean = state.intakeLean;
  if (lean && (lean.still || lean.move)) marks.push(lean.still >= lean.move ? 'is-surface-still' : 'is-surface-choppy');
  return marks;
}

// Deborah's hallway, after its intro: what you told FEELZ at the start.
export function hallwayEcho(state = {}) {
  if (refused(state.permFace) && refused(state.permVoice)) return "Your phone is face down in your pocket. You told it no, twice. It buzzes once anyway, like it's still listening.";
  if (refused(state.permFace)) return "Your phone is face down in your pocket. You wouldn't let it see your face. It's still looking.";
  if (refused(state.permVoice)) return "The hallway is very quiet. You told FEELZ it couldn't listen. It's listening anyway.";
  if (state.permFace || state.permVoice) return 'FEELZ buzzes once in your pocket. You gave it everything. It wants you to know it noticed.';
  return '';
}
