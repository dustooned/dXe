// A real oscilloscope, not a decorative animation guessing at one — two
// overlaid traces, each a genuine reading of one side of the encounter,
// not two pieces of the same decoration:
//
//  - NPC trace: shell/audio.js's shared AnalyserNode (tapped off
//    masterGain) via getByteTimeDomainData() — whatever's actually
//    playing (this NPC's leitmotif, already reactive to trust+stability
//    via its fifths bend; the confrontation chord when it's struck) at
//    that instant. How legible it's drawn is the chord's own dissonance:
//    a harmonized chord is clean, an unresolved one blurs and splits. The
//    waveform also genuinely simplifies as voices converge on unison —
//    fewer beating frequencies — so the visual resolves because the sound
//    did, not because it's told to.
//  - Player trace: not audio — integrity + lucidity (the two meters about
//    the player's own honesty, not the NPC's feelings) synthesized into a
//    wave using the same instrument's language: high clarity draws a
//    clean, smooth line; low clarity draws it visibly noisy and jittery.
//    A noisy trace reading as "something's wrong" is how a real
//    oscilloscope already works — this borrows that meaning rather than
//    inventing a new visual metaphor.
//
// The two traces actually interact rather than just sharing a canvas (see
// `coherence` in drawPlayerTrace): real beat-interference between their
// frequencies, and a partial color blend, both driven by the *worse* of
// the NPC's consonance and the player's own clarity — one side falling
// apart is enough to break the picture even if the other looks fine. This
// stays a drawing-parameter effect, not real signal mixing — the player
// trace is deliberately not audio, and staying that way means a purely
// visual response never has to justify an actually-audible change to the
// real mix just to represent it.
//
// Deliberately NOT Truth Debt — that already has its own readout (the
// DEBT counter); folding it in here would blur two clean axes into three
// competing for the same line. First use: confrontation cutscenes'
// otherwise-empty background (scenes/cutsceneScene.js).
import { getAnalyser, getDissonance } from '../shell/audio.js';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRgb(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

// Same red the NPC trace itself clashes into when dissonant (see
// drawNpcTrace) — a bad moment reads as one consistent color language
// across both traces rather than two separate effects.
const CLASH_RGB = [255, 64, 64];
// How far the player trace's own color can drift toward either pole.
// Capped well under 1 so it stays a distinct second signal even at the
// extremes, never literally becoming the NPC's color or pure alarm-red.
const MAX_COLOR_BLEND = 0.4;

// Connection (dialogScene.js's getConnection): the two lines start apart —
// theirs above, yours below — and close the gap as the person comes to
// trust you; when they do, the lines merge into one. A miss pushes them
// back apart. The gap eases toward its target so a change reads as motion.
// Your line wears the feeling you're holding (getPlayerColor), and a strip
// along the bottom keeps one block per answer in this encounter
// (getHistory), so the spread of feelings you lean on stays visible.
// Shut out: your line goes grey and theirs flatlines.
const MAX_GAP_RATIO = 0.24;
const GAP_EASE = 0.08;
const HISTORY_MAX = 10;

export function createOscilloscope(
  canvas,
  {
    npcColor = '#ffffff', playerColor = '#4fd6ff', lineWidth = 2, getPlayerStats, isSynced, getDrama,
    getConnection, getPlayerColor, getHistory,
  } = {}
) {
  let gapNow = null;
  // The battle beats (dialogScene.js's `drama`), read every frame so they
  // survive the scene rebuilding this canvas between stages:
  //   tension   0..1, the wind-up: the NPC wave grows as their line types
  //   color     { from, to, t0 }: the NPC's mood color, easing to the next
  //   shock     { t0, strength, color }: the impact ring when they react
  //   ripple    { t0 }: gold ring when the player turned toward a bid
  //   mismatch  a feeling is picked that isn't theirs: the lines grind
  let npcColorNow = npcColor;
  const COLOR_EASE_MS = 450;
  const SHOCK_MS = 700;
  const RIPPLE_MS = 1100;
  const analyser = getAnalyser();
  const bufferLength = analyser.fftSize;
  const data = new Uint8Array(bufferLength);
  const ctx2d = canvas.getContext('2d');
  let rafId = null;

  // Checked every frame rather than once at setup — the canvas is created
  // and this is called before its parent is attached to the document
  // (cutsceneScene.js builds the whole beat off-DOM, then appends it in
  // one shot), so clientWidth/Height would read 0 at setup time and the
  // canvas would keep a permanently-empty pixel buffer forever after
  // (found live: it worked in every local test only because a window
  // resize during testing happened to trigger a correction). Cheap layout
  // read; only writes canvas.width/height (which resets the bitmap) when
  // the size actually changed.
  function syncSize() {
    if (canvas.width !== canvas.clientWidth) canvas.width = canvas.clientWidth;
    if (canvas.height !== canvas.clientHeight) canvas.height = canvas.clientHeight;
  }

  // How far out of tune the confrontation chord currently is decides how
  // readable this trace is: a harmonized chord draws a clean line, a
  // dissonant one smears and splits until you can't parse it. Not a score —
  // the signal is just harder to see through, the way a detuned radio is.
  const MAX_BLUR_PX = 4;
  const MAX_SPLIT_PX = 6;
  const SPLIT_THRESHOLD = 0.5;

  let ampScale = 1;

  let npcMid = 0.5;
  let npcFlat = 1;
  function traceNpcPath(w, h, xOffset) {
    ctx2d.beginPath();
    const sliceWidth = w / bufferLength;
    let x = xOffset;
    const reach = h * 0.34;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128; // 0..2, 1.0 = silence (midline)
      const y = h * npcMid + clamp(((v - 1) * h * ampScale * npcFlat) / 2, -reach, reach);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
  }

  function drawNpcTrace(w, h, rawDissonance) {
    analyser.getByteTimeDomainData(data);
    const dissonance = clamp(rawDissonance, 0, 1);

    ctx2d.lineWidth = lineWidth;
    ctx2d.filter = dissonance > 0 ? `blur(${dissonance * MAX_BLUR_PX}px)` : 'none';

    // Channels pull apart only once the chord is genuinely unresolved, so
    // the neutral opening still reads as a single clean signal.
    if (dissonance > SPLIT_THRESHOLD) {
      const split = ((dissonance - SPLIT_THRESHOLD) / (1 - SPLIT_THRESHOLD)) * MAX_SPLIT_PX;
      ctx2d.globalCompositeOperation = 'lighter';
      ctx2d.strokeStyle = 'rgba(255,64,64,0.55)';
      traceNpcPath(w, h, -split);
      ctx2d.strokeStyle = 'rgba(64,128,255,0.55)';
      traceNpcPath(w, h, split);
      ctx2d.globalCompositeOperation = 'source-over';
    }

    ctx2d.strokeStyle = npcFlat < 1 ? 'rgba(255,255,255,0.3)' : npcColorNow;
    traceNpcPath(w, h, 0);
    ctx2d.filter = 'none';
  }

  // Narrower amplitude band than the NPC trace on purpose — both traces
  // share the same canvas and midline (a real dual-trace scope overlays
  // channels rather than splitting the screen), so giving this one less
  // vertical room keeps it legible as a second, distinct signal instead
  // of just fighting the NPC trace for the same space.
  const PLAYER_AMPLITUDE_RATIO = 0.18;
  const PLAYER_STEPS = 120;
  const PLAYER_CYCLES = 3;
  // How many extra cycles the player trace detunes by at zero coherence.
  // PLAYER_CYCLES is a whole number, so at full coherence the wave repeats
  // identically every frame — visually locked. Detuning it away from that
  // integer means the spatial pattern no longer closes up the same way
  // frame to frame, so it appears to drift past the NPC trace's own shape
  // rather than holding a fixed relationship to it — the same broad
  // impression a real beat gives (two rates sliding in and out of
  // alignment), reached here by drawing-parameter drift rather than by
  // literally matching frequencies with the NPC's audio-derived line,
  // which runs on its own incommensurate sampling and timescale.
  const BEAT_DETUNE_CYCLES = 0.6;

  function drawPlayerTrace(w, h, timeMs, dissonance) {
    if (!getPlayerStats) return;
    const stats = getPlayerStats() ?? {};
    const integrity = stats.integrity ?? 0;
    const lucidity = stats.lucidity ?? 0;
    const clarity = clamp((integrity + lucidity) / 20, 0, 1); // 10+10 max

    // The NPC axis (trust+stability, via dissonance) and the player's own
    // axis (integrity+lucidity) are deliberately kept separate elsewhere —
    // this is the one place they're allowed to meet, and only as their
    // *worse* reading: one side genuinely falling apart should be able to
    // break the picture even while the other still looks fine.
    const consonance = 1 - clamp(dissonance, 0, 1);
    // Attunement (engine/trust.js): the player picked the feeling the NPC
    // is in. Their line locks on — clean, steady, and in the NPC's color —
    // the one moment the two signals are allowed to read as one.
    const synced = !!isSynced?.();
    const mismatch = !synced && !!getDrama?.()?.mismatch;
    // Wrong feeling picked: the lines grind — pushed out of phase, jittery.
    const coherence = synced ? 1 : mismatch ? Math.min(consonance, clarity, 0.15) : Math.min(consonance, clarity);

    const amplitude = h * (synced ? PLAYER_AMPLITUDE_RATIO * 1.6 : PLAYER_AMPLITUDE_RATIO);
    const noiseAmount = synced ? 0 : (mismatch ? 0.5 : 1 - clarity) * amplitude; // 0 at full clarity
    const wobble = synced ? 1 : 0.4 + clarity * 0.6; // steadier sine as clarity rises
    const cycles = PLAYER_CYCLES + (1 - coherence) * BEAT_DETUNE_CYCLES;

    const conn = getConnection?.() ?? {};
    const own = conn.shutOut ? '#5a5a5a' : (getPlayerColor?.() ?? playerColor);
    const target = coherence >= 0.5 ? hexToRgb(npcColorNow) : CLASH_RGB;
    const merged = !!conn.merged && !conn.shutOut;
    const blendT = conn.shutOut ? 0 : merged ? 0.5 : synced ? 0.6 : Math.abs(coherence - 0.5) * 2 * MAX_COLOR_BLEND;
    const [r, g, b] = lerpRgb(hexToRgb(own), target, blendT);

    const glow = synced || merged;
    ctx2d.lineWidth = glow ? lineWidth + 1 : lineWidth;
    ctx2d.shadowColor = glow ? `rgb(${r},${g},${b})` : 'transparent';
    ctx2d.shadowBlur = glow ? 8 : 0;
    const mid = h * (1 - npcMid);
    ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
    ctx2d.beginPath();
    for (let i = 0; i <= PLAYER_STEPS; i++) {
      const x = (i / PLAYER_STEPS) * w;
      const phase = (i / PLAYER_STEPS) * Math.PI * 2 * cycles + timeMs * 0.002;
      const noise = (Math.random() - 0.5) * noiseAmount;
      const y = mid + Math.sin(phase) * amplitude * wobble + noise;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;
  }

  function ring(w, h, t, rgb, maxWidth, alphaPeak) {
    const radius = t * Math.hypot(w, h) * 0.6;
    ctx2d.lineWidth = Math.max(1, maxWidth * (1 - t));
    ctx2d.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alphaPeak * (1 - t)})`;
    ctx2d.beginPath();
    ctx2d.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
    ctx2d.stroke();
  }

  function applyDrama(now) {
    const drama = getDrama?.();
    ampScale = 1 + clamp(drama?.tension ?? 0, 0, 1) * 0.9;
    const c = drama?.color;
    if (c?.to) {
      const t = clamp((now - (c.t0 ?? 0)) / COLOR_EASE_MS, 0, 1);
      const [r, g, b] = lerpRgb(hexToRgb(c.from ?? c.to), hexToRgb(c.to), t);
      npcColorNow = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    }
    return drama;
  }

  function drawRings(w, h, now, drama) {
    const shock = drama?.shock;
    if (shock) {
      const t = (now - shock.t0) / SHOCK_MS;
      if (t >= 0 && t < 1) {
        const rgb = hexToRgb(shock.color ?? npcColorNow);
        ring(w, h, t, rgb, 4 + shock.strength * 10, 0.9);
        if (shock.strength > 0.5) ring(w, h, clamp(t * 1.4, 0, 1), rgb, 3, 0.5);
      }
    }
    const ripple = drama?.ripple;
    if (ripple) {
      const t = (now - ripple.t0) / RIPPLE_MS;
      if (t >= 0 && t < 1) ring(w, h, t, [255, 201, 77], 6, 0.8);
    }
  }

  function updateGap() {
    const conn = getConnection?.();
    if (!conn) { npcMid = 0.5; npcFlat = 1; return; }
    const target = conn.merged ? 0 : (1 - clamp(conn.closeness ?? 0, 0, 1)) * MAX_GAP_RATIO;
    gapNow = gapNow === null ? target : gapNow + (target - gapNow) * GAP_EASE;
    npcMid = 0.5 - gapNow;
    npcFlat = conn.shutOut ? 0.04 : 1;
  }

  function drawHistory(w, h) {
    const picks = (getHistory?.() ?? []).slice(-HISTORY_MAX);
    if (!picks.length) return;
    // Chunky blocks, one per answer this encounter, newest outlined.
    const segW = Math.min(24, (w - 16) / HISTORY_MAX);
    const total = segW * picks.length;
    let x = (w - total) / 2;
    picks.forEach((color, i) => {
      const bx = Math.round(x) + 2;
      const bw = Math.max(2, Math.round(segW) - 4);
      ctx2d.fillStyle = color;
      ctx2d.fillRect(bx, h - 10, bw, 8);
      if (i === picks.length - 1) {
        ctx2d.strokeStyle = '#ffffff';
        ctx2d.lineWidth = 1;
        ctx2d.strokeRect(bx - 1.5, h - 11.5, bw + 3, 11);
      }
      x += segW;
    });
  }

  function draw(timeMs) {
    syncSize();
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    const now = performance.now();
    const drama = applyDrama(now);
    const dissonance = getDissonance();
    updateGap();
    drawNpcTrace(w, h, dissonance);
    drawPlayerTrace(w, h, timeMs, dissonance);
    drawRings(w, h, now, drama);
    drawHistory(w, h);
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
    },
  };
}
