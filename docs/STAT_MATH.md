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
