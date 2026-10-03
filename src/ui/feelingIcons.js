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
export const ICONS = {
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

// How each one sits in the body. Short, sensory, never the word itself,
// and said differently per class, the way each would notice it:
//   Guns      the body bracing, readying (hands, jaw, exits)
//   Bible     the body and the conscience together (bowed, clasped, held)
//   Crystals  energy moving through the body (heat, buzz, fizz, hum)
export const BODY = {
  Guns: {
    Anger: 'knuckles white, pulse in your teeth',
    Fear: 'back to the wall, ears ringing',
    Sadness: 'arms like sandbags',
    Happy: "shoulders loose, a grin you can't help",
    Anxiety: 'finger tapping, scanning for exits',
    Disgust: 'jaw set, spit the taste out',
    Surprise: 'flinch, then freeze',
    Trust: 'back turned, and that\'s fine',
  },
  Bible: {
    Anger: 'face hot, a verse on your tongue',
    Fear: 'knees weak, hands clasped',
    Sadness: 'chest hollow, eyes stinging',
    Happy: 'lifted, light in the chest',
    Anxiety: 'rehearsing it, over and over',
    Disgust: 'stomach turns, a step back',
    Surprise: 'breath held, heart skips',
    Trust: 'hands open, head bowed',
  },
  Crystals: {
    Anger: 'heat climbing up the spine',
    Fear: 'a cold prickle down the arms',
    Sadness: 'a weight pooling in the chest',
    Happy: 'fizz in the fingertips, face warm',
    Anxiety: 'buzzing under the skin',
    Disgust: 'skin crawls, you need air',
    Surprise: 'a jolt, everything too bright',
    Trust: 'a soft hum, shoulders melting',
  },
};
// Before a class is known (or an unknown one): plain, neutral lines.
const BODY_PLAIN = {
  Anger: 'jaw tight, hands hot',
  Fear: 'stomach drops, cold neck',
  Sadness: 'heavy arms, slow breath',
  Happy: 'chest light, face warm',
  Anxiety: "can't sit still, tight chest",
  Disgust: 'throat closes, lip curls',
  Surprise: 'breath catches, eyes wide',
  Trust: 'shoulders drop, hands open',
};
export function bodyLine(emotion, loadout) {
  return BODY[loadout]?.[emotion] ?? BODY_PLAIN[emotion] ?? '';
}

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
export function showBody(emotion, { onPick = false, loadout } = {}) {
  const line = bodyLine(emotion, loadout);
  if (!line) return;
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
  el.textContent = line;
  // Just under the wheel when it's on screen; otherwise the lower screen.
  const wheel = document.querySelector('.dx-dartboard');
  if (wheel) {
    const hb = host.getBoundingClientRect();
    const wb = wheel.getBoundingClientRect();
    el.style.top = `${Math.min(wb.bottom - hb.top + 6, hb.height - 40)}px`;
    el.style.bottom = 'auto';
  }
  host.appendChild(el);
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => el.remove(), 2200);
}

// A one-shot burst of pixels at the spot you tapped, in the feeling's color
// and its own motion: sparks rise from a flame, drops fall, a ring closes
// like a blink... Lives in the canvas, so a re-render can't cut it short.
// Each particle: [dx, dy] end offset in px, plus how it moves.
const BURSTS = {
  Anger: () => Array.from({ length: 7 }, (_, i) => ({ dx: (i - 3) * 6 + rnd(4), dy: -40 - rnd(26), ms: 650 + rnd(200), flicker: true })),
  Fear: () => ring(10, 34).map((p) => ({ from: p, dx: 0, dy: 0, ms: 520 })),
  Sadness: () => Array.from({ length: 5 }, (_, i) => ({ dx: (i - 2) * 9, dy: 38 + rnd(16), ms: 800 + rnd(200), ease: 'ease-in' })),
  Happy: () => ring(8, 30).map((p) => ({ dx: p[0], dy: p[1], ms: 600 })),
  Anxiety: () => Array.from({ length: 8 }, () => ({ dx: rnd(24) - 12, dy: rnd(24) - 12, ms: 700, jitter: true })),
  Disgust: () => Array.from({ length: 6 }, (_, i) => ({ dx: (i % 2 ? 14 : -14) + rnd(6), dy: 26 + rnd(14), ms: 900, wobble: true })),
  Surprise: () => ring(10, 54).map((p) => ({ dx: p[0], dy: p[1], ms: 380, ease: 'cubic-bezier(0.1, 0.9, 0.2, 1)' })),
  Trust: () => ring(12, 26).map((p) => ({ dx: p[0], dy: p[1], ms: 1100, ease: 'ease-out', soft: true })),
};
function rnd(n) { return Math.random() * n; }
function ring(n, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

export function burst(emotion, x, y) {
  const host = document.querySelector('.dx-canvas');
  const make = BURSTS[emotion];
  if (!host || !make || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = host.getBoundingClientRect();
  const color = `var(--color-feelz-${emotion.toLowerCase()})`;
  for (const p of make()) {
    const dot = document.createElement('span');
    dot.className = 'dx-feel-burst';
    dot.style.background = color;
    dot.style.left = `${x - box.left}px`;
    dot.style.top = `${y - box.top}px`;
    host.appendChild(dot);
    const start = p.from ? `translate(${p.from[0]}px, ${p.from[1]}px)` : 'translate(0, 0)';
    const end = `translate(${p.dx}px, ${p.dy}px)`;
    let frames;
    if (p.jitter) {
      frames = [0, 1, 2, 3, 4].map((k) => ({ transform: `translate(${rnd(16) - 8}px, ${rnd(16) - 8}px)`, opacity: 1 - k * 0.2 }));
    } else if (p.wobble) {
      frames = [
        { transform: start, opacity: 1 },
        { transform: `translate(${p.dx * 0.5}px, ${p.dy * 0.2}px)`, opacity: 1, offset: 0.4 },
        { transform: end, opacity: 0 },
      ];
    } else if (p.flicker) {
      frames = [
        { transform: start, opacity: 1 },
        { transform: `translate(${p.dx * 0.6}px, ${p.dy * 0.6}px)`, opacity: 0.4, offset: 0.5 },
        { transform: `translate(${p.dx * 0.8}px, ${p.dy * 0.8}px)`, opacity: 1, offset: 0.7 },
        { transform: end, opacity: 0 },
      ];
    } else {
      frames = [{ transform: start, opacity: p.soft ? 0.7 : 1 }, { transform: end, opacity: 0 }];
    }
    const anim = dot.animate(frames, { duration: p.ms, easing: p.ease ?? 'ease-out', fill: 'forwards' });
    anim.onfinish = () => dot.remove();
  }
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
