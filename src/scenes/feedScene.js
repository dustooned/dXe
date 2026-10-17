// The FEELZ feed (Phase 11 step 5): the app's first screen is a stack of
// live channels that all run at once on one clock. Like a phone feed, the
// channels are stacked: drag up and the next one follows your finger in from
// below, and every few seconds the screen bounces up to show the top of the
// next one, a hint to pull (on the first run until every channel is found,
// after that until you've flipped once). The arrows (mouse only), the
// keyboard and the mouse wheel flip too. A channel you left kept going, so you
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
import { lakeMarks } from '../engine/firstMarks.js';
import { quoteSpeech } from '../ui/speech.js';
import { loadSettings, updateSettings } from '../shell/settings.js';
import { later, cancelLater } from '../shell/pauseBus.js';
import { timeline, beatAt } from '../engine/feedClock.js';
import { playSfx, playTypewriterTick, preloadTypewriterTick, startAmbient, stopAmbient } from '../shell/audio.js';

const TICK_MS = 100;
const COMMENT_GAP_MS = 900;
const COMMENTS_SHOWN = 5;
const FLIP_PX = 70;       // a pull past this (or a quick flick) flips
const FLICK_SPEED = 0.5;  // px per ms
const SLIDE_MS = 220;
const HINT_FIRST_MS = 1800;
const HINT_EVERY_MS = 5200;
const HINT_MS = 1100;     // the bounce (CSS dx-feed-hint)

// The rail's numbers: a channel's likes are made up but steady (from its id).
const baseLikes = (id) => [...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9000, 7) + 140;
const countText = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
// A speech bubble in pixels for the chat button.
const CHAT_ICON = '<svg viewBox="0 0 8 7" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="6" height="1"/><rect x="0" y="1" width="8" height="3"/><rect x="1" y="4" width="6" height="1"/><rect x="2" y="5" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/></svg>';

const ART = {
  feelzSilhouette: () => createFeelzSilhouette(),
  lakeGauge: ({ run }) => createLakeGauge(run.get().truthDebt ?? 0, { marks: lakeMarks(run.get()) }),
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
  const liked = new Set();
  let clock = 0;
  let cur = 0;
  let shownBeat = -1;
  let shownComments = '';
  let typewriter = null;
  let animators = [];
  const animFrames = {};
  let tickTimer = null;
  let toastTimer = null;
  let hintTimer = null;
  let slideTimer = null;
  let sliding = false;
  let flipped = false;
  let wheelAt = 0;
  let dom = null;
  let unmounted = false;
  const reduced = () => document.documentElement.classList.contains('is-reduced-effects');

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

  // The picture of a channel next door: a still of where its art is now,
  // its header, and a label on the edge that shows.
  function buildPeek(i, dir) {
    const ch = channels[i];
    const peek = document.createElement('div');
    peek.className = `dx-feed__peek dx-feed__peek--${dir > 0 ? 'next' : 'prev'}`;
    peek.setAttribute('aria-hidden', 'true');
    const still = (key, cls) => {
      const cfg = scene.anims?.[key];
      if (!cfg) return;
      const img = document.createElement('img');
      img.className = cls;
      img.alt = '';
      // One frame and done: the animator sets the src as it starts.
      createSpriteAnimator(img, cfg, animFrames[key] ?? 0).destroy();
      peek.appendChild(img);
    };
    if (ch.bgAnim) still(ch.bgAnim, 'dx-cutscene-bg');
    else if (ch.image) {
      const bg = document.createElement('img');
      bg.className = 'dx-cutscene-bg dx-feed__still';
      bg.src = ch.image;
      bg.alt = '';
      peek.appendChild(bg);
    } else {
      const card = document.createElement('p');
      card.className = 'dx-feed__card';
      card.textContent = ch.name;
      peek.appendChild(card);
    }
    if (ch.spriteAnim) still(ch.spriteAnim, 'dx-cutscene-sprite');
    const label = document.createElement('p');
    label.className = 'dx-feed__peek-label';
    // The same pieces as the channel's header, so the peek reads as the top
    // of that channel: its tag, its name, its number (and what's left to find).
    label.innerHTML = '<span class="dx-feed__tag"></span><span class="dx-feed__name"></span><span class="dx-feed__more"></span><span class="dx-feed__ch"></span>';
    label.querySelector('.dx-feed__tag').textContent = ch.tag;
    label.querySelector('.dx-feed__name').textContent = ch.name;
    label.querySelector('.dx-feed__ch').textContent = `CH ${i + 1}/${channels.length}`;
    peek.appendChild(label);
    return peek;
  }

  // The channel's frame: picture, header, comments, scrubber, flip arrows,
  // between the peeks of the channels above and below.
  function buildChannel() {
    destroyAnimators();
    typewriter?.destroy();
    typewriter = null;
    cancelLater(hintTimer);
    stageEl.innerHTML = '';
    shownBeat = -1;
    shownComments = '';
    sliding = false;
    const ch = channels[cur];

    const view = document.createElement('div');
    view.className = 'dx-feed-view';
    const mover = document.createElement('div');
    mover.className = 'dx-feed-mover';
    const n = channels.length;
    const nextPeek = buildPeek((cur + 1) % n, 1);
    mover.append(buildPeek((cur - 1 + n) % n, -1), nextPeek);
    view.appendChild(mover);

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

    // The rail, right side like a feed's: like the channel (♥ and its count),
    // and the chat button, which hides or shows the comments (remembered,
    // settings.feedChat) and shows how many there are.
    const rail = document.createElement('div');
    rail.className = 'dx-feed__rail';
    const railBtn = (cls, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dx-feed__rail-btn ${cls}`;
      b.setAttribute('aria-label', label);
      b.innerHTML = '<span class="dx-feed__rail-icon"></span><span class="dx-feed__rail-n"></span>';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      rail.appendChild(b);
      return b;
    };
    const like = railBtn('dx-feed__like', `Like ${ch.name}`);
    like.querySelector('.dx-feed__rail-icon').textContent = '♥';
    const syncLike = () => {
      const on = liked.has(ch.id);
      like.classList.toggle('is-on', on);
      like.querySelector('.dx-feed__rail-n').textContent = countText(baseLikes(ch.id) + (on ? 1 : 0));
    };
    like.addEventListener('click', (e) => {
      e.stopPropagation();
      if (liked.has(ch.id)) liked.delete(ch.id); else liked.add(ch.id);
      syncLike();
      playSfx('tap');
    });
    syncLike();
    const chat = railBtn('dx-feed__chat', 'Show or hide the chat');
    chat.querySelector('.dx-feed__rail-icon').innerHTML = CHAT_ICON;
    chat.querySelector('.dx-feed__rail-n').textContent = String(ch.beats.reduce((n, b) => n + (b.comments?.length ?? 0), 0));
    const syncChat = () => {
      const on = loadSettings().feedChat !== false;
      screen.classList.toggle('is-chat-off', !on);
      chat.classList.toggle('is-on', on);
      chat.setAttribute('aria-pressed', String(on));
    };
    chat.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSettings({ feedChat: loadSettings().feedChat === false });
      syncChat();
      playSfx('tap');
    });
    syncChat();
    screen.appendChild(rail);

    const flip = document.createElement('div');
    flip.className = 'dx-feed__flip';
    flip.innerHTML = '<button type="button" class="dx-feed__flip-btn" data-dir="-1" aria-label="Previous channel">▲</button><button type="button" class="dx-feed__flip-btn" data-dir="1" aria-label="Next channel">▼</button>';
    flip.querySelectorAll('button').forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); slide(Number(b.dataset.dir)); });
    });
    screen.appendChild(flip);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dx-btn dx-feed__close';
    close.textContent = 'CLOSE APP ▶';
    close.hidden = !canClose();
    close.addEventListener('pointerdown', (e) => e.stopPropagation());
    close.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
    screen.appendChild(close);

    // Unvisited channels, the first time through: a count on the next peek.
    const left = nextPeek.querySelector('.dx-feed__more');

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

    mover.insertBefore(screen, nextPeek);
    stageEl.appendChild(view);
    dom = { view, mover, screen, scrub, comments, close, left, speaker, text, textBox, toast, beatEls: [] };
    attachSwipe(screen);
    update({ jump: true });
    hintTimer = later(hint, HINT_FIRST_MS);
  }

  // The bounce: the screen lifts to show the top of the next channel and
  // settles back. Until you've flipped (first run: until all are found).
  function wantsHint() {
    return firstRound ? !allVisited() : !flipped;
  }
  function hint() {
    if (!dom || unmounted || !wantsHint()) return;
    if (!sliding && !reduced()) {
      dom.mover.classList.remove('is-hinting');
      void dom.mover.offsetWidth; // restart the animation
      dom.mover.classList.add('is-hinting');
      later(() => dom?.mover.classList.remove('is-hinting'), HINT_MS);
    }
    hintTimer = later(hint, HINT_EVERY_MS);
  }

  // Slide to the channel above or below, then rebuild on it. From wherever
  // a drag left the stack, or from rest (arrows, keys, the wheel, the skip).
  function slide(dir) {
    if (!dom || sliding) return;
    if (reduced()) { flipBy(dir); return; }
    sliding = true;
    dom.mover.classList.remove('is-hinting');
    dom.mover.style.transition = `transform ${SLIDE_MS}ms ease-in`;
    dom.mover.style.transform = `translateY(${dir > 0 ? -100 : 100}%)`;
    playSfx('flip');
    cancelLater(slideTimer);
    slideTimer = later(() => flipBy(dir, { quiet: true }), SLIDE_MS);
  }

  // The stack follows a vertical drag; let go past FLIP_PX (or flick) and it
  // goes, short of it and it springs back. A tap finishes the line typing.
  function attachSwipe(el) {
    let start = null;
    let dragging = false;
    const move = (dy) => { dom.mover.style.transform = `translateY(${dy}px)`; };
    el.addEventListener('pointerdown', (e) => {
      if (sliding) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      dragging = false;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!start || !dom) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging && Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        dragging = true;
        dom.mover.classList.remove('is-hinting');
        dom.mover.style.transition = 'none';
      }
      if (dragging) move(dy);
    });
    const end = (e, cancelled) => {
      if (!start || !dom) return;
      const dy = e.clientY - start.y;
      const speed = dy / Math.max(1, performance.now() - start.t);
      const wasDrag = dragging;
      start = null;
      dragging = false;
      if (!wasDrag) {
        if (!cancelled && typewriter && !typewriter.isDone()) typewriter.finish();
        return;
      }
      if (!cancelled && (Math.abs(dy) > FLIP_PX || Math.abs(speed) > FLICK_SPEED)) { slide(dy < 0 ? 1 : -1); return; }
      // Not far enough: back into place, with a little overshoot.
      dom.mover.style.transition = 'transform 260ms cubic-bezier(0.2, 1.5, 0.4, 1)';
      dom.mover.style.transform = '';
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
  }

  function flipBy(dir, { quiet = false } = {}) {
    flipped = true;
    cur = (cur + dir + channels.length) % channels.length;
    const fresh = !visited.has(cur);
    visited.add(cur);
    if (!quiet) playSfx('flip');
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
      // Who's posting, as a handle: BOB BAITER -> @bob_baiter.
      dom.speaker.textContent = beat.speaker ? `@${beat.speaker.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}` : '';
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
    dom.left.textContent = firstRound && unseen > 0 ? `${unseen} MORE` : '';
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
    const steps = (next - cur + channels.length) % channels.length;
    if (steps === 1) slide(1);
    else flipBy(steps);
  });

  const onKey = (e) => {
    if (!dom) return;
    if (e.key === 'ArrowDown') slide(1);
    else if (e.key === 'ArrowUp') slide(-1);
  };
  window.addEventListener('keydown', onKey);
  // A mouse wheel or trackpad: one flip per gesture.
  const onWheel = (e) => {
    if (!dom || Math.abs(e.deltaY) < 30) return;
    const now = performance.now();
    if (now - wheelAt < 600) return;
    wheelAt = now;
    slide(e.deltaY > 0 ? 1 : -1);
  };
  stageEl.addEventListener('wheel', onWheel, { passive: true });

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
    cancelLater(hintTimer);
    cancelLater(slideTimer);
    window.removeEventListener('keydown', onKey);
    stageEl.removeEventListener('wheel', onWheel);
    destroyAnimators();
    typewriter?.destroy();
    if (scene.ambient) stopAmbient();
    stageEl.innerHTML = '';
    dom = null;
  };
}
