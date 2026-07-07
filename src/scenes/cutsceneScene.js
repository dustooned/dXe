// Scene type: 'cutscene'. Sequences a list of narrative beats, each drawn
// with the typewriter effect. Tap while drawing to finish the line
// instantly; tap again (or wait, for a timed beat) to continue. See
// docs/SCENE_TYPES.md for the beat shape and speed-markup syntax.
//
// scene shape: { type: 'cutscene', id: string, beats: [{ text, autoAdvanceMs? }] }
import { createTypewriter } from '../ui/typewriterText.js';

export function mount(stageEl, scene, { onComplete }) {
  let beatIndex = 0;
  let typewriter = null;
  let autoAdvanceTimer = null;

  function currentBeat() {
    return scene.beats[beatIndex];
  }

  function render() {
    clearTimeout(autoAdvanceTimer);
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-cutscene-screen';
    screen.addEventListener('click', handleTap);

    const textBox = document.createElement('div');
    textBox.className = 'dx-cutscene-textbox';

    const textEl = document.createElement('p');
    textEl.className = 'dx-text dx-cutscene-text';
    textBox.appendChild(textEl);

    screen.appendChild(textBox);
    stageEl.appendChild(screen);

    const beat = currentBeat();
    typewriter = createTypewriter(textEl, beat.text, {
      onDone: () => {
        showContinueArrow(textBox);
        if (beat.autoAdvanceMs != null) {
          autoAdvanceTimer = setTimeout(advance, beat.autoAdvanceMs);
        }
      },
    });
  }

  function showContinueArrow(textBox) {
    const arrow = document.createElement('span');
    arrow.className = 'dx-continue-arrow';
    arrow.textContent = '▼';
    textBox.appendChild(arrow);
  }

  function handleTap() {
    if (!typewriter.isDone()) {
      typewriter.finish();
      return;
    }
    advance();
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
