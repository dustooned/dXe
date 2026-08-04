// Scene type: 'minigame'. Lazy-loads a mini-game module and delegates the
// scene-handler contract to it — this wrapper, and the sequencer above it,
// never know how any individual game works. See docs/SCENE_TYPES.md for
// the design philosophy (can't-lose pacing beats, no stat-effect contract)
// and the authoring contract for the loaded module.
//
// scene shape: { type: 'minigame', id, load: () => import('./minigames/x.js') }

export function mount(stageEl, scene, context) {
  let unmountLoaded = null;
  let cancelled = false;

  // A mini-game's own module is lazy-loaded (see file header) specifically so
  // it can own a heavy canvas/asset footprint without bloating the chapter's
  // initial bundle. That import is occasionally slow enough to need feedback —
  // this spinner is deliberately separate from the boot preloader's, so this
  // file never has to touch main.js's already-stabilized boot sequence.
  const screen = document.createElement('div');
  screen.className = 'dx-screen dx-minigame-loading';
  screen.innerHTML = '<div class="dx-minigame-spinner"></div>';
  stageEl.appendChild(screen);

  scene.load().then((mod) => {
    if (cancelled) return;
    stageEl.innerHTML = '';
    unmountLoaded = mod.mount(stageEl, scene, context);
  });

  return function unmount() {
    cancelled = true;
    unmountLoaded?.();
    unmountLoaded = null;
    stageEl.innerHTML = '';
  };
}
