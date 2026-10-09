// Persistent chrome that sits above every scene: a settings gear (always
// present) and a fast-forward icon (present only while the current scene is
// skippable — see sceneSequencer.js's isSkippable()). Both are mounted once,
// into main.js's own dx-canvas layer rather than the dx-stage a scene wipes
// wholesale on every one of its own re-renders, so neither has to be
// rebuilt — or even known about — by any scene handler.
import { navigate } from './router.js';
import { loadSettings, updateSettings } from './settings.js';
import { loadCheckpoint } from './save.js';
import { setMasterVolume } from './audio.js';
import { jumpTo } from './debug.js';

let hostEl = null;
let gearBtn = null;
let ffBtn = null;
let panelEl = null;
let skipFn = null;
let restartFn = null;
let chapterActive = false;

// Retro pixel icons: hard-edged SVG cells ('#' = lit), same treatment as
// the status bar's sprites (ui/statusBar.js).
function pixelIcon(rows) {
  const w = rows[0].length;
  let cells = '';
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`hud icon row ${y}: ${row.length} != ${w}`);
    [...row].forEach((ch, x) => { if (ch === '#') cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`; });
  });
  return `<svg viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${cells}</svg>`;
}
const GEAR_SVG = pixelIcon([
  '.....###.....',
  '..#..###..#..',
  '.###.###.###.',
  '..#########..',
  '...##...##...',
  '####.....####',
  '####.....####',
  '####.....####',
  '...##...##...',
  '..#########..',
  '.###.###.###.',
  '..#..###..#..',
  '.....###.....',
]);
const SKIP_SVG = pixelIcon([
  '.............',
  '#.....#......',
  '##....##.....',
  '###...###....',
  '####..####...',
  '#####.#####..',
  '######.######',
  '#####.#####..',
  '####..####...',
  '###...###....',
  '##....##.....',
  '#.....#......',
  '.............',
]);

// The autosave indicator, top left (opposite the gear): a pixel spinner and
// SAVING while a checkpoint is written. The very first time on this device
// it says what it means, so the player knows a crash won't cost the run.
let saveEl = null;
let saveTimer = null;
const SAVE_EXPLAINED_KEY = 'dreamxtreme:saveExplained';
export function showSaving() {
  if (!saveEl) return;
  let first = false;
  try { first = !localStorage.getItem(SAVE_EXPLAINED_KEY); localStorage.setItem(SAVE_EXPLAINED_KEY, '1'); } catch { /* fine */ }
  saveEl.querySelector('.dx-hud-save__text').textContent = first
    ? 'AUTOSAVING. If the game closes, CONTINUE picks up here.'
    : 'SAVING';
  saveEl.classList.toggle('is-explaining', first);
  saveEl.hidden = false;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveEl.hidden = true; }, first ? 5200 : 1400);
}

export function initHud(el) {
  hostEl = el;

  gearBtn = document.createElement('button');
  gearBtn.type = 'button';
  gearBtn.className = 'dx-hud-btn dx-hud-gear';
  gearBtn.setAttribute('aria-label', 'Settings');
  gearBtn.innerHTML = GEAR_SVG;
  gearBtn.hidden = true;
  gearBtn.addEventListener('click', openPanel);

  ffBtn = document.createElement('button');
  ffBtn.type = 'button';
  ffBtn.className = 'dx-hud-btn dx-hud-ff';
  ffBtn.setAttribute('aria-label', 'Skip ahead');
  ffBtn.innerHTML = SKIP_SVG;
  ffBtn.hidden = true;
  ffBtn.addEventListener('click', () => skipFn?.());

  hostEl.appendChild(gearBtn);
  hostEl.appendChild(ffBtn);

  saveEl = document.createElement('div');
  saveEl.className = 'dx-hud-save';
  saveEl.setAttribute('role', 'status');
  saveEl.innerHTML = '<span class="dx-hud-save__spin" aria-hidden="true"></span><span class="dx-hud-save__text"></span>';
  saveEl.hidden = true;
  hostEl.appendChild(saveEl);

  setMasterVolume(loadSettings().muted ? 0 : loadSettings().volume);
}

// main.js calls this once the preloader (spinner + logo video) is done —
// nothing there is a "setting," and the gear sitting on top of the logo
// looked like a stray UI bug rather than chrome.
export function setVisible(visible) {
  if (gearBtn) gearBtn.hidden = !visible;
}

// Called by sceneSequencer.js's onSceneChange (via each chapter's mount) any
// time the current scene changes. Pass null to hide the icon — a scene type
// with a real choice in it (dialog, questionnaire, reckoning, ending) has
// nothing safe to fast-forward past.
export function setSkip(fn) {
  skipFn = fn;
  if (ffBtn) ffBtn.hidden = !fn;
}

// Called by a chapter's mount()/unmount() so the panel knows whether
// "Restart Chapter" applies right now, and what it should do.
export function setChapterActive(active) {
  chapterActive = !!active;
  restartFn = active?.onRestart ?? null;
}

function openPanel() {
  if (panelEl) return;
  renderSettingsPanel();
}

function closePanel() {
  panelEl?.remove();
  panelEl = null;
}

// Playtest feedback: the player writes a note, and COPY REPORT puts it on the
// clipboard together with where they are (the autosave checkpoint: chapter,
// scene, class, readings), their screen and browser, so a report like "it
// crashed in the hallway" arrives with everything needed to chase it.
function feedbackReport(note) {
  const cp = loadCheckpoint();
  const s = cp?.state ?? {};
  const lines = [
    'DREAM XTREME FEEDBACK',
    `When: ${new Date().toLocaleString()}`,
    `Note: ${note.trim() || '(none)'}`,
    `Where: ${cp ? `${cp.chapterId} / ${cp.sceneId}` : location.hash || 'title'}`,
    cp ? `Class: ${s.loadout}  Battery ${s.stability}  Bars ${s.trust}  Wi-Fi ${s.lucidity}  Clock ${s.integrity}  Lake ${s.truthDebt}` : null,
    `Screen: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    `Browser: ${navigator.userAgent}`,
    `Text speed: ${loadSettings().textSpeed}`,
  ];
  return lines.filter(Boolean).join('\n');
}

function renderFeedbackPage() {
  const box = panelEl.querySelector('.dx-hud-panel__box');
  box.innerHTML = `
    <h3 class="dx-hud-panel__title">FEEDBACK</h3>
    <p class="dx-text dx-hud-feedback__hint">What happened? What felt off? Then copy the report and send it to the developer.</p>
    <textarea class="dx-hud-feedback__note" rows="5" maxlength="1200" placeholder="It froze when..."></textarea>
    <button type="button" class="dx-btn dx-hud-feedback__copy">COPY REPORT</button>
    <p class="dx-text dx-hud-feedback__status" aria-live="polite"></p>
    <button type="button" class="dx-btn dx-hud-feedback__back">BACK</button>
  `;
  const note = box.querySelector('.dx-hud-feedback__note');
  const status = box.querySelector('.dx-hud-feedback__status');
  box.querySelector('.dx-hud-feedback__copy').addEventListener('click', async () => {
    const report = feedbackReport(note.value);
    try {
      await navigator.clipboard.writeText(report);
      status.textContent = 'Copied. Paste it in a message to the developer.';
    } catch {
      // No clipboard access: show the report selected, ready to copy by hand.
      note.value = report;
      note.select();
      status.textContent = 'Select all and copy this report by hand.';
    }
  });
  box.querySelector('.dx-hud-feedback__back').addEventListener('click', () => { closePanel(); renderSettingsPanel(); });
  note.focus();
}

function renderSettingsPanel() {
  const settings = loadSettings();

  panelEl = document.createElement('div');
  panelEl.className = 'dx-hud-panel';
  panelEl.innerHTML = `
    <div class="dx-hud-panel__scrim"></div>
    <div class="dx-hud-panel__box">
      <h3 class="dx-hud-panel__title">SETTINGS</h3>
      <label class="dx-hud-panel__row dx-hud-panel__volume-row">
        <span>VOLUME</span>
        <input type="range" min="0" max="1" step="0.05" class="dx-hud-volume">
      </label>
      <button type="button" class="dx-btn dx-hud-mute"></button>
      <button type="button" class="dx-btn dx-hud-speed"></button>
      ${chapterActive ? '<button type="button" class="dx-btn dx-hud-restart">RESTART CHAPTER</button>' : ''}
      <button type="button" class="dx-btn dx-hud-chapters">QUIT TO TITLE</button>
      <button type="button" class="dx-btn dx-hud-feedback">FEEDBACK</button>
      <button type="button" class="dx-btn dx-hud-debug">DEBUG</button>
      <button type="button" class="dx-btn dx-hud-resume">RESUME</button>
    </div>
  `;
  hostEl.appendChild(panelEl);

  const volumeSlider = panelEl.querySelector('.dx-hud-volume');
  const muteBtn = panelEl.querySelector('.dx-hud-mute');

  function syncVolumeUI(s) {
    volumeSlider.value = String(s.muted ? 0 : s.volume);
    muteBtn.textContent = s.muted ? 'UNMUTE' : 'MUTE';
    muteBtn.classList.toggle('is-active', s.muted);
  }
  syncVolumeUI(settings);

  // Text speed cycles NORMAL → FAST → INSTANT (ui/typewriterText.js).
  const speedBtn = panelEl.querySelector('.dx-hud-speed');
  const SPEEDS = ['normal', 'fast', 'instant'];
  const syncSpeed = (s) => { speedBtn.textContent = `TEXT: ${s.textSpeed.toUpperCase()}`; };
  syncSpeed(settings);
  speedBtn.addEventListener('click', () => {
    const cur = loadSettings().textSpeed;
    syncSpeed(updateSettings({ textSpeed: SPEEDS[(SPEEDS.indexOf(cur) + 1) % SPEEDS.length] }));
  });

  panelEl.querySelector('.dx-hud-feedback').addEventListener('click', renderFeedbackPage);

  volumeSlider.addEventListener('input', () => {
    const next = updateSettings({ volume: Number(volumeSlider.value), muted: false });
    setMasterVolume(next.volume);
    syncVolumeUI(next);
  });

  muteBtn.addEventListener('click', () => {
    const next = updateSettings({ muted: !loadSettings().muted });
    setMasterVolume(next.muted ? 0 : next.volume);
    syncVolumeUI(next);
  });

  panelEl.querySelector('.dx-hud-panel__scrim').addEventListener('click', closePanel);
  panelEl.querySelector('.dx-hud-resume').addEventListener('click', closePanel);
  panelEl.querySelector('.dx-hud-debug').addEventListener('click', renderDebugPage);

  panelEl.querySelector('.dx-hud-restart')?.addEventListener('click', () => {
    confirmInPanel('Restart this chapter from the beginning?', () => {
      closePanel();
      restartFn?.();
    });
  });

  panelEl.querySelector('.dx-hud-chapters').addEventListener('click', () => {
    if (chapterActive) {
      confirmInPanel('Progress in this chapter will be lost. Quit to the title screen?', () => {
        closePanel();
        navigate('title');
      });
    } else {
      closePanel();
      navigate('title');
    }
  });
}

// The DEBUG page: a starting state (class, lake, feelings, bonds) and a
// button per scene. Picking a scene restarts the chapter right there with
// that state (shell/debug.js). Same box, so BACK returns to settings.
const DEBUG_CHAPTER = 'lake-ulysses';
const DEBUG_GROUPS = [
  ['OPENING', ['it-intro', 'opening-quote', 'bob-baiter', 'prologue', 'feelz-launch', 'questionnaire']],
  ['THERAPIST', ['therapist', 'walk-home']],
  ['DEBORAH', ['deborah-hallway', 'deborah-confront', 'deborah']],
  ['RWANDA', ['rwanda-alley', 'rwanda-confront', 'rwanda']],
  ['SAMUN', ['samun-garage', 'samun-confront', 'samun']],
  ['RICK', ['rick-barlot', 'rick-confront', 'rick']],
  ['END', ['reckoning', 'ending']],
];
const ALL_FEELINGS = ['Happy', 'Trust', 'Fear', 'Surprise', 'Sadness', 'Disgust', 'Anger', 'Anxiety'];
const debugState = { loadout: 'Guns', truthDebt: 0, allFeelings: false, trusted: false };

async function renderDebugPage() {
  const box = panelEl?.querySelector('.dx-hud-panel__box');
  if (!box) return;
  // Scenes not in the groups above (new ones) still get a button, at the end.
  const mod = await import('../chapters/lake-ulysses/index.js');
  const known = new Set(DEBUG_GROUPS.flatMap(([, ids]) => ids));
  const extra = (mod.DEBUG_SCENES ?? []).map((s) => s.id).filter((sid) => !known.has(sid));
  const groups = extra.length ? [...DEBUG_GROUPS, ['OTHER', extra]] : DEBUG_GROUPS;

  box.classList.add('is-debug');
  box.innerHTML = `
    <h3 class="dx-hud-panel__title">DEBUG</h3>
    <button type="button" class="dx-btn dx-debug__sound">SOUND PLAYER</button>
    <div class="dx-debug__row"><span>CLASS</span><span class="dx-debug__seg" data-key="loadout"></span></div>
    <label class="dx-debug__row"><span>LAKE <b class="dx-debug__debt"></b></span>
      <input type="range" min="0" max="10" step="1" class="dx-debug__lake"></label>
    <button type="button" class="dx-btn dx-debug__toggle" data-key="allFeelings"></button>
    <button type="button" class="dx-btn dx-debug__toggle" data-key="trusted"></button>
    <div class="dx-debug__scenes"></div>
    <button type="button" class="dx-btn dx-debug__back">BACK</button>
  `;

  const seg = box.querySelector('.dx-debug__seg');
  for (const cls of ['Guns', 'Bible', 'Crystals']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dx-debug__chip';
    b.dataset.cls = cls;
    b.textContent = cls.toUpperCase();
    b.addEventListener('click', () => { debugState.loadout = cls; sync(); });
    seg.appendChild(b);
  }
  const lake = box.querySelector('.dx-debug__lake');
  lake.addEventListener('input', () => { debugState.truthDebt = Number(lake.value); sync(); });
  box.querySelectorAll('.dx-debug__toggle').forEach((t) => {
    t.addEventListener('click', () => { debugState[t.dataset.key] = !debugState[t.dataset.key]; sync(); });
  });

  const scenes = box.querySelector('.dx-debug__scenes');
  for (const [label, ids] of groups) {
    const head = document.createElement('p');
    head.className = 'dx-debug__group';
    head.textContent = label;
    scenes.appendChild(head);
    for (const sid of ids) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dx-debug__scene';
      b.textContent = sid;
      b.addEventListener('click', () => {
        // Read the choices off the page itself, so the jump is exactly
        // what's showing (not a copy that could drift).
        const shown = {
          loadout: box.querySelector('.dx-debug__chip.is-active')?.dataset.cls ?? debugState.loadout,
          truthDebt: Number(lake.value),
          allFeelings: box.querySelector('.dx-debug__toggle[data-key="allFeelings"]').classList.contains('is-active'),
          trusted: box.querySelector('.dx-debug__toggle[data-key="trusted"]').classList.contains('is-active'),
        };
        Object.assign(debugState, shown);
        closePanel();
        jumpTo(DEBUG_CHAPTER, sid, overridesFor(shown));
      });
      scenes.appendChild(b);
    }
  }
  box.querySelector('.dx-debug__sound').addEventListener('click', async () => {
    const { mountSoundLab } = await import('../ui/soundLab.js');
    closePanel();
    mountSoundLab(hostEl, { onClose: openPanel });
  });
  box.querySelector('.dx-debug__back').addEventListener('click', () => { closePanel(); openPanel(); });

  function sync() {
    seg.querySelectorAll('.dx-debug__chip').forEach((c) => c.classList.toggle('is-active', c.textContent === debugState.loadout.toUpperCase()));
    lake.value = String(debugState.truthDebt);
    box.querySelector('.dx-debug__debt').textContent = String(debugState.truthDebt);
    box.querySelectorAll('.dx-debug__toggle').forEach((t) => {
      const on = debugState[t.dataset.key];
      t.classList.toggle('is-active', on);
      t.textContent = t.dataset.key === 'allFeelings' ? `ALL FEELINGS: ${on ? 'ON' : 'OFF'}` : `EVERYONE TRUSTS YOU: ${on ? 'ON' : 'OFF'}`;
    });
  }
  sync();
}

function overridesFor(s) {
  const o = { loadout: s.loadout, truthDebt: s.truthDebt };
  if (s.allFeelings) o.unlocked = ALL_FEELINGS;
  if (s.trusted) {
    const bond = { syncs: 2, bids: 1 };
    o.bonds = { DEBORAH: bond, RWANDA: bond, SAMUN: bond, RICK: bond };
  }
  return o;
}

// Swaps the panel's box content for a yes/no prompt — same box, same scrim,
// so it reads as one panel deciding rather than a second dialog appearing on
// top of the first.
function confirmInPanel(message, onYes) {
  const box = panelEl?.querySelector('.dx-hud-panel__box');
  if (!box) return;
  box.innerHTML = `
    <p class="dx-text dx-hud-panel__confirm-text">${message}</p>
    <div class="dx-hud-panel__confirm-row">
      <button type="button" class="dx-btn dx-hud-confirm-yes">YES</button>
      <button type="button" class="dx-btn dx-hud-confirm-no">NO</button>
    </div>
  `;
  box.querySelector('.dx-hud-confirm-yes').addEventListener('click', onYes);
  box.querySelector('.dx-hud-confirm-no').addEventListener('click', () => {
    closePanel();
    openPanel();
  });
}
