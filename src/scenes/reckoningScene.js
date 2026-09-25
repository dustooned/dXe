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
import { colorFor, fishStageFor } from '../engine/lake.js';
import { createItPopup } from '../ui/itPopup.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import * as audio from '../shell/audio.js';

export function mount(stageEl, scene, { run, onComplete }) {
  const script = scene.pastor;
  const deck = buildReckoningDeck(run.get().ledger);
  let typewriter = null;
  let itPopup = null;
  let queue = [];
  let revealedName = false;

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
    nameplate.textContent = revealedName ? 'SAMAEL' : 'PASTOR GABRIEL';
    screen.appendChild(nameplate);

    screen.appendChild(createLakeGauge(debt).el);

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
    typewriter = createTypewriter(text, line.text, {
      onChar: audio.playTypewriterTick,
      onDone: () => { hint.hidden = false; },
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
          flashClose: Boolean(queue[0]?.voice),
          onClose: () => { itPopup?.destroy(); itPopup = null; next(); },
        });
        return;
      }
      if (line.revealsName) revealedName = true;
      renderLine(line, { onTap: next });
    };
    next();
  }

  function renderCard(i) {
    const card = deck[i];
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
    const slots = script[choice];
    const line = pickLine(slots[Math.min(i, slots.length - 1)], ctx());
    const next = () => (i + 1 < deck.length ? renderCard(i + 1) : gate());
    if (line) renderLine(line, { onTap: next });
    else next();
  }

  function gate() {
    playLines(pickSection(script.gate, ctx()), baptism);
  }

  function baptism() {
    // The name reveal is the second baptism line; mark it so the nameplate
    // turns from PASTOR GABRIEL to SAMAEL from that line on.
    const lines = pickSection(script.baptism, ctx()).map((line, idx) => (idx === 1 ? { ...line, revealsName: true } : line));
    playLines(lines, () => onComplete());
  }

  playLines(pickSection(script.altar, ctx()), () => (deck.length ? renderCard(0) : gate()));

  return function unmount() {
    typewriter?.destroy();
    itPopup?.destroy();
    stageEl.innerHTML = '';
  };
}
