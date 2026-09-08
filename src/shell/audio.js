// Audio system. Oscillator-based emotion stems and NPC leitmotifs coexist
// with real audio file playback — both share the same masterGain chain.
// All public functions that load files are async; callers fire-and-forget
// (no await needed unless they care about the exact start time).
//
// Because they're fire-and-forget, every start/stop pair here is guarded by a
// generation counter: a scene that unmounts while its track is still loading
// would otherwise have nothing to stop, and the track would then start *after*
// the stop and loop forever with no handle left to kill it. Each stop bumps the
// generation; each start re-checks it after its await and bails if it's stale.
//
// A known simplification: LEITMOTIFS below is hardcoded per-NPC-name rather
// than loaded per-chapter, same as the rest of this file — there's only one
// chapter so far. Revisit if a second chapter ever needs its own NPCs here.
import leitmotifNotes from '../chapters/lake-ulysses/content/leitmotifs.json';

let ctx = null;
let masterGain = null;
let stems = {};
let activeLeitmotif = null;
let ambientSource = null;
let ambientGain = null;
let titleSources = [];

let ambientGeneration = 0;
let leitmotifGeneration = 0;
let titleMusicGeneration = 0;

const audioCache = new Map();

// One oscillator config per Plutchik emotion (engine/loadout.js's EMOTIONS) —
// every class's 3 loaded emotions need a stem here or picking one plays
// nothing (see docs/HANDOFF.md's "known gaps": Bible/Crystals had no audio
// until Trust/Disgust/Joy/Sadness/Surprise were added below).
const STEM_CONFIG = {
  Anger:        { type: 'sawtooth', freq: 110 },
  Fear:         { type: 'sine',     freq: 220 },
  Anticipation: { type: 'triangle', freq: 165 },
  Trust:        { type: 'sine',     freq: 196 },
  Disgust:      { type: 'sawtooth', freq: 130 },
  Joy:          { type: 'triangle', freq: 330 },
  Sadness:      { type: 'sine',     freq: 147 },
  Surprise:     { type: 'square',   freq: 250 },
};

const AMBIENT_GAIN       = 0.06;
const EMPHASIS_GAIN      = 0.16;
const LEITMOTIF_GAIN     = 0.14;
const AMBIENT_MUSIC_GAIN = 0.07;
const TYAGL_GAIN         = 0.45;
const IT_STING_GAIN      = 0.45;
const TYPEWRITER_GAIN    = 0.28;
const TITLE_MUSIC_GAIN   = 0.13;
const START_JINGLE_GAIN  = 0.75;

// Fifths-hop clamp for leitmotif mood — see nudgeLeitmotifMood. 6 hops is
// the tritone, the most dissonant a bend can get; there's no reason to let
// mood run further past that.
const MOOD_CLAMP = 6;

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

// Semitone offset for N hops around the circle of fifths, folded within one
// octave. Hop count — not the raw semitone jump — is the "how related"
// axis: 0 hops is the tonic itself, 6 hops lands on the tritone, the least
// related point on the circle (same distance either direction you walk).
// The actual semitone jump per hop doesn't grow smoothly (1 hop is a fifth
// away in pitch, 2 hops folds to a major second — chromatic closeness and
// harmonic relatedness are different axes in real music theory), so hop
// count is what should read as "more in tune / more clashing," not the
// size of the jump.
function fifthsSemitoneOffset(hops) {
  const n = Math.min(6, Math.abs(hops));
  const raw = (n * 7) % 12;
  const folded = raw > 6 ? raw - 12 : raw;
  return Math.sign(hops) * folded;
}

// NPC leitmotifs. A `url` entry plays a real audio file on loop; a `notes`
// entry plays the oscillator phrase on loop (existing behaviour).
//
// `notes` prefers whatever scripts/build-leitmotifs.mjs generated from a
// composer's MIDI file (src/chapters/lake-ulysses/midi/<npc>.mid ->
// content/leitmotifs.json — see docs/STAT_MATH.md's "Per-NPC leitmotif"
// section) and falls back to the hand-authored placeholder phrase below
// for any NPC that doesn't have one yet. A MIDI file only ever supplies
// pitch + rhythm; `type` (the oscillator waveform) stays a hand-picked
// creative choice here regardless of where the notes came from — MIDI
// instruments don't map to our four waveforms.
const LEITMOTIFS = {
  THERAPIST: { url: '/assets/lake-ulysses/audio/heavens_waiting_room.mp3', volume: 0.10 },
  DEBORAH: {
    type: 'sine',
    notes: leitmotifNotes.DEBORAH ?? [
      { note: 'A3', durationMs: 700 },
      { note: 'G3', durationMs: 700 },
      { note: 'E3', durationMs: 900 },
      { note: 'D3', durationMs: 1100 },
    ],
  },
  RWANDA: {
    type: 'triangle',
    notes: leitmotifNotes.RWANDA ?? [
      { note: 'E4', durationMs: 220 },
      { note: 'G4', durationMs: 160 },
      { note: 'A4', durationMs: 220 },
      { note: 'E4', durationMs: 300 },
      { note: 'B3', durationMs: 260 },
    ],
  },
  SAMUN: {
    type: 'square',
    notes: leitmotifNotes.SAMUN ?? [
      { note: 'C3', durationMs: 260 },
      { note: 'C3', durationMs: 260 },
      { note: 'Eb3', durationMs: 260 },
      { note: 'C3', durationMs: 400 },
    ],
  },
  RICK: {
    type: 'sawtooth',
    notes: leitmotifNotes.RICK ?? [
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
  const generation = ++ambientGeneration;
  const audioCtx = ensureContext();
  const buffer = await loadAudio(url);
  if (generation !== ambientGeneration) return; // stopped or replaced mid-load
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
  ambientGeneration++;
  try { ambientSource?.stop(); } catch (_) { /* already stopped */ }
  ambientSource = null;
  ambientGain?.disconnect();
  ambientGain = null;
}

// ─── One-shot SFX ─────────────────────────────────────────────────────────────

let typewriterBuffer = null;

export async function preloadTypewriterTick() {
  typewriterBuffer = await loadAudio('/assets/shared/audio/typewriter_tick.mp3');
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
  const buffer = await loadAudio('/assets/shared/audio/tyagl.mp3');
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = TYAGL_GAIN;
  source.connect(gain).connect(masterGain);
  source.start();
}

export async function playItSting() {
  const audioCtx = ensureContext();
  const buffer = await loadAudio('/assets/shared/audio/it_sting.mp3');
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.value = IT_STING_GAIN;
  source.connect(gain).connect(masterGain);
  source.start();
}

// ─── Emotion stems ────────────────────────────────────────────────────────────

// `activeEmotions` is the player's loaded class emotions (engine/loadout.js's
// emotionsForClass). Only those get an oscillator: the other 5 aren't
// selectable for this run, so droning them just muddies the bed — and with all
// 8 running the ambient mix is ~2.7x louder than it was designed at.
export function startEmotionStems(activeEmotions = Object.keys(STEM_CONFIG)) {
  const audioCtx = ensureContext();
  for (const key of activeEmotions) {
    const cfg = STEM_CONFIG[key];
    if (!cfg || stems[key]) continue;
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

export function emphasizeEmotion(emotion, activeEmotions = Object.keys(STEM_CONFIG)) {
  const mix = {};
  for (const key of activeEmotions) {
    mix[key] = key === emotion ? EMPHASIS_GAIN : AMBIENT_GAIN * 0.5;
  }
  setEmotionMix(mix);
}

export function ambientMix(activeEmotions = Object.keys(STEM_CONFIG)) {
  const mix = {};
  for (const key of activeEmotions) mix[key] = AMBIENT_GAIN;
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
  const generation = ++leitmotifGeneration;
  const config = LEITMOTIFS[npcKey];
  if (!config) return;

  const audioCtx = ensureContext();

  if (config.url) {
    const buffer = await loadAudio(config.url);
    if (generation !== leitmotifGeneration) return; // stopped or replaced mid-load
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

  // How this NPC currently feels about the player this encounter — starts
  // neutral each time their leitmotif (re)starts, nudged by trust+stability
  // deltas from resolved dialog choices (dialogScene.js's handleSwipe).
  // Read live every time the loop is about to play its next note, so a
  // choice's effect shows up on the very next beat of their theme rather
  // than a separate sound layered on top of it.
  let mood = 0;

  function playNote() {
    if (stopped) return;
    const { note, durationMs } = config.notes[index];
    const bendSemitones = fifthsSemitoneOffset(mood);
    const osc = audioCtx.createOscillator();
    osc.type = config.type;
    osc.frequency.value = noteToFrequency(note) * Math.pow(2, bendSemitones / 12);
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
    nudgeMood(delta) {
      mood = clamp(mood + delta, -MOOD_CLAMP, MOOD_CLAMP);
    },
    getMood() {
      return mood;
    },
  };
}

// Bends the currently-playing NPC leitmotif toward or away from its own
// tonic based on how a resolved dialog choice actually landed with them
// (trust + stability delta — see dialogScene.js's handleSwipe). No-ops
// quietly if there's no active phrase-loop leitmotif: nothing playing, or
// a file-based one (THERAPIST) that has no notes to bend.
export function nudgeLeitmotifMood(delta) {
  activeLeitmotif?.nudgeMood?.(delta);
}

// The single source of truth for "how is this NPC feeling about the
// player right now" — read by the leitmotif's own pitch-bend and, live,
// by the dialog portrait's mood-mask color (ui/npcPortrait.js). Same
// number driving both, not two mood calculations that could drift apart.
// 0 (neutral) if nothing's active — a file-based leitmotif (THERAPIST)
// has no mood to report either.
export function getLeitmotifMood() {
  return activeLeitmotif?.getMood?.() ?? 0;
}

export function stopLeitmotif() {
  leitmotifGeneration++;
  activeLeitmotif?.stop();
  activeLeitmotif = null;
}

// ─── Preloader logo sting ─────────────────────────────────────────────────────

// Call on first user gesture to unblock AudioContext before the logo starts.
export function unlockAudio() {
  ensureContext();
}

export async function playLogoSting() {
  const audioCtx = ensureContext();
  const buffer = await loadAudio('/assets/shared/audio/snd_inkflo_logo.mp3');
  const gain = audioCtx.createGain();
  gain.gain.value = 0.8;
  gain.connect(masterGain);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start();
  return {
    stop() { try { source.stop(); } catch (_) {} },
    promise: new Promise(resolve => { source.onended = resolve; }),
  };
}

// ─── Title screen music ───────────────────────────────────────────────────────
// Two simultaneous looping layers: snd_lake_title (pad) + snd_titlemusic
// (theme). Both start together and stop together when play begins.

export async function startTitleMusic() {
  stopTitleMusic();
  const generation = ++titleMusicGeneration;
  const audioCtx = ensureContext();
  const urls = [
    '/assets/shared/audio/title/snd_lake_title.mp3',
    '/assets/shared/audio/title/snd_titlemusic.mp3',
  ];
  // Load both in parallel so they start at the exact same time.
  const buffers = await Promise.all(urls.map(loadAudio));
  if (generation !== titleMusicGeneration) return; // player left the title mid-load
  for (const buffer of buffers) {
    const gain = audioCtx.createGain();
    gain.gain.value = TITLE_MUSIC_GAIN;
    gain.connect(masterGain);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    titleSources.push({ source, gain });
  }
}

export function stopTitleMusic() {
  titleMusicGeneration++;
  for (const { source, gain } of titleSources) {
    try { source.stop(); } catch (_) {}
    gain.disconnect();
  }
  titleSources = [];
}

// Plays snd_start once (the dramatic "game begin" jingle).
// Returns { stop, duration } — stop() cuts it early on skip.
export async function playStartJingle() {
  const audioCtx = ensureContext();
  const buffer = await loadAudio('/assets/shared/audio/title/snd_start.mp3');
  const gain = audioCtx.createGain();
  gain.gain.value = START_JINGLE_GAIN;
  gain.connect(masterGain);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start();
  return {
    stop() { try { source.stop(); } catch (_) {} },
    duration: buffer.duration,
  };
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
