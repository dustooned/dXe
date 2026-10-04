// A FEELZ tip: the app's own little banner, sliding up above the lake gauge
// the first time a piece of the oscilloscope does something in a real
// encounter (dialogScene.js showTip). It never blocks: the game keeps going
// underneath, and it stays up until the player taps it closed. A tiny
// picture of the thing it's about sits beside the words, and the scope
// frames that piece in gold while the tip is up, so it reads at a glance.
//
// Tips describe, they never judge (docs: non-judgmental feedback).
import { playFeelzPing } from '../shell/audio.js';

// 24×16 pictures, drawn in the tip's accent and white.
function lissajous(a, b, phase = Math.PI / 4) {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    pts.push(`${(12 + Math.sin(a * t + phase) * 9).toFixed(1)},${(8 - Math.sin(b * t) * 6).toFixed(1)}`);
  }
  return `<polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1"/>`;
}

const ICONS = {
  circle: lissajous(1, 1, Math.PI / 2),
  shape: lissajous(4, 5),
  needle: `<path d="M3 13 H21 M3 13 V10 M12 13 V10 M21 13 V10" stroke="#fff" stroke-opacity="0.5" fill="none"/>
           <path d="M12 13 L5 4" stroke="currentColor" stroke-width="1.6"/>`,
  mask: `<path d="M1 6 Q5 2 9 6 T17 6 T23 6" stroke="currentColor" fill="none" stroke-width="1.4"/>
         <path d="M1 11 Q5 7 9 11 T17 11 T23 11" stroke="#7fb2ff" fill="none" stroke-width="1.4" stroke-dasharray="2 2"/>`,
  dots: `<rect x="1" y="6" width="4" height="5" fill="#ff5a4d"/><rect x="7" y="6" width="4" height="5" fill="#4d8bff"/>
         <rect x="13" y="6" width="4" height="5" fill="#ffd34d"/><rect x="19" y="5" width="4" height="7" fill="#9b6bff" stroke="#fff" stroke-width="0.8"/>`,
};

// { icon, text, onGone } -> { el, attach(stageEl, floorEl?), destroy() }
// floorEl: what the tip sits just above (the contacts row, else the lake),
// so it never covers them.
// The dialog scene clears its stage on every render, so the tip is a node it
// re-attaches after each one (attach); the slide-in only plays the first time.
export function createFeelzTip({ icon = 'shape', text = '', onGone } = {}) {
  const el = document.createElement('div');
  el.className = 'dx-tip is-entering';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <svg class="dx-tip__icon" viewBox="0 0 24 16" aria-hidden="true">${ICONS[icon] ?? ''}</svg>
    <div class="dx-tip__body">
      <p class="dx-tip__app">FEELZ · TIP</p>
      <p class="dx-tip__text"></p>
    </div>
    <span class="dx-tip__close" aria-hidden="true">✕</span>
  `;
  el.setAttribute('aria-label', 'FEELZ tip. Tap to close.');
  el.querySelector('.dx-tip__text').textContent = text;
  playFeelzPing();
  setTimeout(() => el.classList.remove('is-entering'), 450);

  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    el.classList.add('is-leaving');
    setTimeout(() => { el.remove(); onGone?.(); }, 260);
  };
  el.addEventListener('click', (e) => {
    e.stopPropagation(); // a tap on the tip isn't a tap on the dialog
    close();
  });

  return {
    el,
    attach(stageEl, floorEl) {
      if (gone) return;
      stageEl.appendChild(el);
      const host = el.offsetParent;
      if (floorEl && host) {
        const gap = host.getBoundingClientRect().bottom - floorEl.getBoundingClientRect().top;
        el.style.bottom = `${Math.max(0, gap) + 3}px`;
      }
    },
    destroy() { gone = true; el.remove(); },
  };
}
