// Unified drag/swipe input. Pointer Events cover mouse, touch, and pen
// with one code path — no separate mouse/touch handling needed.
export function attachSwipe(el, { threshold = 90, onDrag, onEnd } = {}) {
  let startX = 0;
  let dragging = false;

  function onPointerDown(e) {
    dragging = true;
    startX = e.clientX;
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    onDrag?.(dx);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (dx <= -threshold) onEnd?.('left', dx);
    else if (dx >= threshold) onEnd?.('right', dx);
    else onEnd?.(null, dx);
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return function detach() {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
  };
}
