# Dream Xtreme — Writer Pack

Everything you need to write for Chapter 1. Read the three docs in order,
then start editing files in `script/`.

## What's in here

```
1-THE-GAME.md        What the game is and how it plays.      ~5 min
2-THE-CAST.md        Who the characters are.                 ~5 min
3-WRITING-GUIDE.md   How to write it. The format + codes.    ~10 min

script/              THE MAIN JOB. 5 files, all NPC dialog.
                     Edit these directly — they compile straight into the game.

script-extra/        Everything else — cutscenes, endings, room text.
                     Same idea, but these get merged back by hand.
```

## How to work

1. Open a file in `script/`. It's plain text — Notepad, TextEdit, VS Code,
   anything. Not Word.
2. Replace the words. Leave the structure and the labels (`PROMPT:`,
   `SAY:`, etc.) exactly as they are.
3. Save. Send the file back.

That's it. You never touch code, and nothing you do here can break the
game — if a line is malformed, the build says which file and which line
number, and we fix it in a second.

## What's placeholder vs. real

Some of this is drafted and some is scaffolding written to make the code
work. **Anything marked PLACEHOLDER at the top of a file is fully open** —
rewrite it however you want.

| | Status |
| :-- | :-- |
| Opening cutscenes (quote, Bob Baiter, prologue) | Drafted, close to final |
| Therapist + the main NPC exchanges | Drafted, open to passes |
| Endings | Drafted |
| **Room text (`3-rooms.txt`)** | **Placeholder — rewrite freely** |
| **Confrontations (`2-confrontations.txt`)** | **Placeholder — rewrite freely** |
| **Reaction codas (`5-codas.txt`)** | **Placeholder — rewrite freely** |
| **The `_soft` / `_hard` nodes in `script/`** | **Placeholder — rewrite freely** |

## The one rule

**Nothing in this game tells the player they were right or wrong.**

No line congratulates them for the truth or punishes them for a lie. The
lies work — that's what makes them cost something later. Write what the
choice bought and what it cost, never a verdict.

## Questions

Anything unclear, ask — don't guess and don't work around it. If the
format is fighting you, that's a bug in the format, not in you.
