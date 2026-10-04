#!/usr/bin/env node
// Checks the battle-tempo rules (src/engine/tempoDirector.js) and the
// arrangement clock (src/engine/arrangementClock.js) with a fake audio clock.
// Run: node scripts/test-music.mjs
import { readFileSync } from 'node:fs';
import { createClock, rampBpm } from '../src/engine/arrangementClock.js';
import { createTempoDirector } from '../src/engine/tempoDirector.js';

const data0 = JSON.parse(readFileSync(new URL('../src/chapters/lake-ulysses/content/arrangements/rwanda.json', import.meta.url), 'utf8'));

// The emotion model is still there for experiments; its tests run in that mode.
const EMO = { drive: 'emotion', fullAfterAnswers: 2 };
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ── Tempo director ──────────────────────────────────────────────────────────
{
  const d = createTempoDirector(EMO);
  check('default battle starts at 100 BPM', near(d.state().targetBpm, 100) && d.state().stateId === 'guarded', `${d.state().targetBpm} ${d.state().stateId}`);

  let last = d.state().targetBpm;
  let monotonic = true;
  for (let i = 0; i < 4; i++) { const s = d.tensionIncreased(); if (s.targetBpm < last) monotonic = false; last = s.targetBpm; }
  check('rising tension raises the target BPM', last > 100 && monotonic, `100 -> ${last.toFixed(1)}`);

  for (let i = 0; i < 40; i++) d.tensionIncreased();
  check('repeated tension stays within max BPM', d.state().targetBpm <= d.config.maxBpm && near(d.state().targetBpm, 140), `${d.state().targetBpm} (${d.state().stateId})`);

  let prev = d.state().targetBpm; let down = true;
  for (let i = 0; i < 12; i++) { const s = d.connectionSucceeded(); if (s.targetBpm > prev + 1e-9) down = false; prev = s.targetBpm; }
  check('connection lowers the target toward a calmer one', down && prev < 140, `140 -> ${prev.toFixed(1)}`);

  for (let i = 0; i < 60; i++) { d.connectionSucceeded(); d.opponentCalmed(); }
  check('repeated calming stays within min BPM', d.state().targetBpm >= d.config.minBpm && near(d.state().targetBpm, 80), `${d.state().targetBpm} (${d.state().stateId})`);

  const s = d.battleStarted();
  check('a new battle resets emotional state and tempo', near(s.targetBpm, 100) && s.stateId === 'guarded' && s.connection === 0 && near(s.tension, 0.25), `${s.targetBpm} ${s.stateId}`);

  const o = d.battleStarted({ bpm: 90 });
  check('an encounter can override the starting tempo', near(o.targetBpm, 90), `${o.targetBpm}`);
  const o2 = d.tensionIncreased();
  check('changes move relative to the override', o2.targetBpm > 90 && o2.targetBpm < 100, `${o2.targetBpm.toFixed(1)}`);

  const c0 = d.state();
  const c1 = d.setConnection(0.9);
  check('setConnection sets the connection outright and pulls the music calmer', near(c1.connection, 0.9) && c1.targetBpm < c0.targetBpm, `${c0.targetBpm.toFixed(0)} -> ${c1.targetBpm.toFixed(0)}`);
  const e0 = d.state().tension; d.tensionEased();
  check('tensionEased lowers tension', d.state().tension < e0);

  const beforeEnd = d.state();
  d.battleEnded();
  const after = d.tensionIncreased();
  check('events after battleEnded do nothing', after.active === false && near(after.tension, beforeEnd.tension));

  // state label hysteresis: the label flips later going up than it flips back going down
  const h = createTempoDirector(EMO);
  let up = null;
  for (let i = 0; i < 200 && !up; i++) { const x = h.tensionIncreased(0.05); if (x.stateId !== 'guarded') up = x.level; }
  let back = null;
  for (let i = 0; i < 400 && !back; i++) { const x = h.connectionSucceeded(0.05); if (x.stateId === 'guarded') back = x.level; }
  check('state label has a dead zone (no flapping at a boundary)', up !== null && back !== null && back < up - 0.04, `flips up at level ${up?.toFixed(3)}, back at ${back?.toFixed(3)}`);

  // Instruments build with the conversation, not the tension
  const g = createTempoDirector(EMO);
  const early = g.state().section;
  g.connectionSucceeded(4); g.setConnection(0.9); // very warm, but no answers yet
  check('before the full-band answers, the thin layer plays whatever the tension', g.state().section === 'intro_b' && early === 'intro_b', g.state().section);
  g.answerGiven(); const one = g.state().section;
  g.answerGiven(); const warmFull = g.state();
  check('a warm run still grows into the full band (slow, gentle)', one === 'intro_b' && warmFull.section === 'intro_c' && warmFull.targetBpm <= 90, `${warmFull.section} ${warmFull.targetBpm.toFixed(0)} BPM`);
  const h2 = createTempoDirector(EMO);
  for (let i = 0; i < 10; i++) h2.tensionIncreased(2);
  h2.answerGiven(); h2.answerGiven();
  check('a cold run grows into the full band, harder and faster', h2.state().section === 'verse_002' && h2.state().targetBpm >= 130, `${h2.state().section} ${h2.state().targetBpm.toFixed(0)} BPM`);
  const parts = (id) => Object.keys(data0.sections.find((s) => s.id === id).notes).length;
  check('every full-band section carries all three parts', ['intro_c', 'intro_bridge', 'verse_001', 'verse_002'].every((s) => parts(s) === 3));
  check('a new battle starts the band over', h2.battleStarted().answers === 0 && h2.state().section === 'intro_b');
}

// ── Phase-driven battle (the game's mode) ───────────────────────────────────
{
  const d = createTempoDirector(); // default drive: phase
  const seq = [d.state()];
  for (let i = 0; i < 4; i++) seq.push(d.answerGiven());
  check('a battle opens on the thin layer at 100 BPM', seq[0].section === 'intro_b' && near(seq[0].targetBpm, 100), `${seq[0].section} ${seq[0].targetBpm}`);
  check('each answer escalates one step: bridge, verse, verse 2', seq.slice(1).map((s) => s.section).join(' ') === 'intro_bridge verse_001 verse_002 verse_002', seq.slice(1).map((s) => s.section).join(' '));
  check('tempo climbs with the phases and stops at the top', seq.map((s) => Math.round(s.targetBpm)).join(' ') === '100 110 125 140 140', seq.map((s) => Math.round(s.targetBpm)).join(' '));
  const c = createTempoDirector();
  c.setConnection(1); c.connectionSucceeded(4); c.tensionEased(4); c.opponentCalmed(4);
  const before = c.state();
  check('connection and warm answers do not change the music in phase mode', before.section === 'intro_b' && near(before.targetBpm, 100), `${before.section} ${before.targetBpm}`);
  const w = createTempoDirector(); w.setConnection(1);
  for (let i = 0; i < 3; i++) w.answerGiven();
  const k = createTempoDirector(); k.tensionIncreased(4);
  for (let i = 0; i < 3; i++) k.answerGiven();
  check('a deeply connected run and a cold run escalate identically', w.state().section === k.state().section && near(w.state().targetBpm, k.state().targetBpm), `${w.state().section} / ${k.state().section}`);
}

// ── Arrangement clock ───────────────────────────────────────────────────────
const data = JSON.parse(readFileSync(new URL('../src/chapters/lake-ulysses/content/arrangements/rwanda.json', import.meta.url), 'utf8'));
const PPQ = data.ppq;

function run(clock, seconds, { step = 0.025, horizon = 0.12, at } = {}) {
  const events = [];
  for (let t = 0; t <= seconds; t += step) {
    at?.(t);
    clock.pump(t, horizon, (e) => events.push(e));
  }
  return events;
}

{
  const clock = createClock(data, { section: 'verse_001' });
  const ev = run(clock, 9.7); // 2 patterns of 8 beats at 100 BPM = 4.8 s each
  const sec = data.sections.find((s) => s.id === 'verse_001');
  const perPass = Object.values(sec.notes).reduce((n, a) => n + a.length, 0);
  check('every note is scheduled exactly once per pass', ev.length >= perPass * 2 - 2 && ev.length <= perPass * 2 + 4, `${ev.length} events, ${perPass}/pass`);

  const first = ev.filter((e) => near(e.when, ev[0].when, 1e-9));
  const parts = new Set(first.map((e) => e.part));
  check('notes on the same tick share one start time (parts in sync)', parts.size >= 2, [...parts].join('+'));

  const org = ev.filter((e) => e.part === 'organ');
  const spacing = (org[1].when - org[0].when);
  const expected = (192 - 0) * 60 / (100 * PPQ); // organ notes at tick 0 then 192
  check('steady tempo timing: 192 ticks at 100 BPM = 1.2 s', near(spacing, expected, 1e-6), `${spacing.toFixed(4)} vs ${expected}`);
  check('every note has a positive length', ev.every((e) => e.dur > 0));
  check('start times never go backwards within a part', ['organ', 'bass', 'drum_01'].every((p) => { const t = ev.filter((e) => e.part === p).map((e) => e.when); return t.every((x, i) => i === 0 || x >= t[i - 1]); }));
}

{
  // Tempo ramp mid-song: 100 -> 140 over 4 s, requested at t=1 on the next beat
  const clock = createClock(data, { section: 'intro_c' });
  const ev = run(clock, 16, { at: (t) => { if (Math.abs(t - 1) < 1e-9) clock.setBpm(140, { rampSec: 4, quantize: 'beat' }); } });
  check('ramp: nothing restarts (notes keep coming)', ev.length > 60, `${ev.length} events`);
  // key 50 on the bass is the first note of each pass: gaps between them are the pass lengths
  const starts = ev.filter((e) => e.part === 'bass' && e.key === 50).map((e) => e.when);
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  const monotone = gaps.every((g, i) => i === 0 || g <= gaps[i - 1] + 1e-9);
  check('ramp: each pass is shorter than the one before until the target', monotone && gaps[0] > 3.9 && gaps[0] < 4.8 && gaps[gaps.length - 1] < 3.5, gaps.map((g) => g.toFixed(2)).join(' '));
  check('ramp: settles at 140 BPM (768 ticks = 3.43 s)', near(gaps[gaps.length - 1], 768 * 60 / (140 * PPQ), 0.01), gaps[gaps.length - 1].toFixed(3));
  const st = clock.state(15.9);
  check('ramp: reaches the target BPM', near(st.bpm, 140, 0.01), `bpm ${st.bpm.toFixed(2)}`);
  // every pass starts with a bass note (key 50), an organ note (35) and a drum hit (55) on tick 0
  const locked = starts.every((w) => ev.some((e) => e.part === 'organ' && e.key === 35 && e.when === w) && ev.some((e) => e.part === 'drum_01' && e.key === 55 && e.when === w));
  check('ramp: all three parts hit tick 0 at the identical time, every pass', locked && starts.length >= 3, `${starts.length} passes`);
  check('ramp: tempo at mid-ramp is between start and target', (() => { const r = { from: 100, to: 140, t0: 1, t1: 5 }; const m = rampBpm(r, 3); return near(m, 120); })());
}

{
  // Section changes land on the allowed boundary and start at tick 0
  const clock = createClock(data, { section: 'intro_a' });
  const ev = [];
  for (let t = 0; t <= 14; t += 0.025) {
    if (Math.abs(t - 1) < 1e-9) clock.queueSection('verse_002', 'pattern');
    clock.pump(t, 0.12, (e) => ev.push({ ...e, t }));
  }
  const firstOrgan = ev.find((e) => e.part === 'organ');
  const patternSec = 768 * 60 / (100 * PPQ); // 4.8 s
  check('queued section waits for the pattern to finish (no cut mid-phrase)', firstOrgan && firstOrgan.when >= patternSec + 0.04, `first organ at ${firstOrgan?.when.toFixed(3)} (pattern ends ${patternSec + 0.05})`);
  check('queued section switches without stopping the beat', ev.some((e) => e.part === 'drum_01' && e.when > patternSec && e.when < patternSec + 0.5));
}

{
  // Falling far behind (throttled tab) resumes cleanly, no flood of old notes
  const clock = createClock(data, { section: 'verse_001' });
  const ev = [];
  clock.pump(0, 0.12, (e) => ev.push(e));
  clock.pump(30, 0.12, (e) => ev.push(e));
  check('after a long stall the clock resumes near "now"', ev.every((e) => e.when < 31) && ev.filter((e) => e.when > 5).length < 12, `${ev.length} events`);
}

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
