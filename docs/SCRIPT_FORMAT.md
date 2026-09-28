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
- `PORTRAIT:` (optional) — a path to this NPC's portrait image (e.g.
  `/assets/lake-ulysses/sprites/portrait_deborah.webp` — see
  `ASSET_MANIFEST.md`'s "Dialog portraits"), served straight from
  `public/` (see CONTENT_SCHEMA.md's "Asset folders"). Leave the line out
  entirely until real art exists — `ui/npcPortrait.js` falls back to the
  colored-initial placeholder whenever this is unset.

### A node (one screen the player sees)

Starts with `=== <node_id>`. The node id is just a short internal name —
players never see it — but it has to be unique in the file and is how
`NEXT:` refers back to it. Convention: `<npcname>_<number>[_<qualifier>]`,
e.g. `deborah_01`, `deborah_02_denial`.

- `PROMPT:` — what the NPC says, the line the player is reacting to. Draws
  character-by-character like every other line in the game (`src/ui/
  typewriterText.js`), so the `{slow}`/`{fast}`/`{pause:N}` pacing codes
  work here too.
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

There's no per-node feelings list, and that's deliberate. Which 3 of the 8
emotions the player can pick from is set once by the opening Questionnaire
— it assigns their class — and holds for the whole run (`engine/loadout.js`).
A `FEELZ:` line used to sit in this block and was read by nothing; it's
gone, and the build rejects one if it turns up in a file.

### Trust and feelings (per node, optional)

- `MOOD: Emotion` — the NPC's feeling at this moment (one of the 8:
  `Happy`, `Trust`, `Fear`, `Surprise`, `Sadness`, `Disgust`, `Anger`,
  `Anxiety`). Tints the oscilloscope; a player whose picked feeling
  matches it "syncs" (attunement, builds trust). The color the answer's
  impact lands in is the *next* node's mood, so write moods as a path.
- `BID: truth` / `lie` / `both` — marks a vulnerable moment ("His name
  was Caleb."). The listed side(s) turn toward it: the portrait warms,
  it counts toward trust, and it's when the NPC gives the player a
  feeling (engine/unlocks.js). Use `both` when a kind lie still meets
  them.

### A swipe (what happens for Truth vs. Lie)

Every node needs exactly two: `-- TRUTH` and `-- LIE`.

- `SAY:` — the line the player "says" if they pick this side. Displays as
  its own beat right after the swipe (right-aligned, labeled `YOU`),
  before `REACT:` draws in.
- `REACT:` — how the NPC responds, the beat right after `SAY:`.
- All three of `PROMPT:`/`SAY:`/`REACT:` accept `\n` (a literal backslash
  then `n`) anywhere you want a forced line break — the manuscript format
  is one physical line per field, so this is the escape for a break the
  text wouldn't have wrapped on its own (a stanza, a beat, a line standing
  alone).
- `EFFECTS:` — how this changes the player's four meters. Space-separated,
  each one `statname` immediately followed by `+N` or `-N`. Valid stat
  names: `integrity`, `trust`, `stability`, `lucidity`. Skip any stat this
  choice doesn't touch — you don't have to list all four. See
  `CONTENT_SCHEMA.md`'s "What the stats mean" section for what each one
  represents narratively (short version: truth usually raises integrity
  and lucidity and costs stability/trust; lies usually invert that).
- `DEBT:` — how much this adds to Truth Debt. On the TRUTH side, write
  `0`: the game treats that as **−1** (every truth clears the lake a
  little). Write `-2` for a truth that should clear more, or `0!` for a
  truth that shouldn't clear anything. On the LIE side, roughly `+2` for a
  small lie up to `+4` for a big one — look at other nodes for a feel of
  scale.
- `TAGS:` (optional, only really matters for lies) — comma-separated
  freeform categories, e.g. `Faith, Health`. Skip the line entirely if
  there's nothing worth tagging.
- `LEDGER:` (optional) — a short third-person line describing the lie,
  used later in the Reckoning. Only include this if the choice is a lie
  worth being confronted with at the end. Skip the line entirely for
  truths, or for lies too small to matter.
- `IF PICK Emotion: text` (optional, repeatable) — a line said *before*
  `REACT:` when the player picked that feeling. Use it to vary a reaction
  by feeling while `REACT:` stays the same.
- `IF GIFT Emotion: text` / `IF GIFT none: text` (optional) — a line said
  *after* `REACT:` when this answer turned toward a bid and unlocked that
  feeling (or `none`: turned toward, nothing left to give). The
  Therapist's intrusive-thoughts question uses both, and every version
  ends on the same closing sentence so the lesson stays recognizable.
- `IT:` / `SO:` (optional) — an intrusive-thought popup right after this
  answer's `REACT:`, before the next node. Use one or both (IT first,
  then SO). Example: the Therapist's intrusive-thoughts question has IT
  say "Are you sure about that?" after the lie.
- `NEXT:` — which node this leads to, or `(end)` if this is the last
  thing this NPC says (the game moves on to whoever's next).

### File-level extras

- `CONNECT [Guns|Bible|Crystals]: text` — the connection moment: the
  story beat played when this NPC first trusts the player (vignette,
  silence, a crack, then this text). One per class. Put these in the
  file header, before the first node.
- `OPENER [Guns|Bible|Crystals]: text` — how this NPC sizes up the player's
  class: said before the first prompt of the encounter, whichever node
  that is. One per class, in the header.
- `CLASS [Guns|Bible|Crystals]: text` (inside a node) — a line before this
  node's prompt for that class only. The Therapist uses it to talk in
  each class's language.
- `CONTACT [Guns|Bible|Crystals]: text` — the stay-in-touch moment: the
  last beat of an encounter that ended with this NPC trusting the player
  (their bust, large, then this text); their contact then joins the dock.
  One per class, in the header next to `CONNECT`.

### Tutorial extras (optional — the Therapist uses these)

None of these are needed for a normal NPC. Leave them out and nothing
changes.

- `PICK Emotion: text` — inside a node, before its swipes. What the NPC
  says the moment the player picks that feeling, before they swipe. One
  line per emotion (`Happy`, `Trust`, `Fear`, `Surprise`, `Sadness`,
  `Disgust`, `Anger`, `Anxiety`). The player only ever sees
  symbols, so **never name the feeling in the text**. Describe it
  instead ("That one runs hot").
- `REVEAL: meters after node_id` / `REVEAL: debt after node_id` — in the
  file header. Keeps the four meters (or the lake gauge) off screen until
  that node has been answered, so the NPC can introduce them. Debt also
  shows early the moment it goes above 0. When it appears, it's
  spotlit (everything else dims) along with the NPC's reaction line, so
  write that reaction to be the line that introduces it.
- `SPOTLIGHT: wheel, card` — inside a node. Before a feeling is picked,
  the screen dims except the wheel and the prompt. After a pick, it dims
  except the card and the `PICK` line. Use either one or both.
- `=== OUTRO` — a section after the last node, played once the NPC's
  last reaction is done. Each line is one beat:
  - `LINE: text` — the NPC speaks (tap to continue)
  - `HANGUP: text` — narration; the NPC's screen dims and their music stops
  - `NOTIFY: text` — a FEELZ push notification (text only, with a ping).
    Lines split on `\n`: the first is the app header, the second the
    headline, the rest the body. The Therapist uses it to send Deborah's
    profile as homework.
  - `IT: text` / `SO: text` — the intrusive-thought popups
  
  Any of them can take a condition in brackets before the colon, and only
  plays when it holds: a class (`LINE [Guns]: ...`), how a node was
  answered (`IT [therapist_02=lie]: ...`), or both, comma-separated
  (`[Bible, therapist_02=truth]`). An NPC with an outro skips the usual
  end-of-encounter IT read, since the outro is its closing IT moment.

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
to hand-edit directly for now. Cutscenes (including the pre-battle
confrontations) and mini-game rooms don't have a manuscript format yet
either — both are built and both are hand-authored JSON or JS today. They
are natural extensions of this same idea, and now that there's real
content in them, the strongest candidates for the next format.

One thing to know if you're writing a confrontation: its choices name
node ids in *this* file (see `SCENE_TYPES.md`'s `opensDialog`). An NPC's
alternate openers are just ordinary nodes here, by convention
`<npcname>_01_soft` / `<npcname>_01_hard`. If you rename or delete one,
the confrontation silently falls back to the NPC's first node instead of
failing the build — so rename them in step. If the NPC has a `GATE:` on
their opening node, every alternate opener needs the same line, or
choosing one quietly bypasses the gate.
