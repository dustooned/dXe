# IT — Design Document

Last updated: 2026-08-04.

**Status (2026-09-06): the popup is built and now fires in three places.**
The three MK2 intro lines below play as their own scene at the very start
of the chapter — a centered popup over a scrim, dismissed by an X, in a
distinct display font. The render is `ui/itPopup.js`'s `createItPopup()`,
usable from anywhere (see `SCENE_TYPES.md`'s "IT beat" section), not just
as a cutscene beat: `cutsceneScene.js` calls it for the intro lines and
each confrontation's one placeholder line, and `dialogScene.js` calls it
directly — no beat involved — whenever a Truth Debt bloom threshold is
newly crossed, using placeholder text in `engine/itBlooms.js`. The intro
lines stay class-neutral (no loadout exists yet at that point); every
other use is the `{ Guns, Bible, Crystals }` form, resolved against the
player's class. Still design only: dominant-emotion-aware text during the
encounters themselves, and IT dialog for the reckoning and the endings.

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

## What Needs to Be Built

**Design (before any code):**
- Write IT line sets per class for the NPC *encounter* (dialog) scenes —
  Therapist, Deborah, Rwanda, Samun, Rick. The four confrontation
  cutscenes each have one placeholder line/class now; the encounters
  themselves (the actual swipe exchanges) still have none.
- Decide which specific moments within each dialog scene trigger IT
- Write IT dialog for the reckoning and each ending

**Code:**
- ~~IT beat type in cutsceneScene~~ — done: renders differently, no
  speaker label, and now class-aware (`{ Guns, Bible, Crystals }` text,
  resolved against `run.get().loadout`) for any use after the player has a
  loadout. The intro lines stay class-neutral on purpose — no loadout
  exists yet at that point.
- IT intrusion system for dialog scenes based on dominant emotion during
  the swipe exchange itself — still unbuilt, and still needs a design
  answer for what "dominant emotion" even means (a running lean across the
  encounter? the single emotion just picked?) before it's an engineering
  task.
- ~~IT bloom-event trigger (at Truth Debt thresholds)~~ — done:
  `dialogScene.js`'s `advance()` calls `createItPopup()` directly whenever
  `checkBloomTriggers()` reports a newly-crossed threshold, overlaid on
  top of whatever's already on screen. At debt 10 the popup shows before
  the existing force-to-Reckoning jump runs, not instead of it.

**Content:**
- Three voice profiles × five NPC scenes = 15 sets of IT lines minimum
  for the encounters. Reduced scope now covered: one voice-profile line
  per class × four confrontations = 12 placeholder lines, plus one line
  per class × four bloom thresholds = 12 more, both done.
- Reckoning IT dialog × three classes = 3
- ~~MK2 intro lines as the pre-questionnaire opening beat~~ — done
  (`content/it_intro.json`, the `it-intro` scene)
- ~~One placeholder IT line per class in each confrontation~~ — done
  (`content/confront_<npc>.json`)
- ~~One placeholder IT line per class per bloom threshold~~ — done
  (`engine/itBlooms.js`)
