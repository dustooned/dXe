// Audio system. The oscillator-based confrontation chord and NPC leitmotifs
// coexist with real audio file playback — all share the same masterGain chain.
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
import { later, cancelLater } from './pauseBus.js';
import leitmotifNotes from '../chapters/lake-ulysses/content/leitmotifs.json';
import {
  MAX_HOPS,
  chordFor,
  fifthsSemitoneOffset,
  noteToFrequency,
  tonicFromPhrase,
} from './harmony.js';

// Kept exported from here because docs/STAT_MATH.md documents it living in
// this module; the implementation moved to harmony.js with everything else
// that's pure theory and Node-testable.
export { noteToFrequency };

let ctx = null;
let masterGain = null;
let analyser = null;
// The user's volume choice, independent of whether an AudioContext exists
// yet (settings can be opened, and the game force-unmutes on first real
// gesture per browser autoplay policy, before anything has ever played).
let masterVolume = 0.5;
let activeLeitmotif = null;
let activeLeitmotifKey = null;

// How this NPC currently feels about the player this encounter. Lives at
// module scope rather than inside startLeitmotif's closure so the chord
// can read it even for an NPC with no leitmotif at all, or a file-based
// one with no note loop to carry it. Reset only when a *different* NPC
// starts — see startLeitmotif's continuity guard.
let encounterMood = 0;
// Last struck chord's dissonance, 0..1. Read every frame by
// ui/oscilloscope.js; kept here so the visual reports the chord that's
// actually sounding rather than recomputing the theory a second time.
let currentDissonance = 0;
let ambientSource = null;
let ambientGain = null;
let ambientBase = 0;
// Deep water muffles the whole mix (setHaze); the analyser still hears it clean.
let hazeFilter = null;
let titleSources = [];

let ambientGeneration = 0;
let leitmotifGeneration = 0;
let titleMusicGeneration = 0;

const audioCache = new Map();

// One waveform per Plutchik emotion (engine/loadout.js's EMOTIONS) — every
// class's 3 loaded emotions need an entry here or that voice is silent
// (see docs/HANDOFF.md's "known gaps": Bible/Crystals had no audio until
// Trust/Disgust/Happy/Sadness/Surprise were added below).
//
// Waveform only — these used to carry a hardcoded frequency each, eight
// unrelated pitches droning with no shared key centre. Pitch now comes from
// the chord (see strikeChord), so a feeling's identity is carried entirely
// by its timbre, which is the part that was doing real work anyway.
const EMOTION_WAVEFORMS = {
  Anger:        'sawtooth',
  Fear:         'sine',
  Anxiety: 'triangle',
  Trust:        'sine',
  Disgust:      'sawtooth',
  Happy:          'triangle',
  Sadness:      'sine',
  Surprise:     'square',
};

// The confrontation chord is struck, not sustained — it attacks and rings
// out rather than droning, so it reads as an answer to a choice instead of
// becoming wallpaper, and leaves the oscilloscope quiet enough between
// strikes for a change to register as a visible event.
const CHORD_ROOT_GAIN    = 0.11;
const CHORD_VOICE_GAIN   = 0.08;
const CHORD_ATTACK_SEC   = 0.03;
const CHORD_RING_SEC     = 3.5;
const LEITMOTIF_GAIN     = 0.14;
// A leitmotif now starts as early as an NPC's confrontation cutscene
// (cutsceneScene.js, for the oscilloscope to have something to trace),
// which is a more sudden entrance than dialogScene's — a linear ramp from
// silence keeps that from popping in over a scene that was already quiet.
const LEITMOTIF_FADE_IN_SEC = 1.4;
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
  // No entry for THERAPIST on purpose. heavens_waiting_room.mp3 used to
  // double as their leitmotif too, so it kept playing straight through
  // the encounter on top of the confrontation chord, hit sounds and
  // typewriter ticks — too much stacked at once for what's meant to be a
  // short, focused tutorial beat. It's still the ambient bed for the
  // questionnaire right before this (questionnaireScene.js's own
  // startAmbient/stopAmbient), just not carried into the dialog scene
  // that follows. Missing entries fall back to `sine` + a neutral tonic —
  // see strikeChord's `?? 'sine'` and harmony.js's tonicFromPhrase.
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
    masterGain.gain.value = turnPaused || hushed ? 0 : masterVolume;
    hazeFilter = ctx.createBiquadFilter();
    hazeFilter.type = 'lowpass';
    hazeFilter.frequency.value = 20000;
    hazeFilter.Q.value = 0.5;
    masterGain.connect(hazeFilter).connect(ctx.destination);
    // A parallel tap, not part of the output chain — masterGain still goes
    // straight to ctx.destination above regardless of whether anything
    // ever reads from this. ui/oscilloscope.js reads it to draw whatever's
    // actually playing (leitmotif, stings, ambient) — real audio, not a
    // decorative animation guessing at it.
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    masterGain.connect(analyser);
  }
  if (ctx.state === 'suspended' && !turnPaused) ctx.resume();
  return ctx;
}

// The shared context and the master output, for players that build their own
// sound (shell/arrangement.js). Creates the context if nothing has yet.
export function getAudioGraph() {
  const c = ensureContext();
  return { ctx: c, out: masterGain };
}

// Lies sink the player into warm, groggy water (engine/lake.js hazeFor):
// the whole mix rolls off its highs as if heard from under the surface.
// 0 is clear; 1 is about 2.4 kHz. Eases there over a couple of seconds.
export function setHaze(amount = 0, fadeSec = 2) {
  if (!ctx || !hazeFilter) return;
  const a = clamp(amount, 0, 1);
  hazeFilter.frequency.setTargetAtTime(20000 * Math.pow(2400 / 20000, a), ctx.currentTime, Math.max(0.01, fadeSec / 3));
}

// The little warm exhale of a lie that went down easy: a soft major chord
// struck high and left to ring, rolled bottom to top. Relief, not reward —
// it never plays for the truth, which has to stand on its own.
export function playRelief() {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
    const at = t + i * 0.07;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.045, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    osc.connect(g).connect(masterGain);
    osc.start(at);
    osc.stop(at + 1.7);
    osc.onended = () => g.disconnect();
  });
}

// Read-only handle onto the live master mix — see ensureContext's analyser
// setup. Ensures the context exists first, so this is safe to call before
// anything's played yet (e.g. mounting a confrontation's oscilloscope
// before its leitmotif has started).
export function getAnalyser() {
  ensureContext();
  return analyser;
}

// Settings menu's volume slider/mute. Safe to call before any AudioContext
// exists — it just records the level for ensureContext() to pick up once
// something actually creates one.
export function setMasterVolume(volume) {
  masterVolume = Math.min(1, Math.max(0, volume));
  if (masterGain && !turnPaused && !hushed) masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.01);
}

// The game pauses into silence when a phone is held sideways (shell/
// orientationPause.js): fade out, then freeze the audio clock so nothing
// scheduled keeps sounding. On the way back the clock restarts with the
// master gain still down, so anything queued while frozen plays out silent
// before the volume returns.
let turnPaused = false;
let turnTimer = null;

// A trauma story is told in silence (dialogScene.js showConnection): the whole
// mix — music, chord, ticks — falls away, and fades back when it is over.
let hushed = false;
export function hush(fadeSec = 0.6) {
  hushed = true;
  if (!ctx || turnPaused) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(masterGain.gain.value, t);
  masterGain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
}
export function unhush(fadeSec = 2.5) {
  if (!hushed) return;
  hushed = false;
  if (!ctx || turnPaused) return;
  const t = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(t);
  masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), t);
  masterGain.gain.linearRampToValueAtTime(masterVolume, t + Math.max(0.01, fadeSec));
}
export function pauseAudio() {
  turnPaused = true;
  clearTimeout(turnTimer);
  if (!ctx) return;
  masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  turnTimer = setTimeout(() => { if (turnPaused) ctx.suspend(); }, 150);
}
export function resumeAudio() {
  turnPaused = false;
  clearTimeout(turnTimer);
  if (!ctx) return;
  const restore = () => setTimeout(() => {
    if (!turnPaused && !hushed) masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.08);
  }, 250);
  ctx.resume().then(restore, restore);
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
  ambientBase = volume;
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

// ─── Confrontation chord ──────────────────────────────────────────────────────
// The NPC sounds their own tonic as a root voice; each feeling the player
// has loaded sounds as another voice above it. How far those voices sit
// from the root is one number — the same `encounterMood` that already bends
// the leitmotif and colors the portrait, normalized to -1..+1. Full
// alignment collapses every voice onto the root (unison); complete
// detachment puts every voice on the tritone against it. See
// shell/harmony.js for the theory and docs/STAT_MATH.md for why.

// Which pitch this NPC is centred on, taken from the melody a composer
// already wrote for them rather than authored a second time. Cached because
// it's a scan of the whole phrase and never changes for a given NPC.
const tonicCache = new Map();

// A baked arrangement can name its own key (shell/encounterMusic.js), so the
// chord is built on the song's root instead of a leitmotif phrase's.
const tonicOverride = new Map();

function tonicForNpc(npcKey) {
  if (tonicOverride.has(npcKey)) return `${tonicOverride.get(npcKey)}3`;
  if (!tonicCache.has(npcKey)) {
    const notes = LEITMOTIFS[npcKey]?.notes;
    // Root register sits below the feeling voices, which stack up to two
    // octaves above it.
    tonicCache.set(npcKey, `${tonicFromPhrase(notes)}3`);
  }
  return tonicCache.get(npcKey);
}

function currentResolution() {
  return clamp(encounterMood / MAX_HOPS, -1, 1);
}

// Voices still ringing. A strike lasts CHORD_RING_SEC, which is longer than
// it takes to leave a scene — without this the chord would bleed several
// seconds into whatever comes next.
let chordVoices = [];

// One oscillator per voice with its own envelope. Web Audio oscillators are
// one-shot, so a struck chord is genuinely a new set of nodes each time —
// same pattern the leitmotif's per-note oscillators already use.
//
// attackSec/ringSec default to the chord's own timing; the FEELZ select
// tone (below) reuses this same envelope+cleanup shape with a shorter ring
// — a quick confirm, not a 3.5s chord — rather than duplicating it.
function strikeVoiceAt(frequency, waveform, peak, attackSec = CHORD_ATTACK_SEC, ringSec = CHORD_RING_SEC) {
  const audioCtx = ensureContext();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = waveform;
  osc.frequency.value = frequency;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attackSec);
  // Exponential decay can't reach zero, so ring to near-silence and stop.
  gain.gain.exponentialRampToValueAtTime(0.0001, now + ringSec);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + ringSec + 0.05);

  const voice = { osc, gain };
  chordVoices.push(voice);
  osc.onended = () => {
    gain.disconnect();
    chordVoices = chordVoices.filter((v) => v !== voice);
  };
}

// Cuts any ringing voices short. Called when an encounter ends or hands off
// to a different NPC — a quick fade rather than a hard stop, since a chord
// clipped mid-ring clicks.
function stopChord() {
  if (!ctx) return;
  for (const { osc, gain } of chordVoices) {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    try { osc.stop(ctx.currentTime + 0.3); } catch (_) { /* already stopped */ }
  }
  currentDissonance = 0;
}

// `activeEmotions` is the player's loaded class emotions (engine/loadout.js's
// emotionsForClass) — only those get a voice, since the other 5 aren't
// selectable this run and would only thicken the chord with feelings the
// player can't act on.
//
// `fn` is the harmonic function of this beat: 'predominant' opening,
// 'dominant' through the body, 'tonic' at the resolution. Each is one
// fourth/fifth of root motion from the last.
export function strikeChord(activeEmotions = Object.keys(EMOTION_WAVEFORMS), fn = 'tonic') {
  ensureContext();
  const { rootFrequency, voices, dissonance } = chordFor({
    tonicNote: tonicForNpc(activeLeitmotifKey),
    fn,
    resolution: currentResolution(),
    voiceCount: activeEmotions.length,
  });
  currentDissonance = dissonance;

  // The root is the NPC — voiced in their leitmotif's own waveform, or a
  // sine when there's no leitmotif entry (or a file-based one with no
  // waveform of its own) to take it from.
  strikeVoiceAt(rootFrequency, LEITMOTIFS[activeLeitmotifKey]?.type ?? 'sine', CHORD_ROOT_GAIN);

  activeEmotions.forEach((emotion, i) => {
    const waveform = EMOTION_WAVEFORMS[emotion];
    if (!waveform) return;
    strikeVoiceAt(voices[i], waveform, CHORD_VOICE_GAIN);
  });
}

// The pitch+waveform one feeling currently occupies in the chord — the
// single source both the select preview below and the FEELZ wheel's
// hover/click tones (ui/feelzDartboard.js) read from, so hovering an
// emotion always previews exactly what selecting it would actually sound
// like right now, not an approximation of it.
function emotionTone(emotion, activeEmotions, fn) {
  const index = activeEmotions.indexOf(emotion);
  const waveform = EMOTION_WAVEFORMS[emotion];
  if (index === -1 || !waveform) return null;
  const { voices } = chordFor({
    tonicNote: tonicForNpc(activeLeitmotifKey),
    fn,
    resolution: currentResolution(),
    voiceCount: activeEmotions.length,
  });
  if (voices[index] === undefined) return null;
  return { frequency: voices[index], waveform };
}

// The frequency a feeling occupies in the current chord (null if it isn't
// one of `activeEmotions`) — for anything outside the wheel that wants to
// sound in the player's key (reckoningScene.js's bells).
export function emotionFrequency(emotion, activeEmotions, fn = 'tonic') {
  ensureContext();
  return emotionTone(emotion, activeEmotions, fn)?.frequency ?? null;
}

// Sounds one feeling on its own, at the pitch it currently occupies in the
// chord — so picking a FEELZ emotion lets the player hear where that
// feeling sits against this NPC before committing to it.
export function strikeEmotionVoice(emotion, activeEmotions = Object.keys(EMOTION_WAVEFORMS), fn = 'tonic') {
  const tone = emotionTone(emotion, activeEmotions, fn);
  if (!tone) return;
  ensureContext();
  strikeVoiceAt(tone.frequency, tone.waveform, CHORD_VOICE_GAIN);
}

// How far the chord currently sits from consonance, 0 (unison) to 1 (every
// voice on the tritone). Read by ui/oscilloscope.js to decide how legible
// the trace should be.
export function getDissonance() {
  return currentDissonance;
}

// ─── FEELZ wheel hover/select tones ───────────────────────────────────────
// A very faint preview while hovering a wedge (ui/feelzDartboard.js),
// gone the instant the pointer leaves; a loud confirm the instant one's
// picked, settling into a quiet low hum for as long as that pick stands.
// Same pitch+waveform as the chord voice that emotion already occupies
// (emotionTone above) — three intensities of the same signal, not a
// parallel sound design.

const HOVER_GAIN = 0.025;
const HOVER_FADE_SEC = 0.12;

let hoverVoice = null;

export function startFeelzHover(emotion, activeEmotions, fn = 'tonic') {
  stopFeelzHover();
  const tone = emotionTone(emotion, activeEmotions, fn);
  if (!tone) return;
  const audioCtx = ensureContext();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = tone.waveform;
  osc.frequency.value = tone.frequency;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(HOVER_GAIN, now + HOVER_FADE_SEC);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  hoverVoice = { osc, gain };
}

// Touch has no hover, so on a phone the hover tone only ever sounds for the
// split second a finger is down. Holding a wedge (feelzDartboard.js's
// HOLD_MS) swells that same tone up to where it can actually be heard —
// listening before choosing, with no pick made.
const HOLD_GAIN = 0.07;

export function swellFeelzHover() {
  if (!hoverVoice || !ctx) return;
  const now = ctx.currentTime;
  hoverVoice.gain.gain.cancelScheduledValues(now);
  hoverVoice.gain.gain.setTargetAtTime(HOLD_GAIN, now, 0.08);
}

// Called on pointer-leave, and as a safety net when the wheel itself is
// torn down (a re-render mid-hover, or the scene unmounting) so a hover
// tone never outlives the wedge that started it.
export function stopFeelzHover() {
  if (!hoverVoice || !ctx) { hoverVoice = null; return; }
  const { osc, gain } = hoverVoice;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0, now, 0.06);
  try { osc.stop(now + 0.3); } catch (_) { /* already stopped */ }
  hoverVoice = null;
}

const SELECT_GAIN = 0.35;
const SELECT_ATTACK_SEC = 0.015;
const SELECT_RING_SEC = 0.5;
const DRONE_GAIN = 0.04;
// Two octaves down — "low frequency," not just "quiet." Keeps the drone
// out of the way of the chord and leitmotif still sounding above it.
const DRONE_OCTAVES_DOWN = 2;
const DRONE_FADE_IN_SEC = 0.4;

let selectDrone = null;

function startFeelzDrone(tone) {
  stopFeelzDrone();
  const audioCtx = ensureContext();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = tone.waveform;
  osc.frequency.value = tone.frequency / Math.pow(2, DRONE_OCTAVES_DOWN);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(DRONE_GAIN, now + DRONE_FADE_IN_SEC);
  osc.connect(gain).connect(masterGain);
  osc.start(now);
  selectDrone = { osc, gain };
}

// Ends the current pick's background hum. Picking a *different* emotion
// replaces it automatically (playFeelzSelectTone below always starts a
// fresh one); this is for the points where no pick should keep sounding
// at all — the swipe committing, or the scene ending.
export function stopFeelzDrone() {
  if (!selectDrone || !ctx) { selectDrone = null; return; }
  const { osc, gain } = selectDrone;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setTargetAtTime(0, now, 0.15);
  try { osc.stop(now + 0.5); } catch (_) { /* already stopped */ }
  selectDrone = null;
}

// The click moment: hover tone cuts (this IS the commitment, not a
// preview of one anymore), the same pitch rings out loud once, then
// drops into a quiet low drone that stands for "this is currently
// picked" until something above ends it.
export function playFeelzSelectTone(emotion, activeEmotions, fn = 'tonic') {
  stopFeelzHover();
  const tone = emotionTone(emotion, activeEmotions, fn);
  if (!tone) return;
  ensureContext();
  strikeVoiceAt(tone.frequency, tone.waveform, SELECT_GAIN, SELECT_ATTACK_SEC, SELECT_RING_SEC);
  startFeelzDrone(tone);
}

// ─── NPC leitmotifs ───────────────────────────────────────────────────────────

export async function startLeitmotif(npcKey) {
  // Same NPC's leitmotif is already playing — e.g. their confrontation
  // cutscene already started it, and dialogScene.js is calling this again
  // moments later, expecting continuity. Restarting would both glitch
  // (stop-then-restart an oscillator mid-note) and reset mood to 0,
  // discarding a lean that, structurally, can't have moved yet anyway
  // (nothing nudges mood before a dialog choice resolves) — but the audible
  // restart alone is reason enough to skip it.
  if (npcKey === activeLeitmotifKey && activeLeitmotif) return;

  stopLeitmotif();
  // A new encounter starts neutral. Same-NPC continuity returned above, so
  // this only fires when the NPC actually changes — mood has nothing to
  // carry over between characters.
  encounterMood = 0;
  currentDissonance = 0;
  const generation = ++leitmotifGeneration;
  const config = LEITMOTIFS[npcKey];
  if (!config) return;

  const audioCtx = ensureContext();

  if (config.url) {
    const buffer = await loadAudio(config.url);
    if (generation !== leitmotifGeneration) return; // stopped or replaced mid-load
    const gain = audioCtx.createGain();
    const targetGain = config.volume ?? LEITMOTIF_GAIN;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + LEITMOTIF_FADE_IN_SEC);
    gain.connect(masterGain);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();
    activeLeitmotif = {
      gain,
      base: targetGain,
      stop() {
        gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
        setTimeout(() => { try { source.stop(); } catch (_) {} gain.disconnect(); }, 400);
      },
    };
    activeLeitmotifKey = npcKey;
    return;
  }

  // Oscillator phrase loop (existing NPCs)
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(LEITMOTIF_GAIN, audioCtx.currentTime + LEITMOTIF_FADE_IN_SEC);
  gain.connect(masterGain);

  let index = 0;
  let stopped = false;
  let timer = null;

  function playNote() {
    if (stopped) return;
    const { note, durationMs } = config.notes[index];
    // Module-level `encounterMood` is read live every time the loop is
    // about to play its next note, so a choice's effect shows up on the
    // very next beat of their theme rather than as a separate sound
    // layered on top of it.
    const bendSemitones = fifthsSemitoneOffset(encounterMood);
    const osc = audioCtx.createOscillator();
    osc.type = config.type;
    osc.frequency.value = noteToFrequency(note) * Math.pow(2, bendSemitones / 12);
    osc.connect(gain);
    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
    index = (index + 1) % config.notes.length;
    timer = later(playNote, durationMs);
  }

  playNote();

  activeLeitmotif = {
    gain,
    base: LEITMOTIF_GAIN,
    stop() {
      stopped = true;
      cancelLater(timer);
      gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
      setTimeout(() => gain.disconnect(), 200);
    },
  };
  activeLeitmotifKey = npcKey;
}

// Moves the encounter toward or away from this NPC based on how a resolved
// dialog choice actually landed with them (trust + stability delta — see
// dialogScene.js's handleSwipe). Bends a phrase-loop leitmotif's pitch,
// moves the confrontation chord, and colors the portrait, all off this one
// number.
//
// Applies even with no phrase-loop leitmotif active (no entry at all, or
// a file-based one with no notes to bend) — there's still a chord and a
// portrait that should respond.
export function nudgeLeitmotifMood(delta) {
  encounterMood = clamp(encounterMood + delta, -MOOD_CLAMP, MOOD_CLAMP);
}

// The single source of truth for "how is this NPC feeling about the
// player right now" — read by the leitmotif's own pitch-bend, by the
// confrontation chord's voicing, and by the dialog portrait's mood-mask
// color (ui/npcPortrait.js). One number driving all three, not three mood
// calculations that could drift apart.
export function getLeitmotifMood() {
  return encounterMood;
}

// Music only — ambient bed and leitmotif — fades out and back (a trauma story
// is told over it: shell/encounterMusic.js ducks an arrangement the same way).
// Typing, voices, IT and SO keep sounding.
export function duckMusic(on, fadeSec = 0.8) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const tc = Math.max(0.01, fadeSec / 3);
  if (ambientGain) ambientGain.gain.setTargetAtTime(on ? 0.0001 : ambientBase, t, tc);
  const lm = activeLeitmotif;
  if (lm?.gain) lm.gain.gain.setTargetAtTime(on ? 0.0001 : lm.base, t, tc);
}

// An encounter whose music is a baked arrangement (shell/encounterMusic.js)
// instead of a leitmotif phrase: same bookkeeping as startLeitmotif — a
// neutral mood, the NPC as the chord's owner — with no phrase to play.
export function beginEncounter(npcKey, tonic) {
  if (npcKey === activeLeitmotifKey && activeLeitmotif) return;
  stopLeitmotif();
  encounterMood = 0;
  currentDissonance = 0;
  if (tonic) tonicOverride.set(npcKey, tonic); else tonicOverride.delete(npcKey);
  activeLeitmotif = { stop() {} };
  activeLeitmotifKey = npcKey;
}

// Ends the encounter's audio: the character's melody, any chord still
// ringing, and any FEELZ hover/select tone. All belong to the same
// encounter, so they end together rather than trailing into the next scene.
export function stopLeitmotif() {
  leitmotifGeneration++;
  stopChord();
  stopFeelzHover();
  stopFeelzDrone();
  activeLeitmotif?.stop();
  activeLeitmotif = null;
  activeLeitmotifKey = null;
}

// ─── Sound player (debug menu) ────────────────────────────────────────────────

// Leitmotif keys, for the sound player's track list.
export const leitmotifKeys = () => Object.keys(LEITMOTIFS);

// Files decoded and held in memory right now: [{ url, seconds }].
export function loadedTracks() {
  return [...audioCache].map(([url, buf]) => ({ url, seconds: buf.duration }));
}

// Plays one audio file through the master output (loading it first if it
// isn't in memory). Returns { stop, seconds }.
export async function previewFile(url, { loop = false } = {}) {
  const audioCtx = ensureContext();
  const buffer = await loadAudio(url);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.5;
  source.connect(gain).connect(masterGain);
  source.start();
  return {
    seconds: buffer.duration,
    source,
    stop() { try { source.stop(); } catch (_) { /* ended */ } gain.disconnect(); },
  };
}

// Everything the running game has going, off — so the sound player can be
// listened to alone. The scene's music stays off until the scene changes.
export function silenceGame() {
  stopAmbient();
  stopLeitmotif();
  stopPulse();
  stopTitleMusic?.();
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

// 'subtle' pairs with fx.js's shake('subtle') — a swipe that didn't count
// as a choice at all (no FEELZ emotion picked yet), not a smaller version
// of a real one. Quieter and shorter than 'weak', and a touch brighter in
// pitch so it reads as a light "that didn't register" tick rather than a
// small impact.
const HIT_CONFIG = {
  subtle: { peak: 0.08, duration: 0.1, frequency: 330 },
  weak:   { peak: 0.15, duration: 0.18, frequency: 220 },
  strong: { peak: 0.3,  duration: 0.35, frequency: 90 },
};

export function playHit(intensity = 'weak') {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  const { peak, duration, frequency } = HIT_CONFIG[intensity] ?? HIT_CONFIG.weak;

  osc.type = 'square';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain).connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

// ─── FEELZ boot chime ─────────────────────────────────────────────────────────

// PLACEHOLDER synth tone for the FEELZ app booting (feelz_launch.json's
// logo beat): a struck, ringing arpeggio rising through a major-ninth
// chord — bright, clean, a little too cheerful, the way app startup sounds
// are. Struck-and-ringing voices, not a held pad.
const BOOT_NOTES = [523.25, 659.25, 783.99, 987.77, 1174.66]; // C5 E5 G5 B5 D6
const BOOT_GAIN = 0.16;

export function playFeelzBoot() {
  const audioCtx = ensureContext();
  const start = audioCtx.currentTime + 0.05;
  BOOT_NOTES.forEach((frequency, i) => {
    const at = start + i * 0.09;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(BOOT_GAIN, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    osc.connect(gain).connect(masterGain);
    osc.start(at);
    osc.stop(at + 1.45);
    osc.onended = () => gain.disconnect();
  });
  // A soft square an octave under the root, for a little digital grit.
  const sub = audioCtx.createOscillator();
  sub.type = 'square';
  sub.frequency.value = BOOT_NOTES[0] / 2;
  const subGain = audioCtx.createGain();
  subGain.gain.setValueAtTime(0.05, start);
  subGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
  sub.connect(subGain).connect(masterGain);
  sub.start(start);
  sub.stop(start + 0.65);
  sub.onended = () => subGain.disconnect();
}

// ─── FEELZ notification ping ──────────────────────────────────────────────────

// Two quick sine blips, up a fifth (E6 → B6): a plain phone-notification
// ping for ui/feelzNotification.js. Shorter and thinner than the boot chime
// so it reads as "message," not "app starting."
const PING_NOTES = [1318.51, 1975.53];
const PING_GAIN = 0.1;

export function playFeelzPing() {
  const audioCtx = ensureContext();
  const start = audioCtx.currentTime + 0.02;
  PING_NOTES.forEach((frequency, i) => {
    const at = start + i * 0.11;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(PING_GAIN, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
    osc.connect(gain).connect(masterGain);
    osc.start(at);
    osc.stop(at + 0.3);
    osc.onended = () => gain.disconnect();
  });
}

// ─── Battle drama (dialogScene.js) ────────────────────────────────────────────

// A low heartbeat under an NPC's line while it types: the wind-up. Its rate
// follows getTension() (0..1), from a resting ~70bpm up to ~150bpm.
const PULSE_GAIN = 0.22;
let pulseTimer = null;

function thumpAt(at, peak) {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70, at);
  osc.frequency.exponentialRampToValueAtTime(38, at + 0.12);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(gain).connect(masterGain);
  osc.start(at);
  osc.stop(at + 0.18);
  osc.onended = () => gain.disconnect();
}

export function startPulse(getTension) {
  stopPulse();
  const beat = () => {
    const tension = Math.min(1, Math.max(0, getTension?.() ?? 0));
    const at = ensureContext().currentTime + 0.01;
    thumpAt(at, PULSE_GAIN * (0.6 + tension * 0.4));
    thumpAt(at + 0.14, PULSE_GAIN * 0.6 * (0.6 + tension * 0.4)); // lub-dub
    pulseTimer = later(beat, 860 - tension * 460);
  };
  beat();
}

export function stopPulse() {
  cancelLater(pulseTimer);
  pulseTimer = null;
}

// The picked feeling matches the NPC's: a bright, rising two-note lock-on.
export function playSyncChime() {
  const audioCtx = ensureContext();
  const start = audioCtx.currentTime + 0.01;
  [987.77, 1479.98].forEach((frequency, i) => {
    const at = start + i * 0.07;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.12, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    osc.connect(gain).connect(masterGain);
    osc.start(at);
    osc.stop(at + 0.55);
    osc.onended = () => gain.disconnect();
  });
}

// The picked feeling isn't theirs: two close-detuned tones beating against
// each other for a moment — a grind, not an error buzz.
export function playGrind() {
  const audioCtx = ensureContext();
  const at = audioCtx.currentTime + 0.01;
  [196, 203].forEach((frequency) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.045, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(gain).connect(masterGain);
    osc.start(at);
    osc.stop(at + 0.5);
    osc.onended = () => gain.disconnect();
  });
}

// ─── Connection moment (dialogScene.js showConnection) ────────────────────────

// Everything drops out (the whole mix, music included) for `silenceMs`, then
// one crack — a dry snap like ice giving way — and a warm major chord rings
// up out of it as the sound comes back. Returns the total ms until it rings.
export function silenceThenCrack(silenceMs = 1500) {
  const audioCtx = ensureContext();
  const now = audioCtx.currentTime;
  const back = now + silenceMs / 1000;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
  masterGain.gain.setValueAtTime(0.0001, back);
  masterGain.gain.linearRampToValueAtTime(masterVolume, back + 0.02);

  // The crack: a very short burst of bright noise over a low thud.
  const len = Math.floor(audioCtx.sampleRate * 0.09);
  const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const ng = audioCtx.createGain();
  ng.gain.value = 0.5;
  noise.connect(hp).connect(ng).connect(masterGain);
  noise.start(back + 0.02);

  const thud = audioCtx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(90, back + 0.02);
  thud.frequency.exponentialRampToValueAtTime(40, back + 0.25);
  const tg = audioCtx.createGain();
  tg.gain.setValueAtTime(0.4, back + 0.02);
  tg.gain.exponentialRampToValueAtTime(0.0001, back + 0.3);
  thud.connect(tg).connect(masterGain);
  thud.start(back + 0.02);
  thud.stop(back + 0.32);

  // The warmth after it: a soft major chord swelling up and ringing out.
  [261.63, 329.63, 392.0, 523.25].forEach((frequency, i) => {
    const at = back + 0.18 + i * 0.05;
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.07, at + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
    osc.connect(gain).connect(masterGain);
    osc.start(at);
    osc.stop(at + 3.3);
    osc.onended = () => gain.disconnect();
  });
  return silenceMs;
}

// ─── Phone sounds (status bar + contacts) ──────────────────────────────────────

function blip(frequency, at, dur, gainPeak, type = 'square') {
  const audioCtx = ensureContext();
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(gainPeak, at + 0.005);
  gain.gain.setValueAtTime(gainPeak, at + dur - 0.02);
  gain.gain.linearRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(masterGain);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  osc.onended = () => gain.disconnect();
}

// Raw samples (shell/voices.js's SAM lines) into the mix. `phone` narrows
// them to a telephone band; `cut` stops playback partway through.
export function playSamples(samples, rate, { delayMs = 0, phone = false, cut = 1, gain = 1 } = {}) {
  const audioCtx = ensureContext();
  const buffer = audioCtx.createBuffer(1, samples.length, rate);
  buffer.getChannelData(0).set(samples);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.value = 0.55 * gain;
  let chain = src;
  if (phone) {
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 350;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    chain = chain.connect(hp).connect(lp);
  }
  chain.connect(g).connect(masterGain);
  const at = audioCtx.currentTime + delayMs / 1000;
  src.start(at);
  if (cut < 1) src.stop(at + buffer.duration * cut);
  src.onended = () => g.disconnect();
}

// Each person's phone rings their own way: a short tune, twice. Returns
// how long before they pick up (ms). Unknown callers get the old handset.
const RINGTONES = {
  // Church chimes, one note gone sour: jolly, and off.
  DEBORAH: { type: 'triangle', notes: [['C5', 160], ['E5', 160], ['G5', 160], ['F#5', 320]] },
  // A cool minor-seventh, unhurried.
  RWANDA: { type: 'sine', notes: [['A4', 220], ['C5', 220], ['E5', 220], ['G5', 360]] },
  // Bright and quick, a little show-off.
  SAMUN: { type: 'square', notes: [['E5', 90], ['G5', 90], ['E5', 90], ['C6', 220]] },
  // An old wall phone's bell: a low, rattling buzz.
  RICK: { type: 'square', notes: [['G3', 50], ['A3', 50], ['G3', 50], ['A3', 50], ['G3', 50], ['A3', 50], ['G3', 50], ['A3', 50]] },
};
export function playRingtone(who) {
  const tune = RINGTONES[who];
  if (!tune) return playPhoneRing();
  const t = ensureContext().currentTime + 0.02;
  const length = tune.notes.reduce((sum, [, ms]) => sum + ms, 0) / 1000;
  for (const off of [0, length + 0.35]) {
    let at = t + off;
    for (const [note, ms] of tune.notes) {
      blip(noteToFrequency(note), at, (ms / 1000) * 0.9, 0.045, tune.type);
      at += ms / 1000;
    }
  }
  return Math.round((length * 2 + 0.5) * 1000);
}

// The call is over: the handset click and the three falling tones of a
// line gone dead. The end of the tutorial call, and every hang-up.
export function playHangup() {
  const t = ensureContext().currentTime + 0.02;
  blip(1200, t, 0.03, 0.06, 'square');
  [620, 480, 360].forEach((f, i) => blip(f, t + 0.18 + i * 0.2, 0.16, 0.05, 'sine'));
}

// Someone shut you out: the signal drops — a burst of static falling away
// under a sinking tone, like bars draining to nothing.
export function playSignalLost() {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.02;
  playStaticNoise(520);
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.9);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
  osc.connect(g).connect(masterGain);
  osc.start(t);
  osc.stop(t + 1);
  osc.onended = () => g.disconnect();
}

// An answer that neither met them nor turned toward them: the lines drift
// apart — two detuned notes sliding away from each other.
export function playDrift() {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.02;
  [[392, 370], [392, 415]].forEach(([from, to]) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.linearRampToValueAtTime(to, t + 0.6);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.75);
    osc.onended = () => g.disconnect();
  });
}

// The death clock ticking: a heavy, low escapement — a clunk with a
// short metallic ring, alternating tick / tock.
export function playClockTick(tock = false) {
  const t = ensureContext().currentTime + 0.01;
  blip(tock ? 520 : 660, t, 0.03, 0.08, 'square');
  blip(tock ? 82 : 98, t, 0.09, 0.1, 'triangle');
}

// One strike of a C64 clock bell, after Storm Lord's opening: SID-style
// ring modulation (a triangle multiplied by a square at an inharmonic
// ratio) gives the clangy, metallic partials; a 4-bit noise click is the
// hammer; it rings out for seconds. `at` is seconds from now.
export function playC64Toll(at = 0, base = 98) {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.02 + at;
  const ring = 2.8;
  // `base` may be a list: one bell per pitch, struck together.
  const bases = Array.isArray(base) ? base : [base];
  const level = 1 / Math.sqrt(bases.length);
  // Ring mod: carrier through a gain whose gain is the modulator.
  for (const b of bases) [[1, 0.22], [2.76, 0.1], [5.4, 0.05]].forEach(([mult, peakRaw]) => {
    const peak = peakRaw * level;
    const base = b;
    const carrier = audioCtx.createOscillator();
    carrier.type = 'triangle';
    carrier.frequency.value = base * mult;
    const mod = audioCtx.createOscillator();
    mod.type = 'square';
    mod.frequency.value = base * mult * 1.414;
    const rm = audioCtx.createGain();
    rm.gain.value = 0;
    mod.connect(rm.gain);
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + ring / mult ** 0.3);
    carrier.connect(rm).connect(env).connect(masterGain);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + ring + 0.1);
    mod.stop(t + ring + 0.1);
    carrier.onended = () => env.disconnect();
  });
  // The hammer: a burst of stepped 4-bit noise.
  const rate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, Math.floor(rate * 0.12), rate);
  const data = buffer.getChannelData(0);
  const hold = Math.floor(rate / 4000);
  let v = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) v = Math.round((Math.random() * 2 - 1) * 8) / 8;
    data[i] = v * (1 - i / data.length);
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const ng = audioCtx.createGain();
  ng.gain.value = 0.25;
  noise.connect(ng).connect(masterGain);
  noise.start(t);
  noise.onended = () => ng.disconnect();
}

// IT and SO howl together as they walk you into the water. `foul` (0..1,
// the lake's Truth Debt over its max) turns it from a clean pair of hounds
// a fifth apart into something wrong: the pitch sinks, the interval slides
// to a tritone, the vibrato goes seasick, a growl of distortion and noise
// creeps in, and the "oo-ah" mouth (a swept band-pass) closes to a choke.
export function playHowl(foul = 0) {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.05;
  const f = clamp(foul, 0, 1);
  const dur = 3.2 + f * 1.2;
  const root = 330 * (1 - f * 0.35);
  const interval = 1.5 - f * 0.086; // a fifth (1.5) down to a tritone (~1.414)
  const shaper = audioCtx.createWaveShaper();
  const curve = new Float32Array(1024);
  const drive = 1 + f * 30;
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  shaper.curve = curve;
  const out = audioCtx.createGain();
  out.gain.value = 0.9;
  shaper.connect(out).connect(masterGain);

  [[1, 0, 'it'], [interval, 0.35, 'so']].forEach(([ratio, offset]) => {
    const start = t + offset;
    const base = root * ratio;
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    // The howl's shape: rise, hold, fall away.
    osc.frequency.setValueAtTime(base * 0.7, start);
    osc.frequency.exponentialRampToValueAtTime(base, start + dur * 0.25);
    osc.frequency.setValueAtTime(base, start + dur * 0.6);
    osc.frequency.exponentialRampToValueAtTime(base * (0.55 - f * 0.2), start + dur);
    const vib = audioCtx.createOscillator();
    vib.frequency.value = 5 - f * 3.2;
    const vibDepth = audioCtx.createGain();
    vibDepth.gain.value = base * (0.012 + f * 0.06);
    vib.connect(vibDepth).connect(osc.frequency);
    const mouth = audioCtx.createBiquadFilter();
    mouth.type = 'bandpass';
    mouth.Q.value = 6 + f * 6;
    mouth.frequency.setValueAtTime(500, start);
    mouth.frequency.exponentialRampToValueAtTime(1300 - f * 700, start + dur * 0.3);
    mouth.frequency.exponentialRampToValueAtTime(400 - f * 150, start + dur);
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.16, start + 0.4);
    env.gain.setValueAtTime(0.16, start + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(mouth).connect(env).connect(shaper);
    osc.start(start);
    vib.start(start);
    osc.stop(start + dur + 0.05);
    vib.stop(start + dur + 0.05);
    osc.onended = () => env.disconnect();
  });

  // The worse the water, the more breath and grit under them.
  if (f > 0.2) {
    const rate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, Math.floor(rate * dur), rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.05 * f, t + 0.6);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp).connect(ng).connect(out);
    noise.start(t);
    noise.onended = () => ng.disconnect();
  }
  return Math.round((dur + 0.35) * 1000);
}

// The class, hinted by ear when the FEELZ evaluation finishes
// (questionnaireScene.js). Never named, only heard:
//   Guns      a light gunshot that echoes off something far away
//   Crystals  a Tibetan singing bowl, struck, beating slowly as it rings
//   Bible     a soft choir "ah" in a big, reverberant room
function echoBus(delaySec, feedback, out) {
  const audioCtx = ensureContext();
  const input = audioCtx.createGain();
  const delay = audioCtx.createDelay(2);
  delay.delayTime.value = delaySec;
  const fb = audioCtx.createGain();
  fb.gain.value = feedback;
  const damp = audioCtx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2200;
  input.connect(out);
  input.connect(delay);
  delay.connect(damp).connect(fb).connect(delay);
  damp.connect(out);
  return input;
}

function reverbBus(seconds, out) {
  const audioCtx = ensureContext();
  const rate = audioCtx.sampleRate;
  const ir = audioCtx.createBuffer(2, Math.floor(rate * seconds), rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
  }
  const conv = audioCtx.createConvolver();
  conv.buffer = ir;
  const wet = audioCtx.createGain();
  wet.gain.value = 0.9;
  const dry = audioCtx.createGain();
  dry.gain.value = 0.6;
  const input = audioCtx.createGain();
  input.connect(dry).connect(out);
  input.connect(conv).connect(wet).connect(out);
  return input;
}

export function playClassSigil(cls) {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.03;
  const out = audioCtx.createGain();
  out.gain.value = 1;
  out.connect(masterGain);

  if (cls === 'Guns') {
    // A retro game gunshot, the way the SID made them: a burst of stepped
    // noise whose step rate (its pitch) drops fast, so it cracks bright and
    // falls into a dull thud — then the shot comes back once, softer and
    // darker, off something far away.
    const rate = audioCtx.sampleRate;
    const dur = 0.55;
    const buf = audioCtx.createBuffer(1, Math.floor(rate * dur), rate);
    const d = buf.getChannelData(0);
    let v = 0;
    let next = 0;
    for (let i = 0; i < d.length; i++) {
      const p = i / d.length;
      // Hold rate sweeps ~14 kHz → ~700 Hz (exponential), 4-bit levels.
      const holdHz = 14000 * Math.pow(700 / 14000, Math.min(1, p * 2.2));
      if (i >= next) {
        v = Math.round((Math.random() * 2 - 1) * 8) / 8;
        next = i + Math.max(1, Math.floor(rate / holdHz));
      }
      d[i] = v * Math.pow(1 - p, 3.5);
    }
    const shot = (at, gain, cutoff) => {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      const g = audioCtx.createGain();
      g.gain.value = gain;
      src.connect(lp).connect(g).connect(out);
      src.start(at);
    };
    shot(t, 0.6, 12000);
    shot(t + 0.38, 0.22, 2500); // the far echo
    shot(t + 0.8, 0.08, 1400); // and fainter
  } else if (cls === 'Crystals') {
    const bus = echoBus(0.45, 0.4, out);
    const base = 220;
    // Inharmonic bowl partials, each a slightly detuned pair so it beats.
    [[1, 0.12], [2.71, 0.06], [5.15, 0.03], [8.3, 0.015]].forEach(([mult, peak]) => {
      for (const detune of [0, 1.6]) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = base * mult + detune;
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5 / Math.sqrt(mult));
        osc.connect(g).connect(bus);
        osc.start(t);
        osc.stop(t + 6);
      }
    });
  } else {
    // Bible: a soprano choir holding a major chord on a clear "ah", in a
    // big stone room. Voices swell in one after another, hold, and let go
    // into the reverb. Brighter and louder than a pad so it reads as voices.
    const bus = reverbBus(5, out);
    const formants = [[1000, 5, 1], [1400, 7, 0.7], [2800, 9, 0.35], [3400, 12, 0.15]];
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
      for (const detune of [-7, 0, 7]) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = detune;
        const vib = audioCtx.createOscillator();
        vib.frequency.value = 5 + i * 0.25 + detune * 0.02;
        const vd = audioCtx.createGain();
        vd.gain.value = f * 0.007;
        vib.connect(vd).connect(osc.frequency);
        const voice = audioCtx.createGain();
        const start = t + i * 0.18;
        voice.gain.setValueAtTime(0.0001, start);
        voice.gain.linearRampToValueAtTime(0.07, start + 0.7);
        voice.gain.setValueAtTime(0.07, start + 2.4);
        voice.gain.exponentialRampToValueAtTime(0.0001, start + 3.8);
        for (const [freq, q, level] of formants) {
          const bp = audioCtx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = freq;
          bp.Q.value = q;
          const lv = audioCtx.createGain();
          lv.gain.value = level;
          osc.connect(bp).connect(lv).connect(voice);
        }
        voice.connect(bus);
        osc.start(start);
        vib.start(start);
        osc.stop(start + 4);
        vib.stop(start + 4);
      }
    });
  }
  setTimeout(() => out.disconnect(), 9000);
}

// A fax coming in (ui/feelzRecord.js): the handshake (two tones and a
// screech of modem noise), returning how long it takes, then a dot-matrix
// chirp per printed line (a thunk for the stamp).
export function playFaxHandshake() {
  const t = ensureContext().currentTime + 0.02;
  blip(2100, t, 0.35, 0.03, 'sine');
  blip(1300, t + 0.45, 0.3, 0.03, 'sine');
  playStaticNoise(700);
  blip(1800, t + 1.1, 0.12, 0.025, 'square');
  blip(1200, t + 1.25, 0.12, 0.025, 'square');
  return 1500;
}

// The paper yanked through too fast: the feed motor stutters and grinds
// against it, a few scraping bursts, then it catches up.
export function playFaxJam() {
  const t = ensureContext().currentTime + 0.01;
  let at = t;
  for (let i = 0; i < 9; i++) {
    const f = 70 + Math.random() * 50;
    blip(f, at, 0.05 + Math.random() * 0.04, 0.09, 'square');
    if (i % 3 === 1) blip(2400 + Math.random() * 800, at + 0.02, 0.03, 0.015, 'square');
    at += 0.06 + Math.random() * 0.07;
  }
  playStaticNoise(380);
}

export function playFaxLine(stamp = false) {
  const t = ensureContext().currentTime + 0.01;
  if (stamp) {
    blip(90, t, 0.12, 0.12, 'square');
    return;
  }
  for (let i = 0; i < 4; i++) blip(1600 + Math.random() * 600, t + i * 0.025, 0.012, 0.02, 'square');
}

// The title logo (main.js): two halves sweep in (a rising square-wave
// whoosh), then slam together (a bright metallic clang over a low thud and
// a crack of noise), NES-style.
export function playLogoSweep() {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.02;
  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.65);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(g).connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.75);
  osc.onended = () => g.disconnect();
}

export function playLogoSlam() {
  const t = ensureContext().currentTime + 0.01;
  [1760, 2349, 2637].forEach((f, i) => blip(f, t + i * 0.012, 0.35 - i * 0.08, 0.04, 'square'));
  blip(55, t, 0.25, 0.22, 'triangle');
  playStaticNoise(160);
}

// A chapter's preview on the chapter screen (main.js): a few soft notes of
// its motif ring once (with an echo), then its ambience crossfades in low
// while you hover (or the touch prompt is up). Separate from the scene
// ambience so it never fights it; everything fades out when you leave,
// including notes still scheduled.
let previewMotif = null;
let previewGain = null;
let previewSource = null;
let previewGeneration = 0;
const PREVIEW_GAIN = 0.22;
const PREVIEW_MOTIF_GAIN = 1;

// One motif note (and its fainter echo) into the preview's own bus, so
// stopping the preview silences notes still scheduled, not just the loop.
function motifNote(bus, f, at, dur, peak) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.01);
  g.gain.setValueAtTime(peak, at + Math.max(0.02, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(bus);
  osc.start(at);
  osc.stop(at + dur + 0.02);
  osc.onended = () => g.disconnect();
}

// The motif plays first; the ambience waits for it, then crossfades in
// under the motif's last echo.
export async function startChapterPreview({ src, motif = [] } = {}) {
  stopChapterPreview();
  const generation = ++previewGeneration;
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime;
  const motifBus = audioCtx.createGain();
  motifBus.gain.value = PREVIEW_MOTIF_GAIN;
  motifBus.connect(masterGain);
  previewMotif = motifBus;
  let at = t + 0.15;
  for (const [note, ms] of motif) {
    const f = noteToFrequency(note);
    motifNote(motifBus, f, at, (ms / 1000) * 0.9, 0.025);
    motifNote(motifBus, f, at + 0.32, (ms / 1000) * 0.8, 0.01);
    at += ms / 1000;
  }
  const motifEnd = at;
  if (!src) return;
  const buffer = await loadAudio(src).catch(() => null);
  if (!buffer || generation !== previewGeneration) return;
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(masterGain);
  previewGain = gain;
  // Crossfade: the ambience rises from where the last note starts to fade,
  // and the motif bus eases down as it comes in.
  const fadeIn = Math.max(audioCtx.currentTime, motifEnd - 0.6);
  gain.gain.setValueAtTime(0, fadeIn);
  gain.gain.linearRampToValueAtTime(PREVIEW_GAIN, fadeIn + 1.6);
  motifBus.gain.setValueAtTime(PREVIEW_MOTIF_GAIN, fadeIn);
  motifBus.gain.linearRampToValueAtTime(0.0001, fadeIn + 1.6);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  source.start(fadeIn);
  previewSource = source;
}

export function stopChapterPreview() {
  previewGeneration++;
  const gains = [previewGain, previewMotif].filter(Boolean);
  const source = previewSource;
  previewGain = null;
  previewMotif = null;
  previewSource = null;
  if (!gains.length || !ctx) return;
  const t = ctx.currentTime;
  for (const g of gains) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.35);
  }
  setTimeout(() => { try { source?.stop(); } catch (_) { /* stopped */ } gains.forEach((g) => g.disconnect()); }, 450);
}

// A meter moved (ui/statusBar.js): two square-wave notes a fifth apart,
// rising when it went up, falling when it went down. Each meter has its
// own pitch so they're learnable by ear; several changes play in turn.
const METER_PITCH = { stability: 262, trust: 330, lucidity: 392, integrity: 523 };
export function playMeterChange(changes) {
  const t = ensureContext().currentTime + 0.05;
  changes.forEach(({ meter, up }, i) => {
    const base = METER_PITCH[meter] ?? 330;
    const [a, b] = up ? [base, base * 1.5] : [base * 1.5, base];
    const at = t + i * 0.18;
    blip(a, at, 0.07, 0.04, 'square');
    blip(b, at + 0.08, 0.1, 0.04, 'square');
  });
}

// Feedback: a phone calling the phone it's already on. A thin squeal
// that climbs and wobbles, under two quieter echo blips of the voice.
export function playFeedback(durSec = 1.1) {
  const audioCtx = ensureContext();
  const t = audioCtx.currentTime + 0.02;
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(3400, t + durSec);
  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 9;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(osc.frequency);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.035, t + durSec * 0.7);
  gain.gain.linearRampToValueAtTime(0.0001, t + durSec);
  osc.connect(gain).connect(masterGain);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + durSec + 0.05);
  lfo.stop(t + durSec + 0.05);
  osc.onended = () => { gain.disconnect(); lfoGain.disconnect(); };
  // The voice coming back: two smaller copies of a "hello" blip pair.
  [0.0, 0.35, 0.7].forEach((off, i) => {
    const peak = 0.05 * (1 - i * 0.35);
    blip(330, t + off, 0.07, peak, 'triangle');
    blip(392, t + off + 0.09, 0.09, peak, 'triangle');
  });
}

// Two rings of an old handset: a warbled pair, twice.
export function playPhoneRing() {
  const t = ensureContext().currentTime + 0.02;
  for (const off of [0, 0.9]) {
    for (let i = 0; i < 8; i++) blip(i % 2 ? 480 : 440, t + off + i * 0.05, 0.05, 0.05, 'sine');
  }
  return 1500;
}

// The three falling tones of a call that won't connect.
export function playCallFailed() {
  const t = ensureContext().currentTime + 0.02;
  [913.8, 1370.6, 1776.7].reverse().forEach((f, i) => blip(f, t + i * 0.3, 0.27, 0.06, 'sine'));
}

// Low battery: two small descending chirps.
export function playLowBattery() {
  const t = ensureContext().currentTime + 0.02;
  blip(1200, t, 0.08, 0.05);
  blip(800, t + 0.12, 0.1, 0.05);
}

// ─── Lake splash ──────────────────────────────────────────────────────────────

// A water splash built from square waves whose pitch follows the lake's
// quality (engine/lake.js): clean water is a bright, high, rising droplet
// "bloop" with sparkling spray; contaminated water is the same gesture
// shifted way down and muffled — a thick, low plop. Played when the lake
// gauge first appears and at every reaction after (dialogScene.js), and
// once for the final reading at the ending.
const SPLASH_GAIN = 0.12;

export function playLakeSplash(truthDebt = 0) {
  const audioCtx = ensureContext();
  const now = audioCtx.currentTime;
  const quality = 1 - clamp(truthDebt, 0, 10) / 10; // 1 clean … 0 swamp
  const base = 180 * Math.pow(2, quality * 2.3);    // ~180 Hz … ~890 Hz

  // Murk: contaminated water sounds like it's heard through mud.
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700 + quality * 5300;
  filter.connect(masterGain);

  // The droplet: a square chirp rising from the base pitch — real droplet
  // sounds rise as the air bubble they trap shrinks.
  const drop = audioCtx.createOscillator();
  drop.type = 'square';
  drop.frequency.setValueAtTime(base, now);
  drop.frequency.exponentialRampToValueAtTime(base * (1.6 + quality), now + 0.09);
  const dropGain = audioCtx.createGain();
  dropGain.gain.setValueAtTime(SPLASH_GAIN, now);
  dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14 + (1 - quality) * 0.12);
  drop.connect(dropGain).connect(filter);
  drop.start(now);
  drop.stop(now + 0.3);

  // The spray: a scatter of tiny square blips above the droplet.
  const blips = 3 + Math.round(quality * 4);
  for (let i = 0; i < blips; i++) {
    const at = now + 0.03 + Math.random() * 0.14;
    const blip = audioCtx.createOscillator();
    blip.type = 'square';
    blip.frequency.value = base * (2.5 + Math.random() * 3);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(SPLASH_GAIN * 0.35, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
    blip.connect(g).connect(filter);
    blip.start(at);
    blip.stop(at + 0.04);
    blip.onended = () => g.disconnect();
  }
  drop.onended = () => { dropGain.disconnect(); setTimeout(() => filter.disconnect(), 300); };
}
