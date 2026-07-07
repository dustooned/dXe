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

## Emotional Lean (designed, not yet built)

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

Mechanically: `resolveCard()` needs the active emotion threaded in (it's
already tracked in `dialogScene.js`, just not passed to the engine yet).
`cardEngine.js` gets a small `EMOTION_AMPLIFIES` lookup and multiplies
the matching key in `effects` before applying it. Truth Debt is
untouched — this only ever touches the four display meters.

**Important honesty check:** as of writing, nothing reads the four
meters back (same gap noted in `HANDOFF.md` since the start). So
Emotional Lean, on its own, changes numbers on a screen nothing else
looks at. It needs a consumer to actually matter — see below.

## Ending epilogue (designed, not yet built) — the consumer

The smallest possible way to make the four meters count for something,
without adding branching or new schema:

At the ending, after Truth Debt has already picked the ending tier
(Clean Cut / Functional Mask / Collapse / Living Lie — unchanged), look
at all four meters' final values and find whichever deviated furthest
from its starting value of 5 (`Math.abs(final - 5)`, largest wins; tie
order not yet decided, low stakes). Show one derived line alongside the
existing ending text — a small "epilogue" naming whichever stat took the
biggest hit or gain, e.g. "Integrity never recovered" for a
big-negative-integrity run.

Open question, not yet resolved: whether the epilogue line depends on
direction (up vs. down) — i.e. 8 possible lines (4 stats × 2 directions)
vs. a simpler 4 lines regardless of direction. Leaning toward starting
with 4 (simpler, matches "keep it simple / fast replay") and expanding
only if it feels thin in practice.

This is the *only* thing currently planned to read the four meters back.
Meter-gated branching (an option only available above/below some
threshold) is a separate, bigger, not-yet-designed topic — deliberately
not folded into this pass.

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

1. Emotional Lean + ending epilogue (one unit — the mechanic and the
   reason it's visible; shipping one without the other leaves either
   dead code or an unexplained number).
2. Per-NPC leitmotif, whenever — doesn't depend on or block anything above.
3. Meter-gated branching — explicitly not scoped yet, needs its own
   design pass before any build work.
