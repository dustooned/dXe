// Global audio: three "emotion stem" drones that crossfade based on what
// the player is leaning toward, plus one-shot hit sounds. Placeholder
// oscillator tones stand in for real instrumental loops — swap the
// oscillator setup for real AudioBuffer loops later; the mix/crossfade
// API below doesn't need to change.
let ctx = null;
let masterGain = null;
let stems = {};

const STEM_CONFIG = {
  Anger: { type: 'sawtooth', freq: 110 },
  Fear: { type: 'sine', freq: 220 },
  Anticipation: { type: 'triangle', freq: 165 },
};

const AMBIENT_GAIN = 0.06;
const EMPHASIS_GAIN = 0.16;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

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
