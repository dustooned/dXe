# Script Key — the writer's quick reference

The one page to keep open while editing dialog. It answers three
questions fast:

1. **Where does this line live?** (§1 — the file map)
2. **What slot am I filling, and what's it for?** (§2 — the rhythm)
3. **What codes can I type in it, and how long can it be?** (§3–4)

Everything here is a *reference*. If you want the exhaustive
field-by-field spec and the list of things that will break the build, use
[`SCRIPT_FORMAT.md`](SCRIPT_FORMAT.md). If you want to know what the
game *is* first, read [`GAME_MANUAL.md`](GAME_MANUAL.md).

**Nothing here is written from scratch.** Every line the game currently
says already exists as placeholder or draft text in the files below. The
job is to open the file, find the slot, and replace the words — the
structure, the branching, and the numbers are already wired.

---

## 1. Where every line in Chapter 1 lives

| What you want to rewrite | File | Format |
| :-- | :-- | :-- |
| **NPC dialog** (prompts, responses, reactions) | `src/chapters/lake-ulysses/manuscript/<npc>.txt` | manuscript ✅ |
| Opening quote / Bob Baiter ad / Prologue | `src/chapters/lake-ulysses/content/{opening_quote,bob_baiter,prologue}.json` | JSON |
| Confrontation scenes (the 3-way opener choice) | `src/chapters/lake-ulysses/content/confront_<npc>.json` | JSON |
| Mini-game room intros & object captions | `src/chapters/lake-ulysses/minigames/<npc>-<place>.js` | JS |
| Ending text + epilogue lines | `src/chapters/lake-ulysses/content/endings.json` | JSON |
| The Questionnaire's 3 questions + diagnoses | `src/scenes/questionnaireScene.js` | JS |
| Post-swipe emotion "codas" (shared, all NPCs) | `src/engine/reactions.js` | JS |

✅ = the writer-friendly plain-text pipeline. Only the manuscript files
use it today; everything else is JSON or JS, and you're editing text
inside quote marks. That's a known limitation, not a preference — see
`SCRIPT_FORMAT.md`'s last section.

**After editing any `manuscript/*.txt`, run this once:**

```bash
npm run build:content
```

That regenerates the matching `content/*.json` the game actually reads.
Commit both files together. Editing a `.json` or `.js` file directly
needs no build step. If the command prints an error, it names the file
and line number it couldn't understand — that's the whole error, nothing
else is broken.

---

## 2. The rhythm — what slot does what

### One NPC node = one screen the player is on

A **node** is one exchange. The player sees a prompt, picks a feeling,
swipes, reads a reaction, and moves to the next node. Every node has
exactly two outcomes, and every line has a fixed job:

```
=== deborah_01                     ← internal id, never seen by a player
PROMPT: <the NPC's line>           ← ON SCREEN. What the player is answering.

-- TRUTH                           ← the LEFT swipe
SAY:    <the player's line>        ← ON SCREEN first, right-aligned, labeled YOU
REACT:  <how the NPC takes it>     ← ON SCREEN next, drawn letter by letter
EFFECTS: integrity+2 stability-2   ← meter movement
DEBT:   0                          ← Truth Debt (truths are ~always 0)
NEXT:   deborah_02_confronted      ← which node follows, or (end)

-- LIE                             ← the RIGHT swipe
SAY:    <the player's line>
REACT:  <how the NPC takes it>
EFFECTS: integrity-2 stability+2 trust+1
DEBT:   +4                         ← the size of the lie, 1 (small) to 4 (big)
TAGS:   Faith, Health              ← optional, groups lies by theme
LEDGER: You told Deborah God took her son on purpose.
                                   ← optional. Third person, past tense.
                                     This is the line thrown back at the
                                     player in the Reckoning. Only write one
                                     if the lie deserves to be remembered.
NEXT:   deborah_02_denial
```

**The two lines that carry the whole beat are `PROMPT:` and `REACT:`.**
`PROMPT:` sets the moment; `REACT:` is the payoff the player actually
sits and reads. If you only have time to rewrite two lines per node,
rewrite those.

### The reaction gets a second half you don't write

After a swipe, the screen shows your `REACT:` line, a blank line, then
one short **coda** pulled from a shared table in `src/engine/reactions.js`
— keyed by whichever feeling the player picked and which way they swiped
(8 feelings × truth/lie = 16 lines, covering the entire game). Example:

> *She flinches. Her bible shifts in her grip.*
>
> *You got it out before you could take it back.*

The first line is yours. The second is the table's. So: **write `REACT:`
as what happened in the room, never as how the player felt about it** —
the coda is already covering that, and doubling up reads as the game
explaining itself twice.

Codas describe *delivery* — how the line left you. **They never grade the
choice**, and neither should a `REACT:`. No line in this game tells the
player they did well or badly.

### An NPC's full tree

Every NPC in Chapter 1 is the same shape. Three openers, two middles,
done:

```
      confrontation choice picks ONE of these three openers
      ┌──────────────┬──────────────────┬─────────────────┐
      │  <npc>_01    │  <npc>_01_soft   │  <npc>_01_hard  │
      │  (neutral)   │  (warm approach) │  (blunt)        │
      └──────┬───────┴────────┬─────────┴────────┬────────┘
             │ truth / lie    │ truth / lie      │ truth / lie
             ▼                ▼                  ▼
     ┌────────────────────┐   ┌──────────────────────┐
     │ <npc>_02_confronted│   │ <npc>_02_denial      │  (names vary
     │ (you pushed)       │   │ /_enabled /_closed   │   per NPC)
     └─────────┬──────────┘   └──────────┬───────────┘
               │ truth / lie             │ truth / lie
               ▼                         ▼
             (end)                     (end)
```

Same character, same wound, three angles of approach. **The `_soft` and
`_hard` openers are not different scenes** — they're the same
conversation started from a different footing, and they converge on the
same two middles.

### The chapter's rhythm around all this

```
Prologue → Questionnaire → Therapist          ← one continuous "opening call"
[ walk → confrontation → NPC dialog ] × 4     ← Deborah, Rwanda, Samun, Rick
Reckoning → Ending
```

Full detail on each beat is in [`GAME_MANUAL.md`](GAME_MANUAL.md) §4.

---

## 3. The code key

These are typed **inline, inside the text itself**. Everything else on a
line is prose.

| Code | Does | Speed |
| :-- | :-- | :-- |
| `{slow}…{/slow}` | Draws this stretch slowly. For a held moment, a word landing hard. | ~2.6× slower |
| `{fast}…{/fast}` | Draws this stretch fast. For panic, a rush, a brush-off. | ~3× faster |
| *(no code)* | Normal draw speed — the default for everything. | ~28ms/char |
| `{pause:N}` | Stops dead for **N milliseconds**, drawing nothing. A beat of silence. `{pause:400}` is a comfortable breath; `{pause:250}` is a hitch; `{pause:800}` is a long, uncomfortable one. | — |
| `\n` | **Line break.** Type it literally (backslash, then n) — in JSON files and in manuscript `PROMPT:`/`SAY:`/`REACT:` fields alike. Two in a row (`\n\n`) makes a stanza break. | — |

Codes can nest and combine freely:

```
{slow}Well.{/slow}{pause:400} You're not the church.
```

> Draws "Well." slowly, holds on it for four-tenths of a second, then
> delivers the rest at normal speed.

**Where each code works today** — this matters, and it isn't uniform:

| Slot | Drawn letter-by-letter? | `{slow}`/`{fast}`/`{pause}` | `\n` line break |
| :-- | :-- | :-- | :-- |
| Cutscene `text` (JSON) | ✅ yes | ✅ works | ✅ works |
| Mini-game room intros & captions (JS) | ✅ yes | ✅ works | ✅ works |
| Ending body text (JSON) | ✅ yes | ✅ works | ✅ works |
| Dialog **`PROMPT:`** (manuscript) | ✅ yes | ✅ works | ✅ works |
| Dialog **`SAY:`** (manuscript) | ✅ yes | ✅ works | ✅ works |
| Dialog **`REACT:`** (manuscript) | ✅ yes | ✅ works | ✅ works |
| Reckoning card text | ❌ appears at once | ❌ ignored | ❌ ignored |

Every slot above except the Reckoning card now behaves identically —
character-by-character draw, pacing codes, and `\n` line breaks all work
the same whether you're writing JSON or a manuscript field.

### Stanza breaks you get for free

You don't have to hand-wrap prose. Text wraps automatically at word
boundaries and never breaks mid-word. You only need `\n` when you want a
break the text *wouldn't* have made on its own — a beat, a stanza, a
line of dialogue standing alone.

The one place hand-wrapping is the house style is the **Bob Baiter ad**,
where each beat is 2–4 short hand-broken lines to give it that stilted
civic-announcement cadence. That's a deliberate voice choice, not a
requirement.

---

## 4. How much text fits

Measured in the running game, not estimated. The font is a fixed-width
pixel font at a fixed size, so **one character is always one slot** —
counting characters is exact.

The canvas is a portrait rectangle that scales to the player's screen,
but the *text* doesn't scale with it — so a smaller phone fits fewer
characters per line. The numbers below are for the **narrowest common
phone (320px)**, i.e. the safe budget. Wider screens fit more and will
simply wrap differently; nothing breaks.

| Slot | Chars per line | Lines that fit | Practical budget |
| :-- | :-- | :-- | :-- |
| **Cutscene beat** (`text`) | **27** | 8 hard max | **≤ 6 lines** (~150 chars). Past 6 the box starts covering the character's face. |
| **Dialog `PROMPT:`** | **31** | 11 hard max | **≤ 5 lines** (~155 chars). Longer prompts push the swipe card down. |
| **Dialog `REACT:`** | **31** | 25 hard max | **≤ 4 lines** (~120 chars) — *and remember the coda adds 1–2 more.* Plenty of room; the limit here is pacing, not pixels. |
| **Mini-game room intro / caption** | **31** | many | **≤ 3 lines** (~90 chars). An inner thought, not a paragraph. |
| **`LEDGER:` line** | **31** | — | **One sentence.** It has to read as an accusation on a card. |
| **Confrontation choice label** | **22** *(bigger font)* | 2 | **≤ 44 chars total.** Existing labels run 25–34 and wrap to two lines — that's the house length. |
| **Quick-beat prompt** (mini-game gimmick) | **17** *(biggest font)* | 2 | **≤ 30 chars total**, and the game adds a `←`/`→` arrow itself, eating ~3. `THE SMELL — GET PAST IT` is exactly right. |

Rules of thumb, if you don't want to count:

- **A cutscene beat is one thought.** Roughly 20–25 words.
- **A `REACT:` is one gesture plus, at most, one line of speech.** Look
  at the existing ones — *"She flinches. Her bible shifts in her grip."*
  is the length the game is built around.
- **When a beat wants to be longer, split it into two beats.** Tapping is
  free; a wall of text isn't. This is a game read on a phone in one
  thumb.

---

## 5. Four things that used to trip people up (now fixed)

These were open questions/limitations as of the last writing pass. All
four are resolved now — noted here so an older memory of this doc
doesn't steer you wrong.

1. **`FEELZ:` is gone from the format.** If you have a file open with
   `FEELZ:` lines in it, delete them — the build now rejects the line
   rather than accepting it. It never did anything: every node in the
   chapter carried the identical list, and the game reads none of it.
   Which 3 feelings the player can pick from is set once by the opening
   Questionnaire (their class) and holds for the entire run, so it was
   never a per-node choice to make.

2. **`SAY:` lines now show on screen.** Right after a swipe, the player
   sees your `SAY:` line (right-aligned, labeled `YOU`), taps, then
   `REACT:` draws in. Nothing about how you write `SAY:` changed — same
   field, same job — only the display caught up to it.

3. **`PROMPT:` now draws letter-by-letter**, same as everything else, so
   `{slow}`/`{fast}`/`{pause:N}` work there too (§3). The card and FEELZ
   wheel stay hidden until the prompt finishes drawing (or the player taps
   to finish it early) — so a heavily-paced `PROMPT:` does make the player
   wait a beat longer before they can respond. Budget it the way you'd
   budget a cutscene beat.

4. **Line breaks now work inside a manuscript line.** Type `\n` (§3)
   anywhere in `PROMPT:`/`SAY:`/`REACT:` for a break the text wouldn't
   have wrapped on its own.

---

## 6. The fill-in template

Copy this into a manuscript file and replace the angle brackets. Every
line marked *(optional)* can be deleted entirely — don't leave it blank.

```
NPC: <NAME IN CAPS>
LOCATION: <number — which stop in the chapter>
ACCENT: var(--color-<name>)
PORTRAIT: <path to a portrait image>                   (optional — omit until real art exists)

=== <npc>_01
PROMPT: <the NPC's opening line — ≤ 5 short lines>

-- TRUTH
SAY: <what the player says — the honest, costly version>
REACT: <what the NPC does. One gesture. ≤ 4 lines.>
EFFECTS: integrity+2 lucidity+1 stability-2
DEBT: 0
NEXT: <npc>_02_confronted

-- LIE
SAY: <what the player says — the comfortable version>
REACT: <what the NPC does. Relief, usually. Something sealing over.>
EFFECTS: integrity-2 stability+2 trust+1
DEBT: +3
TAGS: <Theme, Theme>                                   (optional)
LEDGER: You told <NPC> <the lie, in past tense>.       (optional)
NEXT: <npc>_02_denial
```

### Picking the numbers

You mostly won't need to invent these — copy the pattern from a
comparable node. But for reference:

**`DEBT:`** — only lies add debt. The scale is 1–4 and it's about how
much the lie *costs someone else*, not how false it is:

| Value | Means | Example from the chapter |
| :-- | :-- | :-- |
| `0` | The truth. | every `-- TRUTH` block in the game |
| `+1` | Barely a lie. A deflection. | "I don't remember the dream." |
| `+2` | A small lie to avoid a hard moment. | backing off a question you already asked |
| `+3` | A real lie that props up someone's story. | "It's not that bad here. You're doing fine." |
| `+4` | The big one. Reinforces the thing destroying them. | "God has a plan. He's at peace." |

**`EFFECTS:`** — four meters, each `name+N` or `name-N`, no spaces,
space-separated. Omit any meter the choice doesn't touch. Typical swings
are 1–3.

| Meter | Rises when… | Falls when… |
| :-- | :-- | :-- |
| `integrity` | you're honest with yourself | you aren't |
| `lucidity` | you see the situation clearly *(truths only, basically)* | rarely moves on lies |
| `stability` | the moment gets smoothed over *(lies)* | something cracks open *(truths)* |
| `trust` | **judgment call — this one is per-NPC.** A comforting lie often *raises* it; an unwelcome truth often lowers it. Decide by how this specific person would react. | |

**`LEDGER:`** — third person, past tense, names the NPC, states the lie
plainly. This exact sentence is what the game shows the player at the
end and asks them to confess or double down on. If it doesn't sting to
read out of context, it isn't a ledger line — delete it.

---

## 7. Voice checks before you commit

- Does any line tell the player they were **right or wrong**? Cut it.
  Describe cost, weight, or what changed in the room — never a verdict.
- Is the NPC **relieved** by the lie? They usually should be. The lies in
  this game work; that's what makes them expensive.
- Does the truth **fix** anything? It usually shouldn't. Truth here buys
  clarity, not resolution — "he doesn't argue. That's something."
- Is the line a **person talking**, or a theme talking? Deborah says
  "God took my boy when He needed him," not "faith is how I process
  grief."
- Read it out loud at the length budget. If you ran out of breath, it's
  too long for the box.

---

## Related docs

- [`GAME_MANUAL.md`](GAME_MANUAL.md) — what the game is, how it plays,
  the full cast and chapter breakdown. **Read once before writing.**
- [`SCRIPT_FORMAT.md`](SCRIPT_FORMAT.md) — the exhaustive manuscript spec
  and the rules that fail the build on purpose.
- [`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md) — what the generated JSON
  looks like, and the full narrative meaning of each meter.
- [`SCENE_TYPES.md`](SCENE_TYPES.md) — how cutscenes, confrontations, and
  mini-games are structured, if you're writing one of those.
- [`docs/manual.html`](manual.html) — every doc as one searchable page.
