#!/usr/bin/env node
// Converts writer-authored manuscript .txt files into the dialog JSON
// schema the game reads. See docs/SCRIPT_FORMAT.md for the format spec.
//
// Usage: node scripts/build-content.mjs           (all chapters)
//        node scripts/build-content.mjs lake-ulysses
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STAT_PATTERN = /^(integrity|trust|stability|lucidity)([+-]\d+)$/;

function parseEffects(line, fileName, lineNumber) {
  const effects = {};
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const match = token.match(STAT_PATTERN);
    if (!match) {
      throw new Error(`${fileName}:${lineNumber}: bad EFFECTS token "${token}"`);
    }
    effects[match[1]] = Number(match[2]);
  }
  return effects;
}

function parseDebt(line) {
  const value = line.trim();
  return value === '0' ? 0 : Number(value.replace('+', ''));
}

function parseManuscript(text, fileName) {
  const lines = text.split(/\r?\n/);
  let npc = null;
  let location = null;
  let accentColor = null;
  const nodes = {};

  let currentNodeId = null;
  let currentNode = null;
  let currentEdgeKey = null;
  let currentEdge = null;

  function commitEdge() {
    if (currentNodeId && currentEdgeKey && currentEdge) {
      currentNode.swipes[currentEdgeKey] = currentEdge;
    }
    currentEdgeKey = null;
    currentEdge = null;
  }

  function commitNode() {
    commitEdge();
    if (currentNodeId) {
      nodes[currentNodeId] = currentNode;
    }
    currentNodeId = null;
    currentNode = null;
  }

  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('NPC:')) {
      npc = line.slice(4).trim();
    } else if (line.startsWith('LOCATION:')) {
      location = Number(line.slice(9).trim());
    } else if (line.startsWith('ACCENT:')) {
      accentColor = line.slice(7).trim();
    } else if (line.startsWith('===')) {
      commitNode();
      currentNodeId = line.replace(/^=+/, '').trim();
      currentNode = { id: currentNodeId, npc, location, prompt: '', feelzOptions: [], swipes: {} };
    } else if (line.startsWith('PROMPT:')) {
      currentNode.prompt = line.slice(7).trim();
    } else if (line.startsWith('FEELZ:')) {
      currentNode.feelzOptions = line
        .slice(6)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (line.startsWith('--')) {
      commitEdge();
      const label = line.replace(/^-+/, '').trim().toLowerCase();
      if (label !== 'truth' && label !== 'lie') {
        throw new Error(`${fileName}:${lineNumber}: expected "-- TRUTH" or "-- LIE", got "${raw}"`);
      }
      currentEdgeKey = label;
      currentEdge = {
        playerText: '',
        npcReaction: '',
        effects: {},
        debtDelta: 0,
        tags: [],
        ledgerEntry: null,
        nextNodeId: null,
      };
    } else if (line.startsWith('SAY:')) {
      currentEdge.playerText = line.slice(4).trim();
    } else if (line.startsWith('REACT:')) {
      currentEdge.npcReaction = line.slice(6).trim();
    } else if (line.startsWith('EFFECTS:')) {
      currentEdge.effects = parseEffects(line.slice(8), fileName, lineNumber);
    } else if (line.startsWith('DEBT:')) {
      currentEdge.debtDelta = parseDebt(line.slice(5));
    } else if (line.startsWith('TAGS:')) {
      currentEdge.tags = line
        .slice(5)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (line.startsWith('LEDGER:')) {
      currentEdge.ledgerEntry = line.slice(7).trim();
    } else if (line.startsWith('NEXT:')) {
      const value = line.slice(5).trim();
      currentEdge.nextNodeId = value === '(end)' ? null : value;
    } else {
      throw new Error(`${fileName}:${lineNumber}: unrecognized line "${raw}"`);
    }
  });
  commitNode();

  return { npc, location, accentColor, nodes };
}

function buildChapter(chapterId) {
  const chapterDir = join('src', 'chapters', chapterId);
  const manuscriptDir = join(chapterDir, 'manuscript');
  const contentDir = join(chapterDir, 'content');

  if (!existsSync(manuscriptDir)) return;

  const files = readdirSync(manuscriptDir).filter((f) => f.endsWith('.txt'));
  for (const file of files) {
    const text = readFileSync(join(manuscriptDir, file), 'utf8');
    const parsed = parseManuscript(text, `${chapterId}/manuscript/${file}`);
    const outPath = join(contentDir, file.replace(/\.txt$/, '.json'));
    writeFileSync(outPath, JSON.stringify(parsed, null, 2) + '\n');
    console.log(`built ${outPath}`);
  }
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
