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
import { FLIP_TEXT, encounterSide } from '../engine/itFindings.js';
import { fillReadings } from '../engine/lake.js';
import { recordTrust, shouldUnlockTrust, isTrusted } from '../engine/trust.js';
import { giftFor } from '../engine/unlocks.js';
import { STALL_MARKS, FAST_MS, FAST_STREAK, SKIM_STREAK, pressureLine } from '../engine/itPressure.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createFeelzNotification } from '../ui/feelzNotification.js';
import { createItPopup, resolveItText } from '../ui/itPopup.js';
import { sharpen } from '../engine/itSharpen.js';
import { createStatusBar } from '../ui/statusBar.js';
import { CONTACTS, contactsFor, therapistReachable, callFor } from '../engine/contacts.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzDartboard } from '../ui/feelzDartboard.js';
import { EMOTIONS, emotionColor, emotionsForClass, getDominantEmotion } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { createOscilloscope } from '../ui/oscilloscope.js';
import { createSpotlight } from '../ui/spotlight.js';
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

// The oscilloscope draws on a canvas, which can't read CSS variables, so
// resolve the mood's --color-feelz-* token to its hex value.
function moodHex(mood) {
  if (!mood || !EMOTIONS[mood]) return '#ffffff';
  const token = EMOTIONS[mood].color.match(/--[\w-]+/)?.[0];
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#ffffff';
}

// How long the committed card hangs before the answer plays out.
const FREEZE_MS = 150;

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
  // What turning toward this answer's bid gave: a feeling, null (turned
  // toward, nothing left to give), or undefined (no bid met).
  let reactionGift;
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
  // The tutorial vignette currently darkening everything but what she's
  // talking about (ui/spotlight.js). Rebuilt per render like everything else.
  let spotlight = null;
  // Nodes answered in *this* encounter — drives npc.reveal (a HUD piece
  // stays hidden until its node is answered) — and which HUD pieces have
  // already played their one-time reveal animation.
  const answered = new Set();
  const revealAnimated = new Set();
  // npc.outro playback: what's left to play, the beat on screen, and whether
  // the call has hung up (sticks for the rest of the outro once a HANGUP
  // beat is reached).
  let outroQueue = [];
  // For IT/SO's end-of-encounter findings (showFindingIfAny): every swipe
  // made in this encounter, and whether a bloom already interrupted it.
  const encounterSwipes = [];
  let bloomedThisEncounter = false;
  let outroBeat = null;
  let hungUp = false;
  // Set once the player turns toward one of this NPC's bids; warms the
  // portrait for the rest of the encounter (engine/trust.js).
  let turnedTowardThisEncounter = false;
  // The battle beats (ui/oscilloscope.js reads this every frame): wind-up
  // tension as the NPC's line types, their mood color easing between
  // moments, the impact ring when they react, a gold ripple on a bid.
  const drama = { tension: 0, color: null, shock: null, ripple: null, mismatch: false };
  // Set at the swipe, spent when the reaction lands.
  let pendingImpact = null;
  // A feeling just given, waiting for the wheel to show it (see giveFeeling).
  let freshFeeling = null;
  // This NPC just crossed into trusting the player: their connection moment
  // plays after the reaction that tipped it (see showConnection).
  let pendingConnect = false;
  // Pace pressure (engine/itPressure.js): the stall clock for the current
  // card, when the card appeared, and the rushing streaks.
  let stallTimers = [];
  let cardShownAt = null;
  let fastStreak = 0;
  let skimStreak = 0;
  // Rushing comments are once per run, and never in the tutorial.
  const pressureAllowed = (kind) => npc.npc !== 'THERAPIST' && !run.get().pressureSaid?.[kind];
  let pendingPressure = null;
  // An answer that contradicts something said to someone earlier this run.
  let pendingContradiction = null;
  // Phone: the live status bar (rebuilt each render; its clock ticks), and
  // who's already been called this encounter (one call per contact).
  let statusBar = null;
  let itTyping = false;
  const calledThisEncounter = new Set();
  // A contact's read, kept glowing on the wheel until the next moment.
  let hintedEmotion = null;

  function clearStall() {
    stallTimers.forEach(clearTimeout);
    stallTimers = [];
    itTyping = false;
  }

  // The card and wheel just appeared: start the clock. The tutorial's very
  // first question is exempt — people are still learning the wheel.
  function startStall() {
    clearStall();
    cardShownAt = performance.now();
    if (npc.npc === 'THERAPIST' && beatIndex === 0) return;
    for (const mark of STALL_MARKS) {
      stallTimers.push(setTimeout(() => {
        itTyping = true;
        statusBar?.setTyping(true);
      }, mark.ms - 2500));
      stallTimers.push(setTimeout(() => {
        itTyping = false;
        statusBar?.setTyping(false);
        if (itPopup || stage !== 'prompt') return;
        itPopup = sayIt({
          text: pressureLine(mark.pool),
          loadout: run.get().loadout,
          voice: mark.voice,
          onClose: () => { itPopup?.destroy(); itPopup = null; },
        });
      }, mark.ms));
    }
  }

  // A tap on a line: cutting it short while it draws counts toward
  // skimming; a line read to the end resets the streak.
  function tapLine(tw) {
    if (tw?.isDrawing()) {
      skimStreak += 1;
      if (skimStreak >= SKIM_STREAK && pressureAllowed('skim')) pendingPressure = 'skim';
    }
    tw?.finish();
  }

  function lineReadThrough(skippedFlag) {
    if (!skippedFlag) skimStreak = 0;
  }

  function easeMoodTo(mood) {
    const to = moodHex(mood);
    const now = performance.now();
    const from = drama.color ? currentMoodColor(now) : to;
    drama.color = { from, to, t0: now };
  }

  // Where the color easing currently is (so a new ease starts from what's
  // on screen, not from the old target).
  function currentMoodColor(now) {
    const c = drama.color;
    if (!c) return '#ffffff';
    return now - c.t0 >= 450 ? c.to : c.from;
  }

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
    drama.tension = 0;
    drama.mismatch = false;
    hintedEmotion = null;
    easeMoodTo(currentNode().mood);
    audio.startPulse(() => drama.tension);
    audio.strikeChord(emotionsForClass(run.get().loadout, run.get().unlocked), harmonicFunction());
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
    // Not during SAY: the reveal belongs to her reaction, where she's the
    // one pointing at it.
    return kind === 'debt' && run.get().truthDebt > 0 && stage !== 'say';
  }

  // Returns true when this render is the piece's first appearance — the
  // caller spotlights it for exactly that one beat.
  function applyReveal(el, kind) {
    if (!isRevealed(kind)) {
      el.classList.add('is-concealed');
    } else if (npc.reveal?.[kind] && !revealAnimated.has(kind)) {
      revealAnimated.add(kind);
      el.classList.add('is-revealing');
      return true;
    }
    return false;
  }

  // The node was answered and her reaction is starting — the point where
  // REVEAL'd HUD pieces tied to this node come in.
  function enterReaction() {
    answered.add(currentNodeId);
    stage = 'reaction';
    landImpact();
    // The lake answers too: a splash pitched by its current quality, once
    // the gauge is on screen (audio.js's playLakeSplash).
    if (isRevealed('debt')) audio.playLakeSplash(run.get().truthDebt);
  }

  function render() {
    const runState = run.get();
    typewriter?.destroy();
    typewriter = null;
    pickTypewriter?.destroy();
    pickTypewriter = null;
    spotlight?.destroy();
    spotlight = null;
    // HUD pieces making their first appearance this render (see applyReveal).
    const spotlitHud = [];
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
    const mood = stage === 'prompt' ? currentNode()?.mood : null;
    oscilloscope = createOscilloscope(scopeCanvas, {
      getPlayerStats: () => run.get(),
      npcColor: drama.color?.to ?? '#ffffff',
      isSynced: () => !!mood && activeEmotion === mood,
      getDrama: () => drama,
    });

    const content = document.createElement('div');
    content.className = 'dx-game-content dx-game-content--live-bg';
    screen.appendChild(content);

    statusBar?.destroy();
    const shutOut = stage === 'prompt' && /(_shut_down|_closed|_hard)$/.test(currentNodeId ?? '');
    statusBar = createStatusBar(runState, { typing: itTyping, airplane: shutOut });
    const meters = statusBar.el;
    if (applyReveal(meters, 'meters')) spotlitHud.push(meters);
    content.appendChild(meters);

    const portrait = createNpcPortrait(npc.npc, npc.accentColor, npc.portrait);
    content.appendChild(portrait.el);
    content.appendChild(portrait.nameplate);
    // render() rebuilds the portrait from scratch every call, so syncing here
    // (rather than only right after a swipe) covers every case for free —
    // including the very first render, where mood is still neutral (0).
    portrait.updateMood(audio.getLeitmotifMood());
    if (turnedTowardThisEncounter) portrait.el.classList.add('is-warm');

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
          enterReaction();
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
        composeReaction(npc.npc, varyReaction(pendingEdge), reactionEmotion, reactionSwipeKey),
        { onChar: audio.playTypewriterTick, onDone: () => { tapHint.hidden = false; } },
      );

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) tapLine(typewriter);
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
        unlocked: run.get().unlocked,
        fresh: freshFeeling,
        dropTarget: card,
        selected: activeEmotion,
        harmonicFunction: harmonicFunction(),
        // Both tap and drag color the card now — a tap that changes nothing
        // visible reads as broken, not as restraint. (`source` is kept in
        // the callback signature in case a future pass wants to bring back
        // a lighter tap-only treatment; it isn't used for that today.)
        onSelect: (emotion, _source) => {
          freshFeeling = null;
          activeEmotion = emotion;
          activeEmotionColor = emotionColor(emotion);
          justPicked = true;
          const nodeMood = currentNode().mood;
          if (nodeMood) {
            drama.mismatch = emotion !== nodeMood;
            if (drama.mismatch) audio.playGrind();
            else audio.playSyncChime();
          }
          render();
        },
      });
      interactive.appendChild(dartboard.el);
      if (hintedEmotion) dartboard.hint(hintedEmotion);

      // Re-renders triggered by picking a FEELZ emotion reuse this same node's
      // prompt — startRevealed skips replaying the draw from scratch.
      const promptChars = promptText().replace(/{[^}]*}/g, '').length || 1;
      let typed = 0;
      typewriter = createTypewriter(prompt, promptText(), {
        onChar: () => {
          audio.playTypewriterTick();
          typed += 1;
          drama.tension = Math.max(drama.tension, Math.min(1, typed / promptChars));
        },
        onDone: () => {
          if (!promptRevealed) lineReadThrough(typed >= promptChars);
          promptRevealed = true;
          drama.tension = 1;
          interactive.hidden = false;
          // Wheel and card fade in the first time they appear on a node,
          // not on every re-render a pick triggers.
          if (!wasRevealed) {
            interactive.classList.add('is-entering');
            startStall();
            // The new slice arrives (feelzDartboard.js `fresh`, ~1.6s): input
            // waits, its own voice rings as it slams in, then the whole chord
            // sounds with it added — the wheel audibly gets bigger.
            if (freshFeeling) {
              const f = freshFeeling;
              const voices = emotionsForClass(run.get().loadout, run.get().unlocked);
              // A moment of its own (~3s): the screen dims, the wheel lifts to
              // the center at nearly double size, the slice cracks in and slams,
              // its tone rings, the whole chord swells with it, the wheel
              // settles back. Input waits.
              interactive.classList.add('is-receiving');
              const dim = document.createElement('div');
              dim.className = 'dx-receive-dim';
              dim.style.setProperty('--gift', emotionColor(f));
              stageEl.appendChild(dim);
              setTimeout(() => { audio.strikeEmotionVoice(f, voices, harmonicFunction()); fx.shake('weak'); }, 1250);
              setTimeout(() => audio.strikeChord(voices, harmonicFunction()), 1700);
              setTimeout(() => { interactive.classList.remove('is-receiving'); dim.remove(); }, 3000);
            }
            spotlightInteractive();
          }
        },
        startRevealed: promptRevealed,
      });

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) tapLine(typewriter);
        else if (pickTypewriter && !pickTypewriter.isDone()) pickTypewriter.finish();
      });
    }

    // Truth Debt, shown as the lake's water quality (ui/lakeGauge.js).
    const lake = createLakeGauge(runState.truthDebt).el;
    if (applyReveal(lake, 'debt')) spotlitHud.push(lake);
    content.appendChild(lake);
    if (stage === 'prompt' && isRevealed('meters')) content.appendChild(createDock(runState));
    stageEl.appendChild(screen);

    // A HUD piece's first appearance is spotlit together with the line
    // introducing it (her reaction), for as long as that beat lasts.
    if (spotlitHud.length) {
      const words = content.querySelector('.dx-reaction');
      spotlight = createSpotlight(screen, [...spotlitHud, words]);
    }
    if (stage === 'prompt' && promptRevealed) spotlightInteractive();
  }

  // SPOTLIGHT: on a node — before a pick, the wheel (plus her prompt, so
  // "see the three lighting up?" stays readable); after one, the card (plus
  // her read of the pick). Once the node is answered this never runs again,
  // so it's a first-time-only teaching beat, not permanent chrome.
  function spotlightInteractive() {
    const wants = currentNode()?.spotlight ?? [];
    const screen = stageEl.querySelector('.dx-game-screen');
    if (!screen) return;
    let targets = null;
    if (!activeEmotion && wants.includes('wheel')) {
      targets = [dartboard?.el, screen.querySelector('.dx-prompt')];
    } else if (activeEmotion && wants.includes('card')) {
      targets = [
        screen.querySelector('.dx-swipe-card-wrap'),
        screen.querySelector('.dx-pick-line') ?? screen.querySelector('.dx-prompt'),
      ];
    }
    if (!targets) return;
    spotlight?.destroy();
    spotlight = createSpotlight(screen, targets);
  }

  function handleSwipe(swipeKey) {
    clearStall();
    if (cardShownAt !== null) {
      fastStreak = performance.now() - cardShownAt < FAST_MS ? fastStreak + 1 : 0;
      if (fastStreak >= FAST_STREAK && pressureAllowed('fast')) pendingPressure = 'fast';
      cardShownAt = null;
    }

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
    // Every line the player says, for IT to quote back if they contradict it.
    run.set({ said: { ...(before.said ?? {}), [currentNodeId]: edge.playerText ?? '' } });
    const caught = (edge.contradicts ?? []).find((c) => before.choices?.[c.node] === c.side);
    if (caught) {
      pendingContradiction = { node: caught.node, text: before.said?.[caught.node] ?? '' };
      // Word travels: this NPC's trust loses a sync.
      const bonds = run.get().bonds ?? {};
      const mine = bonds[npc.npc] ?? { syncs: 0, bids: 0 };
      run.set({ bonds: { ...bonds, [npc.npc]: { ...mine, syncs: Math.max(0, mine.syncs - 1) } } });
    }
    encounterSwipes.push(swipeKey);

    const node = currentNode();
    const synced = !!node.mood && activeEmotion === node.mood;
    const turnedToward = !!node.bid?.includes(swipeKey);
    if (synced || turnedToward) {
      const wasTrusted = isTrusted(run.get().bonds?.[npc.npc]);
      run.set({ bonds: recordTrust(run.get().bonds ?? {}, npc.npc, { synced, turnedToward }) });
      if (!wasTrusted && isTrusted(run.get().bonds[npc.npc]) && npc.connect) pendingConnect = true;
    }
    if (turnedToward) turnedTowardThisEncounter = true;
    reactionGift = turnedToward ? giveFeeling() : undefined;

    // How this specific choice actually landed with the NPC — trust and
    // stability are their rapport/comfort with you, not a right-or-wrong
    // score (see docs/HANDOFF.md's stat meanings). Uses the post-clamp
    // delta, not the raw authored effect, so a stat already maxed out
    // doesn't overstate how much this choice moved anything. Bends their
    // leitmotif live and moves the confrontation chord's voicing.
    const trustDelta = (patch.trust ?? before.trust) - before.trust;
    const stabilityDelta = (patch.stability ?? before.stability) - before.stability;
    if (before.stability > 2 && (patch.stability ?? before.stability) <= 2) audio.playLowBattery();
    audio.nudgeLeitmotifMood(trustDelta + stabilityDelta);

    // The impact lands on their reaction: how hard is how much their TRU
    // and STB moved; the new color is the mood this answer sends them into
    // (the next moment's), or holds if this was their last.
    audio.stopPulse();
    const nextMood = edge.nextNodeId ? npc.nodes[edge.nextNodeId]?.mood : node.mood;
    pendingImpact = {
      strength: Math.min(1, (Math.abs(trustDelta) + Math.abs(stabilityDelta)) / 4),
      mood: nextMood ?? node.mood,
      turnedToward,
    };
    drama.mismatch = false;

    // Tally every FEELZ pick for the whole run, not just this node — feeds
    // the dominant-emotion IT read at the end of the encounter (proceed()).
    const counts = run.get().emotionCounts;
    run.set({ emotionCounts: { ...counts, [activeEmotion]: (counts[activeEmotion] ?? 0) + 1 } });

    pendingEdge = edge;
    reactionEmotion = activeEmotion;
    reactionSwipeKey = swipeKey;
    if (edge.playerText) stage = 'say';
    else enterReaction();

    const magnitude =
      Object.values(edge.effects || {}).reduce((sum, v) => sum + Math.abs(v), 0) +
      Math.abs(edge.debtDelta || 0);
    const intensity = magnitude >= STRONG_HIT_THRESHOLD ? 'strong' : 'weak';

    fx.flash(intensity, activeEmotionColor);
    audio.playHit(intensity);
    // Struck *after* the mood nudge above, so what you hear is the chord as
    // this choice just left it — the answer to the swipe, not a repeat of
    // where things stood before it.
    audio.strikeChord(emotionsForClass(run.get().loadout, run.get().unlocked), harmonicFunction());

    // Freeze frame: the committed card hangs for a beat before anything
    // answers it.
    stageEl.classList.add('is-frozen');
    setTimeout(() => {
      stageEl.classList.remove('is-frozen');
      if (stage === 'reaction') landImpact();
      render();
    }, FREEZE_MS);
  }

  // Impact: ring out from the center in the new mood's color, shake as hard
  // as it landed, ease the wave to the new mood, gold ripple on a bid.
  function landImpact() {
    if (!pendingImpact) return;
    const { strength, mood, turnedToward } = pendingImpact;
    pendingImpact = null;
    const now = performance.now();
    easeMoodTo(mood);
    drama.shock = { t0: now, strength, color: moodHex(mood) };
    drama.ripple = turnedToward ? { t0: now + 300 } : drama.ripple;
    fx.shake(strength > 0.6 ? 'strong' : strength > 0.2 ? 'weak' : 'subtle');
  }

  // A shared moment: the NPC's feeling becomes the player's (engine/
  // unlocks.js). No announcement: the next time the wheel shows, the new
  // slice lights up and rings its own tone.
  function giveFeeling() {
    const state = run.get();
    const gift = giftFor(npc.npc, state);
    if (!gift) return null;
    run.set({
      unlocked: [...(state.unlocked ?? []), gift],
      giftedBy: { ...(state.giftedBy ?? {}), [npc.npc]: gift },
    });
    freshFeeling = gift;
    return gift;
  }

  // Contacts dock (engine/contacts.js): the Therapist always, reachable only
  // with enough bars (Trust) and Wi-Fi (Lucidity); anyone who trusts you.
  function createDock(state) {
    const dock = document.createElement('div');
    dock.className = 'dx-dock';
    for (const who of contactsFor(state, npc.npc)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dx-dock__contact';
      btn.textContent = CONTACTS[who].name.charAt(0);
      btn.setAttribute('aria-label', `Call ${CONTACTS[who].name}`);
      const offline = who === 'THERAPIST' && !therapistReachable(state);
      if (offline) btn.classList.add('is-offline');
      if (calledThisEncounter.has(who)) btn.classList.add('is-used');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (itPopup || calledThisEncounter.has(who)) return;
        if (offline) {
          audio.playCallFailed();
          btn.classList.add('is-failed');
          setTimeout(() => btn.classList.remove('is-failed'), 900);
          return;
        }
        calledThisEncounter.add(who);
        btn.classList.add('is-used');
        placeCall(who);
      });
      dock.appendChild(btn);
    }
    return dock;
  }

  // A call: it rings, then greeting, their read (that slice glows on the
  // wheel), their advice. Tap through; the wheel and card wait underneath.
  function placeCall(who) {
    clearStall();
    const node = currentNode();
    const name = npc.npc.charAt(0) + npc.npc.slice(1).toLowerCase();
    const call = callFor(who, { state: run.get(), currentName: name, mood: node.mood });
    const overlay = document.createElement('div');
    overlay.className = 'dx-call';
    overlay.innerHTML = `<p class="dx-call__who">CALLING ${CONTACTS[who].name.toUpperCase()}…</p>`;
    stageEl.appendChild(overlay);
    itPopup = { destroy: () => overlay.remove() };
    const ringMs = audio.playPhoneRing();
    let i = 0;
    let tw = null;
    const box = document.createElement('div');
    box.className = 'dx-call__box';
    const avatar = document.createElement('div');
    avatar.className = 'dx-call__avatar';
    avatar.textContent = CONTACTS[who].name.charAt(0);
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.append(avatar, p);
    function next() {
      if (i >= call.lines.length) {
        overlay.remove();
        itPopup = null;
        startStall();
        return;
      }
      if (i === 1) { hintedEmotion = call.read; dartboard?.hint(call.read); }
      tw = createTypewriter(p, call.lines[i], { onChar: audio.playTypewriterTick });
      i += 1;
    }
    setTimeout(() => {
      overlay.querySelector('.dx-call__who').textContent = CONTACTS[who].name.toUpperCase();
      overlay.appendChild(box);
      next();
      overlay.addEventListener('click', () => {
        if (tw && !tw.isDone()) tw.finish();
        else next();
      });
    }, ringMs);
  }

  // The connection moment: this person just let you in. The world closes
  // to a vignette on them, all sound drops out, then a crack and warmth,
  // then a story beat written for this NPC and the player's class.
  function showConnection(onDone) {
    const text = npc.connect[run.get().loadout] ?? Object.values(npc.connect)[0];
    const overlay = document.createElement('div');
    overlay.className = 'dx-connect';
    stageEl.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-closing'));
    const silence = audio.silenceThenCrack(1600);
    setTimeout(() => {
      overlay.classList.add('is-open');
      const box = document.createElement('div');
      box.className = 'dx-connect__beat';
      const p = document.createElement('p');
      p.className = 'dx-text';
      box.appendChild(p);
      overlay.appendChild(box);
      const tw = createTypewriter(p, text, { onChar: audio.playTypewriterTick });
      overlay.addEventListener('click', () => {
        if (!tw.isDone()) { tw.finish(); return; }
        tw.destroy();
        overlay.remove();
        onDone();
      });
    }, silence + 500);
  }

  // The last beat of an encounter where they came to trust you: the room
  // goes dark, their bust fades in large and centered, one on one — the
  // way it felt walking into their place — and they ask to stay in touch.
  // Tapping through drops their contact into the dock for later encounters.
  function showContactAsk(onDone) {
    const text = npc.contactAsk[run.get().loadout] ?? Object.values(npc.contactAsk)[0];
    stageEl.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'dx-connect is-asking';
    stageEl.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-closing'));
    const bust = createNpcPortrait(npc.npc, npc.accentColor, npc.portrait);
    bust.el.classList.add('dx-connect__bust');
    overlay.appendChild(bust.el);
    const name = document.createElement('p');
    name.className = 'dx-connect__name';
    name.textContent = npc.npc;
    overlay.appendChild(name);
    const box = document.createElement('div');
    box.className = 'dx-connect__beat';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.appendChild(p);
    let tw = null;
    setTimeout(() => {
      overlay.appendChild(box);
      tw = createTypewriter(p, text, { onChar: audio.playTypewriterTick });
    }, 1300);
    overlay.addEventListener('click', () => {
      if (!tw) return;
      if (!tw.isDone()) { tw.finish(); return; }
      tw.destroy();
      audio.playFeelzPing();
      overlay.remove();
      onDone();
    });
  }

  // Every IT/SO popup in an encounter goes through here, so their lines
  // sharpen as the lake worsens (engine/itSharpen.js).
  function sayIt(opts) {
    const text = sharpen(resolveItText(opts.text, run.get().loadout), opts.voice ?? 'it', run.get().truthDebt);
    return createItPopup(stageEl, { ...opts, text });
  }

  // The prompt as the player sees it: the NPC's read on their class before
  // the first line of the encounter (OPENER), and any per-class line for
  // this node (CLASS), then the authored prompt.
  function promptText() {
    const loadout = run.get().loadout;
    const node = currentNode();
    const parts = [];
    if (beatIndex === 0 && npc.opener?.[loadout]) parts.push(npc.opener[loadout]);
    if (node.byClass?.[loadout]) parts.push(node.byClass[loadout]);
    parts.push(node.prompt);
    return parts.join(' ');
  }

  // Authored variations around the reaction (manuscript IF PICK / IF GIFT).
  function varyReaction(edge) {
    const before = edge.byPick?.[reactionEmotion];
    const after = reactionGift === undefined ? null : edge.byGift?.[reactionGift ?? 'none'];
    return [before, edge.npcReaction, after].filter(Boolean).join(' ');
  }

  function continueAfterReaction() {
    if (stage !== 'reaction' || !pendingEdge) return;
    if (pendingConnect) {
      pendingConnect = false;
      showConnection(continueAfterReaction);
      return;
    }
    if (pendingContradiction) {
      const { node, text } = pendingContradiction;
      pendingContradiction = null;
      const who = node.split('_')[0];
      const name = who.charAt(0).toUpperCase() + who.slice(1);
      const lines = [
        `Funny. You told ${name} "${text}"`,
        `Word travels. ${name} heard "${text}"`,
        `That's not what you told ${name}. You said "${text}"`,
      ];
      itPopup = sayIt({
        text: lines[Math.floor(Math.random() * lines.length)],
        voice: 'it',
        onClose: () => { itPopup?.destroy(); itPopup = null; continueAfterReaction(); },
      });
      return;
    }
    if (pendingPressure) {
      const kind = pendingPressure;
      pendingPressure = null;
      run.set({ pressureSaid: { ...(run.get().pressureSaid ?? {}), [kind]: true } });
      if (kind === 'fast') fastStreak = 0;
      else skimStreak = 0;
      showItThenSo(pressureLine(`${kind}It`), pressureLine(`${kind}So`), continueAfterReaction);
      return;
    }
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
      bloomedThisEncounter = true;
      showBloomIt(Math.max(...bloom.newlyFired), () => proceed(edge));
      return;
    }
    proceed(edge);
  }

  // SO answers both of this scene's own IT moments — the pattern-reading
  // ones (a bloom, or an end-of-encounter finding), not IT generally.
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
    const debt = run.get().truthDebt;
    itPopup = sayIt({
      text: fillReadings(itText, debt),
      loadout: run.get().loadout,
      flashClose: true,
      onClose: () => {
        itPopup?.destroy();
        itPopup = sayIt({
          text: fillReadings(soText, debt),
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

  // An answer can carry its own IT/SO reaction (manuscript IT:/SO: under a
  // swipe), shown after the NPC's reaction and before anything else moves.
  function proceed(edge) {
    if (edge.itText && edge.soText) {
      showItThenSo(edge.itText, edge.soText, () => proceedAfterIt(edge));
    } else if (edge.itText || edge.soText) {
      itPopup = sayIt({
        text: fillReadings(edge.itText ?? edge.soText, run.get().truthDebt),
        loadout: run.get().loadout,
        voice: edge.itText ? 'it' : 'so',
        onClose: () => {
          itPopup?.destroy();
          itPopup = null;
          proceedAfterIt(edge);
        },
      });
    } else {
      proceedAfterIt(edge);
    }
  }

  function proceedAfterIt(edge) {
    if (run.get().truthDebt >= 10) {
      onComplete({ jumpTo: 'reckoning' });
      return;
    }

    if (edge.nextNodeId) {
      currentNodeId = resolveGatedNode(edge.nextNodeId, npc, run.get());
      enterNode();
      return;
    }

    const afterAsk = () => {
      if (shouldUnlockTrust(run.get())) showTrustUnlock(() => finishEncounter());
      else finishEncounter();
    };
    if (npc.contactAsk && isTrusted(run.get().bonds?.[npc.npc])) showContactAsk(afterAsk);
    else afterAsk();
  }

  // Two people trust you: the Trust feeling lights up on the wheel for the
  // rest of the run. Said in FEELZ's flat voice, like the homework ping.
  // Same as every other feeling: no announcement. It's queued on the run
  // (the encounter is ending) and surfaces with the full entrance the first
  // time the wheel shows in the next encounter.
  function showTrustUnlock(onDone) {
    run.set({ unlocked: [...(run.get().unlocked ?? []), 'Trust'], pendingFresh: 'Trust' });
    onDone();
  }

  function finishEncounter() {
    // An authored outro (the Therapist's homework + IT/SO sign-off) *is*
    // this encounter's closing IT moment, so it replaces the emotion-lean
    // read below rather than stacking a second IT/SO pair on top of it.
    if (npc.outro?.length) {
      startOutro();
      return;
    }

    showFindingIfAny(onComplete);
  }

  // End of encounter: IT and SO speak only if they've noticed something
  // new (engine/itFindings.js) — at most once per encounter, and not at all
  // if a bloom already interrupted it. Both records update either way, so
  // the next encounter is compared against where the player is now.
  function showFindingIfAny(onDone) {
    const state = run.get();

    const side = encounterSide(encounterSwipes);
    const flipped = side && state.itLastSide && side !== state.itLastSide;
    if (side) run.set({ itLastSide: side });

    // Below 2 picks there's no lean yet — a single data point is a coin flip.
    const counts = state.emotionCounts;
    const totalPicks = Object.values(counts).reduce((a, b) => a + b, 0);
    const dominant = totalPicks >= 2 ? getDominantEmotion(counts) : undefined;
    const leanShifted = dominant !== undefined && dominant !== state.itLastLean;
    if (dominant !== undefined) run.set({ itLastLean: dominant });

    if (bloomedThisEncounter) {
      onDone();
    } else if (flipped) {
      showItThenSo(FLIP_TEXT[side].it, FLIP_TEXT[side].so, onDone);
    } else if (leanShifted) {
      showEmotionLeanIt(dominant, onDone);
    } else {
      onDone();
    }
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
      itPopup = sayIt({
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
    if (beat.kind === 'notify') {
      stageEl.innerHTML = '';
      itPopup = createFeelzNotification(stageEl, {
        text: beat.text,
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
  // A feeling unlocked at the end of the last encounter (Trust) makes its
  // entrance on this one's first wheel.
  if (run.get().pendingFresh) {
    freshFeeling = run.get().pendingFresh;
    run.set({ pendingFresh: null });
  }
  audio.startLeitmotif(npc.npc);
  audio.preloadTypewriterTick();
  enterNode();

  return function unmount() {
    typewriter?.destroy();
    pickTypewriter?.destroy();
    spotlight?.destroy();
    itPopup?.destroy();
    oscilloscope?.destroy();
    dartboard?.destroy();
    // Also cuts any chord, FEELZ drone, or hover tone still sounding — a
    // strike/drone outlasts a scene exit, so without this the encounter's
    // audio bleeds into the next scene.
    audio.stopLeitmotif();
    audio.stopPulse();
    clearStall();
    statusBar?.destroy();
    stageEl.classList.remove('is-frozen');
    stageEl.innerHTML = '';
  };
}
