// The FEELZ feed (Phase 11 step 5): the app's first screen is a stack of
// live channels that all run at once on one clock. Swipe up/down (or the
// arrows, or the keyboard) to flip; a channel you left kept going, so you
// come back to wherever it is now. Each channel has its own scrubber to drag
// back to what you missed, or ahead. Comments scroll up the lower left; tap
// one to heart it.
//
// First time through the chapter, CLOSE APP only appears once every channel
// has been visited (just landed on, not watched), and the game says so. The
// HUD skip on that first run flips to the next channel you haven't seen;
// after that (or on a repeat run) it leaves, as usual.
//
// scene: {
//   anims,                      sprite animations by key (chapter anims.js)
//   ambient?,                   room sound for the whole feed
//   channels: [{
//     id, name, tag,            'BOB BAITER', '● LIVE' | 'AD' | 'DOC'
//     bgAnim?, image?, art?,    the picture: an animation, an image, or a
//                               built-in art key ('feelzSilhouette')
//     spriteAnim?,              who's on screen
//     beats: [{ text, speaker?, symbolAnim?, art?, holdMs?, autoAdvanceMs?,
//               comments?: [{ who, text }] }]
//   }]
// }
// A beat is on screen for its reading time (holdMs, else autoAdvanceMs, else
// worked out from its length and the TEXT SPEED setting).
import { createTypewriter } from '../ui/typewriterText.js';
import { createSpriteAnimator } from '../ui/spriteAnimator.js';
import { createFeelzSilhouette } from '../ui/feelzSilhouette.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { quoteSpeech } from '../ui/speech.js';
import { loadSettings } from '../shell/settings.js';
import { later, cancelLater } from '../shell/pauseBus.js';
import { timeline, beatAt } from '../engine/feedClock.js';
import { playSfx, playTypewriterTick, preloadTypewriterTick, startAmbient, stopAmbient } from '../shell/audio.js';

const TICK_MS = 100;
const COMMENT_GAP_MS = 900;
const COMMENTS_SHOWN = 5;
const FLIP_PX = 50;

const ART = {
  feelzSilhouette: () => createFeelzSilhouette(),
  lakeGauge: ({ run }) => createLakeGauge(run.get().truthDebt ?? 0),
};

export function mount(stageEl, scene, { run, onComplete, exit, setSkipHandler }) {
  preloadTypewriterTick();
  const speed = loadSettings().textSpeed ?? 'normal';
  // The morning-after feed (scene.epilogue) picks its channels from the run.
  const list = typeof scene.channels === 'function' ? scene.channels(run.get()) : scene.channels;
  const channels = list.map((ch) => ({ ...ch, ...timeline(ch, speed) }));
  // Visiting every channel is the opening's first-run rule only.
  const firstRound = !run.get().repeat && !scene.epilogue;
  const handle = run.get().handle ?? 'you';
  const visited = new Set([0]);
  const offsets = channels.map(() => 0);
  const hearts = new Set();
  let clock = 0;
  let cur = 0;
  let shownBeat = -1;
  let shownComments = '';
  let typewriter = null;
  let animators = [];
  const animFrames = {};
  let tickTimer = null;
  let toastTimer = null;
  let dom = null;
  let unmounted = false;

  const posOf = (i) => Math.max(0, Math.min(channels[i].length, clock + offsets[i]));
  const allVisited = () => visited.size === channels.length;
  const canClose = () => !firstRound || allVisited();
  const fill = (text) => String(text ?? '').replaceAll('{handle}', handle);

  function destroyAnimators() {
    for (const { key, animator } of animators) { animFrames[key] = animator.currentFrame; animator.destroy(); }
    animators = [];
  }
  function attachAnim(el, key) {
    const cfg = scene.anims?.[key];
    if (!cfg) return;
    animators.push({ key, animator: createSpriteAnimator(el, cfg, animFrames[key] ?? 0) });
  }

  // The channel's frame: picture, header, comments, scrubber, flip arrows.
  function buildChannel() {
    destroyAnimators();
    typewriter?.destroy();
    typewriter = null;
    stageEl.innerHTML = '';
    shownBeat = -1;
    shownComments = '';
    const ch = channels[cur];

    const screen = document.createElement('div');
    screen.className = `dx-screen dx-cutscene-screen dx-feed dx-feed--${ch.id}`;
    if (ch.bgAnim) {
      const bg = document.createElement('img');
      bg.className = 'dx-cutscene-bg';
      bg.alt = '';
      screen.appendChild(bg);
      attachAnim(bg, ch.bgAnim);
    } else if (ch.image) {
      const bg = document.createElement('img');
      bg.className = 'dx-cutscene-bg dx-feed__still';
      bg.src = ch.image;
      bg.alt = '';
      screen.appendChild(bg);
    }
    if (!ch.bgAnim && !ch.image && !ch.art) {
      // No picture yet: the channel's name on black (PLACEHOLDER until art).
      const card = document.createElement('p');
      card.className = 'dx-feed__card';
      card.textContent = ch.name;
      screen.appendChild(card);
    }
    if (ch.art && ART[ch.art]) {
      const el = ART[ch.art]({ run }).el;
      el.classList.add('dx-feed__art');
      screen.appendChild(el);
    }
    if (ch.spriteAnim) {
      const spr = document.createElement('img');
      spr.className = 'dx-cutscene-sprite';
      spr.alt = '';
      screen.appendChild(spr);
      attachAnim(spr, ch.spriteAnim);
    }

    const head = document.createElement('div');
    head.className = 'dx-feed__head';
    head.innerHTML = '<span class="dx-feed__tag"></span><span class="dx-feed__name"></span><span class="dx-feed__ch"></span>';
    head.querySelector('.dx-feed__tag').textContent = ch.tag;
    head.querySelector('.dx-feed__name').textContent = ch.name;
    head.querySelector('.dx-feed__ch').textContent = `CH ${cur + 1}/${channels.length}`;
    screen.appendChild(head);

    const scrub = document.createElement('input');
    scrub.type = 'range';
    scrub.className = 'dx-feed__scrub';
    scrub.min = '0';
    scrub.max = String(ch.length);
    scrub.step = '100';
    scrub.setAttribute('aria-label', `${ch.name} timeline`);
    scrub.addEventListener('pointerdown', (e) => e.stopPropagation());
    scrub.addEventListener('input', () => {
      offsets[cur] = Number(scrub.value) - clock;
      shownBeat = -1;
      update({ jump: true });
    });
    screen.appendChild(scrub);

    const comments = document.createElement('div');
    comments.className = 'dx-feed__comments';
    screen.appendChild(comments);

    const flip = document.createElement('div');
    flip.className = 'dx-feed__flip';
    flip.innerHTML = '<button type="button" class="dx-feed__flip-btn" data-dir="-1" aria-label="Previous channel">▲</button><button type="button" class="dx-feed__flip-btn" data-dir="1" aria-label="Next channel">▼</button>';
    flip.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); flipBy(Number(b.dataset.dir)); }));
    screen.appendChild(flip);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dx-btn dx-feed__close';
    close.textContent = 'CLOSE APP ▶';
    close.hidden = !canClose();
    close.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    screen.appendChild(close);

    // Unvisited channels, the first time through: a small count by the arrows.
    const left = document.createElement('p');
    left.className = 'dx-feed__left';
    screen.appendChild(left);

    const textBox = document.createElement('div');
    textBox.className = 'dx-cutscene-textbox dx-feed__textbox';
    const speaker = document.createElement('p');
    speaker.className = 'dx-cutscene-speaker';
    const text = document.createElement('p');
    text.className = 'dx-text dx-cutscene-text';
    textBox.append(speaker, text);
    screen.appendChild(textBox);

    const toast = document.createElement('p');
    toast.className = 'dx-feed__toast';
    toast.hidden = true;
    screen.appendChild(toast);

    stageEl.appendChild(screen);
    dom = { screen, scrub, comments, close, left, speaker, text, textBox, toast, beatEls: [] };
    attachSwipe(screen);
    update({ jump: true });
  }

  // Vertical swipe flips; a tap finishes the line being typed.
  function attachSwipe(el) {
    let start = null;
    el.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dy) > FLIP_PX && Math.abs(dy) > Math.abs(dx)) flipBy(dy < 0 ? 1 : -1);
      else if (typewriter && !typewriter.isDone()) typewriter.finish();
    });
  }

  function flipBy(dir) {
    cur = (cur + dir + channels.length) % channels.length;
    const fresh = !visited.has(cur);
    visited.add(cur);
    playSfx('flip');
    buildChannel();
    if (fresh && firstRound && allVisited()) {
      showToast(`ALL ${channels.length} CHANNELS FOUND`);
    }
  }

  function showToast(text) {
    if (!dom) return;
    dom.toast.textContent = text;
    dom.toast.hidden = false;
    playSfx('ping');
    cancelLater(toastTimer);
    toastTimer = later(() => { if (dom) dom.toast.hidden = true; }, 2600);
  }

  // The current channel at its current time: the beat, its comments, the bar.
  function update({ jump = false } = {}) {
    if (!dom || unmounted) return;
    const ch = channels[cur];
    const pos = posOf(cur);
    const i = beatAt(ch.starts, pos);
    const beat = ch.beats[i];
    const ended = pos >= ch.length;
    dom.screen.classList.toggle('is-ended', ended);
    if (i !== shownBeat) {
      shownBeat = i;
      typewriter?.destroy();
      dom.speaker.textContent = beat.speaker ?? '';
      dom.speaker.hidden = !beat.speaker;
      const said = beat.speaker ? quoteSpeech(fill(beat.text)) : fill(beat.text);
      typewriter = createTypewriter(dom.text, said, { onChar: playTypewriterTick });
      // Landing mid-beat (a flip, a scrub): the line is already there.
      if (jump || pos - ch.starts[i] > 400) typewriter.finish();
      // A beat's symbol and art sit straight on the screen, so the cutscene
      // styles for them apply (.dx-cutscene-screen > .dx-lake).
      dom.beatEls.forEach((el) => el.remove());
      dom.beatEls = [];
      if (beat.symbolAnim) {
        const sym = document.createElement('img');
        sym.className = 'dx-cutscene-symbol';
        sym.alt = '';
        dom.screen.insertBefore(sym, dom.textBox);
        attachAnim(sym, beat.symbolAnim);
        dom.beatEls.push(sym);
      }
      if (beat.art && ART[beat.art]) {
        const art = ART[beat.art]({ run }).el;
        dom.screen.insertBefore(art, dom.textBox);
        dom.beatEls.push(art);
      }
    }
    // Comments up to now: each beat's arrive one after another as it plays.
    const list = [];
    ch.beats.forEach((b, bi) => (b.comments ?? []).forEach((c, ci) => {
      const at = ch.starts[bi] + (ci + 1) * COMMENT_GAP_MS;
      if (at <= pos) list.push({ key: `${ch.id}:${bi}:${ci}`, who: fill(c.who), text: fill(c.text) });
    }));
    const recent = list.slice(-COMMENTS_SHOWN);
    const sig = recent.map((c) => c.key + (hearts.has(c.key) ? '♥' : '')).join('|');
    if (sig !== shownComments) {
      shownComments = sig;
      dom.comments.innerHTML = '';
      for (const c of recent) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `dx-feed__comment${hearts.has(c.key) ? ' is-hearted' : ''}`;
        row.innerHTML = '<span class="dx-feed__who"></span> <span class="dx-feed__said"></span><span class="dx-feed__heart" aria-hidden="true">♥</span>';
        row.querySelector('.dx-feed__who').textContent = `@${c.who}`;
        row.querySelector('.dx-feed__said').textContent = c.text;
        row.setAttribute('aria-label', `Heart @${c.who}: ${c.text}`);
        row.addEventListener('pointerdown', (e) => e.stopPropagation());
        row.addEventListener('pointerup', (e) => e.stopPropagation());
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (hearts.has(c.key)) hearts.delete(c.key); else hearts.add(c.key);
          playSfx('tap');
          shownComments = '';
          update();
        });
        dom.comments.appendChild(row);
      }
    }
    dom.scrub.value = String(pos);
    dom.close.hidden = !canClose();
    const unseen = channels.length - visited.size;
    dom.left.textContent = firstRound && unseen > 0 ? `${unseen} MORE ▼` : '';
  }

  function tick() {
    clock += TICK_MS;
    update();
    tickTimer = later(tick, TICK_MS);
  }

  function finish() {
    if (unmounted) return;
    run.set({ feedHearts: hearts.size });
    if (scene.exitOnClose) exit();
    else onComplete();
  }

  // The HUD skip: first time through, it flips to a channel you haven't seen;
  // once you've seen them all (or on a repeat run) it closes the app.
  setSkipHandler?.(() => {
    if (canClose()) { finish(); return; }
    const next = channels.findIndex((_, i) => !visited.has(i));
    flipBy((next - cur + channels.length) % channels.length);
  });

  const onKey = (e) => {
    if (e.key === 'ArrowDown') flipBy(1);
    else if (e.key === 'ArrowUp') flipBy(-1);
  };
  window.addEventListener('keydown', onKey);

  if (scene.ambient) startAmbient(scene.ambient);
  // An intro card (the morning feed's notification) waits for a tap; the
  // channels' clock starts when it's dismissed.
  if (scene.intro) {
    const card = document.createElement('div');
    card.className = 'dx-screen dx-feed-intro';
    card.innerHTML = '<p class="dx-feed-intro__app"></p><p class="dx-text dx-feed-intro__text"></p><p class="dx-text dx-tap-hint">(tap to open)</p>';
    card.querySelector('.dx-feed-intro__app').textContent = 'FEELZ';
    card.querySelector('.dx-feed-intro__text').textContent = scene.intro;
    card.addEventListener('click', () => { playSfx('ping'); buildChannel(); tickTimer = later(tick, TICK_MS); }, { once: true });
    stageEl.innerHTML = '';
    stageEl.appendChild(card);
    playSfx('vibrate');
  } else {
    buildChannel();
    tickTimer = later(tick, TICK_MS);
  }

  return function unmount() {
    unmounted = true;
    cancelLater(tickTimer);
    cancelLater(toastTimer);
    window.removeEventListener('keydown', onKey);
    destroyAnimators();
    typewriter?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
    dom = null;
  };
}
