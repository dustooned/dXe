# Jobs Backlog

Last updated: 2026-07-18. Ranked roughly by how ready each is to start —
"ready" means no design decisions or external tools needed, just execution.

Source assets live at `E:\2025\Games\BackUp\1_28_2025\` unless noted.

---

## Ready to Build Now

### Audio — Wire Real Files

No processing needed. Copy to `public/assets/audio/`, update `audio.js`.

| File | Source path | Role |
|------|-------------|------|
| `LK_01.mp3` | `Music/Lake Ulysses/LK_01.mp3` | In-game ambient / NPC leitmotif layer |
| `Heaven's Waiting Room.mp3` | `Music/HeavensWaitingRoom/` | Therapist questionnaire music |
| `Ann_3 (mastered).mp3` | `Music/Annoucements/Ann_01/` | Bob Baiter announcement scene music |
| `snd_dialog_typewriter.wav` | `11_18_2025/.../beta/sounds/` | Cutscene typewriter tick (replaces silence) |
| `snd_tyagl.wav` | `11_18_2025/.../beta/sounds/` | Therapist diagnosis arrival sting |
| `inkflogfx_final.wav` | `Music/inkflo Logo/` | Session-start / title sting |

Changes needed in code:
- Add `loadAudio(url)` helper to `audio.js` (fetch + decodeAudioData)
- Add `startAmbient(url)` / `stopAmbient()` for room-level music
- Add `playTypewriterTick()` for the cutscene scene
- Wire `Heaven's Waiting Room` into the questionnaire scene
- Add `THERAPIST` to the leitmotif map

---

### Content — James Toback Quote Scene

Ready to drop in. Pure cutscene beats, no code changes.

Place: First scene in the Lake Ulysses chapter, before the Therapist
questionnaire. Sets the game's tonal frame.

```
"I think that there's probably a revelatory experience awaiting everyone
that has to do with finding out who and what you really are."

"I think that when that occurs, if it occurs, you reach Nirvana-Heaven
and the degree to which you don't reach that place of realization...
...you are in eternal hell."

"James Toback, Oscar Nominated Screenwriter
Alleged Predator."
```

---

### Content — Bob Baiter Announcement Scene

Place: Second scene in the chapter, immediately after the Toback quote,
before the Therapist questionnaire. World-setting — the player has just
heard this announcement before they sit down with the Therapist.

Requires one small code addition: `speaker` field on cutscene beats so
"BOB BAITER" renders as a label above the text box. ~10 lines in
`cutsceneScene.js` + CSS.

Full 19-slide content in `docs/GM_BUILD.md`. Symbol overlays (biohazard,
fish, etc.) can be a second pass once the symbol PNGs are processed.

Assets needed: `BobBaiter.png` (871KB, already flat — just compress and
drop into `public/assets/images/`).

---

### Image — Lake Background Video (Prologue)

One ffmpeg command converts the 114-frame PNG sequence to a compressed
`.webm`. The prologue cutscene already has a placeholder background slot
(`beat.image`).

```
ffmpeg -framerate 24 \
  -i "E:\2025\Games\BackUp\1_28_2025\Assets\Lake\lake_bg_001\LakeBG_001_%05d.png" \
  -c:v libvpx-vp9 -b:v 0 -crf 30 -an \
  public/assets/video/lake_bg.webm
```

Update the prologue beats in `lake-ulysses/content/prologue.json` to
reference `/assets/video/lake_bg.webm` as `image`.

---

## Needs Light Processing

### Image — Symbol Sprites (for Bob Baiter scene)

Five sprite sequences in `Assets/symbols/`. Each is a set of animation
frames. Export one representative frame per symbol as a PNG:

| Symbol | Source folder |
|--------|--------------|
| biohazard | `Assets/symbols/biohazard_sprite/` |
| pets | `Assets/symbols/pets_sprite/` |
| exposure | `Assets/symbols/spr_exposure/` |
| fish | `Assets/symbols/spr_fish/` |
| baitshop | `Assets/symbols/spr_baitshop/` |

Drop static PNGs into `public/assets/images/symbols/`. Wire into the Bob
Baiter cutscene as a `symbol` field on specific beats (slide index →
symbol, documented in `GM_BUILD.md`).

### Image — Location Backgrounds

Six flat PNGs at 1.5–8.3MB each. Need compression to <300KB webp before
they're web-usable. Run through ffmpeg or Squoosh. These are NPC scene
backgrounds for future use (which NPC gets which location is still TBD).

| File | Current size |
|------|-------------|
| `Location/1. The Bottoms/Location_1.png` | 8.3 MB |
| `Location/1. The Bottoms/Location_2.png` | 2.8 MB |
| `Location/1. The Bottoms/Location_3.png` | 1.5 MB |
| `Location/1. The Bottoms/Location_5.png` | 2.0 MB |
| `Location/1. The Bottoms/Location_6.png` | 1.6 MB |
| `Location/1. The Bottoms/Location_1_A.png` | 1.5 MB |

---

## Needs Design Decision First

### Content — Grandma's House Narration

Full text is written (in `GM_BUILD.md`). Fits perfectly as a cutscene.
Question is where it lives:

- **Option A** — Bloom event: fires as a cutscene intrusion when Truth
  Debt crosses a threshold. The player is in the middle of a dialog scene
  and the dream intrudes. Most thematically interesting.
- **Option B** — Chapter 2 opener. The player wakes up in the dream.
  Grandma's House is its own chapter with the TV knob → TVLAND sequence.

Decision needed before placement.

### Content — MK2 Intro Lines (IT's Entrance)

Three auto-advancing lines, class-neutral, IT speaking before the player
has a loadout. Strong candidate for the very first thing in the game —
before the Toback quote even. But placement depends on how IT is
introduced overall.

> "You're probably wondering where you are."
> "Or... maybe you're not wondering at all."
> "Either way, you're stuck with me."

---

## Larger Systems (Design + Code + Content)

### IT Inner Dialog System

See `docs/IT_DESIGN.md` for the full design. Summary of what needs to
be built:

**Phase 1 — IT as cutscene beat type**
- Add `type: 'it'` beat variant to `cutsceneScene.js`
- IT beats render with distinct visual style (different from text box,
  uninvited, no speaker label)
- Add the three MK2 intro lines as IT beats at chapter start
- CSS for IT visual identity

**Phase 2 — IT in dialog scenes**
- After certain swipes, IT fires a one-line observation based on
  dominant emotion
- New `onIT` hook in `dialogScene.js`, content keyed to `[class][emotion][npcId]`

**Phase 3 — IT in the reckoning**
- IT is loudest at the reckoning — this is when the player's head
  catches up with what they've done
- Class-specific IT dialog for each reckoning outcome

**Content needed** (writing, not code):
- Three voice profiles × five NPC scenes = 15 IT line sets
- Reckoning IT dialog × three classes = 3
- IT intro lines (already written, MK2 source)

### NPC Art (Karen / Location Assignment)

Karen NPC art exists as a 79MB PSB with layered PSD source. Before it
can be used:
- Export decision: which current NPC does Karen map to (or is she new)?
- Export from Photoshop at web-appropriate resolution
- Compress to webp

The location backgrounds (The Bottoms, Grandma's House interior, Bells
End) need the same mapping decision before they can be assigned to scenes.

### Grandma's House as Chapter 2

If Option B above is chosen, this is a full chapter build:
- Chapter structure: narration → clickable TV → room 2 → knob → TVLAND
- TVLAND content (completely unwritten)
- IT dialog for the whole chapter
- Audio: `snd_gh_001_music.wav`, `snd_tv_static_gh002.wav`,
  `snd_gh002_tv_ch69.wav` (all in the backup, just need conversion)
- Highway music (`Highway_v1 (mastered).mp3`) may belong here
