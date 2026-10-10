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
//   symbolAnim?,            ← animated sign in the upper right, over the
//                              speaker (Bob Baiter's biohazard/fish/etc.)
//   image?, sprite?,        ← static fallback (direct URL)
//   autoAdvanceMs?, interactive?
//   it?,                    ← IT intrusion beat (see renderItBeat below).
//                              `text` here may be a plain string (class-
//                              neutral, e.g. the pre-questionnaire intro
//                              lines) or a { Guns, Bible, Crystals } object
//                              (IT is class-dependent everywhere else it
//                              fires — docs/IT_DESIGN.md), same convention
//                              as ui/walkRoom.js's per-class captions.
//   voice?,                 ← 'it' (default) or 'so' — which of the two
//                              counterpart voices this beat is. Lets a
//                              manuscript script a one-off exchange between
//                              them (content/it_intro.json's opening) even
//                              though SO's *systematic* trigger (answering
//                              every bloom/dominant-emotion line) is owned
//                              by dialogScene.js, not this generic beat
//                              sequencer — see IT_DESIGN.md's "SO — the
//                              doubt rebuttal".
//   art?,                   ← key into ART below: a built-in visual shown
//                              above the text box (the FEELZ boot silhouette,
//                              the lake gauge)
//   sound?,                 ← key into SOUNDS below, played as the beat opens
// }
// An interactive option can carry `record: 'key'` — the chosen label is
// saved to run.checkIn[key] (the FEELZ check-in answers, read back at the
// ending; see endingScene.js).
//
// Confrontations (opensDialog + npc): each option shows its first feeling's
// color as this player's class meets the NPC (the same color its room object
// glowed). A beat or option marked `secret: true` only appears once your
// class restored something in their room (run.secrets[opensDialog]); a
// beat's `text` or an option's `label` may be a { Guns, Bible, Crystals }
// object there too.
import { createTypewriter } from '../ui/typewriterText.js';
import { isFogged } from '../engine/contacts.js';
import { resolveCard } from '../engine/cardEngine.js';
import { CLASSES, classColor, emotionColor, forClass, moodFor } from '../engine/loadout.js';
import { later, cancelLater } from '../shell/pauseBus.js';
import { quoteSpeech } from '../ui/speech.js';
import * as encounterMusic from '../shell/encounterMusic.js';
import { preloadTypewriterTick, playTypewriterTick, startAmbient, stopAmbient, startLeitmotif, playFeelzBoot } from '../shell/audio.js';
import { createFeelzSilhouette } from '../ui/feelzSilhouette.js';
import { createLakeGauge } from '../ui/lakeGauge.js';

// Built-in visuals and sounds a beat can name by key (`art:` / `sound:`),
// so content JSON can ask for them without holding code.
const ART = {
  feelzSilhouette: createFeelzSilhouette,
  lakeGauge: ({ run }) => createLakeGauge(run.get().truthDebt ?? 0),
};
const SOUNDS = { feelzBoot: playFeelzBoot };
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

  const loadout = () => run.get().loadout;
  const secretOpen = () => !!(scene.opensDialog && run.get().secrets?.[scene.opensDialog]);
  // Fogged (Wi-Fi under 4, engine/contacts.js): the liar's lens. Feeling
  // colors go grey and what would comfort them shows warm instead; the white
  // lie is offered, and a player who restored nothing can bluff the secret.
  const fogged = () => !!scene.opensDialog && isFogged(run.get());
  const shown = (item) => {
    if (item.secret) return secretOpen();
    if (item.fake) return fogged() && !secretOpen();
    if (item.whenFogged) return fogged();
    return true;
  };
  const inClass = (text) => forClass(text, loadout());

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
    cancelLater(autoAdvanceTimer);
    itPopup?.destroy();
    itPopup = null;
    oscilloscope?.destroy();
    oscilloscope = null;
    stageEl.innerHTML = '';
    typewriter = null;

    // A secret beat you haven't unlocked isn't there at all.
    while (currentBeat() && !shown(currentBeat())) beatIndex += 1;
    if (!currentBeat()) { onComplete(); return; }
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

    if (beat.symbolAnim) {
      const sym = document.createElement('img');
      sym.className = 'dx-cutscene-symbol';
      sym.alt = '';
      screen.appendChild(sym);
      attachAnim(sym, beat.symbolAnim);
    }

    if (beat.art && ART[beat.art]) {
      const artEl = ART[beat.art]({ run }).el;
      // Animate in only when this art wasn't already on the previous beat.
      if (scene.beats[beatIndex - 1]?.art !== beat.art) artEl.classList.add('is-entering');
      screen.appendChild(artEl);
    }
    if (beat.sound) SOUNDS[beat.sound]?.();

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

    if (beat.secret) screen.classList.add('is-secret');
    screen.style.setProperty('--cls', classColor(loadout()));

    if (beat.text) {
      const textEl = document.createElement('p');
      textEl.className = 'dx-text dx-cutscene-text';
      textBox.appendChild(textEl);
      // A beat with a speaker is that character talking: always in quotes.
      const text = inClass(beat.text);
      const said = beat.speaker ? quoteSpeech(text) : text;
      typewriter = createTypewriter(textEl, said, { onDone: handleBeatReady, onChar: playTypewriterTick });
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
      voice: beat.voice ?? 'it',
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
        autoAdvanceTimer = later(advance, beat.autoAdvanceMs);
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
    interactive.options.filter(shown).forEach((option) => {
      const btn = document.createElement('button');
      btn.className = 'dx-btn';
      btn.textContent = inClass(option.label);
      // The first feeling this opener meets, for your class: the chip.
      const node = option.opener && scene.npc?.nodes?.[option.opener];
      const mood = node && moodFor(node, loadout());
      if (mood && fogged()) {
        // The liar's lens: warm where it would comfort them, grey elsewhere.
        btn.classList.add('has-mood');
        btn.style.setProperty('--mood', node.bid?.includes('lie') ? 'var(--color-comfort)' : 'var(--color-fog)');
      } else if (mood) {
        btn.classList.add('has-mood');
        btn.style.setProperty('--mood', emotionColor(mood));
      }
      if (option.secret || option.fake) {
        btn.classList.add('is-secret');
        btn.style.setProperty('--cls', classColor(loadout()));
        btn.dataset.glyph = CLASSES[loadout()]?.glyph ?? '';
      }
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

  // An option that is itself a lie (the white lie, the bluffed restore) is
  // priced like a lie card: its effects, the lake, the ledger, the Wi-Fi fog.
  function applyLie(option) {
    if (!option.lie) return;
    const node = { id: `${option.opener}_told`, npc: scene.npc?.npc, location: scene.npc?.location, swipes: { lie: option.lie } };
    const { patch } = resolveCard(run.get(), node, 'lie', null);
    run.set({ ...patch, lieStreak: (run.get().lieStreak ?? 0) + 1 });
  }

  function resolveChoice(option) {
    applyLie(option);
    applyOpener(option);
    if (option.record) {
      run.set({ checkIn: { ...run.get().checkIn, [option.record]: inClass(option.label) } });
    }
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
    cancelLater(autoAdvanceTimer);
    beatIndex += 1;
    if (beatIndex >= scene.beats.length) {
      onComplete();
      return;
    }
    render();
  }

  // Warm the browser cache with every frame this cutscene will animate, so
  // a sequence doesn't stutter on first play while its frames trickle in.
  const preloaded = [];
  for (const key of new Set(scene.beats.flatMap((b) => [b.bgAnim, b.spriteAnim, b.symbolAnim]))) {
    const cfg = scene.anims?.[key];
    if (!cfg) continue;
    for (let i = 0; i < cfg.frames; i++) {
      const img = new Image();
      img.src = `${cfg.base}${String(i).padStart(4, '0')}.${cfg.ext ?? 'webp'}`;
      preloaded.push(img);
    }
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
  // An NPC with a baked arrangement opens on its intro section instead.
  if (scene.opensDialog && !encounterMusic.open(scene.opensDialog.toUpperCase())) startLeitmotif(scene.opensDialog.toUpperCase());
  render();

  return function unmount() {
    destroyAnimators();
    cancelLater(autoAdvanceTimer);
    typewriter?.destroy();
    itPopup?.destroy();
    oscilloscope?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
  };
}
