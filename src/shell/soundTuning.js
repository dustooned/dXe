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

export function getTuning(id) {
  return loadAll()[id] ?? {};
}

export function saveTuning(id, tuning) {
  const all = loadAll();
  all[id] = tuning;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage off: lasts this session only */ }
}

export function resetTuning(id) {
  const all = loadAll();
  delete all[id];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage off */ }
}
