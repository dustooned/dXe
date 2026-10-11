# Character Art — the standard set

How every NPC avatar is drawn, named and played. One standard, so a new
character is just a new set of files. The game side is
`src/engine/characters.js`; the converter is `scripts/import-character-gifs.mjs`.

## How characters move (the rules)

Calm by default. The mouth moves **only** while their quoted words are being
typed.

| Moment | What you see |
| :-- | :-- |
| Nothing happening, narration, directions, a pause | **Rest:** their `idle` still, mouth shut (else frame 0 of the talk loop), held still. A character whose idle is a short loop (Samun) plays it once every 2.5 to 6.5 s, from frame 0, then settles. The mouth is shut in every frame of it. |
| Their quoted words are drawing | **Talk loop**, from frame 0, 100 ms a frame. Closes about 90 ms after the last quoted letter, at once on a pause. |
| Your turn to answer | **Wait:** their `wait_<feeling>` anticipation plays once and holds. |
| Your answer lands | **React:** `react_<kind>` plays once, a moment before they speak, then back to rest. |
| The game is paused | Everything freezes where it is. |

Every frame gets its full time (100 ms unless set otherwise). Narration and
`[stage directions]` never move the mouth.

## The standard (per NPC)

All **192 x 192**, 1-bit look (white and black pixel art), transparent
background, GIF or PNG. A state is a **still** (1 frame) or a **loop / one-shot**
(several frames, 10 fps = 100 ms a frame). Anything not drawn yet falls back,
so a character with only a talk loop already works everywhere (idle = frame 0
of the loop).

| State | What it is | Frames | Per NPC |
| :-- | :-- | :-- | :-- |
| `idle` | the rest face: a neutral still (mouth shut), **or a short loop** (eyes drifting, a blink; mouth shut in every frame). A loop rests on frame 0 and plays once every 2.5 to 6.5 seconds, then settles | 1, or a loop | 0-1 |
| `talk` | mouth moving; **frame 0 is the rest pose** | 3 loop | 1 |
| `talk_happy` `talk_trust` `talk_fear` `talk_surprise` `talk_sadness` `talk_disgust` `talk_anger` `talk_anxiety` | speaking in each feeling (falls back to `talk`) | 3 loop each | 8 |
| `wait_happy` ... `wait_anxiety` | on your turn, in their feeling: a short anticipation that plays once and holds its last frame (a 1-frame still is just held) | 1-4 each | 8 |
| `react_truth` | a true answer lands | 3-4, once | 1 |
| `react_lie` | a comforting lie lands | 3-4, once | 1 |
| `react_hit` | a big swing: they take your words | 3-4, once | 1 |
| `react_warm` | they turn toward you (a bid) | 3-4, once | 1 |
| `react_cold` | they close up | 3-4, once | 1 |
| `connect` | the stay-in-touch moment | 1 | 1 |
| `pushaway` | pushed away at the end | 1 | 1 |
| `trauma_1` ... `trauma_5` | the confession: one image per story beat, shown in silence | 1 each | 5 |

That is **about 30 pieces per NPC**, x4 NPCs (Deborah, Rwanda, Samun, Rick).
The Therapist is a voice first, so his set is optional beyond rest and talk
(he has a lot already, below).

**Trauma / confession images (proposed size):** 240 x 240, true pixels (the
game scales it up crisp, like the chapter plates). Say if you would rather they
match 192.

## Placeholders in: Deborah and Samun

Temporary art, wired the same way the final art will be.

| NPC | Has | How it plays |
| :-- | :-- | :-- |
| **Deborah** | `idle` (shut mouth, eyes open), `talk` (3 frames: shut, squint, open; frame 0 is the idle picture), plus `squint` and `open` kept as extra pieces (not a state yet) | Rests on `idle`. The talk loop plays only while her quoted words draw. |
| **Samun** | `idle`: a 9-frame loop (eyes wander, a blink), mouth shut throughout. No talk loop yet | Rests on frame 0, plays the whole loop every 2.5 to 6.5 s, settles. While he speaks his mouth does not move (no talk art), the glance keeps its own timing. |

Both came as GIFs; Samun's was drawn at 1920 x 1920, an exact 10x of 192, which
the importer verifies (nothing lost) and stores at the true 192 x 192.

## The Therapist (done)

He wears a different hat on each call. Per hat: three stills (`_1`, `_2`,
`_3`) and a talk loop. Hats: bunny, derby, fez, jester, old man, pork pie,
sombrero, top hat, plus bare-headed `neutral`. In the game: bare-headed in
the tutorial; a random hat on his "you again" call on a repeat playthrough.

Still to fix: `Fez_Hat02` is missing, and `Neutral_Hat03` is named like a hat
(it's read as `neutral_3`). `_1`, `_2`, `_3` are three poses; tell me what
each is and I'll name them (e.g. `_2` = eyes closed).

## The hat gags

His hats are a visual gag on his dry, neutral voice. He never mentions the hat.
It is always a little too appropriate. The game picks it from the moment
(`HAT_RULES` in `src/engine/characters.js`, first match wins, never the same
hat twice in a row, bare-headed when nothing fits, which is the baseline):

| Hat | When | The joke |
| :-- | :-- | :-- |
| sombrero | his voicemail | out of office, taking a siesta |
| sombrero | your Wi-Fi is fogged | a sun-struck siesta in the haze |
| jester | a masked feeling, or a lie streak (2+) | he is not laughing, the hat is |
| pork pie | the lake is dirty (debt 6+) | a noir detective on the case |
| old man | your battery is nearly empty (2 or less) | he is tired on your behalf |
| bunny | your Bars are low (3 or less) | he is gentle about it, which is funnier |
| fez | a new friend joins your phone | welcome to the club |
| derby | the first real battle | he is being professional about it |
| top hat | the lake is clean (debt 2 or less) | dressed for the occasion |

On his "you again" call, the hat is how you left the lake: clean = top hat,
damp = derby, soaked = old man, "a water-quality advisory" = pork pie.

His tutorial is where the gag is established: he starts bare-headed (the baseline) and each thing he explains gets its hat (battery old man, Bars bunny, Wi-Fi sombrero, clock derby, the lake pork pie, masks and lies jester, contacts fez, homework top hat), rapid-fire on the meters page. See `TUTORIAL_HATS` in `src/engine/characters.js`. His
face is on every phone call: coach calls, your calls to him, his voicemail, and
the repeat-playthrough call. Add a hat rule by adding a line to `HAT_RULES`
(and a test).

## Sending art

1. Name each GIF `Profile_<Npc>_<State>.gif`, e.g. `Profile_Deborah_Wait_Anger.gif`,
   `Profile_Deborah_React_Lie.gif`, `Profile_Deborah_Trauma_3.gif`. The talk loop is
   `Profile_Deborah_Talk.gif` (or `Profile_Deborah_Ani.gif`).
2. Put them in a folder, then run:
   `node scripts/import-character-gifs.mjs <folder> <npc>`
   Files with their own names (`Samunneutral.gif`, `Profile_Deborah01.gif`): put a
   `names.json` in the folder, `{"Samunneutral.gif": "idle"}`, mapping each file to
   its state. Anything that is not a standard state name is kept as an extra piece.
   A GIF drawn at a whole multiple of 192 (1920 x 1920) is fine.
3. It writes the frames to `public/assets/lake-ulysses/characters/<npc>/`,
   a manifest to `src/chapters/lake-ulysses/characters/<npc>.json`, and warns
   about any file that isn't 192 × 192. The game picks them up automatically.

Palette PNG frames (not WebP): smaller for 1-bit art and pixel-exact.
