// Procedural "reveal" background — a complement-hue dithered pattern,
// deterministic per seed string via a seeded PRNG, so the same key
// always reveals the same pattern rather than looking like random noise.
// Originally just for FEELZ emotions (the dialog swipe reveal); now also
// used for ending keys (the ending judgment beat), hence "key" rather
// than "emotion" below.
const HUES = {
  // FEELZ emotions
  Anger: 16,
  Fear: 51,
  Anticipation: 195,
  Trust: 145,
  Disgust: 280,
  Joy: 55,
  Sadness: 220,
  Surprise: 26,
  // Ending tiers
  CLEAN_CUT: 200,
  FUNCTIONAL_MASK: 90,
  COLLAPSE: 0,
  LIVING_LIE: 130,
};

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let state = seed;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawEmotionPattern(canvas, { seedStr, key }) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width === 0 || height === 0) return;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const baseHue = HUES[key] ?? 0;
  const complementHue = (baseHue + 180) % 360;
  const rand = mulberry32(hashSeed(seedStr));

  ctx.fillStyle = `hsl(${complementHue}deg 70% 45%)`;
  const cell = 16;
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      if (rand() < 0.32) {
        ctx.fillRect(x, y, cell - 5, cell - 5);
      }
    }
  }
}
