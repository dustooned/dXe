import './style.css';
import './ui/ui.css';
import './scenes/scenes.css';
import { onRouteChange, navigate, getCurrentRoute } from './shell/router.js';
import { loadSave } from './shell/save.js';
import { initFx, fadeToBlack, flash, shake } from './shell/fx.js';
import { initFeelzWord } from './shell/feelzWord.js';
import { setJumpHandler } from './shell/debug.js';
import { initHud, setVisible as setHudVisible } from './shell/hud.js';
import { startTitleMusic, stopTitleMusic, playStartJingle, playLogoSting, unlockAudio, playLogoSweep, playLogoSlam, startChapterPreview, stopChapterPreview } from './shell/audio.js';

// Chapter registry — adding a new chapter later is one entry here.
const CHAPTERS = {
  'lake-ulysses': {
    title: 'Truth Debt: Lake Ulysses',
    load: () => import('./chapters/lake-ulysses/index.js'),
    // The chapter card's panning background (renderMenu): a vertical sheet
    // of seamless tiles (see scripts/import-gm-title.mjs), tinted. PLACEHOLDER:
    // the title screen's lake until this chapter has its own art.
    banner: { src: '/assets/shared/title/spr_title_bg.png', frames: 7, tile: [500, 288], tint: '#1f8a8a' },
    // Where 'skip the story' starts a returning player.
    skipTo: 'feelz-launch',
    // Hovering its card: the lake's ambience, low, and a few watery notes.
    ambience: { src: '/assets/lake-ulysses/audio/lk_01.mp3', motif: [['E4', 420], ['G4', 420], ['B4', 620], ['A4', 1000]] },
  },
};

const app = document.getElementById('app');
const canvas = document.createElement('div');
canvas.className = 'dx-canvas';
app.appendChild(canvas);
initFx(canvas);
// Every FEELZ on screen wears the logo colors (shell/feelzWord.js).
initFeelzWord(canvas);

// Every screen renders into this inner layer, which gets wiped wholesale on
// every teardown() and every scene's own re-render (cutsceneScene.render()
// etc. call stageEl.innerHTML = ''). The HUD (settings gear, fast-forward)
// is mounted straight onto dx-canvas instead, one level up, specifically so
// it survives all of that instead of needing to be rebuilt by every screen.
const stage = document.createElement('div');
stage.className = 'dx-stage';
canvas.appendChild(stage);
initHud(canvas);

let currentUnmount = null;

function teardown() {
  currentUnmount?.();
  currentUnmount = null;
  stage.innerHTML = '';
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
  '/assets/shared/title/spr_title_bg.png',
  '/assets/shared/title/spr_game_title.png',
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
  setHudVisible(true);
  const route = bootRoute;
  bootRoute = null;

  // Only a chapter deep-link is honored (useful for jumping to a scene).
  // A stale #/menu or #/about is ignored — those are hashes the app wrote
  // itself on a previous visit, and obeying them strands you past the intro.
  if (route && route.screen === 'chapter') { dispatch(route); return; }

  // Everything else lands on the title screen, every time: it's the front
  // door. ENTER from there decides (first time: straight into the story;
  // returning: chapter select).
  goto('title');
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
  stage.appendChild(screen);

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
  stage.innerHTML = '';

  const save = loadSave();
  const hasPlayed = save.chaptersCompleted.length > 0;

  // The title, NES-style: the dithered lake fades in, panning slowly, the DREAM XTREME
  // logo (from the GameMaker beta, still "boiling" frame to frame) arrives
  // split in two, top half from the left and bottom half from the right,
  // they slam together with a flash, the logo strobes, then the menu. A tap
  // skips straight to the finished screen.
  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-title-screen dx-title-intro';
  screen.innerHTML = `
    <div class="dx-title-bg" aria-hidden="true"><div class="dx-title-bg__strip"></div></div>
    <h1 class="dx-title-logo" aria-label="Dream Xtreme">
      <span class="dx-title-logo__half dx-title-logo__half--top"></span>
      <span class="dx-title-logo__half dx-title-logo__half--bottom"></span>
    </h1>
  `;
  const introTimers = [];
  const at = (ms, fn) => introTimers.push(setTimeout(fn, ms));
  at(700, playLogoSweep);
  at(1400, () => {
    playLogoSlam();
    flash('strong', '#ffffff');
    shake('strong');
    screen.classList.add('is-slammed');
  });
  at(2600, () => screen.classList.add('is-ready'));
  screen.addEventListener('pointerdown', () => {
    if (screen.classList.contains('is-ready')) return;
    introTimers.forEach(clearTimeout);
    screen.classList.add('is-skipped', 'is-slammed', 'is-ready');
  });

  const menu = document.createElement('div');
  menu.className = 'dx-menu';

  const enterBtn = document.createElement('button');
  enterBtn.className = 'dx-btn';
  enterBtn.textContent = 'ENTER';
  // First time: straight into the story. Played before: chapter select,
  // where each chapter asks before it starts (and offers to skip the story).
  enterBtn.addEventListener('click', () => {
    if (hasPlayed) navigate('menu');
    else beginTransition('chapter/lake-ulysses');
  });
  menu.appendChild(enterBtn);
  screen.appendChild(menu);
  stage.appendChild(screen);

  currentUnmount = stopTitleMusic;
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
  screen.className = 'dx-screen dx-chapters-screen';
  // Behind everything: hovering a chapter (mouse only) fills the screen with
  // its art, black and white, magnified, with an echo of itself drifting
  // behind, like the card's image thrown up on the wall.
  screen.innerHTML = `<div class="dx-chapters-backdrop" aria-hidden="true"><span class="dx-chapters-backdrop__strip"></span><span class="dx-chapters-backdrop__strip is-echo"></span></div><h2 class="dx-title">CHAPTERS</h2>`;
  const backdrop = screen.querySelector('.dx-chapters-backdrop');
  const canHover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  function showBackdrop(b) {
    backdrop.style.setProperty('--banner', `url('${b.src}')`);
    backdrop.style.setProperty('--frames', b.frames);
    backdrop.style.setProperty('--frame-steps', b.frames - 1);
    // A tile's width at the main layer's height (120% of the screen).
    backdrop.style.setProperty('--tile-w', `${(screen.clientHeight * 1.2 * b.tile[0] / b.tile[1]).toFixed(1)}px`);
    backdrop.classList.add('is-on');
  }

  // Touch: 'Ready to play?' over the chapter's art. Played before: offer to
  // skip the story, or start over.
  function askReady(chapterId, chapter, played) {
    screen.querySelector('.dx-chapter-ask')?.remove();
    const ask = document.createElement('div');
    ask.className = 'dx-chapter-ask';
    const title = document.createElement('p');
    title.className = 'dx-text dx-chapter-ask__title';
    title.textContent = chapter.title;
    const q = document.createElement('p');
    q.className = 'dx-text';
    q.textContent = played ? "You've been here before. Skip the story?" : 'Ready to play?';
    const row = document.createElement('div');
    row.className = 'dx-menu';
    const options = played && chapter.skipTo
      ? [['SKIP STORY', `chapter/${chapterId}/${chapter.skipTo}`], ['FROM THE START', `chapter/${chapterId}`]]
      : [['PLAY', `chapter/${chapterId}`]];
    for (const [label, to] of options) {
      const go = document.createElement('button');
      go.className = 'dx-btn';
      go.textContent = label;
      go.addEventListener('click', () => { stopChapterPreview(); navigate(to); });
      row.appendChild(go);
    }
    const back = document.createElement('button');
    back.className = 'dx-btn dx-chapter-ask__back';
    back.textContent = 'BACK';
    back.addEventListener('click', () => { ask.remove(); backdrop.classList.remove('is-on'); stopChapterPreview(); });
    row.appendChild(back);
    ask.append(title, q, row);
    screen.appendChild(ask);
  }

  const menu = document.createElement('div');
  menu.className = 'dx-menu';

  for (const [chapterId, chapter] of Object.entries(CHAPTERS)) {
    // A banner per chapter: its own art panning behind the title.
    const btn = document.createElement('button');
    btn.className = 'dx-chapter-card';
    const b = chapter.banner;
    if (b) {
      btn.style.setProperty('--banner', `url('${b.src}')`);
      btn.style.setProperty('--frames', b.frames);
      btn.style.setProperty('--frame-steps', b.frames - 1);
      // One tile's width at the card's height (118 * --px): the strip is the
      // card plus one tile wide and slides exactly one tile per loop.
      btn.style.setProperty('--tile-w', `calc(${(118 * b.tile[0] / b.tile[1]).toFixed(2)} * var(--px))`);
      btn.style.setProperty('--tint', b.tint ?? 'transparent');
    }
    const done = save.chaptersCompleted.includes(chapterId);
    btn.innerHTML = `<span class="dx-chapter-card__bg" aria-hidden="true"><span class="dx-chapter-card__strip"></span></span><span class="dx-chapter-card__title"></span><span class="dx-chapter-card__meta">${done ? 'PLAYED ✓' : 'NEW'}</span>`;
    btn.querySelector('.dx-chapter-card__title').textContent = chapter.title;
    btn.addEventListener('click', () => {
      // Mouse: straight in. Touch: the art fills the screen first and it
      // asks, and a returning player is offered the skip.
      if (canHover && !done) { stopChapterPreview(); navigate(`chapter/${chapterId}`); return; }
      if (b) showBackdrop(b);
      if (chapter.ambience) startChapterPreview(chapter.ambience);
      askReady(chapterId, chapter, done);
    });
    if (canHover && b) {
      btn.addEventListener('mouseenter', () => { showBackdrop(b); if (chapter.ambience) startChapterPreview(chapter.ambience); });
      btn.addEventListener('mouseleave', () => { backdrop.classList.remove('is-on'); stopChapterPreview(); });
    }
    menu.appendChild(btn);
  }

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'dx-btn';
  aboutBtn.textContent = 'ABOUT / CONTACT';
  aboutBtn.addEventListener('click', () => navigate('about'));
  menu.appendChild(aboutBtn);

  const titleBtn = document.createElement('button');
  titleBtn.className = 'dx-btn';
  titleBtn.textContent = 'TITLE SCREEN';
  titleBtn.addEventListener('click', () => navigate('title'));
  menu.appendChild(titleBtn);

  screen.appendChild(menu);

  const buildInfo = document.createElement('p');
  buildInfo.className = 'dx-build-info';
  buildInfo.textContent = `BETA · v${__APP_VERSION__} · build ${__BUILD_NUMBER__} · ${__COMMIT_HASH__}`;
  screen.appendChild(buildInfo);

  stage.appendChild(screen);
  currentUnmount = stopChapterPreview;
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
  stage.appendChild(screen);
}

// ─── Chapter ──────────────────────────────────────────────────────────────────

// Bumped on every chapter render: a load that finishes after a newer render
// started (a debug jump during boot, a fast double navigation) is dropped
// instead of mounting over it and eating the newer one's debug state.
let chapterRender = 0;

async function renderChapter(chapterId, startAt) {
  teardown();
  const chapter = CHAPTERS[chapterId];
  if (!chapter) { navigate('menu'); return; }
  const ticket = ++chapterRender;
  const mod = await chapter.load();
  if (ticket !== chapterRender) return;
  currentUnmount = mod.mount(stage, {
    exit: () => navigate('title'),
    // Settings panel's "Restart Chapter" (shell/hud.js) — re-enters the same
    // chapter fresh. Re-navigating via the hash wouldn't fire hashchange
    // since it's already there, so this calls back in directly instead.
    restart: () => renderChapter(chapterId, null),
    startSceneId: startAt || null,
  });
}

// The settings panel's DEBUG page jumps straight into a scene: the hash
// follows along without a hashchange re-render.
setJumpHandler((chapterId, sceneId) => {
  history.replaceState(null, '', `#/chapter/${chapterId}/${sceneId}`);
  renderChapter(chapterId, sceneId);
});

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
