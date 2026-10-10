# Character Art — the standard set

How every NPC avatar is drawn, named and played. One standard, so a new
character is just a new set of files. The game side is
`src/engine/characters.js`; the converter is `scripts/import-character-gifs.mjs`.

## The standard (per NPC)

All **192 × 192**, 1-bit look (white and black pixel art), transparent
background, GIF or PNG. A state is a **still** (1 frame) or a **loop**
(several frames, 10 fps = 100 ms a frame). Anything not drawn yet falls back
to *idle*, so a character with only idle and talk already works everywhere.

| State | What it is | Frames | Per NPC |
| :-- | :-- | :-- | :-- |
| `idle` | neutral, listening | 1 | 1 |
| `talk` | mouth moving, plays while they speak | 3 loop | 1 |
| `feel_happy` `feel_trust` `feel_fear` `feel_surprise` `feel_sadness` `feel_disgust` `feel_anger` `feel_anxiety` | how they feel right now (their MOOD): the face the oscilloscope color goes with | 1 each | 8 |
| `react_truth` | a true answer lands | 1 | 1 |
| `react_lie` | a comforting lie lands | 1 | 1 |
| `react_hit` | a big swing (strong hit) | 1 | 1 |
| `react_warm` | they turn toward you (a bid) | 1 | 1 |
| `react_cold` | they close up | 1 | 1 |
| `connect` | the stay-in-touch moment | 1 | 1 |
| `pushaway` | pushed away at the end | 1 | 1 |
| `trauma_1` … `trauma_5` | the confession: one image per story beat, shown in silence | 1 each | 5 |

That is **24 images per NPC**, ×4 NPCs (Deborah, Rwanda, Samun, Rick) = 96.
The Therapist is a voice first, so his set is optional beyond idle and talk
(he has a lot already, below).

**Trauma / confession images (proposed size):** 240 × 240, true pixels (the
game scales it up crisp, like the chapter plates). They are the bigger,
quieter picture under each story line. Say if you'd rather they match 192.

## The Therapist (done)

He wears a different hat on each call. Per hat: three stills (`_1`, `_2`,
`_3`) and a talk loop. Hats: bunny, derby, fez, jester, old man, pork pie,
sombrero, top hat, plus bare-headed `neutral`. In the game: bare-headed in
the tutorial; a random hat on his "you again" call on a repeat playthrough.

Still to fix: `Fez_Hat02` is missing, and `Neutral_Hat03` is named like a hat
(it's read as `neutral_3`). `_1`, `_2`, `_3` are three poses; tell me what
each is and I'll name them (e.g. `_2` = eyes closed).

## Sending art

1. Name each GIF `Profile_<Npc>_<State>.gif`, e.g. `Profile_Deborah_Feel_Anger.gif`,
   `Profile_Deborah_React_Lie.gif`, `Profile_Deborah_Trauma_3.gif`. The talk loop is
   `Profile_Deborah_Talk.gif` (or `Profile_Deborah_Ani.gif`).
2. Put them in a folder, then run:
   `node scripts/import-character-gifs.mjs <folder> <npc>`
3. It writes the frames to `public/assets/lake-ulysses/characters/<npc>/`,
   a manifest to `src/chapters/lake-ulysses/characters/<npc>.json`, and warns
   about any file that isn't 192 × 192. The game picks them up automatically.

Palette PNG frames (not WebP): smaller for 1-bit art and pixel-exact.
