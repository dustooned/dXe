// Persistent chrome that sits above every scene: a settings gear (always
// present) and a fast-forward icon (present only while the current scene is
// skippable — see sceneSequencer.js's isSkippable()). Both are mounted once,
// into main.js's own dx-canvas layer rather than the dx-stage a scene wipes
// wholesale on every one of its own re-renders, so neither has to be
// rebuilt — or even known about — by any scene handler.
import { navigate } from './router.js';
import { loadSettings, updateSettings } from './settings.js';
import { setMasterVolume } from './audio.js';

let hostEl = null;
let gearBtn = null;
let ffBtn = null;
let panelEl = null;
let skipFn = null;
let restartFn = null;
let chapterActive = false;

export function initHud(el) {
  hostEl = el;

  gearBtn = document.createElement('button');
  gearBtn.type = 'button';
  gearBtn.className = 'dx-hud-btn dx-hud-gear';
  gearBtn.setAttribute('aria-label', 'Settings');
  gearBtn.textContent = '⚙';
  gearBtn.hidden = true;
  gearBtn.addEventListener('click', openPanel);

  ffBtn = document.createElement('button');
  ffBtn.type = 'button';
  ffBtn.className = 'dx-hud-btn dx-hud-ff';
  ffBtn.setAttribute('aria-label', 'Skip ahead');
  ffBtn.textContent = '»';
  ffBtn.hidden = true;
  ffBtn.addEventListener('click', () => skipFn?.());

  hostEl.appendChild(gearBtn);
  hostEl.appendChild(ffBtn);

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
      ${chapterActive ? '<button type="button" class="dx-btn dx-hud-restart">RESTART CHAPTER</button>' : ''}
      <button type="button" class="dx-btn dx-hud-chapters">CHAPTER SELECT</button>
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

  panelEl.querySelector('.dx-hud-restart')?.addEventListener('click', () => {
    confirmInPanel('Restart this chapter from the beginning?', () => {
      closePanel();
      restartFn?.();
    });
  });

  panelEl.querySelector('.dx-hud-chapters').addEventListener('click', () => {
    if (chapterActive) {
      confirmInPanel('Progress in this chapter will be lost. Return to Chapter Select?', () => {
        closePanel();
        navigate('menu');
      });
    } else {
      closePanel();
      navigate('menu');
    }
  });
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
