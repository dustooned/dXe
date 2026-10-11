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
import { moodFor, withClassMoods, effortCost } from '../src/engine/loadout.js';
import { frameAt, durationOf } from '../src/ui/characterAnimator.js';
import { registerCharacterArt, characterArt, restArt, missingStates, idleGapMs, IDLE_GAP_MS, hatFor, hatForContext, HAT_RULES, THERAPIST_HATS, STATE_NAMES, TUTORIAL_HATS, tutorialHatForBeat } from '../src/engine/characters.js';
import { buildReckoningDeck, resolveReckoningCard } from '../src/engine/reckoning.js';

// A stand-in localStorage for the save checks below.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { saveCheckpoint, loadCheckpoint, clearCheckpoint } = await import('../src/shell/save.js');

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
const full = { ...base, truthDebt: 10 };
const pastFull = resolveCard(full, node, 'lie', null).patch;
check('full lake: a lie still costs Wi-Fi and clock', pastFull.lucidity === 3 && pastFull.integrity === 4, JSON.stringify(pastFull));
check('full lake: tutorial exempt', resolveCard(full, node, 'lie', null, { fog: false }).patch.integrity === undefined);

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

// Checkpoint: a run's scene and whole state survive a round trip; an ending clears it.
check('checkpoint empty at first', loadCheckpoint() === null);
const state = { ...base, truthDebt: 4, choices: { deborah_01: 'lie' }, unlocked: ['Trust'] };
check('checkpoint saves', saveCheckpoint({ chapterId: 'lake-ulysses', sceneId: 'rwanda', state }));
const cp = loadCheckpoint();
check('checkpoint loads scene and state', cp?.sceneId === 'rwanda' && cp.state.truthDebt === 4 && cp.state.choices.deborah_01 === 'lie' && cp.state.unlocked[0] === 'Trust');
clearCheckpoint();
check('checkpoint clears', loadCheckpoint() === null);
mem.set('dreamxtreme:checkpoint', '{not json');
check('checkpoint survives junk', loadCheckpoint() === null);

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

// ── The Reckoning: partial confession, gentle double-down ──
{
  const ledger = [4, 6, 17].map((d, i) => ({ npc: 'X', ledgerText: 't' + i, tags: [], debtDelta: d }));
  const run = (start, choices) => {
    const deck = buildReckoningDeck(ledger, 3, start);
    let st = { truthDebt: start };
    deck.forEach((c, i) => { st = { ...st, ...resolveReckoningCard(st, c, choices[i]).patch }; });
    return st.truthDebt;
  };
  const C = ['confess', 'confess', 'confess'];
  const D = ['doubleDown', 'doubleDown', 'doubleDown'];
  check('a full lake cannot be confessed clean', run(10, C) >= 4, 'got ' + run(10, C));
  check('a shallow lake can still go clean', run(3, C) <= 2, 'got ' + run(3, C));
  check('confessing never adds, doubling never clears', run(6, C) <= 6 && run(6, D) >= 6);
  check('three double-downs add a little, not everything', run(2, D) <= 8, 'got ' + run(2, D));
  check('one confession clears at most 3', buildReckoningDeck(ledger, 3, 10).every((c) => c.clears >= 1 && c.clears <= 3));
  check('double-down adds 1 or 2', buildReckoningDeck(ledger, 3, 10).every((c) => c.adds === 1 || c.adds === 2));
  check('mixed choices land between the extremes', run(6, ['confess', 'doubleDown', 'confess']) > run(6, C) && run(6, ['confess', 'doubleDown', 'confess']) < run(6, D));
  check('lake stays in range', run(10, D) === 10 && run(0, C) === 0);
}

// ── The Therapist's tutorial: every mechanic step exists for each class and for no class ──
{
  const thr = JSON.parse(fs.readFileSync('src/chapters/lake-ulysses/content/therapist.json', 'utf8'));
  const applies = (b, cls) => !(b.when?.class && b.when.class !== cls) && !(b.when?.noClass && ['Guns', 'Bible', 'Crystals'].includes(cls));
  const keyOf = (b) => (b.watch ? 'watch:' + b.watch : b.kind + ':' + (b.text ?? '').slice(0, 12));
  const mechanic = (b) => ['trycall'].includes(b.kind) || b.watch || (b.kind === 'line' && /Practical stuff|Also\. Tell someone|There\. A circle|calling me while/.test(b.text ?? ''));
  for (const cls of ['Guns', 'Bible', 'Crystals', undefined]) {
    const beats = thr.outro.filter((b) => mechanic(b) && applies(b, cls));
    const watch = beats.filter((b) => b.watch);
    check('tutorial: one watch-out per key for ' + (cls ?? 'no class'), ['stability', 'trust', 'lucidity', 'integrity', 'lake', 'steady'].every((k) => watch.filter((b) => b.watch === k).length === 1));
    check('tutorial: one try-call and four mechanic lines for ' + (cls ?? 'no class'), beats.filter((b) => b.kind === 'trycall').length === 1 && beats.filter((b) => b.kind === 'line' && !b.watch).length === 4);
  }
  const edges = Object.values(thr.nodes).flatMap((n) => Object.values(n.swipes ?? {})).filter((e) => e.reactByClass);
  check('tutorial: the meter and lake reactions have all three class versions', edges.length === 4 && edges.every((e) => ['Guns', 'Bible', 'Crystals'].every((c) => e.reactByClass[c])));
}


// ── Kin / foe moods, the room color code and the secret openers ──
{
  const C = 'src/chapters/lake-ulysses/';
  const deb = JSON.parse(fs.readFileSync(C + 'content/deborah.json', 'utf8'));
  check('kin/foe: MOOD [Bible] replaces MOOD for Bible only', moodFor(deb.nodes.deborah_01, 'Bible') === 'Fear' && moodFor(deb.nodes.deborah_01, 'Guns') === 'Sadness');
  check('kin/foe: withClassMoods resolves every node and leaves the source alone', withClassMoods(deb, 'Crystals').nodes.deborah_01_secret.mood === 'Surprise' && deb.nodes.deborah_01_secret.mood === 'Sadness');
  const ROOM = { deborah: 'deborah-hallway', rwanda: 'rwanda-alley', samun: 'samun-garage', rick: 'rick-barlot' };
  const CLS = ['Guns', 'Bible', 'Crystals'];
  const HELD = { Guns: ['Anger', 'Fear', 'Sadness'], Bible: ['Anxiety', 'Disgust', 'Fear'], Crystals: ['Happy', 'Anxiety', 'Surprise'] };
  for (const [key, room] of Object.entries(ROOM)) {
    const npc = JSON.parse(fs.readFileSync(C + `content/${key}.json`, 'utf8'));
    const conf = JSON.parse(fs.readFileSync(C + `content/confront_${key}.json`, 'utf8'));
    const secret = npc.nodes[key + '_01_secret'];
    check(`${key}: has a class, and a secret opener with a line for each class`, CLS.includes(npc.npcClass) && !!secret && CLS.every((c) => secret.byClass?.[c]));
    check(`${key}: the secret opener glows (GLOW: yes)`, secret?.glow === true);
    check(`${key}: every class holds the secret opener's first feeling`, CLS.every((c) => HELD[c].includes(moodFor(secret, c))));
    check(`${key}: every class holds the first feeling of at least one plain opener`, CLS.every((c) => ['_01', '_01_soft', '_01_hard'].some((x) => HELD[c].includes(moodFor(npc.nodes[key + x], c)))));
    const opts = conf.beats.flatMap((b) => b.interactive?.options ?? []);
    const so = opts.find((o) => o.secret);
    check(`${key}: the confrontation offers the secret, labelled for each class, after a secret beat`, so?.opener === key + '_01_secret' && CLS.every((c) => so.label[c]) && conf.beats.some((b) => b.secret && CLS.every((c) => b.text[c])));
    for (const kind of ['lie', 'fake']) {
      const n = npc.nodes[`${key}_01_${kind}`];
      check(`${key}: ${kind} opener glows and every class holds its first feeling`, n?.glow === true && CLS.every((c) => HELD[c].includes(moodFor(n, c))));
    }
    const white = opts.find((o) => o.whenFogged);
    const fake = opts.find((o) => o.fake);
    check(`${key}: fogged confrontation offers a priced white lie and a bluffed restore`, white?.opener === key + '_01_lie' && white.lie?.effects?.trust === 2 && white.lie.debtDelta > 0 && !!white.lie.ledgerEntry && fake?.opener === key + '_01_fake' && fake.lie?.debtDelta > 0 && JSON.stringify(fake.label) === JSON.stringify(so.label));
    check(`${key}: every opener the confrontation names exists`, opts.every((o) => npc.nodes[o.opener]));
    // The room module (read as text: it lazy-loads in the browser): each
    // object names an opener, one class restores it, and each class's
    // caption colors the feeling that opener really meets for that class.
    const src = fs.readFileSync(C + `minigames/${room}.js`, 'utf8');
    const spots = src.split(/opener: '/).slice(1).map((chunk) => ({
      opener: chunk.slice(0, chunk.indexOf("'")),
      by: chunk.match(/by: '(\w+)'/)?.[1],
      color: Object.fromEntries(CLS.map((c) => [c, chunk.match(new RegExp(c + String.raw`:\s+['"][^\n]*?\{color:(\w+)\}`))?.[1]])),
    }));
    check(`${key}: three objects, one per opener, one restore per class`, spots.length === 3 && new Set(spots.map((x) => x.opener)).size === 3 && CLS.every((c) => spots.filter((x) => x.by === c).length === 1));
    const off = spots.flatMap((x) => CLS.filter((c) => x.color[c] !== moodFor(npc.nodes[x.opener], c)).map((c) => `${x.opener}/${c}: ${x.color[c]} vs ${moodFor(npc.nodes[x.opener], c)}`));
    check(`${key}: each caption's colored word is the feeling its opener meets for that class` + (off.length ? ` (${off.join('; ')})` : ''), !off.length);
  }
}

// ── Effort: committing to a feeling your class isn't used to costs battery ──
{
  check('effort: own feelings and Trust are free', effortCost('Anger', 'Guns') === 0 && effortCost('Trust', 'Bible') === 0);
  check('effort: only a gift that clashes with one of yours costs, and only until you are used to it', effortCost('Surprise', 'Guns') === 0 && effortCost('Happy', 'Guns') === 1 && effortCost('Sadness', 'Crystals') === 1 && effortCost('Anger', 'Bible') === 1 && effortCost('Fear', 'Crystals') === 0 && effortCost('Happy', 'Guns', { Happy: 1 }) === 0);
  const node = { id: 'x', swipes: { truth: { effects: {}, debtDelta: 0, nextNodeId: null } } };
  const st = { integrity: 5, trust: 5, stability: 5, lucidity: 5, truthDebt: 0, ledger: [], loadout: 'Guns' };
  check('effort: charged on the swipe, not in the tutorial', resolveCard(st, node, 'truth', 'Happy').patch.stability === 4 && resolveCard(st, node, 'truth', 'Anger').patch.stability === undefined && resolveCard(st, node, 'truth', 'Happy', { fog: false }).patch.stability === undefined);
}

// ── Standard character art: states, fallbacks, hats, and files on disk ──
{
  const dir = 'src/chapters/lake-ulysses/characters/';
  registerCharacterArt(Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(fs.readFileSync(dir + f, 'utf8'))])));
  const idle = characterArt('THERAPIST', 'idle');
  const talk = characterArt('THERAPIST', 'talk');
  check('characters: the Therapist has an idle still and a 3-frame talk loop', idle?.kind === 'still' && talk?.kind === 'anim' && talk.frames === 3 && talk.fps === 10);
  check('characters: an undrawn state falls back to idle, an NPC with no art to nothing', characterArt('THERAPIST', 'feel_anger')?.url === idle.url && characterArt('RWANDA', 'idle') === null);
  check('characters: a hat swaps his idle and his talk loop', characterArt('THERAPIST', 'idle', { hat: 'fez' }).url.endsWith('fez_3.png') && characterArt('THERAPIST', 'talk', { hat: 'top' }).base.endsWith('top_talk/top_talk_'));
  check('characters: the standard list has idle, talk, 8 talk_ + 8 wait_ feelings, 5 reactions, connect, pushaway, 5 trauma beats', STATE_NAMES.length === 2 + 8 + 8 + 5 + 2 + 5 && missingStates('therapist').length === STATE_NAMES.length - 2 && missingStates('rwanda').length === STATE_NAMES.length);
  const rest = restArt('THERAPIST');
  check('characters: the rest face is the drawn idle still (mouth shut: neutral_3, never the open-mouth _1), and a hat keeps that rule', rest.kind === 'still' && rest.url.endsWith('neutral_3.png') && restArt('THERAPIST', { hat: 'top' }).url.endsWith('top_3.png') && restArt('RWANDA') === null);
  check('characters: pieces say which file they are, so a fallback can be told from the real thing', characterArt('THERAPIST', 'wait_anger').key === 'neutral_3' && characterArt('THERAPIST', 'react_hit').key === 'neutral_3' && talk.key === 'neutral_talk');
  // Deborah (a still + a talk loop) and Samun (a looping idle, no talk loop yet): placeholders on the standard
  const dIdle = characterArt('DEBORAH', 'idle');
  const dTalk = characterArt('DEBORAH', 'talk');
  const dir0 = 'public/assets/lake-ulysses/characters/deborah/';
  check('characters: Deborah has a shut-mouth idle still and a 3-frame talk loop, and her rest face is the still', dIdle?.kind === 'still' && dTalk?.kind === 'anim' && dTalk.frames === 3 && restArt('DEBORAH').url === dIdle.url && missingStates('deborah').length === STATE_NAMES.length - 2);
  check('characters: Deborah talk loop starts on her rest pose (frame 0 is the idle picture), so the mouth is shut until she speaks', Buffer.compare(fs.readFileSync(dir0 + 'talk/talk_0000.png'), fs.readFileSync(dir0 + 'idle.png')) === 0);
  const sIdle = characterArt('SAMUN', 'idle');
  const sRest = restArt('SAMUN');
  check('characters: Samun idle is a 9-frame loop; he rests on its first frame and the portrait plays it now and then (cycle)', sIdle.kind === 'anim' && sIdle.frames === 9 && sRest.cycle === true && sRest.kind === 'anim' && restArt('DEBORAH').cycle === undefined && restArt('THERAPIST').cycle === undefined);
  check('characters: with no talk loop drawn, speaking falls back to his idle (the mouth never moves), and a talk loop is never taken for a rest cycle', characterArt('SAMUN', 'talk').key === 'idle' && missingStates('samun').length === STATE_NAMES.length - 1 && restArt('DEBORAH', {}).kind === 'still');
  registerCharacterArt({ t: { npc: 'testy', art: { idle: { frames: 3, delays: [100, 300, 100] }, talk: { frames: 3, fps: 10 } } } });
  check('characters: a piece with its own frame timings keeps them (delays), an even one stays an fps', JSON.stringify(characterArt('testy', 'idle').delays) === '[100,300,100]' && characterArt('testy', 'talk').delays === undefined);
  check('characters: a looping idle waits 2.5 to 6.5 seconds between plays, never in step', idleGapMs(() => 0) === IDLE_GAP_MS[0] && idleGapMs(() => 1) === IDLE_GAP_MS[1] && idleGapMs(() => 0.5) === 4500 && IDLE_GAP_MS[0] >= 2000);
  // Chapter plates (scripts/import-chapter-plates.mjs): every frame on disk, a delay per frame
  const plates = JSON.parse(fs.readFileSync('src/chapters/lake-ulysses/plates.json', 'utf8'));
  const plateProblems = [];
  for (const [npc, p] of Object.entries(plates)) {
    if (p.delays.length !== p.frames || p.delays.some((d) => !(d > 0))) plateProblems.push(npc + ' delays');
    for (let i = 0; i < p.frames; i++) if (!fs.existsSync(`public/assets/lake-ulysses/plates/${npc}/${npc}_${String(i).padStart(4, '0')}.png`)) plateProblems.push(`${npc} frame ${i}`);
  }
  check('plates: the artist\'s chapter plates (Deborah, Samun) have every frame on disk and a delay for each' + (plateProblems.length ? ` (${plateProblems.join(', ')})` : ''), !plateProblems.length && !!plates.deborah && !!plates.samun);
  // Frame timing: exact, from the clock, with uneven delays (Deborah's plate: 80/150/80 ms)
  const bulb = { frames: 3, delays: [80, 150, 80] };
  const at = (t, loop) => frameAt(bulb, t, loop).frame;
  check('animation: uneven delays land on the right frame (0 until 80, 1 until 230, 2 until 310)', [0, 79, 80, 229, 230, 309].map((t) => at(t, true)).join() === '0,0,1,1,2,2');
  check('animation: a loop wraps at its total (310 ms), a one-shot holds the last frame and is done only after it', at(310, true) === 0 && at(400, true) === 1 && frameAt(bulb, 309, false).done === false && frameAt(bulb, 310, false).done === true && frameAt(bulb, 999, false).frame === 2);
  check('animation: even fps is 100 ms a frame, and the duration adds up', frameAt({ frames: 3, fps: 10 }, 199, true).frame === 1 && frameAt({ frames: 3, fps: 10 }, 200, true).frame === 2 && durationOf(bulb) === 310 && durationOf({ frames: 3, fps: 10 }) === 300);
  // The tutorial establishes the gag: every hat shows up, tied to what he is explaining
  const thr0 = JSON.parse(fs.readFileSync('src/chapters/lake-ulysses/content/therapist.json', 'utf8'));
  const used = new Set([...Object.values(TUTORIAL_HATS.marks), ...Object.values(TUTORIAL_HATS.nodes), ...Object.values(TUTORIAL_HATS.reactions), ...Object.values(TUTORIAL_HATS.outroKinds), ...TUTORIAL_HATS.outroText.map(([, h]) => h), ...Object.values(TUTORIAL_HATS.watch)].filter(Boolean));
  check('tutorial hats: all 8 hats appear in his tutorial, and only real ones', THERAPIST_HATS.every((h) => used.has(h)) && [...used].every((h) => THERAPIST_HATS.includes(h)));
  const outroHats = thr0.outro.filter((b) => !b.when || b.when.class === 'Guns').map((b) => tutorialHatForBeat(b)).filter((h) => h !== undefined);
  check('tutorial hats: his actual lines pick them (homework, mask exercise, practical stuff, the call, each watch-out)', thr0.outro.some((b) => /homework/.test(b.text ?? '') && tutorialHatForBeat(b) === 'top') && thr0.outro.some((b) => b.kind === 'tryfeel' && tutorialHatForBeat(b) === 'jester') && thr0.outro.some((b) => /Practical stuff/.test(b.text ?? '') && tutorialHatForBeat(b) === 'old_man') && thr0.outro.some((b) => b.kind === 'trycall' && tutorialHatForBeat(b) === 'fez') && thr0.outro.filter((b) => b.watch).every((b) => tutorialHatForBeat(b)) && outroHats.length >= 8);
  check('tutorial hats: every cue he fires on the meters page has a hat, and the page ends bare', Object.keys(TUTORIAL_HATS.marks).every((m) => thr0.nodes.therapist_01.swipes.truth.npcReaction.includes(`{mark:${m}}`)) && TUTORIAL_HATS.marks.allmeters === null);
  const mid = { truthDebt: 4, stability: 5, lucidity: 5, trust: 5, lieStreak: 0 };
  check('hats: every rule uses a real hat, and every hat has a moment', HAT_RULES.every((r) => THERAPIST_HATS.includes(r.hat) && r.why) && THERAPIST_HATS.every((h) => HAT_RULES.some((r) => r.hat === h)));
  check('hats: voicemail is a siesta, a mask is a jester, a new friend a fez, a dirty lake a detective', hatForContext({ ...mid, kind: 'voicemail' }).hat === 'sombrero' && hatForContext({ ...mid, kind: 'mask' }).hat === 'jester' && hatForContext({ ...mid, kind: 'friend' }).hat === 'fez' && hatForContext({ ...mid, kind: 'call', truthDebt: 7 }).hat === 'pork_pie');
  check('hats: how you left the lake picks his repeat-playthrough hat', ['CLEAN_CUT', 'FUNCTIONAL_MASK', 'COLLAPSE', 'LIVING_LIE'].map((e) => hatForContext({ kind: 'return', ending: e }).hat).join() === 'top,derby,old_man,pork_pie');
  check('hats: never the same hat twice in a row, and bare-headed when nothing fits', hatForContext({ ...mid, kind: 'mask', last: 'jester' }).hat !== 'jester' && hatForContext({ ...mid, kind: 'call' }).hat === null);
  check('hats: low battery is an old man, a fog is a sombrero, low Bars is a bunny, a clean lake in dress', hatForContext({ ...mid, kind: 'call', stability: 1 }).hat === 'old_man' && hatForContext({ ...mid, kind: 'call', lucidity: 2 }).hat === 'sombrero' && hatForContext({ ...mid, kind: 'call', trust: 2 }).hat === 'bunny' && hatForContext({ ...mid, kind: 'call', truthDebt: 1 }).hat === 'top');
  check('characters: hatFor always picks a real hat', [0, 1, 7, 8, 123, -4].every((n) => THERAPIST_HATS.includes(hatFor(n))));
  let missingFiles = [];
  for (const f of fs.readdirSync(dir)) {
    const m = JSON.parse(fs.readFileSync(dir + f, 'utf8'));
    for (const [k, v] of Object.entries(m.art)) {
      const base = `public/assets/lake-ulysses/characters/${m.npc}/`;
      if (v.frames > 1) { for (let i = 0; i < v.frames; i++) if (!fs.existsSync(`${base}${k}/${k}_${String(i).padStart(4, '0')}.png`)) missingFiles.push(k + i); }
      else if (!fs.existsSync(`${base}${k}.png`)) missingFiles.push(k);
    }
  }
  check('characters: every piece in every manifest exists on disk' + (missingFiles.length ? ` (${missingFiles.join(', ')})` : ''), !missingFiles.length);
}

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\nall ${passed} passed`);
process.exit(failed ? 1 : 0);
