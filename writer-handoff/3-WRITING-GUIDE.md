# 3 — Writing Guide

## How the format works

You write plain text. A build step turns it into what the game reads. You
never see that step — you just keep the labels intact.

A **node** is one screen: the character says something, the player picks
a feeling, swipes, and reads the reaction. Here's a real one, annotated:

```
=== deborah_01                      <- internal name. Never seen. Don't rename.
PROMPT: God took my boy when He needed him.
                                    <- ON SCREEN. What the player is answering.

-- TRUTH                            <- the LEFT swipe
SAY: Your faith didn't protect him. Someone failed him.
                                    <- ON SCREEN first, right after the swipe.
REACT: She flinches. Her bible shifts in her grip.
                                    <- ON SCREEN next. The payoff. Drawn letter by letter.
EFFECTS: integrity+2 stability-2    <- meters. Copy the pattern from nearby nodes.
DEBT: 0                             <- truths are always 0
NEXT: deborah_02_confronted         <- which node comes next. Don't invent names.

-- LIE                              <- the RIGHT swipe
SAY: God has a plan. He's at peace.
REACT: Her smile widens. Too wide. The wallpaper flickers green.
EFFECTS: integrity-2 stability+2 trust+1
DEBT: +4                            <- how big the lie is, 1 to 4
LEDGER: You told Deborah God took her son on purpose.
                                    <- read back to the player at the end
NEXT: deborah_02_denial
```

**The two lines that carry the scene are `PROMPT:` and `REACT:`.** If you
only rewrite two things per node, rewrite those.

### A few notes on the other fields

- **`SAY:`** — the player's line. Shows on screen right after the swipe
  (its own beat, before `REACT:` draws in) — write it as the actual thing
  they say, not a summary of it.
- **`DEBT:`** — only lies. `+1` is a deflection, `+2` avoids a hard
  moment, `+3` props up someone's story, `+4` reinforces the thing
  destroying them.
- **`LEDGER:`** — third person, past tense, names them, states the lie
  plainly. This exact sentence gets thrown back at the player later. If
  it doesn't sting out of context, delete the line.
- **`EFFECTS:`** — don't agonize. Copy a comparable node. Truth usually
  raises integrity and lucidity and costs stability; a lie usually does
  the reverse. `trust` is a judgment call per character — a comforting
  lie often *raises* it.

### Things that will break the build

- Renaming a `=== node_id` or pointing `NEXT:` at a name that doesn't
  exist.
- `EFFECTS: integrity + 2` — no spaces. It's `integrity+2`.
- Anything other than `-- TRUTH` and `-- LIE` as the swipe headers.
- A leftover `FEELZ:` line. That field is gone — if your copy of a script
  file still has them, delete them. It never did anything: which 3
  feelings the player gets is set once by the opening questionnaire and
  holds for the whole run, so it was never a per-node choice.

None of these are a big deal. The build names the file and line and we
fix it.

---

## Controlling the text draw

Text appears letter by letter. You control the pace inline, right in the
sentence.

| Type this | What happens |
| :-- | :-- |
| `{slow}some words{/slow}` | that stretch draws slowly |
| `{fast}some words{/fast}` | that stretch draws fast |
| `{pause:400}` | stops dead for 400 milliseconds, drawing nothing |
| *nothing* | normal speed — the default |

Rough feel for pauses: **250** is a hitch, **400** is a breath, **800**
is uncomfortable. Use them.

They combine:

```
{slow}Well.{/slow}{pause:400} You're not the church.
```

> "Well." crawls out, holds for four-tenths of a second, then the rest
> lands at normal speed.

### Where these codes work

| | Codes work? |
| :-- | :-- |
| `PROMPT:` and `REACT:` lines | **Yes** |
| Cutscenes, confrontations, room text (`script-extra/`) | **Yes** |
| Ending text | **Yes** |

`PROMPT:` now draws letter-by-letter same as everything else, so a
heavily-paced one does make the player wait a beat longer before they can
swipe — budget it like a cutscene beat, not a caption.

### Line breaks

Text wraps on its own. You only need a break when you want one the text
wouldn't have made — a stanza, a beat, a line standing alone.

- **In `script-extra/` files:** just hit Enter. Real line break.
- **In `script/` manuscript files:** type `\n` (backslash, then the
  letter n) right in the line, anywhere you want the break. `PROMPT:`,
  `SAY:`, and `REACT:` all support it.

---

## How much fits on screen

The screen is a phone. The font is fixed-width, so character counts are
exact. These are for the smallest common phone — the safe numbers.

| Where | Per line | Keep it to |
| :-- | --: | :-- |
| `PROMPT:` | 31 chars | **5 lines** (~155 characters) |
| `REACT:` | 31 chars | **4 lines** (~120 characters) |
| Cutscene beat | 27 chars | **6 lines** (~150 characters) |
| Room caption / intro | 31 chars | **3 lines** |
| Confrontation choice | 22 chars | **44 characters total** |
| Quick-beat prompt | 17 chars | **30 characters total** |
| `LEDGER:` | — | **one sentence** |

Don't count characters as you write. Use these instead:

- **A cutscene beat is one thought.** ~20–25 words.
- **A `REACT:` is one gesture, plus at most one line of speech.**
  *"She flinches. Her bible shifts in her grip."* is the length the game
  is built around.
- **If a beat wants to be longer, make it two beats.** Tapping is free.

One exception: the Bob Baiter ad is hand-wrapped to ~27 characters per
line on purpose, to get that stilted public-address cadence. Keep that.

---

## The thing you didn't write

After a swipe, the player reads your `REACT:` line, a blank line, and
then one more short line the game picks itself — based on which feeling
they chose. Like this:

> *She flinches. Her bible shifts in her grip.*
>
> *You got it out before you could take it back.*

The first line is yours. The second comes from a shared set of 16
(they're in `script-extra/5-codas.txt` if you want to rewrite them).

**So: write `REACT:` as what happened in the room, not how the player
felt about it.** The coda is already doing that job, and doubling up
reads as the game explaining itself twice.

---

## Voice checklist

- Does any line tell the player they were right or wrong? **Cut it.**
- Is the character relieved by the lie? They usually should be. The lies
  work — that's the point.
- Does the truth fix anything? It usually shouldn't. Truth buys clarity,
  not resolution.
- Is this a person talking, or a theme talking? Deborah says *"God took
  my boy,"* not *"faith is how I process grief."*
- Read it aloud at the length budget. Out of breath = too long.
