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
  localStorage.setItem(KEY, JSON.stringify(next));
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
