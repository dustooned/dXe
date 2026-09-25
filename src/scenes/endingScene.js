// Scene type: 'ending'. Terminal scene — picks the ending by final Truth
// Debt, records it to the save file, and hands control back to the shell
// via `exit` (not `onComplete` — there's nothing after this). See
// docs/SCENE_TYPES.md.
//
// scene shape: { type: 'ending', id: string, endings: <endings.json> }
import { getEndingKey, getEpilogueStat } from '../engine/endingEngine.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createItPopup } from '../ui/itPopup.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { ppmFor, statusFor } from '../engine/lake.js';
import { ENDING_IT_TEXT } from '../engine/itEndgame.js';
import * as fx from '../shell/fx.js';
import * as audio from '../shell/audio.js';

// Intensity reflects how much Truth Debt piled up — the weight of the
// consequences, not a verdict on the choices that led there.
const ENDING_INTENSITY = {
  CLEAN_CUT: 'weak',
  FUNCTIONAL_MASK: 'weak',
  COLLAPSE: 'strong',
  LIVING_LIE: 'strong',
};

const JUDGMENT_BEAT_MS = 900;

// What the player said about themselves in the FEELZ check-in, set flat
// against what FEELZ actually recorded. No verdict, no commentary: two
// columns of data, and the gap between them is the player's to read.
function createCheckInRecord(state, finalDebt) {
  const said = state.checkIn ?? {};
  const lieNodes = Object.entries(state.choices ?? {}).filter(([, side]) => side === 'lie');
  const people = new Set(lieNodes.map(([nodeId]) => nodeId.split('_')[0])).size;
  const liesLine = lieNodes.length
    ? `${lieNodes.length}, to ${people} ${people === 1 ? 'person' : 'people'}`
    : '0';

  const rows = [
    ['SELF-REPORTED', null],
    ['Water higher than it should be', said.water ?? '—'],
    ['Told someone you were fine', said.fine ?? '—'],
    ['RECORDED', null],
    ['Lies told', liesLine],
    ['Final reading', `${ppmFor(finalDebt)} ppm · ${statusFor(finalDebt)}`],
  ];

  const el = document.createElement('dl');
  el.className = 'dx-checkin-record';
  for (const [label, value] of rows) {
    if (value === null) {
      const head = document.createElement('dt');
      head.className = 'dx-checkin-record__head';
      head.textContent = label;
      el.appendChild(head);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'dx-checkin-record__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    el.appendChild(row);
  }
  return el;
}

export function mount(stageEl, scene, { run, exit, recordEnding, chapterId }) {
  const endingKey = getEndingKey(run.get().truthDebt);
  const ending = scene.endings[endingKey];
  recordEnding?.(chapterId, endingKey);

  const finalDebt = run.get().truthDebt;
  const epilogueStat = getEpilogueStat(run.get());
  const epilogueLine = scene.endings.epilogues?.[epilogueStat];

  const intensity = ENDING_INTENSITY[endingKey] ?? 'weak';
  fx.flash(intensity);
  fx.shake(intensity);
  audio.playHit(intensity);

  let typewriter = null;
  let judgmentTimer = null;
  let itPopup = null;

  function renderJudgment() {
    stageEl.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-ending-judgment-screen';
    screen.addEventListener('click', skipJudgment, { once: true });

    const canvas = document.createElement('canvas');
    canvas.className = 'dx-pattern-bg';
    screen.appendChild(canvas);

    stageEl.appendChild(screen);
    drawEmotionPattern(canvas, { seedStr: endingKey, key: endingKey });

    judgmentTimer = setTimeout(showText, JUDGMENT_BEAT_MS);
  }

  function skipJudgment() {
    clearTimeout(judgmentTimer);
    showText();
  }

  function showText() {
    clearTimeout(judgmentTimer);
    stageEl.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-ending-screen';
    screen.addEventListener('click', handleTextTap);

    const title = document.createElement('h2');
    title.className = 'dx-title';
    title.textContent = ending.title;
    screen.appendChild(title);

    // The payoff for the gauge the player's watched all chapter: the
    // lake's final reading, full size, with whatever's left in the tank.
    const finalReading = document.createElement('p');
    finalReading.className = 'dx-text dx-ending-reading-label';
    finalReading.textContent = 'FINAL READING';
    screen.appendChild(finalReading);
    screen.appendChild(createLakeGauge(finalDebt, { large: true }).el);
    audio.playLakeSplash(finalDebt);
    screen.appendChild(createCheckInRecord(run.get(), finalDebt));

    const textEl = document.createElement('p');
    textEl.className = 'dx-text dx-ending-body';
    screen.appendChild(textEl);

    stageEl.appendChild(screen);

    const fullText = [...ending.text, epilogueLine].filter(Boolean).join('\n\n');
    typewriter = createTypewriter(textEl, fullText, {
      onDone: () => showEndingIt(screen),
    });
  }

  function handleTextTap() {
    if (typewriter && !typewriter.isDone()) {
      typewriter.finish();
    }
  }

  // IT gets the actual last word of the chapter — one line, once the body
  // text is fully drawn, before the player can leave.
  function showEndingIt(screen) {
    itPopup = createItPopup(stageEl, {
      text: ENDING_IT_TEXT,
      loadout: run.get().loadout,
      flashClose: false,
      onClose: () => {
        itPopup?.destroy();
        itPopup = null;
        appendMenuButton(screen);
      },
    });
  }

  function appendMenuButton(screen) {
    const btn = document.createElement('button');
    btn.className = 'dx-btn';
    btn.textContent = 'BACK TO MENU';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exit();
    });
    screen.appendChild(btn);
  }

  renderJudgment();

  return function unmount() {
    clearTimeout(judgmentTimer);
    typewriter?.destroy();
    itPopup?.destroy();
    stageEl.innerHTML = '';
  };
}
