// Scene type: 'cutscene'. Sequences a list of narrative beats, each drawn
// with the typewriter effect. Tap while drawing to finish the line
// instantly; tap again (or wait, for a timed beat) to continue. See
// docs/SCENE_TYPES.md for the full beat shape, speed-markup syntax, and
// the interactive-choice contract.
//
// scene shape: { type: 'cutscene', id: string, beats: [{ text?, image?, autoAdvanceMs?, interactive?, speaker? }] }
import { createTypewriter } from '../ui/typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick } from '../shell/audio.js';

export function mount(stageEl, scene, { onComplete }) {
  preloadTypewriterTick();
  let beatIndex = 0;
  let typewriter = null;
  let autoAdvanceTimer = null;
  let currentTextBox = null;

  function currentBeat() {
    return scene.beats[beatIndex];
  }

  function render() {
    clearTimeout(autoAdvanceTimer);
    stageEl.innerHTML = '';
    typewriter = null;

    const beat = currentBeat();

    const screen = document.createElement('div');
    screen.className = `dx-screen dx-cutscene-screen${beat.style ? ` dx-cutscene-screen--${beat.style}` : ''}`;
    screen.addEventListener('click', handleTap);

    if (beat.image) {
      const img = document.createElement('img');
      img.className = 'dx-cutscene-bg';
      img.src = beat.image;
      img.alt = '';
      screen.appendChild(img);
    }

    const textBox = document.createElement('div');
    textBox.className = 'dx-cutscene-textbox';
    currentTextBox = textBox;

    if (beat.speaker) {
      const speakerEl = document.createElement('p');
      speakerEl.className = 'dx-cutscene-speaker';
      speakerEl.textContent = beat.speaker;
      textBox.appendChild(speakerEl);
    }

    screen.appendChild(textBox);

    stageEl.appendChild(screen);

    if (beat.text) {
      const textEl = document.createElement('p');
      textEl.className = 'dx-text dx-cutscene-text';
      textBox.appendChild(textEl);
      typewriter = createTypewriter(textEl, beat.text, { onDone: handleBeatReady, onChar: playTypewriterTick });
    } else {
      handleBeatReady();
    }
  }

  // Called once a beat's text (if any) has fully drawn — or immediately
  // for a beat with no text at all (a pure image/choice beat).
  function handleBeatReady() {
    const beat = currentBeat();
    if (beat.interactive) {
      showChoices(currentTextBox, beat.interactive);
    } else {
      showContinueArrow(currentTextBox);
      if (beat.autoAdvanceMs != null) {
        autoAdvanceTimer = setTimeout(advance, beat.autoAdvanceMs);
      }
    }
  }

  function showContinueArrow(textBox) {
    const arrow = document.createElement('span');
    arrow.className = 'dx-continue-arrow';
    arrow.textContent = '▼';
    textBox.appendChild(arrow);
  }

  function showChoices(textBox, interactive) {
    const choices = document.createElement('div');
    choices.className = 'dx-cutscene-choices';
    interactive.options.forEach((option) => {
      const btn = document.createElement('button');
      btn.className = 'dx-btn';
      btn.textContent = option.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        resolveChoice(option);
      });
      choices.appendChild(btn);
    });
    textBox.appendChild(choices);
  }

  function resolveChoice(option) {
    if (option.jumpTo) {
      onComplete({ jumpTo: option.jumpTo });
      return;
    }
    if (option.nextBeat != null) {
      beatIndex = option.nextBeat;
      render();
      return;
    }
    advance();
  }

  // A tap never resolves a choice — only clicking a specific option does,
  // so a stray tap can't skip past a deliberate decision.
  function handleTap() {
    if (typewriter && !typewriter.isDone()) {
      typewriter.finish();
      return;
    }
    if (!currentBeat().interactive) {
      advance();
    }
  }

  function advance() {
    clearTimeout(autoAdvanceTimer);
    beatIndex += 1;
    if (beatIndex >= scene.beats.length) {
      onComplete();
      return;
    }
    render();
  }

  render();

  return function unmount() {
    clearTimeout(autoAdvanceTimer);
    typewriter?.destroy();
    stageEl.innerHTML = '';
  };
}
