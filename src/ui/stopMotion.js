// Full-screen looping stop-motion, drawn live: the walk-around expositions
// ("The water looks fine today", the trip home) get a picture that moves.
// Inspired by the pixilation in Tetsuo: The Iron Man (things that should not
// move, jerking forward on twos and threes, the frame it was shot on stays in
// the gate), not copied from it. White on black, 1-bit, no glow.
//
//   const loop = createStopMotion('lake');   // loop.el is a <canvas>, fills its parent
//   loop.destroy();
//
// How it reads as stop-motion rather than animation:
//   - a LOOP of 12 frames shown at 6 fps, so every motion repeats exactly;
//   - each element moves on its own beat (twos, threes, a held fourth): the
//     lake breathes on twos, the dog on threes, the sign sticks and jumps;
//   - gate weave (the whole frame shifts a pixel or two), film grain, and now
//     and then a flash frame (inverted for one frame) like a bad splice.
// These are PLACEHOLDER motifs: an artist's frame sequence replaces one by
// naming `bgAnim` on the beat instead (cutsceneScene.js), and nothing else
// has to change. KEYS lists what exists.
import { isPaused } from '../shell/pauseBus.js';

const W = 78;
const H = 168;
const FRAMES = 12;
const FPS = 6;

// Deterministic noise: the same frame always draws the same grain, so a loop
// repeats exactly (that is the stop-motion cell, not a random flicker).
function rng(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A value that only changes every `step` frames: the "shot on twos" feel.
const held = (f, step) => Math.floor(f / step) * step;
const wave = (f, step, period = FRAMES) => Math.sin((held(f, step) / period) * Math.PI * 2);

// ---- 1-bit drawing helpers (ctx.fillStyle is white) -----------------------
const px = (c, x, y, w = 1, h = 1) => c.fillRect(Math.round(x), Math.round(y), w, h);
const line = (c, x0, y0, x1, y1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) px(c, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
};
const disc = (c, cx, cy, r) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(c, cx + x, cy + y);
};
const ring = (c, cx, cy, r) => {
  for (let a = 0; a < 6.283; a += 0.5 / Math.max(r, 1)) px(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
};
// A dither patch: every other pixel, so a grey reads as grey in 1 bit.
const dither = (c, x, y, w, h, phase = 0) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) px(c, x + i, y + j);
};
const rect = (c, x, y, w, h) => c.fillRect(Math.round(x), Math.round(y), w, h);

// ---- motifs ---------------------------------------------------------------
// Each draws one frame f (0..11) of its scene.
const MOTIFS = {
  // "The water looks fine today." Too fine: a flat disc of sun, a lake that
  // sits still on twos, one ring that keeps arriving from nowhere.
  lake(c, f) {
    const sunY = 52 + Math.round(wave(f, 3) * 2);
    disc(c, 39, sunY, 15);
    c.fillStyle = '#000';
    for (let i = 0; i < 5; i++) rect(c, 24, sunY - 12 + i * 6, 31, 1); // the sun, cut into bands
    c.fillStyle = '#fff';
    line(c, 0, 84, W, 84); // horizon
    for (let row = 0; row < 11; row++) {
      const y = 90 + row * row * 0.55 + row * 3;
      const shift = Math.round(wave(f + row * 2, 2) * (1 + row * 0.5));
      for (let x = -10; x < W + 10; x += 9 + row) {
        const w = 3 + (row >> 1) + ((x * 7 + row) % 3);
        rect(c, x + shift + ((row * 5) % 7), y, w, 1);
      }
    }
    const r = 3 + ((f % FRAMES) >> 0) * 2; // a ring that grows, then is gone, then is back
    if (f < 10) ring(c, 39, 120, r);
    if (f < 7) ring(c, 39, 120, r - 5);
    // Reeds on the near shore, jerking on threes.
    for (let i = 0; i < 6; i++) {
      const bx = 5 + i * 5 + (i % 2);
      const lean = Math.round(wave(f + i, 3) * 1.4);
      line(c, bx, H, bx + lean, H - 20 - ((i * 7) % 9));
    }
  },

  // Walking home: the shoulder of the road at night, a dashed line that jumps
  // toward you, two legs that step on twos and never quite make it.
  road(c, f) {
    const step = held(f, 2);
    for (let i = 0; i < 7; i++) {
      const t = (((i * 24 + step * 14) % 168) + 168) % 168;
      const y = 70 + t * 0.6;
      const w = 2 + Math.floor(t / 22);
      rect(c, 38 - w / 2, y, w, 4 + Math.floor(t / 16));
    }
    line(c, 0, 66, 30, 66); line(c, 48, 66, W, 66);
    line(c, 0, H, 28, 66); line(c, W, H, 50, 66); // shoulder edges
    const phase = (step / 2) % 2;
    const lx = 28 + phase * 8;
    const rx = 48 - phase * 8;
    line(c, lx, 104, lx - 3 + phase * 6, 140); line(c, lx - 3 + phase * 6, 140, lx - 5 + phase * 6, 148);
    line(c, rx, 104, rx + 3 - phase * 6, 140); line(c, rx + 3 - phase * 6, 140, rx + 5 - phase * 6, 148);
    rect(c, 26, 96, 28, 9);
    for (let i = 0; i < 4; i++) line(c, 4 + i * 20, 20 + (i % 2) * 6, 4 + i * 20, 52); // far lamp posts
    for (let i = 0; i < 4; i++) disc(c, 4 + i * 20, 18 + (i % 2) * 6, 2);
  },

  // Sprinklers ticking: arcs of water on a lawn that jump one step at a time.
  sprinkler(c, f) {
    for (let k = 0; k < 2; k++) {
      const cx = 18 + k * 42;
      const base = 142 - k * 12;
      rect(c, cx - 1, base, 3, 4);
      const sweep = held(f + k * 4, 2) / FRAMES;
      for (let d = 0; d < 11; d++) {
        const ang = -1.15 + sweep * 1.6 + d * 0.01;
        const speed = 24 + (d % 3) * 3;
        for (let tt = 0; tt < 18; tt += 2) {
          const x = cx + Math.cos(ang) * speed * (tt / 12) * (k ? -1 : 1);
          const y = base - Math.sin(-ang) * speed * (tt / 9) + tt * tt * 0.22;
          if (d % 2 === 0 || tt % 4 === 0) px(c, x, y);
        }
      }
    }
    for (let x = 0; x < W; x += 3) rect(c, x, 150 + (x % 2), 1, 5 + ((x * 5) % 4)); // grass
    line(c, 0, 148, W, 148);
  },

  // A church sign missing half its letters. It sticks and jumps.
  churchSign(c, f) {
    rect(c, 36, 96, 6, 72);
    rect(c, 10, 40, 58, 46);
    c.fillStyle = '#000';
    rect(c, 13, 43, 52, 40);
    c.fillStyle = '#fff';
    const rows = ['GOD IS', 'LO_ING', '_EAD_Y TO', 'F_RG_VE'];
    rows.forEach((row, ri) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === ' ' || row[i] === '_') continue;
        const gone = (f + i * 3 + ri * 5) % 12 === 0; // one letter blinks out per loop
        if (gone) continue;
        const x = 15 + i * 5 + (row.length < 7 ? 5 : 0);
        const jig = held(f, 4) % 8 === 0 ? 1 : 0;
        rect(c, x, 47 + ri * 9 + jig, 3, 5);
        if ((i + ri) % 2 === 0) rect(c, x, 49 + ri * 9 + jig, 3, 1);
      }
    });
    const hang = Math.round(wave(f, 4) * 2);
    line(c, 17, 40, 17 + hang, 30); line(c, 61, 40, 61 + hang, 30);
    dither(c, 0, 120, W, 48, held(f, 3));
  },

  // A dog barking at the water like it owes him money: the jaw hinges on
  // threes, the whole head lunges on the beat.
  dog(c, f) {
    const open = held(f, 3) % 6 === 0;
    const lunge = Math.round(Math.max(0, wave(f, 3)) * 5);
    const x = 8 + lunge;
    rect(c, x + 14, 80, 40, 30); // head
    rect(c, x + 6, 66, 9, 18); rect(c, x + 52, 66, 9, 18); // ears
    c.fillStyle = '#000';
    rect(c, x + 22, 88, 4, 4); rect(c, x + 40, 88, 4, 4); // eyes
    c.fillStyle = '#fff';
    rect(c, x + 24, 100, 18, 10); // muzzle
    c.fillStyle = '#000';
    rect(c, x + 31, 101, 4, 3); // nose
    c.fillStyle = '#fff';
    const jaw = open ? 12 : 2;
    rect(c, x + 26, 110, 14, 3 + jaw);
    if (open) {
      c.fillStyle = '#000';
      rect(c, x + 28, 111, 10, jaw);
      c.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) rect(c, x + 29 + i * 3, 111, 1, 2);
    }
    // The BARK, as ticks leaving the mouth.
    if (open) for (let i = 1; i < 4; i++) { line(c, x + 58 + i * 4, 98 - i * 3, x + 62 + i * 4, 98 - i * 3); line(c, x + 58 + i * 4, 106, x + 63 + i * 4, 106 + i * 2); }
    for (let i = 0; i < 13; i++) { rect(c, i * 6, 120 + ((i * 3) % 5), 2, 48 - ((i * 3) % 5)); } // the fence, in front of him
    line(c, 0, 128, W, 128); line(c, 0, 152, W, 152);
  },

  // Three flights: the stairs climb toward you on twos, a hand on the rail.
  stairs(c, f) {
    const step = held(f, 2) % 12;
    for (let i = 0; i < 9; i++) {
      const t = i - step / 12 + 0.0;
      const y = 150 - t * 15;
      const x = 6 + t * 6;
      if (y < 0 || y > H) continue;
      rect(c, x, y, W - x * 2 + 8, 2);
      rect(c, x, y + 2, 2, 11);
    }
    const slope = (x) => 150 - x * 1.1;
    for (let x = 4; x < 70; x += 2) px(c, x, slope(x) - 38 + ((held(f, 3) % 6) ? 1 : 0)); // the rail
    for (let x = 8; x < 70; x += 10) line(c, x, slope(x) - 38, x, slope(x) - 14);
    dither(c, 50, 10, 24, 50, held(f, 2)); // a bad light
  },

  // The propped door at the end of the hall, a stripe of light, and a hymn
  // leaving it a little off-key (the notes drift up and wobble on threes).
  hallway(c, f) {
    line(c, 0, 20, 26, 60); line(c, W, 20, 52, 60); line(c, 0, 148, 26, 112); line(c, W, 148, 52, 112);
    rect(c, 26, 60, 26, 52);
    c.fillStyle = '#000';
    rect(c, 28, 62, 22, 48);
    c.fillStyle = '#fff';
    rect(c, 38, 62, 12, 48); // the door, ajar
    dither(c, 28, 62, 10, 48, 0);
    const spill = 4 + Math.round(Math.abs(wave(f, 4)) * 3);
    for (let y = 112; y < H; y += 3) rect(c, 26 - spill, y, 26 + spill * 2, 1);
    for (let n = 0; n < 3; n++) {
      const t = ((held(f, 2) + n * 4) % 12) / 12;
      const nx = 32 + n * 8 + Math.round(wave(f + n * 3, 3) * 3);
      const ny = 56 - t * 46;
      if (ny < 4) continue;
      disc(c, nx, ny + 4, 2); line(c, nx + 2, ny + 4, nx + 2, ny - 4); line(c, nx + 2, ny - 4, nx + 5, ny - 2);
    }
  },

  // FEELZ goes dark: a phone-shaped nothing, the lake still moving in it.
  dark(c, f) {
    rect(c, 18, 36, 42, 84);
    c.fillStyle = '#000';
    rect(c, 21, 40, 36, 74);
    c.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const y = 100 + i * 2;
      const sh = Math.round(wave(f + i, 2) * 2);
      rect(c, 24 + sh, y, 30 - i * 2, 1);
    }
    if (held(f, 4) % 8 === 0) rect(c, 30, 70, 18, 2); // the last scan line of the screen
    disc(c, 39, 124, 1);
  },
};

export const KEYS = Object.keys(MOTIFS);

// `key` is one motif, or a list that cuts between them every CUT_FRAMES
// frames (a beat that names three things gets three pictures, hard-cut).
const CUT_FRAMES = 14;

function buildSheet(key) {
  const motif = MOTIFS[key] ?? MOTIFS.lake;
  const cell = document.createElement('canvas');
  cell.width = W;
  cell.height = H;
  const c = cell.getContext('2d');
  // The 12 frames are drawn once and replayed: a loop on film, not a render.
  const sheet = [];
  for (let f = 0; f < FRAMES; f++) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    motif(c, f);
    const grain = rng(f * 977 + key.length * 31);
    for (let i = 0; i < 70; i++) { c.fillStyle = grain() < 0.5 ? '#fff' : '#000'; c.fillRect((grain() * W) | 0, (grain() * H) | 0, 1, 1); }
    if (f === 5) { // the splice: one frame inverted
      const img = c.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) { const v = 255 - img.data[i]; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; }
      c.putImageData(img, 0, 0);
    }
    const copy = document.createElement('canvas');
    copy.width = W;
    copy.height = H;
    copy.getContext('2d').drawImage(cell, 0, 0);
    sheet.push(copy);
  }
  return sheet;
}

export function createStopMotion(keys, { fps = FPS } = {}) {
  const list = (Array.isArray(keys) ? keys : [keys]).map((k) => (MOTIFS[k] ? k : 'lake'));
  const canvas = document.createElement('canvas');
  canvas.className = 'dx-cutscene-bg dx-stopmotion';
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext('2d');
  out.imageSmoothingEnabled = false;
  const sheets = list.map(buildSheet);

  let frame = 0;
  let tick = 0;
  function show() {
    const sheet = sheets[Math.floor(tick / CUT_FRAMES) % sheets.length];
    const weave = rng(tick * 131 + 7);
    const dx = Math.round((weave() - 0.5) * 3);
    const dy = Math.round((weave() - 0.5) * 3);
    out.fillStyle = '#000';
    out.fillRect(0, 0, W, H);
    out.drawImage(sheet[frame], dx, dy);
  }
  show();

  // Timer, not rAF: the frame holds for 1/fps whatever the display does.
  // A paused game (a phone held sideways) holds the frame it is on.
  const timer = setInterval(() => {
    if (isPaused()) return;
    tick += 1;
    frame = tick % FRAMES;
    show();
  }, 1000 / fps);

  return {
    el: canvas,
    get frame() { return frame; },
    destroy() { clearInterval(timer); },
  };
}
