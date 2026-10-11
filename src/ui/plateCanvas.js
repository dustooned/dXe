// A chapter plate on a canvas, the way an 80s home computer showed a picture.
//
//   - The animation plays at the artist's own timing, from the first moment,
//     frame delays untouched (frameAt in characterAnimator.js, a clock that
//     stops while the game is paused). Nothing here changes its speed.
//   - It's drawn 1:1 at the art's true size (240x150) and scaled up by CSS
//     with hard pixels, so every art pixel is a clean block and the scanlines
//     (scenes.css .dx-marker__crt) can line up with the art's own pixel rows.
//   - It loads interlaced, like a ZX Spectrum screen: rows 0, 4, 2, 6, 1, 5, 3, 7
//     (mod 8) one pass at a time, the picture coming into focus rather than
//     wiping down. reveal(n) shows the first n passes.
import { frameAt } from './characterAnimator.js';
import { isPaused } from '../shell/pauseBus.js';

const ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
export const PASSES = ORDER.length;

export function createPlateCanvas({ base, frames, delays, size = [240, 150] }) {
  const [w, h] = size;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.className = 'dx-marker__plate-canvas';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const images = Array.from({ length: frames }, (_, i) => {
    const im = new Image();
    im.src = `${base}${String(i).padStart(4, '0')}.png`;
    return im;
  });
  const art = { frames, delays };
  let passes = 0;
  let elapsed = 0;
  let last = performance.now();
  let raf = null;
  let drawnFrame = -1;
  let drawnPasses = -1;

  function draw(frame) {
    const im = images[frame];
    if (!im.complete || !im.naturalWidth) return false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const shown = new Set(ORDER.slice(0, passes));
    for (let y = 0; y < h; y++) if (shown.has(y % 8)) ctx.drawImage(im, 0, y, w, 1, 0, y, w, 1);
    return true;
  }

  function tick(now) {
    if (!canvas.isConnected) { raf = null; return; } // its page left: stop for good
    raf = requestAnimationFrame(tick);
    const dt = now - last;
    last = now;
    if (!isPaused()) elapsed += Math.min(dt, 250);
    const { frame } = frameAt(art, elapsed, true);
    if (frame !== drawnFrame || passes !== drawnPasses) {
      if (draw(frame)) { drawnFrame = frame; drawnPasses = passes; }
    }
  }
  raf = requestAnimationFrame(tick);

  return {
    el: canvas,
    reveal(n) { passes = Math.max(0, Math.min(PASSES, n)); },
    destroy() { if (raf) cancelAnimationFrame(raf); raf = null; },
  };
}
