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
// player reached B," nothing more. The one thing a room leaves on the run is
// a restore (onRestore), which unlocks that NPC's secret opener.
import { createWalkRoom } from '../ui/walkRoom.js';
import { createQuickBeat } from '../ui/quickBeat.js';
import { moodFor } from './loadout.js';

// isRestored/onRestore: whether this player's class has already restored
// something in these rooms, and what to do when they do (walkRoom.js).
export function createWalkSequencer({ steps, stageEl, loadout, onComplete, isRestored = () => false, onRestore }) {
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
      restored: isRestored(),
      onRestore,
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

// The whole mount for an NPC's walk (minigames/*.js): each hotspot's glow is
// its opener's first feeling for this player's class (scene.npc, the NPC the
// room leads to; hotspot.opener names the node), and a restore writes
// run.secrets[secretKey], which their confrontation reads.
export function mountNpcWalk(stageEl, scene, { run, onComplete }, { steps, secretKey }) {
  const loadout = run.get().loadout;
  const nodes = scene.npc?.nodes ?? {};
  const withMoods = (room) => ({
    ...room,
    npcClass: room.npcClass ?? scene.npc?.npcClass,
    hotspots: room.hotspots.map((spot) => ({ ...spot, mood: spot.opener ? moodFor(nodes[spot.opener], loadout) : null })),
  });
  const resolved = steps.map((step) => (step.type === 'walk'
    ? { ...step, roomsById: Object.fromEntries(Object.entries(step.roomsById).map(([k, r]) => [k, withMoods(r)])) }
    : step));
  const sequencer = createWalkSequencer({
    steps: resolved,
    stageEl,
    loadout,
    onComplete,
    isRestored: () => !!run.get().secrets?.[secretKey],
    onRestore: () => run.set({ secrets: { ...run.get().secrets, [secretKey]: true } }),
  });
  sequencer.start();
  return function unmount() {
    sequencer.destroy();
  };
}
