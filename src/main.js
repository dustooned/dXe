import './style.css';
import './ui/ui.css';
import './scenes/scenes.css';
import { onRouteChange, navigate, getCurrentRoute } from './shell/router.js';
import { loadSave } from './shell/save.js';
import { initFx, fadeToBlack } from './shell/fx.js';
import { startTitleMusic, stopTitleMusic, playStartJingle, playLogoSting, unlockAudio } from './shell/audio.js';

// Chapter registry — adding a new chapter later is one entry here.
const CHAPTERS = {
  'lake-ulysses': {
    title: 'Truth Debt: Lake Ulysses',
    load: () => import('./chapters/lake-ulysses/index.js'),
  },
};

const app = document.getElementById('app');
const canvas = document.createElement('div');
canvas.className = 'dx-canvas';
app.appendChild(canvas);
initFx(canvas);

let currentUnmount = null;

function teardown() {
  currentUnmount?.();
  currentUnmount = null;
  canvas.innerHTML = '';
}

// ─── Preloader ────────────────────────────────────────────────────────────────
// Phase 1 — Loading: spinner + flashing "Reticulating Splines..." while assets
//   prefetch. Any tap during this phase unlocks AudioContext early.
// Phase 2 — Logo: inkflo Graphics video plays with audio. Tap skips.
// After logo: returning players (chaptersCompleted > 0) go to chapter select;
//   new players go to the title menu.

const PRELOAD_ASSETS = [
  '/assets/lake-ulysses/sprites/spr_lake_bg_001/spr_lake_bg_001_0000.webp',
  '/assets/lake-ulysses/sprites/spr_bb/spr_bb_0000.webp',
  '/assets/lake-ulysses/audio/lk_01.mp3',
  '/assets/shared/audio/title/snd_lake_title.mp3',
  '/assets/shared/audio/title/snd_titlemusic.mp3',
];

// Assets are often warm in cache, which would flash the loading phase past
// before it can be read. Hold it on screen long enough to actually register.
const MIN_LOADING_MS = 2200;

// Grace period before checking whether the logo video actually started. A
// video that's going to play is unpaused well inside this; one that's been
// refused is still paused, and waiting out the ceiling below would mean
// staring at a frozen frame.
const PLAY_PROBE_MS = 1200;

// Hard ceiling on the logo phase. The video runs ~10s, so normal playback
// always ends well before this — it only fires if playback starts and then
// stalls without ever reaching 'ended'.
const LOGO_MAX_MS = 15000;

function prefetchAssets() {
  const fetches = Promise.all(
    PRELOAD_ASSETS.map(src =>
      fetch(src, { priority: 'low' }).catch(() => null)
    )
  );
  const minimumHold = new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS));
  return Promise.all([fetches, minimumHold]);
}

// The boot sequence runs the preloader exactly once, before the router takes
// over. Without this gate a leftover hash (#/menu, #/chapter/...) would route
// straight past the intro — and afterLogo() writing #/menu made that leftover
// hash permanent after a single playthrough.
let booted = false;
let bootRoute = null;

function afterLogo() {
  booted = true;
  const route = bootRoute;
  bootRoute = null;

  // Only a chapter deep-link is honored (useful for jumping to a scene).
  // A stale #/menu or #/about is ignored — those are hashes the app wrote
  // itself on a previous visit, and obeying them strands you past the intro.
  if (route && route.screen === 'chapter') { dispatch(route); return; }

  // Everything else routes by save: returning → chapter select, new → title.
  goto(loadSave().chaptersCompleted.length > 0 ? 'menu' : 'title');
}

// navigate(), but still renders when the hash already equals the target —
// assigning an unchanged location.hash fires no hashchange event.
function goto(path) {
  if (location.hash === `#/${path}`) dispatch(getCurrentRoute());
  else navigate(path);
}

function renderPreloader() {
  teardown();

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-preloader-screen';

  // ── Phase 1: loading indicator ──────────────────────────────────────────────
  const loadingPhase = document.createElement('div');
  loadingPhase.className = 'dx-loading-phase';

  const spinner = document.createElement('div');
  spinner.className = 'dx-preloader-spinner';

  const loadingText = document.createElement('p');
  loadingText.className = 'dx-loading-text dx-press-start';
  loadingText.textContent = 'Reticulating Spines...';

  loadingPhase.appendChild(spinner);
  loadingPhase.appendChild(loadingText);

  // ── Phase 2: logo video ─────────────────────────────────────────────────────
  const logoPhase = document.createElement('div');
  logoPhase.className = 'dx-logo-phase';
  logoPhase.hidden = true;

  const vid = document.createElement('video');
  vid.className = 'dx-preloader-video';
  vid.muted = true;
  vid.playsInline = true;
  vid.appendChild(Object.assign(document.createElement('source'), {
    src: '/assets/shared/sprites/spr_inkflo_logo.webm', type: 'video/webm',
  }));
  vid.appendChild(Object.assign(document.createElement('source'), {
    src: '/assets/shared/sprites/spr_inkflo_logo.mp4', type: 'video/mp4',
  }));

  const skipPrompt = document.createElement('p');
  skipPrompt.className = 'dx-logo-skip dx-press-start';
  skipPrompt.textContent = '▶ TAP TO SKIP';

  logoPhase.appendChild(vid);
  logoPhase.appendChild(skipPrompt);

  screen.appendChild(loadingPhase);
  screen.appendChild(logoPhase);
  canvas.appendChild(screen);

  let audioUnlocked = false;

  // Any tap during loading phase unlocks AudioContext early
  screen.addEventListener('click', () => {
    if (!audioUnlocked) { audioUnlocked = true; unlockAudio(); }
  });

  function startLogo() {
    loadingPhase.hidden = true;
    logoPhase.hidden = false;

    // The sting loads async, so a fast skip can land before there's anything to
    // stop. Without this flag the sting starts *after* the logo is gone and
    // plays over the title screen with no handle left to cut it.
    let stingStop = () => {};
    let stingCancelled = false;
    playLogoSting().then(handle => {
      if (stingCancelled) { handle.stop(); return; }
      stingStop = handle.stop.bind(handle);
    }).catch(() => {});

    let finished = false;
    const timers = [];

    function finish() {
      if (finished) return;
      finished = true;
      stingCancelled = true;
      timers.forEach(clearTimeout);
      vid.removeEventListener('ended', finish);
      logoPhase.removeEventListener('click', finish);
      stingStop();
      screen.classList.add('dx-preloader-out');
      const fallback = setTimeout(() => { teardown(); afterLogo(); }, 700);
      screen.addEventListener('transitionend', () => {
        clearTimeout(fallback);
        teardown();
        afterLogo();
      }, { once: true });
    }

    vid.addEventListener('ended', finish, { once: true });
    logoPhase.addEventListener('click', finish, { once: true });

    // A logo that can't play (iOS Low Power Mode, autoplay policy, an in-app
    // browser) parks on frame 0, so 'ended' never fires and the only way out of
    // the boot is a tap the player has no reason to know is required. Three
    // ways out, because browsers fail this differently: an explicit rejection,
    // a silent refusal that leaves it paused, and a start that never ends.
    vid.play().catch(() => finish());
    timers.push(setTimeout(() => { if (vid.paused) finish(); }, PLAY_PROBE_MS));
    timers.push(setTimeout(finish, LOGO_MAX_MS));
  }

  prefetchAssets().then(startLogo);
  currentUnmount = () => {};
}

function renderTitle() {
  teardown();
  startTitleMusic();
  renderTitleMenu();
}

function renderTitleMenu() {
  canvas.innerHTML = '';

  const save = loadSave();
  const hasPlayed = save.chaptersCompleted.length > 0;

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-title-screen';
  screen.innerHTML = `
    <h1 class="dx-title">DREAM XTREME</h1>
    <p class="dx-text dx-title-sub">Lake Ulysses. The water looks fine.</p>
  `;

  const menu = document.createElement('div');
  menu.className = 'dx-menu';

  const enterBtn = document.createElement('button');
  enterBtn.className = 'dx-btn';
  enterBtn.textContent = 'ENTER';
  enterBtn.addEventListener('click', () => {
    if (hasPlayed) {
      showSkipDialog(screen, menu);
    } else {
      beginTransition('chapter/lake-ulysses');
    }
  });
  menu.appendChild(enterBtn);
  screen.appendChild(menu);
  canvas.appendChild(screen);

  currentUnmount = stopTitleMusic;
}

function showSkipDialog(screen, menu) {
  menu.style.opacity = '0.3';
  menu.style.pointerEvents = 'none';

  const dialog = document.createElement('div');
  dialog.className = 'dx-skip-dialog';
  dialog.innerHTML = `<p class="dx-text">You've been here before.<br>Skip the story?</p>`;

  const btnRow = document.createElement('div');
  btnRow.className = 'dx-menu';
  btnRow.style.flexDirection = 'row';
  btnRow.style.gap = '12px';

  const yesBtn = document.createElement('button');
  yesBtn.className = 'dx-btn';
  yesBtn.textContent = 'SKIP';
  yesBtn.addEventListener('click', () => beginTransition('chapter/lake-ulysses/questionnaire'));

  const noBtn = document.createElement('button');
  noBtn.className = 'dx-btn';
  noBtn.textContent = 'REPLAY';
  noBtn.addEventListener('click', () => beginTransition('chapter/lake-ulysses'));

  btnRow.appendChild(yesBtn);
  btnRow.appendChild(noBtn);
  dialog.appendChild(btnRow);
  screen.appendChild(dialog);
}

// Cuts title music, plays snd_start (6.1s), fades to black over the same
// duration, then navigates. Any tap skips the wait and goes straight in.
function beginTransition(destination) {
  stopTitleMusic();
  const FADE_MS = 6100;

  playStartJingle().then((jingle) => {
    const fade = fadeToBlack(FADE_MS, () => {
      jingle.stop();
      navigate(destination);
    });

    canvas.addEventListener('click', () => {
      jingle.stop();
      fade.skip();
    }, { once: true });
  });
}

// ─── Chapter select ───────────────────────────────────────────────────────────

function renderMenu() {
  teardown();
  const save = loadSave();
  const screen = document.createElement('div');
  screen.className = 'dx-screen';
  screen.innerHTML = `<h2 class="dx-title">CHAPTERS</h2>`;

  const menu = document.createElement('div');
  menu.className = 'dx-menu';

  for (const [chapterId, chapter] of Object.entries(CHAPTERS)) {
    const btn = document.createElement('button');
    btn.className = 'dx-btn';
    const seen = save.chaptersCompleted.includes(chapterId) ? ' ✓' : '';
    btn.textContent = chapter.title + seen;
    btn.addEventListener('click', () => navigate(`chapter/${chapterId}`));
    menu.appendChild(btn);
  }

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'dx-btn';
  aboutBtn.textContent = 'ABOUT / CONTACT';
  aboutBtn.addEventListener('click', () => navigate('about'));
  menu.appendChild(aboutBtn);

  screen.appendChild(menu);
  canvas.appendChild(screen);
}

// ─── About ────────────────────────────────────────────────────────────────────

function renderAbout() {
  teardown();
  const screen = document.createElement('div');
  screen.className = 'dx-screen';
  screen.innerHTML = `
    <h2 class="dx-title">ABOUT</h2>
    <p class="dx-text">Dream Xtreme is an episodic interactive zine. Each chapter is a
    self-contained short story you play with a swipe, a tap, or a click.</p>
    <p class="dx-text">Contact: hello@dreamxtreme.com</p>
  `;

  const backBtn = document.createElement('button');
  backBtn.className = 'dx-btn';
  backBtn.textContent = 'BACK';
  backBtn.addEventListener('click', () => navigate('menu'));
  screen.appendChild(backBtn);
  canvas.appendChild(screen);
}

// ─── Chapter ──────────────────────────────────────────────────────────────────

async function renderChapter(chapterId, startAt) {
  teardown();
  const chapter = CHAPTERS[chapterId];
  if (!chapter) { navigate('menu'); return; }
  const mod = await chapter.load();
  currentUnmount = mod.mount(canvas, {
    exit: () => navigate('menu'),
    startSceneId: startAt || null,
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

function dispatch({ screen, param, startAt }) {
  if (screen === 'menu')         renderMenu();
  else if (screen === 'about')   renderAbout();
  else if (screen === 'chapter') renderChapter(param, startAt);
  else                           renderTitle();
}

onRouteChange((route) => {
  // First fire is app boot — hold the route and play the intro first.
  if (!booted) {
    bootRoute = route;
    renderPreloader();
    return;
  }
  dispatch(route);
});
