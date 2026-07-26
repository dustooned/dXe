# Attic

Code that was removed from the build but kept for reference. Nothing here
is imported or executed — it exists so a decision can be reversed without
digging through git history.

If you restore something from here, delete it from this file. An attic
that also pretends to be live code is worse than no attic.

The `.css` for these is generally still in the live stylesheets (it's
cheap and harmless), so restoring usually only means putting the JS back.

---

## `loadout` scene — explicit class picker

**Removed:** 2026-07-25. **Was:** `src/scenes/loadoutScene.js`.

The original way a player got their class: a menu of three cards (Guns /
Bible / Crystals) listing each class's three emotions as colored pills,
shown before the Prologue. Replaced by `scenes/questionnaireScene.js`,
which infers the same `run.loadout` value from three swipe answers and
never names the class.

**Why it went:** naming the class turns an atmospheric beat into a stat
screen. The questionnaire gets the same mechanical outcome while staying
in the fiction — the player just notices different emotions on the
dartboard later.

**To restore:** write the file back to `src/scenes/loadoutScene.js`,
import it in `chapters/lake-ulysses/index.js`, add
`loadout: loadoutScene` to `HANDLERS`, and put
`{ type: 'loadout', id: 'loadout' }` in `SCENES` ahead of the prologue.
Its CSS (`.dx-loadout-*`) is still in `src/scenes/scenes.css`.

```js
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
```

---

## `firstPlayScene` — unread chapter-registry field

**Removed:** 2026-07-25. **Was:** `src/main.js`, in the `CHAPTERS` registry.

```js
const CHAPTERS = {
  'lake-ulysses': {
    title: 'Truth Debt: Lake Ulysses',
    load: () => import('./chapters/lake-ulysses/index.js'),
    firstPlayScene: 'questionnaire',   // ← this line
  },
};
```

Declared but never read by anything. The behaviour it looks like it should
control — where a returning player lands when they skip the story — is
actually implemented in `showSkipDialog()`, which hardcodes the same scene
id in its navigation target.

**If you want it back,** don't just re-add the field: make
`showSkipDialog()` read it, otherwise the same trap reopens (a config
value that looks authoritative but changes nothing when edited). That's
the reason it was removed rather than wired up — wiring it up is a real
change to shell/chapter responsibilities and deserves its own decision.
