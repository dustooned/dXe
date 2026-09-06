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
//   it?,                    ← IT intrusion beat (see renderItBeat below)
// }
import { createTypewriter } from '../ui/typewriterText.js';
import { preloadTypewriterTick, playTypewriterTick, startAmbient, stopAmbient } from '../shell/audio.js';
import { createSpriteAnimator } from '../ui/spriteAnimator.js';

export function mount(stageEl, scene, { run, onComplete }) {
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

  // IT — an uninvited thought, not a narration beat. Deliberately not a
  // variant of the normal textbox: it renders as a centered popup over a
  // scrim (unlike everything else here, which is bottom-anchored and full-
  // bleed), and closing it is gated behind an explicit X rather than a tap
  // anywhere — the point is that it has to be *noticed and dismissed*, the
  // way an intrusive ad does, not tapped past on the way to something else.
  // No speaker label (IT never announces itself), no choices — IT only ever
  // observes, it doesn't converse (docs/IT_DESIGN.md). Layout borrows the
  // traditional RPG dialog box (Undertale/Deltarune): a portrait slot at
  // left, vertically centered, text filling the rest of the box beside it.
  // The slot is an empty bordered placeholder — no real IT identity/mark
  // exists yet, so it's just the shape and size art will eventually fill.
  function renderItBeat(beat) {
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-cutscene-screen dx-it-screen';
    stageEl.appendChild(screen);

    const scrim = document.createElement('div');
    scrim.className = 'dx-it-scrim';
    screen.appendChild(scrim);

    const box = document.createElement('div');
    box.className = 'dx-it-box';
    screen.appendChild(box);

    const icon = document.createElement('div');
    icon.className = 'dx-it-icon';
    box.appendChild(icon);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dx-it-close';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.textContent = 'X';
    box.appendChild(closeBtn);

    const textEl = document.createElement('p');
    textEl.className = 'dx-it-text';
    box.appendChild(textEl);

    // The X flashes once the line finishes drawing to say "there's another
    // one of these after this" — the same job the ▼ cue does everywhere
    // else, just aimed at the control that actually does something here.
    // It never flashes on the last beat in the sequence: nothing follows,
    // so there's nothing to signal.
    const isLastBeat = beatIndex >= scene.beats.length - 1;

    typewriter = createTypewriter(textEl, beat.text, {
      onChar: playTypewriterTick,
      onDone: () => { if (!isLastBeat) closeBtn.classList.add('is-flashing'); },
    });

    // Tapping the box only finishes the draw early. Only the X advances —
    // see the function comment for why that's deliberate, not an oversight.
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typewriter && !typewriter.isDone()) typewriter.finish();
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      advance();
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
  render();

  return function unmount() {
    destroyAnimators();
    clearTimeout(autoAdvanceTimer);
    typewriter?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
  };
}
