// Scene type: 'dialog'. Runs one NPC's node graph (FEELZ pick -> swipe ->
// reaction -> next node) to completion, then hands control back to the
// sequencer. See docs/SCENE_TYPES.md for the full contract.
//
// scene shape: { type: 'dialog', id: string, npc: <NPC content JSON> }
import { resolveCard, resolveGatedNode } from '../engine/cardEngine.js';
import { checkBloomTriggers } from '../engine/debtEngine.js';
import { createMeterGroup } from '../ui/meterBar.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzDartboard } from '../ui/feelzDartboard.js';
import { emotionColor } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createDebtSigil } from '../ui/debtSigil.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';
import * as fx from '../shell/fx.js';
import * as audio from '../shell/audio.js';

const REACTION_DELAY_MS = 2200;

// Weak vs strong hit feedback is derived from how big a swipe's effects
// are, not from truth/lie — intensity signals weight, not judgment.
const STRONG_HIT_THRESHOLD = 8;

export function mount(stageEl, scene, { run, onComplete }) {
  const { npc } = scene;
  let currentNodeId = resolveGatedNode(Object.keys(npc.nodes)[0], npc, run.get());
  let activeEmotion = null;
  let activeEmotionColor = null;
  let pendingReaction = null;
  let reactionEmotion = null;
  let reactionTimer = null;

  function currentNode() {
    return npc.nodes[currentNodeId];
  }

  function enterNode() {
    activeEmotion = null;
    activeEmotionColor = null;
    audio.startEmotionStems();
    audio.ambientMix();
    render();
  }

  function render() {
    const runState = run.get();
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = 'dx-screen dx-game-screen';

    const patternCanvas = document.createElement('canvas');
    patternCanvas.className = 'dx-pattern-bg';
    screen.appendChild(patternCanvas);

    const content = document.createElement('div');
    content.className = 'dx-game-content';
    screen.appendChild(content);

    content.appendChild(createMeterGroup(runState).el);

    const portrait = createNpcPortrait(npc.npc, npc.accentColor);
    content.appendChild(portrait.el);
    content.appendChild(portrait.nameplate);

    if (pendingReaction) {
      const reaction = document.createElement('p');
      reaction.className = 'dx-text dx-reaction';
      reaction.textContent = pendingReaction.npcReaction;
      content.appendChild(reaction);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      content.appendChild(tapHint);

      screen.addEventListener('click', () => continueAfterReaction(), { once: true });
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'dx-text';
      prompt.textContent = currentNode().prompt;
      content.appendChild(prompt);

      const card = createSwipeCard({
        promptText: activeEmotion ? 'Drag to respond.' : 'Pick a feeling first.',
        onSwipe: (key) => {
          if (!activeEmotion) return;
          handleSwipe(key);
        },
      });
      content.appendChild(card.el);

      if (activeEmotionColor) {
        card.setSelectedColor(activeEmotionColor);
      }

      const dartboard = createFeelzDartboard({
        loadout: run.get().loadout,
        dropTarget: card,
        selected: activeEmotion,
        onSelect: (emotion, source) => {
          activeEmotion = emotion;
          activeEmotionColor = source === 'drag' ? emotionColor(emotion) : null;
          audio.emphasizeEmotion(emotion);
          render();
        },
      });
      content.appendChild(dartboard.el);
    }

    content.appendChild(createDebtSigil(runState.truthDebt).el);
    stageEl.appendChild(screen);

    if (pendingReaction) {
      drawEmotionPattern(patternCanvas, {
        seedStr: `${npc.npc}:${currentNodeId}:${reactionEmotion}`,
        key: reactionEmotion,
      });
    }
  }

  function handleSwipe(swipeKey) {
    const { edge, patch } = resolveCard(run.get(), currentNode(), swipeKey, activeEmotion);
    run.set(patch);
    pendingReaction = edge;
    reactionEmotion = activeEmotion;

    const magnitude =
      Object.values(edge.effects || {}).reduce((sum, v) => sum + Math.abs(v), 0) +
      Math.abs(edge.debtDelta || 0);
    const intensity = magnitude >= STRONG_HIT_THRESHOLD ? 'strong' : 'weak';

    fx.flash(intensity);
    fx.shake(intensity);
    audio.playHit(intensity);
    audio.stopEmotionStems();

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
      currentNodeId = resolveGatedNode(edge.nextNodeId, npc, run.get());
      enterNode();
      return;
    }

    onComplete();
  }

  audio.startLeitmotif(npc.npc);
  enterNode();

  return function unmount() {
    clearTimeout(reactionTimer);
    audio.stopEmotionStems();
    audio.stopLeitmotif();
    stageEl.innerHTML = '';
  };
}
