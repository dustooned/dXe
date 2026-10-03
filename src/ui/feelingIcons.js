// What each feeling looks and feels like, without ever naming it — the
// context clues testers asked for. Three layers, each a different sense:
//
//   ICONS   a pixel picture on its wheel slice (a flame, a raindrop…)
//   BODY    a body sensation, shown on hold, and on the first few picks
//           (people recognize feelings from the body faster than by name;
//           cf. Nummenmaa et al. 2014, bodily maps of emotions)
//   feel()  the screen itself reacts for a moment (heat shimmer, drained
//           color, a jitter…), atmospheric and never right or wrong
//
// The names stay hidden until the ending's FEELZ report.

// 9x9 pixel pictures; '#' is lit.
const ICONS = {
  Anger: [ // a flame
    '....#....',
    '...##....',
    '...###...',
    '..####.#.',
    '..######.',
    '.#######.',
    '.###.###.',
    '.##...##.',
    '..#####..',
  ],
  Fear: [ // a wide eye
    '.........',
    '..#####..',
    '.#.....#.',
    '#..###..#',
    '#.#####.#',
    '#..###..#',
    '.#.....#.',
    '..#####..',
    '.........',
  ],
  Sadness: [ // a raindrop
    '....#....',
    '....#....',
    '...###...',
    '...###...',
    '..#####..',
    '.#######.',
    '.#######.',
    '..#####..',
    '...###...',
  ],
  Happy: [ // a sun
    '....#....',
    '.#.....#.',
    '...###...',
    '..#####..',
    '#.#####.#',
    '..#####..',
    '...###...',
    '.#.....#.',
    '....#....',
  ],
  Anxiety: [ // a tangled knot
    '.##...##.',
    '#..#.#..#',
    '#...#...#',
    '.#.#.#.#.',
    '..#...#..',
    '.#.#.#.#.',
    '#...#...#',
    '#..#.#..#',
    '.##...##.',
  ],
  Disgust: [ // eyes squeezed, a wavy "ugh" mouth
    '.........',
    '.##...##.',
    '.##...##.',
    '.........',
    '.........',
    '.#.#.#.#.',
    '#.#.#.#.#',
    '.........',
    '.........',
  ],
  Surprise: [ // a spark burst
    '....#....',
    '.#..#..#.',
    '..#.#.#..',
    '...###...',
    '#########',
    '...###...',
    '..#.#.#..',
    '.#..#..#.',
    '....#....',
  ],
  Trust: [ // an open hand
    '..#.#.#..',
    '..#.#.#.#',
    '..#.#.#.#',
    '#.#####.#',
    '########.',
    '.######..',
    '.######..',
    '..####...',
    '..####...',
  ],
};

// How each one sits in the body. Short, sensory, never the word itself.
export const BODY = {
  Anger: 'jaw tight, hands hot',
  Fear: 'stomach drops, cold neck',
  Sadness: 'heavy arms, slow breath',
  Happy: 'chest light, face warm',
  Anxiety: "can't sit still, tight chest",
  Disgust: 'throat closes, lip curls',
  Surprise: 'breath catches, eyes wide',
  Trust: 'shoulders drop, hands open',
};

function cells(emotion, x0, y0, size) {
  const rows = ICONS[emotion];
  if (!rows) return '';
  let out = '';
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') out += `<rect x="${(x0 + x * size).toFixed(2)}" y="${(y0 + y * size).toFixed(2)}" width="${size}" height="${size}"/>`;
    });
  });
  return out;
}

// The icon as SVG markup centered on (cx, cy), `px` units per cell; it
// takes its color from the parent's fill (feelzDartboard.js's label group).
export function iconCells(emotion, cx, cy, px) {
  const half = (9 * px) / 2;
  return cells(emotion, cx - half, cy - half, px);
}

// A standalone inline icon in the current text color (the drag ghost, the
// ending report's chips).
export function iconHtml(emotion) {
  return `<svg class="dx-feel-icon" viewBox="0 0 9 9" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${cells(emotion, 0, 0, 1)}</svg>`;
}

// Body lines show on every hold, and on a feeling's first few picks; after
// that a pick only gets the icon and the screen's reaction. Counted per
// player, in this browser.
const SEEN_KEY = 'dreamxtreme:bodyHints';
const PICKS_SHOWN = 3;

function seenCounts() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}

let captionTimer = null;
// Shows the body line over the screen (in the canvas, so a re-render of the
// scene underneath doesn't wipe it). `onPick`: count it, and skip it once
// this feeling has been seen enough.
export function showBody(emotion, { onPick = false } = {}) {
  if (!BODY[emotion]) return;
  if (onPick) {
    const counts = seenCounts();
    if ((counts[emotion] ?? 0) >= PICKS_SHOWN) return;
    counts[emotion] = (counts[emotion] ?? 0) + 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(counts)); } catch { /* private mode */ }
  }
  const host = document.querySelector('.dx-canvas');
  if (!host) return;
  host.querySelector('.dx-feel-body')?.remove();
  const el = document.createElement('p');
  el.className = 'dx-feel-body';
  el.style.setProperty('--feel', `var(--color-feelz-${emotion.toLowerCase()})`);
  el.textContent = BODY[emotion];
  host.appendChild(el);
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => el.remove(), 2200);
}

let feelTimer = null;
// The screen reacts to the feeling for a moment (scenes.css .dx-feel--*).
export function feel(emotion) {
  const stage = document.querySelector('.dx-stage');
  if (!stage || !ICONS[emotion]) return;
  stage.className = stage.className.replace(/\s*dx-feel--\w+/g, '');
  void stage.offsetWidth;
  stage.classList.add(`dx-feel--${emotion.toLowerCase()}`);
  clearTimeout(feelTimer);
  feelTimer = setTimeout(() => {
    stage.className = stage.className.replace(/\s*dx-feel--\w+/g, '');
  }, 1700);
}
