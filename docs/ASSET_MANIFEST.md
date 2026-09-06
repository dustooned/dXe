# Asset Manifest — Chapter 1 Visual Assets

Every image asset Chapter 1 needs, with dimensions. Work straight down it.

**Format:** WebP. **DPI:** 72 (screen standard — DPI doesn't affect
rendering on the web, only pixel dimensions do; use 72 if your tool
requires a value). **Canvas:** everything is authored against a 390×844
portrait frame. Numbers below are 1×; double them for a 2× / retina
export.

🔲 = placeholder exists at this exact path today, drop the real file in.
⬜ = nothing exists yet.

---

## Mini-game rooms

Each room = 1 background sequence + 3 objects + 3 close-ups + 1 door
(door needs no close-up).

### Hallway — Deborah

| File | Dimensions |
| :-- | :-- |
| `spr_hallway_bg_0000` – `0005` | 390×844 ×6 frames |
| `hallway_diploma` | 74×96 |
| `hallway_diploma_closeup` | 390×720 |
| `hallway_doormat` | 108×44 |
| `hallway_doormat_closeup` | 390×720 |
| `hallway_lightbulb` | 52×62 |
| `hallway_lightbulb_closeup` | 390×720 |
| `hallway_door` (advance) | 100×280 |

### Alley — Rwanda

| File | Dimensions |
| :-- | :-- |
| `spr_alley_bg_0000` – `0005` | 390×844 ×6 frames |
| `alley_neon` | 96×58 |
| `alley_neon_closeup` | 390×720 |
| `alley_payphone` | 54×118 |
| `alley_payphone_closeup` | 390×720 |
| `alley_mural` | 88×132 |
| `alley_mural_closeup` | 390×720 |
| `alley_gate` (advance) | 96×300 |

### Garage — Samun

| File | Dimensions |
| :-- | :-- |
| `spr_garage_bg_0000` – `0005` | 390×844 ×6 frames |
| `garage_drum` | 78×112 |
| `garage_drum_closeup` | 390×720 |
| `garage_calendar` | 66×88 |
| `garage_calendar_closeup` | 390×720 |
| `garage_radio` | 68×46 |
| `garage_radio_closeup` | 390×720 |
| `garage_bay` (advance) | 100×300 |

### Barlot — Rick

| File | Dimensions |
| :-- | :-- |
| `spr_barlot_bg_0000` – `0005` | 390×844 ×6 frames |
| `barlot_bike` | 116×96 |
| `barlot_bike_closeup` | 390×720 |
| `barlot_ashtray` | 56×40 |
| `barlot_ashtray_closeup` | 390×720 |
| `barlot_flyer` | 58×78 |
| `barlot_flyer_closeup` | 390×720 |
| `barlot_door` (advance) | 96×296 |

---

## Confrontation busts

Bottom-anchored, rendered at 72% of canvas height — author tall, not
full-frame. Bleeding past left/right is fine; past the bottom isn't.

| File | Dimensions | Status |
| :-- | :-- | :-- |
| `npc_deborah` | 600×1200 | 🔲 |
| `npc_rwanda` | 600×1200 | 🔲 |
| `npc_samun` | 600×1200 | 🔲 |
| `npc_rick` | 600×1200 | 🔲 |

---

## Dialog portraits

Displayed at 96×96 in-game (`object-fit: contain`, so a 1-bit/transparent
portrait keeps its shape instead of getting cropped). Image slot is wired
now — `ui/npcPortrait.js` renders an NPC's `portrait` path when set
(authored via a manuscript `PORTRAIT:` line pointing at
`/assets/lake-ulysses/sprites/<file>.webp`), falling back to today's
colored-initial placeholder whenever it's unset.

| File | Dimensions | Status |
| :-- | :-- | :-- |
| `portrait_deborah` | 192×192 | ⬜ |
| `portrait_rwanda` | 192×192 | ⬜ |
| `portrait_samun` | 192×192 | ⬜ |
| `portrait_rick` | 192×192 | ⬜ |
| `portrait_therapist` | 192×192 | 💬 she's voice-only by design — confirm before drawing |

---

## Cutscene background

| File | Dimensions | Status |
| :-- | :-- | :-- |
| `prologue-lake` | 390×844 | 🔲 |

---

Full detail (naming convention, size budgets, frame-count rules, the
video encode gotchas) is in [`ASSET_GUIDELINES.md`](ASSET_GUIDELINES.md).
