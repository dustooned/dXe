// The FEELZ boot precursor: the FEELZ wheel as pixel art, filled with a
// rainbow wave in the eight FEELZ colors that drifts across it. Shown on the
// app's logo beat (feelz_launch.json), before the player has used the wheel
// for real — a preview of what they're about to be handed.
//
// How it works: a tiny canvas (GRID x GRID logical pixels) scaled up with
// pixelated rendering, so every cell reads as a chunky pixel. Each frame,
// every cell inside the wheel's eight slices takes a color from a cyclic
// blend of the eight feelings, by its diagonal position minus time. The
// cycle wraps on itself, so the wave is seamless: no tile edges, no jump.
// The glow is a drop-shadow on the wrapper (scenes.css).
const GRID = 48;
const OUTER = 23;
const INNER = 8.5;
const GAP = 0.09; // radians trimmed off each slice edge, the gaps between them
const ORDER = ['anger', 'surprise', 'happy', 'trust', 'anxiety', 'sadness', 'disgust', 'fear'];
const WAVE_CELLS = 120; // cells per full trip through the eight colors (about 3 across the wheel)
const SPEED = 0.0006; // colors the wave moves per ms (one full cycle in ~13s)

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Which cells are inside a slice: annulus, minus a thin gap at each of the
// eight slice boundaries (the wheel's first slice is centered at the top).
function wheelMask() {
  const mask = new Uint8Array(GRID * GRID);
  const c = (GRID - 1) / 2;
  const step = (Math.PI * 2) / 8;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      if (r > OUTER || r < INNER) continue;
      // Angle from the top, clockwise, offset so slice edges sit at ±22.5°.
      let a = Math.atan2(dx, -dy) + step / 2;
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const within = a % step;
      // The gap is an arc length, so it narrows toward the center.
      const gap = GAP * (OUTER / Math.max(r, INNER)) * 0.6;
      if (within < gap || within > step - gap) continue;
      mask[y * GRID + x] = 1;
    }
  }
  return mask;
}

export function createFeelzSilhouette() {
  const el = document.createElement('div');
  el.className = 'dx-feelz-sil';
  el.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'dx-feelz-sil__px';
  canvas.width = GRID;
  canvas.height = GRID;
  el.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(GRID, GRID);
  const mask = wheelMask();
  const css = getComputedStyle(document.documentElement);
  const colors = ORDER.map((name) => hexToRgb(css.getPropertyValue(`--color-feelz-${name}`) || '#ffffff'));
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let raf = null;
  function draw(now) {
    const shift = reduce ? 0 : now * SPEED;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = y * GRID + x;
        const o = i * 4;
        if (!mask[i]) { img.data[o + 3] = 0; continue; }
        // Position along the wave, in color steps, wrapped onto the cycle.
        const pos = (((x + y * 0.6) / WAVE_CELLS) * ORDER.length - shift) % ORDER.length;
        const p = (pos + ORDER.length) % ORDER.length;
        const k = Math.floor(p);
        const t = p - k;
        const a = colors[k];
        const b = colors[(k + 1) % ORDER.length];
        img.data[o] = a[0] + (b[0] - a[0]) * t;
        img.data[o + 1] = a[1] + (b[1] - a[1]) * t;
        img.data[o + 2] = a[2] + (b[2] - a[2]) * t;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!reduce) raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  return { el, destroy() { cancelAnimationFrame(raf); el.remove(); } };
}
