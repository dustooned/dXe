// Player loadout — character class, emotion set, and amplification table.
// The dartboard always renders all 8 emotions; a class determines which 3
// are "loaded" (selectable and amplifiable) for a given run.
//
// Amplification rule (see docs/STAT_MATH.md): each emotion amplifies one
// specific stat's swing by ×1.5. Lucidity is deliberately never amplified —
// it stays a pure signal of how honest the actual swipe choice was.

export const EMOTIONS = {
  Anger:        { symbol: '▲', color: 'var(--color-feelz-anger)',        amplifies: 'stability' },
  Fear:         { symbol: '◉', color: 'var(--color-feelz-fear)',         amplifies: 'integrity' },
  Anticipation: { symbol: '▶', color: 'var(--color-feelz-anticipation)', amplifies: 'trust'     },
  Trust:        { symbol: '◆', color: 'var(--color-feelz-trust)',        amplifies: 'trust'     },
  Disgust:      { symbol: '✕', color: 'var(--color-feelz-disgust)',      amplifies: 'integrity' },
  Joy:          { symbol: '★', color: 'var(--color-feelz-joy)',          amplifies: 'stability' },
  Sadness:      { symbol: '▼', color: 'var(--color-feelz-sadness)',      amplifies: 'integrity' },
  Surprise:     { symbol: '⊕', color: 'var(--color-feelz-surprise)',     amplifies: 'trust'     },
};

// The 8 emotions in clockwise dartboard order, matching Plutchik's wheel:
// Joy → Trust → Fear → Surprise → Sadness → Disgust → Anger → Anticipation
export const EMOTION_ORDER = [
  'Joy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anticipation',
];

export const CLASSES = {
  Guns: {
    label: 'GUNS',
    description: 'Confrontation. Force. No flinching.',
    emotions: ['Anger', 'Fear', 'Anticipation'],
  },
  Bible: {
    label: 'BIBLE',
    description: 'Faith. Loyalty. Buried doubt.',
    emotions: ['Trust', 'Disgust', 'Anticipation'],
  },
  Crystals: {
    label: 'CRYSTALS',
    description: 'Feeling everything. Processing nothing.',
    emotions: ['Joy', 'Sadness', 'Surprise'],
  },
};

// Returns the CSS color var for an emotion, or white if unknown.
export function emotionColor(emotion) {
  return EMOTIONS[emotion]?.color ?? 'var(--color-white)';
}

// Returns which stat an emotion amplifies, or null if unknown / not loaded.
export function emotionAmplifies(emotion) {
  return EMOTIONS[emotion]?.amplifies ?? null;
}

// The 3 emotions a class actually has loaded — the only ones the dartboard
// lets the player select, and so the only ones that should have audio stems
// running. Falls back to all 8 if the class is unknown.
export function emotionsForClass(loadout) {
  return CLASSES[loadout]?.emotions ?? EMOTION_ORDER;
}

// `counts` is a { [emotion]: number } tally of FEELZ picks across the run
// (run.emotionCounts, incremented once per swipe in dialogScene.js).
// Returns the emotion with a *unique* highest count, or null if the picks
// are tied (including all-zero, before any pick has happened) — a spread
// that even wasn't a lean, not a lean the game has to arbitrarily break.
export function getDominantEmotion(counts) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, n]) => n));
  const leaders = entries.filter(([, n]) => n === max);
  return leaders.length === 1 ? leaders[0][0] : null;
}
