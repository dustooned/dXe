const KEY = 'dreamxtreme:save';

const defaultSave = {
  endingsSeen: [], // e.g. ['CLEAN_CUT', 'LIVING_LIE']
  chaptersCompleted: [], // e.g. ['lake-ulysses']
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultSave, ...JSON.parse(raw) } : { ...defaultSave };
  } catch {
    return { ...defaultSave };
  }
}

export function updateSave(patch) {
  const current = loadSave();
  const next = { ...current, ...patch };
  // Storage can be off or full (private windows, blocked site data); progress
  // just won't persist then, and the game keeps going.
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* unsaved */ }
  return next;
}

export function recordEnding(chapterId, endingKey) {
  const save = loadSave();
  const endingsSeen = save.endingsSeen.includes(endingKey)
    ? save.endingsSeen
    : [...save.endingsSeen, endingKey];
  const chaptersCompleted = save.chaptersCompleted.includes(chapterId)
    ? save.chaptersCompleted
    : [...save.chaptersCompleted, chapterId];
  return updateSave({ endingsSeen, chaptersCompleted });
}

// The checkpoint: where a chapter run is and its whole state, written at the
// start of every scene (chapters call saveCheckpoint) so a crash or a closed
// tab loses at most the scene in progress. CONTINUE on the title reads it;
// reaching an ending clears it.
const CHECKPOINT_KEY = 'dreamxtreme:checkpoint';

export function saveCheckpoint({ chapterId, sceneId, state }) {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ chapterId, sceneId, state, at: Date.now() }));
    return true;
  } catch {
    return false; // storage off or full: the game keeps going, just unsaved
  }
}

export function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    const cp = raw ? JSON.parse(raw) : null;
    return cp?.chapterId && cp?.sceneId && cp?.state ? cp : null;
  } catch {
    return null;
  }
}

export function clearCheckpoint() {
  try { localStorage.removeItem(CHECKPOINT_KEY); } catch { /* nothing to clear */ }
}
