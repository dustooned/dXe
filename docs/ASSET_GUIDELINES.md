# Asset Guidelines

How to prepare, name, place, and wire art and audio for Dream Xtreme.
Written against what's actually in the repo as of 2026-07-25 — the numbers
here are measured, not aspirational.

The short version: **1-bit art, 390×844 design frame, WebP frame
sequences, 128kbps MP3, and never position anything in raw pixels.**

---

## The design frame

Everything is authored against a **390×844** portrait canvas (iPhone
12/13/14 logical resolution). That is a *reference*, not a fixed size —
`.dx-canvas` scales to fill whatever viewport it gets:

```css
max-width: min(390px, 100dvh * 390 / 844);
aspect-ratio: 390 / 844;
```

The aspect ratio is preserved, so art authored at 390×844 never distorts.
But the rendered canvas is routinely *smaller* than 844px tall, which is
the single most important consequence for asset work:

> **Never position or size scene art in raw pixels.** Use percentages of
> the canvas. A sprite at `bottom: 130px; height: 600px` looks correct in
> a desktop browser and is cut off on an actual phone. This is exactly how
> the Bob Baiter sprite broke — see HANDOFF.md.

Bleeding past the left/right edges is fine and often intentional (a bust
shot should fill the frame). Bleeding past the *bottom* is a bug.

---

## Directory layout

```
public/assets/
├── shared/                        ← used by more than one chapter
│   ├── sprites/                   ← logo video lives here
│   └── audio/
│       └── title/                 ← title-screen music + jingle
└── <chapter-id>/                  ← e.g. lake-ulysses/
    ├── sprites/
    │   └── <sprite_name>/         ← one folder per animation
    └── audio/
```

Anything under `public/` is copied verbatim into the build and referenced
by **root-absolute path** (`/assets/...`). Do not `import` these from JS —
that's for content JSON only.

Chapter-specific vs. shared is a real decision, not a formality: anything
in `shared/` is loaded on the very first screen for every visitor, so it
counts against time-to-first-paint for people who may never reach your
chapter.

---

## Sprites (animated frame sequences)

### Format and naming

| Rule | Value |
| :-- | :-- |
| Format | **WebP**, lossy, quality ~70 |
| Folder | `sprites/<sprite_name>/` — one folder per animation |
| Filename | `<sprite_name>_####.webp`, zero-padded to **4 digits** |
| First frame | `_0000` (zero-indexed, not `_0001`) |
| Numbering | Contiguous. No gaps, no extra frames. |

The 4-digit zero-pad is not cosmetic — `ui/spriteAnimator.js` builds each
frame's URL with `String(n).padStart(4, '0')`. A frame named `_001` or
`_00010` will 404 silently and the animation will appear to freeze.

A stray extra frame is equally silent: the animator trusts the declared
`frames` count, so an orphan `_0046` in a 46-frame (0000–0045) sequence
just sits in the deploy unused. One shipped in this repo once and had to
be found by hand.

### What's in the repo now

| Sprite | Frames | Dimensions | Avg/frame | Total |
| :-- | --: | :-- | --: | --: |
| `spr_lake_bg_001` | 46 | 390×844 | ~110KB | **4.9MB** |
| `spr_bb` (Bob Baiter) | 10 | 600×600 | ~101KB | 1.0MB |
| `spr_QuoteBG` | 5 | 390×844 | ~78KB | 0.4MB |

Full-frame backgrounds are authored at exactly 390×844. Character sprites
are authored square (600×600) and scaled by CSS height — being wider than
the canvas is expected for a bust shot.

### Budgets

`spr_lake_bg_001` at 4.9MB is **over budget and should be treated as the
cautionary example, not the template.** It's the reason the preloader
exists at all. Targets for anything new:

- **≤ 100KB per frame** for a full-frame 390×844 background
- **≤ 1.5MB total** for any single animation
- **Prefer fewer frames at lower fps** over more frames — a 12fps loop of
  24 frames reads as smooth in this art style and halves the payload of a
  46-frame one.

If a sequence can't fit the budget, it belongs in `PRELOAD_ASSETS` (see
below) and probably wants a shorter loop.

### Registering an animation

Frame count and fps live in the chapter's `anims.js`, keyed by a short
name that scene content refers to:

```js
// src/chapters/<id>/anims.js
const BASE = '/assets/<chapter-id>/sprites/';

export const ANIMS = {
  lake_bg:    { base: `${BASE}spr_lake_bg_001/spr_lake_bg_001_`, frames: 46, fps: 12 },
  bob_baiter: { base: `${BASE}spr_bb/spr_bb_`,                   frames: 10, fps: 8  },
};
```

`base` is the full path **up to and including the trailing underscore** —
the animator appends `0000.webp` itself. `frames` must match the real file
count exactly. Then reference the key from a cutscene beat:

```json
{ "text": "Ladies and Gentlemen!", "bgAnim": "lake_bg", "spriteAnim": "bob_baiter" }
```

`bgAnim` renders full-bleed behind everything (`object-fit: cover`);
`spriteAnim` renders as the bottom-anchored character layer. Frame
position is preserved across beats for the same key, so a background
doesn't restart from frame 0 every time the player taps.

### Static images

A beat can use `image` / `sprite` with a direct path instead of an anim
key. Same sizing rules apply. Placeholder SVGs are acceptable and used
elsewhere in the project — shipping a labeled placeholder beats blocking
on real art.

---

## Video

Only the inkflo Graphics logo uses video. It's a special case worth
documenting because it took several failed encodes to get right.

| File | Size | Dimensions | Duration |
| :-- | --: | :-- | --: |
| `spr_inkflo_logo.webm` | 609KB | 391×176 | 10.0s |
| `spr_inkflo_logo.mp4` | 308KB | 391×176 | 10.0s |

**Always ship both.** The `<video>` element lists WebM first and MP4 as
fallback; Safari needs the MP4. Set `playsInline` — without it iOS takes
the video fullscreen.

### The transparency trap

The source PNGs are **RGBA with a transparent background and black ink**,
where alpha carries the ink density. The finished video is **white ink on
opaque black**. Getting from one to the other is not obvious, and three
approaches failed before the working one:

| Approach | Result |
| :-- | :-- |
| `negate` | **All-white video.** Inverts the alpha channel too, so everything becomes transparent and composites to white under yuv420p. |
| `colorkey` after negate | White-on-white. The key removed the black but the video element still painted white behind it. |
| CSS `filter: invert(1)` | Visible white flash before the filter applied. |
| **Map ink alpha straight to luma** | ✅ Correct. |

The working filter — bake it into the encode, don't fix it at runtime:

```
geq=r='alpha(X,Y)':g='alpha(X,Y)':b='alpha(X,Y)'
```

Note `lum(X,Y)` is *not* available in every ffmpeg build's `geq`; writing
the three channels explicitly is the portable form.

**ffmpeg is not on PATH in this environment.** Whoever re-encodes these
will need to supply their own binary or run it elsewhere.

### Budget

Video is expensive. 10 seconds is already long for a logo sting the player
sees on every cold load — that's why TAP TO SKIP exists. Anything new
should justify not being a WebP sequence first.

---

## Audio

### Format

| Rule | Value |
| :-- | :-- |
| Format | **MP3, 128kbps** |
| Never | WAV, or 320kbps MP3 — both were compressed away already |

Everything in the repo now (sizes measured):

| File | Size | Role |
| :-- | --: | :-- |
| `lake-ulysses/lk_01.mp3` | 1.2MB | lake ambient loop |
| `lake-ulysses/ann_01.mp3` | 1.2MB | ⚠️ byte-identical duplicate of `lk_01.mp3` |
| `lake-ulysses/heavens_waiting_room.mp3` | 501KB | Therapist leitmotif |
| `shared/snd_inkflo_logo.mp3` | 158KB | logo sting |
| `shared/tyagl.mp3` | 14KB | SFX |
| `shared/typewriter_tick.mp3` | 3KB | SFX (per-character tick) |
| `shared/title/snd_titlemusic.mp3` | 261KB | title theme |
| `shared/title/snd_lake_title.mp3` | 148KB | title pad |
| `shared/title/snd_start.mp3` | 96KB | start jingle |

Ambient loops are the heavy items. Keep them short and genuinely loopable
rather than long and one-shot — a clean 30s loop beats a 2-minute track at
a quarter the size.

### Playing it: Web Audio, not `<audio>`

All playback goes through the Web Audio graph in `shell/audio.js`. Do not
add `new Audio().play()` calls — that path was tried and silently fails on
mobile without a user gesture, which is what broke the logo sting.

Two consequences for asset work:

1. **A user gesture must unlock the AudioContext before anything plays.**
   The preloader's loading phase is the gesture gate — tapping there calls
   `unlockAudio()`. Anything that needs sound before that point will not
   play, and will not error.
2. **Volume is set in code, not in the file.** Master gain is 0.5, and each
   category has its own constant in `shell/audio.js`:

   | Constant | Value |
   | :-- | --: |
   | `AMBIENT_GAIN` (emotion stems) | 0.06 |
   | `AMBIENT_MUSIC_GAIN` (room tone) | 0.07 |
   | `TITLE_MUSIC_GAIN` | 0.13 |
   | `LEITMOTIF_GAIN` | 0.14 |
   | `EMPHASIS_GAIN` | 0.16 |
   | `TYPEWRITER_GAIN` | 0.28 |
   | `TYAGL_GAIN` | 0.45 |
   | `START_JINGLE_GAIN` | 0.75 |

   **Master your files to a consistent perceived loudness** and let these
   constants do the balancing. A file that's hot relative to the others
   will blow past its category's gain and there's no per-file trim.

### Wiring it up

- **Looping room tone for a scene:** `startAmbient(url)` on mount,
  `stopAmbient()` on unmount. A cutscene can declare `ambient` on the
  scene object and the handler does this for you.
- **One-shot SFX:** add a function to `audio.js` following `playTyagl()`.
  Anything fired rapidly (per keystroke) should be preloaded into a buffer
  once — see `preloadTypewriterTick()` / `playTypewriterTick()`.
- **NPC leitmotif:** add an entry to `LEITMOTIFS` in `audio.js`. A `url`
  entry loops a real file; a `notes` entry synthesizes an oscillator
  phrase. Several NPCs still use oscillator placeholders.

---

## The preload list

Heavy assets that would otherwise stall the first scene are prefetched
during the preloader's loading phase:

```js
// src/main.js
const PRELOAD_ASSETS = [
  '/assets/lake-ulysses/sprites/spr_lake_bg_001/spr_lake_bg_001_0000.webp',
  '/assets/lake-ulysses/sprites/spr_bb/spr_bb_0000.webp',
  '/assets/lake-ulysses/audio/lk_01.mp3',
  '/assets/shared/audio/title/snd_lake_title.mp3',
  '/assets/shared/audio/title/snd_titlemusic.mp3',
];
```

Only the **first frame** of each sequence is listed — that's enough to
warm the connection and get something on screen; remaining frames stream
in as the animation runs. Add to this list when you add a large asset that
appears early. Don't add everything: the loading phase is held to a 2.2s
minimum, and a bloated list turns that floor into a ceiling.

---

## Checklist for adding a new asset

1. Authored at 390×844 (backgrounds) or square (characters)?
2. WebP q70 / MP3 128kbps?
3. Named `<name>_0000.webp` with 4-digit padding, starting at zero, no gaps?
4. Under budget (≤100KB/frame, ≤1.5MB/animation)?
5. Registered in `anims.js` with a `frames` count that matches reality?
6. Positioned with percentages, not pixels?
7. Large and early → added to `PRELOAD_ASSETS`?
8. Audio mastered to match the existing loudness, played via `audio.js`?
9. Verified at a real phone viewport (375×812), not just desktop?
