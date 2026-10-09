// Scene type: 'dialog'. Runs one NPC's node graph (FEELZ pick -> swipe ->
// reaction -> next node) to completion, then hands control back to the
// sequencer. See docs/SCENE_TYPES.md for the full contract.
//
// scene shape: { type: 'dialog', id: string, npc: <NPC content JSON> }
import { resolveCard, resolveGatedNode, restAfter } from '../engine/cardEngine.js';
import { later, cancelLater, onPauseChange } from '../shell/pauseBus.js';
import { composeReaction } from '../engine/reactions.js';
import { composeSay } from '../engine/sayTone.js';
import { checkBloomTriggers } from '../engine/debtEngine.js';
import { BLOOM_IT_TEXT } from '../engine/itBlooms.js';
import { emotionLeanText } from '../engine/itEmotionLean.js';
import { SO_BLOOM_TEXT, soEmotionLeanText } from '../engine/soRebuttals.js';
import { FLIP_TEXT, encounterSide } from '../engine/itFindings.js';
import { fillReadings, hazeFor } from '../engine/lake.js';
import { recordTrust, shouldUnlockTrust, isTrusted } from '../engine/trust.js';
import { giftFor } from '../engine/unlocks.js';
import { STALL_MARKS, FAST_MS, FAST_STREAK, SKIM_STREAK, pressureLine } from '../engine/itPressure.js';
import { createTypewriter } from '../ui/typewriterText.js';
import { createFeelzNotification } from '../ui/feelzNotification.js';
import { createItPopup, resolveItText } from '../ui/itPopup.js';
import { sharpen } from '../engine/itSharpen.js';
import { createStatusBar } from '../ui/statusBar.js';
import { CONTACTS, contactsFor, therapistReachable, voicemailFor, callFor } from '../engine/contacts.js';
import { createNpcPortrait } from '../ui/npcPortrait.js';
import { createFeelzDartboard } from '../ui/feelzDartboard.js';
import { EMOTIONS, emotionColor, emotionsForClass, getDominantEmotion } from '../engine/loadout.js';
import { createSwipeCard } from '../ui/swipeCard.js';
import { createLakeGauge } from '../ui/lakeGauge.js';
import { createOscilloscope, wheelSteps } from '../ui/oscilloscope.js';
import { createSpotlight } from '../ui/spotlight.js';
import { loadSettings } from '../shell/settings.js';
import * as encounterMusic from '../shell/encounterMusic.js';
import * as fx from '../shell/fx.js';
import * as audio from '../shell/audio.js';
import * as voices from '../shell/voices.js';
import { quoteSpeech } from '../ui/speech.js';
import { createOpponentFx } from '../ui/opponentFx.js';

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

// What each NPC says when they catch you contradicting yourself and the
// answer has no CAUGHT line of its own.
// IT and SO turn co-conspirators on a lie streak: [IT, SO], one pair per
// encounter, in order across the run. They make lying feel good, which is
// the point — the cost shows up later and quietly (the haze, foggy calls,
// the ending), never as a scolding here.
const COZY_LINES = [
  ["Smooth. They didn't even blink.", 'See? Easier. Nobody drowns from one more.'],
  ["Feel that? Warm. That's what it's like when nobody's mad at you.", "And they're smiling. You did that. Why fix what works?"],
  ["The water's nice down here. Quiet.", "The truth can wait. It's patient. You're tired."],
  ["You're good at this. Like, actually good.", "Everybody's happier. That's not a lie. That's a fact."],
];

const CAUGHT_FALLBACK = {
  DEBORAH: '"That\'s not what you said a minute ago, honey."',
  RWANDA: '"Huh. That\'s a different answer."',
  SAMUN: '"Wait, wait. You just said the opposite."',
  RICK: '"Thought you said different."',
};

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
  // The Therapist's PICK: line for the current feeling, drawn under his
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
  // Set once a TRYCALL outro beat has put the therapist's own contact in
  // the dock; it stays on screen for the rest of the call.
  let dockIntroduced = false;
  // Slices lit so far by the Therapist's intake read (see promptText's lit_ cues).
  const intakeLit = new Set();
  // The tutorial's last exercise (outro TRYFEEL): find him on your wheel
  // and watch the vectorscope. { target, matched, drawn, pickedAt }.
  let trial = null;
  // His comments while you look for him (manuscript TRYNEAR / TRYFAR).
  let trialComments = { near: null, far: null };
  // Set once the player turns toward one of this NPC's bids; warms the
  // portrait for the rest of the encounter (engine/trust.js).
  let turnedTowardThisEncounter = false;
  // Answers this encounter that neither met their mood nor turned toward a
  // bid — each pushes the oscilloscope's two lines a little further apart.
  let missesHere = 0;
  // How the last answer landed (TRU+STB moved) and whether it missed them
  // entirely — read by enterReaction for the voice bark and the drift.
  let reactionDelta = 0;
  let reactionMissed = false;
  // Nodes whose shut-out sound already played.
  const signalLostAt = new Set();
  // Every feeling picked in this encounter, in order: the history strip.
  const encounterPicks = [];
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
  // This NPC's own callout, when they catch you contradicting yourself in
  // front of them: shown as the last page of their reaction.
  let pendingCaught = null;
  // IT and SO cheering a lie streak on (COZY_LINES), shown after the reaction.
  let pendingCozy = null;
  // A coach line (first-time moment): one short line in the dialog itself,
  // under their words, with the piece it's about glowing gold, until the
  // player does the thing it asks (until: 'sync' | 'pick' | 'swipe' | 'call')
  // or the moment passes. Each key once a run (run.coachSeen); never popups.
  let coach = null;
  // The opponent's weather (ui/opponentFx.js); picking their real feeling
  // settles it until this time.
  let opfx = null;
  // Set on unmount, so a delayed call can't land in the next scene.
  let unmounted = false;
  let settleUntil = 0;
  let cozyThisEncounter = false;
  // Phone: the live status bar (rebuilt each render; its clock ticks), and
  // who's already been called this encounter (one call per contact).
  let statusBar = null;
  let itTyping = false;
  const calledThisEncounter = new Set();
  // A contact's read, kept glowing on the wheel until the next moment.
  let hintedEmotion = null;

  function clearStall() {
    stallTimers.forEach(cancelLater);
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
      stallTimers.push(later(() => {
        itTyping = true;
        statusBar?.setTyping(true);
      }, mark.ms - 2500));
      stallTimers.push(later(() => {
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

  function lineReadThrough(readToEnd) {
    if (readToEnd) skimStreak = 0;
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

  // The feeling a node shows: its MASK if it wears one, else its MOOD.
  function shownMood(node) {
    return node?.mask ?? node?.mood;
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
    // A masked node shows its mask; the real mood flickers under it now and
    // then on the oscilloscope (the tell), and only the real one syncs.
    easeMoodTo(shownMood(currentNode()));
    drama.under = currentNode().mask ? moodHex(currentNode().mood) : null;
    coach = null;
    // The heartbeat would fight an arrangement's own drums.
    if (!encounterMusic.claims(npc.npc)) audio.startPulse(() => drama.tension);
    audio.strikeChord(emotionsForClass(run.get().loadout, run.get().unlocked), harmonicFunction());
    render();
  }

  // npc.reveal ({ meters?: nodeId, debt?: nodeId }, authored as REVEAL:
  // lines) keeps a HUD piece off screen until the Therapist reaches it, so a
  // first-time player isn't handed every readout at once with nothing
  // pointing at any of it. Debt also shows early the moment it's non-zero —
  // a lie shouldn't land invisibly. NPCs without `reveal` show everything.
  let lakeCued = false;
  // Pieces revealed `on cue` ({cue:scope}, {cue:instruments}, the TRYCALL
  // for the dock, and each meter's {cue:stability|trust|lucidity|integrity}).
  const cuesFired = new Set();
  const METERS = ['stability', 'trust', 'lucidity', 'integrity'];
  function fireCue(name) {
    const first = !cuesFired.has(name);
    cuesFired.add(name);
    if (METERS.includes(name)) {
      if (first) statusBar?.reveal?.(name); else statusBar?.flash?.(name);
    }
    // {cue:tone_fifth} etc.: the interval he's describing, played (the science lesson).
    if (name.startsWith('tone_')) audio.playIntervalDemo(name.slice(5));
  }
  function isRevealed(kind) {
    const gateNode = npc.reveal?.[kind];
    if (gateNode === 'cue') return cuesFired.has(kind);
    // After its gate node — or earlier, when a reaction reaches a
    // {mark:lake} cue (a lie put debt on the lake before its turn: the
    // therapist finishes the bars first, then points at the lake).
    return !gateNode || answered.has(gateNode) || (kind === 'debt' && lakeCued);
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
    // Their voice answers first: one word, by how your answer landed.
    voices.bark(npc.npc, reactionDelta, { delayMs: 220 });
    if (reactionMissed) audio.playDrift();
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
    // Its own band across the portrait (a heart monitor running through
    // their picture), so no text box ever covers it. Placed once the
    // portrait has laid out; see placeScopeBand().
    const scopeCanvas = document.createElement('canvas');
    scopeCanvas.className = 'dx-pattern-bg dx-scope-band';
    screen.appendChild(scopeCanvas);
    const mood = stage === 'prompt' ? currentNode()?.mood : null;
    const shutOutNow = stage === 'prompt' && /(_shut_down|_closed|_hard)$/.test(currentNodeId ?? '');
    oscilloscope = createOscilloscope(scopeCanvas, {
      getPlayerStats: () => run.get(),
      npcColor: drama.color?.to ?? '#ffffff',
      isSynced: () => !!mood && activeEmotion === mood,
      getDrama: () => drama,
      getConnection: () => connection(mood, shutOutNow),
      getPlayerColor: () => {
        const held = activeEmotion ?? encounterPicks.at(-1);
        return held ? moodHex(held) : null;
      },
      getHistory: () => encounterPicks.map(moodHex),
      // The feelings the vectorscope and correlation needle compare: yours
      // (held, else the last you picked) against the one they're showing.
      // Theirs is the real feeling, not a mask: the line can lie, the shape
      // can't (the same feeling that syncs, so the tutorial's lesson holds).
      getFeelings: () => ({ mine: activeEmotion ?? encounterPicks.at(-1) ?? null, theirs: (stage === 'outro' && trial ? trial.target : currentNode()?.mood ?? shownMood(currentNode())) ?? null }),
      getHighlight: () => coach?.highlight ?? trialHighlight(),
      getVisibility: npc.reveal ? () => ({ traces: isRevealed('scope'), instruments: isRevealed('instruments') }) : undefined,
    });

    const content = document.createElement('div');
    content.className = 'dx-game-content dx-game-content--live-bg';
    screen.appendChild(content);

    statusBar?.destroy();
    const shutOut = stage === 'prompt' && /(_shut_down|_closed|_hard)$/.test(currentNodeId ?? '');
    // In the tutorial, the meters come in one at a time as he names them.
    const hiddenMeters = npc.reveal?.meters ? METERS.filter((m) => !cuesFired.has(m)) : [];
    statusBar = createStatusBar(runState, { typing: itTyping, airplane: shutOut, quiet: !isRevealed('meters'), hidden: hiddenMeters });
    if (shutOut && !signalLostAt.has(currentNodeId)) {
      signalLostAt.add(currentNodeId);
      audio.playSignalLost();
    }
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
      if (outroBeat.kind === 'hangup') content.appendChild(line);
      else speechBubble(content, 'them').appendChild(line);

      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      const tryCall = outroBeat.kind === 'trycall';
      const tryFeel = outroBeat.kind === 'tryfeel';
      if (tryCall) tapHint.textContent = '(tap his contact)';
      if (tryCall) fireCue('dock');
      if (tryFeel) {
        // Each pick is explained by what it drew: the lesson is in the doing.
        const steps = activeEmotion ? wheelSteps(activeEmotion, trial.target) : null;
        tapHint.textContent = trial.matched
          ? (trial.want === 'miss' ? '(tap to continue)' : '(a still circle: you found him. Tap to continue)')
          : trial.want === 'miss' ? (activeEmotion ? '(try a different one)' : '(pick any feeling)')
          : steps === null ? '(watch the color flickering under his line, then find it on your wheel)'
          : steps >= 3 ? '(the needle leans left: you two are pulling apart. Try another)'
          : '(a busy shape: close, not there yet. Try another)';
        if (trial.drawn) tapHint.hidden = false; // a re-render after a pick: the line is already up
      }
      // While you look for him, he reacts to each pick in his own way.
      if (tryFeel && trial.comment && !trial.matched) {
        const said = document.createElement('p');
        said.className = 'dx-text dx-pick-line';
        content.insertBefore(said, tapHint);
        pickTypewriter = createTypewriter(said, trial.comment, { onChar: audio.playTypewriterTick, startRevealed: !trial.commentFresh });
        trial.commentFresh = false;
      }
      typewriter = createTypewriter(line, outroBeat.text, {
        onChar: audio.playTypewriterTick,
        onDone: () => { tapHint.hidden = false; if (trial) trial.drawn = true; },
        onMark: fireCue, // {cue:scope} / {cue:instruments}: the scope pieces appear as he names them
        startRevealed: tryFeel && trial.drawn, // re-renders on each pick don't replay the line
      });
      if (outroBeat.kind !== 'hangup') markSpeaking(portrait.el, typewriter);

      // His last exercise: the wheel comes back without a card. Each pick
      // redraws the vectorscope against his feeling; his own feeling closes
      // it into a still circle, and only then does the call move on.
      if (tryFeel) {
        const board = createFeelzDartboard({
          loadout: run.get().loadout,
          unlocked: run.get().unlocked,
          selected: activeEmotion,
          harmonicFunction: 'tonic',
          onSelect: (emotion) => {
            activeEmotion = emotion;
            trial.pickedAt = performance.now();
            // want:miss is done by any feeling but his; want:match by his.
            const done = trial.want === 'miss' ? emotion !== trial.target : emotion === trial.target;
            if (done && !trial.matched) {
              trial.matched = true;
              if (trial.want !== 'miss') audio.playSyncChime();
            }
            if (!done && trial.want !== 'miss') {
              const comment = wheelSteps(emotion, trial.target) >= 3 ? trialComments.far : trialComments.near;
              if (comment && comment !== trial.comment) { trial.comment = comment; trial.commentFresh = true; }
            }
            render();
          },
        });
        dartboard = board;
        content.appendChild(board.el);
      }

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) typewriter.finish();
        else if (tryFeel) {
          // The tap that picked a slice also lands here; it doesn't count.
          if (trial.matched && performance.now() - (trial.pickedAt ?? 0) > 700) { audio.stopFeelzDrone(); nextOutroBeat(); }
        } else if (!tryCall) nextOutroBeat();
      });
    } else if (stage === 'say') {
      // Its own bordered box, in the same screen slot the swipe card and
      // dartboard just occupied — the player's line replaces the choice UI
      // rather than appearing as loose text, so it reads as "this is what
      // that choice was" in the exact place the choice just happened.
      const sayBox = speechBubble(content, 'you');
      sayBox.classList.add('dx-say-box');
      portrait.el.classList.add('is-listening'); // your turn: their picture steps back

      const say = document.createElement('p');
      say.className = 'dx-text dx-say';
      sayBox.appendChild(say);


      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      typewriter = createTypewriter(say, quoteSpeech(composeSay(pendingEdge.playerText, reactionEmotion, reactionSwipeKey)), {
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
      speechBubble(content, 'them').appendChild(reaction);


      const tapHint = document.createElement('p');
      tapHint.className = 'dx-text dx-tap-hint';
      tapHint.textContent = '(tap to continue)';
      tapHint.hidden = true;
      content.appendChild(tapHint);

      typewriter = createTypewriter(
        reaction,
        reactionTextFor(pendingEdge)
          + (pendingCaught ? ` {mark:caught}${pendingCaught}` : ''),
        {
          onChar: audio.playTypewriterTick,
          narration: 'reaction',
          onDone: () => { tapHint.hidden = false; },
          onMark: (name) => {
            if (name === 'lake') cueLake(screen, reaction);
            if (name === 'caught') landCaught(screen);
            // {cue:stability|trust|lucidity|integrity}: flash that icon.
            fireCue(name);
          },
        },
      );
      markSpeaking(portrait.el, typewriter);

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) tapLine(typewriter);
        else continueAfterReaction();
      });
    } else {
      const prompt = document.createElement('p');
      prompt.className = 'dx-text dx-prompt';
      const promptBubble = speechBubble(content, 'them');
      promptBubble.appendChild(prompt);

      // The Therapist's read of the feeling just picked — imagery, never the
      // emotion's name (feelings are symbols only). Only nodes with PICK
      // lines have any; everyone else skips this entirely.
      const pickText = activeEmotion && currentNode().picks?.[activeEmotion];
      if (pickText) {
        const pickLine = document.createElement('p');
        pickLine.className = 'dx-text dx-pick-line';
        promptBubble.appendChild(pickLine);
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
        promptText: activeEmotion ? 'Swipe to respond.' : 'Pick a feeling first.',
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
        lit: [...intakeLit], // slices the intake read already lit, if this redraws mid-read
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
            else { audio.playSyncChime(); settleUntil = performance.now() + 1400; }
          }
          // A coach waiting on a pick (or on finding their feeling) is done.
          coachDid('pick'); // any feeling tried: what it means is the player's call
          render();
        },
      });
      interactive.appendChild(dartboard.el);
      if (hintedEmotion) dartboard.hint(hintedEmotion);

      // The intake read ({intake} in the prompt): the wheel is up but asleep,
      // the card not yet, and each feeling he names in your read lights its
      // slice, the way the FEELZ profile screen did, before he says "See the
      // three lighting up?" The wheel wakes when the prompt is done.
      const intakeReading = !promptRevealed && currentNode().prompt?.includes('{intake}') && !!run.get().intakeRead;
      if (intakeReading) {
        interactive.hidden = false;
        card.el.style.visibility = 'hidden';
        dartboard.el.classList.add('is-dormant');
      }

      // Re-renders triggered by picking a FEELZ emotion reuse this same node's
      // prompt — startRevealed skips replaying the draw from scratch.
      const promptChars = promptText().replace(/{[^}]*}/g, '').length || 1;
      let typed = 0;
      typewriter = createTypewriter(prompt, promptText(), {
        onMark: (name) => {
          if (name.startsWith('lit_')) { intakeLit.add(name.slice(4)); dartboard?.light(name.slice(4)); }
        },
        onChar: () => {
          audio.playTypewriterTick();
          typed += 1;
          drama.tension = Math.max(drama.tension, Math.min(1, typed / promptChars));
        },
        onDone: () => {
          // Instant text draws nothing to cut short, so it always counts as read.
          if (!promptRevealed) lineReadThrough(typed >= promptChars || loadSettings().textSpeed === 'instant');
          promptRevealed = true;
          drama.tension = 1;
          interactive.hidden = false;
          // A new mechanic here? He calls once the question and the wheel are up.
          if (!npc.reveal) { const at = currentNodeId; later(() => { if (stage === 'prompt' && currentNodeId === at) nodeCoach(); }, 500); }
          if (intakeReading) {
            // Any of the class's feelings the read didn't name light now, then it wakes.
            emotionsForClass(run.get().loadout).forEach((e) => dartboard?.light(e));
            dartboard?.wake();
            // ...and it closes on the class's own sound from the evaluation (the
            // gunshot, the bowl, the choir): a throwback to where it came from.
            audio.playClassSigil(run.get().loadout);
            card.el.style.visibility = '';
          }
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
      if (!wasRevealed) markSpeaking(portrait.el, typewriter);

      screen.addEventListener('click', () => {
        if (typewriter && !typewriter.isDone()) tapLine(typewriter);
        else if (pickTypewriter && !pickTypewriter.isDone()) pickTypewriter.finish();
      });
    }

    // Truth Debt, shown as the lake's water quality (ui/lakeGauge.js).
    const lake = createLakeGauge(runState.truthDebt).el;
    if (applyReveal(lake, 'debt')) spotlitHud.push(lake);
    // The contacts dock sits just above the lake gauge; the lake stays the
    // floor of the screen.
    if (stage === 'outro' && (outroBeat?.kind === 'trycall' || dockIntroduced)) {
      const dock = createSelfDock(outroBeat.kind === 'trycall');
      content.appendChild(dock);
      if (outroBeat.kind === 'trycall') spotlitHud.push(dock);
    }
    if (stage === 'prompt' && isRevealed('meters') && isRevealed('dock')) content.appendChild(createDock(runState));
    content.appendChild(lake);
    // Deep water: a warm haze closes in from the edges and the sound goes
    // soft, the deeper the lake gets. Cozy, not threatening.
    const haze = hazeFor(runState.truthDebt ?? 0);
    audio.setHaze(haze);
    if (haze > 0) {
      const hazeEl = document.createElement('div');
      hazeEl.className = 'dx-haze';
      hazeEl.style.setProperty('--haze', haze.toFixed(2));
      screen.appendChild(hazeEl);
    }
    stageEl.appendChild(screen);
    opfx ??= createOpponentFx({ npc: npc.npc, getLevel: fxLevel });
    opfx.attach(screen);
    later(placeTask, 60); // after layout: the "try this" line by its target
    placeScopeBand(screen, scopeCanvas, portrait.el);

    // A HUD piece's first appearance is spotlit together with the line
    // introducing it (her reaction), for as long as that beat lasts.
    if (spotlitHud.length) {
      const words = content.querySelector('.dx-reaction');
      spotlight = createSpotlight(screen, [...spotlitHud, words]);
    }
    if (stage === 'prompt' && promptRevealed) spotlightInteractive();
  }

  // Caught: they stop on it. The warmth goes out of their portrait, the
  // scope's lines snap apart with a crack of static, and they say it.
  function landCaught(screen) {
    pendingCaught = null;
    turnedTowardThisEncounter = false;
    screen.querySelector('.dx-portrait')?.classList.remove('is-warm');
    drama.shock = { t0: performance.now(), strength: 1, color: '#ff4040' };
    audio.playStaticNoise(260);
    audio.playGrind();
    fx.shake('weak');
    voices.bark(npc.npc, -1, { delayMs: 120 });
  }

  // The lake arrives mid-reaction: the spotlight moves off the bars and
  // onto the lake, with the words that introduce it. Only when it's still
  // hidden and there's actually something in it (debt above 0).
  function cueLake(screen, words) {
    if (lakeCued || isRevealed('debt') || run.get().truthDebt <= 0) return;
    lakeCued = true;
    revealAnimated.add('debt');
    const lake = screen.querySelector('.dx-lake');
    if (!lake) return;
    lake.classList.remove('is-concealed');
    lake.classList.add('is-revealing');
    audio.playLakeSplash(run.get().truthDebt);
    spotlight?.destroy();
    spotlight = createSpotlight(screen, [lake, words]);
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
    const { edge, patch } = resolveCard(before, currentNode(), swipeKey, activeEmotion, { fog: !npc.reveal }); // the tutorial doesn't fog the Wi-Fi
    run.set(patch);
    // Which way each node went, for anything later that reads it back —
    // today an outro beat's [node=truth|lie] condition.
    run.set({ choices: { ...before.choices, [currentNodeId]: swipeKey } });
    // Every line the player says, for IT to quote back if they contradict it.
    run.set({ said: { ...(before.said ?? {}), [currentNodeId]: edge.playerText ?? '' } });
    // Contradictions. Seen (this NPC heard both lines, earlier in this same
    // encounter) beats heard-about (word traveled from someone else):
    //   seen   -2 syncs, -1 TRU, the bid on this answer doesn't count, and
    //          they call it out themselves (CAUGHT, or a fallback line)
    //   heard  -1 sync, IT quotes the earlier line back
    // Only truth-then-lie pairs are authored: correcting yourself (a lie,
    // then the truth) never counts.
    const tripped = (edge.contradicts ?? []).filter((c) => before.choices?.[c.node] === c.side);
    const seen = tripped.find((c) => npc.nodes[c.node]);
    const heard = tripped.find((c) => !npc.nodes[c.node]);
    if (seen || heard) {
      const bonds = run.get().bonds ?? {};
      const mine = bonds[npc.npc] ?? { syncs: 0, bids: 0 };
      run.set({ bonds: { ...bonds, [npc.npc]: { ...mine, syncs: Math.max(0, mine.syncs - (seen ? 2 : 1)) } } });
    }
    if (seen) {
      run.set({ trust: Math.max(0, (run.get().trust ?? 0) - 1) });
      pendingCaught = edge.caught?.[seen.node] ?? edge.caught?.['*'] ?? CAUGHT_FALLBACK[npc.npc] ?? '"That\'s not what you said."';
    } else if (heard) {
      pendingContradiction = { node: heard.node, text: before.said?.[heard.node] ?? '' };
    }
    encounterSwipes.push(swipeKey);

    const node = currentNode();
    const synced = !!node.mood && activeEmotion === node.mood;
    // Caught contradicting yourself cancels the bid: it can't help and hurt.
    const turnedToward = !seen && !!node.bid?.includes(swipeKey);
    if (synced || turnedToward) {
      const wasTrusted = isTrusted(run.get().bonds?.[npc.npc]);
      run.set({ bonds: recordTrust(run.get().bonds ?? {}, npc.npc, { synced, turnedToward }) });
      if (!wasTrusted && isTrusted(run.get().bonds[npc.npc]) && npc.connect) pendingConnect = true;
    }
    if (turnedToward) turnedTowardThisEncounter = true;
    if (!synced && !turnedToward) missesHere += 1;
    reactionMissed = !synced && !turnedToward;
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
    encounterMusic.react({ delta: trustDelta + stabilityDelta, caught: !!seen, missed: !synced && !turnedToward, closeness: connection(null, false).closeness });
    reactionDelta = seen ? -1 : trustDelta + stabilityDelta;
    coach = null;

    // The impact lands on their reaction: how hard is how much their TRU
    // and STB moved; the new color is the mood this answer sends them into
    // (the next moment's), or holds if this was their last.
    audio.stopPulse();
    const nextMood = edge.nextNodeId ? shownMood(npc.nodes[edge.nextNodeId]) : shownMood(node);
    pendingImpact = {
      strength: Math.min(1, (Math.abs(trustDelta) + Math.abs(stabilityDelta)) / 4),
      mood: nextMood ?? shownMood(node),
      turnedToward,
    };
    drama.mismatch = false;

    // Tally every FEELZ pick for the whole run, not just this node — feeds
    // the dominant-emotion IT read at the end of the encounter (proceed()).
    const counts = run.get().emotionCounts;
    run.set({ emotionCounts: { ...counts, [activeEmotion]: (counts[activeEmotion] ?? 0) + 1 } });
    // In order, for the oscilloscope's history strip (this encounter only).
    encounterPicks.push(activeEmotion);

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

    // A lie goes down easy: a warm exhale, and the water gets a little
    // cozier. Two in a row and IT and SO start cheering (once an encounter,
    // never in the tutorial). A truth breaks the streak.
    if (swipeKey === 'lie') {
      audio.playRelief();
      const streak = (run.get().lieStreak ?? 0) + 1;
      run.set({ lieStreak: streak });
      const said = run.get().cozySaid ?? 0;
      if (streak >= 2 && !cozyThisEncounter && !npc.reveal && said < COZY_LINES.length) {
        pendingCozy = COZY_LINES[said];
        cozyThisEncounter = true;
        run.set({ cozySaid: said + 1 });
      }
    } else {
      run.set({ lieStreak: 0 });
    }

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

  // How strongly the opponent bends the screen (ui/opponentFx.js), 0..1:
  // the battle's phase (answers given) sets the ceiling, getting close calms
  // it, their trust clears it, and finding their feeling settles it a beat.
  // Light in the tutorial; off once the talking is done.
  function fxLevel() {
    if (stage !== 'prompt' && stage !== 'say' && stage !== 'reaction') return 0;
    const { closeness, merged } = connection(null, false);
    if (merged) return 0;
    const ceiling = 0.35 + 0.65 * Math.min(1, encounterSwipes.length / 3);
    let level = ceiling * (1 - closeness * 0.8);
    if (performance.now() < settleUntil) level *= 0.25;
    if (npc.reveal) level *= 0.6;
    return level;
  }


  // ── Who's talking ──
  // Their words sit in a bubble on the left with their name on a tag in
  // their color and a tail up toward their picture; yours sit on the right
  // under a YOU tag. Narration (a hangup) gets no bubble and no name.
  function speechBubble(content, side) {
    const b = document.createElement('div');
    b.className = `dx-speech dx-speech--${side}`;
    if (side === 'them') b.style.setProperty('--speaker', npc.accentColor || 'var(--color-white)');
    const tag = document.createElement('span');
    tag.className = 'dx-speech__name';
    tag.textContent = side === 'them' ? npc.npc : 'YOU';
    b.appendChild(tag);
    content.appendChild(b);
    return b;
  }

  // The speaker's picture (or call avatar) glows while their words type.
  function markSpeaking(el, tw) {
    if (!el || !tw || tw.isDone()) return;
    el.classList.add('is-speaking');
    const check = () => { if (tw.isDone()) el.classList.remove('is-speaking'); else later(check, 120); };
    later(check, 120);
  }

  // ── Coach lines ──
  // Start one (each key once a run, one at a time, not in the tutorial,
  // which teaches these itself) and redraw so it shows under their words.
  // His call about a mechanic, step by step: each line lights up the exact
  // thing he's talking about (the rest of the screen dims, a label points at
  // it) and the call box moves out of its way. When he hangs up, one plain
  // "try this" line stays by the thing until you've tried it (coach.task).
  // He shows what to watch, never which answer is right: what the player
  // does with it is theirs.
  function startCoach(key, guide) {
    if (unmounted || npc.reveal || coach || itPopup) return;
    const seen = run.get().coachSeen ?? [];
    if (seen.includes(key)) return;
    run.set({ coachSeen: [...seen, key] });
    coach = { key, guide, task: null, until: [], highlight: null, pulseWho: null };
    placeIncoming(guide.steps);
  }

  // A guide target as an element: their line (the scope band), the little
  // screen (a stand-in box over where it's drawn), the wheel, the card, or a
  // contact in the dock ('who:DEBORAH').
  function guideTarget(name, screen = stageEl.querySelector('.dx-game-screen')) {
    if (!name || !screen) return null;
    if (name === 'trace') return screen.querySelector('.dx-scope-band');
    if (name === 'wheel') return screen.querySelector('.dx-dartboard');
    if (name === 'card') return screen.querySelector('.dx-swipe-card');
    if (name.startsWith('who:')) return screen.querySelector(`.dx-dock__contact[data-who="${name.slice(4)}"]`);
    if (name === 'scope' || name === 'needle') {
      const r = oscilloscope?.rectOf?.(name);
      if (!r) return null;
      screen.querySelector('.dx-guide-ghost')?.remove();
      const s = screen.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'dx-guide-ghost';
      Object.assign(ghost.style, { left: `${r.left - s.left}px`, top: `${r.top - s.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      screen.appendChild(ghost);
      return ghost;
    }
    return null;
  }

  // A label with a pixel arrow, just above (or below) a target, inside host.
  function guideLabel(host, target, text, cls = 'dx-guide-label') {
    const label = document.createElement('div');
    label.className = cls;
    label.textContent = text;
    host.appendChild(label);
    const h = host.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const above = r.top - h.top > 70;
    label.classList.add(above ? 'is-above' : 'is-below');
    const center = r.left - h.left + r.width / 2;
    label.style.left = `${Math.max(8, Math.min(h.width - 8, center))}px`;
    if (above) label.style.bottom = `${h.bottom - r.top + 8}px`;
    else label.style.top = `${r.bottom - h.top + 8}px`;
    return label;
  }

  // After the call: the "try this" line stays by its target across redraws.
  function placeTask() {
    stageEl.querySelector('.dx-guide-task')?.remove();
    if (!coach?.task || stage !== 'prompt' || itPopup || unmounted) return;
    const target = guideTarget(coach.task.target);
    if (!target || target.closest('[hidden]')) return;
    guideLabel(stageEl, target, coach.task.text, 'dx-guide-task');
  }

  // A coach waiting on something the player did: 'pick', 'call' or 'swipe'.
  function coachDid(event) {
    if (coach?.until.includes(event)) coach = null;
  }

  // His incoming call: rings (on repeat) until tapped, then his lines one
  // step at a time, then he hangs up. Nothing else moves while it's up.
  // steps: [{ say, target?, label? }] (a plain string is one untargeted step).
  function placeIncoming(steps) {
    clearStall();
    const said = (Array.isArray(steps) ? steps : [steps]).map((s) => (typeof s === 'string' ? { say: s } : s));
    const overlay = document.createElement('div');
    overlay.className = 'dx-call is-incoming';
    overlay.style.setProperty('--contact', contactColor('THERAPIST'));
    overlay.innerHTML = '<p class="dx-call__who">THERAPIST CALLING…</p><p class="dx-text dx-tap-hint">(tap to answer)</p>';
    stageEl.appendChild(overlay);
    liftAboveLake(overlay);
    // His T, lit above the dim right where it sits in your dock, ringing.
    const dockT = [...stageEl.querySelectorAll('.dx-dock__contact')].find((b) => b.textContent === 'T');
    const ringIcon = document.createElement('span');
    ringIcon.className = 'dx-call__ringing';
    ringIcon.textContent = 'T';
    if (dockT) {
      dockT.style.visibility = 'hidden'; // one T: the lit one stands in for it while it rings
      const s = overlay.getBoundingClientRect(); // the icon is placed inside the overlay
      const r = dockT.getBoundingClientRect();
      ringIcon.style.left = `${r.left - s.left}px`;
      ringIcon.style.top = `${r.top - s.top}px`;
      ringIcon.style.width = `${r.width}px`;
      ringIcon.style.height = `${r.height}px`;
    } else {
      ringIcon.classList.add('is-floating');
    }
    overlay.appendChild(ringIcon);
    itPopup = { destroy: () => overlay.remove() };
    let answered = false;
    let ringTimer = null;
    const ring = () => {
      if (answered || !overlay.isConnected) return;
      ringTimer = later(ring, audio.playRingtone('THERAPIST') + 400);
    };
    ring();
    const box = document.createElement('div');
    box.className = 'dx-call__box';
    const avatar = document.createElement('div');
    avatar.className = 'dx-call__avatar';
    avatar.textContent = 'T';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.append(avatar, p);
    let i = 0;
    let tw = null;
    let spot = null;
    let label = null;
    // One step: light up what he's talking about, label it, keep the box clear of it.
    function showStep(step) {
      spot?.destroy();
      spot = null;
      label?.remove();
      label = null;
      const screen = stageEl.querySelector('.dx-game-screen');
      const target = guideTarget(step.target, screen);
      overlay.classList.toggle('is-guiding', !!target);
      if (coach) coach.highlight = ['trace', 'scope', 'needle'].includes(step.target) ? step.target : null;
      if (target && screen) {
        spot = createSpotlight(screen, [target]);
        if (step.label) label = guideLabel(overlay, target, step.label);
        const ov = overlay.getBoundingClientRect();
        const r = target.getBoundingClientRect();
        overlay.classList.toggle('is-top', r.top + r.height / 2 > ov.top + ov.height * 0.5);
      } else {
        overlay.classList.remove('is-top');
      }
    }
    function next() {
      if (i >= said.length) {
        spot?.destroy();
        stageEl.querySelector('.dx-guide-ghost')?.remove();
        audio.playHangup();
        overlay.remove();
        itPopup = null;
        if (coach) {
          coach.task = coach.guide?.task ?? null;
          coach.until = coach.task?.until ?? [];
          coach.highlight = coach.task?.glow ?? null;
          coach.pulseWho = coach.task?.pulseWho ?? null;
          if (!coach.task) coach = null;
        }
        render(); // the "try this" line and any glow come up with the redraw
        startStall();
        return;
      }
      const step = said[i];
      showStep(step);
      tw = createTypewriter(p, quoteSpeech(step.say), { onChar: audio.playTypewriterTick });
      markSpeaking(avatar, tw);
      i += 1;
    }
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!answered) {
        answered = true;
        cancelLater(ringTimer);
        overlay.querySelector('.dx-call__who').textContent = 'THERAPIST';
        overlay.querySelector('.dx-tap-hint').remove();
        ringIcon.remove();
        if (dockT) dockT.style.visibility = '';
        overlay.appendChild(box);
        voices.say('THERAPIST', 'greet', { phone: true });
        next();
        return;
      }
      if (tw && !tw.isDone()) tw.finish();
      else next();
    });
  }

  // He calls about something new: the little screen once it's for real
  // (first battle, a reminder of his exercise), a mask, a new friend in your
  // phone. Runs once the question's words
  // are up and the wheel is showing.
  let coachCheckedFor = null;
  function nodeCoach() {
    if (coachCheckedFor === currentNodeId) return;
    coachCheckedFor = currentNodeId;
    const node = currentNode();
    const facing = npc.npc.charAt(0) + npc.npc.slice(1).toLowerCase();
    // The first real battle: the little screen again, now that it's real (his
    // exercise taught it; this points at each piece in place).
    if (isRevealed('instruments') && !(run.get().coachSeen ?? []).includes('scope')) {
      startCoach('scope', {
        steps: [
          { say: "It's me. Quick one, now that it's for real." },
          { say: `That line across the picture is ${facing}. The one under it is you.`, target: 'trace', label: `${facing.toUpperCase()} · YOU` },
          { say: 'Same as with me. Try feelings and watch the little screen.', target: 'scope', label: 'LITTLE SCREEN' },
          { say: "And the needle: moving together, or pulling apart. It's not grading you. It's just showing you. Okay. Bye.", target: 'needle', label: 'NEEDLE' },
        ],
        task: { text: 'Try a feeling. Watch the little screen.', target: 'wheel', glow: 'scope', until: ['pick', 'swipe'] },
      });
      return;
    }
    if (node.mask) {
      startCoach('mask', {
        steps: [
          { say: "It's me. I'm between clients, this'll be quick. Something new." },
          { say: "See their line across the picture? Look close. It's showing two colors.", target: 'trace', label: 'THEIR LINE' },
          { say: "One is what they're showing you. The one that flickers underneath is what's going on inside.", target: 'trace', label: 'THE FLICKER' },
          { say: 'Try a few feelings on your wheel.', target: 'wheel', label: 'YOUR WHEEL' },
          { say: 'And watch the little screen while you do. What you make of it is up to you. Okay. Bye.', target: 'scope', label: 'LITTLE SCREEN' },
        ],
        task: { text: 'Try a feeling. Watch the little screen.', target: 'wheel', glow: 'scope', until: ['pick', 'swipe'] },
      });
      return;
    }
    const friends = contactsFor(run.get(), npc.npc).filter((w) => w !== 'THERAPIST');
    const who = friends.at(-1);
    if (who && isRevealed('dock')) {
      const name = CONTACTS[who].name;
      startCoach(`friend:${who}`, {
        steps: [
          { say: `It's me. FEELZ tells me ${name}'s in your phone now.`, target: `who:${who}`, label: name.toUpperCase() },
          { say: `Tap them anytime for their read on ${facing}. Their own way. Doesn't mean they're right. Okay. Bye.`, target: `who:${who}`, label: name.toUpperCase() },
        ],
        task: { text: `${name} is here when you want a read.`, target: `who:${who}`, pulseWho: who, until: ['call', 'swipe'] },
      });
    }
  }

  // The Therapist's find-me exercise: the piece of the little screen your
  // last pick is about glows, the same way a coach line points.
  function trialHighlight() {
    if (stage !== 'outro' || !trial || trial.matched) return null;
    if (!activeEmotion) return 'trace';
    return wheelSteps(activeEmotion, trial.target) >= 3 ? 'needle' : 'scope';
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
      btn.style.setProperty('--contact', contactColor(who));
      btn.dataset.who = who;
      if (coach?.pulseWho === who) btn.classList.add('is-coached');
      const offline = who === 'THERAPIST' && !therapistReachable(state);
      if (offline) btn.classList.add('is-offline');
      if (calledThisEncounter.has(who)) btn.classList.add('is-used');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (itPopup || calledThisEncounter.has(who)) return;
        if (offline) {
          // Once an encounter, his voicemail says why; after that, just the fail.
          if (!voicemailHeard) { voicemailHeard = true; placeVoicemail(); return; }
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

  // Calls open above the water meter and the dock, not over them: the
  // overlay's bottom padding grows to clear whichever sits highest.
  function liftAboveLake(overlay) {
    const floor = [...stageEl.querySelectorAll('.dx-game-content > .dx-dock, .dx-game-content > .dx-lake')]
      .filter((el) => !el.classList.contains('is-concealed'))
      .map((el) => el.getBoundingClientRect().top);
    if (!floor.length) return;
    const gap = Math.max(0, stageEl.getBoundingClientRect().bottom - Math.min(...floor));
    overlay.style.paddingBottom = `${gap + 8}px`;
  }

  // How close this person is to you, for the oscilloscope's gap (0..1):
  // what you've built with them (engine/trust.js's syncs and bids, scaled
  // to what trust takes), less each answer here that neither met their
  // mood nor turned toward a bid. Holding a feeling previews it: theirs
  // pulls the lines in a little, a different one pushes them apart.
  function connection(mood, shutOut) {
    if (stage === 'outro' && trial) return trial.matched && trial.want !== 'miss' ? { closeness: 1, merged: true, shutOut: false } : { closeness: 0.25, merged: false, shutOut: false };
    const bond = run.get().bonds?.[npc.npc] ?? { syncs: 0, bids: 0 };
    if (isTrusted(bond)) return { closeness: 1, merged: true, shutOut };
    let c = Math.min(1, (bond.syncs / 2) * 0.6 + bond.bids * 0.4) - missesHere * 0.12;
    if (mood && activeEmotion) c += activeEmotion === mood ? 0.15 : -0.1;
    return { closeness: Math.max(0, Math.min(0.9, c)), merged: false, shutOut };
  }

  // The scope band spans the portrait, edge to edge.
  function placeScopeBand(screen, canvas, portraitEl) {
    const s = screen.getBoundingClientRect();
    const p = portraitEl.getBoundingClientRect();
    if (!p.height) return;
    canvas.style.top = `${p.top - s.top - 18}px`;
    canvas.style.height = `${p.height + 34}px`;
  }

  // A contact's color: their dominant feeling's, or the Therapist's grey.
  function contactColor(who) {
    const dominant = CONTACTS[who]?.dominant;
    return dominant ? emotionColor(dominant) : 'var(--color-therapist)';
  }

  // The reaction text for this answer, composed once (the closing coda
  // alternates between versions, so a redraw mustn't pick again).
  let composedFor = null;
  let composedText = '';
  function reactionTextFor(edge) {
    if (composedFor !== edge) {
      composedFor = edge;
      composedText = composeReaction(npc.npc, varyReaction(edge), reactionEmotion, reactionSwipeKey, run.get().loadout);
    }
    return composedText;
  }

  // The tutorial's TRYCALL beat: the therapist's own contact pops into the
  // dock while he's still on the line. `live` = this is the beat where you
  // try it; afterwards the dock just stays, for show.
  function createSelfDock(live) {
    const dock = document.createElement('div');
    dock.className = 'dx-dock';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dx-dock__contact';
    btn.textContent = CONTACTS.THERAPIST.name.charAt(0);
    btn.setAttribute('aria-label', `Call ${CONTACTS.THERAPIST.name}`);
    btn.style.setProperty('--contact', contactColor('THERAPIST'));
    dock.appendChild(btn);
    if (!live) {
      btn.tabIndex = -1;
      btn.style.pointerEvents = 'none';
      return dock;
    }
    if (!dockIntroduced) {
      dock.classList.add('is-introducing');
      audio.playFeelzPing();
    }
    dockIntroduced = true;
    btn.classList.add('is-beckoning');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typewriter && !typewriter.isDone()) typewriter.finish();
      placeEchoCall(() => nextOutroBeat());
    }, { once: true });
    return dock;
  }

  // Calling him while he's already on the phone with you: it rings, he
  // answers, and his own "Hello?" comes back at him twice through the
  // speaker, with feedback. The joke lands in his next LINE.
  const ECHO = ['Hello?', '…hello?', '…lo?'];
  function placeEchoCall(onDone) {
    spotlight?.destroy();
    spotlight = null;
    const overlay = document.createElement('div');
    overlay.className = 'dx-call';
    overlay.style.setProperty('--contact', contactColor('THERAPIST'));
    overlay.innerHTML = `<p class="dx-call__who">CALLING ${CONTACTS.THERAPIST.name.toUpperCase()}…</p>`;
    stageEl.appendChild(overlay);
    liftAboveLake(overlay);
    const ringMs = audio.playRingtone('THERAPIST');
    let ready = false;
    setTimeout(() => {
      overlay.querySelector('.dx-call__who').textContent = CONTACTS.THERAPIST.name.toUpperCase();
      const box = document.createElement('div');
      box.className = 'dx-call__box';
      const avatar = document.createElement('div');
      avatar.className = 'dx-call__avatar';
      avatar.textContent = CONTACTS.THERAPIST.name.charAt(0);
      const p = document.createElement('p');
      p.className = 'dx-text dx-call__echo';
      box.append(avatar, p);
      overlay.appendChild(box);
      p.textContent = ECHO[0];
      audio.playFeedback();
      [0, 380, 760].forEach((delayMs, k) => voices.say('THERAPIST', 'hello', { phone: k > 0, delayMs, gain: 1 - k * 0.35 }));
      ECHO.slice(1).forEach((word, i) => {
        setTimeout(() => {
          const echo = document.createElement('span');
          echo.className = `dx-call__echo-copy dx-call__echo-copy--${i + 1}`;
          echo.textContent = word;
          p.appendChild(echo);
          fx.shake('subtle');
          if (i === ECHO.length - 2) ready = true;
        }, 380 * (i + 1));
      });
    }, ringMs);
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ready) return;
      audio.playHangup();
      overlay.remove();
      onDone();
    });
  }

  // He won't pick up (bars or Wi-Fi under 4): it rings out to his voicemail
  // greeting, which tells you which one. No read, no advice, no call used up.
  let voicemailHeard = false;
  function placeVoicemail() {
    clearStall();
    const lines = voicemailFor(run.get());
    const overlay = document.createElement('div');
    overlay.className = 'dx-call is-voicemail';
    overlay.style.setProperty('--contact', contactColor('THERAPIST'));
    overlay.innerHTML = '<p class="dx-call__who">CALLING THERAPIST…</p>';
    stageEl.appendChild(overlay);
    liftAboveLake(overlay);
    itPopup = { destroy: () => overlay.remove() };
    // It rings out: twice as long as a call that connects, then the greeting.
    const ringMs = audio.playRingtone('THERAPIST');
    later(() => audio.playRingtone('THERAPIST'), ringMs);
    const box = document.createElement('div');
    box.className = 'dx-call__box';
    const avatar = document.createElement('div');
    avatar.className = 'dx-call__avatar';
    avatar.textContent = 'T';
    const p = document.createElement('p');
    p.className = 'dx-text';
    box.append(avatar, p);
    let i = 0;
    let tw = null;
    function next() {
      if (i >= lines.length) {
        audio.playHangup();
        overlay.remove();
        itPopup = null;
        startStall();
        return;
      }
      tw = createTypewriter(p, lines[i], { onChar: audio.playTypewriterTick });
      markSpeaking(avatar, tw);
      i += 1;
    }
    later(() => {
      overlay.querySelector('.dx-call__who').textContent = 'VOICEMAIL · THERAPIST';
      overlay.appendChild(box);
      next();
      overlay.addEventListener('click', () => {
        if (tw && !tw.isDone()) tw.finish();
        else next();
      });
    }, ringMs * 2);
  }

  // A call: it rings, then greeting, their read (that slice glows on the
  // wheel), their advice. Tap through; the wheel and card wait underneath.
  function placeCall(who) {
    clearStall();
    coachDid('call');
    const node = currentNode();
    const name = npc.npc.charAt(0) + npc.npc.slice(1).toLowerCase();
    const call = callFor(who, { state: run.get(), currentName: name, currentKey: npc.npc, mood: node.mood });
    if (call.explained) run.set({ scopeExplained: true }); // the science is said once a run
    const overlay = document.createElement('div');
    overlay.className = 'dx-call';
    overlay.style.setProperty('--contact', contactColor(who));
    overlay.innerHTML = `<p class="dx-call__who">CALLING ${CONTACTS[who].name.toUpperCase()}…</p>`;
    stageEl.appendChild(overlay);
    liftAboveLake(overlay);
    itPopup = { destroy: () => overlay.remove() };
    const ringMs = audio.playRingtone(who);
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
        voices.say(who, 'bye', { phone: true });
        audio.playHangup();
        overlay.remove();
        itPopup = null;
        startStall();
        return;
      }
      // Low Wi-Fi: the read comes through, but the wheel doesn't light.
      if (i === 1 && !call.fogged) { hintedEmotion = call.read; dartboard?.hint(call.read); }
      tw = createTypewriter(p, quoteSpeech(call.lines[i]), { onChar: audio.playTypewriterTick, onMark: fireCue });
      markSpeaking(avatar, tw);
      i += 1;
    }
    setTimeout(() => {
      overlay.querySelector('.dx-call__who').textContent = CONTACTS[who].name.toUpperCase();
      overlay.appendChild(box);
      voices.say(who, 'greet', { phone: true });
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
      let tw = createTypewriter(p, text, { onChar: audio.playTypewriterTick });
      // Then the story they tell you (manuscript STORY lines). The music falls
      // away so it can be heard — their words still type out with their sound,
      // and IT and SO still sound — with their bust close and centered, the way
      // they ask for your number; each tap is the next beat, and the music
      // fades back only when they are done.
      const story = npc.story ?? [];
      let beat = -1;
      let told = false;
      overlay.addEventListener('click', () => {
        if (told) return;
        if (!tw.isDone()) { tw.finish(); return; }
        tw.destroy();
        beat += 1;
        if (beat === 0 && story.length) {
          audio.duckMusic(true);
          encounterMusic.duck(true);
          overlay.classList.add('is-asking');
          const bust = createNpcPortrait(npc.npc, npc.accentColor, npc.portrait);
          bust.el.classList.add('dx-connect__bust');
          const name = document.createElement('p');
          name.className = 'dx-connect__name';
          name.textContent = npc.npc;
          overlay.insertBefore(name, box);
          overlay.insertBefore(bust.el, name);
          run.set({ storiesHeard: [...(run.get().storiesHeard ?? []), npc.npc] });
        }
        if (beat < story.length) {
          tw = createTypewriter(p, story[beat], { onChar: audio.playTypewriterTick });
          return;
        }
        told = true;
        const finish = () => { audio.duckMusic(false, 3); encounterMusic.duck(false, 3); overlay.remove(); onDone(); };
        if (story.length && npc.storyIt && npc.storySo) showStoryThoughts(finish);
        else finish();
      });
    }, silence + 500);
  }

  // After their story, with the music still down: IT weighs how true it rings,
  // SO doubts a corner of it without doubting them (manuscript STORYIT/STORYSO).
  // Their usual sting and typing, but not sharpened by the lake: this moment is
  // about them, not about what the player owes.
  function showStoryThoughts(onDone) {
    const loadout = run.get().loadout;
    itPopup = createItPopup(stageEl, {
      text: npc.storyIt, loadout, flashClose: true,
      onClose: () => {
        itPopup?.destroy();
        itPopup = createItPopup(stageEl, {
          text: npc.storySo, loadout, voice: 'so',
          onClose: () => { itPopup?.destroy(); itPopup = null; onDone(); },
        });
      },
    });
  }

  // No connection this time: the same close-up as the number ask, but they
  // push you away, and say what they wish someone had done just now — one
  // feeling-colored word is the hint (manuscript PUSHAWAY, per class). Not a
  // verdict: it's them telling you what would have reached them.
  function showPushAway(onDone) {
    const text = npc.pushAway[run.get().loadout] ?? Object.values(npc.pushAway)[0];
    stageEl.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'dx-connect is-asking is-pushing';
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
    audio.playDrift();
    setTimeout(() => {
      overlay.appendChild(box);
      tw = createTypewriter(p, text, { onChar: audio.playTypewriterTick });
    }, 1300);
    overlay.addEventListener('click', () => {
      if (!tw) return;
      if (!tw.isDone()) { tw.finish(); return; }
      tw.destroy();
      overlay.remove();
      onDone();
    });
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
      // Numbers swapped: they send you off in their own voice.
      voices.say(npc.npc, 'farewell', { delayMs: 350 });
      overlay.remove();
      onDone();
    });
  }

  // Every IT/SO popup in an encounter goes through here, so their lines
  // sharpen as the lake worsens (engine/itSharpen.js) — except their
  // co-conspirator lines (opts.cozy), which stay warm all the way down.
  function sayIt(opts) {
    const resolved = resolveItText(opts.text, run.get().loadout);
    const text = opts.cozy ? resolved : sharpen(resolved, opts.voice ?? 'it', run.get().truthDebt);
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
    // {intake}: the intake read saved by the questionnaire, quoted as his
    // own words (therapist_01). Nothing saved (a debug jump) = dropped.
    const read = run.get().intakeRead;
    // Each feeling-colored word in the read carries a cue that lights its slice.
    // A beat after each one, so the player can watch it land.
    const cued = read?.replace(/\{color:(\w+)\}/g, '{cue:lit_$1}{color:$1}').replace(/\{\/color\}/g, '{/color}{pause:550}');
    parts.push(node.prompt.replace('{intake}', cued ? `"${cued}"` : ''));
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
      // One voice at a time: the cheer waits for the next lie.
      if (pendingCozy) {
        pendingCozy = null;
        cozyThisEncounter = false;
        run.set({ cozySaid: Math.max(0, (run.get().cozySaid ?? 0) - 1) });
      }
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
  function showItThenSo(itText, soText, onClose, { cozy = false } = {}) {
    const debt = run.get().truthDebt;
    itPopup = sayIt({
      text: fillReadings(itText, debt),
      loadout: run.get().loadout,
      flashClose: true,
      cozy,
      onClose: () => {
        itPopup?.destroy();
        itPopup = sayIt({
          text: fillReadings(soText, debt),
          loadout: run.get().loadout,
          flashClose: false, // last one in the sequence
          voice: 'so',
          cozy,
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
    const cozy = pendingCozy;
    pendingCozy = null;
    if (cozy && !edge.itText && !edge.soText) {
      showItThenSo(cozy[0], cozy[1], () => proceedAfterIt(edge), { cozy: true });
    } else if (edge.itText && edge.soText) {
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
    if (edge.nextNodeId) {
      currentNodeId = resolveGatedNode(edge.nextNodeId, npc, run.get());
      enterNode();
      return;
    }

    const afterAsk = () => {
      if (shouldUnlockTrust(run.get())) showTrustUnlock(() => finishEncounter());
      else finishEncounter();
    };
    // How you left this person: the next contact you call will know (engine/contacts.js afterLast).
    if (npc.contactAsk && isTrusted(run.get().bonds?.[npc.npc])) {
      run.set({ lastParting: { npc: npc.npc, outcome: 'connected' } });
      showContactAsk(afterAsk);
    } else if (npc.pushAway) {
      run.set({ lastParting: { npc: npc.npc, outcome: 'pushed' } });
      showPushAway(afterAsk);
    }
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

    showFindingIfAny(() => showRest(onComplete));
  }

  // The walk out: a short beat showing what the battery got back
  // (engine/cardEngine.js restAfter) — more if they let you in. Big pixel
  // battery, the new cells charging in one by one, tap to go on.
  function showRest(onDone) {
    const before = run.get().stability ?? 5;
    const connected = isTrusted(run.get().bonds?.[npc.npc]);
    run.set(restAfter(run.get(), { connected }));
    const after = run.get().stability ?? 5;
    const gained = after - before;
    const overlay = document.createElement('div');
    overlay.className = 'dx-rest';
    const title = connected ? 'THEY LET YOU IN' : gained > 0 ? 'YOU WALK IT OFF' : 'STILL CHARGED';
    const line = connected
      ? 'Being let in charges you up.'
      : gained > 0 ? 'You catch your breath on the way.' : 'Nothing to recover. You keep walking.';
    const cells = Array.from({ length: 10 }, (_, i) => {
      const cls = i < before ? 'is-on' : i < after ? 'is-gain' : '';
      const delay = i >= before && i < after ? ` style="animation-delay:${0.5 + (i - before) * 0.28}s"` : '';
      return `<span class="dx-rest__cell ${cls}"${delay}></span>`;
    }).join('');
    overlay.innerHTML = `
      <p class="dx-rest__title">${title}</p>
      <div class="dx-rest__battery${after <= 2 ? ' is-low' : ''}"><div class="dx-rest__cells">${cells}</div><span class="dx-rest__nub"></span></div>
      <p class="dx-rest__gain">${gained > 0 ? `+${gained} battery` : 'battery holding'}</p>
      <p class="dx-text dx-rest__line">${line}</p>
      <p class="dx-text dx-tap-hint">(tap to continue)</p>`;
    stageEl.appendChild(overlay);
    for (let i = 0; i < gained; i++) later(() => audio.playMeterChange([{ meter: 'stability', up: true }]), 500 + i * 280);
    const shownAt = performance.now();
    overlay.addEventListener('click', () => {
      if (performance.now() - shownAt < 600) return; // the tap that got here doesn't count
      overlay.remove();
      onDone();
    });
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
  // The parting watch-out (manuscript WATCH): the lake if it moved, else the
  // weakest meter if it's low, else a word about everything holding.
  function watchFor(state) {
    if ((state.truthDebt ?? 0) >= 3) return 'lake';
    const [worst, value] = ['stability', 'trust', 'lucidity', 'integrity']
      .map((k) => [k, state[k] ?? 5])
      .sort((a, b) => a[1] - b[1])[0];
    return value <= 4 ? worst : 'steady';
  }

  function outroBeatApplies(beat) {
    const state = run.get();
    if (beat.watch && beat.watch !== watchFor(state)) return false;
    if (beat.when?.class && beat.when.class !== state.loadout) return false;
    const choice = beat.when?.choice;
    if (choice && state.choices?.[choice.node] !== choice.side) return false;
    return true;
  }

  function startOutro() {
    // TRYNEAR / TRYFAR aren't beats: they're his comments during the exercise.
    trialComments = {
      near: npc.outro.find((b) => b.kind === 'trynear' && outroBeatApplies(b))?.text ?? null,
      far: npc.outro.find((b) => b.kind === 'tryfar' && outroBeatApplies(b))?.text ?? null,
    };
    outroQueue = npc.outro.filter((b) => b.kind !== 'trynear' && b.kind !== 'tryfar' && outroBeatApplies(b));
    nextOutroBeat();
  }

  function nextOutroBeat() {
    let beat = outroQueue.shift();
    if (!beat) {
      onComplete();
      return;
    }
    if (beat.kind === 'tryfeel') {
      // {feel:X} names the feeling he's in (never shown); his line wears its
      // color, or {mask:Y}'s. {want:miss} asks for any feeling but his (to see
      // what apart looks like); otherwise his is the one to find, and a mask
      // starts flickering his real color underneath, the way it does in battle.
      const tag = (k) => beat.text.match(new RegExp(`\\{${k}:(\\w+)\\}`))?.[1] ?? null;
      trial = { target: tag('feel'), mask: tag('mask'), want: tag('want') ?? 'match', matched: false, drawn: false, pickedAt: 0 };
      beat = { ...beat, text: beat.text.replace(/\{(feel|mask|want):\w+\}/g, '') }; // a copy: the script stays intact for a replay
      activeEmotion = null;
      easeMoodTo(trial.mask ?? trial.target);
      drama.under = trial.mask && trial.want !== 'miss' ? moodHex(trial.target) : null;
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
      // Mid-sentence, the way his calls end: "Take ca—", click, dead line.
      const byeMs = voices.say(npc.npc, 'bye', { phone: true, cut: 0.55 });
      setTimeout(() => audio.playHangup(), byeMs + 40);
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
  // Time spent paused (a phone held sideways) isn't time spent hesitating.
  const offPause = onPauseChange((paused, forMs) => {
    if (!paused && cardShownAt !== null) cardShownAt += forMs;
  });
  // A baked arrangement carries the battle if the NPC has one; otherwise the leitmotif.
  if (encounterMusic.engage(npc.npc)) audio.beginEncounter(npc.npc, encounterMusic.current()?.player.data.tonic);
  else audio.startLeitmotif(npc.npc);
  audio.preloadTypewriterTick();
  enterNode();

  return function unmount() {
    unmounted = true;
    opfx?.destroy();
    offPause();
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
    audio.unhush(0.05); // never leave the game silent if a story was cut short
    audio.duckMusic(false, 0.05);
    audio.setHaze(0, 1.5);
    encounterMusic.end();
    clearStall();
    statusBar?.destroy();
    stageEl.classList.remove('is-frozen');
    stageEl.innerHTML = '';
  };
}
