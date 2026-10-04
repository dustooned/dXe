// Sound tuning saved from the debug menu's sound player (ui/soundLab.js):
// the settings you can't read out of an FL project — how loud each part is,
// which kit piece each drum key plays, the tempo ladder. Kept per
// arrangement id in localStorage and applied whenever that arrangement plays,
// in the game too. COPY JSON in the player prints it, ready to be made the
// new default in code (shell/arrangementVoices.js, engine/tempoDirector.js).
//
//   { level, voices: { <part>: { level } }, drums: { <key>: <piece> },
//     tempo: { minBpm, maxBpm, rampSeconds, quantize, sectionQuantize,
//              step, weights: { connection }, states: [{ id, bpm, section }] } }
const KEY = 'dreamxtreme:soundTuning';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

// Saved tuning holds only what was changed from the code defaults (v2), so a
// better default reaches everyone who never touched that setting. Version-1
// saves stored every value, including the master level that was then the
// default (0.14): drop that one, since it was never a choice.
export function getTuning(id) {
  const t = { ...(loadAll()[id] ?? {}) };
  if (t.v !== 2 && t.level === 0.14) delete t.level;
  return t;
}

export function saveTuning(id, tuning) {
  const all = loadAll();
  all[id] = { ...tuning, v: 2 };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage off: lasts this session only */ }
}

export function resetTuning(id) {
  const all = loadAll();
  delete all[id];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage off */ }
}
