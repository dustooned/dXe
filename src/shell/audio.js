// Audio system. Oscillator-based emotion stems and NPC leitmotifs coexist
// with real audio file playback — both share the same masterGain chain.
// All public functions that load files are async; callers fire-and-forget
// (no await needed unless they care about the exact start time).
let ctx = null;
let masterGain = null;
let stems = {};
let activeLeitmotif = null;
let ambientSource = null;
let ambientGain = null;

const audioCache = new Map();

const STEM_CONFIG = {
  Anger:        { type: 'sawtooth', freq: 110 },
  Fear:         { type: 'sine',     freq: 220 },
  Anticipation: { type: 'triangle', freq: 165 },
};

const AMBIENT_GAIN    = 0.06;
const EMPHASIS_GAIN   = 0.16;
const LEITMOTIF_GAIN  = 0.14;
const AMBIENT_MUSIC_GAIN = 0.07;
const TYAGL_GAIN      = 0.45;
const TYPEWRITER_GAIN = 0.28;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

const NOTE_SEMITONES = {
  C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6, E: -5, F: -4,
  'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1, A: 0, 'A#': 1, Bb: 1, B: 2,
};

export function noteToFrequency(note) {
  const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) throw new Error(`Bad note name: "${note}"`);
  const [, name, octaveStr] = match;
  const semitoneFromA4 = NOTE_SEMITONES[name] + (Number(octaveStr) - 4) * 12;
  return 440 * Math.pow(2, semitoneFromA4 / 12);
}

// NPC leitmotifs. A `url` entry plays a real audio file on loop; a `notes`
// entry plays the oscillator phrase on loop (existing behaviour).
const LEITMOTIFS = {
  THERAPIST: { url: '/assets/lake-ulysses/audio/heavens_waiting_room.mp3', volume: 0.10 },
  DEBORAH: {
    type: 'sine',
    notes: [
      { note: 'A3', durationMs: 700 },
      { note: 'G3', durationMs: 700 },
      { note: 'E3', durationMs: 900 },
      { note: 'D3', durationMs: 1100 },
    ],
  },
  RWANDA: {
    type: 'triangle',
    notes: [
      { note: 'E4', durationMs: 220 },
      { note: 'G4', durationMs: 160 },
      { note: 'A4', durationMs: 220 },
      { note: 'E4', durationMs: 300 },
      { note: 'B3', durationMs: 260 },
    ],
  },
  SAMUN: {
    type: 'square',
    notes: [
      { note: 'C3', durationMs: 260 },
      { note: 'C3', durationMs: 260 },
      { note: 'Eb3', durationMs: 260 },
      { note: 'C3', durationMs: 400 },
    ],
  },
  RICK: {
    type: 'sawtooth',
    notes: [
      { note: 'E2', durationMs: 500 },
      { note: 'A2', durationMs: 500 },
    ],
  },
};

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function loadAudio(url) {
  if (audioCache.has(url)) return audioCache.get(url);
  const audioCtx = ensureContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  audioCache.set(url, audioBuffer);
  return audioBuffer;
}

// ─── Ambient room music ───────────────────────────────────────────────────────
// One persistent looping track per scene. Call startAmbient when a scene
// mounts; stopAmbient when it unmounts. Fire-and-forget (async).

export async function startAmbient(url, volume = AMBIENT_MUSIC_GAIN) {
  stopAmbient();
  const audioCtx = ensureContext();
  const buffer = await loadAudio(url);
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = volume;
  ambientGain.connect(masterGain);
  ambientSource = audioCtx.createBufferSource();
  ambientSource.buffer = buffer;
  ambientSource.loop = true;
  ambientSource.connect(ambientGain);
  ambientSource.start();
}

export function stopAmbient() {
  try { ambientSource?.stop(); } catch (_) { /* already stopped */ }
  ambientSource = null;
  ambientGain?.disconnect();
  ambientGain = null;
}

// ─── One-shot SFX ─────────────────────────────────────────────────────────────

let typewriterBuffer = null;

export async function preloadTypewriterTick() {
  typewriterBuffer = await loadAudio('/assets/shared/audio/typewriter_tick.wav');
}

export function playTypewriterTick() {
  if (!typewriterBuffer || !ctx) return;
  const source = ctx.createBufferSource();
  source.buffer = typewriterBuffer;
  source.playbackRate.value = 0.88 + Math.random() * 0.24;
  const gain = ctx.createGain();
  gain.gain.value = TYPEWRITER_GAIN;
  source.connect(gain).connect(masterGain);
  source.start();
}

export async function playTyagl() {
  const audioCtx = ensureContext();
  const buffer = await loadAudio('/assets/shared/audio/tyagl.wav');
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = TYAGL_GAIN;
  source.connect(gain).connect(masterGain);
  source.start();
}

// ─── Emotion stems ────────────────────────────────────────────────────────────

export function startEmotionStems() {
  const audioCtx = ensureContext();
  for (const [key, cfg] of Object.entries(STEM_CONFIG)) {
    if (stems[key]) continue;
    const osc = audioCtx.createOscillator();
    osc.type = cfg.type;
    osc.frequency.value = cfg.freq;
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(masterGain);
    osc.start();
    stems[key] = { osc, gain };
  }
}

export function setEmotionMix(mix) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const [key, value] of Object.entries(mix)) {
    const stem = stems[key];
    if (!stem) continue;
    stem.gain.gain.linearRampToValueAtTime(clamp(value, 0, 1), now + 0.15);
  }
}

export function emphasizeEmotion(emotion) {
  const mix = {};
  for (const key of Object.keys(STEM_CONFIG)) {
    mix[key] = key === emotion ? EMPHASIS_GAIN : AMBIENT_GAIN * 0.5;
  }
  setEmotionMix(mix);
}

export function ambientMix() {
  const mix = {};
  for (const key of Object.keys(STEM_CONFIG)) mix[key] = AMBIENT_GAIN;
  setEmotionMix(mix);
}

export function stopEmotionStems() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const key of Object.keys(stems)) {
    const { osc, gain } = stems[key];
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.stop(now + 0.25);
  }
  stems = {};
}

// ─── NPC leitmotifs ───────────────────────────────────────────────────────────

export async function startLeitmotif(npcKey) {
  stopLeitmotif();
  const config = LEITMOTIFS[npcKey];
  if (!config) return;

  const audioCtx = ensureContext();

  if (config.url) {
    const buffer = await loadAudio(config.url);
    const gain = audioCtx.createGain();
    gain.gain.value = config.volume ?? LEITMOTIF_GAIN;
    gain.connect(masterGain);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    activeLeitmotif = {
      stop() {
        gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
        setTimeout(() => { try { source.stop(); } catch (_) {} gain.disconnect(); }, 400);
      },
    };
    return;
  }

  // Oscillator phrase loop (existing NPCs)
  const gain = audioCtx.createGain();
  gain.gain.value = LEITMOTIF_GAIN;
  gain.connect(masterGain);

  let index = 0;
  let stopped = false;
  let timer = null;

  function playNote() {
    if (stopped) return;
    const { note, durationMs } = config.notes[index];
    const osc = audioCtx.createOscillator();
    osc.type = config.type;
    osc.frequency.value = noteToFrequency(note);
    osc.connect(gain);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
    index = (index + 1) % config.notes.length;
    timer = setTimeout(playNote, durationMs);
  }

  playNote();

  activeLeitmotif = {
    stop() {
      stopped = true;
      clearTimeout(timer);
      gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
      setTimeout(() => gain.disconnect(), 200);
    },
  };
}

export function stopLeitmotif() {
  activeLeitmotif?.stop();
  activeLeitmotif = null;
}

// ─── TV static noise burst ────────────────────────────────────────────────────
// White noise filtered to RF-static frequencies. Safe to call fire-and-forget;
// the source stops automatically after durationMs.

export function playStaticNoise(durationMs = 480) {
  const audioCtx = ensureContext();
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const hpf = audioCtx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 1800;

  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const durSec = durationMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
  gain.gain.setValueAtTime(0.22, now + durSec - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + durSec);

  source.connect(hpf).connect(gain).connect(masterGain);
  source.start(now);
  source.stop(now + durSec + 0.1);
}

// ─── Hit feedback ─────────────────────────────────────────────────────────────

export function playHit(intensity = 'weak') {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const peak = intensity === 'strong' ? 0.3 : 0.15;
  const duration = intensity === 'strong' ? 0.35 : 0.18;

  osc.type = 'square';
  osc.frequency.value = intensity === 'strong' ? 90 : 220;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}
