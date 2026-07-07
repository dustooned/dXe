// Scene type: 'dialog'. Runs one NPC's node graph (FEELZ pick -> swipe ->
// reaction -> next node) to completion, then hands control back to the
// sequencer. See docs/SCENE_TYPES.md for the full contract.
//
// scene shape: { type: 'dialog', id: string, npc: <NPC content JSON> }
import { resolveCard } from '../engine/cardEngine.js';
import { checkBloomTriggers } from '../engine/debtEngine.js';
import { createMeterGroup } from '../ui/meterBar.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzWheel } from '../ui/feelzWheel.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createDebtSigil } from '../ui/debtSigil.js';

const REACTION_DELAY_MS = 2200;

export function mount(stageEl, scene, { run, onComplete }) {
  const { npc } = scene;
  let currentNodeId = Object.keys(npc.nodes)[0];
  let activeEmotion = null;
  let pendingReaction = null;
  let reactionTimer = null;

  function currentNode() {
    return npc.nodes[currentNodeId];
  }

  function render() {
    const runState = run.get();
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-game-screen';

    screen.appendChild(createMeterGroup(runState).el);

    const portrait = createNpcPortrait(npc.npc, npc.accentColor);
    screen.appendChild(portrait.el);
    screen.appendChild(portrait.nameplate);

    if (pendingReaction) {
      const reaction = document.createElement('p');
      reaction.className = 'dx-text dx-reaction';
      reaction.textContent = pendingReaction.npcReaction;
      screen.appendChild(reaction);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      screen.appendChild(tapHint);

      screen.addEventListener('click', () => continueAfterReaction(), { once: true });
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'dx-text';
      prompt.textContent = currentNode().prompt;
      screen.appendChild(prompt);

      const card = createSwipeCard({
        promptText: activeEmotion ? 'Drag to respond.' : 'Pick a feeling first.',
        onSwipe: (key) => {
          if (!activeEmotion) return;
          handleSwipe(key);
        },
      });
      screen.appendChild(card.el);

      const wheel = createFeelzWheel({
        options: currentNode().feelzOptions,
        onSelect: (emotion) => {
          activeEmotion = emotion;
          render();
        },
      });
      screen.appendChild(wheel.el);
    }

    screen.appendChild(createDebtSigil(runState.truthDebt).el);
    stageEl.appendChild(screen);
  }

  function handleSwipe(swipeKey) {
    const { edge, patch } = resolveCard(run.get(), currentNode(), swipeKey);
    run.set(patch);
    pendingReaction = edge;
    render();
    reactionTimer = setTimeout(continueAfterReaction, REACTION_DELAY_MS);
  }

  function continueAfterReaction() {
    clearTimeout(reactionTimer);
    if (!pendingReaction) return;
    const edge = pendingReaction;
    pendingReaction = null;
    advance(edge);
  }

  function advance(edge) {
    const bloom = checkBloomTriggers(run.get());
    run.set(bloom.patch);

    if (run.get().truthDebt >= 10) {
      onComplete({ jumpTo: 'reckoning' });
      return;
    }

    if (edge.nextNodeId) {
      currentNodeId = edge.nextNodeId;
      activeEmotion = null;
      render();
      return;
    }

    onComplete();
  }

  render();

  return function unmount() {
    clearTimeout(reactionTimer);
    stageEl.innerHTML = '';
  };
}
