// Scene type: 'ending'. Terminal scene — picks the ending by final Truth
// Debt, records it to the save file, and hands control back to the shell
// via `exit` (not `onComplete` — there's nothing after this). See
// docs/SCENE_TYPES.md.
//
// scene shape: { type: 'ending', id: string, endings: <endings.json> }
import { getEndingKey, getEpilogueLine } from '../engine/endingEngine.js';
import { later, cancelLater } from '../shell/pauseBus.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createItPopup } from '../ui/itPopup.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { ENDING_IT_TEXT, ENDING_SO_TEXT } from '../engine/itEndgame.js';
import { buildRecord, createFaxPrintout, downloadRecordPng } from '../ui/feelzRecord.js';
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
  const epilogueLine = getEpilogueLine(run.get(), scene.endings.epilogues);

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

    judgmentTimer = later(showText, JUDGMENT_BEAT_MS);
  }

  function skipJudgment() {
    cancelLater(judgmentTimer);
    showText();
  }

  // The ending, one thing per screen:
  //   1. the final reading  — the lake gauge, full size
  //   2. the story          — each line of the ending its own slide, with
  //                           an image (placeholder frames until art lands)
  //   3. the epilogue       — the stat that broke, as its own slide
  //   4. a closing quote, then the ending's name as a title card
  //   5. the record         — everything consolidated, printed like a fax,
  //                           with SAVE AS PNG (an official FEELZ document)
  // then IT and SO get the last word.
  function newPage(className) {
    stageEl.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = `dx-screen dx-ending-screen ${className}`;
    stageEl.appendChild(screen);
    return screen;
  }

  function showText() {
    cancelLater(judgmentTimer);
    const screen = newPage('dx-ending-page--water');
    const label = document.createElement('p');
    label.className = 'dx-text dx-ending-reading-label';
    label.textContent = 'FINAL READING';
    screen.appendChild(label);
    screen.appendChild(createLakeGauge(finalDebt, { large: true }).el);
    audio.playLakeSplash(finalDebt);
    tapHint(screen);
    screen.addEventListener('click', () => showSlide(0), { once: true });
  }

  function tapHint(screen) {
    const hint = document.createElement('p');
    hint.className = 'dx-text dx-tap-hint';
    hint.textContent = '(tap to continue)';
    screen.appendChild(hint);
  }

  // The story's slides: every line of the ending, then the epilogue.
  const slides = [
    ...ending.text.map((line, i) => ({ text: line, image: ending.images?.[i] ?? null, n: i + 1 })),
    ...(epilogueLine ? [{ text: epilogueLine, epilogue: true }] : []),
  ];

  function showSlide(i) {
    if (i >= slides.length) { showQuote(); return; }
    const slide = slides[i];
    const screen = newPage('dx-ending-page--slide');
    const frame = document.createElement('div');
    frame.className = 'dx-ending-frame';
    if (slide.image) {
      const img = document.createElement('img');
      img.src = slide.image;
      img.alt = '';
      frame.appendChild(img);
    } else {
      // Placeholder until art: the ending and slide number, and the line
      // it illustrates, for whoever draws it.
      frame.classList.add('is-placeholder');
      frame.innerHTML = `<span class="dx-ending-frame__tag">${slide.epilogue ? 'EPILOGUE' : `${ending.title} · ${slide.n}`}</span><span class="dx-ending-frame__ph">IMAGE</span>`;
    }
    screen.appendChild(frame);
    if (slide.epilogue) {
      const tag = document.createElement('p');
      tag.className = 'dx-text dx-ending-reading-label';
      tag.textContent = 'EPILOGUE';
      screen.appendChild(tag);
    }
    const text = document.createElement('p');
    text.className = 'dx-text dx-ending-slide-text';
    screen.appendChild(text);
    typewriter?.destroy();
    typewriter = createTypewriter(text, slide.text, { onChar: audio.playTypewriterTick });
    screen.addEventListener('click', () => {
      if (typewriter && !typewriter.isDone()) { typewriter.finish(); return; }
      showSlide(i + 1);
    });
  }

  function showQuote() {
    const screen = newPage('dx-ending-page--quote');
    if (ending.quote) {
      const q = document.createElement('p');
      q.className = 'dx-text dx-ending-quote';
      screen.appendChild(q);
      const by = document.createElement('p');
      by.className = 'dx-text dx-ending-quote-by';
      by.textContent = `— ${ending.quoteBy}`;
      by.hidden = true;
      screen.appendChild(by);
      typewriter?.destroy();
      typewriter = createTypewriter(q, `\u201c${ending.quote}\u201d`, { onChar: audio.playTypewriterTick, onDone: () => { by.hidden = false; } });
    }
    screen.addEventListener('click', () => {
      if (typewriter && !typewriter.isDone()) { typewriter.finish(); return; }
      showCard();
    });
  }

  function showCard() {
    const screen = newPage('dx-ending-page--card');
    const kicker = document.createElement('p');
    kicker.className = 'dx-text dx-ending-reading-label';
    kicker.textContent = 'ENDING';
    const title = document.createElement('h2');
    title.className = 'dx-title dx-ending-card-title';
    title.textContent = ending.title;
    screen.append(kicker, title);
    fx.flash(intensity);
    audio.playHit(intensity);
    tapHint(screen);
    screen.addEventListener('click', showRecord, { once: true });
  }

  let fax = null;
  function showRecord() {
    const screen = newPage('dx-ending-page--record');
    const record = buildRecord(run.get(), ending);
    const actions = document.createElement('div');
    actions.className = 'dx-ending-actions';
    actions.hidden = true;
    const save = document.createElement('button');
    save.className = 'dx-btn';
    save.textContent = 'SAVE AS PNG';
    save.addEventListener('click', async (e) => {
      e.stopPropagation();
      save.disabled = true;
      save.textContent = 'PRINTING…';
      await downloadRecordPng(record);
      save.disabled = false;
      save.textContent = 'SAVE AS PNG';
    });
    actions.appendChild(save);
    fax = createFaxPrintout(record, {
      onDone: () => {
        if (!actions.hidden) return;
        actions.hidden = false;
        showEndingIt(actions);
      },
    });
    screen.append(fax.el, actions);
    // A tap pulls the paper: it rushes (and jams) rather than vanishing.
    fax.el.querySelector('.dx-fax__paper').addEventListener('click', () => fax.rush());
    fax.el.querySelector('.dx-fax__printer').addEventListener('click', () => fax.rush());
  }

  // IT and SO get the actual last word of the chapter — once the body text
  // is fully drawn, before the player can leave.
  function showEndingIt(screen) {
    itPopup = createItPopup(stageEl, {
      text: ENDING_IT_TEXT,
      loadout: run.get().loadout,
      flashClose: true,
      onClose: () => {
        itPopup?.destroy();
        itPopup = createItPopup(stageEl, {
          text: ENDING_SO_TEXT,
          loadout: run.get().loadout,
          voice: 'so',
          onClose: () => {
            itPopup?.destroy();
            itPopup = null;
            appendMenuButton(screen);
          },
        });
      },
    });
  }

  function appendMenuButton(screen) {
    const btn = document.createElement('button');
    btn.className = 'dx-btn';
    btn.textContent = 'BACK TO TITLE';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exit();
    });
    screen.appendChild(btn);
  }

  renderJudgment();

  return function unmount() {
    cancelLater(judgmentTimer);
    typewriter?.destroy();
    fax?.destroy();
    itPopup?.destroy();
    stageEl.innerHTML = '';
  };
}
