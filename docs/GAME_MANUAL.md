# Dream Xtreme — Game Manual

The one doc to hand a new writer, artist, or collaborator before anything
else. It explains what the game *is*, what a player actually does, and
walks Chapter 1 beat by beat — the same way a board game's manual covers
theme and rules before you touch a card. It does not cover engine
internals or JSON shapes; for those, see the doc map at the bottom.

If you're here to write dialog, read this once, then live in
[`SCRIPT_KEY.md`](SCRIPT_KEY.md) — the quick-reference companion built
specifically for editing the script fast.

---

## 1. The pitch

**Dream Xtreme** is an episodic interactive zine about the debt every lie
creates. Each chapter is a short, self-contained story told through
swipes — left for the truth, right for a lie — played on a phone or a
mouse, no difference between them.

**Chapter 1: Truth Debt — Lake Ulysses.** You come to on the cracked
shoulder of Lakeshore Drive, ears ringing, clothes damp, a half-remembered
dream still bleeding out of you. Your only guide is FEELZ — a janky
therapy app on your phone — and the four people you meet around the lake,
each clinging to a favorite lie of their own. Every comforting lie you
tell stabilizes the moment and adds to a debt you can't see. Every truth
you let in cracks something open *now* instead of later. Eventually, the
debt comes due.

**Tone in one line:** deadpan civic dishonesty (a councilman insisting
the toxic lake is "acceptable") sitting right next to real, specific
grief — never resolved into a joke, never resolved into melodrama either.
Nobody in this game is right or wrong for lying. **The game never tells
the player they chose well or badly** — this is the project's single
hardest rule. Every stat swing, sound cue, screen shake, and NPC reaction
describes *weight*, never a verdict.
If you're writing a line that reads like praise or punishment, it's off
tone; rewrite it to describe what the choice cost or bought instead.

---

## 2. The world & the rhythm of the loop

### The setting

**Lake Ulysses** is the in-fiction rebrand of a real toxic-algae lake:
"3,000 acres. A jewel," according to every sign and civic ad — and every
few months, closed again, "under control," reopened, closed again. The
lake is a character, and **it's how the player sees their Truth Debt**:
a water-quality gauge at the bottom of every dialog screen, modeled on a
real TDS (total dissolved solids) chart. It runs from clean blue (20 ppm,
IDEAL) to swamp green (520 ppm, OVER LIMIT), with a tamagotchi fish tank
in the corner that goes from three thriving fish to one belly-up. It's
indifferent on purpose: a sensor readout, not a judgment. A square-wave
water splash, pitched by the water's quality, plays after each reaction.
Crossing a bloom threshold (3/6/8/10) also brings in an IT interrupt
(`IT_DESIGN.md`). The civic myth ("the water's fine") is the game's
first lie, told to the player before they've made a single choice — the
opening cutscene (Bob Baiter, the town's booster-councilman) is an
*unchosen* lie, establishing the whole town's relationship to honesty
before any NPC does.

### FEELZ

FEELZ is the diegetic device for every mechanic: a therapy app on the
player's phone, and **the game's whole interface is that app**. It boots
when the phone buzzes at the end of the Prologue: a glowing rainbow
silhouette of the FEELZ wheel and a synth chime, then a real-app-style
check-in (two "over the last 2 weeks, how often…" questions, modeled on
the PHQ-2 screening questionnaire), then "matching you with care." The
check-in answers come back at the very end, set against what actually
happened (§3, "The ending"). The Therapist (§5) is the human voice behind
the app.

### The loop, at chapter scale

Chapter 1 has one fixed shape, and every future chapter is expected to
reuse it:

```
Opening call (one continuous scene, order is load-bearing)
  Prologue  →  FEELZ boot + check-in  →  Questionnaire (intake)  →  Therapist (tutorial)

Then, once per NPC (Deborah → Rwanda → Samun → Rick):
  Explore (mini-game walk)  →  Confront (pick your opener)  →  Encounter (dialog)

Then:
  Reckoning: Pastor Gabriel's baptism (confess or double down, then under the water)
  →  Ending (one of four, picked by how dirty the lake is)
```

**Why the opening call is one unit, not four scenes.** The Prologue
ends on the player's phone buzzing. FEELZ opens, runs its check-in, and
matches the player with a provider. The Questionnaire is that provider's
intake, and its last beat hands off to the Therapist picking up. Splitting or reordering these
breaks a line that already answers a line — see
[`HANDOFF.md`](HANDOFF.md) if you're ever tempted to move one.

**Why every NPC is explore → confront → encounter.** The walk builds
atmosphere and place before a face ever appears; the confrontation is
where the player picks *how* they're arriving (guarded, warm, or already
swinging), which changes which node the encounter opens on; the encounter
is the actual truth/lie choice. Nothing about this shape is
NPC-specific — it's the chapter's one repeating sentence, said four
times with different words.

---

## 3. How you play (the baseline)

This is what a player can *do*, moment to moment, start to finish.

### The one verb: swipe

Every dialog choice is a card with two sides. **Swipe (or drag) left =
Truth. Swipe right = Lie.** Mouse, touch, and pen all use the same
gesture — there's no separate "tap the button" mode. A tap can also
finish a line that's still drawing, or advance past a line that's done
drawing — see "Reading text," below.

### FEELZ: pick a feeling before you answer

Before most swipes, the player taps or drags an emotion off an 8-slice
wheel (Happy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anxiety
— Plutchik's wheel, with Anxiety in Anticipation's slot). **The player only ever sees symbols** (★ ◆ ◉ ⊕ ▼ ✕
▲ ▶), never the names, and no character names a feeling out loud either.
Only 3 of the 8 are ever lit up and selectable in a given playthrough —
which 3 depends on an invisible "class" set by the opening Questionnaire
(see below). Picking one tints the swipe card in its color and gives the
card a small wiggle, pointing at it as the next thing to touch. On a
phone, holding a slice plays its tone louder without picking it: a way
to listen before choosing.

Picking an emotion does two things:
- It's on record for that response.
- It amplifies whichever one meter that emotion is tied to (×1.5, in
  whatever direction the choice was already pushing it). This is the
  *only* thing FEELZ picks affect mechanically — they never change what
  node comes next or which ending is reachable. Right/wrong doesn't come
  into it; there is no "correct" emotion for a moment.

The player is never told this is happening. It's a texture, not a puzzle.

### The four meters + the one that matters

The four meters, each 0–10, read as the FEELZ phone's **status bar** at
the top of every dialog screen (`ui/statusBar.js`):

| Meter | Shown as |
| :-- | :-- |
| **STB** Stability | Battery. Red, with a chirp, at 2 or below. |
| **TRU** Trust | Signal bars. |
| **LUC** Lucidity | Wi-Fi arcs. |
| **INT** Integrity | The clock. Below 7 its minutes glitch; near 0 it shows `--:--`. |

The carrier name reads the lake: **FEELZ 5G → LTE → E → No Service** as
Truth Debt climbs. A red dot blinks just before IT or SO nudges you, and
the bar goes to ✈ airplane mode when an NPC shuts you out at the door.

The icons are lo-fi pixel sprites. When a meter moves, its icon pulses bright (up) or flickers (down), the word for it shows under the bar ("▲ connected", "▼ steady": honest / connected / clear / steady), and a two-note square blip rises or falls, pitched per meter (battery lowest, clock highest) so each is learnable by ear. Nothing plays before the therapist reveals the meters.
The Therapist explains all of it in his first reaction. Truth generally raises Integrity and Lucidity and costs
Stability/Trust; a comforting lie usually does the opposite. These are
mostly *legible texture* right now — visible to the player, shaping which
line shows up as the closing "epilogue" note on the ending screen, but
not (yet) branching content on their own, with one exception: Rick's
opening line is gated on Trust, and any future NPC can be authored the
same way. Full narrative meaning of each meter is in
[`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md#what-the-stats-mean).

**Truth Debt** is separate, 0–10, and it's the one number with teeth.
Nearly every lie adds to it (+2 to +4), and **every truth clears it by
1** unless the script says otherwise, so the lake can recover during
play. The player sees it as the lake gauge (§2): its five statuses
(IDEAL / MARGINAL / HIGH / CONTAMINATED / OVER LIMIT) line up exactly with
the four endings, so a status change means the ending they're heading
toward just changed. Hit 10 anywhere, mid-NPC or not, and the game cuts
straight to the Reckoning — no more encounters, no matter who's left.
Every lie big enough to matter is also logged, quietly, to a running
**Truth Ledger** the player never sees until it comes due.

### IT and SO

Each popup labels the icon with its name, IT or SO. At the very end of the chapter the missing letters pry their way in: IT becomes SHIT, SO becomes SHOW.

Two intrusive-thought voices that pop up like ads. **IT** states things
with dread and certainty. **SO** answers IT with doubt. They're
observers who keep score and never admit they're against you. They don't
comment after every conversation. They speak up only when they notice
something new: the player's truth/lie pattern flipped, their go-to
feeling changed, or the lake crossed into a new status. A tap anywhere
closes them. Full design: [`IT_DESIGN.md`](IT_DESIGN.md).

### Contacts: dial a friend

A dock under the lake gauge holds your contacts. The **Therapist** is
always there, but only picks up when your bars and Wi-Fi are both 4 or
more; otherwise the call fails. Anyone who **trusts** you joins after
their stay-in-touch moment (below). A call rings, then the caller (their
avatar on the left of the box) greets you in their own way, reads the
person you're facing (their mood's slice glows on the wheel; the read is
more reliable the stronger your bond), and advises truth or lie from
their own bias (Rick pushes lies, Rwanda pushes truth). The Therapist
also reads your weakest vital. One call per contact per encounter.
Content: `engine/contacts.js`.

### IT and SO watch your pace

Sit on a choice and they lean in: IT at 30s, SO at 45s, IT at 60s, SO at
75s, then silence (the tutorial's first question is exempt). Answer three
in a row in under 2 seconds, or cut four lines short in a row, and they
comment once per run; SO's skimming reply points at the **text speed**
setting (gear → TEXT: NORMAL / FAST / INSTANT). None of it changes a stat.
Lines: `engine/itPressure.js`.

### Reading text

Every line the player reads (NPC reactions, cutscene narration) draws
character-by-character, old-JRPG style. **Tap once to finish a line
instantly; tap again to move on.** Nothing on a story beat ever
auto-advances *before* the player has read it — the only exception is a
handful of intentionally brief pacing beats that advance themselves a
moment after finishing, and even those still accept an early tap. Long
text (over ~140 characters) splits into pages at sentence ends: each page
draws in a fresh box, a blinking ▶ says there's more, and a tap turns the
page. Text size scales with the screen, so it stays readable on a tablet.
Writers
control the *rhythm* of this draw directly from the script — see
[`SCRIPT_KEY.md`](SCRIPT_KEY.md).

### Between NPCs: the walk

Getting to each NPC is its own small scene — never a skill test, never
failable. The player walks room to room, taps glowing objects for a
short caption (which varies by the player's invisible class — three
versions of every caption exist), and moves on once they've looked at
everything there is to look at. Occasionally a quick "duck!" or "catch
it!" reflex beat interrupts — swipe or tap, and *any* answer resolves it,
including doing nothing until the clock runs out. There is no way to
fail a walk. Full mechanical detail: `SCENE_TYPES.md`'s `minigame`
section.

### The Reckoning

Once Truth Debt maxes out (or the four NPCs are done), the player is
called down to the water by **Pastor Gabriel** (§5), standing waist-deep
in the lake. He puts up to three of their most recent logged lies to
them. Each one: **Confess** (that lie's debt comes back off, and the
lake clears live on screen) or **Double Down** (a flat +3, every time,
regardless of the lie's size). Confession is never quite enough for him.
Then IT and SO, as his hellhound gatekeepers, walk the player into the
water, and he holds them under at the lake's final level: the screen
sinks into clear blue or swamp green. Even a player with nothing to
confess still gets baptized.

### The ending

The ending is three pages, tap NEXT between them:

1. **The water.** The lake's final reading, full size, with whatever's
   left in the fish tank. Under it, the player's FEELZ check-in answers
   set flat against what was recorded (lies told, to how many people),
   with no comment on the gap.
2. **The FEELZ clinical summary.** The app's read on the player: their
   class, revealed for the first time as a clinical diagnosis (e.g.
   *Reactive-Protective Type (FP-01)*); bars for how often they reached
   for each feeling; a one-line interpretation by class and top emotion;
   truths and lies per person; and a case note. Built in
   `ui/feelzReport.js` from data the run already tracks.
3. **The story.** The ending text, then a compact one-line summary under a
   small gauge (screenshot-ready), then IT and SO get the last word.

Final Truth Debt alone decides which of four endings plays:

| Debt | Ending | Lake Ulysses, after |
| :-- | :-- | :-- |
| 0–2 | **Clean Cut** | Closed again. Clearing, finally. Nobody thanks you. |
| 3–5 | **Functional Mask** | Reopened "under enhanced monitoring." PR videos, worded-around advisories. |
| 6–7 | **Collapse** | Sirens at dusk. Nobody's in charge of what happens next. |
| 8–10 | **Living Lie** | Reopened, influencer-ready. Dead fish edited out of the photos. |

One extra line — the "epilogue" — is appended, naming whichever of the
four meters strayed furthest from its starting value of 5. That's the
only place the four meters get the last word.

### Every answer is a hit

Each answer plays as a battle beat. **Wind-up:** the NPC's wave grows as
their line types, over a quickening heartbeat. **Aim:** picking their
mood chimes and locks the player's line onto theirs; a different feeling
grinds. **Commit:** a 150ms freeze frame and a flash in the picked
feeling's color. **Impact:** on their reaction, a shockwave in the mood
the answer sends them into, their wave shifts to it, and the shake
scales with how far their TRU and STB moved.

### The oscilloscope: how close you are

A heart-monitor band runs across the portrait. Their line sits on top, yours underneath, and the gap between them is how close this person is to you: it narrows with every attuned pick and every bid you turn toward, widens with each answer that does neither, and closes completely (the lines merge and glow) once they trust you. Holding a feeling previews it: theirs pulls the lines in a little, another pushes them apart. Your line wears the color of the feeling you hold (or your last one), and a strip under the portrait keeps one colored block per answer in this encounter (newest outlined), so you can see which feelings you lean on with this person. Shut out (airplane mode): your line greys and theirs flatlines.

### Voices and phone sounds

Every character barks one word in SAM (the 1982 Software Automatic Mouth), never a reading of the text. Voices and words live in `src/shell/voices.js`.

| Who | Voice | Greet / bye (calls) | Reaction up / down / flat |
| :-- | :-- | :-- | :-- |
| Therapist | tired, nasal | "Browning." / "Take care." | "Mmm hmm." / "Hmm." / "Okay." |
| Deborah | bright, wobbly | "Hello, dear!" / "Bless you." | "Oh, honey." / "Well!" / "Mmm." |
| Rwanda | dry, unhurried | "Yeah?" / "Later." | "Huh." / "Right." / "Sure." |
| Samun | quick, bouncy | "Yo!" / "Peace!" | "Ha!" / "Oof." / "Yeah yeah." |
| Rick | low, clipped | "What." / "Yep." | "Heh." / "Tsk." / "Uh huh." |

When someone trusts you and you swap numbers, they send you off in their voice as the bust closes: Deborah "God bless you, sweetheart.", Rwanda "Don't be a stranger.", Samun "Catch you later, man!", Rick "Watch yourself out there." The reaction bark plays as their reaction lands, chosen by how your answer moved their TRU + STB. Calls go through a telephone band. Each person has their own ringtone (Deborah: church chimes with one sour note; Rwanda: a cool minor seventh; Samun: a quick bright run; Rick: an old wall-phone bell; the therapist: the old handset). Hanging up clicks into three falling tones; the tutorial call ends on his "Take ca—" cut off by that tone. Echo call: his real "Hello?" three times, fainter. Disconnecting: an answer that neither meets them nor turns toward them plays two notes drifting apart; being shut out (airplane mode) drops the signal: static under a sinking tone.

### Trust

Trust is not Truth. Truth is the lake: did you say what's real. Trust is
whether people can rely on you, and it's built three ways:

- **Attunement.** Every NPC moment has a mood (one of the 8 feelings),
  shown as the oscilloscope's color. Pick the matching feeling and the
  waves sync.
- **Turning toward.** Some lines are "bids" (Deborah saying Caleb's name).
  Meeting one warms the portrait gold. On some bids a kind lie counts
  too, so a player can build trust while still dirtying the lake.
- **Consistency.** Word travels in Lake Ulysses. Tell one person one thing
  and a later person the opposite, and IT quotes your earlier line back to
  you ("Funny. You told Samun..."); the second person loses a sync.
  Contradict yourself to the same person and they catch it themselves:
  their callout ("On my porch you said faith didn't save him. Now he's at
  peace?"), the warmth leaves their portrait, the scope's lines snap apart
  with static, and their SAM "down" bark plays. Cost: -2 syncs, TRU -1,
  and a bid on that answer doesn't count. Lying first and telling the
  truth later is never a catch. 8 pairs: two each for Deborah, Rwanda,
  Samun and Rick.
  Contradict yourself to the same person and they catch it themselves:
  their callout ("On my porch you said faith didn't save him. Now he's at
  peace?"), the warmth leaves their portrait, the scope's lines snap apart
  with static, their SAM "down" bark. Cost: -2 syncs, TRU -1, and a bid on
  that answer doesn't count. Lying first and telling the truth later is
  never a catch. 8 pairs: two each for Deborah, Rwanda, Samun, Rick.

Two syncs plus one bid met and that NPC **trusts you**: the screen closes
to a vignette on them, all sound drops out, a crack, then a short story
beat of them letting you in (different per NPC and per class). If the
encounter ends with them trusting you, a last beat closes it: the room
goes dark, their bust fades in large, one on one, and they ask to stay in
touch in their own way (per class). Their contact joins your dock. Earn
trust with 2 NPCs and the **Trust** feeling unlocks, surfacing on the
next encounter's wheel like any other.

### Filling the wheel

Each class starts with 3 of the 8 feelings. Meeting a bid also unlocks a
feeling: the first on that NPC's list the player doesn't have yet. No
announcement: the next time the wheel shows, the new slice cracks in,
slams into place, and rings its tone, and the chord gains a voice. The
Therapist's intrusive-thoughts question demonstrates it in the tutorial.
Turning toward all four NPCs collects 7; Trust is the 8th. The ending
report shows FEELINGS COLLECTED n/8.

### The class the player never sees

Three swipe questions right after the Prologue quietly sort the player
into **Guns** (Anger / Fear / Sadness), **Bible** (Anxiety / Disgust /
Fear), or **Crystals** (Happy / Anxiety / Surprise) — which 3 FEELZ
emotions are lit up all run, and which meter each one amplifies. The
Therapist's very next line is a "diagnosis" with a few words tinted in
that class's colors — the only signal during play. The class is named
only at the very end, as a diagnosis on the FEELZ clinical summary. Same idea drives the walk captions
(three tonal variants per hotspot, one per class). Writers: when you
write class-varying text, you're writing a *lens* on the same room or
line, not a different plot.

---

## 4. Chapter 1, beat by beat — for artists

This is the full play-order of `lake-ulysses`, exactly as it runs
(`src/chapters/lake-ulysses/index.js`), with what kind of scene each beat
is and, roughly, what it needs visually. Placeholder status per
`HANDOFF.md`'s "Known gaps" is called out inline — treat every ✅ as
already scoped and every 🔲 as the actual open art job. For pixel specs,
budgets, and the exact hand-off format per asset type, use
[`ASSET_GUIDELINES.md`](ASSET_GUIDELINES.md) alongside this — this
section tells you *what* exists where; that one tells you *how* to build
it.

| # | Scene | Type | What it needs |
| :-- | :-- | :-- | :-- |
| 1 | Opening Quote | cutscene | Full-bleed narration over an animated bg (`spr_QuoteBG`, 5 frames ✅). No characters. |
| 2 | Bob Baiter | cutscene | Animated lake bg (`spr_lake_bg_001`, 46 frames ✅) + a councilman character sprite (`spr_bb`, 10 frames ✅) delivering a monologue direct to camera. |
| 3 | Prologue | cutscene | One background image (`prologue-lake.svg`, 🔲 placeholder) + a mid-scene branching choice ("Get up" / "Stay down a little longer") that doesn't need divergent art. |
| 3b | FEELZ boot + check-in | cutscene | ✅ Code-drawn: a glowing FEELZ-wheel silhouette with a moving rainbow wave, the FEELZ logo, then text-and-button check-in screens. 🔲 The boot chime is a placeholder synth. |
| 4 | Questionnaire | questionnaire | No unique art — three swipe cards ("INTAKE 1 / 3"), then the Therapist's tinted-word diagnosis over the shared FEELZ pattern background. |
| 5 | Therapist | dialog | Location 1. Voice-only — no sprite, no portrait art needed by design (see §5). Introduces each piece of the interface under a spotlight vignette. |
| 6 | Deborah — hallway walk | minigame | 🔲 placeholder. A residential hallway, 4 hotspots + 1 advance. See §5 for character notes. |
| 7 | Deborah — confrontation | cutscene | 🔲 placeholder bust (`npc_deborah.svg`) + a 3-way opener choice. |
| 8 | Deborah — encounter | dialog | Portrait is a colored-initial placeholder today (`ui/npcPortrait.js`) — real portrait art is an open job, 128×128, 1-bit, tinted by her accent color. |
| 9–11 | Rwanda — walk / confront / encounter | minigame / cutscene / dialog | Same shape as 6–8. Walk room: an alley. |
| 12–14 | Samun — walk / confront / encounter | minigame / cutscene / dialog | Same shape. Walk room: a gas station / garage. |
| 15–17 | Rick — walk / confront / encounter | minigame / cutscene / dialog | Same shape. Walk room: a biker bar ("Barlot"). |
| 18 | Reckoning: Pastor Gabriel's baptism | reckoning | Text over the lake gauge; the baptism is a full-screen water fill in the lake's final color. 🔲 No Pastor art yet, and IT/SO as hellhounds reuse the IT popups (real dog art is an open job). |
| 19 | Ending | ending | A full-bleed procedural pattern (already built, keyed by ending), then the final lake reading (large gauge + fish tank) and the check-in record before the text. |

**Everything in rows 6–17 (all four mini-games and all four
confrontations) is placeholder art and placeholder prose today** — this
is the single largest and most obvious art job in the project. The room
backgrounds, hotspot objects, and confrontation busts are all
procedurally generated vectors (`scripts/make-placeholder-room.mjs`),
built specifically so the walk/confront system could be designed and
played before real art existed. Replacing them is pure content and art
work — no engine changes required.

**Frame of reference for every piece of art:** the canvas is a 390×844
portrait rectangle (iPhone 14 baseline) that scales to whatever screen
it's on — nothing should be positioned or sized in fixed pixels except
mini-game hotspot coordinates, which are authored in that exact
390×844 space and converted automatically. See `HANDOFF.md`'s canvas note
if a piece of art is getting clipped on a real device.

---

## 5. The cast of Chapter 1

Four NPCs, one stop each around the lake, plus the Therapist (the
chapter's tutorial voice), Pastor Gabriel (the chapter's judgment) and
Bob Baiter (the chapter's only non-playable lie). Location numbers below match `LOCATION:` in each NPC's manuscript
file. "Background" notes are lore from the original design bible
(`DX Bible.md`) meant to inform how you write this character further —
they aren't necessarily dramatized on-page yet, and are marked as such.

Every NPC's structure is identical: one opening node with two swipes
(truth/lie), each leading to one of two second nodes, each of *those*
ending the encounter. Every opening node also has two alternate versions
(`_soft`, `_hard`) selected by how the player opened the confrontation —
same character, same wound, different angle of approach.

### The intake (FEELZ evaluation)

Part 2 of the FEELZ check-in. Three swipe questions in the app's own form (app bar, progress, "PART 2 · Q1 OF 3"); the first question demos the swipe, and tapping an answer works too. Then: FILE CREATED, a redacted file code, "Results sealed until session end" (the class is only named in the ending's FEELZ report), and the provider card, Charles Browning, LCSW, before the therapist's colored-word read.

### Trying his contact

Near the end of the call his own contact pops into the dock and he asks you to tap it. You call him while he is on the line: his "Hello?" echoes back twice with feedback, he jokes that nobody needs two of him, then explains what calls are for (his read on you and the person in front of you), that low bars/Wi-Fi mean he will not pick up, and that friends you make join the dock.

### Swiping

While you drag, the card leans into a side: that label grows and takes its color (cool for TRUTH, warm for LIE, never green/red), the card's border and wash follow, and a TRUTH / LIE stamp fades in over the card.

### THERAPIST — Location 1

- **Name:** Charles Browning (male). On screen he is only ever THERAPIST; the name appears once, on the FEELZ provider card.
- **Where:** never seen. A voice on the phone, through FEELZ.
- **Accent:** `--color-therapist` (`#9aa0a6`, clinical grey: an office, a chart, a waiting room).
- **Leitmotif:** the ambient track already scoring the Questionnaire
  (`heavens_waiting_room.mp3`), not a synthesized phrase like the other
  four — he's the one character whose "theme" is the room tone itself.
- **Voice:** an LCSW (licensed clinical social worker) at a community
  clinic with a 40+ caseload, typing notes while you talk. He's also
  somehow a guru who speaks in small aphorisms ("Weather, not a
  verdict"), then gets pulled back by the clock ("then I have to take my
  two o'clock"). Tired but warm, never cruel.
- **Role:** the tutorial, done as guided discovery (the CBT technique of
  asking so the client finds the answer). He never explains a mechanic.
  Each question makes the player use one new piece of the app for the
  first time, and it's spotlit (everything else dims) as he reaches it:
  wheel, card, meters, lake. Keep any future Therapist writing
  mechanic-silent.
- **Two exchanges:** "How are you walking in today? Just point." (he
  describes the picked symbol in an image, never by name; the meters
  appear), then "What happened in the dream?" (the lake gauge appears:
  "FEELZ reads it off the county sensors. It doesn't care how you feel").
- **Outro:** surreal homework per class, a closing line depending on the
  dream answer, the call ends, then IT and SO get the last word.

### DEBORAH — Location 2

- **Where:** a dingy condo, half Airbnb, half prayer closet.
- **Accent:** `--color-deborah` (`#ffd700`, gold).
- **Leitmotif:** slow descending sine, hymn-like (A3→G3→E3→D3).
- **Voice:** devout, brittle, quick to smile too wide when cornered.
- **Core wound:** she believes God took her son on purpose, and needs
  that to be true more than she needs it to be kind. "I want to be with
  my dead son again, and faith is the only way" — her whole arc is
  whether the player lets that belief stand or names what it's covering.
- **Background (bible, not yet on-page):** the original design frames
  her denial as tangled up with COVID and a sense of personal
  responsibility for her son's death — none of that is explicit in the
  current manuscript, which keeps it purely at "faith vs. someone
  failed him." A writer expanding her arc has room to bring that in.
- **Shape of the arc:** confronting her belief (truth) costs Trust and
  Stability immediately but can crack her open by the second beat
  ("she nods. Barely. It costs her something."); feeding the belief
  (lie) is the single most expensive lie in the chapter (Debt +4) and
  hardens her further every time.

### RWANDA — Location 3

- **Where:** posted by a bar/Chinese-restaurant takeout window, neon
  overhead.
- **Accent:** `--color-rwanda` (`#00ced1`, teal).
- **Leitmotif:** quicker triangle-wave riff, rhythmically alive
  (E4-G4-A4-E4-B3).
- **Voice:** direct, weary of performing for other people's comfort, and
  immediately, precisely aware when she's being placated.
- **Background (bible):** written as a queer femme Afro-Latino artist;
  voice direction in the original bible calls for a deep, resonant
  register ("James Earl Jones voice") — useful for anyone casting VO
  later, not something the text itself needs to spell out.
- **Core wound:** "Why do I gotta sand myself down just to be
  digestible?" Every lie in her arc is a small social-lubrication lie
  ("it's not that bad," "people just need time") — the kind that costs
  nothing to say and everything to hear repeated.
- **Shape of the arc:** truth is the only path that gets a genuinely
  warm reaction out of her ("Okay. You're alright."); every lie option
  reads as a flatter, more guarded version of her, and the game is not
  shy about spelling out the cost in the reaction text itself
  ("You've lost her.").

### SAMUN — Location 4

- **Where:** a gas station / garage, graveyard shift.
- **Accent:** `--color-samun` (`#4169e1`, royal blue).
- **Leitmotif:** tight repeating square-wave loop — a cycle, on purpose
  (C3-C3-Eb3-C3).
- **Voice:** deflecting, self-effacing humor as armor; visibly relieved
  when someone plays along, visibly caught when someone doesn't.
- **Core wound:** "Everyone's hooked on something. Mine's just more
  honest" — addiction reframed as candor instead of a problem. The
  player's choice is between cosigning that reframe (comfortable, +4
  Debt, tagged Health/Addiction/Denial) or naming it plainly.
- **Shape of the arc:** the truth branch doesn't fix anything — it just
  makes him "look at you. Really look" — small, not a rescue. This is
  the chapter's clearest lesson that "truth" doesn't mean "happy
  ending," it means the debt doesn't come due later instead.

### RICK — Location 5

- **Where:** a biker bar (in-repo name: "Barlot"), back to the wall.
- **Accent:** `--color-rick` (`#b22222`, brick red).
- **Leitmotif:** two low sawtooth notes, blunt (E2-A2) — deliberately the
  same harsh timbre as the Anger FEELZ stem.
- **Voice:** terse, defensive, performing toughness loudly enough to
  drown out the question underneath it.
- **Core wound:** violence as proof of belonging — "guy looked at me
  wrong... now he's got a busted jaw and I got my patch back. That's
  just how it works out here." Validating that (lie) is the single most
  reinforcing exchange in the chapter (+4 Debt, and he "will never
  question this again"-adjacent energy runs through both his nodes);
  naming it (truth) is the only moment in his arc where "something
  cracks in his face... he might actually answer. Then he doesn't."
- **Background (bible):** written with an implied closeted attraction
  to the men he postures against — not written into any current node;
  a natural direction for a third node, not a retcon.
- **The one gated NPC in the chapter:** if the player's Trust is below 3
  by the time they reach him, *every* opener redirects to
  `rick_shut_down` — he doesn't engage at all ("Word gets around. I know
  what you are."), fitting his loyalty-obsessed, defensive
  characterization rather than reading as a random lockout. This is the
  chapter's only example of a meter changing *what content shows*, not
  just what gets narrated — see `STAT_MATH.md` if you want to gate a
  future NPC the same way.

### PASTOR GABRIEL — the Reckoning

- **Where:** waist-deep in Lake Ulysses, running an altar call.
- **Names:** he calls himself **Gabriel** ("God gave me my chosen name").
  The town still calls him **Sam**. His mother named him **Samael**, the
  Angel of Death and accuser in Jewish tradition. He tells you that right
  before he holds you under, and his nameplate turns to SAMAEL.
- **Voice:** a scary evangelical who embodies the game's contradictions:
  grace and a ledger ("God don't keep a ledger. I do. For Him."), welcome
  and surveillance ("Everybody's welcome. Everybody's watched."), new life
  by drowning. He's unsettling because he partly believes it.
- **Role:** the judgment. Confession to him is never quite enough ("…Is
  that all of it?"). That's scrupulosity, religious OCD in which
  confession becomes a compulsion, and it's where IT and SO's doubt ends
  up. He knows the player's FEELZ check-in answers without being told.
- **Writing him:** every line is picked from the player's own data (lake
  status, check-in answers, lies told), climbing from warm toward the
  contradictions. Lines live in
  `src/chapters/lake-ulysses/content/pastor.json`. Deborah's "You're not
  the church" is his setup.

### BOB BAITER — cutscene only, not an encounter

- **Where:** a councilman, straight to camera, in the opening civic-ad
  cutscene.
- **Role:** not an NPC in the swipe sense — no dialog node, no truth/lie
  choice. He *is* the game's first lie, delivered to the player before
  they've made a single decision of their own, establishing the town's
  relationship to honesty before any character does. If a future
  chapter wants a second "unchosen lie" opener in this mold, this is the
  reference beat.

---

## Where to go next

- Writing or editing dialog → [`SCRIPT_KEY.md`](SCRIPT_KEY.md), then
  [`SCRIPT_FORMAT.md`](SCRIPT_FORMAT.md) for the exhaustive field-by-field
  spec and build-breaking rules.
- Producing art or audio → [`ASSET_GUIDELINES.md`](ASSET_GUIDELINES.md).
- Understanding the JSON a manuscript compiles to, or the math on top of
  the stats → [`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md) and
  [`STAT_MATH.md`](STAT_MATH.md).
- Adding a new scene type, or understanding how cutscenes/mini-games are
  built → [`SCENE_TYPES.md`](SCENE_TYPES.md).
- The "why" behind every major decision in the project so far, and
  what's deliberately not built yet → [`HANDOFF.md`](HANDOFF.md).
- All of the above as one searchable page: open
  [`docs/manual.html`](manual.html) (`npm run manual` regenerates it
  after any doc edit).
