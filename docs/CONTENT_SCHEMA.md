# Content Schema

Format for writing a swipe/dialog chapter (e.g. `lake-elsinore`). If you're
just writing new dialog, you only ever need to touch files in
`src/chapters/<id>/content/*.json` — no code changes required.

## NPC file

One JSON file per NPC, e.g. `content/deborah.json`:

```json
{
  "npc": "DEBORAH",
  "location": 2,
  "accentColor": "var(--color-deborah)",
  "nodes": {
    "deborah_01": { ...node }
  }
}
```

## Node

```json
{
  "id": "deborah_01",
  "npc": "DEBORAH",
  "location": 2,
  "prompt": "God took my boy when He needed him. I just have to trust that.",
  "feelzOptions": ["Anger", "Fear", "Anticipation"],
  "swipes": {
    "truth": { ...edge },
    "lie": { ...edge }
  }
}
```

- `feelzOptions` — which of the 3 demo emotions (Anger / Fear /
  Anticipation) show as FEELZ picker bubbles for this node. Picking one is
  currently cosmetic in the demo (it doesn't branch anything) but is
  wired through so a later pass can make emotion choice matter.
- Swiping left = `truth`, right = `lie`.

## Edge (one side of a swipe)

```json
{
  "playerText": "Your faith didn't protect him. Someone failed him.",
  "npcReaction": "She flinches. Her bible shifts in her grip.",
  "effects": { "integrity": 2, "lucidity": 1, "stability": -2, "trust": -1 },
  "debtDelta": 0,
  "tags": [],
  "ledgerEntry": null,
  "nextNodeId": "deborah_02_confronted"
}
```

- `effects` — any of `integrity` / `trust` / `stability` / `lucidity`,
  added to the player's meters and clamped to 0–10. Omit a key to leave
  that meter untouched.
- `debtDelta` — added to Truth Debt (0–10 clamp). Usually 0 on the truth
  side, positive on the lie side.
- `ledgerEntry` — human-readable line logged to the Truth Ledger when this
  edge is a lie worth remembering. `null` if this choice shouldn't be
  logged (e.g. most truth choices). Ledger entries become Reckoning cards
  at the end of the chapter.
- `tags` — freeform strings (e.g. `"Faith"`, `"Addiction"`) for grouping
  ledger entries later. Not consumed by any logic yet.
- `nextNodeId` — the next node in this NPC's tree, or `null` to end this
  NPC's dialog scene and let the sequencer advance to whatever scene comes
  next (another NPC, a cutscene, the Reckoning — see `SCENE_TYPES.md`).

## What the stats mean

Four meters (0–10) plus Truth Debt (0–10, tracked separately). **Only
Truth Debt currently drives real logic** — the four meters are shown to
the player but nothing branches on them yet (see `docs/HANDOFF.md` for
the "known gap" note). Write `effects` with their narrative meaning in
mind anyway, since that's the intended semantics once branching reads
them:

- **`integrity`** — honesty with yourself. Truth edges almost always add
  to it; lie edges almost always subtract.
- **`trust`** — the NPC's rapport with you. Not a fixed rule — a
  comforting lie often *raises* trust short-term (they like hearing what
  they want to hear), while an uncomfortable truth can lower it. Set this
  per-edge based on how the specific NPC would react, not a global
  formula.
- **`stability`** — emotional turbulence of the scene. Lies tend to smooth
  things over (+stability); truths tend to crack something open
  (-stability). "Comfort now, pay later."
- **`lucidity`** — your own clarity/self-awareness. Truths build it; lies
  rarely touch it.
- **`debtDelta` (Truth Debt)** — the one meter with teeth. Only lies
  should add to it. It drives bloom-event thresholds, forces the
  Reckoning at 10, and picks the ending.

## Endings file

`content/endings.json` maps an ending key to display content:

```json
{
  "CLEAN_CUT": {
    "title": "CLEAN CUT",
    "range": "Debt 0–3",
    "text": ["line one", "line two"]
  }
}
```

Ending key is chosen by final Truth Debt — see `getEndingKey()` in
`src/engine/endingEngine.js` for the current thresholds (0–3 / 4–6 / 7+).

## Adding a new NPC or branch

Just add nodes to the JSON and wire `nextNodeId`. No code changes needed
unless you're adding a whole new NPC file — in that case, import it and
add a `{ type: 'dialog', id: '<npc>', npc: <imported json> }` entry to the
`SCENES` list in `src/chapters/lake-elsinore/index.js`.

## Asset specs (not yet built)

Placeholder portraits (colored initials) stand in for real art. Target
sizes when real sprites are ready, per the original build spec:

- NPC portraits: 128×128px, 1-bit, with a semantic accent color overlay
- Player/canvas: portrait, 390×844px baseline (iPhone 14)
- Font: Press Start 2P (already wired via Google Fonts in `src/style.css`)
