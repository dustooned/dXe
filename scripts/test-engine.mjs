// Engine rules: plain-node checks for the game math (no browser).
//   npm run test:engine
// Covers the stat soft cap, rest after an encounter, the lie fog on Wi-Fi,
// epilogue direction, contacts (moods, fog, voicemail), the lake haze, and a
// whole-chapter sweep that every path through the content resolves.
import fs from 'fs';
import { resolveCard, resolveGatedNode, softStep, restAfter, LIE_FOG } from '../src/engine/cardEngine.js';
import { getEndingKey, getEpilogueLine } from '../src/engine/endingEngine.js';
import { CONTACTS, callFor, voicemailFor, therapistReachable, FOG_WIFI } from '../src/engine/contacts.js';
import { hazeFor } from '../src/engine/lake.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else { failed++; console.log(`FAIL  ${name}${detail ? `  (${detail})` : ''}`); }
}

const base = { integrity: 5, trust: 5, stability: 5, lucidity: 5, truthDebt: 0, ledger: [], bonds: {}, loadout: 'Guns' };

// Soft cap: full steps inside 3..7, half speed further out, never past 0..10.
check('soft: inside band', softStep(5, 2) === 7);
check('soft: past 7 costs double', softStep(7, 2) === 8, softStep(7, 2));
check('soft: +1 at 7 holds', softStep(7, 1) === 7);
check('soft: back toward middle is free', softStep(9, -2) === 7);
check('soft: -1 at 3 holds', softStep(3, -1) === 3);
check('soft: clamps', softStep(9, 20) <= 10 && softStep(1, -20) >= 0);

// Rest after an encounter: connected +3 (soft), otherwise up to +2 toward 5, never down.
check('rest: walk', restAfter({ stability: 2 }).stability === 4);
check('rest: walk stops at 5', restAfter({ stability: 4 }).stability === 5);
check('rest: never down', restAfter({ stability: 8 }).stability === 8);
check('rest: connected', restAfter({ stability: 2 }, { connected: true }).stability === 5);
check('rest: connected past 5', restAfter({ stability: 6 }, { connected: true }).stability > 6);

// Lie fog: a lie with no authored lucidity costs LIE_FOG; not in the tutorial; authored wins.
const node = { id: 'n', swipes: { lie: { effects: { trust: 1 } }, truth: { effects: {} } } };
check('fog: lie fogs', resolveCard(base, node, 'lie', null).patch.lucidity === 5 + LIE_FOG);
check('fog: tutorial exempt', resolveCard(base, node, 'lie', null, { fog: false }).patch.lucidity === undefined);
check('fog: truth untouched', resolveCard(base, node, 'truth', null).patch.lucidity === undefined);
const authored = { id: 'n', swipes: { lie: { effects: { lucidity: 2 } } } };
check('fog: authored wins', resolveCard(base, authored, 'lie', null).patch.lucidity === 7);

// Endings and epilogue direction.
check('ending tiers', ['CLEAN_CUT', 'FUNCTIONAL_MASK', 'COLLAPSE', 'LIVING_LIE'].join() === [0, 4, 6, 10].map(getEndingKey).join());
const endings = JSON.parse(fs.readFileSync('src/chapters/lake-ulysses/content/endings.json', 'utf8'));
for (const [stat, line] of Object.entries(endings.epilogues)) {
  check(`epilogue ${stat} has high and low`, typeof line === 'object' && line.high && line.low);
}
check('epilogue: honest gets high', getEpilogueLine({ ...base, integrity: 10 }, endings.epilogues) === endings.epilogues.integrity.high);
check('epilogue: low Wi-Fi gets low', getEpilogueLine({ ...base, lucidity: 0 }, endings.epilogues) === endings.epilogues.lucidity.low);

// Contacts: every contact words all 8 moods, has a foggy line; fog follows Wi-Fi.
const MOODS = ['Happy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anxiety'];
for (const [key, c] of Object.entries(CONTACTS)) {
  check(`contact ${key} moods`, MOODS.every((m) => typeof c.moods?.[m] === 'string' && c.moods[m].length > 0));
  check(`contact ${key} foggy`, typeof c.foggy === 'string');
}
const clear = callFor('DEBORAH', { state: { ...base, lucidity: FOG_WIFI }, currentName: 'Rick', currentKey: 'RICK', mood: 'Anger' });
const foggy = callFor('DEBORAH', { state: { ...base, lucidity: FOG_WIFI - 1 }, currentName: 'Rick', currentKey: 'RICK', mood: 'Anger' });
check('call clear at Wi-Fi 4', !clear.fogged && clear.lines[1].includes('{color:'));
check('call fogged under 4', foggy.fogged && !foggy.lines[1].includes('{color:') && foggy.lines.includes(CONTACTS.DEBORAH.foggy));
check('therapist gate', therapistReachable({ trust: 4, lucidity: 4 }) && !therapistReachable({ trust: 3, lucidity: 9 }));
check('voicemail: bars', voicemailFor({ trust: 2, lucidity: 9 })[0].includes('bars'));
check('voicemail: Wi-Fi', voicemailFor({ trust: 9, lucidity: 2 })[0].includes('Wi-Fi'));
check('voicemail: both', voicemailFor({ trust: 2, lucidity: 2 })[0].includes('not available'));
const tLow = callFor('THERAPIST', { state: { ...base, trust: 4 }, currentName: 'Rick', currentKey: 'RICK', mood: 'Anger' });
check('therapist warns at bars 4', /bars|Signal/.test(tLow.lines.join(' ')));

// The Therapist explains the little screen on the first call only.
const first = callFor('THERAPIST', { state: { ...base }, currentName: 'Rick', currentKey: 'RICK', mood: 'Anger' });
const again = callFor('THERAPIST', { state: { ...base, scopeExplained: true }, currentName: 'Rick', currentKey: 'RICK', mood: 'Anger' });
check('therapist explains once', first.explained && first.lines.some((l) => l.includes('tone_unison')) && !again.explained && !again.lines.some((l) => l.includes('tone_')));
check('explain science line', typeof CONTACTS.THERAPIST.explain.all === 'string');

// Lake haze: none when clean, full at the bottom, monotonic.
check('haze range', hazeFor(0) === 0 && hazeFor(10) === 1 && hazeFor(5) > hazeFor(3));

// Whole chapter: random runs through every NPC must never hit a missing node,
// every edge must lead somewhere real, and Rick's shut-down stays reachable.
const dir = 'src/chapters/lake-ulysses/content/';
const npcs = ['therapist', 'deborah', 'rwanda', 'samun', 'rick'].map((n) => JSON.parse(fs.readFileSync(dir + n + '.json', 'utf8')));
let broken = 0;
for (const npc of npcs) {
  for (const n of Object.values(npc.nodes)) {
    for (const [side, e] of Object.entries(n.swipes)) {
      if (e.nextNodeId && !npc.nodes[e.nextNodeId]) { broken++; console.log(`  ${npc.npc} ${n.id}.${side} -> missing ${e.nextNodeId}`); }
    }
    if (n.gate && !npc.nodes[n.gate.elseNodeId]) { broken++; console.log(`  ${npc.npc} ${n.id} gate -> missing ${n.gate.elseNodeId}`); }
  }
}
check('every edge and gate leads to a node', broken === 0, `${broken} broken`);
let shut = 0;
let bad = 0;
for (let r = 0; r < 5000; r++) {
  let s = { ...base };
  npcs.forEach((npc, i) => {
    let id = Object.keys(npc.nodes)[0];
    let steps = 0;
    while (id && steps++ < 20) {
      id = resolveGatedNode(id, npc, s);
      if (id?.includes('shut_down')) shut++;
      const n = npc.nodes[id];
      if (!n) { bad++; break; }
      const res = resolveCard(s, n, Math.random() < 0.5 ? 'truth' : 'lie', null, { fog: i > 0 });
      s = { ...s, ...res.patch };
      for (const k of ['integrity', 'trust', 'stability', 'lucidity', 'truthDebt']) if (s[k] < 0 || s[k] > 10 || !Number.isInteger(s[k])) bad++;
      id = res.edge.nextNodeId;
    }
    if (i > 0) s = { ...s, ...restAfter(s, { connected: Math.random() < 0.4 }) };
  });
}
check('random runs stay in range and resolve', bad === 0, `${bad} problems`);
check("Rick's shut-down still reachable", shut > 0, `${shut}/5000`);

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\nall ${passed} passed`);
process.exit(failed ? 1 : 0);
