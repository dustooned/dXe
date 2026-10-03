// Held sideways, a touch phone would get a canvas a few dozen pixels wide.
// Instead the game pauses into silence and IT asks for the phone back. Turn
// it upright and everything carries on where it was.
//
// "Paused" means: audio faded out and frozen (shell/audio.js pauseAudio),
// animations stopped, the canvas inert, and every timer that moves the story
// or paces the player held (shell/pauseBus.js). IT's screen sits outside the
// canvas, at a size set for the sideways viewport rather than the canvas.
import { createItPopup } from '../ui/itPopup.js';
import { pauseAudio, resumeAudio } from './audio.js';
import { setPaused } from './pauseBus.js';

const QUERY = '(orientation: landscape) and (max-height: 520px) and (pointer: coarse)';
const LINE = "Sideways. You can't see it like that. Turn it back.";

// host: the element the canvas lives in (#app). Returns apply(on) so a
// debug session can force the pause without a phone.
export function initOrientationPause(host, canvas) {
  const mq = window.matchMedia?.(QUERY);
  let overlay = null;
  let popup = null;

  function apply(on) {
    if (on === !!overlay) return;
    if (on) {
      setPaused(true);
      pauseAudio();
      canvas.classList.add('is-turn-paused');
      canvas.inert = true;
      overlay = document.createElement('div');
      overlay.className = 'dx-turn';
      host.appendChild(overlay);
      popup = createItPopup(overlay, { text: LINE, silent: true, onClose() {} });
    } else {
      popup?.destroy();
      overlay.remove();
      popup = null;
      overlay = null;
      canvas.inert = false;
      canvas.classList.remove('is-turn-paused');
      resumeAudio();
      setPaused(false);
    }
  }

  if (mq) {
    apply(mq.matches);
    const onChange = (e) => apply(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener?.(onChange); // Safari before 14
  }
  return apply;
}
