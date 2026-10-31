// PLACEHOLDER music for the FEELZ feed's channels, synthesized until real
// tracks exist (docs/MUSIC_PIPELINE.md: the OST is FL stems; these are
// stand-ins). Each channel has a loop and a "playback device" it's heard
// through, because in the fiction you're hearing it through someone's phone:
//
//   fixes   Samun: 60s lowrider soul (I-vi-ii-V, electric piano, walking
//           bass, brushed drums; think "Oh Honey") on a crappy radio, muffled,
//           with static
//   grade   the documentary: dark, icy, unsolved-mysteries (a minor pad,
//           struck bells that ring out, an echo)
//   wall    Rwanda: cheap MIDI pop on a little Bluetooth speaker from her
//           earphones (square waves, clipping, the odd dropout)
//   pastor  the Living Water Hour: Funky Lantern (recording), TV speaker
//   barlot  a phone video outside the bar: bass through the wall, the crowd
//   ad      the FEELZ ad: a bright corporate marimba jingle
//
// Bob's channel has none (the lake ambience under the whole feed is his).
// Levels were set by ear against a meter: about the dialogue's typing level
// (rms ~0.008 at the default volume), the bar lot's bass under it.
// Everything goes into the game's master output (shell/audio.js
// getAudioGraph), so volume, mute and the sideways pause apply. Notes are
// scheduled on the audio clock a little ahead, never by timers alone.
import { getAudioGraph, loadAudio } from './audio.js';

const LOOKAHEAD = 0.25;
const TICK_MS = 60;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

let current = null;

// ── The playback devices ────────────────────────────────────────────────────
function shaper(ctx, amount) {
  const ws = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  ws.curve = curve;
  return ws;
}
function noiseBuffer(ctx, sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// A bed of noise (radio static, a crowd), band-limited, looping.
function noiseBed(ctx, dest, { freq, q = 0.7, gain }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(dest);
  src.start();
  return src;
}

// Input -> device -> out. Returns { input, stop }.
function device(ctx, out, kind) {
  const input = ctx.createGain();
  const level = ctx.createGain();
  const nodes = [];
  let chain = input;
  const add = (node) => { chain.connect(node); chain = node; nodes.push(node); return node; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return add(b); };
  const extras = [];
  if (kind === 'radio') {           // a car / shop radio, AM-ish
    filt('highpass', 320);
    filt('lowpass', 2100, 1.2);
    add(shaper(ctx, 2.2));
    level.gain.value = 0.55;
    extras.push(noiseBed(ctx, level, { freq: 3200, q: 0.5, gain: 0.05 }));
  } else if (kind === 'tv') {       // a TV in the next room
    filt('highpass', 160);
    filt('lowpass', 3600);
    level.gain.value = 0.55;
  } else if (kind === 'speaker') {  // a tiny Bluetooth speaker
    filt('highpass', 750, 1.4);
    filt('lowpass', 4800);
    add(shaper(ctx, 4));
    level.gain.value = 0.38;
  } else if (kind === 'wall') {     // through the bar wall, on a phone mic
    filt('lowpass', 280, 1.1);
    add(shaper(ctx, 1.6));
    level.gain.value = 0.14;
    extras.push(noiseBed(ctx, level, { freq: 900, q: 0.4, gain: 0.05 }));
  } else if (kind === 'echo') {     // clean, with a cold feedback echo
    const d = ctx.createDelay(1);
    d.delayTime.value = 0.43;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    input.connect(d).connect(tone).connect(fb).connect(d);
    tone.connect(level);
    level.gain.value = 0.45;
  } else {                          // 'clean'
    level.gain.value = 0.4;
  }
  chain.connect(level);
  level.connect(out);
  // Fade in.
  const g = level.gain.value;
  level.gain.setValueAtTime(0.0001, ctx.currentTime);
  level.gain.linearRampToValueAtTime(g, ctx.currentTime + 0.6);
  return {
    input,
    level,
    base: g,
    stop() {
      const t = ctx.currentTime;
      level.gain.cancelScheduledValues(t);
      level.gain.setValueAtTime(level.gain.value, t);
      level.gain.linearRampToValueAtTime(0.0001, t + 0.25);
      setTimeout(() => { extras.forEach((s) => { try { s.stop(); } catch { /* gone */ } }); level.disconnect(); }, 400);
    },
  };
}

// ── Voices: one struck note each (struck-and-ringing, never a held drone
// unless it's the pad) ───────────────────────────────────────────────────────
function tone(ctx, dest, t, { f, type = 'sine', dur = 0.4, gain = 0.3, attack = 0.005, detune = 0 }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function epiano(ctx, dest, t, n, dur, gain = 0.12) {
  tone(ctx, dest, t, { f: midi(n), dur, gain, attack: 0.01 });
  tone(ctx, dest, t, { f: midi(n + 12), dur: dur * 0.5, gain: gain * 0.3, attack: 0.004 });
}
function kick(ctx, dest, t, gain = 0.5) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.3);
}
function hiss(ctx, dest, t, { dur = 0.08, freq = 6000, gain = 0.08, buf }) {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(dest);
  s.start(t, Math.random());
  s.stop(t + dur + 0.02);
}

// ── The loops: bpm, steps per bar, bars, and what plays on each 8th ────────
// step(i) gets the 8th-note index in the loop and its time.
const SONGS = {
  // Samun: I-vi-ii-V in D, 84 bpm, swung a little. Rhodes on 1 and the "and"
  // of 2, bass walking, brushes.
  fixes: {
    device: 'radio', bpm: 84, bars: 4,
    play(ctx, d, t, i, step, buf) {
      const chords = [[62, 66, 69, 73], [59, 62, 66, 69], [64, 67, 71, 74], [57, 61, 64, 67]];
      const roots = [38, 35, 40, 33];
      const bar = Math.floor(i / 8) % 4;
      const s = i % 8;
      const swing = s % 2 ? step * 0.18 : 0;
      if (s === 0 || s === 3) chords[bar].forEach((n) => epiano(ctx, d, t + swing, n, 1.1, 0.07));
      if (s % 2 === 0) tone(ctx, d, t, { f: midi(roots[bar] + [0, 7, 12, 10][s / 2]), type: 'triangle', dur: 0.35, gain: 0.32 });
      if (s === 0 || s === 4) kick(ctx, d, t, 0.35);
      if (s === 2 || s === 6) hiss(ctx, d, t, { dur: 0.16, freq: 2400, gain: 0.16, buf });
      hiss(ctx, d, t + swing, { dur: 0.04, freq: 7000, gain: 0.05, buf });
    },
  },
  // The documentary: A minor, 70 bpm. A soft pad per bar, an icy bell
  // arpeggio struck and left to ring, a low boom every 4 bars.
  grade: {
    device: 'echo', bpm: 70, bars: 4,
    play(ctx, d, t, i, step) {
      const pads = [[57, 60, 64], [53, 57, 60, 64], [50, 53, 57], [52, 56, 59]];
      const bells = [[81, 76, 84, 83], [77, 81, 84, 79], [74, 77, 81, 76], [76, 80, 83, 88]];
      const bar = Math.floor(i / 8) % 4;
      const s = i % 8;
      if (s === 0) pads[bar].forEach((n) => tone(ctx, d, t, { f: midi(n), type: 'sawtooth', dur: step * 8.5, gain: 0.025, attack: 1.2, detune: (n % 3) * 6 - 6 }));
      if (s % 2 === 0) tone(ctx, d, t, { f: midi(bells[bar][s / 2]), dur: 2.2, gain: 0.09 });
      if (i === 0) tone(ctx, d, t, { f: 41, dur: 3, gain: 0.3, attack: 0.02 });
    },
  },
  // Rwanda: cheap MIDI pop in C, 112 bpm, square lead and bass, a tick hat;
  // the speaker drops out for a beat now and then.
  wall: {
    device: 'speaker', bpm: 112, bars: 4,
    play(ctx, d, t, i, step, buf, dev) {
      const lead = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 83, 81, 79, 76, null,
        77, 81, 84, 81, 77, 76, 74, 76, 79, 76, 74, 72, 74, 72, null, null];
      const roots = [36, 41, 43, 36];
      const bar = Math.floor(i / 8) % 4;
      const s = i % 8;
      const n = lead[i % 32];
      if (n) tone(ctx, d, t, { f: midi(n), type: 'square', dur: step * 0.9, gain: 0.07 });
      if (s % 2 === 0) tone(ctx, d, t, { f: midi(roots[bar]), type: 'square', dur: step * 1.6, gain: 0.08 });
      hiss(ctx, d, t, { dur: 0.03, freq: 8000, gain: 0.05, buf });
      if (Math.random() < 0.025) {
        dev.level.gain.setValueAtTime(0.0001, t);
        dev.level.gain.setValueAtTime(dev.base, t + step * 2);
      }
    },
  },
  // The Living Water Hour, the Reverend's channel: the artist's "Funky Lantern"
  // through the TV speaker. A `file` song plays the recording and ignores
  // `play`; the hymn below is kept as the old placeholder (silence if the file
  // can't load).
  pastor: {
    device: 'tv', file: '/assets/lake-ulysses/audio/funky_lantern.mp3', bpm: 76, bars: 4,
    play(ctx, d, t, i, step) {
      const chords = [[60, 64, 67], [65, 69, 72], [60, 64, 67], [55, 59, 62, 67]];
      const s = i % 8;
      const bar = Math.floor(i / 8) % 4;
      if (s === 0 || s === 4) chords[bar].forEach((n) => {
        tone(ctx, d, t, { f: midi(n), type: 'sine', dur: step * 4, gain: 0.07, attack: 0.04 });
        tone(ctx, d, t, { f: midi(n + 12), type: 'square', dur: step * 3.5, gain: 0.012, attack: 0.04 });
      });
      if (s === 0) tone(ctx, d, t, { f: midi(chords[bar][0] - 24), dur: step * 7, gain: 0.12, attack: 0.05 });
    },
  },
  // Outside the bar: four on the floor and a bass line, through the wall.
  barlot: {
    device: 'wall', bpm: 120, bars: 2,
    play(ctx, d, t, i, step) {
      const s = i % 8;
      if (s % 2 === 0) kick(ctx, d, t, 0.6);
      const bass = [40, 40, 43, 40, 45, 43, 40, 38];
      tone(ctx, d, t, { f: midi(bass[i % 8]), type: 'sawtooth', dur: step * 0.8, gain: 0.12 });
    },
  },
  // The FEELZ ad: a bright marimba jingle in F, 100 bpm.
  ad: {
    device: 'clean', bpm: 100, bars: 2,
    play(ctx, d, t, i, step) {
      const mel = [65, 69, 72, 77, 76, 72, 69, 72, 74, 77, 81, 79, 77, 72, 74, 77];
      tone(ctx, d, t, { f: midi(mel[i % 16]), dur: 0.35, gain: 0.12 });
      tone(ctx, d, t, { f: midi(mel[i % 16] + 24), dur: 0.12, gain: 0.03 });
      if (i % 4 === 0) tone(ctx, d, t, { f: midi([41, 46, 48, 41][Math.floor(i / 4) % 4]), dur: 0.5, gain: 0.14 });
    },
  },
};

export const CHANNEL_SONGS = Object.keys(SONGS);

// Start a channel's loop (stops the one before). Unknown id: silence.
export function playChannelMusic(id) {
  stopChannelMusic();
  const song = SONGS[id];
  if (!song) return;
  const { ctx, out } = getAudioGraph();
  const dev = device(ctx, out, song.device);
  if (song.file) {
    const mine = { id, dev, timer: null, src: null };
    current = mine;
    loadAudio(song.file).then((buffer) => {
      if (current !== mine) return; // left the channel while it loaded
      mine.src = fileLoop(ctx, dev, buffer);
    });
    return;
  }
  const buf = noiseBuffer(ctx, 1);
  const step = 60 / song.bpm / 2; // an 8th note
  const total = song.bars * 8;
  let i = 0;
  let next = ctx.currentTime + 0.05;
  const timer = setInterval(() => {
    // A throttled tab fell behind: pick up from now, don't play the backlog.
    if (next < ctx.currentTime - 0.1) next = ctx.currentTime + 0.02;
    while (next < ctx.currentTime + LOOKAHEAD) {
      song.play(ctx, dev.input, next, i % total, step, buf, dev);
      i += 1;
      next += step;
    }
  }, TICK_MS);
  current = { id, dev, timer };
}

// A recorded track, looped, scaled to the level the synth channels sit at
// (rms ~0.01 into the device) so a hot master doesn't shout over the dialogue.
const TARGET_RMS = 0.01;
function fileLoop(ctx, dev, buffer) {
  const d = buffer.getChannelData(0);
  let sum = 0;
  const stride = 8;
  for (let i = 0; i < d.length; i += stride) sum += d[i] * d[i];
  const rms = Math.sqrt(sum / Math.ceil(d.length / stride)) || TARGET_RMS;
  const g = ctx.createGain();
  g.gain.value = Math.min(TARGET_RMS / rms, 4);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(g).connect(dev.input);
  src.start();
  return src;
}

export function stopChannelMusic() {
  if (!current) return;
  clearInterval(current.timer);
  try { current.src?.stop(); } catch { /* not started */ }
  current.dev.stop();
  current = null;
}
