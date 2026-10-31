// Scene type: 'notice'. The two cards before the chapter starts, in the
// spirit of the Wii's HEALTH AND SAFETY screen: a photosensitivity warning
// with the Reduce effects switch right there (the same setting as Settings >
// Reduce effects), then a short fiction disclaimer. Each page locks for a
// moment so a reflex tap can't skip it unread, then any tap moves on.
// Shown once ever: finishing it sets `seenNotice` (settings, so a NEW GAME
// doesn't bring it back) and the chapter leaves it out after that.
//
// scene shape: { type: 'notice', id }
import { later, cancelLater } from '../shell/pauseBus.js';
import { loadSettings, updateSettings, applyEffectsSetting } from '../shell/settings.js';

const LOCK_MS = 1200;

const PAGES = [
  {
    title: '⚠ WARNING: HEALTH AND SAFETY',
    body: [
      'This game has flashing lights, flickering images and screen shake. A small number of people may have seizures or other reactions to them.',
      'If you feel dizzy or sick, or notice anything odd, stop playing and rest.',
    ],
    toggle: true,
    foot: 'You can change this any time in Settings.',
  },
  {
    title: 'A WORK OF FICTION',
    body: [
      'Any resemblance to real people or events is pure coincidence.',
      'FEELZ is made up. This game does not scan your face or open your camera.',
    ],
  },
];

export function mount(stageEl, scene, { onComplete }) {
  let page = 0;
  let unlockTimer = null;

  function render() {
    cancelLater(unlockTimer);
    const p = PAGES[page];
    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-notice';
    const title = document.createElement('p');
    title.className = 'dx-notice__title';
    title.textContent = p.title;
    screen.appendChild(title);
    for (const line of p.body) {
      const el = document.createElement('p');
      el.className = 'dx-text dx-notice__body';
      el.textContent = line;
      screen.appendChild(el);
    }
    if (p.toggle) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dx-btn dx-notice__toggle';
      const label = () => { btn.textContent = `REDUCE EFFECTS: ${loadSettings().reduceEffects ? 'ON' : 'OFF'}`; };
      label();
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyEffectsSetting(updateSettings({ reduceEffects: !loadSettings().reduceEffects }));
        label();
      });
      screen.appendChild(btn);
    }
    if (p.foot) {
      const foot = document.createElement('p');
      foot.className = 'dx-notice__foot';
      foot.textContent = p.foot;
      screen.appendChild(foot);
    }
    const hint = document.createElement('p');
    hint.className = 'dx-text dx-tap-hint dx-notice__hint';
    hint.textContent = '(tap to continue)';
    screen.appendChild(hint);

    let open = false;
    unlockTimer = later(() => { open = true; hint.classList.add('is-ready'); }, LOCK_MS);
    screen.addEventListener('click', () => {
      if (!open) return;
      page += 1;
      if (page >= PAGES.length) {
        updateSettings({ seenNotice: true });
        onComplete();
      }
      else render();
    });
    stageEl.innerHTML = '';
    stageEl.appendChild(screen);
  }

  render();

  return function unmount() {
    cancelLater(unlockTimer);
    stageEl.innerHTML = '';
  };
}
