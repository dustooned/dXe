// Persistent chrome that sits above every scene: a settings gear (always
// present) and a fast-forward icon (present only while the current scene is
// skippable — see sceneSequencer.js's isSkippable()). Both are mounted once,
// into main.js's own dx-canvas layer rather than the dx-stage a scene wipes
// wholesale on every one of its own re-renders, so neither has to be
// rebuilt — or even known about — by any scene handler.
import { navigate } from './router.js';
import { loadSettings, updateSettings, applyEffectsSetting } from './settings.js';
import { applyPerfClass } from './perf.js';
import { meterGlyph } from '../ui/statusBar.js';
import { setMasterVolume, playTypewriterTick } from './audio.js';
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
  applyEffectsSetting();
  applyPerfClass();
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

// The FEELZ guide: every piece of the screen in one place, a picture and a
// line or two each, to look up any time (playtest: "unsure what effect my
// action would take"). Describes, never judges: no piece is a score.
function lissajousSvg(a, b, phase) {
  const pts = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    pts.push(`${(12 + Math.sin(a * t + phase) * 9).toFixed(1)},${(8 - Math.sin(b * t) * 6).toFixed(1)}`);
  }
  return `<svg viewBox="0 0 24 16" class="dx-guide__svg"><polyline points="${pts.join(' ')}" fill="none" stroke="#ffe27a" stroke-width="1"/></svg>`;
}
const GUIDE = [
  ['BATTERY', () => meterGlyph('stability'), 'How much you have left. The truth often costs charge; a lie puts some back; changing your feeling more than once on a question costs a little. At 2 or less the little screen goes dark to save power; near empty, your most-used feeling greys out. It recovers between people, more when they let you in.'],
  ['BARS', () => meterGlyph('trust'), 'How connected people feel to you. Below 4, some doors stay shut and the Therapist can\'t get through.'],
  ['WI-FI', () => meterGlyph('lucidity'), 'How clearly you see. Every lie fogs it a little. Below 4, calls come in blurry and the Therapist goes to voicemail.'],
  ['CLOCK', () => '<span class="dx-guide__clock">12:00</span>', 'Keeps honest time while you do. Lie enough and the minutes start to skip.'],
  ['+1 / -1', () => '<span class="dx-guide__delta"><b>+1</b> <i>-1</i></span>', 'After an answer, how much it moved each meter.'],
  ['THE LAKE', () => '<span class="dx-guide__lake"></span>', 'Everything you told people, as water. Lies fill it, truths clear it a little. It decides how the chapter ends.'],
  ['THE LINES', () => '<svg viewBox="0 0 24 16" class="dx-guide__svg"><path d="M0 5 Q4 1 8 5 T16 5 T24 5" stroke="#9b6bff" fill="none"/><path d="M0 11 Q4 7 8 11 T16 11 T24 11" stroke="#4fd6ff" fill="none"/></svg>', 'Across their picture: their line on top, yours under it. The closer they run, the closer you are.'],
  ['LITTLE SCREEN', () => lissajousSvg(4, 5, Math.PI / 4), 'Your feeling against theirs. A busier shape means further apart; a circle that holds still means you found what they feel.'],
  ['NEEDLE', () => '<svg viewBox="0 0 24 16" class="dx-guide__svg"><path d="M3 13 H21 M3 13 V10 M12 13 V10 M21 13 V10" stroke="#fff" stroke-opacity="0.5" fill="none"/><path d="M12 13 L19 4" stroke="#ffe27a" stroke-width="1.6"/></svg>', 'Right: you\'re moving together. Left: pulling apart.'],
  ['COMFORT', () => '<span class="dx-guide__delta"><b>♥</b></span>', 'Tell someone what they want to hear and they relax: if it warmed them, their next feeling glows on your wheel. The lake keeps count.'],
  ['MASKS', () => '<svg viewBox="0 0 24 16" class="dx-guide__svg"><path d="M0 8 Q4 4 8 8 T16 8 T24 8" stroke="#ffd34d" fill="none" stroke-width="1.4"/><path d="M0 9 Q4 5 8 9 T16 9 T24 9" stroke="#4d8bff" fill="none" stroke-width="1" stroke-dasharray="2 2"/></svg>', 'Some people show one feeling and carry another. The color that flickers under their line is what\'s going on inside.'],
  ['CALLS', () => '<span class="dx-guide__call">T</span>', 'Tap a contact for their read on who you\'re facing, in their own words. One call each per conversation.'],
  ['THE WHEEL', () => lissajousSvg(1, 1, Math.PI / 2), 'Pick how you feel before you answer. Hold a slice to hear it. New feelings arrive when people share theirs.'],
];

// The guide as a drum, like the game's own wheel: entries sit on a cylinder,
// the lit one in the gold frame, its words below. Drag or flick, scroll,
// arrow keys, or tap a neighbour; it always settles on one entry with a tick.
function renderGuidePage() {
  const box = panelEl.querySelector('.dx-hud-panel__box');
  const n = GUIDE.length;
  box.innerHTML = `
    <h3 class="dx-hud-panel__title">FEELZ GUIDE</h3>
    <div class="dx-drum" tabindex="0" role="listbox" aria-label="FEELZ guide. Scroll to browse.">
      <div class="dx-drum__track">${GUIDE.map(([name, pic], i) => `
        <div class="dx-drum__item" data-i="${i}" role="option"><span class="dx-guide__pic">${pic()}</span><span class="dx-drum__name">${name}</span></div>`).join('')}
      </div>
      <div class="dx-drum__frame"></div>
    </div>
    <p class="dx-text dx-drum__text" aria-live="polite"></p>
    <p class="dx-text dx-drum__count"></p>
    <button type="button" class="dx-btn dx-hud-guide__back">BACK</button>
  `;
  let raf = 0;
  box.querySelector('.dx-hud-guide__back').addEventListener('click', () => { cancelAnimationFrame(raf); closePanel(); renderSettingsPanel(); });

  const drum = box.querySelector('.dx-drum');
  const items = [...box.querySelectorAll('.dx-drum__item')];
  const text = box.querySelector('.dx-drum__text');
  const count = box.querySelector('.dx-drum__count');
  const calm = () => document.documentElement.classList.contains('is-reduced-effects');
  let pos = 0;
  let shown = -1;

  function paint() {
    items.forEach((el, i) => {
      const d = i - pos;
      const a = Math.abs(d);
      if (a > 2.7) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      el.style.transform = `translateY(calc(-50% + ${d * 100}%)) rotateX(${-d * 34}deg) scale(${1 - a * 0.1})`;
      el.style.opacity = String(Math.max(0, 1 - a * 0.36));
      el.classList.toggle('is-center', a < 0.5);
    });
    const idx = Math.max(0, Math.min(n - 1, Math.round(pos)));
    if (idx !== shown) {
      if (shown !== -1) playTypewriterTick();
      shown = idx;
      text.textContent = GUIDE[idx][2];
      text.classList.remove('is-new');
      void text.offsetWidth;
      text.classList.add('is-new');
      count.textContent = `${idx + 1} / ${n}`;
    }
  }

  function animateTo(target) {
    cancelAnimationFrame(raf);
    const to = Math.max(0, Math.min(n - 1, Math.round(target)));
    const from = pos;
    if (calm() || from === to) { pos = to; paint(); return; }
    const t0 = performance.now();
    const dur = Math.min(520, 160 + Math.abs(to - from) * 70);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      pos = from + (to - from) * (1 - Math.pow(1 - t, 3));
      paint();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // Drag / flick: the drum follows the finger, then settles on the nearest entry.
  let drag = null;
  drum.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(raf);
    drag = { y: e.clientY, startY: e.clientY, v: 0, t: performance.now(), moved: false };
    drum.setPointerCapture(e.pointerId);
  });
  drum.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const itemPx = drum.clientHeight / 5;
    const dy = e.clientY - drag.y;
    if (Math.abs(e.clientY - drag.startY) > 4) drag.moved = true;
    const now = performance.now();
    drag.v = 0.7 * drag.v + 0.3 * (-dy / itemPx / Math.max(1, now - drag.t));
    drag.t = now;
    drag.y = e.clientY;
    pos = Math.max(-0.4, Math.min(n - 0.6, pos - dy / itemPx));
    paint();
  });
  const release = (e) => {
    if (!drag) return;
    const { moved, v } = drag;
    drag = null;
    if (!moved) {
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.dx-drum__item');
      animateTo(hit ? Number(hit.dataset.i) : pos);
    } else {
      animateTo(pos + v * 240);
    }
  };
  drum.addEventListener('pointerup', release);
  drum.addEventListener('pointercancel', release);

  let acc = 0;
  drum.addEventListener('wheel', (e) => {
    e.preventDefault();
    acc += e.deltaY;
    if (Math.abs(acc) < 30) return;
    animateTo(Math.round(pos) + Math.sign(acc));
    acc = 0;
  }, { passive: false });
  drum.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); animateTo(Math.round(pos) + 1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); animateTo(Math.round(pos) - 1); }
  });

  paint();
  drum.focus({ preventScroll: true });
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
      <button type="button" class="dx-btn dx-hud-effects"></button>
      <button type="button" class="dx-btn dx-hud-textsize"></button>
      <button type="button" class="dx-btn dx-hud-hilite"></button>
      <button type="button" class="dx-btn dx-hud-guide">FEELZ GUIDE</button>
      ${chapterActive ? '<button type="button" class="dx-btn dx-hud-restart">RESTART CHAPTER</button>' : ''}
      <button type="button" class="dx-btn dx-hud-chapters">QUIT TO TITLE</button>
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


  // Text size: NORMAL / LARGE, all body text a step bigger.
  const sizeBtn = panelEl.querySelector('.dx-hud-textsize');
  const syncSize = (s) => { sizeBtn.textContent = `TEXT SIZE: ${s.textSize === 'large' ? 'LARGE' : 'NORMAL'}`; };
  syncSize(settings);
  sizeBtn.addEventListener('click', () => {
    const next = updateSettings({ textSize: loadSettings().textSize === 'large' ? 'normal' : 'large' });
    applyEffectsSetting(next);
    syncSize(next);
  });
  panelEl.querySelector('.dx-hud-guide').addEventListener('click', renderGuidePage);

  // Tips: the spotlight, labels and glows on the Therapist's calls.
  const hiliteBtn = panelEl.querySelector('.dx-hud-hilite');
  const syncHilite = (s) => { hiliteBtn.textContent = `TIPS: ${s.guideHighlights ? 'ON' : 'OFF'}`; };
  syncHilite(settings);
  hiliteBtn.addEventListener('click', () => syncHilite(updateSettings({ guideHighlights: !loadSettings().guideHighlights })));

  // Reduce effects: ON stops shakes, flashes, opponent weather, haze and tints.
  const effectsBtn = panelEl.querySelector('.dx-hud-effects');
  const syncEffects = (s) => { effectsBtn.textContent = `REDUCE EFFECTS: ${s.reduceEffects ? 'ON' : 'OFF'}`; effectsBtn.classList.toggle('is-active', !!s.reduceEffects); };
  syncEffects(settings);
  effectsBtn.addEventListener('click', () => {
    const next = updateSettings({ reduceEffects: !loadSettings().reduceEffects });
    applyEffectsSetting(next);
    syncEffects(next);
  });

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
