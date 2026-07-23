// Global screen feedback (flash/shake), usable from any scene in any
// chapter. Intensity-only — no truth/lie color-coding here on purpose:
// this should read as "here's the weight of that," never "right/wrong."
let canvasEl = null;

export function initFx(el) {
  canvasEl = el;
}

const FLASH_OPACITY = { weak: 0.15, strong: 0.4 };
const FLASH_DURATION_MS = { weak: 160, strong: 260 };
const SHAKE_DISTANCE_PX = { weak: 4, strong: 10 };

export function flash(intensity = 'weak') {
  if (!canvasEl) return;
  const overlay = document.createElement('div');
  overlay.className = 'dx-fx-flash';
  canvasEl.appendChild(overlay);

  const anim = overlay.animate(
    [{ opacity: FLASH_OPACITY[intensity] ?? FLASH_OPACITY.weak }, { opacity: 0 }],
    { duration: FLASH_DURATION_MS[intensity] ?? FLASH_DURATION_MS.weak, easing: 'ease-out' }
  );
  anim.onfinish = () => overlay.remove();
}

// Fades the canvas to solid black over durationMs, then calls onComplete.
// Returns { skip } — call it to snap to black and complete immediately.
export function fadeToBlack(durationMs, onComplete) {
  if (!canvasEl) { onComplete?.(); return { skip() {} }; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:998';
  canvasEl.appendChild(overlay);

  let done = false;
  const complete = () => {
    if (done) return;
    done = true;
    onComplete?.();
  };

  const anim = overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: durationMs,
    fill: 'forwards',
    easing: 'linear',
  });
  const timer = setTimeout(complete, durationMs);

  return {
    skip() {
      if (done) return;
      anim.cancel();
      overlay.style.opacity = '1';
      clearTimeout(timer);
      requestAnimationFrame(complete);
    },
  };
}

export function shake(intensity = 'weak') {
  if (!canvasEl) return;
  const d = SHAKE_DISTANCE_PX[intensity] ?? SHAKE_DISTANCE_PX.weak;
  canvasEl.animate(
    [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${d}px)` },
      { transform: `translateX(${d}px)` },
      { transform: 'translateX(0)' },
    ],
    { duration: 220, easing: 'ease-in-out' }
  );
}
