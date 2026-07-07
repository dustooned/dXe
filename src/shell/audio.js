// Global audio: three "emotion stem" drones that crossfade based on what
// the player is leaning toward, plus one-shot hit sounds. Placeholder
// oscillator tones stand in for real instrumental loops — swap the
// oscillator setup for real AudioBuffer loops later; the mix/crossfade
// API below doesn't need to change.
let ctx = null;
let masterGain = null;
let stems = {};
let activeLeitmotif = null;

const STEM_CONFIG = {
  Anger: { type: 'sawtooth', freq: 110 },
  Fear: { type: 'sine', freq: 220 },
  Anticipation: { type: 'triangle', freq: 165 },
};

const AMBIENT_GAIN = 0.06;
const EMPHASIS_GAIN = 0.16;
const LEITMOTIF_GAIN = 0.14;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// Note name ("A3", "C#4", "Bb2") -> frequency, standard equal temperament,
// A4 = 440Hz. No MIDI files, no dependencies — just the math every
// chiptune toy uses.
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

// Each NPC's musical signature — a short hardcoded phrase, not a real
// instrumental loop. Swap for real AudioBuffer loops later; the
// start/stop API below doesn't need to change.
const LEITMOTIFS = {
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

// mix: { Anger, Fear, Anticipation } each 0-1. Ramps, never hard-cuts.
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

// Plays one NPC's melodic signature on a loop, layered on top of the
// emotion stems. One per encounter — call once when an NPC's scene
// mounts, not per dialog node.
export function startLeitmotif(npcKey) {
  stopLeitmotif();
  const config = LEITMOTIFS[npcKey];
  if (!config) return;

  const audioCtx = ensureContext();
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
