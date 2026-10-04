// The battle tempo mechanic, as plain inspectable rules (no audio in here).
//
// How the music is DRIVEN (config.drive):
//   'phase'    (the game) the battle's phases. Each answer given moves the music
//              one step up the ladder (phaseStates), so the song escalates as the
//              battle progresses — independent of how well you connect. Connection
//              has its own job (unlocking the secret track), not the tempo's.
//   'emotion'  the model below, kept for experiments in the sound player.
//
// The emotion model — three numbers, each 0..1:
//   tension     the relationship between player and opponent
//   agitation   the opponent's own state
//   connection  how much of a bridge the two have built
// Tension and agitation push the music up; connection pulls it down:
//   pressure = weighted average of tension and agitation
//   level    = pressure - connection * weight          (clamped 0..1)
// `level` slides along a ladder of emotional states (calm -> agitated). Each
// state has a target BPM and a section of the arrangement; the BPM between
// two states is interpolated, so tempo moves smoothly with the level.
//
// Instruments build with the CONVERSATION, not with tension: the first
// answers play `earlySection` (a thinner layer), and from `fullAfterAnswers`
// on every state's section carries the full ensemble. So a warm run still
// grows into the whole band — slower and gentler — instead of thinning out,
// and a cold run grows into it faster and harder.
//
// The music reports where the relationship stands — it never grades the
// player (docs/HANDOFF's non-judgmental feedback rule). That is why this
// reads relationship numbers, not "success" or "failure".
//
// All of it is tunable: DEFAULT_TEMPO_CONFIG is a design starting point, not
// a measurement.
export const DEFAULT_TEMPO_CONFIG = {
  introSection: 'intro_a', // what plays first, on the confrontation before the battle
  earlySection: 'intro_b', // the first answers of the battle: a thinner layer
  fullAfterAnswers: 1, // from this many answers on, every state's (full-ensemble) section plays
  drive: 'phase', // 'phase' | 'emotion' — see the top of this file
  // The secret track fades in at this closeness (one step from trusting you)
  // and out again only below secretAt - secretHysteresis.
  secretAt: 0.6,
  secretHysteresis: 0.15,
  // The state reached after 0, 1, 2, 3+ answers when driven by phase.
  phaseStates: ['guarded', 'uneasy', 'tense', 'agitated'],
  defaultBpm: 100, // a battle with no override starts here (the 'guarded' state)
  minBpm: 70,
  maxBpm: 150,
  rampSeconds: 3, // how long a tempo change takes to arrive
  quantize: 'bar', // when a tempo or section change may start: now | beat | bar | pattern
  sectionQuantize: 'pattern', // sections switch only when the pattern wraps
  hysteresis: 0.05, // how far past the midpoint before the state label flips
  step: 0.12, // size of one event's nudge
  weights: { tension: 0.5, agitation: 0.5, connection: 0.6 },
  start: { tension: 0.25, agitation: 0.25, connection: 0 }, // -> 'guarded', 100 BPM
  // Ordered calm -> agitated; positions on the ladder are spaced evenly. Each
  // `section` is the FULL-ensemble one for that state (see fullAfterAnswers).
  states: [
    { id: 'calm', label: 'Calm / connected', bpm: 80, section: 'intro_c' },
    { id: 'guarded', label: 'Neutral / guarded', bpm: 100, section: 'intro_c' },
    { id: 'uneasy', label: 'Uneasy / suspicious', bpm: 110, section: 'intro_bridge' },
    { id: 'tense', label: 'Tense / defensive', bpm: 125, section: 'verse_001' },
    { id: 'agitated', label: 'Highly agitated', bpm: 140, section: 'verse_002' },
  ],
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);

export function createTempoDirector(overrides = {}) {
  const config = { ...DEFAULT_TEMPO_CONFIG, ...overrides, weights: { ...DEFAULT_TEMPO_CONFIG.weights, ...overrides.weights }, start: { ...DEFAULT_TEMPO_CONFIG.start, ...overrides.start } };
  const states = config.states;
  const spacing = 1 / (states.length - 1);
  const positionOf = (i) => i * spacing;
  const listeners = new Set();

  let tension, agitation, connection, offset, stateIndex, active, answers;

  const levelNow = () => {
    if (config.drive === 'phase') {
      const id = config.phaseStates[Math.min(answers ?? 0, config.phaseStates.length - 1)];
      return positionOf(Math.max(0, states.findIndex((s) => s.id === id)));
    }
    const { weights: w } = config;
    const pressure = (w.tension * tension + w.agitation * agitation) / (w.tension + w.agitation);
    return clamp01(pressure - w.connection * connection);
  };

  // BPM along the ladder at a level, before the encounter's offset.
  function ladderBpm(level) {
    const f = level / spacing;
    const i = Math.min(states.length - 2, Math.floor(f));
    const frac = f - i;
    return states[i].bpm + (states[i + 1].bpm - states[i].bpm) * frac;
  }

  function nearestIndex(level) {
    return clamp(Math.round(level / spacing), 0, states.length - 1);
  }

  function snapshot() {
    const level = levelNow();
    const targetBpm = clamp(ladderBpm(level) + offset, config.minBpm, config.maxBpm);
    const state = states[stateIndex];
    const section = answers < config.fullAfterAnswers ? config.earlySection : state.section;
    return { active, answers, tension, agitation, connection, level, targetBpm, stateId: state.id, label: state.label, section };
  }

  function changed() {
    // Move the state label only once the level is clearly past the midpoint.
    const level = levelNow();
    const near = nearestIndex(level);
    if (near !== stateIndex && Math.abs(level - positionOf(stateIndex)) > spacing / 2 + config.hysteresis) stateIndex = near;
    const s = snapshot();
    listeners.forEach((fn) => fn(s));
    return s;
  }

  function nudge(dTension, dAgitation, dConnection) {
    if (!active) return snapshot();
    tension = clamp01(tension + dTension);
    agitation = clamp01(agitation + dAgitation);
    connection = clamp01(connection + dConnection);
    return changed();
  }

  const step = (amount) => config.step * amount;

  const director = {
    config,
    state: snapshot,
    // Re-announce the current state (after the ladder or weights are edited live).
    refresh: changed,
    // fn(snapshot) after every change; returns an unsubscribe.
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // A new battle: everything resets. `bpm` overrides the starting tempo for
    // this encounter (changes still move relative to it); the others override
    // the starting emotional numbers.
    battleStarted({ bpm, tension: t, agitation: a, connection: c } = {}) {
      tension = clamp01(t ?? config.start.tension);
      agitation = clamp01(a ?? config.start.agitation);
      connection = clamp01(c ?? config.start.connection);
      active = true;
      answers = 0;
      offset = 0;
      stateIndex = nearestIndex(levelNow());
      const startBpm = bpm ?? config.defaultBpm;
      offset = startBpm - ladderBpm(levelNow());
      return changed();
    },
    tensionIncreased: (amount = 1) => nudge(step(amount), step(amount) * 0.5, 0),
    opponentAgitated: (amount = 1) => nudge(0, step(amount), 0),
    connectionSucceeded: (amount = 1) => nudge(-step(amount) * 0.5, 0, step(amount)),
    connectionFailed: (amount = 1) => nudge(step(amount), 0, -step(amount) * 0.5),
    // One answer has been given: the conversation moves on, and the band with it.
    answerGiven() {
      if (!active) return snapshot();
      answers += 1;
      return changed();
    },
    // A warm answer eases the tension without building a connection by itself.
    tensionEased: (amount = 1) => nudge(-step(amount), -step(amount) * 0.5, 0),
    // How close the two have actually got (0..1, e.g. the scope's closeness):
    // set outright, not accumulated, so the music tracks the meter you can see.
    setConnection(value) {
      if (!active) return snapshot();
      connection = clamp01(value);
      return changed();
    },
    opponentCalmed: (amount = 1) => nudge(-step(amount) * 0.5, -step(amount) * 1.5, 0),
    battleEnded() {
      active = false;
      const s = snapshot();
      listeners.forEach((fn) => fn(s));
      return s;
    },
  };
  director.battleStarted();
  return director;
}
