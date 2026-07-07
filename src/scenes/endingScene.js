// Scene type: 'ending'. Terminal scene — picks the ending by final Truth
// Debt, records it to the save file, and hands control back to the shell
// via `exit` (not `onComplete` — there's nothing after this). See
// docs/SCENE_TYPES.md.
//
// scene shape: { type: 'ending', id: string, endings: <endings.json> }
import { getEndingKey } from '../engine/endingEngine.js';
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

export function mount(stageEl, scene, { run, exit, recordEnding, chapterId }) {
  const endingKey = getEndingKey(run.get().truthDebt);
  const ending = scene.endings[endingKey];
  recordEnding?.(chapterId, endingKey);

  const intensity = ENDING_INTENSITY[endingKey] ?? 'weak';
  fx.flash(intensity);
  fx.shake(intensity);
  audio.playHit(intensity);

  stageEl.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-ending-screen';

  const title = document.createElement('h2');
  title.className = 'dx-title';
  title.textContent = ending.title;
  screen.appendChild(title);

  const debtLine = document.createElement('p');
  debtLine.className = 'dx-text';
  debtLine.textContent = `Final Truth Debt: ${run.get().truthDebt}`;
  screen.appendChild(debtLine);

  ending.text.forEach((line) => {
    const p = document.createElement('p');
    p.className = 'dx-text';
    p.textContent = line;
    screen.appendChild(p);
  });

  const btn = document.createElement('button');
  btn.className = 'dx-btn';
  btn.textContent = 'BACK TO MENU';
  btn.addEventListener('click', () => exit());
  screen.appendChild(btn);

  stageEl.appendChild(screen);

  return function unmount() {
    stageEl.innerHTML = '';
  };
}
