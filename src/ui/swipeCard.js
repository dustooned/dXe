import { attachSwipe } from '../shell/input.js';

// Hints live in their own row above the card, not overlaid inside it.
// They used to sit in the card's corners, but the questionnaire's bigger
// question pool (scenes/questionnaireScene.js's QUESTION_SLOTS) means hint
// labels run longer than the original fixed 3 — cramming them into corners
// crowded the centered prompt text and orphaned arrow glyphs onto their own
// wrapped line. A dedicated full-width row gives either side real space to
// wrap into, and — since it's outside the card — doesn't move or rotate
// with it during a drag, reading as a static direction legend rather than
// part of the thing being dragged.
export function createSwipeCard({ promptText, onSwipe, hints }) {
  const leftLabel  = hints?.left  ?? '← TRUTH';
  const rightLabel = hints?.right ?? 'LIE →';

  const el = document.createElement('div');
  el.className = 'dx-swipe-card-wrap';
  el.innerHTML = `
    <div class="dx-swipe-card__hints">
      <span class="dx-swipe-card__hint dx-swipe-card__hint--truth"></span>
      <span class="dx-swipe-card__hint dx-swipe-card__hint--lie"></span>
    </div>
    <div class="dx-swipe-card">
      <p class="dx-swipe-card__text"></p>
    </div>
  `;
  el.querySelector('.dx-swipe-card__hint--truth').textContent = leftLabel;
  el.querySelector('.dx-swipe-card__hint--lie').textContent   = rightLabel;
  el.querySelector('.dx-swipe-card__text').textContent = promptText;

  // The card itself — what actually drags/rotates and carries the border.
  // `el` (the wrap) is what callers insert into the DOM and read state off.
  const card = el.querySelector('.dx-swipe-card');

  const detach = attachSwipe(card, {
    onDrag(dx) {
      card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      el.classList.toggle('is-truth', dx <= -40);
      el.classList.toggle('is-lie', dx >= 40);
    },
    onEnd(direction) {
      if (direction === 'left') onSwipe?.('truth');
      else if (direction === 'right') onSwipe?.('lie');
      else {
        card.style.transform = '';
        el.classList.remove('is-truth', 'is-lie');
      }
    },
  });

  // Live drag-hover tint — shows while a FEELZ bubble is hovering over
  // this card. Cleared on drag end regardless of outcome.
  function setPreviewColor(color) {
    if (color) {
      card.style.setProperty('--preview-color', color);
      card.classList.add('has-preview');
    } else {
      card.classList.remove('has-preview');
      card.style.removeProperty('--preview-color');
    }
  }

  // Persistent tint for the currently selected emotion. Independent of
  // the preview — clearing the preview doesn't clear this.
  function setSelectedColor(color) {
    if (color) {
      card.style.setProperty('--selected-color', color);
      card.classList.add('has-selected');
    } else {
      card.classList.remove('has-selected');
      card.style.removeProperty('--selected-color');
    }
  }

  // Snaps the card back to center — the same recovery the "let go without
  // committing to a direction" case already does internally, exposed so a
  // caller can trigger it too (dialogScene.js: rejecting a completed swipe
  // because no FEELZ emotion is picked yet; onSwipe still fires in that
  // case, so without this the card would stay flung to whichever side the
  // player dragged, per the truth/lie branches above never resetting it).
  function reset() {
    card.style.transform = '';
    el.classList.remove('is-truth', 'is-lie');
  }

  // One short side-to-side wiggle — "this is the next thing to touch."
  // dialogScene.js fires it the moment a FEELZ wedge is picked, so the pick
  // itself points the player at the card without any text saying so.
  function nudge() {
    card.classList.remove('is-nudging');
    // Force a reflow so re-adding the class restarts the animation.
    void card.offsetWidth;
    card.classList.add('is-nudging');
    card.addEventListener('animationend', () => card.classList.remove('is-nudging'), { once: true });
  }

  return { el, destroy: detach, setPreviewColor, setSelectedColor, reset, nudge };
}
