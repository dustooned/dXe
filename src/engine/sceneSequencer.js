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
export function createSceneSequencer({ scenes, handlers, context }) {
  let index = 0;
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
    renderCurrent();
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
  };
}
