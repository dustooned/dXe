// Balance simulation: plays whole chapters with the real engine (card
// effects, trust bonds, gifts, rest, the empty-battery rule) and reports how
// often each class earns each NPC's trust, and how the empty battery bites.
// balance-check.mjs counts routes; this plays them, so gifts, meters and the
// battery all interact the way they do in the game.
//   node scripts/balance-sim.mjs [runs]
import fs from 'node:fs';
import { resolveCard, resolveGatedNode, restAfter, EMPTY_BATTERY } from '../src/engine/cardEngine.js';
import { recordTrust, isTrusted } from '../src/engine/trust.js';
import { giftFor } from '../src/engine/unlocks.js';
import { emotionsForClass, withClassMoods } from '../src/engine/loadout.js';

const RUNS = Number(process.argv[2] ?? 2000);
const R = new URL('../src/chapters/lake-ulysses/content/', import.meta.url);
const load = (n) => JSON.parse(fs.readFileSync(new URL(n + '.json', R), 'utf8'));
const NPCS = Object.fromEntries(['therapist', 'deborah', 'rwanda', 'samun', 'rick'].map((n) => [n.toUpperCase(), load(n)]));
const ORDER = ['DEBORAH', 'RWANDA', 'SAMUN', 'RICK'];
const CLASSES = ['Guns', 'Bible', 'Crystals'];

const initial = (loadout) => ({
  integrity: 5, trust: 5, stability: 5, lucidity: 5, truthDebt: 0, lieStreak: 0, ledger: [],
  loadout, unlocked: [], giftedBy: {}, bonds: {}, emotionCounts: {}, choices: {},
});

// One conversation. `p` = { lie, attune, exhaustion }.
function play(state, npcKey, p, stats) {
  // Moods as this class meets them (MOOD [Class] lines: kin / foe).
  const npc = withClassMoods(NPCS[npcKey], state.loadout);
  const openers = Object.keys(npc.nodes).filter((id) => /_01(_soft|_hard)?$/.test(id));
  let id = npcKey === 'THERAPIST' ? 'therapist_01' : openers[Math.floor(Math.random() * openers.length)];
  let s = state;
  while (id) {
    id = resolveGatedNode(id, npc, s);
    const node = npc.nodes[id];
    if (!node) break;
    const side = Math.random() < p.lie ? 'lie' : 'truth';
    const have = emotionsForClass(s.loadout, s.unlocked);
    // The empty battery greys out your most-used feeling (dialogScene.js exhaustedFeeling).
    let exhausted = null;
    if (p.exhaustion && npcKey !== 'THERAPIST' && s.stability <= EMPTY_BATTERY) {
      exhausted = [...have].sort((a, b) => (s.emotionCounts[b] ?? 0) - (s.emotionCounts[a] ?? 0))[0];
      stats.drained += 1;
    }
    const options = have.filter((e) => e !== exhausted);
    const wants = node.mood;
    if (wants && exhausted === wants && have.includes(wants)) stats.blocked += 1;
    let pick = wants && options.includes(wants) && Math.random() < p.attune ? wants : options[Math.floor(Math.random() * options.length)];
    stats.nodes += 1;
    if (npcKey !== 'THERAPIST') for (const t of [1, 2, 3]) if (s.stability <= t) stats['dim' + t] += 1;
    if (wants) stats.moods += 1;
    // Effort (a gifted feeling your class isn't used to) is charged inside
    // resolveCard when the pick is committed; switching on the wheel is free.
    const synced = !!wants && pick === wants;
    const turned = !!node.bid?.includes(side);
    if (synced || turned) s = { ...s, bonds: recordTrust(s.bonds, npcKey, { synced, turnedToward: turned }) };
    if (turned) {
      const gift = giftFor(npcKey, s);
      if (gift) s = { ...s, unlocked: [...s.unlocked, gift], giftedBy: { ...s.giftedBy, [npcKey]: gift } };
    }
    const res = resolveCard(s, node, side, pick, { fog: npcKey !== 'THERAPIST' });
    s = { ...s, ...res.patch, choices: { ...s.choices, [id]: side }, emotionCounts: { ...s.emotionCounts, [pick]: (s.emotionCounts[pick] ?? 0) + 1 } };
    id = res.edge.nextNodeId;
  }
  return s;
}

function chapter(loadout, p, stats) {
  let s = play(initial(loadout), 'THERAPIST', p, { drained: 0, blocked: 0, nodes: 0, moods: 0, dim1: 0, dim2: 0, dim3: 0 });
  const trusted = {};
  let low = false;
  for (const key of ORDER) {
    s = play(s, key, p, stats);
    trusted[key] = isTrusted(s.bonds[key]);
    if (s.stability <= EMPTY_BATTERY) low = true;
    s = { ...s, ...restAfter(s, { connected: trusted[key] }) };
  }
  return { trusted, low, debt: s.truthDebt, trustFeeling: Object.values(trusted).filter(Boolean).length >= 2 };
}

const SCENARIOS = [
  ['ideal player, battery ignored', { attune: 1, exhaustion: false }],
  ['ideal player, empty battery on', { attune: 1, exhaustion: true }],
  ['human (80% attuned)', { attune: 0.8, exhaustion: true }],
];
const LIE = [['all honest', 0], ['half and half', 0.5], ['all lies', 1]];
const pct = (n) => String(Math.round((n / RUNS) * 100)).padStart(3) + '%';

for (const [label, base] of SCENARIOS) {
  console.log(`\n=== ${label}`);
  for (const [lieLabel, lie] of LIE) {
    console.log(`  -- ${lieLabel}`);
    for (const cls of CLASSES) {
      const tally = { DEBORAH: 0, RWANDA: 0, SAMUN: 0, RICK: 0, any2: 0, low: 0 };
      const stats = { drained: 0, blocked: 0, nodes: 0, moods: 0, dim1: 0, dim2: 0, dim3: 0 };
      for (let i = 0; i < RUNS; i++) {
        const r = chapter(cls, { ...base, lie }, stats);
        for (const k of ORDER) if (r.trusted[k]) tally[k] += 1;
        if (r.trustFeeling) tally.any2 += 1;
        if (r.low) tally.low += 1;
      }
      const blockedShare = stats.moods ? Math.round((stats.blocked / stats.moods) * 100) : 0;
      console.log(`    ${cls.padEnd(8)} trust: DEB ${pct(tally.DEBORAH)} RWA ${pct(tally.RWANDA)} SAM ${pct(tally.SAMUN)} RIC ${pct(tally.RICK)}  | 2+ trusted ${pct(tally.any2)}  | hit empty battery ${pct(tally.low)}  | mood moments blocked by it ${blockedShare}%  | screen dim at <=3/<=2/<=1: ${[3, 2, 1].map((t) => Math.round((stats['dim' + t] / Math.max(1, stats.nodes)) * 100) + '%').join('/')}`);
    }
  }
}
