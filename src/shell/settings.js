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
  // TIPS (Settings > TIPS, and the repeat client's "check in on you?"): the
  // Therapist's tip calls in battles and the spotlight, labels, "try this"
  // line and glows that go with his lessons. Off: no tip calls, nothing
  // lights up. Your own calls to contacts work either way.
  guideHighlights: true,
  // Color vision: 'normal' | 'redgreen' | 'blueyellow'. Either aid swaps the
  // eight feeling colors for a set that stays apart under that kind of color
  // blindness, and puts each feeling's symbol before its colored words.
  colorVision: 'normal',
};

export const COLOR_VISION_MODES = ['normal', 'redgreen', 'blueyellow'];

export function applyEffectsSetting(s = loadSettings()) {
  document.documentElement.classList.toggle('is-reduced-effects', !!s.reduceEffects);
  document.documentElement.classList.toggle('is-large-text', s.textSize === 'large');
  const cv = COLOR_VISION_MODES.includes(s.colorVision) ? s.colorVision : 'normal';
  document.documentElement.classList.toggle('is-colorblind', cv !== 'normal');
  document.documentElement.classList.toggle('is-cvd-redgreen', cv === 'redgreen');
  document.documentElement.classList.toggle('is-cvd-blueyellow', cv === 'blueyellow');
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
