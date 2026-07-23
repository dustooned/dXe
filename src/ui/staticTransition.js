// TV static "channel-switch" transition. Overlays a pixelated noise canvas
// on containerEl for DURATION_MS, then calls onComplete. Audio noise is
// played via the audio module (requires an unlocked AudioContext — safe
// after any user gesture has already occurred in the session).
import { playStaticNoise } from '../shell/audio.js';

const DURATION_MS = 480;
const SCALE = 5; // canvas is 1/5 of display size → chunky CRT pixels

export function playStaticTransition(containerEl, onComplete) {
  const w = Math.ceil((containerEl.offsetWidth  || 390) / SCALE);
  const h = Math.ceil((containerEl.offsetHeight || 844) / SCALE);

  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'width:100%',
    'height:100%',
    'z-index:999',
    'image-rendering:pixelated',
    'pointer-events:none',
  ].join(';');
  containerEl.appendChild(canvas);

  const ctx2d = canvas.getContext('2d');
  const imageData = ctx2d.createImageData(w, h);
  const pixels = imageData.data;
  let rafId;

  function drawFrame() {
    for (let i = 0; i < pixels.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
    ctx2d.putImageData(imageData, 0, 0);
    rafId = requestAnimationFrame(drawFrame);
  }
  rafId = requestAnimationFrame(drawFrame);

  playStaticNoise(DURATION_MS);

  setTimeout(() => {
    cancelAnimationFrame(rafId);
    canvas.remove();
    onComplete?.();
  }, DURATION_MS);
}
