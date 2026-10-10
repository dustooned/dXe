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
- `CLASS:` (optional) — `Guns`, `Bible` or `Crystals`: the class this NPC
  reads as, their own lens. Their Roman numeral page and room close-ups
  wear that class's color and glyph, and their room hides one restore per
  class (see `minigames/*.js`).
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
  `GATE: trust < 4 -> rick_shut_down`. Valid `<op>`: `<`, `<=`, `>`, `>=`.
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
- `MOOD [Guns|Bible|Crystals]: Emotion` — how they feel toward one class in
  particular (kin or foe): replaces `MOOD` for a player of that class. The
  balance check's first-card table shows which openers each class can
  meet; keep at least one per class per NPC (`npm run test:engine` checks).

### A swipe (what happens for Truth vs. Lie)

Every node needs exactly two: `-- TRUTH` and `-- LIE`.

- `SAY:` — the line the player "says" if they pick this side. Displays as
  its own beat right after the swipe (right-aligned, labeled `YOU`),
  before `REACT:` draws in.
- `REACT:` — how the NPC responds, the beat right after `SAY:`.
- `REACT [Guns|Bible|Crystals]:` — that class's own version of the same
  reaction (the plain `REACT:` is the fallback when there is no class).
  The Therapist uses these to explain the meters and the lake in each
  class's terms.
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
- `CONTRADICTS: node_id=truth|lie` (optional, repeatable) — this answer
  contradicts that earlier answer. Someone else's node (word traveled): IT
  quotes it back after this reaction and this NPC loses 1 sync. This NPC's
  own node (they heard both): they call it out as the last page of their
  reaction, lose 2 syncs, TRU -1, and a bid on this answer doesn't count.
  Author truth-then-lie only; correcting yourself never counts.
- `CAUGHT [node_id]: "line"` (optional) — the callout for a same-NPC
  contradiction; [node_id] picks which CONTRADICTS pair it answers. Without
  one, the NPC's fallback line plays (dialogScene.js CAUGHT_FALLBACK).
- `IT:` / `SO:` (optional) — an intrusive-thought popup right after this
  answer's `REACT:`, before the next node. Use one or both (IT first,
  then SO). Example: the Therapist's intrusive-thoughts question has IT
  say "Are you sure about that?" after the lie.
- `NEXT:` — which node this leads to, or `(end)` if this is the last
  thing this NPC says (the game moves on to whoever's next).

### File-level extras

- `CONNECT [Guns|Bible|Crystals]: text` — the connection moment: the
  story beat played when this NPC first trusts the player (the dark closes
  while two tones pull together, the lock, then this text). One per class. Put these in the
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
  write that reaction to be the line that introduces it. When meters are
  gated, each icon stays hidden until a line reaches its cue
  (`{cue:stability}` battery, `{cue:trust}` bars, `{cue:lucidity}` Wi-Fi,
  `{cue:integrity}` clock), so they arrive one at a time as they're named.
- `REVEAL: scope on cue` / `REVEAL: instruments on cue` /
  `REVEAL: dock on cue` — kept off screen until a line reaches
  `{cue:scope}` (the two lines across the portrait), `{cue:instruments}`
  (the needle and the vectorscope), or the TRYCALL beat (the contacts dock).
  Used by the tutorial so the player meets one piece at a time.
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


## Cues inside text: {cue:name}

A `{cue:name}` tag fires a cue the moment the typewriter reaches that spot,
with no page break (if the page is revealed at once, pending cues fire in a
quick run). Today: `{cue:stability}`, `{cue:trust}`, `{cue:lucidity}`,
`{cue:integrity}` flash that status-bar icon, show its word and play its
blip. Used in the therapist's first reaction as he names each one.

## Cues inside text: {mark:name}

A `{mark:name}` tag inside a REACT starts a new page and fires a cue when that page comes up. Today: `{mark:lake}` brings the lake gauge in mid-reaction (with the spotlight moving to it) if a lie already put debt on the lake before its REVEAL turn. Used in the therapist's check-in lie reaction: he finishes the phone bars, then points at the lake.


## MASK (node)

`MASK: Feeling` on a node: the feeling the NPC shows (screen color,
oscilloscope) while `MOOD:` stays the real one that attunement needs.
Color the prompt's hint word in the real feeling. Used on Samun's and
Rick's first two questions.

## STORY (header)

`STORY: line`, repeatable, in the header: the cutscene the player earns by
connecting, one line per beat, in order, the same for every class. It plays
right after the CONNECT beat, with the NPC's bust up close and every sound
stopped; the sound fades back when it's over. Their words in quotes,
directions in [ ].

## STORYIT / STORYSO (header)

`STORYIT: line` and `STORYSO: line`, one each, in the header: what IT and
SO think, in the same silence, right after the STORY. IT weighs how true it
rings (a detail people don't invent); SO doubts one corner of it, never the
person, and ends on what still stands. No quotes (they're thoughts).

```
STORYIT: Seventeen. The bus stop. Five a.m. People don't invent the time of day.
STORYSO: Maybe the principal wasn't that cruel. Maybe it got harder every time she told it. ...Her mother still walked out.
```

## PUSHAWAY (header)

`PUSHAWAY [Guns|Bible|Crystals]: line`, one per class: the encounter ended
and they didn't come to trust the player. Same close-up as CONTACT, but cold:
they push the player away and say what they wish someone had done just now.
Color ONE word in the feeling that would have reached them; it's a hint, not
a grade. Write it to the class's habit (Guns braces, Bible holds on to the
right words, Crystals absorbs everything).

```
PUSHAWAY [Guns]: [She turns back to the window.] "You never put it down. Not once. I needed you to put it {color:Fear}down{/color}." "Go on. I've got a wall to finish."
```

## TRYCALL (outro)

`TRYCALL: "line"` inside `=== OUTRO`: the speaker's own contact pops into the dock (spotlit, pulsing) and the line waits for the player to tap it instead of tapping on. Tapping rings, connects, and his "Hello?" echoes back twice with feedback (the phone calling the phone it's on). The next LINE carries the joke. Used once, in the therapist's outro, to teach the contacts dock.

## WATCH (outro)

`WATCH [stability|trust|lucidity|integrity|lake|steady]: "line"` inside `=== OUTRO`: a parting watch-out. Add a class after the key (`WATCH [stability, Guns]:`) for a class's own version, and `[stability, Default]` for the no-class fallback. Write one per key; only one plays, picked by how the readings ended: `lake` if Truth Debt is 3 or more, else the lowest meter if it's 4 or below, else `steady`. Used by the therapist just before HANGUP.

## TRYNEAR / TRYFAR (outro)

`TRYNEAR [class]: "line"` and `TRYFAR [class]: "line"` inside `=== OUTRO`: what the speaker says while the player hunts for their feeling in a TRYFEEL step. TRYNEAR plays on a pick that's close on the wheel (a busy shape), TRYFAR on one that's far (the needle leaning left). They never play as beats of their own; the hint under the line still says what the shape means.

## TRYFEEL (outro)

`TRYFEEL [Guns|Bible|Crystals]: {feel:Feeling}"line"` inside `=== OUTRO`: the wheel comes back without a card and the line waits while the player tries feelings and watches the vectorscope. `{feel:X}` is the speaker's own feeling (never shown, and it must be on that class's wheel); picking it closes the vectorscope into a still circle, and only then does a tap go on. Describe the feeling, never name it. Optional tags: `{mask:Y}` makes the line wear Y's color while X stays what the shape answers to (on a match step, X then flickers underneath, as a battle mask does); `{want:miss}` turns the step around: any feeling but X moves on (to show what apart looks like), and picking X asks for a different one. The therapist's exercise is two steps: a `{want:miss}` step, then a find step.

## The intake read

A prompt containing `{intake}` (the therapist's first) shows the wheel asleep while he reads the player's evaluation: each feeling-colored word in the read lights its slice in turn, and the read closes on the class's evaluation sound. Nothing to author beyond `{intake}` itself.

## [Default] (outro condition)

`[Default]` in an outro condition (`LINE [Default]:`, `WATCH [lake, Default]:`) plays only when the player has no class (debug, a bare start). Use it as the fallback beside a trio of `[Guns]` / `[Bible]` / `[Crystals]` versions. `test:engine` checks that every class, and no class, gets exactly one of each Therapist mechanic step.
