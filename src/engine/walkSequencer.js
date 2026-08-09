// Runs a mini-game's internal STEPS list — a second, smaller sequencer nested
// inside the chapter's scene sequencer, the same way cutsceneScene sequences
// its own beats. See docs/SCENE_TYPES.md.
//
// Two step types:
//   { type: 'walk',    rooms: [roomId, ...], roomsById: {...} }
//   { type: 'gimmick', prompt, response | target, timeoutMs? }
//
// When STEPS runs out it calls onComplete() — which the mini-game module wires
// straight to the CHAPTER's onComplete, so finishing hands control back to the
// scene sequencer and the next scene (the NPC encounter) mounts.
//
// There is deliberately no result payload: a mini-game finishing means "the
// player reached B," nothing more.
import { createWalkRoom } from '../ui/walkRoom.js';
import { createQuickBeat } from '../ui/quickBeat.js';

export function createWalkSequencer({ steps, stageEl, loadout, onComplete }) {
  let index = 0;
  let current = null; // { destroy() }

  function clearCurrent() {
    current?.destroy();
    current = null;
    stageEl.innerHTML = '';
  }

  function advanceStep() {
    index += 1;
    render();
  }

  function renderRoom(step, roomId) {
    clearCurrent();
    const room = step.roomsById[roomId];
    if (!room) { advanceStep(); return; }

    const view = createWalkRoom(room, {
      loadout,
      onAdvance: (nextRoomId) => {
        // A room whose advance points nowhere is the end of this walk step.
        if (nextRoomId && step.roomsById[nextRoomId]) renderRoom(step, nextRoomId);
        else advanceStep();
      },
    });
    current = view;
    stageEl.appendChild(view.el);
  }

  function render() {
    const step = steps[index];
    if (!step) { clearCurrent(); onComplete(); return; }

    if (step.type === 'walk') {
      renderRoom(step, step.rooms[0]);
      return;
    }

    if (step.type === 'gimmick') {
      clearCurrent();
      const beat = createQuickBeat(step, { onDone: advanceStep });
      current = beat;
      stageEl.appendChild(beat.el);
      return;
    }

    throw new Error(`Unknown mini-game step type "${step.type}"`);
  }

  return {
    start() { render(); },
    destroy() { clearCurrent(); },
  };
}
