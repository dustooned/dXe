// Scene type: 'questionnaire'. Three swipe questions answered before the
// chapter starts; the player's answers determine their class loadout rather
// than them picking it explicitly. The Therapist character delivers a
// cryptic diagnosis — individual words are colored in the class's emotion
// palette — before handing off to the prologue. No class name is revealed.
//
// scene shape: { type: 'questionnaire', id: 'questionnaire' }
import { CLASSES, emotionsForClass } from '../engine/loadout.js';
import { later, cancelLater } from '../shell/pauseBus.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createFeelzSilhouette } from '../ui/feelzSilhouette.js';
import { startAmbient, stopAmbient, playFeelzPing, strikeEmotionVoice, playClassSigil } from '../shell/audio.js';

// The intake is part 2 of FEELZ's check-in (content/feelz_launch.json is
// part 1), so it wears the app: header, progress, fine print. After the
// third answer the file is created and sealed (the class is only named at
// the very end, in the FEELZ report), then FEELZ matches you with a
// provider — Charles Browning, the only place his name appears — and the
// call connects into his read on you.
const PROVIDER = { name: 'CHARLES BROWNING, LCSW', clinic: 'Lake Ulysses Community Clinic' };
// Each line of the "file created" screen, with its delay (ms) after the last.
const FILED_STEPS = [
  { text: 'FILE CREATED', cls: 'is-stamp', at: 200, ping: true },
  { text: 'FP-0█', cls: 'is-code', at: 500 },
  { text: 'Results sealed until session end.', cls: 'is-fine', at: 700 },
  { text: 'Matching you with care...', cls: 'is-fine', at: 1300 },
  { text: '1 provider available.', cls: '', at: 1200 },
  { provider: true, at: 500, ping: true },
  { text: 'Connecting.', cls: 'is-fine', at: 900 },
];

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
//
// The therapist reads these aloud on the call, looking over your intake,
// so each opens by quoting one of your own answers back ({ answer: true }:
// the first answer that scored this class). Each carries one quiet nod to
// the class's lens without naming it: a trigger and a safety for Guns,
// chapter and verse and doubting Thomas for Bible, energy and a prism for
// Crystals.
const DIAGNOSES = {
  Guns: {
    majority: [
      { text: 'You put ‘' }, { answer: true }, { text: '.’ Quick on the trigger, too. People who ' },
      { text: 'move first', emotion: 'Anger' },
      { text: ' are usually ' },
      { text: 'bracing', emotion: 'Fear' },
      { text: ' for something. Bracing gets ' },
      { text: 'heavy', emotion: 'Sadness' },
      { text: '.' },
    ],
    split: [
      { text: 'You put ‘' }, { answer: true }, { text: ',’ and then you didn\u2019t. Safety on, safety off. Part of you wants to ' },
      { text: 'swing', emotion: 'Anger' },
      { text: '. Part of you is ' },
      { text: 'waiting', emotion: 'Fear' },
      { text: ' to see who swings first.' },
    ],
  },
  Bible: {
    majority: [
      { text: 'You put ‘' }, { answer: true }, { text: '.’ Chapter and verse. You like having something to ' },
      { text: 'hold onto', emotion: 'Fear' },
      { text: '. Just check, now and then, whether it\u2019s ' },
      { text: 'holding you', emotion: 'Anxiety' },
      { text: ', or ' },
      { text: 'holding people off', emotion: 'Disgust' },
      { text: '.' },
    ],
    split: [
      { text: 'You put ‘' }, { answer: true }, { text: ',’ then went the other way. A little Thomas in you. You know the ' },
      { text: 'rules', emotion: 'Anxiety' },
      { text: ' by heart. You\u2019re just not sure they ' },
      { text: 'know you', emotion: 'Fear' },
      { text: '.' },
    ],
  },
  Crystals: {
    majority: [
      { text: 'You put ‘' }, { answer: true }, { text: '.’ You ' },
      { text: 'pick up', emotion: 'Happy' },
      { text: ' everyone\u2019s energy, don\u2019t you. Even the parts that ' },
      { text: 'aren\u2019t yours', emotion: 'Surprise' },
      { text: '. That\u2019s a lot to ' },
      { text: 'carry', emotion: 'Anxiety' },
      { text: ' quietly.' },
    ],
    split: [
      { text: 'You put ‘' }, { answer: true }, { text: ',’ then pulled it back. You ' },
      { text: 'caught yourself', emotion: 'Surprise' },
      { text: '. Open, then ' },
      { text: 'careful', emotion: 'Anxiety' },
      { text: '. Light does that through a prism: it ' },
      { text: 'bends', emotion: 'Happy' },
      { text: ', it doesn\u2019t break.' },
    ],
  },
};

// Returns both the winning class and how the vote landed, so the diagnosis
// can be picked by whether the player's three answers actually agreed
// instead of always showing the same line for a given class.
// The read's colored words as typewriter text ({color:Feeling}…{/color}).
// `quoted`: the player's own answer, dropped in where a segment says
// { answer: true }.
function readAsText(segments, quoted = '') {
  return segments.map((s) => (s.answer ? quoted : s.emotion ? `{color:${s.emotion}}${s.text}{/color}` : s.text)).join('');
}

// "← feel it" → "feel it", for the card's stamp.
function stripArrow(label) {
  return label.replace(/[←→]/g, '').trim();
}

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
  // The label of each answer given (for the read to quote back).
  const answerLabels = [];
  let questionIndex = 0;
  let activeCard = null;

  let filedTimers = [];

  function appBar() {
    const header = document.createElement('div');
    header.className = 'dx-intake__bar';
    header.innerHTML = '<span class="dx-intake__app">FEELZ</span><span class="dx-intake__form">EVALUATION</span>';
    return header;
  }

  function renderQuestion() {
    activeCard?.destroy();
    stageEl.innerHTML = '';

    const q = questions[questionIndex];
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-questionnaire-screen dx-intake';
    screen.appendChild(appBar());

    const progress = document.createElement('div');
    progress.className = 'dx-intake__progress';
    for (let i = 0; i < questions.length; i++) {
      const seg = document.createElement('span');
      if (i < questionIndex) seg.className = 'is-done';
      else if (i === questionIndex) seg.className = 'is-now';
      progress.appendChild(seg);
    }
    screen.appendChild(progress);

    const counter = document.createElement('p');
    counter.className = 'dx-text dx-intake__counter';
    counter.textContent = `PART 2 · Q${questionIndex + 1} OF ${questions.length}`;
    screen.appendChild(counter);

    const ask = document.createElement('p');
    ask.className = 'dx-text dx-intake__prompt';
    ask.textContent = q.prompt;
    screen.appendChild(ask);

    activeCard = createSwipeCard({
      promptText: 'drag me',
      hints: { left: q.left.label, right: q.right.label },
      // The stamp is the answer's own words; one neutral color both ways
      // so leaning never hints at a class.
      stamps: { left: stripArrow(q.left.label), right: stripArrow(q.right.label) },
      colors: { left: '#ffffff', right: '#ffffff' },
      tapHints: true,
      onSwipe: (direction) => {
        const side = direction === 'truth' ? q.left : q.right;
        const answer = side.scores;
        answers.push(answer);
        answerLabels.push(stripArrow(side.label));
        questionIndex++;
        if (questionIndex < questions.length) {
          renderQuestion();
        } else {
          const { cls, variant } = tallyClass(answers);
          run.set({ loadout: cls });
          renderFiled(cls, variant);
        }
      },
    });

    screen.appendChild(activeCard.el);

    // First question only: show how it works, once — the card wiggles
    // under a plain instruction.
    if (questionIndex === 0) {
      const how = document.createElement('p');
      how.className = 'dx-text dx-intake__how';
      how.textContent = 'swipe toward your answer, or tap it';
      screen.appendChild(how);
      setTimeout(() => activeCard?.nudge(), 700);
      setTimeout(() => activeCard?.nudge(), 1900);
    }

    const fine = document.createElement('p');
    fine.className = 'dx-text dx-intake__fine';
    fine.textContent = 'No right answers. Results sealed until session end.';
    screen.appendChild(fine);

    stageEl.appendChild(screen);
  }

  // The file is created and sealed, then FEELZ finds your provider.
  function renderFiled(cls, variant) {
    activeCard?.destroy();
    activeCard = null;
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-questionnaire-screen dx-intake dx-intake--filed';
    screen.appendChild(appBar());
    const body = document.createElement('div');
    body.className = 'dx-intake__filed';
    screen.appendChild(body);
    stageEl.appendChild(screen);

    let t = 0;
    let ready = false;
    FILED_STEPS.forEach((step, i) => {
      t += step.at;
      filedTimers.push(later(() => {
        let el;
        if (step.provider) {
          el = document.createElement('div');
          el.className = 'dx-intake__provider';
          el.innerHTML = '<span class="dx-intake__provider-name"></span><span class="dx-intake__provider-clinic"></span>';
          el.querySelector('.dx-intake__provider-name').textContent = PROVIDER.name;
          el.querySelector('.dx-intake__provider-clinic').textContent = PROVIDER.clinic;
        } else {
          el = document.createElement('p');
          el.className = `dx-text dx-intake__line ${step.cls}`;
          el.textContent = step.text;
        }
        body.appendChild(el);
        if (step.ping) playFeelzPing();
        if (i === FILED_STEPS.length - 1) {
          ready = true;
          const hint = document.createElement('p');
          hint.className = 'dx-text dx-tap-hint';
          hint.textContent = '(tap to continue)';
          body.appendChild(hint);
        }
      }, t));
    });

    screen.addEventListener('click', () => {
      if (ready) renderProfile(cls, variant);
    });
  }

  // FEELZ shows the wheel you start with: the pixel wheel from the boot
  // logo, every slice dark, then your three light up one at a time, each
  // with its tone. The class is never named. His read on your answers is
  // saved for the call: the therapist says it as his first line, reading
  // your intake (the {intake} token in therapist_01's PROMPT).
  function renderProfile(cls, variant) {
    filedTimers.forEach(cancelLater);
    filedTimers = [];
    activeCard?.destroy();
    activeCard = null;
    stageEl.innerHTML = '';
    const quoted = answerLabels[answers.indexOf(cls)] ?? answerLabels[0] ?? '';
    run.set({ intakeRead: readAsText(DIAGNOSES[cls][variant], quoted) });

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-questionnaire-screen dx-intake dx-intake--profile';
    const header = document.createElement('div');
    header.className = 'dx-intake__bar';
    header.innerHTML = '<span class="dx-intake__app">FEELZ</span><span class="dx-intake__form">PROFILE READY</span>';
    screen.appendChild(header);

    const body = document.createElement('div');
    body.className = 'dx-intake__filed';
    const done = document.createElement('p');
    done.className = 'dx-text dx-intake__line is-stamp';
    done.textContent = 'EVALUATION COMPLETE';
    body.appendChild(done);
    playFeelzPing();
    const wheel = createFeelzSilhouette({ lit: [] });
    body.appendChild(wheel.el);
    screen.appendChild(body);
    stageEl.appendChild(screen);

    const feelings = CLASSES[cls]?.emotions ?? [];
    const chord = emotionsForClass(cls, []);
    let ready = false;
    feelings.forEach((feeling, i) => {
      filedTimers.push(later(() => {
        wheel.light(feeling);
        strikeEmotionVoice(feeling, chord);
      }, 700 + i * 650));
    });
    const afterLights = 700 + feelings.length * 650 + 300;
    filedTimers.push(later(() => {
      // Your class, heard and never named: a far-off shot, a singing bowl,
      // or a choir (audio.js playClassSigil).
      playClassSigil(cls);
      for (const [text, cls2] of [[`${feelings.length} feelings available.`, ''], ["The rest you'll have to find.", 'is-fine']]) {
        const line = document.createElement('p');
        line.className = `dx-text dx-intake__line ${cls2}`;
        line.textContent = text;
        body.appendChild(line);
      }
    }, afterLights));
    filedTimers.push(later(() => {
      ready = true;
      const hint = document.createElement('p');
      hint.className = 'dx-text dx-tap-hint';
      hint.textContent = '(tap to continue)';
      body.appendChild(hint);
    }, afterLights + 900));

    screen.addEventListener('click', () => { if (ready) onComplete(); });
  }

  startAmbient(THERAPIST_AMBIENT);
  renderQuestion();

  return function unmount() {
    filedTimers.forEach(cancelLater);
    activeCard?.destroy();
    stopAmbient();
    stageEl.innerHTML = '';
  };
}
