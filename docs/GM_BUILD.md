# GameMaker Beta Reference

Last updated: 2026-07-18. Documents what was built in the GameMaker edition
of Dream Xtreme and what can be ported or referenced in the current web build.
Source files live at `E:\2025\Games\BackUp\`.

---

## Source Projects (Ranked by Completeness)

| Project | Path | What it is |
|---|---|---|
| **beta** (most content) | `11_18_2025/DreamXtremeDemo/beta/` | Full 8-room game, all NPC/dialog content |
| **1_28_2025** (most recent) | `1_28_2025/GM/DreamXtremeDemo/` | Latest save, but stripped to opening sequence only |
| **MK2** (cleanest arch) | `11_18_2025/DreamXtremeDemo/beta 3/DxE_MK2/` | 3 rooms, save system, JSON loader, almost no content |

Use **beta** as the content reference. Use **MK2** as the architecture reference.

---

## Room Sequence (beta — the canonical game flow)

1. **rm_inkflo_logo** — inkflo Studios logo splash. Jingle plays; auto-transitions when audio ends.
2. **rm_title_screen** — Title screen. DreamXtreme logo art, lake ambience, click-to-start.
3. **rm_OpeningQuote** — James Toback quote in typewriter font. "Next" appears when done.
4. **rm_IntroCS_001** — Lake background. Bob Baiter silhouette + 19-slide public announcement + animated symbols.
5. **rm_001_grandmas_house** — Grandma's house, scene 1. Dream narration. Clickable TV triggers transition.
6. **rm_002_grandmas_house** — Grandma's house, scene 2. TV starts on static. Player turns knob → Channel 69 → TVLAND.
7. **rm_gh003** — Empty black room. Placeholder for TVLAND (never built).
8. **rm_main_menu** — Black screen, Quit only.

---

## Story Content (verbatim from GML files)

### Opening Quote Screen

Displays in typewriter font (FAKERECIEPT face), variable speed per section:

> "I think that there's probably a revelatory experience awaiting everyone
> that has to do with finding out who and what you really are.
> I think that when that occurs, if it occurs, you reach Nirvana-Heaven
> and the degree to which you don't reach that place of realization...
> ...you are in eternal hell."
>
> — James Toback, Oscar Nominated Screenwriter
> Alleged Predator

The "Alleged Predator" line is intentional — the quote is given and then
immediately undercut by who said it. Strong tonal statement.

### Bob Baiter's Public Announcement (19 slides, rm_IntroCS_001)

Bob Baiter: Lake Ulysses councilman, corrupt local politician, bait shop owner.
Delivered as a monologue with animated symbols appearing mid-speech.

1. "Ladies and Gentlemen! I'm / Lake Ulysses councilman Bob Baiter!"
2. "It's my pleasure to announce after nearly a decade, / boating and fishing are once again"
3. "permitted throughout our beautiful / three thousand acre jewel!"
4. "City council has been carefully / monitoring toxicity levels"
5. "With recent rains and cooler temperatures / We are pleased to report that"
6. "State regional water boards / have deemed Lake Ulysses as acceptable!"
7. "You know what that means! / Your family and friends are"
8. "Legally allowed to return / To our blue pride and joy!" *(biohazard symbol appears)*
9. "Families are advised not to / drink the water" *(biohazard symbol)*
10. "or allow your pets to / enter the lake." *(pets symbol)*
11. "Pregnant women are cautioned / to keep their skin covered / at all times." *(exposure symbol)*
12. "And most importantly"
13. "Give your catch of the day / A good scrubbin' with / Some fresh bottled water!" *(fish symbol)*
14. "NOW AVAILABLE AT MY SHOP!" *(baitshop symbol)*
15. "From live bait to / the latest fishing gear!"
16. "We've got you covered!"
17. "Whether you're local / or just passin' by"
18. "Welcome back Lake Ulysses!"
19. "now let's go enjoy / our watery playground!"

The symbol system is a `dialog_index → sprite` lookup — port this to a
`slideIndex → symbol` object in JS.

### Grandma's House Narration (rm_001_grandmas_house)

Screenplay-style typewriter, two groups:

**Group 1:**
> "It was a good dream"
> "curled up on the good couch"
> "in the den of your good grandma"

**Group 2:**
> "The one who didn't smell like smoke and chicken shit."

### MK2 Intro Lines (auto-advancing, three paragraphs)

These read as `IT` speaking before the player knows who they're talking to:

> "You're probably wondering where you are."
> "Or... maybe you're not wondering at all."
> "Either way, you're stuck with me."

---

## Characters

### Bob Baiter
- Role: Corrupt local politician / bait shop owner
- Appearance: Silhouette sprite (spr_bb), custom silhouette shader, fades in over 3 seconds
- Function: Monologue-only. Not interactive. Sets up the world before the player has agency.
- Status: Full 19-slide speech written. Art exists (spr_bb silhouette + BobBaiter.png flat).

### IT
- Role: Unknown entity the player encounters in TVLAND
- Appearance: Distinct dialog box sprite (spr_dialog_it), distinct font (fnt_it), distinct typewriter sound (snd_it)
- Function: Speaker in the two-speaker dialog system (PLAYER / IT)
- Status: Full speaker architecture built. Zero dialog content written. TVLAND room is a black stub.

### The Player (unnamed)
- Appears as speaker "PLAYER" in the dialog box system
- No visual — only a dialog box and voice

---

## Dialog System (how it works in GML)

Three implementations, all using the same core pattern:

```
text_progress += speed   (each Step)
displayed = string_copy(full_text, 1, floor(text_progress))
if text_progress >= string_length(full_text) → show "continue" indicator
click → advance slide
double-click → skip to end of current slide
```

**Bob Baiter (2D array):** `dialog[slide][line]`. Lines joined with `\n`. Per-character sound plays every other character.

**Dream narration (2D array, screenplay style):** Same pattern but uses typewriter sound with random pitch (0.8–1.2) for texture.

**Room 2 dialog (external injection):** `scr_dialog_start(text, speaker, x, y)` initializes the box. Speaker name determines font/sprite/sound. This is the cleanest pattern for the web port.

Web port target: `createDialogBox({ text, speaker, onComplete })` where speaker
is `'PLAYER'` or `'IT'` (or any future speaker key).

---

## Symbol System

In rm_IntroCS_001, symbols appear mid-speech overlaid on the scene. The mapping
is dialog slide index → sprite:

| Slide | Symbol |
|-------|--------|
| 8 | biohazard |
| 9 | biohazard |
| 10 | pets |
| 11 | exposure |
| 12–13 | fish |
| 14 | baitshop |

Web port: an object `{ 8: 'biohazard', 9: 'biohazard', 10: 'pets', ... }` checked
at the start of each slide render.

---

## Audio Map

| Room | Track | File | Loop |
|------|-------|------|------|
| Logo | Inkflo jingle | `inkflogfx_final.wav` | no |
| Title | Title music | `snd_titlemusic.wav` | yes |
| Title | Lake ambience | `snd_lake_title.wav` | yes |
| Title | Start click | `snd_start!!.wav` | no |
| Intro CS | Lake music | `LK_01.mp3` | yes |
| Intro CS | Lake ambience | `snd_lake_title.wav` | yes |
| Intro CS | BB dialog tick | `snd_text_bb.wav` | no |
| Intro CS | End sting | `snd_tyagl.wav` | no |
| GH Room 1 | Room music | `snd_gh_001_music.wav` | yes |
| GH Room 1 | Typewriter tick | `snd_typewriter.wav` | no |
| GH Room 1 | TV inactive hum | `snd_tv_gh_001_ia.wav` | yes |
| GH Room 1 | TV active hum | `snd_tv_gh_001_a.wav` | yes |
| GH Room 2 | TV static | `snd_tv_static_gh002.wav` | yes |
| GH Room 2 | TV glitch | `snd_tv_technocough_gh002.wav` | no |
| GH Room 2 | Channel 69 | `snd_gh002_tv_ch69.wav` | yes |
| GH Room 2 | Dialog tick (player) | `snd_dialog_typewriter.wav` | no |
| GH Room 2 | Dialog tick (IT) | `snd_it.wav` | no |

---

## MK2 Architecture Patterns (use these as reference)

**Save system** — binary buffer in GM, localStorage in web:
```js
// GM: buffer_u32 storing room ID
// Web equivalent:
localStorage.setItem('dxe_save', JSON.stringify({ hasFile: true, lastRoom: 'rm_gh_001' }))
```

**Event system stub** (`scr_trigger_event`):
```js
{ sound: 'snd_x', text: '...', nextRoom: 'rm_x' }
```
Directly maps to the web build's scene sequencer event object pattern.

**scr_load_json** — established the pattern for external dialog data. Already
implemented in the web build via the manuscript pipeline.

---

## What Isn't Built Yet (planned but stubbed)

- **TVLAND** — rm_gh003 is a black room. No content, no objects. The TV knob interaction leads here but nothing exists on the other side.
- **IT dialog** — the speaker framework exists but zero lines are written.
- **"Highway" location** — music exists (`Highway_v1 (mastered).mp3`) but no room, no content, not referenced anywhere in the GML.
- **Grandma's House Room 2 dialog** — the PLAYER/IT dialog box is built, `scr_dialog_start()` is defined, but no content is authored into the room.

---

## What Maps to the Current Web Build

| GM element | Web build equivalent |
|---|---|
| rm_OpeningQuote | Could become the first cutscene beat before the Therapist questionnaire |
| Bob Baiter intro | New cutscene scene before the prologue — sets up why Lake Ulysses matters |
| GH narration text | New chapter or cutscene content |
| snd_lk01 / LK_01.mp3 | Direct replacement for placeholder Lake Ulysses leitmotif |
| snd_dialog_typewriter.wav | Direct replacement for placeholder cutscene typewriter SFX |
| Symbol system (slide → sprite) | Portable to cutscene scene as slide annotations |
| IT speaker / PLAYER speaker | Future addition to dialogScene.js speaker system |
| MK2 save pattern | Already implemented in web build via shell/save.js |
