// Scene type: 'cutscene'. Sequences a list of narrative beats, each drawn
// with the typewriter effect. Tap while drawing to finish the line
// instantly; tap again (or wait, for a timed beat) to continue.
//
// scene shape: {
//   type: 'cutscene', id, beats, anims?, ambient?, opensDialog?
// }
// beat shape: {
//   text?, speaker?, style?,
//   bgAnim?, spriteAnim?,   ← animated (key into scene.anims)
//   image?, sprite?,        ← static fallback (direct URL)
//   autoAdvanceMs?, interactive?
//   it?,                    ← IT intrusion beat (see renderItBeat below).
//                              `text` here may be a plain string (class-
//                              neutral, e.g. the pre-questionnaire intro
//                              lines) or a { Guns, Bible, Crystals } object
//                              (IT is class-dependent everywhere else it
//                              fires — docs/IT_DESIGN.md), same convention
//                              as ui/walkRoom.js's per-class captions.
// }
import { createTypewriter } from '../ui/typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick, startAmbient, stopAmbient, startLeitmotif } from '../shell/audio.js';
import { createSpriteAnimator } from '../ui/spriteAnimator.js';
import { createItPopup } from '../ui/itPopup.js';
import { createOscilloscope } from '../ui/oscilloscope.js';

export function mount(stageEl, scene, { run, onComplete }) {
  preloadTypewriterTick();
  let beatIndex = 0;
  let typewriter = null;
  let autoAdvanceTimer = null;
  let currentTextBox = null;
  let itPopup = null;
  let oscilloscope = null;

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
    itPopup?.destroy();
    itPopup = null;
    oscilloscope?.destroy();
    oscilloscope = null;
    stageEl.innerHTML = '';
    typewriter = null;

    const beat = currentBeat();

    if (beat.it) {
      renderItBeat(beat);
      return;
    }

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
    } else if (scene.opensDialog) {
      // Confrontations have no background art of their own — real
      // audio (this NPC's leitmotif, stings) drawn as a waveform, not a
      // decorative loop, fills that space instead.
      const scopeCanvas = document.createElement('canvas');
      scopeCanvas.className = 'dx-cutscene-bg dx-cutscene-oscilloscope';
      screen.appendChild(scopeCanvas);
      oscilloscope = createOscilloscope(scopeCanvas, {
        getPlayerStats: () => run.get(),
      });
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

  // IT — an uninvited thought, not a narration beat (see ui/itPopup.js for
  // the render and docs/IT_DESIGN.md for what IT is). The X flashes unless
  // this is the last beat in the sequence: flashing says "there's another
  // one of these coming," which isn't true on the last one.
  function renderItBeat(beat) {
    const isLastBeat = beatIndex >= scene.beats.length - 1;
    itPopup = createItPopup(stageEl, {
      text: beat.text,
      loadout: run.get().loadout,
      flashClose: !isLastBeat,
      onClose: advance,
    });
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

  // A confrontation is just a cutscene that shapes what comes next: with
  // `opensDialog` naming a later dialog scene, an option's `opener` picks which
  // node that NPC opens on. Everything else — sprite, speaker, branching
  // beats — this scene type already had, so there's no separate type for it.
  function applyOpener(option) {
    if (!option.opener || !scene.opensDialog) return;
    run.set({ openers: { ...run.get().openers, [scene.opensDialog]: option.opener } });
  }

  function resolveChoice(option) {
    applyOpener(option);
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
  // Confrontations only — starts this NPC's leitmotif here rather than
  // waiting for dialogScene.js, so the oscilloscope has something real to
  // trace during the confrontation itself, not just silence. Deliberately
  // not stopped in this scene's own unmount below: a confrontation always
  // leads straight into that NPC's dialog scene, which calls
  // startLeitmotif() with the same key and (per audio.js) just continues
  // rather than restarting — stopping it here first would cause exactly
  // the glitch that continuity check exists to avoid. dialogScene.js's own
  // unmount is what actually stops it, once that encounter really ends.
  if (scene.opensDialog) startLeitmotif(scene.opensDialog.toUpperCase());
  render();

  return function unmount() {
    destroyAnimators();
    clearTimeout(autoAdvanceTimer);
    typewriter?.destroy();
    itPopup?.destroy();
    oscilloscope?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
  };
}
