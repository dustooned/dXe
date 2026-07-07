# Script Format (for writers)

This is for anyone writing dialog content who doesn't want to touch JSON —
a collaborator, a co-writer, anyone. Write a plain `.txt` file in this
format, drop it in a chapter's `manuscript/` folder, run one command, and
it becomes real game content. No code, no braces, no quotes to escape.

## Where files go

```
src/chapters/<chapter-id>/manuscript/<npc-name>.txt   <- you write this
src/chapters/<chapter-id>/content/<npc-name>.json     <- generated, don't hand-edit
```

## Building it

```bash
npm run build:content
```

Converts every `manuscript/*.txt` file in every chapter into the matching
`content/*.json` file. Run this after editing a manuscript, then commit
both the `.txt` and the regenerated `.json` together.

## The format

One file per NPC. Here's a complete real example
(`src/chapters/lake-ulysses/manuscript/deborah.txt`, trimmed to one node):

```
NPC: DEBORAH
LOCATION: 2
ACCENT: var(--color-deborah)

=== deborah_01
PROMPT: God took my boy when He needed him. I just have to trust that.
FEELZ: Anger, Fear, Anticipation

-- TRUTH
SAY: Your faith didn't protect him. Someone failed him.
REACT: She flinches. Her bible shifts in her grip.
EFFECTS: integrity+2 lucidity+1 stability-2 trust-1
DEBT: 0
NEXT: deborah_02_confronted

-- LIE
SAY: God has a plan. He's at peace.
REACT: Her smile widens. Too wide. The wallpaper flickers green.
EFFECTS: integrity-2 stability+2 trust+1
DEBT: +4
TAGS: Faith, Health
LEDGER: You told Deborah God took her son on purpose.
NEXT: deborah_02_denial
```

### File header (once per file)

- `NPC:` — the character's name, in caps, as it should display in-game.
- `LOCATION:` — which numbered stop in the chapter this NPC is (see the
  chapter's other manuscript files for what numbers are already used).
- `ACCENT:` — a CSS color for this NPC's visual accent. Use
  `var(--color-<name>)` and add the matching variable to `src/style.css`
  if this is a brand new NPC (ask if unsure).

### A node (one screen the player sees)

Starts with `=== <node_id>`. The node id is just a short internal name —
players never see it — but it has to be unique in the file and is how
`NEXT:` refers back to it. Convention: `<npcname>_<number>[_<qualifier>]`,
e.g. `deborah_01`, `deborah_02_denial`.

- `PROMPT:` — what the NPC says, the line the player is reacting to.
- `FEELZ:` — which 3 feelings show as picker options for this moment.
  Right now the only three that exist are `Anger`, `Fear`, `Anticipation`
  — list them in whatever order you want them to appear.
- `GATE:` (optional) — redirects to a *different* node instead of this
  one, if a stat condition is true. Format:
  `GATE: <stat> <op> <value> -> <nodeId>`, e.g.
  `GATE: trust < 3 -> rick_shut_down`. Valid `<op>`: `<`, `<=`, `>`, `>=`.
  This only matters for the *first* node the player would otherwise see
  — put it on the node your `NEXT:`/opening points at, not on every node
  in the tree. Leave it off entirely unless you specifically want this
  NPC's behavior to depend on how the player's been playing so far — most
  nodes shouldn't have one. See `STAT_MATH.md` for the design reasoning
  and the current real example (Rick, gated on trust).

### A swipe (what happens for Truth vs. Lie)

Every node needs exactly two: `-- TRUTH` and `-- LIE`.

- `SAY:` — the line the player "says" if they pick this side.
- `REACT:` — how the NPC responds. This is what actually displays after
  the swipe.
- `EFFECTS:` — how this changes the player's four meters. Space-separated,
  each one `statname` immediately followed by `+N` or `-N`. Valid stat
  names: `integrity`, `trust`, `stability`, `lucidity`. Skip any stat this
  choice doesn't touch — you don't have to list all four. See
  `CONTENT_SCHEMA.md`'s "What the stats mean" section for what each one
  represents narratively (short version: truth usually raises integrity
  and lucidity and costs stability/trust; lies usually invert that).
- `DEBT:` — how much this adds to Truth Debt. Almost always `0` on the
  TRUTH side. On the LIE side, roughly `+2` for a small lie up to `+4` for
  a big one — look at other nodes for a feel of scale.
- `TAGS:` (optional, only really matters for lies) — comma-separated
  freeform categories, e.g. `Faith, Health`. Skip the line entirely if
  there's nothing worth tagging.
- `LEDGER:` (optional) — a short third-person line describing the lie,
  used later in the Reckoning. Only include this if the choice is a lie
  worth being confronted with at the end. Skip the line entirely for
  truths, or for lies too small to matter.
- `NEXT:` — which node this leads to, or `(end)` if this is the last
  thing this NPC says (the game moves on to whoever's next).

## Rules that will make the build fail (on purpose)

- Every `EFFECTS:` token must be one of the four stat names above,
  immediately followed by a signed number, no spaces (`integrity+2`, not
  `integrity + 2`).
- Every swipe block must be `-- TRUTH` or `-- LIE`, spelled exactly that
  way (case-insensitive).
- Unrecognized lines throw an error naming the file and line number —
  it's telling you it doesn't understand that line, not that something
  is broken elsewhere.

## What this format doesn't cover yet

Endings (`content/endings.json`) aren't part of this pipeline — that
file's shape is different (ending name → title/text), and small enough
to hand-edit directly for now. Cutscenes and mini-games (see
`SCENE_TYPES.md`) don't have a manuscript format yet either, since
neither is built. Both are natural extensions of this same idea once
there's real content for them.
