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

### Front door: title and chapters

Every visit starts on the title: the dithered lake pans behind the DREAM XTREME logo, which arrives split (top half from the left, bottom from the right), slams together and strobes. ENTER: a first-timer goes straight into the story; a returning player goes to chapter select. Each chapter is a banner card with its own panning art; hovering it (mouse) fills the screen with that art in black and white, magnified with a drifting echo, and plays the chapter's motif, then its ambience crossfades in. Picking a chapter you have played asks SKIP STORY / FROM THE START; on touch, a tap asks "Ready to play?" first. Finishing or quitting a chapter returns to the title.

### The loop, at chapter scale

Chapter 1 has one fixed shape, and every future chapter is expected to
reuse it:

```
Opening call (one continuous scene, order is load-bearing)
  Prologue  →  FEELZ boot + check-in  →  Questionnaire (intake)  →  Therapist (tutorial)

Then, once per NPC (Deborah → Rwanda → Samun → Rick):
  Chapter page  →  Explore (mini-game walk)  →  Confront (pick your opener)  →  Encounter (dialog)

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

**The chapter page.** Each NPC opens on a page of the novel: white ink on
black, all pixel type, loading like an 80s computer (tape stripes in the
border, scanlines, a bleep for every line in a tune that sounds like the
NPC's class). It shows a Roman numeral, their name, a dithered plate of their
world and a few lines of prose, with their room already audible underneath
(Deborah's dying bulb, Rwanda's neon, Samun's static radio, Rick's bass through
the wall). Its only hint is the numeral's color, which is the NPC's own class.

**Reading the room.** In each room the objects are tinted in a flat color: the
first feeling that opener will meet, as *your* class meets them (an NPC can
feel differently toward their kin or their foe). The captions are your class's
perception of them, never a verdict. Open every object, and the one your class
can restore starts blinking; open it again for a hint in your class's voice and
tap the picture to see to it (Guns square it away, Bible make it right, Crystals
attune to it). Restore something and a fifth, secret option appears in the
confrontation, opening on their first feeling already glowing on your wheel.

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
toward just changed. Debt tops out at 10 but never ends the chapter
early: every NPC is still met, and the debt only picks the ending.

**Lies pay off (2026-10-09).** The battery is a resource: the truth often costs charge, a lie puts some back, and trying feelings on the wheel is always free. **Effort (2026-10-10):** the first time you answer (swipe) with a gifted feeling that is the opposite of one of your class's three (across the wheel: Happy/Sadness, Trust/Disgust, Fear/Anger, Surprise/Anxiety), it costs 1 battery; after that you're used to it. Your own three, Trust, and other gifts are free. The Therapist says this in his "Practical stuff" line. At 2 or less FEELZ dims to save power (the little screen and needle go dark); near empty, your most-used feeling greys out. A lie that warms someone relaxes them, so their next feeling glows on your wheel. Past a full lake, each lie also fogs the Wi-Fi and slips the clock. The Therapist names the trade and refuses to pick for you.

**Lying feels good, on purpose** (2026-10-04). Avoidance pays off now and
costs later, so the game does too:
- **Relief:** every lie plays a soft, warm chord (`audio.playRelief`). The
  truth gets none.
- **Warm water:** as debt rises an amber haze breathes in from the screen's
  edges and the whole mix goes muffled, like hearing it from under the
  surface (`engine/lake.js hazeFor`, `audio.setHaze`, `.dx-haze`). Cozy,
  not scary.
- **Cheering:** two lies in a row and IT and SO turn co-conspirators
  ("Smooth. They didn't even blink." / "See? Easier."), once an encounter,
  never sharpened by the lake (`COZY_LINES` in `dialogScene.js`). A truth
  resets the streak (`run.lieStreak`).
- **Comforting lies are bids** for Deborah, Samun and Rick, so a liar can
  still connect (Rwanda only warms to the truth).
- **The quiet cost:** every lie fogs the Wi-Fi; below 4, calls come through uncolored, the wheel
  doesn't light, and the friend can't follow your story (`foggy` lines in
  `engine/contacts.js`). The rest comes due at the Reckoning and ending.
The debt-10 IT/SO bloom is the bottom of the lake, warm and quiet, not a
verdict. The Therapist explains all of this at the end of the tutorial.
Every lie big enough to matter is also logged, quietly, to a running
**Truth Ledger** the player never sees until it comes due.

### IT and SO

Each popup labels the icon with its name, IT or SO. On their last lines with Pastor Gabriel the missing letters pry their way in: IT becomes SHIT, SO becomes SHOW. On the ending's final screen they're plain IT and SO again. When they walk you into the water they howl together, tuned by the lake: two clean hounds a fifth apart over clear water; lower, detuned to a tritone, seasick and distorted over a fouled one.

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
person you're facing in their own words (each contact has their own
phrase for all eight feelings: Rwanda sees "red. Cadmium red," Rick
just "pissed. I know pissed"; the mood's slice glows on the wheel; the
read is more reliable the stronger your bond), and advises truth or lie from
their own bias (Rick pushes lies, Rwanda pushes truth). The Therapist
also reads your weakest vital. One call per contact per encounter.
Content: `engine/contacts.js`.

Calls vary with three things. **How you left the last person:** they've
heard (connected: "I heard about you and Rwanda"; pushed away: "Samun
kicked you out? Join the club"; or it was them: "Missed me already?").
**Who you're facing:** each contact has history with the others and
frames the read through it ("Rick had me paint his tank once. Paid cash,
wouldn't look at it. Right now he's *red. Cadmium red*. That's the coat,
though, not the guy"). **Your class:** a closing tip aimed at your habit (Guns braces,
Bible reaches for the right words, Crystals soaks up everyone's weather).

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

Once the four NPCs are done, the player is
called down to the water by **Pastor Gabriel** (§5), standing waist-deep
in the lake. **His entrance:** in the dark, the death clock ticks
11:59:56 → 11:59:59, then strikes midnight: three C64 bell tolls (after
Storm Lord's opening; SID-style ring modulation and a 4-bit noise hammer),
tuned to you: the first two strike your two most-picked feelings at the
pitch each holds in your FEELZ chord, the third strikes your top three
together, and each flashes its feeling's color. His bust (placeholder pixel sprite: halo, clerical
collar, dark wings) fades in slow and stepped, and he greets you in his
SAM voice ("Welcome, child."). His nameplate reads "???" until he says
his name. A tap skips the entrance. The lake gauge doesn't appear until he
asks for your first confession. During the confessions he answers in his
voice: "Amen." on a confession, "Shame." on a double-down, and "Samael."
when his real name comes out. He puts up to three of their most recent logged lies to
them. Each one: **Confess** (clears about half of what that lie added, 1 to 3,
live on screen) or **Double Down** (adds 1, or 2 for the bigger lies).
Confession is never quite enough for him: it can't take the lake below a
third of where it stood when the altar call began, so a full lake tops out
at a functional mask, while a shallow one can still go clean. Three taps shift
the ending a tier or so; they don't decide it (`engine/reckoning.js`).
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
four meters strayed furthest from its starting value of 5, in the direction it went (each meter has a high and a low line). That's the
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

**Two instruments either side of the portrait** (borrowed from audio engineering; both describe the two of you, neither grades you):

- **Correlation needle (left):** from − (pulling against each other) through 0 (unrelated) to + (moving as one). It leans by how your feeling sits against theirs, and wanders less the closer you are; full trust with their feeling pins it at +.
- **Vectorscope (right):** your signal plotted against theirs, a Lissajous figure. The shape is the ratio between your feeling and the one they're really in (not a mask: the line can lie, the shape can't), on Plutchik's wheel (the FEELZ wheel's own order): the same feeling is a circle (1:1), a neighbor a knot (2:3), two apart a weave (8:9), three apart a denser loop (4:5), opposites a tangle that never settles (7:5, the tritone). How still it holds is closeness: drifting when far apart, locked when close, a still glowing circle at full trust. No feeling held, or shut out: a flat line.

**Masks** show one color on their line and flicker the real one underneath (about every two seconds); only the real one syncs, and the vectorscope answers to it.

**How it's taught (2026-10-09: by doing).** The Therapist's find-me exercise reacts to each pick: a hint names what it drew and he comments in his class voice, until the shape closes. In battles, short gold coach lines (never popups) appear the first time something matters (a mask, a new friend, the first busy shape or needle-left) and wait for the action; gold lines under the first reactions say what each answer moved. The science comes on your first call to him. Settings > TIPS turns his tip calls and lesson highlights on or off (calling him yourself always works). On a repeat playthrough he picks up already holding your last run's file, asks whether you want him to check in (that sets TIPS) and whether to run the exercise again. He is an early-game coach only: his new-friend call happens once, in the first three encounters (never on Rick), and a first friend who arrives later just pulses quietly in the dock. FEELZ tip popups are off for now. (Earlier, 2026-10-04:) The Therapist's last exercise has two parts. First he asks you to pick any feeling but his (his line wears a "fine" mask) and names what apart looks like: a busier shape, the needle leaning left. Then his real color starts to flicker under his line and you find it: a still circle. "My line said fine. The shape doesn't lie." In real encounters, a **FEELZ tip** (`ui/feelzTip.js`) slides up above the lake the first time each piece does something (a mask, a busy shape, the needle left, a clean circle, the pick blocks), once a run, with a tiny picture of the thing, while the scope frames that piece in a pulsing gold box (`getHighlight`). It never blocks and stays up until you tap it closed (✕). Tips only show while your Wi-Fi is 4 or more (two arcs); every lie fogs the Wi-Fi by 1 (not in the tutorial), so a liar loses them (and the Therapist's call) until the truth clears things up.

**Meters push back at the edges (2026-10-04).** Inside 3 to 7 every point moves a meter a full step; past that, moving further out costs two points per step, so meters rarely pin at 0 or 10. After each encounter a short beat shows the battery charging back: +3 if they let you in, otherwise up to +2 toward 5 (never down). Calling the Therapist when he can't be reached rings out to his voicemail, which says whether your bars or your Wi-Fi is too low. 

**Meters you can see move (2026-10-04).** When a status-bar meter rises, its new cells charge in one by one with a gold flash and pixel sparks float off the icon; when it drops, the icon glitches (shake, red/blue split) and the lost cells flicker red and go dark. The small words under the bar stay, but you don't need them.

### The opponent's weather

Each opponent bends their side of the screen a little, in their own way: a seasoning, never in the way (`ui/opponentFx.js`, `.dx-opfx--*` in scenes.css).

| Opponent | Look |
| :-- | :-- |
| Deborah | Wet ink: rain streaks behind, the portrait fades toward an old photo, her words bleed faintly downward |
| Rwanda | Paint-over: translucent brush strokes wipe across and paint drips from the top, punchy poster color, words misregistered like a print |
| Samun | Last call: neon bokeh, the portrait and scope sway like a drunk room, double vision on his words |
| Rick | Engine heat: shimmer rising, the portrait idles like a bike, a red heat glow, a thin tear across on hard beats |
| Therapist | Bad connection: blocky compression squares, the picture stutters now and then |

Only the portrait, their words (a faint ghost via text-shadow, never moved), the scope band and a layer behind everything get it. The status bar, lake gauge, card, wheel and dock are never touched. **Strength** (`fxLevel` in dialogScene): the phase (answers given) sets the ceiling, closeness calms it, trust clears it, finding their real feeling settles it for a beat, and it pulses with the music's loudness. Lighter in the tutorial; off outside the prompt/say/reaction stages; halved with reduced motion.

### The music of an encounter

**Coming (decided 2026-10-09):** battle music moves to stems exported from FL (one folder per NPC: intro, a loop per phase at its own tempo or layer stems, a secret layer), played as recorded; the chip/synth sounds stay for UI. What follows describes the current synth player, still used for Rwanda until her stems exist.

Each NPC with a composed arrangement (Rwanda so far) has a song that follows the fight, not your score. The confrontation opens on the intro (drums), the battle on the next layer, and every answer moves it one step up: more parts, faster (100 → 110 → 125 → 140 BPM). If you get close to a full connection, a **secret track** fades in (a part the composer hides in FL as "Secret…"), the sign you're almost there. When someone trusts you and tells you their story, every sound stops; IT and SO weigh it in the silence (IT on how true it rings, SO doubting a corner, never the person); then the sound fades back.

### Pushed away

If an encounter ends without their trust, their bust comes up close, cold, and they show you out, saying what they wish someone had done just now. One word is colored in the feeling that would have reached them: a hint, written for your class.

### Debug menu (for testing)

Settings → DEBUG. Choose a class (GUNS / BIBLE / CRYSTALS), a lake level (0–10 Truth Debt), ALL FEELINGS (every slice unlocked), and EVERYONE TRUSTS YOU (all four NPCs already trust you, so contacts are in the dock), then tap any scene to restart the chapter there with that state. The questionnaire still re-picks the class if you jump to it.

### What each feeling feels like (never named)

Testers wanted to know what the colors meant without the game naming them. Three clues, each a different sense (`ui/feelingIcons.js`):

| Color | Icon on the slice | Body line | The screen |
| :-- | :-- | :-- | :-- |
| Red | flame | jaw tight, hands hot | a heat shimmer |
| Indigo | wide eye | stomach drops, cold neck | the edges close in |
| Blue | raindrop | heavy arms, slow breath | colors drain |
| Yellow | sun | chest light, face warm | a warm glow |
| Orange | tangled knot | can't sit still, tight chest | a small jitter |
| Green | squeezed eyes, wavy mouth | throat closes, lip curls | a sickly wobble |
| Pink | spark burst | breath catches, eyes wide | a quick zoom-flash |
| Teal | open hand | shoulders drop, hands open | everything steadies |

The body lines above are the neutral versions. Each class notices the body its own way, so the line you see depends on your class:

| Feeling | Guns (bracing) | Bible (body and conscience) | Crystals (energy) |
| :-- | :-- | :-- | :-- |
| Red | knuckles white, pulse in your teeth | face hot, a verse on your tongue | heat climbing up the spine |
| Indigo | back to the wall, ears ringing | knees weak, hands clasped | a cold prickle down the arms |
| Blue | arms like sandbags | chest hollow, eyes stinging | a weight pooling in the chest |
| Yellow | shoulders loose, a grin you can't help | lifted, light in the chest | fizz in the fingertips, face warm |
| Orange | finger tapping, scanning for exits | rehearsing it, over and over | buzzing under the skin |
| Green | jaw set, spit the taste out | stomach turns, a step back | skin crawls, you need air |
| Pink | flinch, then freeze | breath held, heart skips | a jolt, everything too bright |
| Teal | back turned, and that's fine | hands open, head bowed | a soft hum, shoulders melting |

The body line shows (just under the wheel) on every hold (a long hover with a mouse) and on the first 3 picks of each feeling, then picks show only the icon and the screen's reaction.

**Tap burst:** every pick also fires a one-shot burst of chunky pixels from the slice, in the feeling's color and its own motion: sparks rising and flickering (red), a ring closing like a blink (indigo), drops falling (blue), rays out (yellow), a jittering swarm (orange), a wobbling drip (green), a fast wide burst (pink), a slow soft ring (teal). The names appear only in the ending's FEELZ report. (Body lines draw on research mapping where people feel emotions: Nummenmaa et al., 2014.)

### The ending (rebuilt 2026-10-02)

One thing per screen, then the record:
1. **Final reading**: the lake gauge, full size.
2. **The story**: each line of the ending is its own slide over an image
   frame (placeholders, labeled ending · number, until art lands; add art
   as an `images` list in endings.json).
3. **Epilogue**: the stat that broke, its own slide.
4. **A closing quote** per ending (public domain): CLEAN CUT, John 8:32;
   FUNCTIONAL MASK, Heraclitus; COLLAPSE, Ecclesiastes 1:7; LIVING LIE,
   Jonathan Swift (1710).
5. **The ending's name** as a title card.
6. **The record**: everything consolidated (file number, the class finally
   named as a profile, the lake, self-report vs. record, feelings collected
   and led with, disclosure per person, who trusted you, the case note, the
   outcome), printed out of a pixel-art fax: a handshake screech, then line
   by line, a print head riding each line, the status light blinking, a
   dot-matrix chirp per line, a RECEIVED stamp. Tap to pull the paper: the
   motor jams and grinds, the rest rips out fast and comes out smeared, and
   a faint drag scratch stays on the paper. Reading it: no scrollbar. Drag
   the paper down to pull more out, or tap the pixel arrow to ease it down
   to the next section (at the end it flips and takes you back up).
7. **SAVE AS PNG**: a letter-size "certified copy": FEELZ letterhead (the
   wheel with your collected slices, the rainbow wordmark), the record,
   signature lines for C. Browning, LCSW and B. Baiter, City Council, a red
   City of Lake Ulysses APPROVED seal, and lore small print about Halberd &
   Lowe Affective Systems and Municipal Wellness Agreement LU-77 ("The lake
   remembers."). Then IT and SO get the last word.

### The closing line after each reaction

After a character reacts, one short line says how your answer left you, keyed by the feeling you picked and whether you told the truth (`engine/reactions.js`). Each character has their own set in their own imagery (Deborah's kitchen, Rick's bar). Each class also has its own set, the same delivery told through the class lens (Guns: force and bracing; Bible: conscience and confession; Crystals: energy moving through). The game alternates the two, so the same pick never closes the same way twice in a row. Example, Anger and truth with Rick as Bible: "It came out like a verdict. You let it stand." then next time Rick's own "Harder than you meant it, and for a second his jaw matched yours."

### The word FEELZ

Wherever FEELZ appears on screen it wears the logo colors, one feeling per letter: F Anger, E Happy, E Trust, L Sadness, Z Anxiety. Typed text gets it from the typewriter; fixed labels (status bar carrier, app bars, report headers) from a page-wide watcher (`shell/feelzWord.js`). A line that colors the word itself keeps its own color.

### Contact colors

Each contact wears the color of the feeling they live in: Deborah Sadness blue, Rwanda Anxiety orange, Samun Happy yellow, Rick Anger red, the Therapist clinical grey. Their dock button and call box are that color, and the feeling they read on the person in front of you is written in that feeling's color (matching the wheel slice that glows). When they misread someone, they see their own feeling: Deborah sees grief everywhere, Rick sees anger. The Therapist has no lean, so his rare misreads are random. A bond with them still makes their reads more reliable.

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
- **Masks (Samun and Rick).** On their first two questions they show a
  feeling that isn't the real one: Samun's grin (Happy, or Anger when
  pushed), Rick's Anger. The screen and oscilloscope wear the mask; only the
  real feeling syncs. Tells: the colored word in their line is the real
  feeling; every few seconds the oscilloscope blinks the real color; picking
  the mask grinds. A contact on a call reads the real mood (more reliably
  the closer you are). The masks drop on questions 3 and 4. The therapist
  plants it in his outro: "People wear their weather on the outside. Listen
  for the word that doesn't match the face."
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
closes slowly to a vignette on them while two tones pull together under
the ducked music (yours wears your class: Guns a ratchet and a chamber
click, Bible an organ with a fifth resolving, Crystals two bowls beating
into one ring), then a gold flash on the lock, their face arrives and
breathes, and a short story beat of them letting you in (different per
NPC and per class). A breath
with only their face, then the
reward: **their story**, a five-beat cutscene in their own words, bust up, a dip
of silence between beats, bracketed stage directions on their own first, a
held look at the end before IT and SO,
of the wound that led them here (Deborah: the two calls she let ring the
night Caleb drove into the lake; Rwanda: the portrait of her mother she
softened to win; Samun: cleaning up his father at nine so his brother
wouldn't see; Rick: Gabriel holding him under at sixteen). Rick's ends with
a warning about Gabriel's water, and if you heard it, Rick is on the bank
at the Reckoning's gate as IT and SO walk you down: "I told you. Don't let
him." If the
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

Part 2 of the FEELZ check-in. Three swipe questions in the app's own form (app bar, progress, "PART 2 · Q1 OF 3"); the first question demos the swipe, and tapping an answer works too. Then: FILE CREATED, a redacted file code, "Results sealed until session end" (the class is only named in the ending's FEELZ report), and the provider card, Charles Browning, LCSW. Then FEELZ stamps EVALUATION COMPLETE and shows your starting wheel: all slices dark, your three lighting up one at a time with their tones, then a sound that hints at your class without naming it (Guns: a retro game gunshot, stepped noise that cracks bright and drops to a thud, with a far echo; Crystals: a Tibetan singing bowl, beating as it rings; Bible: a soprano choir swelling in on a clear "ah" in a big stone room), and "3 feelings available. The rest you'll have to find." The call opens with him reading your intake aloud: the colored-word read on your answers, as his first line.

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
