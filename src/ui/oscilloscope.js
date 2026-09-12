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
// Deliberately NOT Truth Debt — that already has its own readout (the
// DEBT counter); folding it in here would blur two clean axes into three
// competing for the same line. First use: confrontation cutscenes'
// otherwise-empty background (scenes/cutsceneScene.js).
import { getAnalyser, getDissonance } from '../shell/audio.js';

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function createOscilloscope(
  canvas,
  { npcColor = '#ffffff', playerColor = '#4fd6ff', lineWidth = 2, getPlayerStats } = {}
) {
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

  function traceNpcPath(w, h, xOffset) {
    ctx2d.beginPath();
    const sliceWidth = w / bufferLength;
    let x = xOffset;
    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128; // 0..2, 1.0 = silence (midline)
      const y = (v * h) / 2;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
  }

  function drawNpcTrace(w, h) {
    analyser.getByteTimeDomainData(data);
    const dissonance = clamp(getDissonance(), 0, 1);

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

    ctx2d.strokeStyle = npcColor;
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

  function drawPlayerTrace(w, h, timeMs) {
    if (!getPlayerStats) return;
    const stats = getPlayerStats() ?? {};
    const integrity = stats.integrity ?? 0;
    const lucidity = stats.lucidity ?? 0;
    const clarity = clamp((integrity + lucidity) / 20, 0, 1); // 10+10 max

    const amplitude = h * PLAYER_AMPLITUDE_RATIO;
    const noiseAmount = (1 - clarity) * amplitude; // 0 at full clarity
    const wobble = 0.4 + clarity * 0.6; // steadier sine as clarity rises

    ctx2d.lineWidth = lineWidth;
    ctx2d.strokeStyle = playerColor;
    ctx2d.beginPath();
    for (let i = 0; i <= PLAYER_STEPS; i++) {
      const x = (i / PLAYER_STEPS) * w;
      const phase = (i / PLAYER_STEPS) * Math.PI * 2 * PLAYER_CYCLES + timeMs * 0.002;
      const noise = (Math.random() - 0.5) * noiseAmount;
      const y = h / 2 + Math.sin(phase) * amplitude * wobble + noise;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
  }

  function draw(timeMs) {
    syncSize();
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    drawNpcTrace(w, h);
    drawPlayerTrace(w, h, timeMs);
    rafId = requestAnimationFrame(draw);
  }
  rafId = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
    },
  };
}
