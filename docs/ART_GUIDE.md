# Art Guide — every asset, its size, and its template

The one page for artists (and for us): every image the game uses or still
needs, the size to draw it at, how it's shown, the file format, and which
template to start from. Templates live in [`art-templates/`](../art-templates/)
(regenerate with `node scripts/make-art-templates.mjs`).

**To send to artists:** `node scripts/make-artist-kit.mjs` builds
`deliverables/DreamXtreme_ArtistKit/` (an HTML guide with search, collapsible
asset rows, previews, template downloads and the palette, plus the templates
and reference images) and zips it to `deliverables/DreamXtreme_ArtistKit.zip`.
The deliverables folder is git-ignored; rebuild it whenever the guide changes.

Deeper detail lives in [`ASSET_GUIDELINES.md`](ASSET_GUIDELINES.md) (naming,
budgets, animation registration, video and audio gotchas) and
[`ASSET_MANIFEST.md`](ASSET_MANIFEST.md) (per-object room sizes).

---

## The rules (read these first)

1. **The frame is 390×844** (portrait phone). It scales to fit every screen
   but keeps that shape, so art never distorts. **Draw at 2×** (780×1688 for
   a full screen) unless a row below says otherwise.
2. **The look is lo-fi pixel / 1-bit dither.** Black, white, and a few
   accent colors. Hard edges, no soft gradients. The game scales art with
   nearest-neighbor, so crisp pixels stay crisp.
3. **Formats:**
   - Color art → **WebP** (quality ~70).
   - Pure 1-bit dither (black, white, clear) → **PNG with a small palette**:
     far smaller than WebP of noise (the title art is done this way).
   - Placeholders are SVG; real art replaces them at the same path.
4. **Animated art = numbered frames**, all the same size:
   `name_0000.webp`, `name_0001.webp`, … in a folder named after the sprite.
5. **Bottom-anchored figures** (busts, speakers) may bleed off the left and
   right, **never off the bottom**.
6. **Keep the top 48px (96px at 2×) clear** on full-screen art: the skip and
   settings buttons live there.
7. Hand over **layered source + the export**. Using a template: draw on a
   layer above it, hide the template layer, export.

Status key: ✅ final · 🔲 placeholder in place (drop real art at the same
path) · ⬜ nothing yet · 🎨 drawn in code (replace only if you want to).

---

## Title and menus

| Asset | Path | Draw at | Shown at | Format | Frames | Status | Template |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Title logo (splits in half, slides in, slams) | `public/assets/shared/title/spr_game_title.png` | 1260×551 per frame (source) | canvas width | palette PNG sheet, transparent | 13 (from 73) | ✅ GameMaker beta | `title_logo_1280x560.png` |
| Title background (pans forever) | `public/assets/shared/title/spr_title_bg.png` | 1073×483 per frame (source) | full height, panning | palette PNG vertical sheet | 7 | ✅ GameMaker beta | `panorama_frame_1280x576.png` |
| Chapter banner, per chapter (card + hover backdrop) | set in `src/main.js` `CHAPTERS[id].banner` | 1280×576 per frame | card 118px tall; full screen on hover (B&W) | palette PNG vertical sheet | any (7 is good) | 🔲 Lake Ulysses uses the title lake, tinted | `panorama_frame_1280x576.png` |
| Studio logo video | `public/assets/shared/sprites/spr_inkflo_logo.mp4` / `.webm` | 390×844 | boot | MP4 + WebM | ~10 s | ✅ | — |

**Panoramas (title + chapter banners):** draw a wide landscape. Each frame's
**right 22% dissolves into its left edge** (the import makes the loop
seamless), so keep that strip continuous with the picture's left edge.
Import: put the frames in the GameMaker project or a folder and run
`node scripts/import-gm-title.mjs` (edit the source path for a new one).

---

## Characters

| Asset | Path | Draw at | Shown at | Format | Frames | Status | Template |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Dialog portrait × Deborah, Rwanda, Samun, Rick | `public/assets/lake-ulysses/sprites/portrait_<name>.webp` | 192×192 | 96×96 in a 3px border (also the call avatar, the stay-in-touch bust, the story bust) | WebP, transparent | 1 | ⬜ (colored letter today) | `portrait_192.png` |
| Therapist portrait | `portrait_therapist.webp` | 192×192 | 96×96 | WebP | 1 | 💬 voice-only by design; ask first | `portrait_192.png` |
| Confrontation bust × 4 | `public/assets/lake-ulysses/sprites/npc_<name>.svg` → `.webp` | 600×1200 | 72% of canvas height, bottom-anchored | WebP, transparent | 1 (frames optional) | 🔲 | `confront_bust_600x1200.png` |
| Pastor Gabriel bust (Reckoning) | (new) `public/assets/lake-ulysses/sprites/bust_pastor.webp` | 480×384 | ~120px wide, fades in on the death-clock bells | WebP or palette PNG | 1 | 🎨 code pixel art (`ui/pastorBust.js`) | `pastor_bust_480x384.png` |
| Bob Baiter (speaker) | `public/assets/lake-ulysses/sprites/spr_bb/` | 600×600 | bottom-anchored | WebP | 10 | ✅ | `speaker_sprite_600x600.png` |

---

## Walk rooms (one per NPC: hallway, alley, garage, bar lot)

Per room: 1 background sequence + 3 objects + 3 close-ups + 1 door. Exact
object sizes per room are in [`ASSET_MANIFEST.md`](ASSET_MANIFEST.md).

| Asset | Path | Draw at | Shown at | Format | Frames | Status | Template |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Room background | `public/assets/lake-ulysses/sprites/spr_<room>_bg/spr_<room>_bg_000N` | 780×1688 (2× of 390×844) | full screen | WebP | 6 | 🔲 | `room_bg_780x1688.png` |
| Room object | `<room>_<object>.webp` | 2× of the manifest size | at its design-space position | WebP, transparent | 1 | 🔲 | — |
| Object close-up | `<room>_<object>_closeup.webp` | 780×1440 (2× of 390×720) | full width, caption over the bottom quarter | WebP | 1 | 🔲 | `closeup_780x1440.png` |

> Planned: Deborah's garden, Rwanda's mural (with a client), Samun's
> crosswalk will replace some rooms; same sizes.

---

## Cutscenes

| Asset | Path | Draw at | Shown at | Format | Frames | Status | Template |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Lake background (Bob Baiter scene) | `spr_lake_bg_001/` | 390×844 (2× welcome) | full screen | WebP | 46 | ✅ | `room_bg_780x1688.png` |
| Opening-quote background | `spr_QuoteBG/` | 390×844 | full screen | WebP | 5 | ✅ | `room_bg_780x1688.png` |
| Prologue lake | `backgrounds/prologue-lake.svg` | 780×1688 | full screen | WebP | 1 | 🔲 | `room_bg_780x1688.png` |
| Announcement symbols (biohazard, exposure, fish, pet, bait shop) | `spr_biohazard/` etc. | 384 wide (square-ish) | centered over Bob's head | WebP | 19–32 | ✅ | `symbol_384x384.png` |

---

## Ending

| Asset | Path | Draw at | Shown at | Format | Count | Status | Template |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Story slide, one per ending line | listed in `endings.json` as `images: [...]` per ending | 800×600 (4:3) | full width, 2px frame | WebP | Clean Cut 5 · Functional Mask 5 · Collapse 5 · Living Lie 6 | ⬜ placeholder frames ("ENDING · n") | `ending_slide_800x600.png` |
| Epilogue slide (optional) | same, after the lines | 800×600 | full width | WebP | 1 per broken stat (integrity, trust, stability, lucidity) | ⬜ | `ending_slide_800x600.png` |

To wire a slide in: add `"images": ["/assets/lake-ulysses/endings/clean_cut_1.webp", …]`
to that ending in `src/chapters/lake-ulysses/content/endings.json`, one per
text line, in order.

---

## Interface art drawn in code (🎨, optional to replace)

These are generated in code as pixel grids today. If you redraw one, keep
the exact grid size.

| Asset | Where | Grid | Notes | Template |
| :-- | :-- | :-- | :-- | :-- |
| Feeling icons × 8 (flame, wide eye, raindrop, sun, knot, ugh-face, spark, open hand) | `src/ui/feelingIcons.js` | 9×9 | one color (the feeling's) | `feeling_icon_9x9_at16x.png` |
| IT / SO icon | `public/assets/shared/sprites/spr_it_icon.webp` | 32×32 | ✅ pixel art; SO is the same icon inverted | `it_icon_32x32_at16x.png` |
| Status bar (signal, Wi-Fi, battery) | `src/ui/statusBar.js` | 11×8 / 15×8 | lit + dim cells | — |
| Gear and skip buttons | `src/shell/hud.js` | 13×13 | — | — |
| Fax printer | `src/ui/feelzRecord.js` | 46×7 | body, slot, status light | — |
| FEELZ wheel (boot logo, profile) | `src/ui/feelzSilhouette.js` | 48×48 | slice order: happy, trust, fear, surprise, sadness, disgust, anger, anxiety (clockwise from top) | — |

**Colors** (CSS variables in `src/style.css`): Anger `#ff3b1f` · Fear `#7b5cff`
· Anxiety `#ff9800` · Trust `#00d9c0` · Disgust `#5fd35f` · Happy `#ffe135`
· Sadness `#1e90ff` · Surprise `#ff5fd2` · Therapist `#9aa0a6`.

---

## Templates (art-templates/)

| File | For |
| :-- | :-- |
| `room_bg_780x1688.png` | any full-screen background: HUD strip + safe area marked |
| `closeup_780x1440.png` | object close-ups: caption zone marked |
| `confront_bust_600x1200.png` | confrontation busts: head zone, bottom line, bleed sides |
| `portrait_192.png` | dialog portraits: face circle, border inset |
| `pastor_bust_480x384.png` | Pastor Gabriel: head, halo, wings |
| `speaker_sprite_600x600.png` | cutscene speakers (Bob Baiter style) |
| `symbol_384x384.png` | cutscene symbols over a speaker |
| `ending_slide_800x600.png` | ending story slides: tag corner marked |
| `panorama_frame_1280x576.png` | title / chapter banner frames: blend zone + left edge marked |
| `title_logo_1280x560.png` | a title logo: the split line marked |
| `feeling_icon_9x9_at16x.png` | feeling icons, one 16px square per pixel |
| `it_icon_32x32_at16x.png` | 32×32 icons, one 16px square per pixel |

Guide colors: **pink** = edges and no-go lines · **blue** = safe areas ·
**yellow** = notes.

---

## Audio (for reference)

MP3, played through Web Audio. Existing: title music and start jingle
(`shared/audio/title/`), lake ambience `lk_01.mp3`, Bob's announcement
`ann_01.mp3`, the therapist's room tone `heavens_waiting_room.mp3`, IT's
sting, the typewriter tick, the studio logo sting. Almost every other sound
(bells, barks via SAM, phone, fax, howls) is synthesized in code
(`src/shell/audio.js`, `src/shell/voices.js`). See ASSET_GUIDELINES for
format details.

---

## Handing art over

1. Export at the size in the table, named exactly as the Path column.
2. Frames: same size, numbered from `_0000`.
3. Drop into the path (or send to the developer with the layered source).
4. Tell us the frame rate for anything animated (the default is 12 fps).
