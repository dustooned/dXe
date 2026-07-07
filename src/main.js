import './style.css';
import './ui/ui.css';
import './scenes/scenes.css';
import { onRouteChange, navigate } from './shell/router.js';
import { loadSave } from './shell/save.js';

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

let currentUnmount = null;

function teardown() {
  currentUnmount?.();
  currentUnmount = null;
  canvas.innerHTML = '';
}

function renderTitle() {
  teardown();
  const screen = document.createElement('div');
  screen.className = 'dx-screen';
  screen.innerHTML = `
    <h1 class="dx-title">DREAM XTREME</h1>
    <p class="dx-text" style="text-align:center">Lake Ulysses. The water looks fine.</p>
  `;

  const menu = document.createElement('div');
  menu.className = 'dx-menu';
  const startBtn = document.createElement('button');
  startBtn.className = 'dx-btn';
  startBtn.textContent = 'ENTER';
  startBtn.addEventListener('click', () => navigate('menu'));
  menu.appendChild(startBtn);

  screen.appendChild(menu);
  canvas.appendChild(screen);
}

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

async function renderChapter(chapterId) {
  teardown();
  const chapter = CHAPTERS[chapterId];
  if (!chapter) {
    navigate('menu');
    return;
  }
  const mod = await chapter.load();
  currentUnmount = mod.mount(canvas, { exit: () => navigate('menu') });
}

onRouteChange(({ screen, param }) => {
  if (screen === 'menu') renderMenu();
  else if (screen === 'about') renderAbout();
  else if (screen === 'chapter') renderChapter(param);
  else renderTitle();
});
