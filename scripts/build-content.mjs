#!/usr/bin/env node
// Converts writer-authored manuscript .txt files into the dialog JSON
// schema the game reads. See docs/SCRIPT_FORMAT.md for the format spec.
//
// Usage: node scripts/build-content.mjs           (all chapters)
//        node scripts/build-content.mjs lake-ulysses
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STAT_PATTERN = /^(integrity|trust|stability|lucidity)([+-]\d+)$/;
const GATE_PATTERN = /^(integrity|trust|stability|lucidity)\s*(<=|>=|<|>)\s*(\d+)\s*->\s*(\S+)$/;
const EMOTIONS = ['Happy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anxiety'];
const CLASSES = ['Guns', 'Bible', 'Crystals'];
const PICK_PATTERN = /^PICK\s+(\w+):\s*(.*)$/;
const REVEAL_PATTERN = /^(meters|debt)\s+after\s+(\S+)$/;
// Inside `=== OUTRO`: LINE / HANGUP / NOTIFY / IT / SO / TRYCALL, each with an optional
// [condition] before the colon — see docs/SCRIPT_FORMAT.md.
const OUTRO_PATTERN = /^(LINE|HANGUP|NOTIFY|IT|SO|TRYCALL)(?:\s*\[([^\]]*)\])?:\s*(.*)$/;

// "[Guns]", "[therapist_02=lie]", or both comma-separated — every part has
// to hold for the beat to play.
function parseCondition(text, fileName, lineNumber) {
  const when = {};
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (CLASSES.includes(part)) {
      when.class = part;
      continue;
    }
    const match = part.match(/^(\S+)=(truth|lie)$/);
    if (!match) {
      throw new Error(`${fileName}:${lineNumber}: bad condition "${part}" (expected a class name or node_id=truth|lie)`);
    }
    when.choice = { node: match[1], side: match[2] };
  }
  return when;
}

function parseGate(line, fileName, lineNumber) {
  const match = line.trim().match(GATE_PATTERN);
  if (!match) {
    throw new Error(`${fileName}:${lineNumber}: bad GATE line "${line}"`);
  }
  const [, stat, op, value, elseNodeId] = match;
  return { stat, op, value: Number(value), elseNodeId };
}

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

// PROMPT:/SAY:/REACT: are each one physical line in the manuscript format,
// but the typewriter engine already renders a real "\n" character as a line
// break (src/ui/typewriterText.js). Writing \n (backslash-n) lets a writer
// author a break without the parser needing multi-line field continuation.
function parseText(line) {
  return line.trim().replace(/\\n/g, '\n');
}

function parseManuscript(text, fileName) {
  const lines = text.split(/\r?\n/);
  let npc = null;
  let location = null;
  let accentColor = null;
  let portrait = null;
  const nodes = {};
  const reveal = {};
  const connect = {};
  const story = [];
  const contactAsk = {};
  const pushAway = {};
  let storyIt = null;
  let storySo = null;
  const opener = {};
  const outro = [];
  let inOutro = false;

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
    } else if (line.startsWith('PORTRAIT:')) {
      portrait = line.slice(9).trim();
    } else if (line.startsWith('OPENER')) {
      // How this NPC sizes up the player's class: a line before the first
      // prompt of the encounter, whichever node that turns out to be.
      const m = line.match(/^OPENER \[(Guns|Bible|Crystals)\]:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad OPENER line "${raw}"`);
      opener[m[1]] = parseText(m[2]);
    } else if (line.startsWith('CLASS [')) {
      // A line before this node's prompt, for one class only.
      const m = line.match(/^CLASS \[(Guns|Bible|Crystals)\]:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad CLASS line "${raw}"`);
      currentNode.byClass = { ...currentNode.byClass, [m[1]]: parseText(m[2]) };
    } else if (line.startsWith('CONTACT')) {
      // After the connection beat: they ask to stay in touch (one per class),
      // and their contact joins the dock.
      const m = line.match(/^CONTACT \[(Guns|Bible|Crystals)\]:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad CONTACT line "${raw}" (CONTACT [Guns|Bible|Crystals]: text)`);
      contactAsk[m[1]] = parseText(m[2]);
    } else if (line.startsWith('PUSHAWAY')) {
      // The encounter ends without them trusting you: their bust comes up close
      // and they push you away, saying what they wish someone had done just now
      // (one {color:Feeling}word{/color} is the hint). One per class.
      const m = line.match(/^PUSHAWAY \[(Guns|Bible|Crystals)\]:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad PUSHAWAY line "${raw}" (PUSHAWAY [Guns|Bible|Crystals]: text)`);
      pushAway[m[1]] = parseText(m[2]);
    } else if (line.startsWith('STORYIT:')) {
      // After their STORY, in the silence: IT weighs how true it rings.
      storyIt = parseText(line.slice(8));
    } else if (line.startsWith('STORYSO:')) {
      // ...and SO doubts a corner of it, without doubting the person.
      storySo = parseText(line.slice(8));
    } else if (line.startsWith('STORY:')) {
      // The cutscene you earn by connecting: right after the CONNECT beat,
      // they tell you, in their own words, the wound that led them here.
      // One STORY line per beat, in order; the same for every class.
      story.push(parseText(line.slice(6)));
    } else if (line.startsWith('CONNECT')) {
      // The connection moment (dialogScene.js showConnection): the story beat
      // played when this NPC first trusts the player, one per class.
      const m = line.match(/^CONNECT \[(Guns|Bible|Crystals)\]:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad CONNECT line "${raw}" (CONNECT [Guns|Bible|Crystals]: text)`);
      connect[m[1]] = parseText(m[2]);
    } else if (line.startsWith('REVEAL:')) {
      const match = line.slice(7).trim().match(REVEAL_PATTERN);
      if (!match) throw new Error(`${fileName}:${lineNumber}: bad REVEAL line "${raw}"`);
      reveal[match[1]] = match[2];
    } else if (line.startsWith('===')) {
      commitNode();
      const id = line.replace(/^=+/, '').trim();
      if (id === 'OUTRO') {
        inOutro = true;
        return;
      }
      inOutro = false;
      currentNodeId = id;
      currentNode = { id: currentNodeId, npc, location, prompt: '', swipes: {} };
    } else if (inOutro) {
      const match = line.match(OUTRO_PATTERN);
      if (!match) throw new Error(`${fileName}:${lineNumber}: unrecognized OUTRO line "${raw}"`);
      const beat = { kind: match[1].toLowerCase(), text: parseText(match[3]) };
      if (match[2]) beat.when = parseCondition(match[2], fileName, lineNumber);
      outro.push(beat);
    } else if (line.startsWith('PICK ')) {
      const match = line.match(PICK_PATTERN);
      if (!match || !EMOTIONS.includes(match[1])) {
        throw new Error(`${fileName}:${lineNumber}: bad PICK line "${raw}"`);
      }
      currentNode.picks = { ...currentNode.picks, [match[1]]: parseText(match[2]) };
    } else if (line.startsWith('SPOTLIGHT:')) {
      const parts = line.slice(10).split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.length || parts.some((p) => p !== 'wheel' && p !== 'card')) {
        throw new Error(`${fileName}:${lineNumber}: bad SPOTLIGHT line "${raw}" (expected wheel and/or card)`);
      }
      currentNode.spotlight = parts;
    } else if (line.startsWith('PROMPT:')) {
      currentNode.prompt = parseText(line.slice(7));
    } else if (line.startsWith('MASK:')) {
      // The feeling they show (screen color, oscilloscope) while MOOD, the
      // real one, is what attunement needs. The prompt's colored word hints
      // at the real one; contacts on a call see through it.
      const mask = line.slice(5).trim();
      if (!EMOTIONS.includes(mask)) throw new Error(`${fileName}:${lineNumber}: bad MASK "${mask}"`);
      currentNode.mask = mask;
    } else if (line.startsWith('MOOD:')) {
      // The NPC's feeling at this moment: tints the oscilloscope, and a
      // matching FEELZ pick counts as attunement (Trust).
      const mood = line.slice(5).trim();
      if (!EMOTIONS.includes(mood)) throw new Error(`${fileName}:${lineNumber}: bad MOOD "${mood}"`);
      currentNode.mood = mood;
    } else if (line.startsWith('BID:')) {
      // A vulnerable moment. Which answer(s) turn toward it: truth, lie, or both.
      const value = line.slice(4).trim().toLowerCase();
      const sides = { truth: ['truth'], lie: ['lie'], both: ['truth', 'lie'] }[value];
      if (!sides) throw new Error(`${fileName}:${lineNumber}: bad BID "${value}" (truth, lie or both)`);
      currentNode.bid = sides;
    } else if (line.startsWith('GATE:')) {
      currentNode.gate = parseGate(line.slice(5), fileName, lineNumber);
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
      currentEdge.playerText = parseText(line.slice(4));
    } else if (line.startsWith('REACT:')) {
      currentEdge.npcReaction = parseText(line.slice(6));
    } else if (line.startsWith('EFFECTS:')) {
      currentEdge.effects = parseEffects(line.slice(8), fileName, lineNumber);
    } else if (line.startsWith('DEBT:')) {
      // `DEBT: 0!` pins a TRUTH at exactly 0, opting out of the engine's
      // default truth cleanse (cardEngine.js's TRUTH_CLEANSE).
      const value = line.slice(5).trim();
      if (value === '0!') {
        currentEdge.debtDelta = 0;
        currentEdge.debtFixed = true;
      } else {
        currentEdge.debtDelta = parseDebt(value);
      }
    } else if (line.startsWith('TAGS:')) {
      currentEdge.tags = line
        .slice(5)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (line.startsWith('IF PICK ') || line.startsWith('IF GIFT ')) {
      // Variations on this answer's REACT:. IF PICK <Emotion>: a line said
      // before it when the player picked that feeling. IF GIFT <Emotion|none>:
      // a line said after it when this answer unlocked that feeling (or, for
      // "none", when it turned toward a bid but there was nothing to give).
      const m = line.match(/^IF (PICK|GIFT) (\w+):\s*(.*)$/);
      if (!m || (m[2] !== 'none' && !EMOTIONS.includes(m[2])) || (m[1] === 'PICK' && m[2] === 'none')) {
        throw new Error(`${fileName}:${lineNumber}: bad IF line "${raw}"`);
      }
      const key = m[1] === 'PICK' ? 'byPick' : 'byGift';
      currentEdge[key] = { ...currentEdge[key], [m[2]]: parseText(m[3]) };
    } else if (line.startsWith('CONTRADICTS:')) {
      // This answer contradicts something the player may have said earlier
      // (node=side). Someone else's node: word travels, IT quotes it back.
      // This NPC's own node: they heard both, and call it out themselves
      // (CAUGHT below). Costs are in dialogScene.js.
      const m = line.slice(12).trim().match(/^([a-z0-9_]+)=(truth|lie)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad CONTRADICTS line "${raw}" (node_id=truth|lie)`);
      currentEdge.contradicts = [...(currentEdge.contradicts ?? []), { node: m[1], side: m[2] }];
    } else if (line.startsWith('CAUGHT')) {
      // What this NPC says when they catch the player contradicting
      // something they told them earlier in the same encounter. With
      // [node], only for the pair that node trips (an edge can have two).
      const m = line.match(/^CAUGHT(?:\s*\[([a-z0-9_]+)\])?:\s*(.*)$/);
      if (!m) throw new Error(`${fileName}:${lineNumber}: bad CAUGHT line "${raw}"`);
      currentEdge.caught = { ...currentEdge.caught, [m[1] ?? '*']: parseText(m[2]) };
    } else if (line.startsWith('IT:')) {
      // IT/SO right after this answer's reaction, before the next node.
      currentEdge.itText = parseText(line.slice(3));
    } else if (line.startsWith('SO:')) {
      currentEdge.soText = parseText(line.slice(3));
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

  // Optional sections only appear in the JSON when authored, so NPCs that
  // don't use them build byte-identical to before they existed.
  const result = { npc, location, accentColor, portrait, nodes };
  if (Object.keys(reveal).length) result.reveal = reveal;
  if (Object.keys(connect).length) result.connect = connect;
  if (story.length) result.story = story;
  if (Object.keys(contactAsk).length) result.contactAsk = contactAsk;
  if (Object.keys(pushAway).length) result.pushAway = pushAway;
  if (storyIt) result.storyIt = storyIt;
  if (storySo) result.storySo = storySo;
  if (Object.keys(opener).length) result.opener = opener;
  if (outro.length) result.outro = outro;
  return result;
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
