# Architecture

Dream Xtreme is a single-page shell that mounts self-contained chapter
modules into a stage. Vanilla JS + Vite. No UI framework.

## Shell (`src/main.js`, `src/shell/`)

Owns everything that's the same across every chapter:

- `router.js` — hash routing (`#/menu`, `#/about`, `#/chapter/<id>`)
- `state.js` — tiny pub/sub store (`createStore`), used by both the shell
  and by chapters for their own run state
- `save.js` — localStorage persistence (endings seen, chapters completed)
- `input.js` — `attachSwipe(el, opts)`, a Pointer Events drag helper that
  handles mouse, touch, and pen with one code path

The shell renders Title / Menu / About screens directly, and for chapters
it hands a container element to the chapter module and gets an `unmount`
function back.

## Chapter contract (`src/chapters/<id>/index.js`)

Every chapter exports:

```js
export const id = 'chapter-id';
export const title = 'Display Title';
export function mount(stageEl, { exit }) {
  // render into stageEl, wire up interaction
  return function unmount() { /* cleanup */ };
}
```

The shell doesn't know or care how a chapter renders internally — DOM,
canvas, whatever gets the job done. This is the escape hatch: a chapter
that needs a mini-game with drag physics or a canvas particle effect can
just do that inside its own `mount()`, without touching the shell or any
other chapter.

`exit()` is the chapter's way of handing control back to the shell (e.g.
"back to menu" after an ending).

## Inside a chapter: the scene sequencer (`src/engine/sceneSequencer.js`)

A chapter's `mount()` doesn't have to hand-roll its own flow control. Most
chapters will define a `SCENES` list and hand it to
`createSceneSequencer({ scenes, handlers, context })`, which mounts
whichever scene is current, and advances (or jumps) when that scene calls
`context.onComplete(result)`. This is a second, smaller contract *inside*
a chapter, independent of the shell — the shell only ever sees the
chapter's own `mount`/`unmount`.

```js
// chapters/<id>/index.js
const SCENES = [
  { type: 'dialog', id: 'deborah', npc: deborah },
  { type: 'reckoning', id: 'reckoning' },
  { type: 'ending', id: 'ending', endings },
];
const HANDLERS = { dialog: dialogScene, reckoning: reckoningScene, ending: endingScene };

export function mount(stageEl, { exit }) {
  const run = createStore(initialRunState);
  const sequencer = createSceneSequencer({ scenes: SCENES, handlers: HANDLERS, context: { run, exit, ... } });
  sequencer.mount(stageEl);
  return () => sequencer.unmount();
}
```

This is *why* cutscenes and mini-games don't require an engine change:
they're just new scene `type`s with a handler registered in `HANDLERS` and
entries added to `SCENES`. See `SCENE_TYPES.md` for the handler contract
and the planned (not yet built) `cutscene` and `minigame` shapes.

A chapter is free to skip the sequencer entirely and manage its own
`mount`/`unmount` by hand (that's what the very first version of
`lake-elsinore` did) — the sequencer is a convenience for the common
"ordered/branching list of scenes" shape, not a requirement of the shell
contract.

## Engine (`src/engine/`)

Framework-agnostic game logic:

- `sceneSequencer.js` — runs a chapter's scene list (see above)
- `cardEngine.js` — `resolveCard(state, node, swipeKey)`: applies stat
  deltas, debt, and ledger entries for a dialog choice
- `debtEngine.js` — Truth Debt thresholds, bloom-event triggers, lake
  health calculation
- `endingEngine.js` — ending selection from final debt
- `reckoning.js` — builds the end-of-run "confess vs. double down" deck
  from the ledger

The last four are specific to the Truth Debt gameplay pattern. A chapter
that doesn't use Truth Debt (a pure mini-game, say) just doesn't import
them — nothing forces it into this shape. `sceneSequencer.js` itself has
no idea Truth Debt exists.

## Scene types (`src/scenes/`)

The reusable scene handlers for the Truth Debt pattern: `dialogScene.js`,
`reckoningScene.js`, `endingScene.js`. Each implements
`mount(stageEl, scene, context) -> unmount`. Full contract, plus the
planned `cutscene`/`minigame` shapes, in `SCENE_TYPES.md`.

## UI components (`src/ui/`)

Small DOM-factory functions (`createSwipeCard`, `createFeelzWheel`,
`createMeterGroup`, `createNpcPortrait`, `createDebtSigil`). Each one
returns `{ el, ...helpers }`. Reusable across chapters and scene types;
not required.

## Adding a new chapter

1. Make `src/chapters/<id>/index.js` with the contract above (using the
   scene sequencer, or not).
2. Add content JSON under `src/chapters/<id>/content/` if it uses the
   card/dialog schema (see `CONTENT_SCHEMA.md`).
3. Register it in `CHAPTERS` in `src/main.js`.

That's the whole integration surface.
