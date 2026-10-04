// The opponent's weather: each person bends the battle screen a little in
// their own way — a visual seasoning, never in the way. Deborah's grief
// runs like wet ink, Rwanda paints over things, Samun's room sways like
// last call, Rick idles hot like an engine, and the Therapist is a bad
// video connection.
//
// Only their side gets it: the portrait, their words, the scope band and a
// light layer behind everything. The status bar, the lake gauge, the card,
// the wheel and the dock stay clean — information is always clear.
//
// How strong (dialogScene.js passes getLevel, 0..1): the battle's phase
// sets the ceiling and getting close calms it, so connecting feels like
// relief; picking their real feeling settles it for a beat; trust clears it.
// It breathes with whatever's playing (the master analyser), so it pulses
// on the music's beat. CSS does the per-element part (ui.css .dx-opfx--*,
// driven by --fx); a canvas behind the content does the particles.
import { getAnalyser } from '../shell/audio.js';

const MAX_ALPHA = 0.42; // the background layer never gets louder than this

function rand(a, b) { return a + Math.random() * (b - a); }

// One small particle system per opponent. Each: spawn(w, h) -> particle,
// step(p, dt, w, h, beat) -> alive?, draw(ctx, p, alpha).
const KINDS = {
  // Wet ink: thin rain streaks, and the odd drop sliding down slowly.
  DEBORAH: {
    rate: 26,
    spawn: (w) => ({ x: rand(0, w), y: rand(-40, -5), v: rand(160, 260), len: rand(8, 22), slow: Math.random() < 0.08 }),
    step: (p, dt, w, h) => { p.y += (p.slow ? 30 : p.v) * dt; return p.y < h + 30; },
    draw: (c, p, a) => {
      c.strokeStyle = `rgba(150,180,255,${a * (p.slow ? 0.9 : 0.55)})`;
      c.lineWidth = p.slow ? 2 : 1;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y + (p.slow ? p.len * 1.6 : p.len)); c.stroke();
    },
  },
  // Paint-over: wide translucent strokes wiping across, and drips from the top.
  RWANDA: {
    rate: 3.2,
    spawn: (w, h) => (Math.random() < 0.45
      ? { kind: 'stroke', x: -w * 0.6, y: rand(h * 0.08, h * 0.9), v: rand(90, 160), len: rand(w * 0.4, w * 0.7), th: rand(10, 26), hue: [255, 120, 60] }
      : { kind: 'drip', x: rand(0, w), y: -4, v: rand(14, 34), len: 0, th: rand(2, 4), hue: Math.random() < 0.5 ? [255, 120, 60] : [120, 90, 255] }),
    step: (p, dt, w, h) => {
      if (p.kind === 'stroke') { p.x += p.v * dt; return p.x < w + 20; }
      p.len += p.v * dt; return p.len < h * 0.45;
    },
    draw: (c, p, a) => {
      const [r, g, b] = p.hue;
      c.fillStyle = `rgba(${r},${g},${b},${a * 0.5})`;
      if (p.kind === 'stroke') c.fillRect(p.x, p.y, p.len, p.th);
      else { c.fillRect(p.x, 0, p.th, p.len); c.fillRect(p.x - 1, p.len, p.th + 2, p.th + 1); }
    },
  },
  // Last call: soft neon bokeh drifting, brighter on the beat.
  SAMUN: {
    rate: 4,
    spawn: (w, h) => ({ x: rand(0, w), y: rand(0, h), r: rand(6, 18), vx: rand(-8, 8), vy: rand(-6, 6), life: rand(3, 6), t: 0, hue: [[255, 60, 200], [60, 220, 255], [255, 210, 60]][Math.floor(Math.random() * 3)] }),
    step: (p, dt) => { p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; return p.t < p.life; },
    draw: (c, p, a, beat) => {
      const [r, g, b] = p.hue;
      const fade = Math.sin(Math.PI * (p.t / p.life));
      c.fillStyle = `rgba(${r},${g},${b},${a * 0.45 * fade * (0.6 + beat * 0.8)})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
    },
  },
  // Engine heat: shimmer lines rising, and a tear across on a hard beat.
  RICK: {
    rate: 10,
    spawn: (w, h) => ({ x: rand(0, w), y: h + 5, v: rand(30, 60), len: rand(12, 30), ph: rand(0, 6) }),
    step: (p, dt) => { p.y -= p.v * dt; p.ph += dt * 6; return p.y > -20; },
    draw: (c, p, a) => {
      c.strokeStyle = `rgba(255,90,40,${a * 0.5})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i <= 6; i++) {
        const x = p.x + Math.sin(p.ph + i) * 2;
        const y = p.y + (i / 6) * p.len;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    },
    onBeat: (c, w, h, a) => {
      const y = rand(h * 0.1, h * 0.9);
      c.fillStyle = `rgba(255,70,40,${a * 0.6})`;
      c.fillRect(0, y, w, rand(1, 3));
    },
  },
  // Bad connection: a few blocky compression squares that blink in and out.
  THERAPIST: {
    rate: 5,
    spawn: (w, h) => ({ x: Math.floor(rand(0, w) / 8) * 8, y: Math.floor(rand(0, h) / 8) * 8, s: 8 * Math.ceil(rand(1, 3)), t: 0, life: rand(0.15, 0.5) }),
    step: (p, dt) => { p.t += dt; return p.t < p.life; },
    draw: (c, p, a) => {
      c.fillStyle = `rgba(170,180,190,${a * 0.35})`;
      c.fillRect(p.x, p.y, p.s, p.s);
    },
  },
};

export function createOpponentFx({ npc, getLevel }) {
  const kind = KINDS[npc];
  const canvas = document.createElement('canvas');
  canvas.className = 'dx-opfx';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const analyser = getAnalyser();
  const buf = new Uint8Array(analyser.fftSize);
  let screen = null;
  let parts = [];
  let owed = 0;
  let last = performance.now();
  let level = 0;
  let pulse = 0;
  let lastBeat = 0;
  let raf = 0;

  // How loud the mix is right now (0..1-ish), for the beat.
  function loudness() {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 4) { const v = (buf[i] - 128) / 128; sum += v * v; }
    return Math.sqrt(sum / (buf.length / 4));
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    level += ((getLevel?.() ?? 0) - level) * Math.min(1, dt * 2.5); // ease, never snap
    const rms = loudness();
    const hit = Math.max(0, Math.min(1, (rms - 0.03) * 9));
    pulse = Math.max(hit, pulse - dt * 3);
    const strength = level * (0.85 + 0.3 * pulse);
    if (screen) {
      screen.style.setProperty('--fx', (reduced ? strength * 0.5 : strength).toFixed(3));
    }
    if (!kind || !screen) return;
    const r = screen.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    if (reduced || strength < 0.02) { parts = []; return; }
    owed += kind.rate * strength * dt;
    while (owed >= 1 && parts.length < 90) { parts.push(kind.spawn(w, h)); owed -= 1; }
    const a = MAX_ALPHA * strength;
    parts = parts.filter((p) => kind.step(p, dt, w, h, pulse));
    for (const p of parts) kind.draw(ctx, p, a, pulse);
    if (kind.onBeat && hit > 0.75 && now - lastBeat > 380) { lastBeat = now; kind.onBeat(ctx, w, h, a); }
  }
  raf = requestAnimationFrame(frame);

  return {
    // The dialog screen is rebuilt every render: hang the layer and the
    // opponent's class on the new one (behind the content, under the scope).
    attach(screenEl) {
      screen = screenEl;
      screen.classList.add('dx-opfx-on', `dx-opfx--${String(npc).toLowerCase()}`);
      screen.style.setProperty('--fx', (level * 0.85).toFixed(3));
      screen.prepend(canvas);
    },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
