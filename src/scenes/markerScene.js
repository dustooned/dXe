// Scene type: 'marker'. The page of the novel that opens each NPC's part of
// the chapter: white ink on black, all pixel type, a running head, CHAPTER and
// its Roman numeral, their name, an illustrated plate of their world
// (ui/plates.js, 1-bit and dithered), and a few lines of prose with a drop
// cap, loaded the way an 80s home computer loaded a screen.
//
// It's a page you read, not one that flips. Their room is already audible
// under it (audio.startOpenerAmbience). Then it loads: the border flickers
// with loading stripes, a roll bar passes under the scanlines (nothing
// shakes; it has to stay readable), and each line prints with a bleep, the bleeps a little tune in the NPC's class
// (audio.playClassBleep): the head, the chapter, the name, the plate a
// band at a time (with the data hiss), the caption, the drop cap. When
// the plate is in, their world's sound plays (audio.playOpenerTheme), and the
// prose types. Tap finishes loading; tap again and the ink fades and their
// room comes up.
//
// The only hint on the page is the numeral, in the NPC's class color. It
// gives nothing else away (no glyph, no feelings): the room is where you
// learn them.
//
// Later (JOBS.md): an interactive way in before the page, per NPC.
//
// scene shape: { type: 'marker', id, numeral: 'I', npc, plate, prose, folio }
import { later, cancelLater } from '../shell/pauseBus.js';
import { playClassBleep, playOpenerTheme, startOpenerAmbience, playTypewriterTick, preloadTypewriterTick } from '../shell/audio.js';
import { CLASSES, classColor } from '../engine/loadout.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { isFogged } from '../engine/contacts.js';
import { plateSvg } from '../ui/plates.js';

const LINE_MS = 140;
const BANDS = 12;
const BAND_MS = 75;
const FADE_MS = 700;

export function mount(stageEl, scene, { run, onComplete }) {
  preloadTypewriterTick();
  const { npc, numeral } = scene;
  const key = npc.npc.toLowerCase();
  const npcClass = CLASSES[npc.npcClass] ? npc.npcClass : null;

  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-marker is-loading';
  if (npcClass) screen.style.setProperty('--npc-cls', classColor(npcClass));
  const page = document.createElement('div');
  page.className = 'dx-marker__page';
  screen.appendChild(page);

  const add = (parent, cls, text, tag = 'p') => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    parent.appendChild(el);
    return el;
  };

  const head = add(page, 'dx-marker__head', null, 'div');
  add(head, '', 'TRUTH DEBT', 'span');
  add(head, '', 'LAKE ULYSSES', 'span');

  const chapter = add(page, 'dx-marker__chapter', null);
  chapter.append('CHAPTER ');
  add(chapter, 'dx-marker__numeral', numeral, 'span');
  const name = add(page, 'dx-marker__name', npc.npc);

  const plate = add(page, 'dx-marker__plate', null, 'div');
  plate.innerHTML = plateSvg(key);
  plate.style.setProperty('--drawn', '0%');
  const caption = add(page, 'dx-marker__caption', scene.plate ?? '');

  const prose = add(page, 'dx-marker__prose', null);
  const cap = add(prose, 'dx-marker__dropcap', (scene.prose ?? '').charAt(0), 'span');
  const body = add(prose, '', null, 'span');

  const foot = add(page, 'dx-marker__foot', null, 'div');
  add(foot, 'dx-marker__folio', String(scene.folio ?? ''), 'span');

  // Everything waits to be printed.
  const lines = [head, chapter, name, plate, caption, cap, foot];
  lines.forEach((el) => el.classList.add('is-unprinted'));

  stageEl.appendChild(screen);
  // Fogged: the page comes up warm, the room muffled and cozy.
  const fogged = isFogged(run.get());
  if (fogged) screen.classList.add('is-fogged');
  const stopAmbience = startOpenerAmbience(npc.npc, { fogged });

  // The load: one step at a time, each with its bleep.
  let step = 0;
  let timer = null;
  let typewriter = null;
  let loaded = false;
  let leaving = false;
  let fadeTimer = null;
  let theme = null;
  const print = (el, data = false) => {
    el.classList.remove('is-unprinted');
    el.classList.add('is-printed');
    playClassBleep(npcClass, step++, { data });
  };
  const typeProse = () => {
    typewriter = createTypewriter(body, (scene.prose ?? '').slice(1), {
      onChar: playTypewriterTick,
      onePage: true,
      onDone: done,
    });
  };
  const done = () => {
    loaded = true;
    screen.classList.remove('is-loading');
  };
  // [step, how long until the next one]
  const sequence = [
    ...[head, chapter, name].map((el) => [() => print(el), LINE_MS]),
    [() => plate.classList.remove('is-unprinted'), BAND_MS],
    ...Array.from({ length: BANDS }, (_, i) => [() => {
      plate.style.setProperty('--drawn', `${Math.round(((i + 1) / BANDS) * 100)}%`);
      playClassBleep(npcClass, step++, { data: true });
    }, i < BANDS - 1 ? BAND_MS : LINE_MS]),
    [() => { theme = playOpenerTheme(npc.npc); print(caption); }, LINE_MS],
    [() => print(cap), LINE_MS],
    [() => { print(foot); typeProse(); }, 0],
  ];
  const next = () => {
    const entry = sequence.shift();
    if (!entry) return;
    const [fn, ms] = entry;
    fn();
    if (sequence.length) timer = later(next, ms);
  };
  timer = later(next, 450);

  const finishLoading = () => {
    cancelLater(timer);
    sequence.length = 0;
    lines.forEach((el) => el.classList.remove('is-unprinted'));
    plate.style.setProperty('--drawn', '100%');
    if (!typewriter) typeProse();
    typewriter.finish();
    done();
  };

  screen.addEventListener('click', () => {
    if (leaving) return;
    if (!loaded || !typewriter?.isDone()) { finishLoading(); return; }
    leaving = true;
    screen.classList.add('is-fading');
    stopAmbience(FADE_MS / 1000);
    theme?.stop(FADE_MS / 1000);
    fadeTimer = later(onComplete, FADE_MS);
  });

  return function unmount() {
    leaving = true;
    [timer, fadeTimer].forEach(cancelLater);
    typewriter?.destroy();
    theme?.stop(0.2);
    stopAmbience(0.3);
    stageEl.innerHTML = '';
  };
}
