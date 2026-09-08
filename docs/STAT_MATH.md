# Stat & Character Data Math

This doc is strictly the math/data layer on top of the stats — what each
number means narratively is in `CONTENT_SCHEMA.md`'s "What the stats
mean" section; this doc covers what *computes* on top of that. Written
ahead of building any of it, so the reasoning survives even if a session
doesn't get to all of it.

## Where this started

Direct question that kicked this off: should FEELZ emotion choice (and
color-relationship math like the complementary hues already used for the
procedural pattern reveal) determine game *outcomes*, or should it stay
simple? Decision: **keep outcome math simple, keep color math where it
already lives (presentation only — the pattern reveal, the audio stem
crossfade).** Reasoning, for when this gets re-litigated:

- Formula-derived effects (e.g. hue-distance driving stat deltas) are
  illegible to the player — no way to reason about what picking Fear vs.
  Anger *does* to a number via hidden geometry.
- It would encourage min-maxing FEELZ picks toward "the right emotion,"
  which directly conflicts with [[feedback-nonjudgmental-feedback]] — the
  established rule that player-facing feedback must never read as
  right/wrong, success/fail.
- It would remove writer control. The manuscript pipeline exists so a
  non-technical collaborator can author outcomes directly; computed
  effects would undermine that.

So: authored effects stay authored (a writer types the numbers, same as
today). The math below only adds a small, fixed, universally-applied
layer on top — nothing a writer has to think about, nothing that changes
per node.

## Emotional Lean (built — `cardEngine.js`)

Each FEELZ emotion amplifies exactly one specific stat's swing by ×1.5
(rounded), in whichever direction that swing was already going:

| Emotion | Amplifies | Why |
| :-- | :-- | :-- |
| Anger | `stability` | anger makes the moment more volatile either way |
| Fear | `integrity` | fear sharpens the stakes of being honest with yourself |
| Anticipation | `trust` | leaning toward hope makes the relationship swing harder either way |

**`lucidity` is deliberately never amplified.** It's the one meter that
always moves by exactly how honest the actual choice was, regardless of
which emotion the player walked in with — a clean, untouched signal in a
system where everything else gets a thumb on the scale.

Mechanically: `resolveCard(state, node, swipeKey, emotion)` takes the
active emotion as an optional 4th argument (threaded from
`dialogScene.js`, which already tracked it locally). `applyEmotionalLean()`
in `cardEngine.js` multiplies the matching effect key by 1.5 using
symmetric rounding (round-half-away-from-zero — plain `Math.round` is
asymmetric around negative `.5` values, which would make negative swings
amplify weaker than positive ones for no good reason). Omitting the
emotion argument, or passing one that doesn't touch this edge's effects,
behaves exactly as before Emotional Lean existed — nothing about old
callers breaks. Truth Debt is untouched — this only ever touches the
four display meters, computed from the *original* authored `effects`
(the returned `edge` is never mutated, so reaction text/UI logic downstream
sees the writer's numbers, not the amplified ones).

## Ending epilogue (built — `endingEngine.js` + `endingScene.js`) — the consumer

The smallest possible way to make the four meters count for something,
without adding branching or new schema:

`getEpilogueStat(state)` in `endingEngine.js` runs after Truth Debt has
already picked the ending tier (Clean Cut / Functional Mask / Collapse /
Living Lie — unchanged) and finds whichever of the four meters deviated
furthest from its starting value of 5 (`Math.abs(final - 5)`, largest
wins; ties go to whichever stat is checked first —
`integrity > trust > stability > lucidity` — confirmed in practice: an
all-Anger, all-lie playthrough clamped both integrity and stability to
their extremes simultaneously, and integrity won the tie as designed).
`endingScene.js` shows one derived line from `endings.json`'s new
`"epilogues"` key underneath the existing ending text — a small,
italicized aside naming whichever stat moved most.

Resolved (was open): went with 4 lines regardless of direction (not 8
split by up/down) — simpler, and revisit only if it feels thin in play.

Verified: the amplification math and epilogue tie-breaking
deterministically in Node (emotion-vs-no-emotion, all three emotions,
symmetric negative-value rounding, lucidity never amplified, tie-break
order), then a full browser playthrough confirming the epilogue line
actually renders and matches what the Node test predicted for that exact
stat combination.

## Per-NPC leitmotif (built — `shell/audio.js`)

Not stat math, noted here since it came out of the same conversation.
Each NPC has a short hardcoded melodic phrase (`LEITMOTIFS`, an array of
`{ note, durationMs }` per character) played on loop via
`startLeitmotif(npcKey)` / `stopLeitmotif()`. `noteToFrequency()` converts
note names ("A3", "C#4", "Bb2") to frequency with standard equal
temperament math (A4 = 440Hz, ×2^(semitones/12)) — no MIDI files, no
dependencies. Each note is its own oscillator (Web Audio oscillators are
one-shot, can't be reused) connected to one persistent gain node, chained
via `setTimeout` the same way `ui/typewriterText.js` sequences characters.

The three FEELZ emotion stems stay exactly as they were (shared,
hardcoded, universal) — the leitmotif is an added layer, not a
replacement. Lifecycle is coarser than the emotion stems: started once
when an NPC's dialog scene mounts (`dialogScene.js`, alongside
`startEmotionStems()`), not restarted per node — it's meant to be that
character's continuous underscore for the whole encounter. Stopped only
on scene unmount, including through the swipe-commit moment where the
emotion stems *do* stop (`stopEmotionStems()` in `handleSwipe`) — the
leitmotif deliberately keeps playing through reactions, since it's the
character's signature, not tied to the FEELZ selection phase.

Current phrases, chosen to match each NPC's established tone: Deborah —
slow descending sine, hymn-like (A3-G3-E3-D3, 700-1100ms notes). Rwanda —
quicker triangle-wave riff, more rhythmically alive
(E4-G4-A4-E4-B3). Samun — tight repeating square-wave loop, addiction/cycle
feel (C3-C3-Eb3-C3). Rick — two low sawtooth notes, blunt and simple
(E2-A2) — sawtooth matching the existing Anger emotion stem's timbre,
thematically consistent with his violence.

Verified: `noteToFrequency()` deterministically in Node (octave doubling,
sharp/flat enharmonic equivalence, standard reference pitches, bad-input
error handling), then a full four-NPC browser playthrough confirming zero
console errors across every leitmotif's oscillator scheduling.

**MIDI import pipeline (built — `scripts/build-leitmotifs.mjs`).** The
phrases above are currently hand-typed note arrays; a composer can now
author a real melody (e.g. in FL Studio) and export it as a `.mid` file
instead. Same shape as the manuscript pipeline:

```
src/chapters/<chapter-id>/midi/<npc-name>.mid       <- drop this in
src/chapters/<chapter-id>/content/leitmotifs.json   <- generated, don't hand-edit
```

`npm run build:leitmotifs` (all chapters, or pass a chapter id) parses
every `.mid` in `midi/` via `@tonejs/midi` and writes the aggregate JSON.
`audio.js`'s `LEITMOTIFS` prefers an NPC's entry from that JSON and falls
back to the hand-typed phrase above if one doesn't exist yet — nothing
breaks for an NPC that hasn't had a MIDI dropped in.

What doesn't come along for free from a MIDI file: `type` (the oscillator
waveform) stays a hand-picked choice in `audio.js`, since MIDI
instruments don't map to sine/square/saw/triangle. Playback is also
strictly monophonic, so a chord in the source gets resolved automatically
— the script keeps the top note of any chord and drops the rest, logging
what it dropped. `durationMs` per note is computed as the gap to the
*next* note's onset (what `playNote()`'s `setTimeout` chain actually
schedules on), not the note's own MIDI sustain length — a staccato note
followed by a long rest keeps that rest's length rather than firing the
next note early. The last note in a phrase wraps to the track's total
duration, closing the loop back to note 0.

Verified: round-tripped synthetic MIDI files through the script
(mirroring Deborah's existing phrase, a chord, and a note followed by a
rest) and confirmed the JSON output matches the expected notes/gaps/drop
behavior exactly; confirmed live in the browser that `startLeitmotif`
picks up a MIDI-sourced entry over the hardcoded fallback the instant one
exists in `leitmotifs.json`, and reverts to the fallback (unchanged from
before this pipeline existed) when it doesn't.

**Regression note (2026-08-04).** This section described the wiring
accurately, but the wiring itself had gone missing — `startLeitmotif` was
exported and never called from anywhere, so the whole system was silently
dead while the docs still claimed it was live. Found by auditing exports
for callers. Re-wired in `dialogScene.js` (start before `enterNode()`, stop
in `unmount`) and confirmed by deep-linking straight to the Therapist,
which skips the questionnaire, and watching `heavens_waiting_room.mp3` get
fetched — a request only `startLeitmotif('THERAPIST')` can produce on that
route. Worth knowing that "documented as built" and "still reachable" are
different claims.

## Leitmotif mood-bending (built — `shell/audio.js` + `dialogScene.js`)

Grew out of a sound-design conversation about making the FEELZ wheel and
the per-NPC leitmotif feel connected rather than parallel. Landed on: the
leitmotif already plays continuously through a whole encounter (see
above) — instead of adding a separate reaction sound on top of it, bend
the leitmotif itself, live, based on how each resolved choice actually
landed with that NPC.

**What drives it:** `trust` and `stability` specifically — not
`integrity`/`lucidity`, and not Truth Debt. Those two are explicitly
about the NPC's felt experience of the player ("the NPC's rapport with
you", "emotional turbulence of the scene" — see "What the stats mean"
above), not a right/wrong signal. A comforting lie that raises both reads
as *consonant* here even though it's a lie; an uncomfortable truth that
drops both reads as dissonant even though it's honest. Deliberately not a
truth detector.

**The math — circle of fifths, not chromatic steps.** Each NPC's
leitmotif carries one running number, `mood`, starting at 0 when their
scene mounts. `dialogScene.js`'s `handleSwipe` computes the *actual*
post-clamp trust + stability delta (not the raw authored effect — a stat
already maxed shouldn't overstate the swing) and feeds it into
`audio.nudgeLeitmotifMood(delta)`, which clamps `mood` to ±6.
`fifthsSemitoneOffset(mood)` in `audio.js` then converts that into a
semitone bend by walking `mood` hops around the circle of fifths and
folding the result within one octave — hop count is the "how related"
axis (0 hops = the tonic itself, 6 hops = the tritone, the least related
point on the circle either direction you walk), not the raw semitone
distance, which is intentionally uneven (1 hop bends further in pitch
than 2 hops does — that's real harmony: chromatic closeness and harmonic
relatedness are different axes). `playNote()` reads `mood` fresh every
time it's about to play the loop's next note, so a choice's effect shows
up on the very next beat of that NPC's theme, not a separate layered
sound.

**Why trust+stability specifically feed the wheel too, for free:** FEELZ
emotions each amplify one stat ×1.5 (`emotionAmplifies()`). Anger/Joy
amplify stability; Anticipation/Trust/Surprise amplify trust — 5 of the 8
feelings on the wheel already swing the same two stats this system reads,
so picking a "loud" emotion for a given choice makes that choice bend the
leitmotif further, with no new wiring between the wheel and the audio.
Fear/Disgust/Sadness amplify integrity instead, which stays out of this
system on purpose — those are introspective stats, not relational ones.

File-based leitmotifs (Therapist's `heavens_waiting_room.mp3`) have no
notes to bend — `nudgeLeitmotifMood()` no-ops quietly rather than
throwing, same for no leitmotif active at all.

Verified: `fifthsSemitoneOffset()` checked by hand for every hop -6..+6
(confirms the tritone lands at exactly ±6 semitones and is its own
mirror), then live in the browser via a monkey-patched
`AudioContext.prototype.createOscillator` — confirmed Deborah's loop
plays A3/G3/E3 unbent, then after nudging mood by -3 (her opening TRUTH's
actual trust-1/stability-2), the next three notes in the *same* loop
(D3/A3/G3) came out bent up exactly 3 semitones, matching the formula
precisely. Confirmed `nudgeLeitmotifMood()` is a silent no-op against
`THERAPIST`'s file-based leitmotif and against no active leitmotif at
all.

## Dialog portrait mood-mask (built — `ui/npcPortrait.js` + `audio.js`)

Visual sibling to the leitmotif mood-bend above — same underlying number,
a second output. `audio.js` exports `getLeitmotifMood()`, a read-only
accessor onto the exact mood value the leitmotif already tracks (0 if
nothing's active). No second mood calculation anywhere; audio's pitch
bend and the portrait's color both read the one number, so they can't
drift apart from each other.

**The technique — CSS `mask-image`, not a second image per state.** The
portrait's own art becomes a luminance mask over a solid color layer
(`.dx-portrait__mood`, `ui/ui.css`): light areas of the art let the color
through, dark areas don't. `moodToColor()` in `npcPortrait.js` maps mood
(-6..+6) to an RGB interpolation — neutral white at 0, toward red at the
tense end, toward teal-green at the resonant end — and
`createNpcPortrait()` returns an `updateMood(mood)` method that just sets
one CSS custom property (`--mood-color`). Prototyped first against real
production art (a Bob Baiter frame, in an interactive artifact) before
being wired into the actual portrait component, to confirm the mechanic
before committing to it.

`dialogScene.js`'s `render()` — which already rebuilds the portrait from
scratch on every call — calls `portrait.updateMood(audio.getLeitmotifMood())`
right after creating it, so every render (the opening prompt, the SAY
beat, the REACT beat) stays in sync with zero extra bookkeeping; no need
to hold a portrait reference across renders. `handleSwipe()` already
calls `render()` right after nudging the mood, so the color updates land
on the very next beat after a choice resolves — same timing as the
leitmotif's pitch bend.

No-ops safely with no portrait image: `maskLayer` is only created when
`portraitUrl` is set, so `updateMood()` is a harmless no-op against
today's colored-letter placeholder (all four NPCs, until real portrait
art exists — see `HANDOFF.md`'s asset inventory).

Verified: `getLeitmotifMood()` returns 0 with nothing active, 0 the
instant a leitmotif (re)starts, and the exact nudged value afterward;
`moodToColor(-4)` computed `rgb(251,120,119)`, matching the interpolation
formula by hand; confirmed live against a real image (crosshatch shading
in a Bob Baiter frame) that the light areas tint and the black linework
stays black, with the crosshatch's own density naturally graduating how
much color shows through; confirmed `updateMood()` doesn't throw against
a portrait with no image.

## Confrontation oscilloscope (built — `ui/oscilloscope.js` + `audio.js`)

Confrontation cutscenes have no background art of their own (`beats` only
ever set `sprite`, never `bgAnim`/`image`) — a lot of empty real estate
behind the bust. The goal, stated directly: a live reactive indicator of
both sides of the encounter — NPC and player alike, EarthBound/Mother
battle-background territory, but functional rather than purely
atmospheric. Two overlaid traces, not one:

- **NPC trace** — `audio.js`'s `ensureContext()` taps an `AnalyserNode`
  off `masterGain` in parallel (`masterGain.connect(analyser)`, alongside
  its existing connection to `ctx.destination` — a read-only tap, not part
  of the output chain), and `getAnalyser()` exposes it. Real audio: this
  NPC's leitmotif (already reactive to trust+stability via its fifths
  bend), stings, whatever's actually playing.
- **Player trace** — not audio. Synthesized from `integrity` + `lucidity`
  (the two meters about the player's own honesty, not the NPC's feelings —
  deliberately the *other* two, so this doesn't just repeat what the NPC
  trace already shows via mood). Combined into a 0–1 "clarity" score
  (`(integrity + lucidity) / 20`) that drives how clean the drawn wave is:
  full clarity draws a smooth sine, low clarity adds visible per-sample
  noise and irregular amplitude — a real oscilloscope idiom (a noisy
  signal reads as "something's wrong") doing actual narrative work rather
  than inventing a new visual language. Deliberately not Truth Debt —
  that already has its own readout (the DEBT counter), and folding it in
  here would blur two clean axes into three fighting for the same line.

Both traces share the same canvas and midline rather than splitting the
screen — a real dual-trace scope overlays channels. The player trace gets
a narrower amplitude band (`PLAYER_AMPLITUDE_RATIO`, 18% of height) so it
reads as a second, distinct signal instead of competing with the NPC
trace for the same space. `cutsceneScene.js` passes
`getPlayerStats: () => run.get()` into `createOscilloscope()`, read live
every frame the same way the NPC trace reads the analyser live.

`cutsceneScene.js`'s background branch gets a third case: `bgAnim` /
`image` / else-if `scene.opensDialog` (confrontations are the only
cutscenes with no art AND a meaningful thing to visualize — regular
narrative beats don't set `opensDialog` and keep whatever background they
already have).

**Extended into the actual battle, not just its intro.** The
confrontation cutscene is a brief beat before the real fight — the
follow-up ask was direct: without persisting into `dialogScene.js`'s
node graph (the swipes themselves), it's not watchable as an indicator.
`dialogScene.js`'s `render()` now creates its own `createOscilloscope()`
instance (recreated each `render()` call, same as the portrait below it —
the whole screen is rebuilt from scratch on every stage change, so
there's no continuity to hold onto across renders; the underlying
signals are read live regardless of when the canvas was created). This
*replaces* the old `drawEmotionPattern()` call that used to fire on the
SAY/REACT beats — that call had been silently drawing onto a canvas
fully hidden behind `.dx-game-content`'s opaque background ever since the
readability fix below, so nothing actually still using it was removed.

Making the background genuinely visible during dialog (not just a 16px
margin) meant revisiting that same readability fix, without reopening the
bug it closed:

- `.dx-game-content--live-bg` — a modifier, `dialogScene.js`-only, that
  overrides the base `.dx-game-content` rule's opaque background back to
  transparent. `questionnaireScene.js`'s diagnosis reveal (the case that
  motivated the original fix) never applies this class, so it's
  unaffected — confirmed live, its `.dx-game-content` is still solid
  black.
- Solid backing moved onto the individual text surfaces instead of one
  blanket wrapper: `.dx-prompt` (new class on the opening line — the
  same text carrying the IT color-tag words), `.dx-reaction`,
  `.dx-say-box`, `.dx-swipe-card`, `.dx-debt-sigil`. Each was already
  either borderless or relying on the parent's opacity; each now sets its
  own `background: var(--color-black)`, a no-op everywhere else since
  there was already solid black behind them regardless.

Confirmed live: `.dx-prompt` and `.dx-swipe-card` both read solid black
(`rgb(0,0,0)`) via `getComputedStyle` while `.dx-game-content` itself
reads fully transparent (`rgba(0,0,0,0)`) — text protected, wrapper
genuinely see-through. Screenshot confirms the scope fills the real
empty space (behind the FEELZ dartboard especially) while every line of
text, including the color-tagged hint word, stays fully legible.

**The silence gap — resolved.** An NPC's leitmotif used to only start once
`dialogScene.js` mounted, *after* their confrontation beat, so the scope
had nothing to trace during the confrontation itself. Fixed by starting
it a step earlier: `cutsceneScene.js` calls `startLeitmotif()` at mount
whenever `scene.opensDialog` is set, right before its first `render()`.

Two things had to be right for that to feel calm rather than jarring:

- **Fade-in, not a pop.** A leitmotif now often starts the instant a
  confrontation appears — more sudden than dialogScene's own quieter
  entrance. Both branches of `startLeitmotif()` now ramp gain from 0 up to
  target over `LEITMOTIF_FADE_IN_SEC` (1.4s,
  `gain.gain.linearRampToValueAtTime()`) instead of snapping straight to
  volume.
- **No restart on the handoff.** A confrontation always leads straight
  into that same NPC's dialog scene, which calls `startLeitmotif()` again
  moments later with the same key. Without a guard that would stop and
  restart the oscillator mid-note (audible glitch) and reset mood back to
  0. `startLeitmotif()` now tracks `activeLeitmotifKey` and no-ops
  immediately if the requested NPC is already the one playing — the
  confrontation's fade-in just keeps running uninterrupted into the
  dialog scene. A *different* NPC still restarts normally (mood has
  nothing to do with which NPC is even playing, so there's no continuity
  to preserve there).

Verified: isolated test against a real canvas confirmed non-black pixels
tracing an actual waveform while a leitmotif played (2196 px for
Deborah's sine tone; visually confirmed Rick's sawtooth leitmotif
produces a genuine sawtooth trace — sharp edge, linear ramp, not an
approximation). Verified the fade-in and no-restart guard by sampling the
analyser's peak amplitude directly: 0 at start, 5 mid-ramp, called
`startLeitmotif('DEBORAH')` again mid-ramp and amplitude stayed at 5 (no
reset), continued rising to 9 on the original ramp afterward; starting a
*different* NPC (`'RICK'`) immediately dropped amplitude back near 0,
confirming the no-op is correctly scoped to the same NPC only. Confirmed
live in the actual confrontation → dialog transition that amplitude
carries through non-zero rather than restarting silent.

**Regression, found live: invisible on the deployed site.** The isolated
test above passed because it always attached the canvas to `document.body`
*before* calling `createOscilloscope()`. The real caller,
`cutsceneScene.js`, doesn't — it builds a beat's whole `screen` div
off-DOM and appends it to `stageEl` in one shot afterward, so the canvas
is still detached at the moment `createOscilloscope()` ran its original
one-time `resize()`. `clientWidth`/`clientHeight` on a detached element
are always 0, so `canvas.width`/`height` got set to 0 and stuck there —
nothing ever called `resize()` again except an actual browser window
resize event, which a normal play session never fires. The canvas was
there, correctly positioned and z-indexed, just permanently empty.

Fixed by checking size every frame instead of once at setup
(`syncSize()`, first thing inside `draw()`) — self-correcting the moment
the canvas is actually in a laid-out document, whichever frame that turns
out to be, with no dependency on a resize event. Only writes
`canvas.width`/`height` (which resets the bitmap) when the size actually
changed, so it's not doing real work on the frames where nothing moved.

Verified the fix's logic directly: read `canvas.width` on a live
confrontation's oscilloscope and found it stuck at 300×150 (the browser's
un-sized-canvas default) despite `clientWidth`/`clientHeight` correctly
reporting the real 358×779 layout size — reproducing the bug exactly.
Manually ran the same steps `syncSize()` + one `draw()` frame do and
confirmed `canvas.width`/`height` corrected to 358×779 and the waveform
drew (2462 non-black px). Couldn't get a live `requestAnimationFrame` to
actually tick in this session's sandboxed browser tab to watch it
self-heal automatically — that tab never reports `document.hasFocus()`
as true no matter what's fronted, which is a property of this specific
automation environment, not of a real player's browser (rAF ticks
continuously and reliably in any tab that's actually being played in).

**Player trace verified** with the same manual-frame technique (this
environment's rAF unreliability above applies here too): computed
`clarity` and drew the player wave at `{integrity: 10, lucidity: 10}` vs.
`{integrity: 0, lucidity: 0}` and measured second-derivative jaggedness
of the resulting points — 263 at full clarity vs. 10,126 at zero, a ~38×
difference, confirming the noise term actually scales with clarity rather
than being a fixed wobble. Visually confirmed both traces overlaid
correctly against a real leitmotif (Deborah's clean sine trace alongside
a visibly jagged low-clarity player trace; separately, alongside a
completely smooth player trace at full clarity) — legible as two distinct
signals sharing one canvas, not one drowning out the other.

## Swipe-without-a-feeling rejection (fix — `dialogScene.js` + `fx.js` + `audio.js` + `swipeCard.js`)

`handleSwipe()` already refused to resolve a card without an `activeEmotion`
set (`if (!activeEmotion) return`) — the swipe never *counted*. But
`swipeCard.js`'s drag gesture didn't know that: a completed left/right
drag always called `onSwipe`, and only the "let go without committing to
either side" case reset the card's position. So a player could drag a
card fully to TRUTH or LIE with no feeling picked, watch it stay flung to
that side, and nothing would happen — reading as broken, not as blocked.

Fixed on both ends:
- `swipeCard.js` now exposes `reset()` (the same snap-back the
  "no direction" case already did internally), so a caller can trigger it
  from outside after the fact.
- `dialogScene.js`'s `onSwipe` calls `card.reset()` plus a rejection jolt
  when `activeEmotion` is unset, instead of a bare `return`.

The jolt needed to read as clearly *smaller* than real choice feedback,
not a quieter version of it — so `fx.js` gained a `'subtle'` shake tier
(2px, vs. `'weak'`'s existing 4px) and `audio.js`'s `playHit()` gained a
matching `'subtle'` tier (quieter, shorter, a touch brighter in pitch —
reads as "didn't register" rather than a small impact). Both were flat
`intensity === 'strong' ? … : …` ternaries before, which would have
silently folded a new `'subtle'` value into the `'weak'` branch;
`audio.js`'s went through a `HIT_CONFIG` lookup table instead so a third
tier is an explicit entry, not a ternary rewrite.

Verified: simulated a completed drag with no emotion selected — card's
`transform` cleared and position snapped back to within 1px of its
pre-drag position, `DEBT` and the prompt text both unchanged (the swipe
genuinely didn't count, not just visually recovered). The `handleSwipe(key)`
call for the real, emotion-selected path is byte-for-byte unchanged by
this fix — no regression surface there.

## Meter-gated branching (built — `cardEngine.js` + `dialogScene.js`)

The second thing reading the four meters back (after the epilogue), and
the first to actually change *what content shows*, not just what gets
narrated at the end.

Considered three design axes before building anything: what gets gated
(whole node vs. one choice vs. reaction flavor vs. effect magnitude),
where the check happens (node-entry vs. edge-resolution), and who
decides it (a universal engine rule, like Emotional Lean, vs. per-node
authored conditions). Went with **authored, opt-in, per-node, checked at
node-entry** — the opposite axis from Emotional Lean's "universal, no
authoring" choice, and deliberately so: gating only means something
attached to a specific narrative moment a writer chose, not a rule
applied blindly everywhere. Kept as small as Emotional Lean was anyway —
one optional field, no new node "shape," fully backward compatible.

A node can carry an optional `gate`:

```json
"gate": { "stat": "trust", "op": "<", "value": 3, "elseNodeId": "rick_shut_down" }
```

`resolveGatedNode(nodeId, npc, state)` in `cardEngine.js` — pure function,
same shape as `getEpilogueStat()` — checks whether the node you're about
to show has a `gate`; if the condition against current `state` is true,
returns `elseNodeId` instead. Nodes without a `gate` pass through
unchanged. `dialogScene.js` calls it at both places `currentNodeId` ever
gets set: the NPC's opening node at mount, and `edge.nextNodeId` in
`advance()` — so a gate can fire either right as the player meets an NPC
or partway through their tree.

Authored via a manuscript `GATE:` line (`SCRIPT_FORMAT.md`) — writers
never touch the JSON `gate` object directly.

**First real use:** Rick's opening node (`rick_01`) is gated on
`trust < 3`, redirecting to `rick_shut_down` — a short new node where he
won't engage ("Word gets around. I know what you are.") rather than his
normal opening. Fits his established characterization (defensive,
loyalty-obsessed) rather than being an arbitrary demo of the mechanism.
Both of `rick_shut_down`'s truth/lie branches lead straight to `(end)` —
kept short on purpose, proving the mechanism fires correctly without
needing a fully fleshed-out alternate arc.

Verified: `resolveGatedNode()` deterministically in Node (below/at/above
threshold, missing-stat defaults to 0, ungated nodes always pass through
unchanged, unknown node ids don't throw), then two full browser
playthroughs with hand-computed stat paths — one driving trust down to 1
before Rick (confirmed `rick_shut_down`'s exact prompt rendered), one
keeping trust at a healthy 7 (confirmed `rick_01`'s normal prompt
rendered) — both matching the Node predictions exactly.

## Build order

1. ~~Emotional Lean + ending epilogue~~ — done.
2. ~~Per-NPC leitmotif~~ — done.
3. ~~Meter-gated branching~~ — done (first use: Rick + trust).
