# IT — Design Document

Last updated: 2026-07-18.

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
- Write IT line sets per class for each NPC scene (Therapist,
  Deborah, Rwanda, Samun, Rick)
- Decide which specific moments within each scene trigger IT
- Write IT dialog for the reckoning and each ending

**Code:**
- IT beat type in cutsceneScene (renders differently, no speaker label,
  class-aware)
- IT intrusion system for dialog scenes (fires after certain swipes
  based on dominant emotion)
- IT bloom-event trigger (at Truth Debt thresholds)

**Content:**
- Three voice profiles × five NPC scenes = 15 sets of IT lines minimum
- Reckoning IT dialog × three classes = 3
- MK2 intro lines as the pre-questionnaire opening beat
