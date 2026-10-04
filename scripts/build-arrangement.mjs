#!/usr/bin/env node
// Bakes the notes from an FL Studio project into the small JSON file the
// arrangement player reads (src/shell/arrangement.js). Sound is NOT baked:
// FL's VST patches don't survive, so each part's voice is set in code
// (src/shell/arrangementVoices.js) and tuned by ear.
//
// Usage: node scripts/build-arrangement.mjs <project.flp> <id> [chapter-id] [--tonic=C]
// --tonic: the key's root note name; the confrontation chord is built on it.
//   e.g. node scripts/build-arrangement.mjs "E:/Music/EXP_049_.flp" rwanda
// Writes src/chapters/<chapter-id>/content/arrangements/<id>.json
// (chapter defaults to lake-ulysses). Each FL pattern becomes a section.
//
// Notes in the JSON are [tick, lengthTicks, key] (+ velocity if not 100),
// ticks at the project's PPQ. A section is its pattern, rounded up to whole
// bars. Why a drum part is recognized by name: FL exports every channel on
// MIDI channel 0, so there is no GM drum channel to go by.
//
// A channel whose name starts with "Secret" is the secret track: baked like
// any part, but held silent in the game until the player is close to a full
// connection (shell/battleMusic.js setCloseness).
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFlp } from './lib/flp.mjs';

const flags = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [, , flpPath, id, chapter = 'lake-ulysses'] = process.argv.filter((a) => !a.startsWith('--'));
if (!flpPath || !id) {
  console.error('usage: node scripts/build-arrangement.mjs <project.flp> <id> [chapter-id]');
  process.exit(1);
}

const BEATS_PER_BAR = 4; // FL's playlist time signature isn't read; 4/4 assumed
const flp = readFlp(flpPath);
const ticksPerBar = flp.ppq * BEATS_PER_BAR;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const parts = flp.channels
  .filter((c) => c.name)
  .map((c) => ({ rack: c.index, id: slug(c.name), label: c.name, kind: /drum|kick|snare|hat|perc/i.test(c.name) ? 'drums' : 'melodic', secret: /^secret/i.test(c.name) }));
if (!parts.length) throw new Error('no named channels found');

const sections = [];
for (const pat of flp.patterns) {
  if (!pat.notes.length) continue;
  const lastEnd = Math.max(...pat.notes.map((n) => n.tick + n.length));
  const ticks = Math.max(1, Math.ceil(lastEnd / ticksPerBar)) * ticksPerBar;
  const notes = {};
  for (const part of parts) {
    const mine = pat.notes
      .filter((n) => n.channel === part.rack)
      .sort((a, b) => a.tick - b.tick || a.key - b.key)
      .map((n) => (n.velocity === 100 ? [n.tick, n.length, n.key] : [n.tick, n.length, n.key, n.velocity]));
    if (mine.length) notes[part.id] = mine;
  }
  sections.push({ id: slug(pat.name ?? `pattern_${pat.id}`), name: pat.name ?? `Pattern ${pat.id}`, ticks, notes });
}

const out = {
  id,
  source: basename(flpPath),
  ppq: flp.ppq,
  bpm: flp.tempo ?? 100,
  beatsPerBar: BEATS_PER_BAR,
  ...(flags.tonic ? { tonic: flags.tonic } : {}),
  parts: parts.map(({ id: pid, label, kind, secret }) => ({ id: pid, label, kind, ...(secret ? { secret: true } : {}) })),
  sections,
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src', 'chapters', chapter, 'content', 'arrangements');
mkdirSync(dir, { recursive: true });
const file = join(dir, `${id}.json`);
writeFileSync(file, JSON.stringify(out) + '\n');

console.log(`${basename(flpPath)}: ${flp.ppq} PPQ, ${out.bpm} BPM, parts ${out.parts.map((p) => p.id).join(', ')}`);
for (const s of sections) {
  const counts = Object.entries(s.notes).map(([k, v]) => `${k} ${v.length}`).join(', ');
  console.log(`  ${s.id}: ${s.ticks / ticksPerBar} bars — ${counts}`);
}
console.log(`wrote ${file}`);
