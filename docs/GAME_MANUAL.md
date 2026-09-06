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
lake is a character. Its health is tracked the same way the player's
lies are (`lakeHealth`, driven by Truth Debt) — though **nothing surfaces
that to the player yet**: `lakeHealth` and the bloom-event thresholds at
debt 3/6/8 are computed and stored, but Chapter 1 never draws them, so
the lake doesn't visibly change during play. The one debt threshold with
teeth today is 10, which forces the Reckoning. Making the lake react is
an open job, currently pencilled in as an IT intrusion (`IT_DESIGN.md`)
rather than as its own art pass. The civic myth ("the water's fine") is the game's
first lie, told to the player before they've made a single choice — the
opening cutscene (Bob Baiter, the town's booster-councilman) is an
*unchosen* lie, establishing the whole town's relationship to honesty
before any NPC does.

### FEELZ

FEELZ is the diegetic device for every mechanic: a phone app with a mood
wheel, ostensibly there to help the player process what happened at the
lake. In practice it's how the player picks an emotional lean before
every choice (see §3). It's deliberately a little broken — "janky" is
the operative word, not "clean UI." The Therapist (§5) is the human voice
behind it.

### The loop, at chapter scale

Chapter 1 has one fixed shape, and every future chapter is expected to
reuse it:

```
Opening call (one continuous scene, order is load-bearing)
  Prologue  →  Questionnaire  →  Therapist

Then, once per NPC (Deborah → Rwanda → Samun → Rick):
  Explore (mini-game walk)  →  Confront (pick your opener)  →  Encounter (dialog)

Then:
  Reckoning (confess or double down on your loudest lies)
  →  Ending (one of four, picked by how much you lied)
```

**Why the opening call is one unit, not three scenes.** The Prologue
ends on the player's phone buzzing. The Questionnaire's last beat hands
off to the Therapist picking up mid-ring. Splitting or reordering these
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
wheel (Joy, Trust, Fear, Surprise, Sadness, Disgust, Anger, Anticipation
— Plutchik's wheel). Only 3 of the 8 are ever lit up and selectable in a
given playthrough — which 3 depends on an invisible "class" set by the
opening Questionnaire (see below). Dragging the emotion onto the swipe
card (instead of just tapping it) tints the card in that emotion's
color — a small, optional flourish with no separate mechanical effect.

Picking an emotion does two things:
- It's on record for that response.
- It amplifies whichever one meter that emotion is tied to (×1.5, in
  whatever direction the choice was already pushing it). This is the
  *only* thing FEELZ picks affect mechanically — they never change what
  node comes next or which ending is reachable. Right/wrong doesn't come
  into it; there is no "correct" emotion for a moment.

The player is never told this is happening. It's a texture, not a puzzle.

### The four meters + the one that matters

Four thin bars sit at the top of every dialog screen: **INT**
(Integrity), **TRU** (Trust), **STB** (Stability), **LUC** (Lucidity),
each 0–10. Truth generally raises Integrity and Lucidity and costs
Stability/Trust; a comforting lie usually does the opposite. These are
mostly *legible texture* right now — visible to the player, shaping which
line shows up as the closing "epilogue" note on the ending screen, but
not (yet) branching content on their own, with one exception: Rick's
opening line is gated on Trust, and any future NPC can be authored the
same way. Full narrative meaning of each meter is in
[`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md#what-the-stats-mean).

**Truth Debt** is separate, 0–10, and it's the one number with teeth.
Nearly every lie adds to it (truths almost never do). It's shown to the
player as a small pulsing sigil that reads more urgent as debt climbs
("elevated" at 3–7, "critical" at 8+). Hit 10 anywhere, mid-NPC or not,
and the game cuts straight to the Reckoning — no more encounters, no
matter who's left. Every lie big enough to matter is also logged, quietly,
to a running **Truth Ledger** the player never sees until it comes due.

### Reading text

Every line the player reads (NPC reactions, cutscene narration) draws
character-by-character, old-JRPG style. **Tap once to finish a line
instantly; tap again to move on.** Nothing on a story beat ever
auto-advances *before* the player has read it — the only exception is a
handful of intentionally brief pacing beats that advance themselves a
moment after finishing, and even those still accept an early tap. Writers
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

Once Truth Debt maxes out (or the four NPCs are done), the player faces
up to three of their biggest logged lies, most recent first. Each one:
**Confess** (pay that lie's debt back down, the truth version of what
they should have said) or **Double Down** (dig in — a flat debt penalty,
every time, regardless of the lie's size). This is the only place in the
game debt can go back *down*.

### The ending

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

### The class the player never sees

Three swipe questions right after the Prologue quietly sort the player
into **Guns** (Anger / Fear / Anticipation), **Bible** (Trust / Disgust /
Anticipation), or **Crystals** (Joy / Sadness / Surprise) — which 3 FEELZ
emotions are lit up all run, and which meter each one amplifies. The
Therapist's very next line is a "diagnosis" with a few words tinted in
that class's colors — the *only* signal the player ever gets, and the
class name itself is never shown. Same idea drives the walk captions
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
| 4 | Questionnaire | questionnaire | No unique art — three swipe cards, then the Therapist's tinted-word diagnosis over the shared FEELZ pattern background. |
| 5 | Therapist | dialog | Location 1. Voice-only — no sprite, no portrait art needed by design (see §5). |
| 6 | Deborah — hallway walk | minigame | 🔲 placeholder. A residential hallway, 4 hotspots + 1 advance. See §5 for character notes. |
| 7 | Deborah — confrontation | cutscene | 🔲 placeholder bust (`npc_deborah.svg`) + a 3-way opener choice. |
| 8 | Deborah — encounter | dialog | Portrait is a colored-initial placeholder today (`ui/npcPortrait.js`) — real portrait art is an open job, 128×128, 1-bit, tinted by her accent color. |
| 9–11 | Rwanda — walk / confront / encounter | minigame / cutscene / dialog | Same shape as 6–8. Walk room: an alley. |
| 12–14 | Samun — walk / confront / encounter | minigame / cutscene / dialog | Same shape. Walk room: a gas station / garage. |
| 15–17 | Rick — walk / confront / encounter | minigame / cutscene / dialog | Same shape. Walk room: a biker bar ("Barlot"). |
| 18 | Reckoning | reckoning | No unique art — text cards over the shared screen chrome. |
| 19 | Ending | ending | A full-bleed procedural pattern (already built, keyed by ending) before the text. No ending-specific art exists yet. |

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
chapter's tutorial voice) and Bob Baiter (the chapter's only non-playable
lie). Location numbers below match `LOCATION:` in each NPC's manuscript
file. "Background" notes are lore from the original design bible
(`DX Bible.md`) meant to inform how you write this character further —
they aren't necessarily dramatized on-page yet, and are marked as such.

Every NPC's structure is identical: one opening node with two swipes
(truth/lie), each leading to one of two second nodes, each of *those*
ending the encounter. Every opening node also has two alternate versions
(`_soft`, `_hard`) selected by how the player opened the confrontation —
same character, same wound, different angle of approach.

### THERAPIST — Location 1

- **Where:** never seen. A voice on the phone, through FEELZ.
- **Accent:** `--color-therapist` (`#9370db`, soft violet).
- **Leitmotif:** the ambient track already scoring the Questionnaire
  (`heavens_waiting_room.mp3`), not a synthesized phrase like the other
  four — she's the one character whose "theme" is the room tone itself.
- **Voice:** tired but warm. Overworked, still listening. A chart opens
  audibly on her end; another call is always waiting.
- **Role:** the tutorial. She teaches truth-vs-lie with zero explanation
  of mechanics — the player learns what swiping left does by feeling her
  respond to it, nothing more. Keep any future Therapist writing
  mechanic-silent for this reason.
- **Core exchange:** "What happened in the dream?" Truth costs Stability
  but earns a rare moment of her guard dropping ("thank you for telling
  me that — most people give me the short version"). The lie is barely a
  lie ("I don't remember") and Truth Debt only ticks up by 1 — the
  gentlest cost in the whole chapter, intentionally, since this is the
  player's first swipe.

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
