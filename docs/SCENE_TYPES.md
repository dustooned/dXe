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

Terminal. Picks an ending by final Truth Debt, records it, calls `exit`
(not `onComplete`) when the player taps back to menu.

```json
{ "type": "ending", "id": "ending", "endings": /* endings.json */ }
```

## Planned types (not built yet — build when there's real content for them)

Sketched here so the first implementation doesn't have to re-derive the
shape from scratch, and so it's consistent if written in a different
session.

### `cutscene`

For the "immersive storytelling on first NPC encounter" and general
narrative beats. Internally sequences its own list of beats, the same way
`dialogScene` sequences nodes:

```json
{
  "type": "cutscene",
  "id": "deborah-intro",
  "beats": [
    { "image": "...", "text": "The condo door is ajar." },
    { "text": "Something is playing on a loop inside.", "autoAdvanceMs": 1500 },
    { "interactive": { "type": "choice", "options": ["knock", "walk in"] } }
  ]
}
```

Default beat behavior: show it, wait for a tap (same pattern as the
dialog scene's "(tap to continue)"), advance to the next beat. An
`autoAdvanceMs` beat advances itself instead of waiting for a tap — for
pacing a moment rather than gating it. An `interactive` beat is where
"the player controls it occasionally" — it pauses the sequence and waits
for a specific input (a choice, a timed tap, a drag) before continuing.
Calls `onComplete()` when beats run out, or `onComplete({ jumpTo })` if a
choice should branch the rest of the chapter.

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
