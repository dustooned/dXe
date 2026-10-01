// Debug jumps (the DEBUG page in the settings panel, shell/hud.js): pick a
// scene and a starting state, and the chapter restarts right there. The
// state is handed over once, through this module, and the chapter's
// mount() folds it into a fresh run (chapters/lake-ulysses/index.js).
let pending = null;
let jumpFn = null;

// main.js registers how to (re)enter a chapter at a scene.
export function setJumpHandler(fn) {
  jumpFn = fn;
}

// overrides: a partial run state ({ loadout, truthDebt, unlocked, bonds }).
export function jumpTo(chapterId, sceneId, overrides = {}) {
  pending = overrides;
  jumpFn?.(chapterId, sceneId);
}

// The chapter reads this once as it builds its run.
export function takeDebugOverrides() {
  const o = pending;
  pending = null;
  return o ?? {};
}
