// Class balance check: for each class, how many routes through each NPC
// can still reach trust (2 matched moods + 1 bid), assuming the player
// picks the matching feeling every time and keeps the gifts earned so far.
// Run after changing any MOOD/BID line: node scripts/balance-check.mjs
// Mirrors engine/loadout.js CLASSES and engine/unlocks.js GIFTS; update
// both lists below if those change.
import fs from 'node:fs';
import { withClassMoods, moodFor } from '../src/engine/loadout.js';
const R = new URL('../src/chapters/lake-ulysses/content/', import.meta.url);
const CLASSES = { Guns: ['Anger', 'Fear', 'Sadness'], Bible: ['Anxiety', 'Disgust', 'Fear'], Crystals: ['Happy', 'Anxiety', 'Surprise'] };
const GIFTS = { THERAPIST: ['Surprise', 'Sadness', 'Anxiety'], DEBORAH: ['Sadness', 'Disgust', 'Fear'], RWANDA: ['Anger', 'Happy'], SAMUN: ['Happy', 'Surprise', 'Fear'], RICK: ['Fear', 'Anxiety', 'Anger', 'Surprise', 'Disgust'] };
const ORDER = ['THERAPIST', 'DEBORAH', 'RWANDA', 'SAMUN', 'RICK'];

// Enumerate every path through an NPC (all openers, both swipes each node).
function paths(npc) {
  const nodes = npc.nodes;
  const openers = Object.keys(nodes).filter((id) => /_01(_soft|_hard)?$/.test(id));
  const out = [];
  const walk = (id, trail) => {
    const node = nodes[id];
    if (!node) { out.push(trail); return; }
    for (const side of ['truth', 'lie']) {
      const e = node.swipes[side];
      if (!e) continue;
      const step = { id, mood: node.mood, bid: (node.bid ?? []).includes(side), side };
      if (!e.nextNodeId) out.push([...trail, step]);
      else walk(e.nextNodeId, [...trail, step]);
    }
  };
  openers.forEach((o) => walk(o, []));
  return out;
}

// Best path for a class with `have` feelings: max syncs, needing 1 bid too.
// Gifts arrive on a bid (the first in the NPC's list you don't have).
const load = (name) => JSON.parse(fs.readFileSync(new URL(name.toLowerCase() + '.json', R), 'utf8'));

// Moods as a player of `cls` meets this NPC (MOOD [Class] lines: kin / foe).
function evalNpc(name, have, cls) {
  const npc = withClassMoods(load(name), cls);
  let best = { syncs: -1 };
  let trustPaths = 0;
  const all = paths(npc);
  for (const p of all) {
    let feel = new Set(have);
    let syncs = 0, bids = 0;
    const gifts = [];
    for (const step of p) {
      if (step.mood && feel.has(step.mood)) syncs++;
      if (step.bid) {
        bids++;
        const g = GIFTS[name].find((e) => !feel.has(e));
        if (g) { feel.add(g); gifts.push(g); }
      }
    }
    if (syncs >= 2 && bids >= 1) trustPaths++;
    if (syncs > best.syncs) best = { syncs, bids, path: p.map((s) => s.id.replace(name.toLowerCase() + '_', '') + ':' + s.side[0]).join(' '), gifts };
  }
  // The secret openers are a bonus, reported in the first-card table below.
  const moods = Object.entries(npc.nodes).filter(([id]) => !/_secret$/.test(id)).map(([, n]) => n.mood).filter(Boolean);
  const matchable = moods.filter((m) => have.includes(m)).length;
  return { best, trustPaths, total: all.length, matchable, moods: moods.length, unlock: best.gifts };
}

for (const [cls, base] of Object.entries(CLASSES)) {
  console.log(`\n== ${cls} (${base.join('/')})`);
  let have = [...base];
  for (const name of ORDER) {
    const r = evalNpc(name, have, cls);
    console.log(`${name.padEnd(9)} moments matchable ${r.matchable}/${r.moods}  best syncs ${r.best.syncs}  trust-reachable paths ${r.trustPaths}/${r.total}  (gift on bid: ${r.unlock?.join(',') || '-'})`);
    // Carry the first gift forward (assume they met at least one bid).
    const g = GIFTS[name].find((e) => !have.includes(e));
    if (g) have.push(g);
  }
}

// The opener puzzle: which openers' first feeling each class holds from the
// start (a free sync on the first card). The room's objects and the
// confrontation's chips show these colors. secret = the restore opener.
console.log('\n== First card: does your class hold their first feeling? (wait / soft / hard / secret)');
for (const name of ORDER.slice(1)) {
  const npc = load(name);
  const k = name.toLowerCase();
  const row = Object.entries(CLASSES).map(([cls, base]) => {
    const cells = ['_01', '_01_soft', '_01_hard', '_01_secret'].map((suffix) => {
      const node = npc.nodes[k + suffix];
      if (!node) return '.';
      const mood = moodFor(node, cls);
      return base.includes(mood) ? mood.slice(0, 3) : '-';
    });
    return `${cls} ${cells.join('/')}`;
  });
  console.log(`${name.padEnd(9)} ${row.join('   ')}`);
}
