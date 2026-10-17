// A first choice lands like a stone in the lake (engine/firstMarks.js): a
// ring of pixel dots spreads from where you tapped and fades in hard steps.
// 1-bit, no glow. Nothing with Reduced Effects. It lives on the game canvas,
// not the scene, so a scene that rebuilds right after the tap (the intake's
// next question) doesn't cut it short.
export function ripple(x, y) {
  const host = document.querySelector('.dx-canvas');
  if (!host || document.documentElement.classList.contains('is-reduced-effects')) return;
  const box = host.getBoundingClientRect();
  for (const delay of [0, 140]) {
    const ring = document.createElement('span');
    ring.className = 'dx-ripple';
    ring.style.left = `${x - box.left}px`;
    ring.style.top = `${y - box.top}px`;
    ring.style.animationDelay = `${delay}ms`;
    host.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
  }
}

// The middle of an element, for a ripple from a button or a card.
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}
