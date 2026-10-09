// Lite mode: phones and low-end devices draw the live visuals (the scope,
// the opponent's weather) at 30 fps with fewer points, no canvas blur or
// glow, and skip the costliest CSS filters. Decided once at load: a touch
// screen, or 4 or fewer CPU cores, or 4 GB or less of memory. Force it either
// way for testing with localStorage 'dreamxtreme:lite' = '1' / '0'.
function detect() {
  try {
    const forced = localStorage.getItem('dreamxtreme:lite');
    if (forced === '1') return true;
    if (forced === '0') return false;
  } catch { /* storage off: detect */ }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  return !!coarse || cores <= 4 || memory <= 4;
}

export const LITE = detect();
// The frame budget for live canvases in lite mode (30 fps).
export const LITE_FRAME_MS = 33;

export function applyPerfClass() {
  document.documentElement.classList.toggle('is-lite', LITE);
}
