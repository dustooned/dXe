// Runs a chapter's scene list. Each scene has a `type`; `handlers[type]` is a
// module exposing `mount(stageEl, scene, context) -> unmount`. The sequencer
// doesn't know or care what a scene renders — dialog, cutscene, mini-game,
// whatever — it only manages "what's current" and "what's next."
//
// A scene finishes by calling `context.onComplete(result)`:
//   - onComplete()                    -> advance to the next scene in order
//   - onComplete({ jumpTo: 'someId' }) -> jump to the scene with that id
//     (used for early exits, e.g. Truth Debt maxing out mid-NPC and forcing
//     the Reckoning regardless of which dialog scene is active)
//
// Fast-forward (shell/hud.js's icon) is deliberately the same exit a scene
// would use on its own — skip() just calls handleComplete() early, the exact
// function the scene's own onComplete would have called. Only scene types
// with no real choice in them are skippable: a cutscene has none (any
// confrontation's opener choice is decorative in the sense that not making
// it just means the encounter opens on its default node), and a mini-game
// walk-room's own contract (docs/SCENE_TYPES.md) is already "reaching the
// end means nothing but that" — no stat effect exists to skip past. Dialog
// (the actual FEELZ/swipe encounter), questionnaire, reckoning and ending
// are excluded on purpose: those are the game.
const SKIPPABLE_TYPES = new Set(['cutscene', 'minigame']);

export function createSceneSequencer({ scenes, handlers, context, transitionFn, startSceneId, onSceneChange }) {
  let index = 0;
  if (startSceneId) {
    const i = scenes.findIndex((s) => s.id === startSceneId);
    if (i >= 0) index = i;
  }
  let stageEl = null;
  let unmountCurrent = null;

  function findIndexById(id) {
    return scenes.findIndex((s) => s.id === id);
  }

  function renderCurrent() {
    unmountCurrent?.();
    unmountCurrent = null;

    const scene = scenes[index];
    if (!scene) return;
    onSceneChange?.(scene);

    const handler = handlers[scene.type];
    if (!handler) {
      throw new Error(`No scene handler registered for type "${scene.type}"`);
    }

    unmountCurrent = handler.mount(stageEl, scene, { ...context, onComplete: handleComplete });
  }

  function handleComplete(result) {
    if (result?.jumpTo) {
      const target = findIndexById(result.jumpTo);
      index = target >= 0 ? target : index + 1;
    } else {
      index += 1;
    }
    if (transitionFn && scenes[index]) {
      unmountCurrent?.();
      unmountCurrent = null;
      stageEl.innerHTML = '';
      transitionFn(stageEl, renderCurrent);
    } else {
      renderCurrent();
    }
  }

  function isSkippable() {
    return SKIPPABLE_TYPES.has(scenes[index]?.type);
  }

  return {
    mount(el) {
      stageEl = el;
      renderCurrent();
    },
    unmount() {
      unmountCurrent?.();
      unmountCurrent = null;
    },
    isSkippable,
    skip() {
      if (isSkippable()) handleComplete();
    },
  };
}
