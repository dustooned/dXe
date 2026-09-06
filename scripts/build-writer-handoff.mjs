#!/usr/bin/env node
// Builds writer-handoff/ — the self-contained folder handed to a writer.
//
// The docs in writer-handoff/*.md are hand-written and are NOT touched by this
// script. What it generates is the script itself:
//
//   script/        copies of the manuscript .txt files (the parseable pipeline)
//   script-extra/  everything else, extracted out of JSON/JS into plain text
//                  so the writer can edit it without touching code
//
// script-extra/ is a one-way extract: it's generated for the writer, and the
// edits come back by hand. Re-run this to refresh it against current content.
//
// Usage: npm run handoff
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CHAPTER = join('src', 'chapters', 'lake-ulysses');
const OUT = 'writer-handoff';
const SCRIPT_DIR = join(OUT, 'script');
const EXTRA_DIR = join(OUT, 'script-extra');

const HEADER = (title, note) => `# ${'='.repeat(60)}
# ${title}
# ${'='.repeat(60)}
#
# Edit the text under each [TAG]. Do NOT change the [TAG] lines themselves.
# Line breaks you type are real line breaks in the game.
# Lines starting with # are notes to you and are ignored.
#
# ${note}
#

`;

function json(name) {
  return JSON.parse(readFileSync(join(CHAPTER, 'content', `${name}.json`), 'utf8'));
}

// ── Cutscenes + confrontations ───────────────────────────────────────────────
function beatsToText(id, beats) {
  const out = [];
  beats.forEach((beat, i) => {
    const n = i + 1;
    if (beat.text) {
      const who = beat.speaker ? ` (${beat.speaker} speaking)` : '';
      out.push(`[${id} / beat ${n}]${who}`);
      out.push(beat.text);
      out.push('');
    }
    const options = beat.interactive?.options;
    if (options) {
      options.forEach((opt, j) => {
        out.push(`[${id} / beat ${n} / choice ${String.fromCharCode(65 + j)}] ${opt.label}`);
      });
      out.push('');
    }
  });
  return out.join('\n');
}

function buildCutscenes() {
  const parts = [
    HEADER('CUTSCENES — the opening of the chapter',
      'These play before the player meets anybody. Keep beats to ~6 short lines.'),
    '# --- THE QUOTE. Cold open, white text, no characters. ---\n',
    beatsToText('opening_quote', json('opening_quote').beats),
    "# --- BOB BAITER. The councilman's lake-reopening ad. The game's first lie.",
    '# Hand-wrapped on purpose — max 27 characters per line for the stilted read. ---\n',
    beatsToText('bob_baiter', json('bob_baiter').beats),
    '# --- PROLOGUE. Waking up on the shoulder of the road. ---\n',
    beatsToText('prologue', json('prologue').beats),
  ];
  writeFileSync(join(EXTRA_DIR, '1-cutscenes.txt'), parts.join('\n') + '\n');
}

function buildConfrontations() {
  const parts = [
    HEADER('CONFRONTATIONS — meeting each NPC face to face',
      'PLACEHOLDER PROSE — all of this is up for rewriting.\n# Each choice picks which line the NPC opens on. Keep choices under 44 characters.'),
  ];
  for (const npc of ['deborah', 'rwanda', 'samun', 'rick']) {
    parts.push(`# --- ${npc.toUpperCase()} ---\n`);
    parts.push(beatsToText(`confront_${npc}`, json(`confront_${npc}`).beats));
  }
  writeFileSync(join(EXTRA_DIR, '2-confrontations.txt'), parts.join('\n') + '\n');
}

// ── Mini-game rooms (extracted from the JS modules) ──────────────────────────
const CLASS_LINE = /^\s*(Guns|Bible|Crystals):\s*(['"])(.*)\2,?\s*$/;
const SPRITE_LINE = /sprite:\s*`\$\{SPR\}([a-z_]+)\.svg`/;
const PROMPT_LINE = /prompt:\s*\{\s*text:\s*(['"])(.*?)\1\s*\}/;

function buildRooms() {
  const parts = [
    HEADER('MINI-GAME ROOMS — the walk to each NPC',
      'PLACEHOLDER PROSE — all of this is up for rewriting.\n' +
      '# Every line has THREE versions, one per player class. Same room, different\n' +
      '# read on it: Guns = confrontational, Bible = looks for who still cares,\n' +
      '# Crystals = feels the atmosphere. Keep captions to ~3 lines.'),
  ];

  const files = readdirSync(join(CHAPTER, 'minigames')).filter((f) => f.endsWith('.js')).sort();
  for (const file of files) {
    const room = file.replace('.js', '');
    const lines = readFileSync(join(CHAPTER, 'minigames', file), 'utf8').split(/\r?\n/);
    parts.push(`# --- ${room.toUpperCase()} ---\n`);

    // Walk the file top-down: the first class-block is the room intro, and each
    // later one belongs to whichever object sprite was named just above it.
    let label = 'INTRO';
    let seenIntro = false;
    for (const line of lines) {
      const sprite = line.match(SPRITE_LINE);
      if (sprite && seenIntro) label = sprite[1].toUpperCase();

      const cls = line.match(CLASS_LINE);
      if (cls) {
        parts.push(`[${room} / ${label} / ${cls[1]}]`);
        parts.push(cls[3].replace(/\\'/g, "'").replace(/\\"/g, '"'));
        parts.push('');
        if (label === 'INTRO') seenIntro = true;
      }

      const prompt = line.match(PROMPT_LINE);
      if (prompt) {
        parts.push(`[${room} / QUICK BEAT — max 30 characters, no class variants]`);
        parts.push(prompt[2]);
        parts.push('');
      }
    }
  }
  writeFileSync(join(EXTRA_DIR, '3-rooms.txt'), parts.join('\n') + '\n');
}

// ── Endings ──────────────────────────────────────────────────────────────────
function buildEndings() {
  const endings = json('endings');
  const parts = [
    HEADER('ENDINGS — one of four, picked by final Truth Debt',
      'Each line below is its own line on screen. The epilogue is one extra\n# line added underneath, naming whichever meter moved furthest.'),
  ];
  for (const [key, val] of Object.entries(endings)) {
    if (key === 'epilogues') continue;
    parts.push(`# --- ${val.title} (${val.range}) ---\n`);
    val.text.forEach((line, i) => {
      parts.push(`[${key} / line ${i + 1}] ${line}`);
    });
    parts.push('');
  }
  parts.push('# --- EPILOGUE LINES (one is appended to whichever ending played) ---\n');
  for (const [stat, line] of Object.entries(endings.epilogues)) {
    parts.push(`[epilogue / ${stat}] ${line}`);
  }
  writeFileSync(join(EXTRA_DIR, '4-endings.txt'), parts.join('\n') + '\n');
}

// ── Reaction codas ───────────────────────────────────────────────────────────
function buildCodas() {
  const src = readFileSync(join('src', 'engine', 'reactions.js'), 'utf8');
  const parts = [
    HEADER('REACTION CODAS — the second half of every NPC reaction',
      'PLACEHOLDER PROSE — all of this is up for rewriting.\n' +
      '# After a swipe the player reads the NPC reaction, a blank line, then ONE of\n' +
      '# these — picked by the feeling they chose and which way they swiped. 16 lines\n' +
      '# cover the entire game, so keep them general. They describe DELIVERY — how the\n' +
      '# line left you — never whether the choice was right.'),
  ];
  const block = /^\s{2}(\w+):\s*\{$/;
  const entry = /^\s{4}(truth|lie):\s*(['"])(.*)\2,?\s*$/;
  let emotion = null;
  for (const line of src.split(/\r?\n/)) {
    const b = line.match(block);
    if (b) { emotion = b[1]; parts.push(`# --- ${emotion} ---`); continue; }
    const e = line.match(entry);
    if (e && emotion) {
      parts.push(`[coda / ${emotion} / ${e[1]}] ${e[3].replace(/\\'/g, "'")}`);
      if (e[1] === 'lie') parts.push('');
    }
  }
  writeFileSync(join(EXTRA_DIR, '5-codas.txt'), parts.join('\n') + '\n');
}

// ── Manuscript copies ────────────────────────────────────────────────────────
function copyManuscripts() {
  const dir = join(CHAPTER, 'manuscript');
  const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
  // Numbered by the order the player meets them, so the folder reads in order.
  const ORDER = ['therapist', 'deborah', 'rwanda', 'samun', 'rick'];
  for (const file of files) {
    const name = file.replace('.txt', '');
    const n = ORDER.indexOf(name);
    const prefix = n >= 0 ? `${n + 1}-` : '';
    copyFileSync(join(dir, file), join(SCRIPT_DIR, `${prefix}${file}`));
  }
  return files.length;
}

function main() {
  mkdirSync(SCRIPT_DIR, { recursive: true });
  mkdirSync(EXTRA_DIR, { recursive: true });

  const n = copyManuscripts();
  buildCutscenes();
  buildConfrontations();
  buildRooms();
  buildEndings();
  buildCodas();

  console.log(`writer-handoff/script/       ${n} manuscript files copied`);
  console.log('writer-handoff/script-extra/ 5 extract files written');
}

main();
