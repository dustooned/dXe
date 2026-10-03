// Where a baked arrangement takes over an NPC's music. If an arrangement
// exists for the NPC (content/arrangements/<npc>.json), the confrontation
// cutscene before the battle plays its intro section, the dialog scene then
// begins the battle and the tempo director moves the music on from there,
// and the music ends with the encounter. An NPC with no arrangement keeps its
// leitmotif — callers ask `open`/`engage`, and fall back when they get false.
//
// Everything the music reacts to is the relationship (rapport and comfort),
// never right or wrong: a comforting lie that lands warm calms the music, a
// hard truth that lands cold tightens it. See engine/tempoDirector.js.
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
// (the same number that bends the leitmotif and the chord): warm lowers the
// tension, cold raises it. Being caught contradicting yourself is a break in
// the connection and puts the opponent on edge.
export function react({ delta = 0, caught = false, missed = false } = {}) {
  if (!active) return;
  const d = active.music.director;
  if (caught) { d.connectionFailed(); d.opponentAgitated(0.5); return; }
  if (delta > 0) d.connectionSucceeded(Math.min(2, delta / 2));
  else if (delta < 0) d.tensionIncreased(Math.min(2, -delta / 2));
  else if (missed) d.tensionIncreased(0.5);
}

export function end(opts = { fade: 0.8 }) {
  if (!active) return;
  active.music.end(opts);
  active = null;
}
