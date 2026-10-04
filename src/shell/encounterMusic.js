// Where a baked arrangement takes over an NPC's music. If an arrangement
// exists for the NPC (content/arrangements/<npc>.json), the confrontation
// cutscene before the battle plays its intro section, the dialog scene then
// begins the battle and the tempo director moves the music on from there,
// and the music ends with the encounter. An NPC with no arrangement keeps its
// leitmotif — callers ask `open`/`engage`, and fall back when they get false.
//
// The battle escalates by phase (engine/tempoDirector.js): the music is the
// conversation getting deeper, not a verdict on how you did. (An emotion-driven
// mode, where warm answers calm it and cold ones tighten it, is kept for the
// sound player.)
import { createBattleMusic } from './battleMusic.js';
import * as audio from './audio.js';

const modules = import.meta.glob('../chapters/*/content/arrangements/*.json', { eager: true, import: 'default' });
export const arrangements = Object.values(modules);

let active = null; // { npcKey, music }

const dataFor = (npcKey) => arrangements.find((a) => a.id.toUpperCase() === npcKey);

export const claims = (npcKey) => !!dataFor(npcKey);
export const current = () => active?.music ?? null;

// The confrontation cutscene starts: play the arrangement's intro section.
export function open(npcKey) {
  const data = dataFor(npcKey);
  if (!data) return false;
  if (active?.npcKey === npcKey) return true;
  end();
  const music = createBattleMusic(data);
  audio.beginEncounter(npcKey, data.tonic);
  music.start({ section: music.director.config.introSection });
  active = { npcKey, music };
  return true;
}

// The battle itself begins (the dialog scene mounts). Continues the music the
// cutscene started, or starts it if the scene was entered directly.
export function engage(npcKey) {
  const data = dataFor(npcKey);
  if (!data) return false;
  if (active?.npcKey === npcKey) {
    active.music.engage();
  } else {
    end();
    const music = createBattleMusic(data);
    audio.beginEncounter(npcKey, data.tonic);
    music.start();
    active = { npcKey, music };
  }
  return true;
}

// How one answer landed. `delta` is the move in the NPC's trust + stability
// (the same number that bends the leitmotif and the chord): warm eases the
// tension, cold raises it. Being caught contradicting yourself puts the
// opponent on edge. `closeness` is the scope's meter (syncs, bids, misses
// this encounter; 1 once they trust you) and sets the connection outright,
// so the song follows how close you actually are.
//
// Answers move trust and stability by only 1-2 points, so a delta counts for
// SENSITIVITY events: tuned so a run of cold answers in a four-node encounter
// reaches the tense sections (all parts playing) and a run of warm ones
// reaches calm. Checked against Rwanda's real deltas.
const SENSITIVITY = 2;

export function react({ delta = 0, caught = false, missed = false, closeness } = {}) {
  if (!active) return;
  const d = active.music.director;
  if (closeness !== undefined) active.music.setCloseness(closeness);
  // Driven by phase, an answer just advances the battle one step; how warm or
  // cold it was, and how close you are, don't touch the tempo or sections.
  if (d.config.drive === 'phase') { d.answerGiven(); return; }
  if (caught) { d.tensionIncreased(1); d.opponentAgitated(0.5); }
  else if (delta > 0) d.tensionEased(Math.min(4, delta * SENSITIVITY));
  else if (delta < 0) d.tensionIncreased(Math.min(4, -delta * SENSITIVITY));
  else if (missed) d.tensionIncreased(0.75);
  if (closeness !== undefined) d.setConnection(closeness);
  d.answerGiven(); // the band grows with the conversation, not with the tension
}

// The music steps back (a trauma story is told over silence-but-for-voices).
export function duck(on, fade = 0.8) {
  active?.music.player.duck(on, fade);
}

export function end(opts = { fade: 0.8 }) {
  if (!active) return;
  active.music.end(opts);
  active = null;
}
