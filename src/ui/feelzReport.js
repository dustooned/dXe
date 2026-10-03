// The FEELZ clinical report: the middle page of the ending. The app's read
// on the player, in its own flat clinical voice — the first and only place
// the game names the player's class, as a diagnosis. PLACEHOLDER PROSE for
// the interpretations and case notes; the structure is the point.
//
// Everything here is already tracked on the run: loadout (class),
// emotionCounts (every FEELZ pick), choices (truth/lie per node, keyed
// `<npc>_<node>`). Nothing new is recorded for it.
import { EMOTIONS, EMOTION_ORDER, emotionsForClass, getDominantEmotion } from '../engine/loadout.js';
import { iconHtml } from './feelingIcons.js';

// The class, as FEELZ files it. Each description doubles as a hint at the
// player character's own battle.
export const DIAGNOSES = {
  Guns: {
    name: 'Reactive-Protective Type',
    code: 'FP-01',
    summary: 'Threat-first processing. Converts fear into readiness, readiness into force. Grief presents as anger.',
  },
  Bible: {
    name: 'Devotional-Rigid Type',
    code: 'FP-02',
    summary: 'Certainty as coping. Revulsion used as a boundary. Anxiety managed by rules, and rules by more rules.',
  },
  Crystals: {
    name: 'Porous-Expressive Type',
    code: 'FP-03',
    summary: "High emotional permeability. Absorbs others' states, presents bright. Surprise used to deflect.",
  },
};

// Class × the emotion the player leaned on most. `neutral` = no unique lead.
const INTERPRETATIONS = {
  Guns: {
    Anger: 'Led with anger. Consistent with profile. Anger here functions as protection, not aggression.',
    Fear: 'Led with fear. Client braces early and often. The threat is rarely where they are looking.',
    Sadness: 'Led with sadness. Atypical for profile. Client may be closer to grief than intake suggested.',
    neutral: 'No dominant emotion. Client withheld a lead. Guarded, or undecided.',
  },
  Bible: {
    Anxiety: 'Led with anxiety. Client rehearses outcomes before they arrive. Structure lowers it. So does honesty.',
    Disgust: 'Led with disgust. Client sets boundaries by recoiling. Useful. Also lonely.',
    Fear: 'Led with fear. Faith and fear presented together more than once. Client may not tell them apart.',
    neutral: 'No dominant emotion. Client kept every feeling at the same careful distance.',
  },
  Crystals: {
    Happy: 'Led with happiness. Brightness used as a default setting, including where it did not fit.',
    Anxiety: 'Led with anxiety. Underneath the openness, client is monitoring constantly.',
    Surprise: 'Led with surprise. Client keeps being caught off guard by their own reactions.',
    neutral: 'No dominant emotion. Client felt a little of everything and committed to none of it.',
  },
};

function caseNote(truths, lies) {
  if (!truths && !lies) return 'Insufficient data. Client did not engage.';
  if (!lies) return 'Client was honest in every recorded exchange. Follow up: at what cost.';
  if (lies <= truths) return 'Mixed disclosure. Client lies selectively, usually to keep the peace. Continue monitoring.';
  return 'Client deferred. Again. Most recorded exchanges were not true. The lake has the rest.';
}

// { person: { truth, lie } } from run.choices, in the order first met.
function honestyByPerson(choices = {}) {
  const people = {};
  for (const [nodeId, side] of Object.entries(choices)) {
    const who = nodeId.split('_')[0];
    people[who] ??= { truth: 0, lie: 0 };
    people[who][side] += 1;
  }
  return people;
}

export function buildReport(state) {
  const loadout = DIAGNOSES[state.loadout] ? state.loadout : 'Guns';
  const counts = state.emotionCounts ?? {};
  const dominant = getDominantEmotion(counts);
  const people = honestyByPerson(state.choices);
  const truths = Object.values(people).reduce((n, p) => n + p.truth, 0);
  const lies = Object.values(people).reduce((n, p) => n + p.lie, 0);
  return {
    loadout,
    diagnosis: DIAGNOSES[loadout],
    counts,
    dominant,
    interpretation: INTERPRETATIONS[loadout][dominant] ?? INTERPRETATIONS[loadout].neutral,
    people,
    truths,
    lies,
    note: caseNote(truths, lies),
    collected: emotionsForClass(loadout, state.unlocked ?? []),
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Full report page. The class's three starting emotions always show (even
// at zero); any other emotion shows only if the player actually picked it.
export function createFeelzReport(state) {
  const r = buildReport(state);
  const root = el('div', 'dx-report');

  root.appendChild(el('p', 'dx-report__app', 'FEELZ · CLINICAL SUMMARY'));

  const dx = el('div', 'dx-report__section');
  dx.appendChild(el('p', 'dx-report__label', 'PRESENTING PROFILE'));
  dx.appendChild(el('p', 'dx-report__diagnosis', `${r.diagnosis.name} (${r.diagnosis.code})`));
  dx.appendChild(el('p', 'dx-report__body', r.diagnosis.summary));
  root.appendChild(dx);

  // The wheel: every feeling the player ended the run able to reach for.
  const wheel = el('div', 'dx-report__section');
  wheel.appendChild(el('p', 'dx-report__label', `FEELINGS COLLECTED · ${r.collected.length} / ${EMOTION_ORDER.length}`));
  const chips = el('div', 'dx-report__chips');
  for (const name of EMOTION_ORDER) {
    const has = r.collected.includes(name);
    const chip = el('span', `dx-report__chip${has ? '' : ' is-missing'}`, has ? name : '· ???');
    if (has) chip.insertAdjacentHTML('afterbegin', iconHtml(name) + ' ');
    if (has) chip.style.color = EMOTIONS[name].color;
    chips.appendChild(chip);
  }
  wheel.appendChild(chips);
  root.appendChild(wheel);

  const emo = el('div', 'dx-report__section');
  emo.appendChild(el('p', 'dx-report__label', 'EMOTIONS REACHED FOR'));
  const shown = EMOTION_ORDER.filter((e) => emotionsForClass(r.loadout).includes(e) || r.counts[e] > 0);
  const max = Math.max(1, ...shown.map((e) => r.counts[e] ?? 0));
  for (const name of shown) {
    const n = r.counts[name] ?? 0;
    const row = el('div', 'dx-report__bar-row');
    const label = el('span', 'dx-report__bar-label', name);
    label.insertAdjacentHTML('afterbegin', iconHtml(name) + ' ');
    label.style.color = EMOTIONS[name].color;
    const track = el('span', 'dx-report__bar-track');
    const fill = el('span', 'dx-report__bar-fill');
    fill.style.width = `${(n / max) * 100}%`;
    fill.style.background = EMOTIONS[name].color;
    track.appendChild(fill);
    row.append(label, track, el('span', 'dx-report__bar-count', String(n)));
    emo.appendChild(row);
  }
  emo.appendChild(el('p', 'dx-report__body', r.interpretation));
  root.appendChild(emo);

  const hon = el('div', 'dx-report__section');
  hon.appendChild(el('p', 'dx-report__label', 'DISCLOSURE BY CONTACT'));
  for (const [who, { truth, lie }] of Object.entries(r.people)) {
    const row = el('div', 'dx-report__row');
    row.append(el('span', null, who.toUpperCase()), el('span', null, `${truth} true · ${lie} not`));
    hon.appendChild(row);
  }
  root.appendChild(hon);

  const note = el('div', 'dx-report__section');
  note.appendChild(el('p', 'dx-report__label', 'CASE NOTE'));
  note.appendChild(el('p', 'dx-report__body dx-report__note', r.note));
  root.appendChild(note);

  return root;
}

// One-line version for the final all-together page.
export function reportSummaryLine(state) {
  const r = buildReport(state);
  const lead = r.dominant ? `led with ${r.dominant}` : 'no dominant emotion';
  return `${r.diagnosis.name} · ${lead} · ${r.collected.length}/${EMOTION_ORDER.length} feelings · ${r.truths} true, ${r.lies} not`;
}
