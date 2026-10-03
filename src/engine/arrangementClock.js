// The musical clock behind the arrangement player: one position in ticks,
// one tempo, every part read off the same position. Pure — no audio, no
// timers — so it can be driven by a fake clock in Node (scripts/test-music.mjs)
// and by the real audio clock in the browser (shell/arrangement.js).
//
// Time is audio-clock seconds. Notes are scheduled in slices of a sixteenth:
// each slice's length comes from the tempo at that moment, so a tempo ramp
// just makes the next slices shorter or longer and every part moves together.
// A note's length in ticks is turned into seconds when it is scheduled, so a
// sustained note keeps the length it was given even if the tempo ramps while
// it rings (envelope times are seconds, not beats).
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const MIN_BPM = 30;
export const MAX_BPM = 300;

// Tempo at audio time t, for a linear ramp { from, to, t0, t1 }.
export function rampBpm(ramp, t) {
  if (t >= ramp.t1 || ramp.t1 <= ramp.t0) return ramp.to;
  if (t <= ramp.t0) return ramp.from;
  return ramp.from + (ramp.to - ramp.from) * ((t - ramp.t0) / (ramp.t1 - ramp.t0));
}

// Where a change may take effect: right away (next slice), on a beat, on a
// bar line, or only when the current pattern wraps.
function onBoundary(quantize, pos, ppq, barTicks) {
  switch (quantize) {
    case 'pattern': return pos === 0;
    case 'bar': return pos % barTicks === 0;
    case 'beat': return pos % ppq === 0;
    default: return true;
  }
}

// data: the baked arrangement (scripts/build-arrangement.mjs).
export function createClock(data, { bpm = data.bpm, section = data.sections[0].id } = {}) {
  const ppq = data.ppq;
  const barTicks = ppq * data.beatsPerBar;
  const sliceTicks = ppq / 4;
  const sections = new Map(data.sections.map((s) => [s.id, s]));
  if (!sections.has(section)) throw new Error(`unknown section "${section}"`);

  let current = sections.get(section);
  let pos = 0; // next tick to schedule, within `current`
  let time = null; // audio time at which `pos` sounds
  let ramp = { from: bpm, to: bpm, t0: 0, t1: 0 };
  let pendingTempo = null; // { bpm, rampSec, quantize }
  let pendingSection = null; // { id, quantize }

  function applyPending() {
    if (pendingSection && onBoundary(pendingSection.quantize, pos, ppq, barTicks)) {
      const next = sections.get(pendingSection.id);
      pendingSection = null;
      if (next && next !== current) { current = next; pos = 0; }
    }
    if (pendingTempo && onBoundary(pendingTempo.quantize, pos, ppq, barTicks)) {
      const { bpm: to, rampSec } = pendingTempo;
      pendingTempo = null;
      ramp = { from: rampBpm(ramp, time), to, t0: time, t1: time + Math.max(0, rampSec) };
    }
  }

  return {
    // Schedules everything that falls before now + horizon, calling
    // emit({ part, key, velocity, when, dur }) for each note.
    pump(now, horizon, emit) {
      if (time === null) time = now + 0.05;
      // Fell behind (a throttled tab): resume from now instead of replaying.
      if (time < now - 0.1) time = now + 0.02;
      while (time < now + horizon) {
        applyPending();
        const secPerTick = 60 / (rampBpm(ramp, time) * ppq);
        const end = Math.min(pos + sliceTicks, current.ticks);
        for (const [part, notes] of Object.entries(current.notes)) {
          for (const [tick, len, key, velocity = 100] of notes) {
            if (tick >= pos && tick < end) {
              emit({ part, key, velocity, when: time + (tick - pos) * secPerTick, dur: Math.max(0.02, len * secPerTick) });
            }
          }
        }
        time += (end - pos) * secPerTick;
        pos = end >= current.ticks ? 0 : end;
      }
    },

    // Change tempo toward `to`, smoothly over rampSec, starting at the next
    // allowed boundary. The latest request wins.
    setBpm(to, { rampSec = 2, quantize = 'now' } = {}) {
      pendingTempo = { bpm: clamp(to, MIN_BPM, MAX_BPM), rampSec, quantize };
    },

    // Switch section at the next allowed boundary (the new one starts at its
    // first tick). Re-queueing the section already playing cancels a pending change.
    queueSection(id, quantize = 'pattern') {
      if (!sections.has(id)) throw new Error(`unknown section "${id}"`);
      pendingSection = id === current.id ? null : { id, quantize };
    },

    // Where the clock is, for the dev panel. `now` is the audio time.
    state(now) {
      return {
        bpm: rampBpm(ramp, now),
        targetBpm: pendingTempo ? pendingTempo.bpm : ramp.to,
        section: current.id,
        pendingSection: pendingSection?.id ?? null,
        bar: Math.floor(pos / barTicks) + 1,
        beat: Math.floor((pos % barTicks) / ppq) + 1,
        bars: current.ticks / barTicks,
      };
    },

    sectionIds: () => [...sections.keys()],
  };
}
