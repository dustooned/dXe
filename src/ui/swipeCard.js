import { attachSwipe } from '../shell/input.js';

export function createSwipeCard({ promptText, onSwipe, hints }) {
  const leftLabel  = hints?.left  ?? '← TRUTH';
  const rightLabel = hints?.right ?? 'LIE →';

  const el = document.createElement('div');
  el.className = 'dx-swipe-card';
  el.innerHTML = `
    <span class="dx-swipe-card__hint dx-swipe-card__hint--truth"></span>
    <p class="dx-swipe-card__text"></p>
    <span class="dx-swipe-card__hint dx-swipe-card__hint--lie"></span>
  `;
  el.querySelector('.dx-swipe-card__hint--truth').textContent = leftLabel;
  el.querySelector('.dx-swipe-card__hint--lie').textContent   = rightLabel;
  el.querySelector('.dx-swipe-card__text').textContent = promptText;

  const detach = attachSwipe(el, {
    onDrag(dx) {
      el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      el.classList.toggle('is-truth', dx <= -40);
      el.classList.toggle('is-lie', dx >= 40);
    },
    onEnd(direction) {
      if (direction === 'left') onSwipe?.('truth');
      else if (direction === 'right') onSwipe?.('lie');
      else {
        el.style.transform = '';
        el.classList.remove('is-truth', 'is-lie');
      }
    },
  });

  // Live drag-hover tint — shows while a FEELZ bubble is hovering over
  // this card. Cleared on drag end regardless of outcome.
  function setPreviewColor(color) {
    if (color) {
      el.style.setProperty('--preview-color', color);
      el.classList.add('has-preview');
    } else {
      el.classList.remove('has-preview');
      el.style.removeProperty('--preview-color');
    }
  }

  // Persistent tint for the currently selected emotion. Independent of
  // the preview — clearing the preview doesn't clear this.
  function setSelectedColor(color) {
    if (color) {
      el.style.setProperty('--selected-color', color);
      el.classList.add('has-selected');
    } else {
      el.classList.remove('has-selected');
      el.style.removeProperty('--selected-color');
    }
  }

  return { el, destroy: detach, setPreviewColor, setSelectedColor };
}
