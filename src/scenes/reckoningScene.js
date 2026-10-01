// Scene type: 'reckoning'. The Reckoning as a baptism: Pastor Gabriel (born
// Samael) stands in Lake Ulysses and runs an altar call. The confess /
// double-down deck from the run's ledger is still the mechanic (confessing
// clears the water, doubling down fouls it), but he's the one asking, and
// it's never quite enough. That's scrupulosity (religious OCD: confession
// as a compulsion no reassurance satisfies), the natural end point of IT
// and SO's doubt. Then IT and SO, as his gatekeeper hellhounds, walk the
// player into the water, and he holds them under at the lake's final level
// before the ending.
//
// His lines come from content/pastor.json via engine/pastor.js, chosen by
// the lake's live status, the FEELZ check-in answers, and lies told, so
// the hints build toward his contradictions from the player's own data.
// See docs/SCENE_TYPES.md and docs/HANDOFF.md.
//
// scene shape: { type: 'reckoning', id: string, pastor: <pastor.json> }
import { buildReckoningDeck, resolveReckoningCard } from '../engine/reckoning.js';
import { pastorContext, pickSection, pickLine } from '../engine/pastor.js';
import { colorFor, fishStageFor, LAKE_MAX_DEBT } from '../engine/lake.js';
import { createItPopup } from '../ui/itPopup.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { createPastorBust } from '../ui/pastorBust.js';
import { emotionColor, emotionsForClass } from '../engine/loadout.js';
import * as audio from '../shell/audio.js';
import * as voices from '../shell/voices.js';
import * as fx from '../shell/fx.js';

// The entrance: the death clock ticks down to midnight in the dark, then
// strikes — three C64 bell tolls, after Storm Lord's opening — while his
// bust fades in slow, and he greets you in his own voice. His name stays
// "???" until he says it. Times are ms from the start.
const TICKS = ['11:59:56', '11:59:57', '11:59:58', '11:59:59'];
const TICK_MS = 1000;
const TOLLS = [0, 1.7, 3.4]; // seconds after midnight
// The bells are tuned to you: the first two strike your two most-picked
// feelings at the pitch each holds in your chord (the same tones the FEELZ
// wheel plays), the third strikes your top three together. Each flashes
// its feeling's color; brought down two octaves so they ring like bells.
const BELL_OCTAVES_DOWN = 2;
const BUST_FADE_MS = 4200;
const GREET_AT = TICKS.length * TICK_MS + 5200;
const ALTAR_AT = GREET_AT + 1500;

export function mount(stageEl, scene, { run, onComplete }) {
  const script = scene.pastor;
  const deck = buildReckoningDeck(run.get().ledger);
  let typewriter = null;
  let itPopup = null;
  let queue = [];
  let revealedName = false;
  // His name shows only once he's said it (the first line with "Gabriel").
  let nameKnown = false;
  // The lake gauge waits until he asks for your first confession.
  let showLake = false;
  let entranceTimers = [];

  const ctx = () => pastorContext(run.get());

  // One screen, rebuilt per line: nameplate, the live lake reading (he's
  // standing in it), and the line. `underwater` sinks the whole screen into
  // the lake at its current color.
  function renderLine(line, { onTap, extra } = {}) {
    typewriter?.destroy();
    stageEl.innerHTML = '';
    const debt = run.get().truthDebt;

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-reckoning-screen';

    const nameplate = document.createElement('p');
    nameplate.className = 'dx-text dx-pastor-nameplate';
    nameplate.textContent = revealedName ? 'SAMAEL' : nameKnown ? 'PASTOR GABRIEL' : '???';
    screen.appendChild(createPastorBust());
    screen.appendChild(nameplate);

    if (showLake) screen.appendChild(createLakeGauge(debt).el);

    if (line.underwater) {
      const water = document.createElement('div');
      water.className = 'dx-baptism-water';
      water.dataset.stage = String(fishStageFor(debt));
      water.style.setProperty('--water', colorFor(debt));
      screen.appendChild(water);
      audio.playLakeSplash(debt);
    }

    const text = document.createElement('p');
    text.className = `dx-text dx-pastor-line${line.underwater ? ' is-underwater' : ''}`;
    screen.appendChild(text);

    if (extra) screen.appendChild(extra);

    const hint = document.createElement('p');
    hint.className = 'dx-text dx-tap-hint';
    hint.textContent = '(tap to continue)';
    hint.hidden = true;
    if (onTap) screen.appendChild(hint);

    stageEl.appendChild(screen);
    const saysName = !nameKnown && /Gabriel/.test(line.text);
    typewriter = createTypewriter(text, line.text, {
      onChar: audio.playTypewriterTick,
      onDone: () => {
        hint.hidden = false;
        if (saysName) {
          nameKnown = true;
          nameplate.textContent = 'PASTOR GABRIEL';
          nameplate.classList.add('is-arriving');
          nameplate.style.setProperty('--fade', '900ms');
        }
      },
    });
    if (onTap) {
      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else onTap();
      });
    } else {
      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
      });
    }
  }

  // Plays a list of resolved lines in order; IT/SO lines (`voice`) pop up
  // over whatever's on screen instead of replacing it.
  function playLines(lines, then) {
    queue = [...lines];
    const next = () => {
      const line = queue.shift();
      if (!line) { then(); return; }
      if (line.voice) {
        itPopup = createItPopup(stageEl, {
          text: line.text,
          loadout: run.get().loadout,
          voice: line.voice,
          reveal: Boolean(line.reveal),
          flashClose: Boolean(queue[0]?.voice),
          onClose: () => { itPopup?.destroy(); itPopup = null; next(); },
        });
        return;
      }
      if (line.revealsName && !revealedName) voices.say('PASTOR', 'name', { delayMs: 600 });
      if (line.revealsName) revealedName = true;
      renderLine(line, { onTap: next });
    };
    next();
  }

  function renderCard(i) {
    const card = deck[i];
    if (!showLake) {
      showLake = true;
      audio.playLakeSplash(run.get().truthDebt);
    }
    const choices = document.createElement('div');
    choices.className = 'dx-reckoning-card';
    choices.innerHTML = `
      <p class="dx-text dx-reckoning-card__count">CONFESSION ${i + 1} / ${deck.length}</p>
      <p class="dx-text dx-reckoning-card__ledger"></p>
      <div class="dx-menu"></div>
    `;
    choices.querySelector('.dx-reckoning-card__ledger').textContent = card.ledgerText;
    const menu = choices.querySelector('.dx-menu');
    for (const [label, choice] of [['CONFESS', 'confess'], ['DOUBLE DOWN', 'doubleDown']]) {
      const btn = document.createElement('button');
      btn.className = 'dx-btn';
      btn.textContent = label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleChoice(i, choice);
      });
      menu.appendChild(btn);
    }
    const prompt = script.cardPrompt[Math.min(i, script.cardPrompt.length - 1)];
    renderLine({ text: prompt }, { extra: choices });
  }

  function handleChoice(i, choice) {
    const { patch } = resolveReckoningCard(run.get(), deck[i], choice);
    run.set(patch);
    audio.playLakeSplash(run.get().truthDebt);
    voices.say('PASTOR', choice === 'confess' ? 'up' : 'down', { delayMs: 200 });
    const slots = script[choice];
    const line = pickLine(slots[Math.min(i, slots.length - 1)], ctx());
    const next = () => (i + 1 < deck.length ? renderCard(i + 1) : gate());
    if (line) renderLine(line, { onTap: next });
    else next();
  }

  // IT and SO's last words to you: their final IT line and final SO line
  // here pry their names open (SHIT, SHOW). By the ending's last screen
  // they're back to plain IT and SO, as if nothing was said.
  function gate() {
    const lines = pickSection(script.gate, ctx());
    for (const voice of ['it', 'so']) {
      const last = lines.map((l) => l.voice).lastIndexOf(voice);
      if (last >= 0) lines[last] = { ...lines[last], reveal: true };
    }
    playLines(lines, walkDown);
  }

  // They walk you into the water, howling together: clean hounds over
  // clear water, something wrong over a fouled one.
  function walkDown() {
    const ms = audio.playHowl(run.get().truthDebt / LAKE_MAX_DEBT);
    fx.shake('weak');
    setTimeout(baptism, Math.min(ms, 2600));
  }

  function baptism() {
    // The name reveal is the second baptism line; mark it so the nameplate
    // turns from PASTOR GABRIEL to SAMAEL from that line on.
    const lines = pickSection(script.baptism, ctx()).map((line, idx) => (idx === 1 ? { ...line, revealsName: true } : line));
    playLines(lines, () => onComplete());
  }

  function altar() {
    entranceTimers.forEach(clearTimeout);
    entranceTimers = [];
    playLines(pickSection(script.altar, ctx()), () => (deck.length ? renderCard(0) : gate()));
  }

  // Your feelings in the order you leaned on them: most-picked first, from
  // the ones you can feel; topped up with your class's own if you barely
  // picked any. Three at most.
  function activeFeelings() {
    const s = run.get();
    return emotionsForClass(s.loadout, s.unlocked ?? []);
  }
  function alignment() {
    const active = activeFeelings();
    const counts = run.get().emotionCounts ?? {};
    const ranked = active.filter((e) => counts[e]).sort((x, y) => counts[y] - counts[x]);
    for (const e of active) if (ranked.length < 3 && !ranked.includes(e)) ranked.push(e);
    return ranked.slice(0, 3);
  }

  // The clock, the bang, the slow fade, the greeting. A tap skips to him.
  function entrance() {
    stageEl.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-reckoning-screen dx-pastor-entrance';
    const clock = document.createElement('p');
    clock.className = 'dx-text dx-pastor-clock';
    screen.appendChild(clock);
    stageEl.appendChild(screen);
    const at = (ms, fn) => entranceTimers.push(setTimeout(fn, ms));

    TICKS.forEach((time, i) => at(i * TICK_MS, () => {
      clock.textContent = time;
      audio.playClockTick(i % 2 === 1);
    }));
    at(TICKS.length * TICK_MS, () => {
      clock.textContent = '12:00:00';
      const feelings = alignment();
      const pitch = (e) => (audio.emotionFrequency(e, activeFeelings()) ?? 392) / 2 ** BELL_OCTAVES_DOWN;
      const strikes = [[feelings[0]], [feelings[1] ?? feelings[0]], feelings];
      TOLLS.forEach((sec, k) => {
        const these = strikes[k];
        audio.playC64Toll(sec, these.map(pitch));
        at(sec * 1000, () => {
          fx.flash(k === TOLLS.length - 1 ? 'strong' : 'weak', emotionColor(these[0]));
          fx.shake(k === 0 ? 'strong' : 'weak');
        });
      });
      at(900, () => clock.remove());
      const bust = createPastorBust();
      bust.classList.add('is-arriving');
      bust.style.setProperty('--fade', `${BUST_FADE_MS}ms`);
      const nameplate = document.createElement('p');
      nameplate.className = 'dx-text dx-pastor-nameplate is-arriving';
      nameplate.style.setProperty('--fade', `${BUST_FADE_MS}ms`);
      nameplate.textContent = '???';
      screen.append(bust, nameplate);
    });
    at(GREET_AT, () => voices.say('PASTOR', 'greet'));
    at(ALTAR_AT, altar);
    screen.addEventListener('click', altar, { once: true });
  }

  entrance();

  return function unmount() {
    entranceTimers.forEach(clearTimeout);
    typewriter?.destroy();
    itPopup?.destroy();
    stageEl.innerHTML = '';
  };
}
