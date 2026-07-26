import './style.css';
import './ui/ui.css';
import './scenes/scenes.css';
import { onRouteChange, navigate } from './shell/router.js';
import { loadSave } from './shell/save.js';
import { initFx, fadeToBlack } from './shell/fx.js';
import { startTitleMusic, stopTitleMusic, playStartJingle, playLogoSting } from './shell/audio.js';

// Chapter registry — adding a new chapter later is one entry here.
const CHAPTERS = {
  'lake-ulysses': {
    title: 'Truth Debt: Lake Ulysses',
    load: () => import('./chapters/lake-ulysses/index.js'),
    firstPlayScene: 'questionnaire',
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
// inkflo Graphics logo plays (muted autoplay) while heavy assets prefetch.
// Spinner rotates during load. When video ends AND assets are ready the
// spinner stops and "TAP TO PLAY" appears — that tap is the AudioContext
// gesture unlock, plays the logo sting, then goes straight to the title menu.

const PRELOAD_ASSETS = [
  '/assets/lake-ulysses/sprites/spr_lake_bg_001/spr_lake_bg_001_0000.webp',
  '/assets/lake-ulysses/sprites/spr_bb/spr_bb_0000.webp',
  '/assets/lake-ulysses/audio/lk_01.mp3',
  '/assets/shared/audio/title/snd_lake_title.mp3',
  '/assets/shared/audio/title/snd_titlemusic.mp3',
];

function prefetchAssets() {
  return Promise.all(
    PRELOAD_ASSETS.map(src =>
      fetch(src, { priority: 'low' }).catch(() => null)
    )
  );
}

function renderPreloader() {
  teardown();

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-preloader-screen';

  const vid = document.createElement('video');
  vid.className = 'dx-preloader-video';
  vid.muted = true;
  vid.playsInline = true;
  vid.autoplay = true;
  vid.appendChild(Object.assign(document.createElement('source'), {
    src: '/assets/shared/sprites/spr_inkflo_logo.webm', type: 'video/webm',
  }));
  vid.appendChild(Object.assign(document.createElement('source'), {
    src: '/assets/shared/sprites/spr_inkflo_logo.mp4', type: 'video/mp4',
  }));

  const spinner = document.createElement('div');
  spinner.className = 'dx-preloader-spinner';

  const tapPrompt = document.createElement('p');
  tapPrompt.className = 'dx-preloader-tap dx-press-start';
  tapPrompt.textContent = '▶ TAP TO PLAY';
  tapPrompt.hidden = true;

  screen.appendChild(vid);
  screen.appendChild(spinner);
  screen.appendChild(tapPrompt);
  canvas.appendChild(screen);

  let assetsReady = false;
  let videoEnded = false;
  let readyToTap = false;

  function showTapPrompt() {
    if (readyToTap) return;
    if (!assetsReady || !videoEnded) return;
    readyToTap = true;
    spinner.classList.add('dx-preloader-spinner--done');
    tapPrompt.hidden = false;
    screen.addEventListener('click', onTap, { once: true });
  }

  function onTap() {
    screen.removeEventListener('click', onTap);
    // Gesture unlocks AudioContext — play sting, then title music
    playLogoSting().catch(() => {});
    startTitleMusic();
    screen.classList.add('dx-preloader-out');
    const fallback = setTimeout(() => { teardown(); renderTitleMenu(); }, 700);
    screen.addEventListener('transitionend', () => {
      clearTimeout(fallback);
      teardown();
      renderTitleMenu();
    }, { once: true });
  }

  prefetchAssets().then(() => { assetsReady = true; showTapPrompt(); });
  vid.addEventListener('ended', () => { videoEnded = true; showTapPrompt(); });

  currentUnmount = () => {};
}

function renderTitle() {
  teardown();
  renderPreloader();
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

onRouteChange(({ screen, param, startAt }) => {
  if (screen === 'menu')         renderMenu();
  else if (screen === 'about')   renderAbout();
  else if (screen === 'chapter') renderChapter(param, startAt);
  else                           renderTitle();
});
