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
import { startAmbient, stopAmbient, playTyagl } from '../shell/audio.js';

const THERAPIST_AMBIENT = '/assets/lake-ulysses/audio/heavens_waiting_room.mp3';

// left = truth swipe (drag left), right = lie swipe (drag right).
// Each answer scores one point toward a class; after 3 questions the
// highest total wins. Ties go to the first answer (first instinct).
//
// Three slots, one per class pair (Crystals/Guns, Crystals/Bible,
// Bible/Guns) — tallyClass's math (see below) depends on exactly this
// shape: each class offered on exactly 2 of 3 questions, so every run
// lands on a clean majority or a genuine 3-way tie, nothing else. A run
// draws one random question per slot rather than always the same three, so
// replays don't open with an identical questionnaire — the class-scoring
// math doesn't care which question fills a slot, only which pair it tests.
const QUESTION_SLOTS = [
  [ // Crystals vs Guns
    {
      prompt: 'Something breaks open right in front of you.',
      left:  { label: '← feel it',   scores: 'Crystals' },
      right: { label: 'handle it →', scores: 'Guns'     },
    },
    {
      prompt: 'Someone lies straight to your face.',
      left:  { label: '← let it go',    scores: 'Crystals' },
      right: { label: 'call it out →',  scores: 'Guns'     },
    },
    {
      prompt: 'You’re handed the worst news with no warning at all.',
      left:  { label: '← sit with it',   scores: 'Crystals' },
      right: { label: 'do something →',  scores: 'Guns'     },
    },
  ],
  [ // Crystals vs Bible
    {
      prompt: 'What holds you together—',
      left:  { label: '← love',    scores: 'Crystals' },
      right: { label: 'belief →',  scores: 'Bible'    },
    },
    {
      prompt: 'When the floor actually drops out—',
      left:  { label: '← who you love',     scores: 'Crystals' },
      right: { label: 'what you believe →', scores: 'Bible'    },
    },
    {
      prompt: 'The thing you can’t explain, you call it—',
      left:  { label: '← a feeling', scores: 'Crystals' },
      right: { label: 'a sign →',    scores: 'Bible'    },
    },
  ],
  [ // Bible vs Guns
    {
      prompt: 'Your worst call—',
      left:  { label: '← carrying it',  scores: 'Bible' },
      right: { label: 'own it →',       scores: 'Guns'  },
    },
    {
      prompt: 'When you’re wrong about something—',
      left:  { label: '← you carry it quietly', scores: 'Bible' },
      right: { label: 'you say it out loud →',  scores: 'Guns'  },
    },
    {
      prompt: 'The line you won’t cross—',
      left:  { label: '← it’s wrong',        scores: 'Bible' },
      right: { label: 'it costs too much →', scores: 'Guns'  },
    },
  ],
];

function pickQuestions() {
  return QUESTION_SLOTS.map((slot) => slot[Math.floor(Math.random() * slot.length)]);
}

// Dominant emotion per class drives the background pattern on the diagnosis.
const CLASS_ANCHOR = { Guns: 'Anger', Bible: 'Trust', Crystals: 'Joy' };

// Diagnosis text: each segment is either plain text or a colored word.
// Colored words use one of the class's three emotion colors — the player
// won't know why those words glow, but they'll remember them.
//
// Two variants per class, keyed by how the three questions actually landed
// (tallyClass below) rather than picked at random — the same "read the
// choices back, don't just roll a die" rule the per-NPC reaction codas
// (engine/reactions.js) and IT/SO follow elsewhere. Only two variants
// because only two outcomes are reachable: each class is offered on exactly
// 2 of the 3 questions (see QUESTION_SLOTS above), so "all 3 agree" can't happen
// — a run either lands a clean 2-of-3 (majority) or all three answers land
// on three different classes, a genuine tie broken by first instinct (split).
//   majority   2 of 3 — the plainer diagnosis
//   split      a real 3-way tie — the read acknowledges the player wasn't
//              sure either, instead of pretending the read was clean
const DIAGNOSES = {
  Guns: {
    majority: [
      { text: 'You ' },
      { text: 'already know', emotion: 'Anger' },
      { text: ' what you’re going to do. You’re just ' },
      { text: 'waiting', emotion: 'Fear' },
      { text: ' to see if I’ll ' },
      { text: 'tell you not to', emotion: 'Anticipation' },
      { text: '.' },
    ],
    split: [
      { text: 'Some of you ' },
      { text: 'already knows', emotion: 'Anger' },
      { text: ' what you’re going to do. The rest of you is still ' },
      { text: 'waiting', emotion: 'Fear' },
      { text: ' to be told not to.' },
    ],
  },
  Bible: {
    majority: [
      { text: 'You ' },
      { text: 'hold', emotion: 'Trust' },
      { text: ' to things most people let go. That’s either ' },
      { text: 'faith', emotion: 'Anticipation' },
      { text: ' or a ' },
      { text: 'fist', emotion: 'Disgust' },
      { text: ' — I’m not sure yet.' },
    ],
    split: [
      { text: 'You ' },
      { text: 'hold on', emotion: 'Trust' },
      { text: ' when it’s ' },
      { text: 'faith', emotion: 'Anticipation' },
      { text: ', and let go when it’s a ' },
      { text: 'fist', emotion: 'Disgust' },
      { text: '. Convenient, that you always know which is which.' },
    ],
  },
  Crystals: {
    majority: [
      { text: 'You ' },
      { text: 'carry', emotion: 'Sadness' },
      { text: ' a lot for someone who doesn’t ' },
      { text: 'say so', emotion: 'Joy' },
      { text: '. Most of it probably ' },
      { text: 'isn’t even yours', emotion: 'Surprise' },
      { text: '.' },
    ],
    split: [
      { text: 'You ' },
      { text: 'carry', emotion: 'Sadness' },
      { text: ' a lot for someone who doesn’t ' },
      { text: 'say so', emotion: 'Joy' },
      { text: ' — though for a second there, you almost ' },
      { text: 'put some of it down', emotion: 'Surprise' },
      { text: '.' },
    ],
  },
};

// Returns both the winning class and how the vote landed, so the diagnosis
// can be picked by whether the player's three answers actually agreed
// instead of always showing the same line for a given class.
function tallyClass(answers) {
  const scores = { Guns: 0, Bible: 0, Crystals: 0 };
  answers.forEach((cls) => { scores[cls]++; });
  const max = Math.max(...Object.values(scores));
  const winners = Object.keys(scores).filter((k) => scores[k] === max);
  if (winners.length === 1) {
    return { cls: winners[0], variant: 'majority' };
  }
  // A genuine 3-way tie — resolved by "first instinct wins," so the
  // diagnosis reads that same tie back to the player.
  return { cls: answers[0], variant: 'split' };
}

export function mount(stageEl, _scene, { run, onComplete }) {
  const questions = pickQuestions();
  const answers = [];
  let questionIndex = 0;
  let activeCard = null;

  function renderQuestion() {
    activeCard?.destroy();
    stageEl.innerHTML = '';

    const q = questions[questionIndex];
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
    // This is the FEELZ app's intake form (the feelz-launch cutscene just
    // opened the app), so it's labeled like one.
    counter.textContent = `INTAKE ${questionIndex + 1} / ${questions.length}`;
    header.appendChild(counter);

    screen.appendChild(header);

    activeCard = createSwipeCard({
      promptText: q.prompt,
      hints: { left: q.left.label, right: q.right.label },
      onSwipe: (direction) => {
        const answer = direction === 'truth' ? q.left.scores : q.right.scores;
        answers.push(answer);
        questionIndex++;
        if (questionIndex < questions.length) {
          renderQuestion();
        } else {
          const { cls, variant } = tallyClass(answers);
          run.set({ loadout: cls });
          renderDiagnosis(cls, variant);
        }
      },
    });

    screen.appendChild(activeCard.el);
    stageEl.appendChild(screen);
  }

  function renderDiagnosis(cls, variant) {
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
    DIAGNOSES[cls][variant].forEach((seg) => {
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

    playTyagl();
    requestAnimationFrame(() => {
      drawEmotionPattern(patternCanvas, {
        seedStr: `therapist:assessment:${cls}`,
        key: CLASS_ANCHOR[cls],
      });
    });

    screen.addEventListener('click', () => onComplete(), { once: true });
  }

  startAmbient(THERAPIST_AMBIENT);
  renderQuestion();

  return function unmount() {
    activeCard?.destroy();
    stopAmbient();
    stageEl.innerHTML = '';
  };
}
