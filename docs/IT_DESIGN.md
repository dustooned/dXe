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
  `engine/itEmotionLean.js`. Skipped below 2 total picks, and skipped for
  any NPC with an authored `outro` — today only the Therapist, whose
  outro ends on its own IT → SO pair (see "Therapist outro" below).
- **Reckoning** — IT and SO as Pastor Gabriel's hellhound gatekeepers,
  walking the player into the water before the baptism
  (`content/pastor.json`'s `gate`, lines keyed by final lake status). The
  old standalone Reckoning line (`RECKONING_IT_TEXT`) was retired.
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

## SO — the doubt rebuttal (built)

Grew out of noticing that two of IT's triggers — bloom events and the
post-swipe dominant-emotion read — read as repetitive over a real
playthrough, in a way more placeholder prose wouldn't actually fix: the
dominant-emotion line especially reads off a *cumulative* tally that
rarely flips once established, so the exact same sentence can fire
verbatim after two, three, even four different NPCs in one sitting.

The fix wasn't more IT lines. It's a second voice.

**What SO is, psychologically.** Not a comforting counterpart — a comforting
voice still takes a side (it's fine, don't worry), which is a different
failure mode than the one this fixes. SO is grounded in **doubt** as it
actually shows up clinically: historically OCD was called *"folie du
doute,"* the doubting disease — the hallmark isn't a specific belief, it's
that nothing gets to resolve, in either direction. You can't trust your
own read of what just happened, whichever way that read was leaning. SO's
job is to make sure IT's claim never gets to stand unquestioned — not by
arguing the opposite conclusion, but by undermining the very confidence
IT just asserted.

Named as a pair with IT on purpose: two words with no fixed referent, one
stating with dread-certainty, one that trails off without committing to
anything (*"so?"*, *"or so"*) — the pairing itself is meant to read as
"is, or so," never a clean verdict either way. Whichever way the player
reads a moment, one of the two voices is right there undercutting it.

**Where it fires — narrower than "every IT appearance," deliberately.**
SO's *systematic* trigger only answers `dialogScene.js`'s two
pattern-reading moments: bloom events and the dominant-emotion read
(`engine/soRebuttals.js`'s `SO_BLOOM_TEXT` and `soEmotionLeanText()`,
chained onto IT's own popup via `showItThenSo()`). Those two were the
ones actually causing the repetition complaint that motivated SO in the
first place — a running read that keeps re-firing, not a one-off line.

The one exception is hand-authored, not systemic: the chapter's opening
(`content/it_intro.json`) now ends with a scripted three-beat exchange —
IT: *"Either way, you're stuck with me."* / SO: *"Stuck? Big talk, for
something that just got here same as I did."* / IT: *"Fuck off. This
one's mine."* This is the one place a manuscript beat can set
`voice: 'so'` directly (`cutsceneScene.js`'s generic `it` beat sequencer,
not dialogScene.js's own trigger plumbing) — it exists to *teach* the
player these two voices argue before either one shows up quietly later,
and to establish that IT is territorial about the player's head, not just
detached and clinical. It is not a rule that the intro always gets a SO
beat; it's one specific authored moment, same as any other cutscene beat.

SO otherwise stays out of the pre-confrontation line, the Reckoning, and
the ending — the ending's IT line is documented above as *"the actual
last word of the chapter,"* deliberately unanswered, and extending SO
there would directly undo that. Those remain one-off narrative beats, not a
running read SO has anything to argue with.

**How it fires.** `showItThenSo(itText, soText, onClose)` shows IT first
(`flashClose: true`, signaling one more is coming — the same convention a
multi-beat IT sequence already used), and only shows SO once IT is
dismissed. SO never fires on its own schedule; it's a reaction, not an
announcement, which matches the real thing better anyway — doubt follows
a thought, it doesn't arrive first.

**Visual treatment.** SO doesn't get new art — `createItPopup`'s new
`voice: 'so'` option applies `.dx-it-box--so` (`scenes.css`), which
inverts the box's own colors (white-on-black becomes black-on-white) and
runs the existing icon through `filter: invert(1)`. SO is IT's own box
turned inside out, not a second character with a second visual language —
which is also the cheapest way to make two voices read as distinct
without a second art asset.

**Content.** `engine/soRebuttals.js` — one rebuttal per existing IT line
(12 bloom lines, 12 dominant-emotion lines), same placeholder-prose bar as
the tables it answers.

### Findings, not commentary (2026-09-24)

Playtest concern: IT and SO could get annoying. They used to read the
player's dominant emotion after *every* NPC. Now they only speak at the
end of an encounter when they've noticed something **new**
(`engine/itFindings.js`, `dialogScene.js`'s `showFindingIfAny`):

1. **Pattern flip**: this encounter leaned the other way (more lies vs.
   more truths) from the last encounter that leaned at all.
2. **Lean shift**: the run's dominant emotion changed since they last
   read it. This uses the existing emotion-lean lines.

There's at most one per encounter, and none if a bloom already
interrupted it. Blooms themselves are findings too: they fire exactly
when the ending the player is heading toward changes (`engine/lake.js`).

**Voice direction:** they're observers, the countdown grim reapers at
the end of the tunnel. Both are judging, and neither admits they're
working against you. It's the spotlight effect (Gilovich et al., 2000:
people overestimate how much others notice and judge them) made real.
The paranoia is correct, and somebody really is keeping score. They cite
the lake's reading like a lab report (`{ppm}` / `{status}` tokens). The
new finding lines are written this way. The older bloom, lean and SO
tables still use the earlier voice until they're rewritten.

### Therapist outro (exception, deliberate)

After the Therapist hangs up, IT and then SO react to how the dream
question went (`=== OUTRO` in `manuscript/therapist.txt`). That's a
one-off story beat, which by the rule above would get IT alone. SO is
there on purpose. It's the second IT/SO exchange in the chapter, after
the opening `it-intro` scene, and it bookends the opening call so the
player meets both voices before the first real NPC. The lie version has
SO doubting whether the lie even happened ("Did you even lie?"), which is
the doubt-not-comfort job in its purest form. The cost: SO is a little
less rare. Don't treat this as precedent for adding SO to other one-off
beats.

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
The Reckoning is now Pastor Gabriel's baptism. IT and SO appear there as
his gatekeepers, hellhounds walking the player down the bank into the
water, still insisting they're only observers ("We're only making sure
you get there"). Their lines depend on the lake's final status
(`content/pastor.json`'s `gate`). It's another deliberate SO exception to
the one-voice rule for one-off beats, since the pair is the point.

### Bloom events (Truth Debt thresholds)
When Truth Debt crosses a threshold, IT intrudes mid-scene. The
player doesn't choose this. IT just shows up.

---

## IT *is* the hint system

IT and the "hint system" were tracked as two separate backlog items in
`HANDOFF.md`. They're one thing. IT is how the game hints.

The mechanic: **individual words within IT's line are highlighted in
color**, and the coloring is the hint. IT tells you where you're leaning —
or how the game is currently reading you — without ever stating a number or
naming a stat. The player learns to read the color as a tell.

This is the same trick `questionnaireScene.js` already uses for the
Therapist's diagnosis (`DIAGNOSES`, where individual words are tinted with
`emotionColor()` from the player's class palette). Reusing it is
deliberate: it makes "colored word = the game is reading you" a consistent,
learnable language rather than a one-off flourish.

Because it's a hint and not a readout, it stays inside the existing rule
that feedback is *atmospheric, never right/wrong* — same reason `fx.js`
is intensity-only with no truth/lie color-coding. A highlighted word should
feel like being noticed, not like being scored.

### Where the hints fire

Originally scoped as four placements. Two are **built** (see below); two
are a separate, larger content job, deferred on purpose rather than opened
mid-stream:

1. *Entering a room or section* — not built. Would need new hint content
   across all 4 mini-game rooms × 3 classes, not just color-tagging text
   that already exists. Deferred.
2. *Exiting a scene* — not built, same reason as above. Deferred.
3. **Built — during pre-battle dialog exchange, before the player makes a
   choice.** Reuses text that already exists: one word within each dialog
   node's own `PROMPT:` line (the NPC's line, shown before TRUTH/LIE) is
   wrapped in the typewriter's new `{color:Emotion}...{/color}` markup
   (`ui/typewriterText.js`) and tinted via `emotionColor()`, drawn
   character-by-character same as the rest of the line. No new lines
   written — the word and its emotion are picked per node from what's
   already there.
4. **Built, collapsed into 3.** In the current UI the NPC's line and the
   TRUTH/LIE choice render in the same beat, not two separate ones, so
   "the exchange in progress" and "immediately before the choice" are the
   same visible moment right now. Not worth inventing an artificial pause
   just to keep them temporally distinct — if the UI ever splits dialog
   into a true two-beat exchange, this is where 4 would become its own
   thing.

Applied across all ~30 nodes in the four confrontation NPCs' manuscripts
plus the Therapist's one node — see each `manuscript/<npc>.txt` for the
actual tagged words and which emotion each one carries.

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

**IT has a real mark now** (`public/assets/shared/sprites/spr_it_icon.webp`
— an eye-in-a-triangle, dark-on-transparent) in place of the empty
placeholder box in `.dx-it-icon` (`scenes.css`). Wired in `ui/itPopup.js`.
Native 32×32 pixel-art source; `image-rendering: pixelated` on the icon
keeps the upscale to the 56px slot crisp rather than smoothing it out.

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
- *"Which specific moments trigger it?"* At the end of an NPC's node
  graph (`dialogScene.js`'s `showFindingIfAny()`), and **only when there's
  a new finding** (see "Findings, not commentary" above): a truth/lie
  pattern flip, or the dominant emotion changing since IT last read it.
  At most one per encounter, none if a bloom already interrupted it,
  skipped below 2 total picks, and skipped for an NPC with an authored
  `outro` (the Therapist), whose outro already ends on IT.

**Code:**
- IT beat type in `cutsceneScene.js`, and the render factored out into
  `ui/itPopup.js`'s `createItPopup()` so any scene can call it directly —
  used by `dialogScene.js` (bloom events, findings, the Therapist outro),
  `reckoningScene.js` (the gatekeepers), and `endingScene.js`, none of
  which sequence beats at all. Any popup closes on a tap anywhere once its
  line has drawn, as well as on the X.
- Every popup plays `audio.playTyagl()` on mount (the diagnosis sting,
  reused deliberately).

**Content — placeholder prose throughout, ~40 lines total:**
- 3 intro lines (class-neutral) — `content/it_intro.json`
- 12 confrontation lines (4 NPCs × 3 classes) — `content/confront_<npc>.json`
- 12 bloom-threshold lines (4 thresholds × 3 classes) — `engine/itBlooms.js`
- 12 dominant-emotion lines (3 classes × 3 emotions + 3 neutral) —
  `engine/itEmotionLean.js`
- 3 ending lines (one per class) — `engine/itEndgame.js`
- 4 finding lines (IT + SO for each pattern-flip direction, observer
  voice, class-neutral) — `engine/itFindings.js`
- 4 Therapist-outro lines (IT + SO per dream answer) —
  `manuscript/therapist.txt`'s `=== OUTRO`
- 4 gatekeeper lines (IT + SO per lake status band) — `content/pastor.json`

**What's actually still open**, and it's not engineering:
- All of the above is exercise prose, not final writing — same "rewrite
  the words, the structure's already wired" job as the rest of Chapter 1's
  placeholder content.
- Per-NPC-flavored IT lines during the encounters themselves (right now
  the dominant-emotion read is generic across all four NPCs, the same way
  bloom lines are generic across thresholds — a deliberate scope cut to
  keep the placeholder set at ~40 lines instead of ~160).
- The hint-system merge (below) — separately, still not scoped for build.
