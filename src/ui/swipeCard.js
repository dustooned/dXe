import { attachSwipe } from '../shell/input.js';

export function createSwipeCard({ promptText, onSwipe }) {
  const el = document.createElement('div');
  el.className = 'dx-swipe-card';
  el.innerHTML = `
    <span class="dx-swipe-card__hint dx-swipe-card__hint--truth">← TRUTH</span>
    <p class="dx-swipe-card__text"></p>
    <span class="dx-swipe-card__hint dx-swipe-card__hint--lie">LIE →</span>
  `;
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

  return { el, destroy: detach };
}
