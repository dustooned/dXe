# IT — Design Document

Last updated: 2026-08-04.

**Status (2026-09-06): every trigger this doc originally listed is built.**
The render is `ui/itPopup.js`'s `createItPopup()`, usable from anywhere
(see `SCENE_TYPES.md`'s "IT beat" section), not tied to any one scene type:

- **Intro** — three class-neutral lines, their own scene at the very start
  of the chapter (no loadout exists yet at that point).
- **Confrontations** — one class-variant line per NPC, right before the
  opener choice (`cutsceneScene.js`, `content/confront_<npc>.json`).
- **Bloom events** — one class-variant line per Truth Debt threshold
  (`dialogScene.js`, `engine/itBlooms.js`).
- **Post-swipe, dominant-emotion** — one class-variant line at the end of
  each NPC encounter, keyed by whichever FEELZ emotion the player has
  leaned on most *across the whole run so far* (not per-NPC — the tally
  never resets). A genuine tie (including never having picked yet) falls
  back to a calmer, more detached "neutral" line rather than an arbitrary
  pick. See `engine/loadout.js`'s `getDominantEmotion()` and
  `engine/itEmotionLean.js`. Skipped below 2 total picks, which is what
  naturally excludes the Therapist (one swipe, already documented as
  exempt from the standard NPC shape).
- **Reckoning** — one class-variant line before the first card
  (`engine/itEndgame.js`'s `RECKONING_IT_TEXT`).
- **Ending** — one class-variant line once the body text finishes drawing,
  before "BACK TO MENU" — the actual last word of the chapter
  (`ENDING_IT_TEXT`, same file).

Every popup also plays `audio.playTyagl()` on mount — the same sting
`questionnaireScene.js` plays under the Therapist's diagnosis, reused
deliberately since both are "the game reading you." All of the above is
**placeholder prose** (~40 lines total across every table), written to
exercise the class/emotion/threshold splits, not final writing. What's
left, and it's a content job now, not an engineering one: writing real
prose in place of every placeholder line, and deciding whether IT should
also become the hint system (see below — separately still unbuilt).

---

## What IT Is

IT is not a character. IT is the player's inner dialog — invasive thoughts,
the voice in your head that won't shut up, the running commentary that
colors everything you perceive. IT is a metaphor for internal monologue
made literal.

IT is not invited into scenes. IT intrudes.

The player never chooses when IT speaks. IT is the thing that's already
happening when you're trying to listen to someone else.

---

## How IT Works

**IT is class-dependent.** The player's loadout (Guns / Bible / Crystals)
shapes the *voice* of their inner dialog. Same external event — three
completely different internal reactions.

**IT is emotion-dependent.** The player's dominant FEELZ at any given
moment filters what IT notices. Players only perceive what their current
emotional state *lets* them see. A player running high on Fear notices
different things than one running high on Joy — even in the same scene,
looking at the same NPC, hearing the same words.

**IT is observation, not conversation.** IT doesn't respond to what the
player says. IT comments on what the player is experiencing — an NPC's
body language, a word that landed wrong, a silence that lasted too long,
something the NPC didn't say. IT reads the room for you, filtered through
your emotional lens.

**IT is invasive.** IT appears in cutscenes, during dialog scenes, and
possibly during the reckoning. IT is not triggered by player choice — it
fires based on game state (class, dominant emotion, Truth Debt level).

---

## Voice Profile by Class

### Guns (Anger / Fear / Anticipation)
IT is blunt, impatient, certain. Cuts through. Notices threat and power
dynamics. Reads everyone for weakness. Anticipates the next move before
the current one is finished.

Examples:
- "She's not asking. She's telling."
- "He's scared of you and doesn't know it yet."
- "You already know how this ends."

### Bible (Trust / Disgust / Anticipation)
IT is evaluating constantly. Categorizes people as worthy or not. Notices
when something doesn't line up. Has strong feelings about loyalty and its
absence. Beneath the certainty — doubt it won't name.

Examples:
- "You've heard this before. It didn't sound like the truth then either."
- "She needs something from you. Notice that."
- "This is the part where you decide what kind of person you are."

### Crystals (Joy / Sadness / Surprise)
IT is porous and overwhelming. Absorbs everything. Notices what nobody
else in the room is feeling. Gets sidetracked by small things. IT for
Crystals is less commentary and more weather — it just comes in.

Examples:
- "Something in here is very old."
- "She's tired. Not from today. From a long time ago."
- "You don't have to fix this."

---

## Where IT Appears

### During dialog scenes
After a swipe (before the reaction renders, or as a beat within the
reaction screen) — IT comments on what just happened based on dominant
emotion. One line. Styled differently from NPC dialog.

### During cutscenes
IT can appear as a special beat type in the cutscene sequence —
rendered in IT's visual style, no speaker attribution needed (IT
doesn't announce itself). Fires based on the current class/emotion
state when that beat is reached.

### Reckoning
IT is loudest here. The reckoning is the moment the player's own head
catches up with what they've done. IT dialog during the reckoning
could be the most direct the voice ever gets.

### Bloom events (Truth Debt thresholds)
When Truth Debt crosses a threshold, IT intrudes mid-scene. The
player doesn't choose this. IT just shows up.

---

## IT *is* the hint system

**Added 2026-08-04. Not scoped for build yet — recorded so it isn't lost.**

IT and the "hint system" were tracked as two separate backlog items in
`HANDOFF.md`. They're one thing. IT is how the game hints.

The mechanic: **individual words within IT's line are highlighted in
color**, and the coloring is the hint. IT tells you where you're leaning —
or how the game is currently reading you — without ever stating a number or
naming a stat. The player learns to read the color as a tell.

This is the same trick `questionnaireScene.js` already uses for the
Therapist's diagnosis (`DIAGNOSES`, where individual words are tinted with
`emotionColor()` from the player's class palette), and the same one the
mini-game room captions will use for class-varying text. Reusing it a third
time is deliberate: it makes "colored word = the game is reading you" a
consistent, learnable language rather than a one-off flourish.

Because it's a hint and not a readout, it stays inside the existing rule
that feedback is *atmospheric, never right/wrong* — same reason `fx.js`
is intensity-only with no truth/lie color-coding. A highlighted word should
feel like being noticed, not like being scored.

### Where the hints fire

Four placements, all of them moments where the player is about to commit or
has just left something behind:

1. **Entering a room or section** — sets the lens before the player looks
   around. In mini-games this is the room's first frame.
2. **Exiting a scene** — the parting read on what just happened.
3. **During pre-battle dialog exchange**, before the player makes a choice —
   IT colors the exchange while it's still in progress.
4. **Immediately before a battle choice with an NPC** — the last beat before
   commitment, and the sharpest one.

Placements 3 and 4 are distinct on purpose: one is ambient during the
exchange, the other is the pointed moment right at the decision.

Note that 1 and 2 land naturally in the mini-game walk step (entering a
room, leaving for the encounter), and 3 and 4 in `dialogScene`. The
existing "During dialog scenes" section above describes IT firing *after*
a swipe; this adds the *before*-the-choice case, which is the one that
actually functions as a hint — after the fact it's commentary, before the
fact it's influence.

---

## Visual Identity

IT's dialog should be visually distinct from everything else — not a
speech bubble, not a typewriter text box, not a swipe card. IT reads
more like a flash: quick, unannounced, styled differently (different
font treatment, different position on screen, maybe inverted colors or
a subtle pulse).

The GM build had a distinct dialog box sprite (`spr_dialog_it`) and a
distinct font (`fnt_it`) for IT — separate from the PLAYER dialog box.
The web equivalent should be its own CSS class with its own visual
language.

---

## The MK2 Intro Lines (IT's First Appearance)

The three auto-advancing lines from the MK2 build are IT introducing
itself at the game's very start — before the player has done anything,
before they know what FEELZ is:

> "You're probably wondering where you are."
> "Or... maybe you're not wondering at all."
> "Either way, you're stuck with me."

These are class-neutral — they fire before the questionnaire. IT
exists before the player has a loadout. The voice is already there.

---

## What Was Built

Every item this section used to list as open is done. Kept here as a
record of the design questions and how they were answered, not as a to-do
list.

**Design questions, and how they got resolved:**
- *"What does 'dominant emotion' even mean — a running lean, or the last
  pick?"* Answered: a running tally across the **whole run**, not
  per-encounter — `run.emotionCounts`, incremented once per swipe
  (`dialogScene.js`'s `handleSwipe`), read by `engine/loadout.js`'s
  `getDominantEmotion()`. A tie (including zero picks) is treated as a
  genuine absence of a lean, not something to arbitrarily break — it gets
  its own calmer, more detached "neutral" line per class
  (`engine/itEmotionLean.js`), rather than reusing an emotion-specific
  line's jittery register for a beat that isn't about a pattern.
- *"Which specific moments trigger it?"* Once per NPC encounter, at the
  end of that NPC's node graph (`dialogScene.js`'s `proceed()`) — not
  after every swipe, which would be exhausting on top of the SAY/REACT
  beats already there. Skipped below 2 total picks for the run, which
  also naturally excludes the Therapist (one swipe, already documented
  elsewhere as exempt from the standard NPC shape) without needing to
  special-case her by name.

**Code:**
- IT beat type in `cutsceneScene.js`, and the render factored out into
  `ui/itPopup.js`'s `createItPopup()` so any scene can call it directly —
  used by `dialogScene.js` (bloom events, the dominant-emotion read),
  `reckoningScene.js`, and `endingScene.js`, none of which sequence beats
  at all.
- Every popup plays `audio.playTyagl()` on mount (the diagnosis sting,
  reused deliberately).

**Content — placeholder prose throughout, ~40 lines total:**
- 3 intro lines (class-neutral) — `content/it_intro.json`
- 12 confrontation lines (4 NPCs × 3 classes) — `content/confront_<npc>.json`
- 12 bloom-threshold lines (4 thresholds × 3 classes) — `engine/itBlooms.js`
- 12 dominant-emotion lines (3 classes × 3 emotions + 3 neutral) —
  `engine/itEmotionLean.js`
- 3 Reckoning lines + 3 ending lines (one per class each) —
  `engine/itEndgame.js`

**What's actually still open**, and it's not engineering:
- All of the above is exercise prose, not final writing — same "rewrite
  the words, the structure's already wired" job as the rest of Chapter 1's
  placeholder content.
- Per-NPC-flavored IT lines during the encounters themselves (right now
  the dominant-emotion read is generic across all four NPCs, the same way
  bloom lines are generic across thresholds — a deliberate scope cut to
  keep the placeholder set at ~40 lines instead of ~160).
- The hint-system merge (below) — separately, still not scoped for build.
