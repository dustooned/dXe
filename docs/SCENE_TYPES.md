# Scene Types

A chapter is a list of scenes, run in order by `createSceneSequencer`
(`src/engine/sceneSequencer.js`). Each entry in the list looks like
`{ type, id, ...whatever that type needs }`. The sequencer only cares
about `type` (to pick a handler) and `id` (for jump targets) — everything
else in the scene object is passed straight through to the handler.

This doc is the contract for writing a scene handler, plus the current
registry of types. Read this before adding a cutscene or mini-game — the
goal is that both slot in without touching the sequencer or any other
scene type.

## The handler contract

A scene handler is a module exporting one function:

```js
export function mount(stageEl, scene, context) {
  // render into stageEl, wire up interaction
  return function unmount() { /* cleanup: clear timers, stageEl.innerHTML = '' */ };
}
```

`context` contains:

- `run` — the chapter's shared state store (`{ get(), set(patch), subscribe(fn) }`
  from `src/shell/state.js`). This is where persistent run data lives
  (meters, Truth Debt, ledger) — shared across every scene in the chapter.
  Scene-local UI state (which beat/node/frame you're on) should stay in
  the handler's own closure, not in `run`.
- `onComplete(result)` — call this when the scene is done. With no
  argument, the sequencer advances to the next scene in the list. Pass
  `{ jumpTo: 'someSceneId' }` to skip to a specific scene instead (used
  today by `dialogScene` to jump straight to `reckoning` when Truth Debt
  maxes out mid-NPC, regardless of how many dialog scenes are left).
  Anything else on `result` is yours — the sequencer ignores it, but the
  chapter or a later scene can read it if it matters.
- `exit` — hands control back to the shell (back to the chapter menu).
  Only the terminal scene should call this — everything mid-chapter
  should call `onComplete` instead.
- `recordEnding`, `chapterId` — passed through for terminal scenes that
  need to write to the save file (see `endingScene.js`).

## Implemented types

### `dialog` (`src/scenes/dialogScene.js`)

Runs one NPC's node graph to completion: FEELZ pick, swipe, reaction, next
node (or `onComplete` if the graph's exhausted). Content shape documented
in `CONTENT_SCHEMA.md`.

```json
{ "type": "dialog", "id": "deborah", "npc": /* NPC content JSON */ }
```

**Which node it opens on.** Normally the first node in the content file. If
an earlier confrontation cutscene wrote `run.openers[<this scene's id>]`
(see the `cutscene` section's `opensDialog`), that node is used instead. An
unknown id falls back to the first node rather than erroring, so deleting a
node from a manuscript can't strand the scene — but it *will* silently undo
the player's choice, so keep opener ids and confrontation options in sync.

Gates still apply on top: `resolveGatedNode` runs against whichever opener
was chosen, which is why every alternate opener for a gated NPC needs the
same `GATE:` line. Rick's three openers all carry `trust < 3 ->
rick_shut_down`; without that, picking a non-default opener would quietly
bypass his gate.

**The reaction is tap-gated, never timed.** After a swipe, the NPC's
reaction is typewriter-drawn and stays up until the player taps — first tap
finishes the draw, second advances. The "(tap to continue)" hint only
appears once the text is fully drawn. There is deliberately no auto-advance
timer here: this beat is the payoff for the choice and the one screen the
player most needs to actually read. It used to advance itself after 2.2s,
which cut off longer reactions mid-read.

**Reactions answer the FEELZ wheel.** The authored `npcReaction` is joined
with a coda from `engine/reactions.js`, a shared table keyed by
`[emotion][truth|lie]` — 8 emotions × 2 sides, one table for the whole
game. This is why an NPC needs no extra authoring to respond to all 8
emotions, and why adding an NPC doesn't mean writing 16 more variants.

Codas describe **delivery** — how the line left you — never whether the
choice was right. That's the same rule the fx intensity follows: weight,
not verdict. Keep it that way; a coda that grades the player turns an
atmospheric beat into a score screen.

### `questionnaire` (`src/scenes/questionnaireScene.js`)

Three swipe questions that assign the player's class loadout, followed by
the Therapist's diagnosis. Carries no content in the scene object — the
questions, scoring, and diagnosis text are all constants inside the
handler.

```json
{ "type": "questionnaire", "id": "questionnaire" }
```

Each answer scores a point toward Guns / Bible / Crystals; highest total
wins, ties break to the first answer ("first instinct"). The result is
written to `run.loadout`, which drives which dartboard segments are live
for the rest of the run (`engine/loadout.js`).

The player is never shown the class name. The diagnosis instead tints
individual words in that class's emotion colors — the intent is that it
reads as character voice, not as a stat screen. Keep it that way if you
extend this: naming the class turns an atmospheric beat into a menu.

### `reckoning` (`src/scenes/reckoningScene.js`)

Builds a confess/double-down deck from `run.get().ledger` and plays it.
Completes immediately if the ledger is empty.

```json
{ "type": "reckoning", "id": "reckoning" }
```

### `ending` (`src/scenes/endingScene.js`)

Terminal, two phases. Picks the ending by final Truth Debt and records
it immediately on mount (not deferred to the end of the beat). Calls
`exit` (not `onComplete`) when the player taps back to menu — the only
scene that does, since there's nothing after it.

```json
{ "type": "ending", "id": "ending", "endings": /* endings.json */ }
```

**Phase 1 — judgment beat.** A silent, full-bleed procedural pattern
(`ui/emotionPattern.js`, the same complement-hue renderer the dialog
scene's reaction reveal uses — extended to take any `key`, not just a
FEELZ emotion, so it now also has hue mappings for the four ending keys)
seeded by the ending key itself, so a given ending always shows the same
pattern across replays. Auto-advances to phase 2 after ~900ms, or a tap
anywhere skips ahead immediately. The dramatic flash/shake/sting
(`ENDING_INTENSITY`) fires at mount, i.e. right as this phase appears.

**Phase 2 — typewriter text.** Title renders instantly (a banner, not
part of the draw); the ending's body text plus the epilogue line (see
`STAT_MATH.md`) are joined into one block and typewriter-drawn together
(`ui/typewriterText.js`). A tap while drawing finishes it instantly. The
"BACK TO MENU" button only appears once the text is fully drawn — no
premature exit mid-reveal.

Resolved open questions from the original plan: real ending art still
doesn't exist, so the judgment beat uses the same procedural placeholder
pattern as everywhere else rather than blocking on real sprites. The
skip gesture is single-tap (not double-tap) for consistency with every
other tap-to-finish interaction in the game (cutscene beats, dialog
reactions).

### `cutscene` (`src/scenes/cutsceneScene.js`)

Pure narrative beats — worldbuilding, the moment before a chapter's first
NPC encounter, anything that isn't a swipe choice. Internally sequences
its own list of beats, the same way `dialogScene` sequences nodes. First
real use: `lake-ulysses`'s Prologue.

```json
{
  "type": "cutscene",
  "id": "prologue",
  "beats": [
    { "text": "Lake Ulysses. Three thousand acres, they call it. A jewel." },
    { "text": "{slow}The water looks fine today.{/slow}" },
    { "text": "It always does. Right before it isn't.", "autoAdvanceMs": 1800 }
  ]
}
```

Each beat's `text` draws character-by-character (`src/ui/typewriterText.js`
— Earthbound/Undertale/Deltarune-style reveal, reusable by any scene, not
cutscene-specific). Tapping while a line is still drawing finishes it
instantly instead of waiting; tapping once it's fully drawn advances to
the next beat, same as the dialog scene's tap-to-continue. A small arrow
bobs at the bottom of the text box once a beat is fully drawn, to signal
there's more. An `autoAdvanceMs` beat advances itself once drawn instead
of waiting for a tap (a tap still advances it early if the player doesn't
want to wait) — for pacing a moment rather than gating it. Calls
`onComplete()` once all beats are shown.

Inline speed markup, usable in any beat's `text` for dramatic pacing:

| Markup | Effect |
| :-- | :-- |
| `{slow}...{/slow}` | that stretch reveals slower than normal |
| `{fast}...{/fast}` | that stretch reveals faster than normal |
| `{pause:250}` | a dramatic beat — no character revealed, just a 250ms gap |

**Background beat (`image`).** A beat can carry an `image` (a path
string, e.g. `/assets/lake-ulysses/backgrounds/prologue-lake.svg`),
rendered full-bleed behind the text box (`object-fit: cover`). `text` is
optional when `image` is set — a beat can be a pure visual moment with no
line at all. First real use: the Prologue's opening beat, currently a
labeled placeholder SVG (no real art yet — same "reuse a cheap procedural
or hand-made placeholder rather than block on real assets" pattern used
everywhere else in the game).

**Character sprite (`sprite` / `spriteAnim`).** A beat can carry a
character layer above the background: `sprite` for a static path, or
`spriteAnim` for a key into the scene's `anims` map (animated via
`ui/spriteAnimator.js`, which cycles numbered WebP frames and preserves
frame position across beats using the same key, so a sprite doesn't
restart from 0 on every tap).

The sprite is bottom-anchored and sized as a **percentage of canvas
height** (`height: 72%`), centered horizontally. Do not position these in
raw pixels — the canvas scales to the viewport (see HANDOFF.md), and fixed
pixel offsets get clipped on shorter screens. A sprite wider than the
canvas at that height will bleed past the left and right edges, which for
a bust shot like Bob Baiter is intentional framing rather than a bug.

**Interactive beat (`interactive`).** A beat can carry
`{ interactive: { type: 'choice', options: [...] } }` instead of (or
alongside) `text` — if `text` is present it draws first, and the choice
only appears once that's fully drawn; with no `text` the choice shows
immediately. Each option is `{ label, nextBeat?, jumpTo? }`:

- `nextBeat` — a beat *index* within this same cutscene's `beats` array
  to jump to (lets a choice branch within one cutscene without needing a
  full node-graph like dialog nodes have).
- `jumpTo` — a different *scene* id to leave the cutscene entirely,
  exactly the same mechanism `dialogScene` uses for the debt-threshold
  jump to Reckoning (`onComplete({ jumpTo })`).
- Neither — just advances to the next beat in sequence, same as normal.

A tap never resolves a choice, only clicking a specific option does — a
stray tap while choice buttons are showing does nothing, so it can't
accidentally skip a deliberate decision. First real use: a small
"Get up. / Stay down a little longer." beat near the end of the
Prologue — both options currently lead to the same next beat (the
mechanism doesn't need divergent content to prove it resolves correctly;
narrative branching here is a content decision for later, not a
technical blocker).

Only `type: 'choice'` exists. A timed-tap or drag interactive type is a
natural extension of the same `interactive` field (a different `type`
value) whenever there's real content that needs one.

**Confrontations (`opensDialog` + an option's `opener`).** A scene-level
`opensDialog` names a later dialog scene; an option's `opener` names a node
in that NPC's graph. Choosing the option writes `run.openers[opensDialog]`,
and the dialog scene opens on that node instead of its first one.

```json
{
  "type": "cutscene", "id": "deborah-confront", "opensDialog": "deborah",
  "beats": [
    { "sprite": "/assets/lake-ulysses/sprites/npc_deborah.svg",
      "text": "The door opens before you knock." },
    { "speaker": "DEBORAH", "sprite": "…", "text": "You're not the church.",
      "interactive": { "type": "choice", "options": [
        { "label": "Say nothing. Let her fill it.",   "opener": "deborah_01" },
        { "label": "\"You look like you haven't slept.\"", "opener": "deborah_01_soft" },
        { "label": "\"I heard about your son.\"",     "opener": "deborah_01_hard" }
      ] } }
  ]
}
```

That is the whole pre-battle confrontation mechanic — **there is no
`confrontation` scene type and there shouldn't be one.** A confrontation is
a cutscene that happens to shape what follows: sprite, speaker nameplate,
typewriter text and branching choices were all already here, and the only
thing missing was one field of state. A separate type would have duplicated
all of it to add a single assignment.

`opener` composes with `jumpTo` and `nextBeat` rather than replacing them —
the opener is written first, then the option resolves as normal. An option
with `opener` and nothing else just advances, which is why a confrontation's
choice beat is normally the last beat in the list.

Every NPC in `lake-ulysses` now runs **explore → confront → encounter**:
mini-game, confrontation cutscene, dialog. Each NPC has three openers (the
original node plus a `_soft` and a `_hard` variant) authored in their
manuscript like any other node.

### `minigame` (`src/scenes/minigameScene.js`)

A chapter shouldn't have to know how a mini-game works internally, only
that it eventually finishes:

```json
{
  "type": "minigame",
  "id": "some-game",
  "load": "() => import('./minigames/some-game.js')"
}
```

`minigameScene.js` shows a small spinner (`.dx-minigame-loading` in
`scenes.css`, deliberately separate from `main.js`'s boot preloader —
different concern, and it keeps this file from touching that already-
stabilized boot sequence), calls `scene.load()`,
and once that resolves, delegates the scene-handler contract straight to
the loaded module: `mount(stageEl, scene, context) -> unmount`. It is
lazy-loaded the same way chapters are lazy-loaded from `main.js`, since a
mini-game is likely to be the heaviest thing in a chapter (its own canvas,
its own render loop) and shouldn't bloat the initial bundle.

The loaded module is a completely normal scene handler — free to manage
its own canvas/`requestAnimationFrame` loop and input handling (reuse
`attachSwipe` from `shell/input.js` if it fits a horizontal swipe; add its
own pointer listeners if it needs 2D movement, which `attachSwipe` does
not support).

**Design philosophy — read this before writing one.** Mini-games in this
project are *can't-lose* pacing beats, not skill checks: point-A-to-B
exploration for world-building, strung with quick, easy "obstacle gimmick"
interactions in a WarioWare register — fast, simple, varied, over before
they can get old — then handing off into the next dialog scene (the NPC
"encounter" the walk was building toward). The player always reaches the
end; failure isn't a state that exists.

This is a deliberate constraint, not a placeholder for a harder version
later: **there is no result/effects contract, and none should be added.**
`onComplete()` needs no payload — a mini-game finishing means "the player
reached B," nothing more. Earlier scene types apply effects with a real
contract (`resolveCard()`'s patch object for dialog); mini-games
intentionally don't get an equivalent, because there's nothing for one to
carry. If a future mini-game concept genuinely needs to move a stat, that
is a sign it isn't this kind of mini-game — model it as an explicit scene
in the chapter's own `SCENES` list instead of smuggling a side-effect
through this wrapper.

**Placement.** One mini-game precedes each NPC, with the confrontation
cutscene between the two, so a chapter reads as explore -> confront ->
encounter, repeating. In `lake-ulysses` that's Deborah / Rwanda / Samun /
Rick — four slots. Therapist is exempt: she belongs to the chapter's opening
call (Prologue -> Questionnaire -> Therapist), not to this pattern.

#### The step system (`engine/walkSequencer.js`)

A mini-game module runs its own ordered `STEPS` list — a second, smaller
sequencer nested inside the scene sequencer, the same way `cutsceneScene.js`
sequences its own beats. Two step types:

```js
const STEPS = [
  { type: 'walk', rooms: [ /* see below */ ] },
  { type: 'gimmick', prompt: { text: 'DUCK!' }, response: 'swipe-left' },
  { type: 'walk', rooms: [ /* ... */ ] },
];
```

When `STEPS` is exhausted the module calls `context.onComplete()` — the
chapter's own, threaded down untouched through `minigameScene.js` — and the
chapter advances into the NPC dialog. The chapter never learns any of this
happened.

**`walk` — a room with hotspots.** No static background: a looping animated
bg sprite (numbered WebP frames via `ui/spriteAnimator.js`, same as
`spr_lake_bg_001`) authored for a *stop-motion* feel — low frame count,
hard cuts, kinetic rather than tweened (reference: Tetsuo the Iron Man).
Objects are **separate sprite files** layered over it, not invisible tap
regions and not painted into the bg — the tap feedback scales an object up,
which is impossible if it's baked into a flat background frame.

```js
{
  bg: { base: '/assets/<chapter>/sprites/spr_hallway/spr_hallway_', frames: 6, fps: 8 },
  intro: {   // optional entry caption, per class — see below
    Guns:     'Third floor. The stairwell door behind you doesn\'t latch.',
    Bible:    'Third floor. Somebody swept this hallway recently.',
    Crystals: 'Third floor. The air is thick with something that has been sitting here.',
  },
  hotspots: [
    // x/y/w/h are design-space pixels against the 390×844 frame, top-left
    // origin — the numbers straight off the artboard. The renderer divides
    // by the frame to get percentages; do not pre-convert by hand.
    { x: 58, y: 170, w: 78, h: 210, sprite: '...', closeup: '...', text: {
        Guns:     "Her diploma. Crooked. Nobody straightened it.",
        Bible:    "Her diploma. Class of '09. She earned that.",
        Crystals: "Her diploma, tilted. Something here gave up a while ago.",
    } },
  ],
  advance: { x: 281, y: 464, w: 55, h: 253, sprite: '...', to: 'next-room-id' },
}
```

- **Room intro** (`intro`, optional): a descriptive line drawn over the room
  the instant it mounts — where you just arrived, before anything is
  tappable. It scrims the room rather than replacing it, so the bg is
  already animating behind the text instead of the player landing on a dead
  screen, and it covers the hotspots while up so the beat can't be tapped
  through by accident. Same two-tap gesture as a close-up: finish the draw,
  then dismiss. Varies by class exactly like hotspot captions.
- **Inspect hotspots**: tap -> quick scale-up pop (snappy, un-eased, to match
  the stop-motion register) -> close-up image + inner-thought caption,
  typewriter-drawn via `ui/typewriterText.js`. Tap dismisses back to the
  room. Permanently re-tappable; no lockout, no "already seen" state.
- **Caption text varies by class.** `text` is an object keyed by
  `run.loadout` (Guns / Bible / Crystals) — the same trick
  `questionnaireScene.js`'s `DIAGNOSES` already uses, and it needs no new
  run state since `loadout` is set before any mini-game runs. Three variants
  per hotspot. Gimmick prompts deliberately do *not* vary — they're short
  and functional; the interpretive weight lives in the captions.
- **The advance hotspot is a reserved 4th slot**, authored into every room
  from the start but invisible and inert until every inspect hotspot in that
  room has been tapped at least once. Then it reveals itself as a hint that
  you can move on. Tapping it loads the next room, or ends the `walk` step
  if it was the last. Progression is therefore gated on *curiosity*, not
  skill — you can't get stuck and you can't fail, you just have to look.
- Positions are authored as **design-space pixels** against the 390×844
  frame and converted to percentages by the renderer. This is the one place
  pixel numbers are correct, because they're input data rather than
  something reaching CSS — the canvas still scales to the viewport as
  always. Art hand-off spec (what to produce per room, and the requirement
  that interactive objects be their own sprite files rather than painted
  into the bg) is in `ASSET_GUIDELINES.md`.
- Per-room visited-tracking lives in the renderer's own closure, not in
  `run` — same convention `dialogScene`/`cutsceneScene` use for scene-local
  state.

**`gimmick` — the "Quick Beat" template.** One reusable, data-only shape,
*not* a catalog of bespoke micro-games and not its own lazy-loaded module:
a short prompt appears, the player answers with either an `attachSwipe`
left/right or a tap on a single target hotspot, and **any** response
resolves it. Match vs. miss (including a timeout) only changes the cosmetic
flourish — `fx.flash()` / `fx.shake()` at weak or strong, the same
intensity-only feedback dialog swipes use, never color-coded right/wrong.
It takes over the screen rather than blending into the walk, which keeps
its interaction code independent of the room renderer's.

Five things in `quickBeat.js` exist specifically to keep a can't-lose beat
from *feeling* like a test, and shouldn't be undone casually:

- **A tap resolves the beat too, and resolves it as a hit.** The swipe is
  the flavor of the moment, not a requirement — a player who doesn't want to
  swipe should never be stuck waiting out the clock, and every other step in
  a mini-game (intro, close-up, advance) already passes on a tap. It counts
  as a hit rather than a miss because tapping is a deliberate answer. A
  completed swipe has already set `resolved`, so the trailing click can't
  double-fire.
- **The clock stops on the first `pointermove`.** Otherwise a swipe begun
  near the deadline has its own timeout fire mid-drag: the miss flourish
  plays and the `pointerup` lands on a dead no-op, punishing a player who
  did the right thing. A drag that ends below threshold restarts the clock
  rather than leaving the beat hanging.
- **The prompt renders its direction** (`← THE SMELL …`). The response is
  authored as `swipe-left`/`swipe-right`, and without showing it the first
  encounter with any beat is a coin flip — text has to be read and mapped,
  where WarioWare's art conveys the verb instantly.
- **Threshold is 45px, not `attachSwipe`'s 90px default.** 90 suits a
  deliberate dialog card; on a ~375px canvas it's a quarter of the screen
  for what is meant to be a reflex.
- **`onDrag` moves the prompt and tints it past threshold**, matching the
  dialog card's language. Without it nothing moved, so the player had no
  signal their input was registering.

Tap-targets hit-test with ~24px of slop for the same reason: a tap just
outside the art should read as intent, not as a miss.

**Built and playable.** `engine/walkSequencer.js` runs the `STEPS` list;
`ui/walkRoom.js` and `ui/quickBeat.js` are the two step renderers. All four
NPCs now have one: `deborah-hallway`, `rwanda-alley`, `samun-garage`,
`rick-barlot`, each a module under `chapters/lake-ulysses/minigames/` and one
line in `SCENES`. Every one of them is **placeholder throughout** — the art
is generated vectors (`scripts/make-placeholder-room.mjs`) and the intros and
captions exist to exercise the class-variation path, not as final prose.
Replacing them is content and art work, no engine changes.

Two implementation notes worth knowing:

- `createSpriteAnimator` takes an optional `ext` (default `'webp'`). It
  exists so placeholder frame sequences can be committed as SVG rather than
  generating throwaway binaries — real art should omit it.
- A room whose `advance.to` is `null` (or points at an unknown room id) ends
  the `walk` step and falls through to the next entry in `STEPS`. That's how
  a single-room walk terminates without needing a separate "last room" flag.

## Adding a new type

1. Write `src/scenes/<type>Scene.js` implementing the contract above.
2. Register it in the chapter's `HANDLERS` map (see
   `chapters/lake-ulysses/index.js`).
3. Add scenes of that type to the chapter's `SCENES` list.

No changes to `sceneSequencer.js` or the shell are ever required to add a
new scene type.
