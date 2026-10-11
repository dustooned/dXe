# Asset Sizes — quick reference

Every image the game takes, with the size to draw it at and where it goes.
**Visual version:** open [`ASSET_REFERENCE.html`](ASSET_REFERENCE.html) in a browser for every asset drawn to scale, with blank PNG templates at the exact size and a CSV checklist (no zip needed).

For templates, status and the reasons behind each size, see
[`ART_GUIDE.md`](ART_GUIDE.md).

## Three rules

1. **The screen is 390 × 844** (a portrait phone). Draw at **2×** (**780 × 1688**)
   unless a row says otherwise.
2. **The look:** white on black, 1-bit pixel art and dither. Hard edges, no
   soft gradients, no glows. The game adds the color tints and retro effects.
3. **Replace, don't rename:** drop real art at the listed path (the
   placeholder there now is replaced automatically).

Paths below are under `public/assets/lake-ulysses/` unless they start with
`public/`.

---

## Full screen

| What | Draw at | Format | Put it in |
| :-- | :-- | :-- | :-- |
| Room background (6 frames) | **780 × 1688** | WebP | `sprites/spr_<room>_bg/spr_<room>_bg_0000` … `0005` |
| Cutscene background | **780 × 1688** | WebP | `backgrounds/` |
| Object close-up | **780 × 1440** | WebP | `sprites/<room>_<object>_closeup` |

Keep the **top 96 px** (at 2×) clear: the skip and settings buttons sit there.

## Characters

| What | Draw at | Format | Put it in |
| :-- | :-- | :-- | :-- |
| Dialog portrait (also the call avatar and story bust) | **192 × 192** | WebP, transparent | `sprites/portrait_<name>` |
| Confrontation bust | **600 × 1200** | WebP, transparent | `sprites/npc_<name>` |
| Pastor Gabriel bust | **480 × 384** | WebP or PNG | `sprites/bust_pastor` |
| Bob Baiter (10 frames) | **600 × 600** | WebP | `sprites/spr_bb/` |

Busts stand on the bottom edge: they may bleed off the sides, **never off the bottom**.

## Chapter pages (the novel page before each room)

| What | Draw at | Format | Put it in |
| :-- | :-- | :-- | :-- |
| Plate × 4, animated (3 to 7 frames) | **240 × 150** (actual pixels); export a GIF at any whole multiple, e.g. 2400 × 1500 | GIF; 1-bit look (a dark ink and white is fine) | Send `<Npc>_ChapterOpen.gif`; `scripts/import-chapter-plates.mjs` writes `plates/<npc>/<npc>_0000.png` ... Deborah and Samun are done |

Draw it flat. The loading bands, scanlines, tape border and fog tint are added in code.

## Room objects

Draw at the **2×** size. Clean **white-line art on transparent**: the game tints
it with the feeling color, so don't bake color in. Each object also needs a
close-up (**780 × 1440**, see Full screen).

**Hallway (Deborah)**

| Object | Draw at |
| :-- | :-- |
| `hallway_diploma` | **148 × 192** |
| `hallway_doormat` | **216 × 88** |
| `hallway_lightbulb` | **104 × 124** |
| `hallway_door` (the way on) | **200 × 560** |

**Alley (Rwanda)**

| Object | Draw at |
| :-- | :-- |
| `alley_neon` | **192 × 116** |
| `alley_payphone` | **108 × 236** |
| `alley_mural` | **176 × 264** |
| `alley_gate` (the way on) | **192 × 600** |

**Garage (Samun)**

| Object | Draw at |
| :-- | :-- |
| `garage_drum` | **156 × 224** |
| `garage_calendar` | **132 × 176** |
| `garage_radio` | **136 × 92** |
| `garage_bay` (the way on) | **200 × 600** |

**Bar lot (Rick)**

| Object | Draw at |
| :-- | :-- |
| `barlot_bike` | **232 × 192** |
| `barlot_ashtray` | **112 × 80** |
| `barlot_flyer` | **116 × 156** |
| `barlot_door` (the way on) | **192 × 592** |

All room files go in `sprites/`.

## Title, menus and ending

| What | Draw at | Format | Put it in |
| :-- | :-- | :-- | :-- |
| Title logo (13 frames) | **1260 × 551** per frame | palette PNG sheet | `public/assets/shared/title/spr_game_title.png` |
| Title / chapter banner panorama (7 frames) | **1280 × 576** per frame | palette PNG vertical sheet | `public/assets/shared/title/` |
| Ending slide (one per ending line) | **800 × 600** | WebP | `endings/` (then list it in `endings.json`) |
| Announcement symbol (Bob Baiter) | **384 × 384** | WebP | `sprites/spr_<symbol>/` |

## Animated art

Numbered frames, all the same size, in a folder named after the sprite:
`name_0000.webp`, `name_0001.webp`, …
