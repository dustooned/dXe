// Scene type: 'ending'. Terminal scene — picks the ending by final Truth
// Debt, records it to the save file, and hands control back to the shell
// via `exit` (not `onComplete` — there's nothing after this). See
// docs/SCENE_TYPES.md.
//
// scene shape: { type: 'ending', id: string, endings: <endings.json> }
import { getEndingKey, getEpilogueStat } from '../engine/endingEngine.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';
import { createTypewriter } from '../ui/typewriterText.js';
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

    const debtLine = document.createElement('p');
    debtLine.className = 'dx-text';
    debtLine.textContent = `Final Truth Debt: ${finalDebt}`;
    screen.appendChild(debtLine);

    const textEl = document.createElement('p');
    textEl.className = 'dx-text dx-ending-body';
    screen.appendChild(textEl);

    stageEl.appendChild(screen);

    const fullText = [...ending.text, epilogueLine].filter(Boolean).join('\n\n');
    typewriter = createTypewriter(textEl, fullText, {
      onDone: () => appendMenuButton(screen),
    });
  }

  function handleTextTap() {
    if (typewriter && !typewriter.isDone()) {
      typewriter.finish();
    }
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
    stageEl.innerHTML = '';
  };
}
