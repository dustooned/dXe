// Scene type: 'loadout'. Shows the three character classes (Guns / Bible /
// Crystals) and lets the player pick one before the chapter starts. The
// choice is written to run state as `loadout` and drives which emotions the
// dartboard makes available throughout the run. No engine logic runs here —
// this scene is purely a selection UI.
//
// scene shape: { type: 'loadout', id: 'loadout' }
import { CLASSES, EMOTION_ORDER, emotionColor } from '../engine/loadout.js';

export function mount(stageEl, _scene, { run, onComplete }) {
  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-loadout-screen';

  const heading = document.createElement('p');
  heading.className = 'dx-title dx-loadout-heading';
  heading.textContent = 'CHOOSE YOUR LOADOUT';
  screen.appendChild(heading);

  const sub = document.createElement('p');
  sub.className = 'dx-text dx-loadout-sub';
  sub.textContent = 'Your class sets which emotions you carry into the dream.';
  screen.appendChild(sub);

  const list = document.createElement('div');
  list.className = 'dx-loadout-list';

  Object.entries(CLASSES).forEach(([key, cls]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'dx-loadout-card';

    const label = document.createElement('p');
    label.className = 'dx-loadout-card__label';
    label.textContent = cls.label;
    card.appendChild(label);

    const desc = document.createElement('p');
    desc.className = 'dx-loadout-card__desc';
    desc.textContent = cls.description;
    card.appendChild(desc);

    const pills = document.createElement('div');
    pills.className = 'dx-loadout-card__pills';
    // Render the 3 emotions in dartboard order (consistent ordering across cards)
    const ordered = EMOTION_ORDER.filter((e) => cls.emotions.includes(e));
    ordered.forEach((emotion) => {
      const pill = document.createElement('span');
      pill.className = 'dx-loadout-pill';
      pill.textContent = emotion;
      pill.style.setProperty('--pill-color', emotionColor(emotion));
      pills.appendChild(pill);
    });
    card.appendChild(pills);

    card.addEventListener('click', () => {
      run.set({ loadout: key });
      onComplete();
    });

    list.appendChild(card);
  });

  screen.appendChild(list);
  stageEl.innerHTML = '';
  stageEl.appendChild(screen);

  return function unmount() {
    stageEl.innerHTML = '';
  };
}
