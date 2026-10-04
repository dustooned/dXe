// Browser approximations of the arrangement's instruments. FL's VST patches
// (Plogue chipsynth C64, a Commodore SID emulator) don't survive in the
// project data, so these are built from the SID's own vocabulary — pulse,
// triangle, noise, a filter, an ADSR — and tuned by ear against the stems.
//
// Every voice is a handful of oscillators with scheduled start and stop
// times. Envelope times are seconds, not beats: a held note keeps its
// scheduled length if the tempo ramps while it rings. Nothing here loops or
// sustains forever, so a stop can never leave a stuck note.
//
// A voice set maps a part id to a voice. Tuning lives in these tables.
export const VOICE_SETS = {
  rwanda: {
    organ: { voice: 'organ', level: 1.25 }, // tuned by ear in the sound player
    bass: { voice: 'bass', level: 0.85 },
    drum_01: { voice: 'drums', level: 0.7 },
  },
};

// Which kit piece each key on the drum part plays. A first guess from how the
// keys are used (49/50 on the beat in the verses, 53-55 ticking in the
// intro) — correct by ear. Pieces: kick, snare, click, hat, openHat.
export const DRUM_MAP = {
  49: 'snare',
  50: 'kick',
  53: 'click',
  54: 'hat',
  55: 'openHat',
};

const hz = (key) => 440 * 2 ** ((key - 69) / 12);

// Pulse wave with a given duty (0..1), as a PeriodicWave: the SID's signature
// timbre. Cached per context.
const pulseCache = new WeakMap();
function pulseWave(ctx, duty) {
  let byDuty = pulseCache.get(ctx);
  if (!byDuty) pulseCache.set(ctx, (byDuty = new Map()));
  if (!byDuty.has(duty)) {
    const N = 64;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
      imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
    }
    byDuty.set(duty, ctx.createPeriodicWave(real, imag));
  }
  return byDuty.get(duty);
}

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseCache.has(ctx)) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return noiseCache.get(ctx);
}

// Gate envelope: up over a, down to sustain s over d, hold until `dur`, then
// release over r. Returns the time the sound has fully died away.
function envelope(param, when, dur, peak, [a, d, s, r]) {
  const attackEnd = when + Math.min(a, dur);
  param.setValueAtTime(0, when);
  param.linearRampToValueAtTime(peak, attackEnd);
  param.setTargetAtTime(peak * s, attackEnd, Math.max(0.005, d / 3));
  const off = when + dur;
  param.setTargetAtTime(0, off, Math.max(0.005, r / 3));
  return off + r * 1.6;
}

// `track(node)` registers a node so stopAll() can end it early.
export function playMelodic(ctx, dest, track, kind, key, when, dur, velocity) {
  const v = velocity / 100;
  const f = hz(key);
  const out = ctx.createGain();
  out.connect(dest);
  let end;
  const oscs = [];
  const osc = (type, freq, gain, wave) => {
    const o = ctx.createOscillator();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    oscs.push(o);
    return g;
  };

  if (kind === 'bass') {
    // Pulse with a sub-octave under it, through a plucked low-pass.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(1900, when);
    lp.frequency.exponentialRampToValueAtTime(520, when + 0.16);
    osc(null, f, 1, pulseWave(ctx, 0.3)).connect(lp);
    osc('sine', f / 2, 0.55).connect(lp);
    lp.connect(out);
    end = envelope(out.gain, when, dur, 0.5 * v, [0.003, 0.14, 0.5, 0.05]);
  } else {
    // 'organ': a half-width pulse with a triangle an octave up, a gentle low-pass.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    osc(null, f, 0.8, pulseWave(ctx, 0.5)).connect(lp);
    osc('triangle', f * 2, 0.35).connect(lp);
    lp.connect(out);
    end = envelope(out.gain, when, dur, 0.34 * v, [0.004, 0.06, 0.82, 0.07]);
  }

  for (const o of oscs) {
    o.start(when);
    o.stop(end + 0.02);
    track(o);
  }
  oscs[0].onended = () => out.disconnect();
}

// One-shot kit pieces. Always finite, so they cannot hang.
export function playDrum(ctx, dest, track, piece, when, velocity) {
  const v = velocity / 100;
  const out = ctx.createGain();
  out.connect(dest);
  const stopAt = [];

  const tone = (type, f0, f1, len, peak) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    o.frequency.exponentialRampToValueAtTime(f1, when + len * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + len + 0.02);
    track(o);
    stopAt.push(o);
  };
  const noise = (filterType, freq, len, peak, q = 0.8) => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    s.connect(f).connect(g).connect(out);
    s.start(when);
    s.stop(when + len + 0.02);
    track(s);
    stopAt.push(s);
  };

  switch (piece) {
    // Balanced so a drums-only section (the intro) is clearly audible: the
    // noisy pieces carry less energy per peak than the kick, so they sit higher.
    case 'kick': tone('sine', 150, 42, 0.2, 0.95 * v); break;
    case 'snare': tone('triangle', 210, 140, 0.12, 0.5 * v); noise('bandpass', 1900, 0.18, 0.9 * v, 0.7); break;
    case 'click': tone('square', 1500, 700, 0.04, 0.5 * v); break;
    case 'openHat': noise('highpass', 6000, 0.24, 0.8 * v); break;
    case 'hat': default: noise('highpass', 7000, 0.06, 0.75 * v); break;
  }
  stopAt[0].onended = () => out.disconnect();
}
