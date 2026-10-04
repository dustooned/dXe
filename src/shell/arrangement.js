// The arrangement player: the browser side of a baked FL arrangement
// (scripts/build-arrangement.mjs). It owns no timing rules — those live in
// engine/arrangementClock.js — it just feeds the clock the real audio clock
// and turns the notes it emits into sound.
//
// Notes are scheduled ahead on the AudioContext clock (never played from
// timers), so a late timer cannot make the music stumble. The same property
// makes the sideways pause (shell/orientationPause.js) free: the context is
// suspended, its clock stops, and nothing more gets scheduled until it resumes.
import { createClock } from '../engine/arrangementClock.js';
import { getAudioGraph } from './audio.js';
import { DRUM_MAP, VOICE_SETS, playDrum, playMelodic } from './arrangementVoices.js';

const LOOKAHEAD_S = 0.25; // how far ahead notes are scheduled
const INTERVAL_MS = 50; // how often the scheduler wakes up
// The whole arrangement vs the rest of the mix. A leitmotif holds one tone at 0.14;
// this is many short notes (a drums-only intro is mostly silence between hits), so
// it sits higher to read as music at all. Measured at the confrontation.
export const DEFAULT_LEVEL = 0.24;
const LEVEL = DEFAULT_LEVEL;

export function createArrangementPlayer(data, { voiceSet = data.id, tuning = {} } = {}) {
  // Tuning (shell/soundTuning.js) sits over the defaults and can change live.
  const voices = {};
  let drumMap = DRUM_MAP;
  let level = LEVEL;
  const applyTuning = (t = {}) => {
    for (const k of Object.keys(voices)) delete voices[k];
    for (const [part, cfg] of Object.entries(VOICE_SETS[voiceSet] ?? {})) voices[part] = { ...cfg, ...(t.voices?.[part] ?? {}) };
    drumMap = { ...DRUM_MAP, ...(t.drums ?? {}) };
    level = t.level ?? LEVEL;
    if (bus && graph) bus.gain.setTargetAtTime(level, graph.ctx.currentTime, 0.03);
  };
  let clock = createClock(data);
  const partState = new Map(data.parts.map((p) => [p.id, { volume: 1, muted: false, solo: false, secret: !!p.secret, gain: null }]));
  // The secret track (a part flagged `secret`) stays silent until this is on.
  let secretOn = false;
  let secretFade = 3;
  const live = new Set(); // sounding nodes, so stop() can end them
  let graph = null;
  let bus = null;
  let timer = null;
  applyTuning(tuning);

  const track = (node) => {
    live.add(node);
    node.addEventListener('ended', () => live.delete(node), { once: true });
  };

  function applyMix() {
    if (!graph) return;
    const anySolo = [...partState.values()].some((p) => p.solo);
    for (const p of partState.values()) {
      const audible = (anySolo ? p.solo : !p.muted) && (!p.secret || secretOn);
      p.gain.gain.setTargetAtTime(audible ? p.volume : 0, graph.ctx.currentTime, p.secret ? secretFade / 3 : 0.02);
    }
  }

  // `dest` defaults to the part's own mix channel; the sound player passes its own for auditions.
  function play(e, dest = partState.get(e.part)?.gain, g = graph) {
    // A part with no tuned voice yet (say, a new Secret channel) still sounds.
    const kind = data.parts.find((p) => p.id === e.part)?.kind;
    const cfg = voices[e.part] ?? (kind === 'drums' ? { voice: 'drums', level: 0.7 } : { voice: 'organ', level: 1 });
    if (!g || !dest) return;
    const ps = partState.get(e.part);
    if (ps) ps.lastWhen = e.when;
    if (cfg.voice === 'drums') {
      const piece = drumMap[e.key];
      if (piece && piece !== 'none') playDrum(g.ctx, dest, track, piece, e.when, e.velocity * cfg.level);
    } else {
      playMelodic(g.ctx, dest, track, cfg.voice, e.key, e.when, e.dur, e.velocity * cfg.level);
    }
  }

  const player = {
    get clock() { return clock; },
    data,
    get playing() { return timer !== null; },

    // Must be called from (or after) a user gesture — it creates/resumes the audio context.
    // A fresh clock each time: a new battle starts from the top of its section.
    start({ section, bpm } = {}) {
      if (timer) return;
      graph = getAudioGraph();
      clock = createClock(data, { bpm: bpm ?? data.bpm, section: section ?? data.sections[0].id });
      bus = graph.ctx.createGain();
      bus.gain.setValueAtTime(0, graph.ctx.currentTime);
      bus.gain.linearRampToValueAtTime(level, graph.ctx.currentTime + 0.08);
      bus.connect(graph.out);
      for (const p of partState.values()) { p.gain = graph.ctx.createGain(); p.gain.connect(bus); }
      applyMix();
      timer = setInterval(() => clock.pump(graph.ctx.currentTime, LOOKAHEAD_S, play), INTERVAL_MS);
      clock.pump(graph.ctx.currentTime, LOOKAHEAD_S, play);
    },

    // Fades out, then ends everything still sounding. Safe to call twice.
    stop({ fade = 0.12 } = {}) {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      const { ctx } = graph;
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + fade);
      const nodes = [...live];
      const closing = bus;
      for (const n of nodes) { try { n.stop(t + fade + 0.02); } catch { /* already ended */ } }
      setTimeout(() => closing.disconnect(), (fade + 0.2) * 1000);
      live.clear();
      graph = null;
      bus = null;
    },

    // Tempo and section changes — see engine/arrangementClock.js.
    setTuning: applyTuning,
    // Fade the whole arrangement out (and back) without stopping its clock.
    duck(on, fade = 0.8) {
      if (!bus || !graph) return;
      bus.gain.setTargetAtTime(on ? 0.0001 : level, graph.ctx.currentTime, Math.max(0.01, fade / 3));
    },
    // Bring the secret track in (or take it out) over `fade` seconds.
    setSecret(on, fade = 3) { secretOn = !!on; secretFade = fade; applyMix(); },
    hasSecret: () => data.parts.some((p) => p.secret),
    // Each part's current output level (0 = silent), for checks and the sound player.
    mix: () => Object.fromEntries([...partState].map(([id, p]) => [id, p.gain ? +p.gain.gain.value.toFixed(3) : 0])),
    // What the voices are set to right now (defaults plus tuning).
    config: () => ({ level, voices: structuredClone(voices), drumMap: { ...drumMap } }),
    // Sound one note now, playing or not — for checking a voice or a drum key.
    audition(partId, key, seconds = 0.5) {
      const g = getAudioGraph();
      const out = g.ctx.createGain();
      out.gain.value = level * 4;
      out.connect(g.out);
      play({ part: partId, key, velocity: 100, when: g.ctx.currentTime + 0.02, dur: seconds }, out, g);
      setTimeout(() => out.disconnect(), (seconds + 1.2) * 1000);
    },
    setBpm: (bpm, opts) => clock.setBpm(bpm, opts),
    queueSection: (id, quantize) => clock.queueSection(id, quantize),
    sectionIds: () => clock.sectionIds(),

    setVolume(id, v) { const p = partState.get(id); if (p) { p.volume = Math.max(0, Math.min(1, v)); applyMix(); } },
    setMuted(id, m) { const p = partState.get(id); if (p) { p.muted = m; applyMix(); } },
    setSolo(id, s) { const p = partState.get(id); if (p) { p.solo = s; applyMix(); } },
    partState: (id) => ({ ...partState.get(id), gain: undefined }),

    state() {
      const now = graph ? graph.ctx.currentTime : 0;
      // Which parts have sounded in the last second, for the sound player's lights.
      const active = Object.fromEntries([...partState].map(([id, p]) => [id, graph && p.lastWhen != null && now - p.lastWhen < 1 && p.lastWhen <= now + 0.3]));
      return { playing: !!timer, ...clock.state(now), voices: live.size, active, secret: secretOn };
    },
  };
  return player;
}
