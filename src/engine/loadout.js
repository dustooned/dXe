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

export const DEFAULT_CLASS = 'Guns';

// Returns the CSS color var for an emotion, or white if unknown.
export function emotionColor(emotion) {
  return EMOTIONS[emotion]?.color ?? 'var(--color-white)';
}

// Returns which stat an emotion amplifies, or null if unknown / not loaded.
export function emotionAmplifies(emotion) {
  return EMOTIONS[emotion]?.amplifies ?? null;
}

// Returns true if the given emotion is in a class's loaded set.
export function isLoaded(className, emotion) {
  return CLASSES[className]?.emotions.includes(emotion) ?? false;
}
