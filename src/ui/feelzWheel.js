// 3-segment picker for the demo (DX_DEMO_BUILD_SPEC.md: "3 segments for demo").
// Swap for a real SVG dartboard wheel post-demo — onSelect contract stays the same.
//
// Selecting an emotion works two ways, unified into one gesture: a plain
// tap (pointerdown+pointerup with barely any movement) selects it
// immediately, same as before. Dragging a bubble onto `dropTarget` (the
// swipe card) also selects it, and while the drag is hovering over the
// card, the card's frame previews that emotion's color live
// (`dropTarget.setPreviewColor`) so the player sees what they're about
// to apply before they let go.
const EMOTION_VAR = {
  Anger: '--color-feelz-anger',
  Fear: '--color-feelz-fear',
  Anticipation: '--color-feelz-anticipation',
};

const DRAG_THRESHOLD_PX = 4;

function isOverElement(el, x, y) {
  const rect = el.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function createFeelzWheel({ options, dropTarget, onSelect }) {
  const el = document.createElement('div');
  el.className = 'dx-feelz';

  function selectBubble(btn, emotion) {
    el.querySelectorAll('.dx-feelz__bubble').forEach((b) => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    onSelect?.(emotion);
  }

  options.forEach((emotion) => {
    const btn = document.createElement('button');
    btn.className = 'dx-feelz__bubble';
    btn.type = 'button';
    const colorVar = `var(${EMOTION_VAR[emotion] || '--color-white'})`;
    btn.style.setProperty('--bubble-color', colorVar);
    btn.textContent = emotion;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let ghost = null;

    btn.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      btn.setPointerCapture(e.pointerId);
    });

    btn.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!ghost && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        ghost = document.createElement('div');
        ghost.className = 'dx-feelz__ghost';
        ghost.style.setProperty('--bubble-color', colorVar);
        ghost.textContent = emotion;
        document.body.appendChild(ghost);
      }
      if (ghost) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
      if (dropTarget) {
        const hovering = isOverElement(dropTarget.el, e.clientX, e.clientY);
        dropTarget.setPreviewColor(hovering ? colorVar : null);
      }
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;

      const droppedOnTarget = dropTarget && isOverElement(dropTarget.el, e.clientX, e.clientY);
      const releasedOnBubble = isOverElement(btn, e.clientX, e.clientY);

      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      dropTarget?.setPreviewColor(null);

      if (droppedOnTarget || releasedOnBubble) {
        selectBubble(btn, emotion);
      }
    }

    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', endDrag);

    el.appendChild(btn);
  });

  function reset() {
    el.querySelectorAll('.dx-feelz__bubble').forEach((b) => b.classList.remove('is-selected'));
  }

  return { el, reset };
}
