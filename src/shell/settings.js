// Persisted player-facing settings (volume/mute). Separate from save.js's
// story progress — this is preference, not progress, and is read once at
// boot (shell/hud.js) plus every time the settings panel changes something.
const KEY = 'dreamxtreme:settings';

const defaultSettings = {
  volume: 0.5,
  muted: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}

export function updateSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
