// Scene type: 'dialog'. Runs one NPC's node graph (FEELZ pick -> swipe ->
// reaction -> next node) to completion, then hands control back to the
// sequencer. See docs/SCENE_TYPES.md for the full contract.
//
// scene shape: { type: 'dialog', id: string, npc: <NPC content JSON> }
import { resolveCard, resolveGatedNode } from '../engine/cardEngine.js';
import { composeReaction } from '../engine/reactions.js';
import { checkBloomTriggers } from '../engine/debtEngine.js';
import { BLOOM_IT_TEXT } from '../engine/itBlooms.js';
import { emotionLeanText } from '../engine/itEmotionLean.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createItPopup } from '../ui/itPopup.js';
import { createMeterGroup } from '../ui/meterBar.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzDartboard } from '../ui/feelzDartboard.js';
import { emotionColor, emotionsForClass, getDominantEmotion } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createDebtSigil } from '../ui/debtSigil.js';
import { drawEmotionPattern } from '../ui/emotionPattern.js';
import * as fx from '../shell/fx.js';
import * as audio from '../shell/audio.js';

// Weak vs strong hit feedback is derived from how big a swipe's effects
// are, not from truth/lie — intensity signals weight, not judgment.
const STRONG_HIT_THRESHOLD = 8;

// Which node this NPC opens on. A confrontation scene earlier in the chapter
// can have written an opener id into run.openers (see confrontationScene.js);
// without one, or with a stale id, fall back to the first authored node.
function openingNodeId(scene, npc, state) {
  const chosen = state.openers?.[scene.id];
  return chosen && npc.nodes[chosen] ? chosen : Object.keys(npc.nodes)[0];
}

export function mount(stageEl, scene, { run, onComplete }) {
  const { npc } = scene;
  let currentNodeId = resolveGatedNode(openingNodeId(scene, npc, run.get()), npc, run.get());
  let activeEmotion = null;
  let activeEmotionColor = null;
  // 'prompt' (NPC's opening line, FEELZ + swipe card) -> 'say' (the player's
  // own SAY: line, drawn once a swipe resolves) -> 'reaction' (NPC's REACT:).
  let stage = 'prompt';
  let promptRevealed = false;
  let pendingEdge = null;
  let reactionEmotion = null;
  let reactionSwipeKey = null;
  let typewriter = null;
  let itPopup = null;

  function currentNode() {
    return npc.nodes[currentNodeId];
  }

  function enterNode() {
    activeEmotion = null;
    activeEmotionColor = null;
    stage = 'prompt';
    promptRevealed = false;
    const loadedEmotions = emotionsForClass(run.get().loadout);
    audio.startEmotionStems(loadedEmotions);
    audio.ambientMix(loadedEmotions);
    render();
  }

  function render() {
    const runState = run.get();
    typewriter?.destroy();
    typewriter = null;
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

    const portrait = createNpcPortrait(npc.npc, npc.accentColor, npc.portrait);
    content.appendChild(portrait.el);
    content.appendChild(portrait.nameplate);
    // render() rebuilds the portrait from scratch every call, so syncing here
    // (rather than only right after a swipe) covers every case for free —
    // including the very first render, where mood is still neutral (0).
    portrait.updateMood(audio.getLeitmotifMood());

    if (stage === 'say') {
      // Its own bordered box, in the same screen slot the swipe card and
      // dartboard just occupied — the player's line replaces the choice UI
      // rather than appearing as loose text, so it reads as "this is what
      // that choice was" in the exact place the choice just happened.
      const sayBox = document.createElement('div');
      sayBox.className = 'dx-say-box';
      content.appendChild(sayBox);

      const sayLabel = document.createElement('p');
      sayLabel.className = 'dx-text dx-say-label';
      sayLabel.textContent = 'YOU';
      sayBox.appendChild(sayLabel);

      const say = document.createElement('p');
      say.className = 'dx-text dx-say';
      sayBox.appendChild(say);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      typewriter = createTypewriter(say, pendingEdge.playerText, {
        onChar: audio.playTypewriterTick,
        onDone: () => { tapHint.hidden = false; },
      });

      // Same tap-once-to-finish, tap-again-to-continue gesture every other
      // beat in the game already uses.
      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else {
          stage = 'reaction';
          render();
        }
      });
    } else if (stage === 'reaction') {
      const reaction = document.createElement('p');
      reaction.className = 'dx-text dx-reaction';
      content.appendChild(reaction);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      typewriter = createTypewriter(
        reaction,
        composeReaction(pendingEdge.npcReaction, reactionEmotion, reactionSwipeKey),
        { onChar: audio.playTypewriterTick, onDone: () => { tapHint.hidden = false; } },
      );

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else continueAfterReaction();
      });
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'dx-text';
      content.appendChild(prompt);

      // Card + dartboard build up front but stay hidden until the prompt
      // finishes drawing — tapping the screen still finishes the draw early.
      const interactive = document.createElement('div');
      interactive.className = 'dx-dialog-interactive';
      interactive.hidden = !promptRevealed;
      content.appendChild(interactive);

      const card = createSwipeCard({
        promptText: activeEmotion ? 'Drag to respond.' : 'Pick a feeling first.',
        onSwipe: (key) => {
          if (!activeEmotion) {
            // A completed swipe with no feeling picked yet doesn't count as
            // a choice — snap the card back and give a clearly smaller jolt
            // than any real choice gets, so it reads as "that didn't
            // register," not as a lighter version of an actual answer.
            card.reset();
            fx.shake('subtle');
            audio.playHit('subtle');
            return;
          }
          handleSwipe(key);
        },
      });
      interactive.appendChild(card.el);

      if (activeEmotionColor) {
        card.setSelectedColor(activeEmotionColor);
      }

      const dartboard = createFeelzDartboard({
        loadout: run.get().loadout,
        dropTarget: card,
        selected: activeEmotion,
        // Both tap and drag color the card now — a tap that changes nothing
        // visible reads as broken, not as restraint. (`source` is kept in
        // the callback signature in case a future pass wants to bring back
        // a lighter tap-only treatment; it isn't used for that today.)
        onSelect: (emotion, _source) => {
          activeEmotion = emotion;
          activeEmotionColor = emotionColor(emotion);
          audio.emphasizeEmotion(emotion, emotionsForClass(run.get().loadout));
          render();
        },
      });
      interactive.appendChild(dartboard.el);

      // Re-renders triggered by picking a FEELZ emotion reuse this same node's
      // prompt — startRevealed skips replaying the draw from scratch.
      typewriter = createTypewriter(prompt, currentNode().prompt, {
        onChar: audio.playTypewriterTick,
        onDone: () => { promptRevealed = true; interactive.hidden = false; },
        startRevealed: promptRevealed,
      });

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
      });
    }

    content.appendChild(createDebtSigil(runState.truthDebt).el);
    stageEl.appendChild(screen);

    if (stage === 'say' || stage === 'reaction') {
      drawEmotionPattern(patternCanvas, {
        seedStr: `${npc.npc}:${currentNodeId}:${reactionEmotion}`,
        key: reactionEmotion,
      });
    }
  }

  function handleSwipe(swipeKey) {
    const before = run.get();
    const { edge, patch } = resolveCard(before, currentNode(), swipeKey, activeEmotion);
    run.set(patch);

    // How this specific choice actually landed with the NPC — trust and
    // stability are their rapport/comfort with you, not a right-or-wrong
    // score (see docs/HANDOFF.md's stat meanings). Uses the post-clamp
    // delta, not the raw authored effect, so a stat already maxed out
    // doesn't overstate how much this choice moved anything. Bends their
    // leitmotif live; a no-op if this NPC has no phrase-loop leitmotif.
    const trustDelta = (patch.trust ?? before.trust) - before.trust;
    const stabilityDelta = (patch.stability ?? before.stability) - before.stability;
    audio.nudgeLeitmotifMood(trustDelta + stabilityDelta);

    // Tally every FEELZ pick for the whole run, not just this node — feeds
    // the dominant-emotion IT read at the end of the encounter (proceed()).
    const counts = run.get().emotionCounts;
    run.set({ emotionCounts: { ...counts, [activeEmotion]: (counts[activeEmotion] ?? 0) + 1 } });

    pendingEdge = edge;
    reactionEmotion = activeEmotion;
    reactionSwipeKey = swipeKey;
    stage = edge.playerText ? 'say' : 'reaction';

    const magnitude =
      Object.values(edge.effects || {}).reduce((sum, v) => sum + Math.abs(v), 0) +
      Math.abs(edge.debtDelta || 0);
    const intensity = magnitude >= STRONG_HIT_THRESHOLD ? 'strong' : 'weak';

    fx.flash(intensity);
    fx.shake(intensity);
    audio.playHit(intensity);
    audio.stopEmotionStems();

    render();
  }

  function continueAfterReaction() {
    if (stage !== 'reaction' || !pendingEdge) return;
    const edge = pendingEdge;
    pendingEdge = null;
    stage = 'prompt';
    advance(edge);
  }

  function advance(edge) {
    const bloom = checkBloomTriggers(run.get());
    run.set(bloom.patch);

    // A newly-crossed threshold interrupts right here, over whatever's
    // already on screen (the reaction the player just read) — "the player
    // doesn't choose this, IT just shows up" (docs/IT_DESIGN.md). If more
    // than one threshold was crossed in a single swipe (a big lie landing
    // on a debt that was already close), only the highest gets a line —
    // one intrusion, not a stack of them.
    if (bloom.newlyFired.length > 0) {
      showBloomIt(Math.max(...bloom.newlyFired), () => proceed(edge));
      return;
    }
    proceed(edge);
  }

  function showBloomIt(threshold, onClose) {
    itPopup = createItPopup(stageEl, {
      text: BLOOM_IT_TEXT[threshold],
      loadout: run.get().loadout,
      flashClose: false, // one-off interrupt — nothing follows it
      onClose: () => {
        itPopup?.destroy();
        itPopup = null;
        onClose();
      },
    });
  }

  function proceed(edge) {
    if (run.get().truthDebt >= 10) {
      onComplete({ jumpTo: 'reckoning' });
      return;
    }

    if (edge.nextNodeId) {
      currentNodeId = resolveGatedNode(edge.nextNodeId, npc, run.get());
      enterNode();
      return;
    }

    // This NPC's encounter is over — IT reads the player's FEELZ pattern
    // for the run so far, once there's actually a pattern to read. Skip
    // below 2 picks: a single data point isn't a lean, it's a coin flip,
    // and this is also what naturally excludes the Therapist (one swipe,
    // exempt from the rest of the NPC shape anyway — see docs/HANDOFF.md).
    const counts = run.get().emotionCounts;
    const totalPicks = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPicks < 2) {
      onComplete();
      return;
    }

    showEmotionLeanIt(getDominantEmotion(counts), onComplete);
  }

  function showEmotionLeanIt(dominant, onClose) {
    itPopup = createItPopup(stageEl, {
      text: emotionLeanText(run.get().loadout, dominant),
      loadout: run.get().loadout,
      flashClose: false, // one-off interrupt — nothing follows it
      onClose: () => {
        itPopup?.destroy();
        itPopup = null;
        onClose();
      },
    });
  }

  // The NPC's leitmotif is this character's continuous underscore for the
  // whole encounter — started once here, not in enterNode(), so it doesn't
  // restart on every node. It deliberately keeps playing through reactions,
  // where the emotion stems stop. See STAT_MATH.md "Per-NPC leitmotif".
  audio.startLeitmotif(npc.npc);
  audio.preloadTypewriterTick();
  enterNode();

  return function unmount() {
    typewriter?.destroy();
    itPopup?.destroy();
    audio.stopEmotionStems();
    audio.stopLeitmotif();
    stageEl.innerHTML = '';
  };
}
