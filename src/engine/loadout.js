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
  Anxiety: { symbol: '▶', color: 'var(--color-feelz-anxiety)', amplifies: 'trust'     },
  Trust:        { symbol: '◆', color: 'var(--color-feelz-trust)',        amplifies: 'trust'     },
  Disgust:      { symbol: '✕', color: 'var(--color-feelz-disgust)',      amplifies: 'integrity' },
  Happy:          { symbol: '★', color: 'var(--color-feelz-happy)',          amplifies: 'stability' },
  Sadness:      { symbol: '▼', color: 'var(--color-feelz-sadness)',      amplifies: 'integrity' },
  Surprise:     { symbol: '⊕', color: 'var(--color-feelz-surprise)',     amplifies: 'trust'     },
};

// The 8 emotions in clockwise dartboard order. Plutchik's wheel, with
// Anxiety in Anticipation's slot and Joy renamed Happy (2026-09-27):
// Happy → Trust → Fear → Surprise → Sadness → Disgust → Anger → Anxiety
export const EMOTION_ORDER = [
  'Happy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anxiety',
];

export const CLASSES = {
  Guns: {
    label: 'GUNS',
    description: 'Confrontation. Force. No flinching.',
    emotions: ['Anger', 'Fear', 'Sadness'],
    // A room object your class restores is stamped in your class's words.
    glyph: '✛',
    restored: 'SQUARED AWAY',
  },
  Bible: {
    label: 'BIBLE',
    description: 'Faith. Loyalty. Buried doubt.',
    emotions: ['Anxiety', 'Disgust', 'Fear'],
    glyph: '✝',
    restored: 'MADE RIGHT',
  },
  Crystals: {
    label: 'CRYSTALS',
    description: 'Feeling everything. Processing nothing.',
    emotions: ['Happy', 'Anxiety', 'Surprise'],
    glyph: '❖',
    restored: 'ATTUNED',
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

// The emotions a player actually has loaded — their class's 3, plus any
// they've unlocked during the run (run.unlocked, e.g. Trust) — the only
// ones the dartboard lets the player select, and so the only ones that
// should have audio stems running. Falls back to all 8 if the class is
// unknown.
export function emotionsForClass(loadout, unlocked = []) {
  const base = CLASSES[loadout]?.emotions;
  if (!base) return EMOTION_ORDER;
  return [...base, ...unlocked.filter((e) => !base.includes(e))];
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

// How a node feels to a player of this class: an NPC can feel differently
// toward their kin or their foe (manuscript `MOOD [Bible]: Fear`).
export function moodFor(node, loadout) {
  return node?.moodByClass?.[loadout] ?? node?.mood ?? null;
}

// The NPC as a player of this class meets them: every node's MOOD already
// resolved for that class, so nothing downstream has to know about kin/foe.
export function withClassMoods(npc, loadout) {
  if (!npc?.nodes || !Object.values(npc.nodes).some((n) => n.moodByClass)) return npc;
  const nodes = Object.fromEntries(Object.entries(npc.nodes).map(([id, n]) => (
    [id, n.moodByClass ? { ...n, mood: moodFor(n, loadout) } : n]
  )));
  return { ...npc, nodes };
}

// Each class's own color (style.css --color-class-*): the room's tint for an
// NPC of that class, and the cue when your class restores something.
export function classColor(cls) {
  return CLASSES[cls] ? `var(--color-class-${cls.toLowerCase()})` : 'var(--color-white)';
}

// Text authored per class ({ Guns, Bible, Crystals }) or once for everyone (a
// string): this player's version, falling back to the first one written so a
// half-authored line still shows something. Used by room captions
// (ui/walkRoom.js) and cutscene beats and options (scenes/cutsceneScene.js).
export function forClass(text, loadout) {
  if (text == null || typeof text === 'string') return text ?? '';
  return text[loadout] ?? Object.values(text)[0] ?? '';
}

// Effort (2026-10-10): committing to a feeling your class isn't used to takes
// battery, paid when you swipe (never for touching or switching on the wheel).
//   your class's own three, Trust (the reward), other gifts   free
//   a gift that clashes with one of yours, the opposite across the wheel
//   (Happy/Sadness, Trust/Disgust, Fear/Anger, Surprise/Anxiety)   CLASH_COST
// and only until you're used to it: after USED_TO answers with it
// (run.emotionCounts) it's free. Tuned with scripts/balance-sim.mjs: charging
// every gift 1 and a clash 2 ran honest players empty in 80-100% of runs;
// this lands near the old change-of-mind cost (Guns 29%, Bible 11%, Crystals
// 48% vs 41/14/29).
export const CLASH_COST = 1;
export const USED_TO = 1;
export function effortCost(emotion, loadout, counts = {}) {
  const own = CLASSES[loadout]?.emotions;
  if (!emotion || !own || own.includes(emotion) || emotion === 'Trust') return 0;
  if ((counts[emotion] ?? 0) >= USED_TO) return 0;
  const i = EMOTION_ORDER.indexOf(emotion);
  const opposite = EMOTION_ORDER[(i + 4) % EMOTION_ORDER.length];
  return own.includes(opposite) ? CLASH_COST : 0;
}
