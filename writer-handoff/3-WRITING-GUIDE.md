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
- **`MOOD:`** — how they feel *right now*, as one of the 8 feelings. The
  screen turns that color. Think of it as the stage lighting for the line.
- After changing any `MOOD:` or `BID:`, ask the developer to run `node scripts/balance-check.mjs`: it shows whether every class can still earn each character's trust.
- **`BID:`** — mark the moment they hand you something fragile. Which
  answer meets it: `truth`, `lie`, or `both` (a kind lie can meet
  someone). Meeting a bid is how the player earns their trust and a new
  feeling. One or two per character; more and they stop feeling special.
- **`IF PICK Feeling:`** — an extra opening beat when the player walked
  in with that feeling. Short. It's a flicker of them noticing you.
- **`CONNECT [Class]:`** — the payoff when they trust you. Two or three
  sentences: something they've never told anyone, or a gesture instead of
  words. Written three times, once per class, because they're letting in
  a different person each time.
- **`CONTACT [Class]:`** — how they ask to stay in touch, at the very end
  if they trust you. One or two sentences, in character: Deborah writes
  her number on your hand; Rick doesn't ask, he takes your phone.
- **`CONTRADICTS: node_id=truth|lie`** — under an answer that contradicts
  something the player said earlier. Another character's node: word
  travels, IT quotes the earlier line. The same character's node: they
  heard both, and call it out themselves (costs more trust). Only write
  truth-then-lie pairs; owning up later should never be punished.
- **`CAUGHT [node_id]: "line"`** — what this character says when they
  catch the player contradicting what they told *them*. One sentence, in
  their voice, quoting the earlier answer back if you can ("On my porch you
  said faith didn't save him. Now he's at peace?"). No CAUGHT line = their
  stock fallback plays.
- **`{cue:stability}` / `{cue:trust}` / `{cue:lucidity}` / `{cue:integrity}`**
  inside a line — as the text reaches it, that phone icon (battery / bars /
  Wi-Fi / clock) flashes, shows its word and plays its sound. Put it right
  before the word that names the icon.
- **`{mark:lake}`** inside a REACT — starts a new page and brings the lake
  gauge in right there (used once: the therapist pointing at the lake after
  a lie on the check-in). Ask before inventing new marks; each needs code.
- **`TRYCALL: "line"`** (OUTRO only) — the speaker's own contact pops into
  the phone dock and the line waits for the player to tap it. Used once, to
  teach calling in the therapist's outro.

Write **FEELZ** in caps and it shows in the logo colors on its own; no color codes needed.

### Character voices (one word each)

Every character barks a single word in SAM, the 1982 talking-computer
voice, never a reading of your text. The words live in
`src/shell/voices.js` (ask the developer to change them). Each character
has: a reaction for an answer that landed well / badly / neither, a phone
greeting and goodbye, and (once they trust you) a farewell. Write lines
that leave room for that bark: a REACT that opens on a sound ("Mm.",
"Ha!") will double up with it.

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
- **Over ~140 characters, the game pages it for you**, breaking at the
  end of a sentence. So a long line won't overflow, but you don't control
  where the break lands. Two beats still reads better.

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
