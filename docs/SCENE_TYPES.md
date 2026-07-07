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

## Planned types (not built yet — build when there's real content for them)

### `minigame`

For actual gameplay breaks — a chapter shouldn't have to know how a
mini-game works internally, only that it eventually finishes:

```json
{
  "type": "minigame",
  "id": "some-game",
  "load": "() => import('./minigames/some-game.js')"
}
```

Lazy-loaded the same way chapters are lazy-loaded from `main.js`, since a
mini-game is likely to be the heaviest thing in a chapter (its own canvas,
its own render loop) and shouldn't bloat the initial bundle. The loaded
module is a normal scene handler (`mount(stageEl, scene, context) ->
unmount`) — completely free to manage its own canvas/`requestAnimationFrame`
loop and input handling (reuse `attachSwipe` from `shell/input.js` if it
fits, or add its own listeners). Calls `onComplete(result)` when finished;
`result` can carry whatever the chapter wants to react to (e.g.
`{ won: true, score: 120 }` -> the chapter's own glue code decides if
that should affect Truth Debt or a meter — that logic does not belong
inside `sceneSequencer.js` itself, which stays result-shape-agnostic).

## Adding a new type

1. Write `src/scenes/<type>Scene.js` implementing the contract above.
2. Register it in the chapter's `HANDLERS` map (see
   `chapters/lake-ulysses/index.js`).
3. Add scenes of that type to the chapter's `SCENES` list.

No changes to `sceneSequencer.js` or the shell are ever required to add a
new scene type.
