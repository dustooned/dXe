// Persisted player-facing settings (volume/mute/text speed). Separate from save.js's
// story progress — this is preference, not progress, and is read once at
// boot (shell/hud.js) plus every time the settings panel changes something.
const KEY = 'dreamxtreme:settings';

const defaultSettings = {
  volume: 0.5,
  muted: false,
  // Typewriter speed: 'normal' | 'fast' | 'instant' (ui/typewriterText.js).
  textSpeed: 'normal',
  // Reduce effects: no screen shake or flashes, no opponent weather, haze or
  // screen tints (for motion-sensitive players). Applied as a class on <html>.
  reduceEffects: false,
  // Text size: 'normal' | 'large' (all body text a step bigger).
  textSize: 'normal',
  // Guide highlights: the spotlight, labels, "try this" line and glows that
  // go with the Therapist's calls. Off: he still talks, nothing lights up.
  guideHighlights: true,
};

export function applyEffectsSetting(s = loadSettings()) {
  document.documentElement.classList.toggle('is-reduced-effects', !!s.reduceEffects);
  document.documentElement.classList.toggle('is-large-text', s.textSize === 'large');
}

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
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* unsaved */ }
  return next;
}
