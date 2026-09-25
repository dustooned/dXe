// Scene type: 'dialog'. Runs one NPC's node graph (FEELZ pick -> swipe ->
// reaction -> next node) to completion, then hands control back to the
// sequencer. See docs/SCENE_TYPES.md for the full contract.
//
// scene shape: { type: 'dialog', id: string, npc: <NPC content JSON> }
import { resolveCard, resolveGatedNode } from '../engine/cardEngine.js';
import { composeReaction } from '../engine/reactions.js';
import { composeSay } from '../engine/sayTone.js';
import { checkBloomTriggers } from '../engine/debtEngine.js';
import { BLOOM_IT_TEXT } from '../engine/itBlooms.js';
import { emotionLeanText } from '../engine/itEmotionLean.js';
import { SO_BLOOM_TEXT, soEmotionLeanText } from '../engine/soRebuttals.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createItPopup } from '../ui/itPopup.js';
import { createMeterGroup } from '../ui/meterBar.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzDartboard } from '../ui/feelzDartboard.js';
import { emotionColor, emotionsForClass, getDominantEmotion } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createDebtSigil } from '../ui/debtSigil.js';
import { createOscilloscope } from '../ui/oscilloscope.js';
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
  // Which beat of the encounter we're on — drives the cadence, see
  // harmonicFunction(). Starts at -1 so the first enterNode() lands on 0.
  let beatIndex = -1;
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
  let oscilloscope = null;
  let dartboard = null;
  // The Therapist's PICK: line for the current feeling, drawn under her
  // prompt the moment a wedge is picked (see the prompt branch of render()).
  let pickTypewriter = null;
  // Set by a wedge pick, consumed by the next render — makes the swipe card
  // wiggle once, pointing at it as the next thing to touch.
  let justPicked = false;
  // Nodes answered in *this* encounter — drives npc.reveal (a HUD piece
  // stays hidden until its node is answered) — and which HUD pieces have
  // already played their one-time reveal animation.
  const answered = new Set();
  const revealAnimated = new Set();
  // npc.outro playback: what's left to play, the beat on screen, and whether
  // the call has hung up (sticks for the rest of the outro once a HANGUP
  // beat is reached).
  let outroQueue = [];
  let outroBeat = null;
  let hungUp = false;

  function currentNode() {
    return npc.nodes[currentNodeId];
  }

  // The encounter is shaped as a cadence: it opens in the predominant area,
  // sits in dominant tension through the body, and resolves on its last
  // beat — each step one fourth/fifth of root motion. Whether that
  // resolution lands as unison or as a tritone is decided by how the
  // choices went, not by where you are (see shell/harmony.js).
  //
  // A node with nowhere left to go is the resolution however early it
  // arrives, however short the encounter.
  function harmonicFunction() {
    const swipes = currentNode()?.swipes ?? {};
    const terminal = Object.values(swipes).every((swipe) => !swipe.nextNodeId);
    if (terminal) return 'tonic';
    return beatIndex === 0 ? 'predominant' : 'dominant';
  }

  function enterNode() {
    beatIndex++;
    activeEmotion = null;
    activeEmotionColor = null;
    stage = 'prompt';
    promptRevealed = false;
    audio.strikeChord(emotionsForClass(run.get().loadout), harmonicFunction());
    render();
  }

  // npc.reveal ({ meters?: nodeId, debt?: nodeId }, authored as REVEAL:
  // lines) keeps a HUD piece off screen until the Therapist reaches it, so a
  // first-time player isn't handed every readout at once with nothing
  // pointing at any of it. Debt also shows early the moment it's non-zero —
  // a lie shouldn't land invisibly. NPCs without `reveal` show everything.
  function isRevealed(kind) {
    const gateNode = npc.reveal?.[kind];
    if (!gateNode || answered.has(gateNode)) return true;
    return kind === 'debt' && run.get().truthDebt > 0;
  }

  function applyReveal(el, kind) {
    if (!isRevealed(kind)) {
      el.classList.add('is-concealed');
    } else if (npc.reveal?.[kind] && !revealAnimated.has(kind)) {
      revealAnimated.add(kind);
      el.classList.add('is-revealing');
    }
  }

  function render() {
    const runState = run.get();
    typewriter?.destroy();
    typewriter = null;
    pickTypewriter?.destroy();
    pickTypewriter = null;
    oscilloscope?.destroy();
    oscilloscope = null;
    // Only stops a lingering hover preview, not the select drone — see
    // feelzDartboard.js's destroy(). This whole screen gets rebuilt from
    // scratch below, same as typewriter/oscilloscope above.
    dartboard?.destroy();
    dartboard = null;
    stageEl.innerHTML = '';

    const screen = document.createElement('div');
    screen.className = `dx-screen dx-game-screen${hungUp ? ' dx-game-screen--hungup' : ''}`;

    // The battle background, not a decorative pattern — a live dual-trace
    // read on both sides of the encounter (docs/STAT_MATH.md's
    // "Confrontation oscilloscope"), present through every stage of the
    // fight, same as the leitmotif it's partly drawing from. Recreated
    // each render() (this whole screen is rebuilt from scratch every
    // stage change) rather than held across renders, matching how the
    // portrait below already does this — the underlying signals
    // (analyser, run state) are read live regardless of when the canvas
    // itself was created, so there's no continuity to lose.
    const scopeCanvas = document.createElement('canvas');
    scopeCanvas.className = 'dx-pattern-bg';
    screen.appendChild(scopeCanvas);
    oscilloscope = createOscilloscope(scopeCanvas, {
      getPlayerStats: () => run.get(),
    });

    const content = document.createElement('div');
    content.className = 'dx-game-content dx-game-content--live-bg';
    screen.appendChild(content);

    const meters = createMeterGroup(runState).el;
    applyReveal(meters, 'meters');
    content.appendChild(meters);

    const portrait = createNpcPortrait(npc.npc, npc.accentColor, npc.portrait);
    content.appendChild(portrait.el);
    content.appendChild(portrait.nameplate);
    // render() rebuilds the portrait from scratch every call, so syncing here
    // (rather than only right after a swipe) covers every case for free —
    // including the very first render, where mood is still neutral (0).
    portrait.updateMood(audio.getLeitmotifMood());

    if (stage === 'outro') {
      const line = document.createElement('p');
      line.className = `dx-text dx-reaction${outroBeat.kind === 'hangup' ? ' dx-hangup-line' : ''}`;
      content.appendChild(line);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      typewriter = createTypewriter(line, outroBeat.text, {
        onChar: audio.playTypewriterTick,
        onDone: () => { tapHint.hidden = false; },
      });

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else nextOutroBeat();
      });
    } else if (stage === 'say') {
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

      typewriter = createTypewriter(say, composeSay(pendingEdge.playerText, reactionEmotion, reactionSwipeKey), {
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
        composeReaction(npc.npc, pendingEdge.npcReaction, reactionEmotion, reactionSwipeKey),
        { onChar: audio.playTypewriterTick, onDone: () => { tapHint.hidden = false; } },
      );

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else continueAfterReaction();
      });
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'dx-text dx-prompt';
      content.appendChild(prompt);

      // The Therapist's read of the feeling just picked — imagery, never the
      // emotion's name (feelings are symbols only). Only nodes with PICK
      // lines have any; everyone else skips this entirely.
      const pickText = activeEmotion && currentNode().picks?.[activeEmotion];
      if (pickText) {
        const pickLine = document.createElement('p');
        pickLine.className = 'dx-text dx-pick-line';
        content.appendChild(pickLine);
        pickTypewriter = createTypewriter(pickLine, pickText, {
          onChar: audio.playTypewriterTick,
          startRevealed: !justPicked,
        });
      }

      // Card + dartboard build up front but stay hidden until the prompt
      // finishes drawing — tapping the screen still finishes the draw early.
      const interactive = document.createElement('div');
      interactive.className = 'dx-dialog-interactive';
      interactive.hidden = !promptRevealed;
      content.appendChild(interactive);
      const wasRevealed = promptRevealed;

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
      if (justPicked) {
        justPicked = false;
        card.nudge();
      }

      dartboard = createFeelzDartboard({
        loadout: run.get().loadout,
        dropTarget: card,
        selected: activeEmotion,
        harmonicFunction: harmonicFunction(),
        // Both tap and drag color the card now — a tap that changes nothing
        // visible reads as broken, not as restraint. (`source` is kept in
        // the callback signature in case a future pass wants to bring back
        // a lighter tap-only treatment; it isn't used for that today.)
        onSelect: (emotion, _source) => {
          activeEmotion = emotion;
          activeEmotionColor = emotionColor(emotion);
          justPicked = true;
          render();
        },
      });
      interactive.appendChild(dartboard.el);

      // Re-renders triggered by picking a FEELZ emotion reuse this same node's
      // prompt — startRevealed skips replaying the draw from scratch.
      typewriter = createTypewriter(prompt, currentNode().prompt, {
        onChar: audio.playTypewriterTick,
        onDone: () => {
          promptRevealed = true;
          interactive.hidden = false;
          // Wheel and card fade in the first time they appear on a node,
          // not on every re-render a pick triggers.
          if (!wasRevealed) interactive.classList.add('is-entering');
        },
        startRevealed: promptRevealed,
      });

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else if (pickTypewriter && !pickTypewriter.isDone()) pickTypewriter.finish();
      });
    }

    const sigil = createDebtSigil(runState.truthDebt).el;
    applyReveal(sigil, 'debt');
    content.appendChild(sigil);
    stageEl.appendChild(screen);
  }

  function handleSwipe(swipeKey) {
    // The choice just locked in and the wheel is about to disappear (SAY/
    // REACT replaces it below) — the picked feeling's background hum has
    // nothing left to represent once it's no longer "the current pick."
    audio.stopFeelzDrone();

    const before = run.get();
    const { edge, patch } = resolveCard(before, currentNode(), swipeKey, activeEmotion);
    run.set(patch);
    // Which way each node went, for anything later that reads it back —
    // today an outro beat's [node=truth|lie] condition.
    run.set({ choices: { ...before.choices, [currentNodeId]: swipeKey } });
    answered.add(currentNodeId);

    // How this specific choice actually landed with the NPC — trust and
    // stability are their rapport/comfort with you, not a right-or-wrong
    // score (see docs/HANDOFF.md's stat meanings). Uses the post-clamp
    // delta, not the raw authored effect, so a stat already maxed out
    // doesn't overstate how much this choice moved anything. Bends their
    // leitmotif live and moves the confrontation chord's voicing.
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
    // Struck *after* the mood nudge above, so what you hear is the chord as
    // this choice just left it — the answer to the swipe, not a repeat of
    // where things stood before it.
    audio.strikeChord(emotionsForClass(run.get().loadout), harmonicFunction());

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

  // SO answers both of this scene's own IT moments — the pattern-reading
  // ones (a bloom, or the end-of-encounter emotion lean), not IT generally.
  // The generic authored `it` beat in cutsceneScene.js and the ending's
  // closing line (endingScene.js — "IT gets the actual last word of the
  // chapter," deliberately) stay single-voice on purpose; see
  // docs/IT_DESIGN.md's "SO — the doubt rebuttal" for why the two are
  // scoped differently. `flashClose: true` on IT's own popup signals
  // "there's another one coming," same convention a multi-beat IT sequence
  // already used before SO existed. `onClose` only fires once SO's own
  // popup is dismissed, so callers don't need to know a second popup is
  // involved at all.
  function showItThenSo(itText, soText, onClose) {
    itPopup = createItPopup(stageEl, {
      text: itText,
      loadout: run.get().loadout,
      flashClose: true,
      onClose: () => {
        itPopup?.destroy();
        itPopup = createItPopup(stageEl, {
          text: soText,
          loadout: run.get().loadout,
          flashClose: false, // last one in the sequence
          voice: 'so',
          onClose: () => {
            itPopup?.destroy();
            itPopup = null;
            onClose();
          },
        });
      },
    });
  }

  function showBloomIt(threshold, onClose) {
    showItThenSo(BLOOM_IT_TEXT[threshold], SO_BLOOM_TEXT[threshold], onClose);
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

    // An authored outro (the Therapist's homework + IT/SO sign-off) *is*
    // this encounter's closing IT moment, so it replaces the emotion-lean
    // read below rather than stacking a second IT/SO pair on top of it.
    if (npc.outro?.length) {
      startOutro();
      return;
    }

    // This NPC's encounter is over — IT reads the player's FEELZ pattern
    // for the run so far, once there's actually a pattern to read. Skip
    // below 2 picks: a single data point isn't a lean, it's a coin flip.
    const counts = run.get().emotionCounts;
    const totalPicks = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPicks < 2) {
      onComplete();
      return;
    }

    showEmotionLeanIt(getDominantEmotion(counts), onComplete);
  }

  // npc.outro: beats after the last node, each optionally gated on the
  // player's class and/or how a given node was answered. LINE/HANGUP draw
  // in the reaction slot, tap to continue; IT/SO pop up over whatever's on
  // screen, same popup the rest of the game uses.
  function outroBeatApplies(beat) {
    const state = run.get();
    if (beat.when?.class && beat.when.class !== state.loadout) return false;
    const choice = beat.when?.choice;
    if (choice && state.choices?.[choice.node] !== choice.side) return false;
    return true;
  }

  function startOutro() {
    outroQueue = npc.outro.filter(outroBeatApplies);
    nextOutroBeat();
  }

  function nextOutroBeat() {
    const beat = outroQueue.shift();
    if (!beat) {
      onComplete();
      return;
    }
    if (beat.kind === 'it' || beat.kind === 'so') {
      const next = outroQueue[0];
      itPopup = createItPopup(stageEl, {
        text: beat.text,
        loadout: run.get().loadout,
        voice: beat.kind,
        flashClose: next?.kind === 'it' || next?.kind === 'so',
        onClose: () => {
          itPopup?.destroy();
          itPopup = null;
          nextOutroBeat();
        },
      });
      return;
    }
    if (beat.kind === 'hangup' && !hungUp) {
      hungUp = true;
      // The call is over — the Therapist's underscore goes with it, so the
      // hang-up (and IT after it) lands in the lake's silence.
      audio.stopLeitmotif();
    }
    outroBeat = beat;
    stage = 'outro';
    render();
  }

  function showEmotionLeanIt(dominant, onClose) {
    const loadout = run.get().loadout;
    showItThenSo(emotionLeanText(loadout, dominant), soEmotionLeanText(loadout, dominant), onClose);
  }

  // The NPC's leitmotif is this character's continuous underscore for the
  // whole encounter — started once here, not in enterNode(), so it doesn't
  // restart on every node. Must run before the first enterNode() below,
  // which strikes a chord built on this NPC's tonic and needs to know who's
  // playing. See STAT_MATH.md "Per-NPC leitmotif".
  audio.startLeitmotif(npc.npc);
  audio.preloadTypewriterTick();
  enterNode();

  return function unmount() {
    typewriter?.destroy();
    pickTypewriter?.destroy();
    itPopup?.destroy();
    oscilloscope?.destroy();
    dartboard?.destroy();
    // Also cuts any chord, FEELZ drone, or hover tone still sounding — a
    // strike/drone outlasts a scene exit, so without this the encounter's
    // audio bleeds into the next scene.
    audio.stopLeitmotif();
    stageEl.innerHTML = '';
  };
}
