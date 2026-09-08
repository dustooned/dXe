// Colored-initial placeholder until real portrait art lands (see docs/CONTENT_SCHEMA.md
// asset spec) — an NPC's content JSON can carry a `portrait` path once art exists,
// authored via the manuscript's `PORTRAIT:` header (SCRIPT_FORMAT.md); omitting it
// keeps today's placeholder.
//
// Mood mask: once a real portrait image exists, its own light/dark values become a
// CSS mask over a solid color layer — same live-value pattern as the leitmotif's
// fifths bend (shell/audio.js's getLeitmotifMood()), just visual instead of audible.
// Prototyped and confirmed working against real production art before this was
// wired in for real (see the Mood Mask Lab artifact). No-op with no portrait image:
// there's nothing to mask yet on the colored-letter placeholder.
const MOOD_CLAMP = 6;
const NEUTRAL = [242, 242, 240];
const TENSE = [255, 59, 59];
const RESONANT = [0, 230, 168];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function moodToColor(mood) {
  const m = Math.max(-MOOD_CLAMP, Math.min(MOOD_CLAMP, mood));
  if (m === 0) return `rgb(${NEUTRAL.join(',')})`;
  const t = Math.abs(m) / MOOD_CLAMP;
  const target = m < 0 ? TENSE : RESONANT;
  const rgb = [0, 1, 2].map((i) => lerp(NEUTRAL[i], target[i], t));
  return `rgb(${rgb.join(',')})`;
}

export function createNpcPortrait(npcName, accentColor, portraitUrl) {
  const el = document.createElement('div');
  el.className = 'dx-portrait';
  el.style.setProperty('--accent', accentColor || 'var(--color-white)');

  let maskLayer = null;

  if (portraitUrl) {
    const img = document.createElement('img');
    img.className = 'dx-portrait__img';
    img.src = portraitUrl;
    img.alt = npcName;
    el.appendChild(img);

    maskLayer = document.createElement('div');
    maskLayer.className = 'dx-portrait__mood';
    maskLayer.style.setProperty('--mask-url', `url('${portraitUrl}')`);
    el.appendChild(maskLayer);
  } else {
    el.textContent = npcName.charAt(0).toUpperCase();
  }

  const nameplate = document.createElement('div');
  nameplate.className = 'dx-nameplate';
  nameplate.textContent = npcName;

  return {
    el,
    nameplate,
    // Called after each resolved dialog choice with audio.getLeitmotifMood() —
    // no-ops when there's no portrait image (maskLayer is null).
    updateMood(mood) {
      if (maskLayer) maskLayer.style.setProperty('--mood-color', moodToColor(mood));
    },
  };
}
