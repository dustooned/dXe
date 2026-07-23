// Scene type: 'cutscene'. Sequences a list of narrative beats, each drawn
// with the typewriter effect. Tap while drawing to finish the line
// instantly; tap again (or wait, for a timed beat) to continue.
//
// scene shape: {
//   type: 'cutscene', id, beats, anims?, ambient?
// }
// beat shape: {
//   text?, speaker?, style?,
//   bgAnim?, spriteAnim?,   ← animated (key into scene.anims)
//   image?, sprite?,        ← static fallback (direct URL)
//   autoAdvanceMs?, interactive?
// }
import { createTypewriter } from '../ui/typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick, startAmbient, stopAmbient } from '../shell/audio.js';
import { createSpriteAnimator } from '../ui/spriteAnimator.js';

export function mount(stageEl, scene, { onComplete }) {
  preloadTypewriterTick();
  let beatIndex = 0;
  let typewriter = null;
  let autoAdvanceTimer = null;
  let currentTextBox = null;

  // Sprite animators persist frame position across beats for the same anim key
  // so animated backgrounds don't restart from 0 on every tap.
  let activeAnimators = [];
  const animFrames = {};

  function currentBeat() {
    return scene.beats[beatIndex];
  }

  function destroyAnimators() {
    for (const { key, animator } of activeAnimators) {
      animFrames[key] = animator.currentFrame;
      animator.destroy();
    }
    activeAnimators = [];
  }

  function attachAnim(el, key) {
    const cfg = scene.anims?.[key];
    if (!cfg) return;
    const animator = createSpriteAnimator(el, cfg, animFrames[key] ?? 0);
    activeAnimators.push({ key, animator });
  }

  function render() {
    destroyAnimators();
    clearTimeout(autoAdvanceTimer);
    stageEl.innerHTML = '';
    typewriter = null;

    const beat = currentBeat();

    const screen = document.createElement('div');
    screen.className = `dx-screen dx-cutscene-screen${beat.style ? ` dx-cutscene-screen--${beat.style}` : ''}`;
    screen.addEventListener('click', handleTap);

    // Background — animated or static
    if (beat.bgAnim) {
      const img = document.createElement('img');
      img.className = 'dx-cutscene-bg';
      img.alt = '';
      screen.appendChild(img);
      attachAnim(img, beat.bgAnim);
    } else if (beat.image) {
      const img = document.createElement('img');
      img.className = 'dx-cutscene-bg';
      img.src = beat.image;
      img.alt = '';
      screen.appendChild(img);
    }

    // Character sprite — animated or static
    if (beat.spriteAnim) {
      const spr = document.createElement('img');
      spr.className = 'dx-cutscene-sprite';
      spr.alt = '';
      screen.appendChild(spr);
      attachAnim(spr, beat.spriteAnim);
    } else if (beat.sprite) {
      const spr = document.createElement('img');
      spr.className = 'dx-cutscene-sprite';
      spr.src = beat.sprite;
      spr.alt = '';
      screen.appendChild(spr);
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

  // A tap never resolves a choice — only clicking a specific option does.
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

  if (scene.ambient) startAmbient(scene.ambient);
  render();

  return function unmount() {
    destroyAnimators();
    clearTimeout(autoAdvanceTimer);
    typewriter?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
  };
}
