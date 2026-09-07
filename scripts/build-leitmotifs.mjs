#!/usr/bin/env node
// Converts composer-authored MIDI files into the note-array shape
// shell/audio.js's leitmotif player reads: [{ note: 'A3', durationMs }].
// See docs/STAT_MATH.md's "Per-NPC leitmotif" section for the playback
// side (waveform choice stays hand-authored in audio.js — a MIDI file
// only ever supplies pitch and rhythm, never timbre).
//
// Where files go:
//   src/chapters/<chapter-id>/midi/<npc-name>.mid       <- you drop this in
//   src/chapters/<chapter-id>/content/leitmotifs.json   <- generated, don't hand-edit
//
// Usage: node scripts/build-leitmotifs.mjs           (all chapters)
//        node scripts/build-leitmotifs.mjs lake-ulysses
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '@tonejs/midi';
const { Midi } = pkg;

// The NPC key is derived straight from the filename (deborah.mid ->
// DEBORAH) with no fuzzy matching — a typo'd filename would otherwise
// silently produce a leitmotifs.json entry nothing in audio.js's
// LEITMOTIFS ever reads, and the NPC would just keep playing its
// placeholder phrase forever with no error anywhere. Checked against this
// list instead. THERAPIST isn't here — that leitmotif is a real audio
// file (`url`), not MIDI-driven. Known simplification: hardcoded per-NPC
// like the rest of this pipeline, not derived from a second chapter yet.
const KNOWN_NPC_KEYS = ['DEBORAH', 'RWANDA', 'SAMUN', 'RICK'];

// Playback is monophonic (one oscillator at a time, see audio.js's
// playNote) — a chord in the MIDI has no single "right" note to play, so
// this keeps the highest-pitched note in the stack and drops the rest,
// warning so it's a visible choice, not a silent one.
function dropChordsKeepHighest(notes, fileName) {
  const byStartTime = new Map();
  for (const note of notes) {
    const key = note.time.toFixed(4);
    const existing = byStartTime.get(key);
    if (!existing || note.midi > existing.midi) byStartTime.set(key, note);
  }
  const kept = [...byStartTime.values()].sort((a, b) => a.time - b.time);
  const droppedCount = notes.length - kept.length;
  if (droppedCount > 0) {
    console.log(`  ${fileName}: dropped ${droppedCount} note(s) from chords, kept the top voice`);
  }
  return kept;
}

// durationMs is "time until the next note fires," not the note's own
// sustain length — that's what audio.js's setTimeout-chained playNote()
// actually schedules on. Using each note's own (often shorter, staccato)
// duration field instead would leave silent gaps our player can't
// represent, and notes would fire faster than intended. The last note
// wraps to the track's total duration, closing the loop back to note 0.
function toNoteArray(notes, totalDuration) {
  return notes.map((note, i) => {
    const nextTime = i + 1 < notes.length ? notes[i + 1].time : totalDuration;
    const durationMs = Math.round((nextTime - note.time) * 1000);
    return { note: note.name, durationMs: Math.max(durationMs, 50) };
  });
}

function parseMidiFile(path, fileName) {
  const midi = new Midi(readFileSync(path));
  const track = midi.tracks.reduce(
    (longest, t) => (t.notes.length > longest.notes.length ? t : longest),
    midi.tracks[0]
  );
  if (!track || track.notes.length === 0) {
    throw new Error(`${fileName}: no notes found in any track`);
  }
  const notes = dropChordsKeepHighest(track.notes, fileName);
  return toNoteArray(notes, midi.duration);
}

function buildChapter(chapterId) {
  const chapterDir = join('src', 'chapters', chapterId);
  const midiDir = join(chapterDir, 'midi');
  const contentDir = join(chapterDir, 'content');

  if (!existsSync(midiDir)) return;

  // Always writes the full current state of midi/ — including an empty {}
  // if every .mid was removed — rather than leaving a stale entry behind
  // for a file that's no longer there.
  const files = readdirSync(midiDir).filter((f) => f.endsWith('.mid') || f.endsWith('.midi'));

  const leitmotifs = {};
  for (const file of files) {
    const npcKey = file.replace(/\.(mid|midi)$/, '').toUpperCase();
    const fileName = `${chapterId}/midi/${file}`;
    if (!KNOWN_NPC_KEYS.includes(npcKey)) {
      console.warn(
        `  WARNING: ${fileName} -> "${npcKey}" doesn't match any known NPC ` +
        `(${KNOWN_NPC_KEYS.join(', ')}). Typo in the filename? This will be ` +
        `written to leitmotifs.json but nothing in-game will ever read it.`
      );
    }
    leitmotifs[npcKey] = parseMidiFile(join(midiDir, file), fileName);
    console.log(`  ${fileName} -> ${npcKey} (${leitmotifs[npcKey].length} notes)`);
  }

  const outPath = join(contentDir, 'leitmotifs.json');
  writeFileSync(outPath, JSON.stringify(leitmotifs, null, 2) + '\n');
  console.log(`built ${outPath}`);
}

function main() {
  const chaptersDir = join('src', 'chapters');
  const requested = process.argv[2];

  const chapterIds = requested ? [requested] : readdirSync(chaptersDir);
  for (const chapterId of chapterIds) {
    buildChapter(chapterId);
  }
}

main();
