// The IT popup — an uninvited thought, not a line of dialog. Shared by any
// scene that needs one: the cutscene 'it' beat (src/scenes/cutsceneScene.js)
// and dialogScene's bloom-event interrupt. See docs/IT_DESIGN.md for what
// IT is and docs/SCENE_TYPES.md's "IT beat" section for the fuller writeup
// of the interaction choices below — this file is the factored-out render,
// not a new design.
import { createTypewriter } from './typewriterText.js';
import { playTypewriterTick, playItSting } from '../shell/audio.js';

// `text` is either a plain string (class-neutral — the only option before
// the player has a loadout) or a { Guns, Bible, Crystals } object, resolved
// against the player's class. Unknown/missing loadout falls back to the
// first variant rather than rendering blank, same rule ui/walkRoom.js's
// captions use — a half-authored line still shows something.
export function resolveItText(text, loadout) {
  if (typeof text === 'string') return text;
  return text?.[loadout] ?? Object.values(text ?? {})[0] ?? '';
}

// Mounts as an absolutely-positioned overlay inside `stageEl` — it does not
// clear or own the rest of `stageEl`'s content, so a caller can pop it up
// over a screen that's already rendered (dialogScene's bloom interrupt) or
// into a freshly-cleared one (cutsceneScene's beat). Returns { destroy }.
//
// `flashClose` controls whether the X flashes once the line finishes
// drawing, signaling "there's another one of these coming" — leave it off
// for a one-off interrupt (nothing follows), on for a beat mid-sequence
// that isn't the last one. `onClose` fires once, when the player dismisses it;
// this popup does not call destroy() on itself afterward — the caller does,
// same as it owns deciding what happens next.
//
// `voice` picks which of the two counterpart voices this is (see
// docs/IT_DESIGN.md's "SO — the doubt rebuttal") — 'it' (default) or 'so'.
// Same box, same font, same dismiss gesture; 'so' just inverts the color
// scheme (scenes.css's `.dx-it-box--so`) rather than getting new art —
// SO doesn't need its own visual language, it needs to read as IT's own
// box turned inside out, since that's literally what it's doing to
// whatever IT just said.
export function createItPopup(stageEl, { text, loadout, flashClose = false, onClose, voice = 'it' } = {}) {
  let typewriter = null;

  // IT's own sting — distinct from tyagl.mp3, which stays under the
  // Therapist's diagnosis reveal (questionnaireScene.js). Fires the instant
  // the popup mounts, ahead of the typewriter draw, to land with the
  // appearance.
  playItSting();

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-it-screen';
  stageEl.appendChild(screen);

  const scrim = document.createElement('div');
  scrim.className = 'dx-it-scrim';
  screen.appendChild(scrim);

  const box = document.createElement('div');
  box.className = voice === 'so' ? 'dx-it-box dx-it-box--so' : 'dx-it-box';
  screen.appendChild(box);

  const icon = document.createElement('img');
  icon.className = 'dx-it-icon';
  icon.src = '/assets/shared/sprites/spr_it_icon.webp';
  icon.alt = '';
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

  typewriter = createTypewriter(textEl, resolveItText(text, loadout), {
    onChar: playTypewriterTick,
    onDone: () => { if (flashClose) closeBtn.classList.add('is-flashing'); },
  });

  // Same tap-anywhere gesture as every other beat: the first tap finishes
  // the draw, the next one dismisses. It used to be X-only (IT had to be
  // *noticed and dismissed*, like an intrusive ad), but playtesters read
  // the one screen that ignored taps as clunky rather than intrusive — the
  // X stays as the visible "close this" signal, it just isn't the only way.
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    onClose?.();
  }
  screen.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typewriter && !typewriter.isDone()) typewriter.finish();
    else close();
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  return {
    destroy() {
      typewriter?.destroy();
      screen.remove();
    },
  };
}
