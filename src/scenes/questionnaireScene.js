// Scene type: 'questionnaire'. Three swipe questions answered before the
// chapter starts; the player's answers determine their class loadout rather
// than them picking it explicitly. The Therapist character delivers a
// cryptic diagnosis — individual words are colored in the class's emotion
// palette — before handing off to the prologue. No class name is revealed.
//
// scene shape: { type: 'questionnaire', id: 'questionnaire' }
import { emotionColor } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';

// left = truth swipe (drag left), right = lie swipe (drag right).
// Each answer scores one point toward a class; after 3 questions the
// highest total wins. Ties go to the first answer (first instinct).
const QUESTIONS = [
  {
    prompt: 'Something breaks open right in front of you.',
    left:  { label: '← feel it',   scores: 'Crystals' },
    right: { label: 'handle it →', scores: 'Guns'     },
  },
  {
    prompt: 'What holds you together—',
    left:  { label: '← love',    scores: 'Crystals' },
    right: { label: 'belief →',  scores: 'Bible'    },
  },
  {
    prompt: 'Your worst call—',
    left:  { label: '← carrying it',  scores: 'Bible' },
    right: { label: 'own it →',       scores: 'Guns'  },
  },
];

// Dominant emotion per class drives the background pattern on the diagnosis.
const CLASS_ANCHOR = { Guns: 'Anger', Bible: 'Trust', Crystals: 'Joy' };

// Diagnosis text: each segment is either plain text or a colored word.
// Colored words use one of the class's three emotion colors — the player
// won't know why those words glow, but they'll remember them.
const DIAGNOSES = {
  Guns: [
    { text: 'You ' },
    { text: 'already know', emotion: 'Anger' },
    { text: ' what you’re going to do. You’re just ' },
    { text: 'waiting', emotion: 'Fear' },
    { text: ' to see if I’ll ' },
    { text: 'tell you not to', emotion: 'Anticipation' },
    { text: '.' },
  ],
  Bible: [
    { text: 'You ' },
    { text: 'hold', emotion: 'Trust' },
    { text: ' to things most people let go. That’s either ' },
    { text: 'faith', emotion: 'Anticipation' },
    { text: ' or a ' },
    { text: 'fist', emotion: 'Disgust' },
    { text: ' — I’m not sure yet.' },
  ],
  Crystals: [
    { text: 'You ' },
    { text: 'carry', emotion: 'Sadness' },
    { text: ' a lot for someone who doesn’t ' },
    { text: 'say so', emotion: 'Joy' },
    { text: '. Most of it probably ' },
    { text: 'isn’t even yours', emotion: 'Surprise' },
    { text: '.' },
  ],
};

function tallyClass(answers) {
  const scores = { Guns: 0, Bible: 0, Crystals: 0 };
  answers.forEach((cls) => { scores[cls]++; });
  const max = Math.max(...Object.values(scores));
  const winners = Object.keys(scores).filter((k) => scores[k] === max);
  return winners.length === 1 ? winners[0] : answers[0];
}

export function mount(stageEl, _scene, { run, onComplete }) {
  const answers = [];
  let questionIndex = 0;
  let activeCard = null;

  function renderQuestion() {
    activeCard?.destroy();
    stageEl.innerHTML = '';

    const q = QUESTIONS[questionIndex];
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-questionnaire-screen';

    const header = document.createElement('div');
    header.className = 'dx-questionnaire-header';

    const npcLabel = document.createElement('p');
    npcLabel.className = 'dx-text dx-questionnaire-npc';
    npcLabel.textContent = 'THERAPIST';
    header.appendChild(npcLabel);

    const counter = document.createElement('p');
    counter.className = 'dx-text dx-questionnaire-counter';
    counter.textContent = `${questionIndex + 1} / ${QUESTIONS.length}`;
    header.appendChild(counter);

    screen.appendChild(header);

    activeCard = createSwipeCard({
      promptText: q.prompt,
      hints: { left: q.left.label, right: q.right.label },
      onSwipe: (direction) => {
        const answer = direction === 'truth' ? q.left.scores : q.right.scores;
        answers.push(answer);
        questionIndex++;
        if (questionIndex < QUESTIONS.length) {
          renderQuestion();
        } else {
          const cls = tallyClass(answers);
          run.set({ loadout: cls });
          renderDiagnosis(cls);
        }
      },
    });

    screen.appendChild(activeCard.el);
    stageEl.appendChild(screen);
  }

  function renderDiagnosis(cls) {
    activeCard?.destroy();
    activeCard = null;
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-game-screen dx-questionnaire-diagnosis';

    const patternCanvas = document.createElement('canvas');
    patternCanvas.className = 'dx-pattern-bg';
    screen.appendChild(patternCanvas);

    const content = document.createElement('div');
    content.className = 'dx-game-content';

    const npcLabel = document.createElement('p');
    npcLabel.className = 'dx-text dx-questionnaire-npc';
    npcLabel.textContent = 'THERAPIST';
    content.appendChild(npcLabel);

    const diagnosisEl = document.createElement('p');
    diagnosisEl.className = 'dx-text dx-questionnaire-diagnosis-text';
    DIAGNOSES[cls].forEach((seg) => {
      if (seg.emotion) {
        const span = document.createElement('span');
        span.textContent = seg.text;
        span.style.color = emotionColor(seg.emotion);
        diagnosisEl.appendChild(span);
      } else {
        diagnosisEl.appendChild(document.createTextNode(seg.text));
      }
    });
    content.appendChild(diagnosisEl);

    const hint = document.createElement('p');
    hint.className = 'dx-text dx-tap-hint';
    hint.textContent = '(tap to continue)';
    content.appendChild(hint);

    screen.appendChild(content);
    stageEl.appendChild(screen);

    requestAnimationFrame(() => {
      drawEmotionPattern(patternCanvas, {
        seedStr: `therapist:assessment:${cls}`,
        key: CLASS_ANCHOR[cls],
      });
    });

    screen.addEventListener('click', () => onComplete(), { once: true });
  }

  renderQuestion();

  return function unmount() {
    activeCard?.destroy();
    stageEl.innerHTML = '';
  };
}
