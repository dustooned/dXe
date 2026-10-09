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
// While dragging, the card leans into the side it's heading for: that
// side's label grows and takes its color, the card's border and wash blend
// toward it, and a stamp of the choice (TRUTH / LIE, or the hint's own
// words) fades in over the card. `--lean` (0..1) drives all of it in CSS.
// The two colors are a pair, not a verdict: cool for truth, warm for lie,
// neither green nor red (feedback stays atmospheric, never right/wrong).
const SIDE_COLORS = { left: '#8fe3ff', right: '#ff8fc8' };
const LEAN_PX = 90; // same as attachSwipe's commit threshold

// `stamps` overrides the word stamped on the card per side; `colors`
// overrides the pair (the intake uses one neutral color for both, so the
// lean never hints at a class). `tapHints` makes the labels tappable as a
// second way to answer.
// The pixel font has no arrow glyphs (they fell back to another font, small
// and low), so a label's leading "← " / trailing " →" becomes a pixel arrow
// drawn at the text's own size and centered on it.
const ARROW_ROWS = ['..X....', '.XX....', 'XXXXXXX', '.XX....', '..X....'];
function pixelArrow(dir) {
  const cells = ARROW_ROWS.flatMap((row, y) => [...row].map((c, x) => (c === 'X'
    ? `<rect x="${dir === 'right' ? 6 - x : x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return `<svg class="dx-swipe-card__arrow" viewBox="0 0 7 5" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}
function escapeHtml(t) {
  return t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function hintHtml(label) {
  const m = label.match(/^\s*(←)?\s*(.*?)\s*(→)?\s*$/);
  return `${m[1] ? pixelArrow('left') : ''}<span>${escapeHtml(m[2])}</span>${m[3] ? pixelArrow('right') : ''}`;
}

export function createSwipeCard({ promptText, onSwipe, hints, stamps, colors, tapHints = false }) {
  const leftLabel  = hints?.left  ?? '← TRUTH';
  const rightLabel = hints?.right ?? 'LIE →';
  const leftStamp  = stamps?.left  ?? 'TRUTH';
  const rightStamp = stamps?.right ?? 'LIE';
  const sideColors = { ...SIDE_COLORS, ...colors };

  const el = document.createElement('div');
  el.className = 'dx-swipe-card-wrap';
  el.innerHTML = `
    <div class="dx-swipe-card__hints">
      <span class="dx-swipe-card__hint dx-swipe-card__hint--truth"></span>
      <span class="dx-swipe-card__hint dx-swipe-card__hint--lie"></span>
    </div>
    <div class="dx-swipe-card">
      <p class="dx-swipe-card__text"></p>
      <span class="dx-swipe-card__stamp" aria-hidden="true"></span>
    </div>
  `;
  el.style.setProperty('--side-left', sideColors.left);
  el.style.setProperty('--side-right', sideColors.right);
  el.querySelector('.dx-swipe-card__hint--truth').innerHTML = hintHtml(leftLabel);
  el.querySelector('.dx-swipe-card__hint--lie').innerHTML   = hintHtml(rightLabel);
  el.querySelector('.dx-swipe-card__text').textContent = promptText;

  // The card itself — what actually drags/rotates and carries the border.
  // `el` (the wrap) is what callers insert into the DOM and read state off.
  const card = el.querySelector('.dx-swipe-card');
  const stamp = el.querySelector('.dx-swipe-card__stamp');

  function lean(dx) {
    const side = dx < 0 ? 'left' : 'right';
    const t = Math.min(1, Math.abs(dx) / LEAN_PX);
    el.style.setProperty('--lean', t.toFixed(3));
    el.style.setProperty('--lean-color', sideColors[side]);
    el.dataset.side = dx === 0 ? '' : side;
    stamp.textContent = side === 'left' ? leftStamp : rightStamp;
    el.classList.toggle('is-truth', dx <= -40);
    el.classList.toggle('is-lie', dx >= 40);
  }

  function clearLean() {
    el.style.setProperty('--lean', '0');
    el.dataset.side = '';
  }

  const detach = attachSwipe(card, {
    onDrag(dx) {
      card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      lean(dx);
    },
    onEnd(direction) {
      if (direction === 'left') onSwipe?.('truth');
      else if (direction === 'right') onSwipe?.('lie');
      else {
        card.style.transform = '';
        el.classList.remove('is-truth', 'is-lie');
        clearLean();
      }
    },
  });

  if (tapHints) {
    el.classList.add('has-tap-hints');
    const pick = (side) => (e) => {
      e.stopPropagation();
      lean(side === 'left' ? -LEAN_PX : LEAN_PX);
      card.style.transform = `translateX(${side === 'left' ? -40 : 40}px) rotate(${side === 'left' ? -2 : 2}deg)`;
      setTimeout(() => onSwipe?.(side === 'left' ? 'truth' : 'lie'), 180);
    };
    el.querySelector('.dx-swipe-card__hint--truth').addEventListener('click', pick('left'));
    el.querySelector('.dx-swipe-card__hint--lie').addEventListener('click', pick('right'));
  }

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
    clearLean();
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
