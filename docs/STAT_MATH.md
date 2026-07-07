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

This is the *only* thing currently reading the four meters back. Meter-
gated branching (an option only available above/below some threshold) is
a separate, bigger, not-yet-designed topic — deliberately not folded
into this pass.

Verified: the amplification math and epilogue tie-breaking
deterministically in Node (emotion-vs-no-emotion, all three emotions,
symmetric negative-value rounding, lucidity never amplified, tie-break
order), then a full browser playthrough confirming the epilogue line
actually renders and matches what the Node test predicted for that exact
stat combination.

## Per-NPC leitmotif (parked, audio-only, independent of the above)

Not stat math, noted here since it came out of the same conversation.
Each NPC gets a short hardcoded melodic phrase (an array of
`{ note, durationMs }`, note-name-to-frequency via standard equal
temperament math — no MIDI files, no dependencies) played as its own
oscillator+gain layer, same mount/unmount lifecycle already used by the
three FEELZ emotion stems in `shell/audio.js`. The three emotion stems
stay exactly as they are (shared, hardcoded, universal); this adds one
extra per-character layer on top, so Deborah/Rwanda/Samun/Rick each get
a recognizable musical signature instead of sharing the same three
generic tones. Fully independent of Emotional Lean/epilogue — can be
built in any order relative to those.

## Build order

1. ~~Emotional Lean + ending epilogue~~ — done.
2. Per-NPC leitmotif, whenever — doesn't depend on or block anything above.
3. Meter-gated branching — explicitly not scoped yet, needs its own
   design pass before any build work.
