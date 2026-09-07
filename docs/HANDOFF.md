# Handoff / Project Status

Last updated: 2026-08-09. Read this first if you're picking this project
up cold — it's the "why," not the "what" (the code and the other docs in
this folder cover the what).

Other docs, roughly in reading order: `ARCHITECTURE.md` (shell/chapter
split, boot sequence), `SCENE_TYPES.md` (how to add a scene),
`ASSET_GUIDELINES.md` (preparing art and audio), `SCRIPT_FORMAT.md` +
`CONTENT_SCHEMA.md` (writing dialog), `STAT_MATH.md` (the numbers),
`ATTIC.md` (removed code, kept for reference).

## What Dream Xtreme is

An episodic interactive zine hosted as a static site on GitHub Pages.
Each chapter is a self-contained short story/game played with a swipe,
tap, or click — same interaction model on mouse and touch. Native JS, no
UI framework, Vite for dev/build only.

## What's actually playable right now

Boot plays the inkflo Graphics intro (loading phase -> logo, skippable),
then lands on the title screen for new players or chapter select for
returning ones.

Shell chrome around it: title screen, chapter select, About/Contact. A
returning player who hits ENTER on the title gets a "You've been here
before — skip the story?" prompt; SKIP jumps straight to the
questionnaire, REPLAY starts the chapter from the top
(`showSkipDialog()` in `main.js`). SKIP now cleanly bypasses all three
opening cutscenes and drops you at the quiz -> Therapist call; before the
Prologue/Questionnaire swap it skipped to the quiz but then still played
the Prologue afterwards.

One chapter: **Truth Debt: Lake Ulysses**, in scene order: Opening quote
(cutscene) -> Bob Baiter (cutscene, the councilman's lake-reopening pitch)
-> Prologue (typewriter-drawn narrative cutscene; ends on "Your phone
buzzes against the gravel") -> **Questionnaire** (three swipe questions
whose answers *implicitly* set your class — Guns / Bible / Crystals —
followed by the Therapist's cryptic diagnosis; the class name is never
shown) -> Therapist (location 1 — the tutorial NPC, a single swipe
exchange, no in-fiction explanation of mechanics; teaches truth/lie purely
by playing it) -> Deborah -> Rwanda -> Samun -> Rick -> Reckoning (confess
or double down on your lies) -> one of four endings (Clean Cut / Functional
Mask / Collapse / Living Lie) based on final Truth Debt.

Each of the four NPCs is now a three-beat unit — **explore -> confront ->
encounter**: a mini-game walk to their door, a confrontation where you see
them and pick how to open, then the dialog itself. The confrontation choice
isn't decoration: it selects which node the NPC opens on, so the same
character starts guarded, warm, or already cornered depending on how you
came at them. All of it is placeholder art and placeholder prose right now
(see "Known gaps"), but the shape is real and playable end to end.

Prologue / Questionnaire / Therapist are deliberately one continuous
unit — **the chapter's opening call**, and the intended routine opener for
future chapters too: you're on site, the Therapist buzzes in, she evaluates
you. The order is load-bearing and the existing writing already assumed it.
Prologue's final beat is the phone buzzing; the Therapist dialog's opening
line is "The screen lights up... cuts through the ringing in your ears,"
which answers both that buzz and Prologue's earlier "Ears ringing" beat.
Questionnaire originally ran *before* Prologue, which fired the Therapist's
diagnosis before the story had established why she'd be talking to you —
swapping the two fixed a pre-existing content/order mismatch rather than
imposing a new one. Don't reorder these three without re-reading the copy.
`localStorage` persists endings seen and chapters completed; the latter
also decides where the intro drops you.

This is the *reduced demo scope* from the original design docs, not the
full vision — see "What was deliberately cut" below.

## Key decisions and why

- **Vanilla JS + Vite, not React/Zustand/Framer Motion/PixiJS/Howler.**
  The original build spec (`DX_DEMO_BUILD_SPEC.md`, kept on the design
  Desktop, not in this repo) called for that stack. Given the 1-bit art
  style and a swipe-card mechanic that's just pointer-drag physics, none
  of those five dependencies were pulling their weight. Swiping uses
  Pointer Events (`shell/input.js`) — one code path for mouse, touch, and
  pen. This also matches the original "native JS" goal directly.
- **Shell + chapter-module architecture.** `src/main.js` owns navigation,
  save data, and the persistent chrome (menu/about); a chapter only needs
  to implement `mount(stageEl, {exit}) -> unmount`. See `ARCHITECTURE.md`.
  This means adding a second chapter later is additive (one new folder +
  one registry entry), not a rewrite.
- **Scene sequencer inside the chapter (added after the initial build).**
  The first cut of `lake-ulysses` hardcoded "NPC -> NPC -> NPC ->
  reckoning -> ending" directly in the chapter's `index.js`. That got
  generalized into `engine/sceneSequencer.js` + `src/scenes/` (dialog /
  reckoning / ending as scene *types*) specifically so cutscenes and
  mini-games had a well-defined slot to drop into later without another
  rewrite. That paid off: `cutscene` and `questionnaire` have since slotted
  in with no sequencer changes, and `minigame` (`scenes/minigameScene.js`)
  followed — see `SCENE_TYPES.md` for the contract and the can't-lose design
  philosophy behind it. The pre-battle confrontations are the clearest
  vindication of the split: they needed no new scene type at all, just one
  extra field on the cutscene type that was already there.
- **Vite version pinned to latest (^8), not what the original spec
  implied.** Started on 5.x, found a moderate dev-server vulnerability in
  its bundled esbuild, bumped to 8.x, zero vulnerabilities. No reason to
  run an old pin on a brand-new project.
- **Dialog content has a manuscript layer now, ahead of a second writer
  joining.** `src/chapters/<id>/manuscript/*.txt` is a plain-text format
  (no JSON, no braces) that `scripts/build-content.mjs` compiles into
  `content/*.json`. The generated JSON is still committed to the repo
  (not gitignored) so the game works even if someone forgets to run the
  build step — treat the JSON as derived output, the manuscript as the
  real source. Verified lossless against the hand-written JSON it
  replaced (byte-identical data, only whitespace/array-formatting
  differs) before switching over. Full format in `SCRIPT_FORMAT.md`.
  Endings and any future cutscene/mini-game content aren't part of this
  pipeline yet — see that doc's last section for the boundary.
- **FEELZ is now a dartboard, not 3 buttons.** `ui/feelzDartboard.js` is
  an 8-segment SVG annulus (Plutchik wheel order, Joy centered at top,
  clockwise). The player's class loads 3 of the 8 segments — those are
  colored and interactive; the other 5 are faint outlines, locked for
  the run. Segment labels are abstract symbols (★ ◉ ▲ etc.), not emotion
  names. Tap or drag a segment onto the swipe card both select it and
  color the card border — tap used to skip the color change ("keeps drag
  meaningful"), but a tap that visibly did nothing read as broken rather
  than restrained, so both now give the same feedback. Both paths call
  the same `onSelect(emotion, source)`.
  The class definition, all 8 emotions, their symbols, colors, and what
  each amplifies lives in `engine/loadout.js`; `cardEngine.js` reads from
  there. Note for future testing: synthetic `.click()` calls don't trigger
  selection — real `pointerdown/pointerup` events are required.
- **Class loadout system, assigned by questionnaire not by menu.** Three
  classes (Guns / Bible / Crystals) each carry 3 emotions from the Plutchik
  8. Class was originally an explicit pick on a pre-prologue screen; it's
  now inferred from three swipe answers in `scenes/questionnaireScene.js`,
  which then delivers a Therapist "diagnosis" with individual words tinted
  in the class palette. The player is never told the class name — they just
  notice different emotions available on the dartboard. Stored as
  `run.loadout`, determines which segments are active for the entire run.
  Replay variety: same content, different amplification map.
  (`scenes/loadoutScene.js` is the old explicit-pick screen and is now dead
  code — nothing imports it.)
  Guns = Anger/Fear/Anticipation (same as the old 3-button default, so
  the existing authored FEELZ effects and amplifications are unchanged).
  Bible = Trust/Disgust/Anticipation. Crystals = Joy/Sadness/Surprise.
  Amplification table (×1.5, lucidity deliberately never amplified):
  Anger→stability, Fear→integrity, Anticipation→trust, Trust→trust,
  Disgust→integrity, Joy→stability, Sadness→integrity, Surprise→trust.

- **Every audio start/stop pair is generation-guarded, and a new one must
  be too.** `startAmbient`/`startLeitmotif`/`startTitleMusic` are
  fire-and-forget async: they `await loadAudio()` and only then create and
  start the source. A scene that unmounts while its track is still loading
  used to find nothing to stop — and the track would then start *after* the
  stop, loop forever, and have no handle left to kill it. That was the
  "Heavens Waiting Room never cuts out" bug, and the same shape let title
  music bleed over the opening cutscene. Each stop now bumps a generation
  counter and each start re-checks it after its await. It only reproduces on
  a cold cache, so it hides in dev and shows up on a real first visit —
  if you add a new looping track, copy the guard.

- **The boot logo has three independent escape hatches.** Browsers refuse
  video autoplay in at least three different ways (a rejected `play()`, a
  silent refusal that leaves it paused on frame 0, and a start that stalls
  before `'ended'`), and the logo phase advances on `'ended'`. Handling only
  the rejection left the player parked on a frozen logo with a tap as the
  only way out — and no reason to know that. `startLogo()` in `main.js`
  now covers all three. Don't collapse them back into one.

- **The canvas scales to the viewport; scene art must be relative.** The
  390×844 canvas is a design reference, not a fixed size. `.dx-canvas` takes
  `max-width: min(390px, 100dvh * 390/844)`, so it fills whatever the device
  gives it and letterboxes nothing — `dvh` rather than `vh` because mobile
  browser chrome shows and hides. The consequence for content: **anything
  positioned in raw pixels will break at real phone sizes.** Bob Baiter was
  cut off exactly this way (`bottom: 130px; height: 600px` on a canvas that
  had scaled below 844px tall). Cutscene sprites are now bottom-anchored
  with a percentage height. Use percentages or viewport-relative units for
  scene art.

## Stats — what's wired up and what isn't

Four meters (Integrity, Trust, Stability, Lucidity, 0–10) plus Truth Debt
(0–10, separate). Full semantics are in `CONTENT_SCHEMA.md`; the math
layered on top (Emotional Lean, the ending epilogue, meter-gated
branching) is in `STAT_MATH.md`. Truth Debt is still the only stat
driving the big structural stuff (forces the Reckoning at 10, picks the
ending tier). Its bloom thresholds at 3/6/8/10 (`debtEngine.js`'s
`checkBloomTriggers()`) now interrupt dialog scenes with an IT popup —
one placeholder line per class per threshold (`engine/itBlooms.js`),
overlaid on top of whatever's already on screen rather than replacing it,
since "the player doesn't choose this, IT just shows up" is the whole
point (`IT_DESIGN.md`). At 10 the popup still shows before the existing
force-to-Reckoning jump runs. `lakeHealth` (the lake visibly degrading)
remains unbuilt — that needs actual art to visualize, unlike the bloom
trigger which only needed text. The four meters feed two things:
the ending epilogue line (names whichever meter moved furthest from
baseline), and **actual content gating**: a node can carry an opt-in
`gate` that redirects to a different node if a stat condition is met
(`resolveGatedNode()` in `cardEngine.js`, authored via a manuscript
`GATE:` line). Only Rick uses it so far (gated on trust, at his opening
node). Extending this to more NPCs/stats is just more content authored
the same way — no further engine work needed.

Emotional Lean now covers all 8 Plutchik emotions (not just the original
3) — `cardEngine.js` reads the amplification table from `loadout.js`.
Existing authored content only references Anger/Fear/Anticipation effects,
so nothing breaks; Bible and Crystals players just get different stats
amplified.

## What was deliberately cut from the original design docs

The design Desktop has six source docs. Two (`DreamXtreme Game
Concept.pdf`, `DreamXtreme Game Design Document v2.pdf`) and two large
`.md` files describe an earlier, much larger concept ("Medical
Underground" — 9 social classes, phone-battery health system, Frogger
traffic navigation, a dozen mini-games) that was explicitly shelved in
favor of something smaller and shippable. `DX Bible.md` and
`DX_DEMO_BUILD_SPEC.md` are the source of what's actually built. The demo
spec originally scoped the build down to 3 NPCs and 2–3 endings; Rick
(the biker bar, 4th NPC location) and the **Collapse** ending have since
been added, so the chapter now matches `DX Bible.md`'s full 4-NPC,
4-ending set.

## Asset inventory

**Sprites** (all in `public/assets/lake-ulysses/sprites/`):
- `spr_lake_bg_001/` — 46-frame animated lake background, 195×422px WebP
  (half canvas res, upscaled with `image-rendering: pixelated`), ~1.5MB
  total. Used in `bob_baiter` scene. Was ~5MB at full-res, near-lossless
  quality — see `scripts/compress-cutscene-frames.mjs`.
- `spr_bb/` — 10-frame bob_baiter character sprite, 300×300px WebP
  (same half-res + pixelated treatment), ~190KB total. Was ~1MB — the
  transparency was stored as a **lossless** alpha channel, the single
  biggest cost per frame; lossy alpha (`alphaQuality: 60`) fixed most of
  it even before the resize. Used in `bob_baiter` scene.
- `spr_QuoteBG/` — 5-frame quote-screen background. Used in `opening_quote` scene.

**Shared sprites** (`public/assets/shared/sprites/`):
- `spr_inkflo_logo.webm` (609KB) / `.mp4` (308KB) — inkflo Graphics logo animation, white-on-black. Played by the preloader screen.
  The white-on-black is **baked into the encode**, not a CSS filter. Source
  PNGs are RGBA with a transparent background and black ink, so the ffmpeg
  pipeline maps ink alpha straight to luma
  (`geq=r='alpha(X,Y)':g='alpha(X,Y)':b='alpha(X,Y)'`). Don't reach for
  `negate` if these ever get re-encoded — it inverts the alpha channel too
  and yields an all-white video.

**Audio** (`public/assets/lake-ulysses/audio/`):
- `lk_01.mp3` (1.2MB) — lake ambient loop. Used in `bob_baiter` scene.
- `heavens_waiting_room.mp3` (501KB) — Therapist leitmotif/ambient. Used in questionnaire scene.
- `ann_01.mp3` (1.2MB) — **not a distinct asset**: byte-identical to
  `lk_01.mp3` (same MD5). It's an accidental duplicate, not sourced
  content awaiting a scene. Deleting it is a free 1.2MB off the deploy;
  if a second ambient track is wanted, it still needs to be sourced.

**Shared audio** (`public/assets/shared/audio/`):
- `snd_inkflo_logo.mp3` (160KB) — logo sting, plays during preloader.
- `tyagl.mp3` (14KB) — the Therapist's diagnosis-reveal sting
  (`scenes/questionnaireScene.js`), the "thank you and good luck" line.
  Was also standing in for IT's sting before `it_sting.mp3` existed —
  no longer; see below.
- `it_sting.mp3` (27KB) — IT's own sting, plays on every IT popup mount
  (`ui/itPopup.js`). Sourced from `E:/2026/Music/dXe/SFX/IT/IT.wav`
  (48kHz/32-bit-float, 658KB) and re-encoded at 128kbps stereo MP3 via
  `scripts/compress-it-sting.mjs` — the delivered `IT.mp3` alongside it
  was 320kbps CBR (68.5KB), full quality this ~1.7s UI sting doesn't
  need. 128kbps matches this project's existing one-shot SFX convention.
- `typewriter_tick.mp3` — SFX.
- `title/snd_lake_title.mp3`, `snd_titlemusic.mp3`, `snd_start.mp3` — title screen music + jingle.

**Mini-game room art** (`public/assets/lake-ulysses/sprites/`):
- Four rooms — `spr_{hallway,alley,garage,barlot}_bg/` (6 SVG frames each) plus
  a sprite and `_closeup.svg` pair per object — and four confrontation busts,
  `npc_{deborah,rwanda,samun,rick}.svg`. **All generated placeholders**,
  produced by `scripts/make-placeholder-room.mjs` (deterministic, so
  regenerating causes no git churn). They exist so the walk and confrontation
  systems could be built and played before real art. Replace them and delete
  the script when real art lands.

**NPC portraits** are still colored initials (`ui/npcPortrait.js`) — no character art yet for dialog scenes.

## Known gaps (not bugs, just not done)

- NPC portrait art — dialog scenes use colored-initial placeholders.
  `ui/npcPortrait.js` now has an image slot (an NPC's content JSON can carry
  a `portrait` path, authored via a manuscript's `PORTRAIT:` line) — the
  placeholder is only a fallback for when that's unset, so real art can
  drop in with no further code changes. No art exists yet.
- Placeholder audio — emotion stems and hit sounds are oscillator tones in
  `shell/audio.js`; no real instrumental stems yet. `STEM_CONFIG` now
  covers all 8 Plutchik emotions (was 3, matching only the Guns loadout —
  a real bug where Bible and Crystals players got no stem audio at all on
  their own class's emotions), so this is placeholder-quality but no
  longer broken for two of the three classes. Only the player's *loaded*
  3 actually get oscillators — `dialogScene` passes `emotionsForClass()`
  into `startEmotionStems`/`ambientMix`/`emphasizeEmotion`. Running all 8
  drones the 5 the class can't even select and makes the bed ~2.7× louder
  than the gain constants were tuned for.
- `public/assets/lake-ulysses/audio/ann_01.mp3` — byte-identical duplicate
  of `lk_01.mp3`, 1.2MB shipped for nothing. Kept deliberately for now.
- `loadoutScene.js` and the unread `firstPlayScene` registry field were
  removed from the build; both are preserved verbatim in `ATTIC.md` with
  restore instructions.
- Cutscenes have real content (opening quote, Bob Baiter, Prologue). The
  four mini-games and the four confrontations are **entirely placeholder** —
  generated vector art, and prose written to exercise the class-variation and
  opener-branching paths rather than to be read. They are the largest block of
  placeholder content in the project and the most obvious thing to replace.
- ~~Per-node `feelzOptions`~~ — removed. The field predated the class
  system, was read by nothing, and carried no information (all 22 nodes
  had the identical `[Anger, Fear, Anticipation]`). Wiring it as authored
  would have soft-locked Bible and Crystals players, whose class emotions
  aren't in that list — there'd have been nothing selectable. The class
  loadout is now the only thing deciding which 3 emotions are available,
  in the code and in the docs. If per-node narrowing is ever wanted, it
  needs to be a new opt-in field that intersects with the class set and
  falls back when the intersection is empty.

## What's next

Roughly in order of how ready each one is to just start:

**Ready to build, no further design needed:**
- ~~Ending judgment beat~~ — done (`SCENE_TYPES.md`'s `ending` section).
- ~~Meter-gated branching~~ — done, first use on Rick (`STAT_MATH.md`).
  Extending it to more NPCs/stats is pure content now, same pattern.
- ~~Bandlands tutorial beat~~ — done: Therapist, location 1, right after
  the Prologue.
- ~~FEELZ Dartboard~~ — done: 8-segment SVG wheel, class loadout system,
  abstract symbols, drag-to-card interaction. (`engine/loadout.js`,
  `ui/feelzDartboard.js`, `scenes/questionnaireScene.js`.)
- ~~inkflo Graphics preloader~~ — done, two-phase; see the entry under
  "Needs something from outside this repo" below.
- ~~IT's trigger system~~ — done, all six moments `IT_DESIGN.md` scoped:
  the pre-questionnaire intro, each confrontation, bloom events, a
  dominant-emotion read at the end of each NPC encounter, the Reckoning,
  and the ending. ~40 placeholder lines total. What's left is real prose
  in place of them, and the separate hint-system merge below.
- ~~A third node on all four confrontation NPCs~~ — done: `deborah_03`,
  `rick_03`, `rwanda_03`, `samun_03`. Both existing second-node branches
  (confronted/enabled, open/closed, etc.) now funnel into one shared
  third node per NPC instead of ending there; that node closes the arc.
  Placeholder prose, same bar as the rest of the content — written to be
  read, just not final. `rick_shut_down` (the trust-gated lockout) was
  left as a one-node dead end on purpose; it's supposed to be curt.
- **More depth in Lake Ulysses** — still open: Bible/Crystals-class-aware
  FEELZ options on existing nodes, or a fourth node continuing any of the
  four arcs above. Pure content through the manuscript pipeline, no
  engine changes.

- ~~Mini-games for Rwanda / Samun / Rick~~ — done, all four exist and play.
  Art and prose are placeholder; see `ASSET_GUIDELINES.md` for the hand-off
  spec on replacing them.
- ~~Pre-battle confrontations~~ — done, one per NPC. Not a new scene type: a
  cutscene with `opensDialog` plus an `opener` on each choice, which writes
  the node the following dialog scene starts on (`SCENE_TYPES.md`). Adding
  more branches is authoring two things in step — a manuscript node and a
  matching option.
- **Real prose for the placeholder beats** — the biggest content job now.
  Four room intros ×3 classes, twelve hotspot captions ×3 classes, four
  confrontations, and eight opener nodes are all written to exercise their
  code path rather than to be read.

**Needs a dedicated design pass first:**
- **IT / the hint system — now one item, not two.** These were tracked
  separately; they're the same feature. IT is *how* the game hints: words
  within IT's line are highlighted in color, and the coloring tells the
  player how they're being read, without naming a stat or a number. Fires
  at four moments — entering a room/section, exiting a scene, during
  pre-battle dialog exchange, and immediately before an NPC battle choice.
  Reuses the word-tinting trick `questionnaireScene.js` already uses for
  the Therapist's diagnosis, which makes "colored word = the game is
  reading you" a learnable language rather than a one-off. Full write-up
  in `IT_DESIGN.md` ("IT *is* the hint system"). Deliberately not scoped
  for build yet.

**Needs something from outside this repo:**
- ~~inkflo Graphics preloader~~ — done, two-phase. Phase 1: spinner plus a
  pulsing "Reticulating Spines..." while heavy chapter assets prefetch; a tap
  here unlocks the AudioContext early. Phase 2: the logo animation
  (`spr_inkflo_logo.webm/.mp4`, white-on-black, 609KB/308KB) plays with its sting
  (`snd_inkflo_logo.mp3`, 160KB) through the Web Audio graph, with TAP TO SKIP.
  Implemented in `src/main.js` `renderPreloader()`; assets in
  `public/assets/shared/sprites/` and `public/assets/shared/audio/`.
  See ARCHITECTURE.md "Boot sequence vs. routing" for why this runs at boot
  rather than on the title route — that distinction is load-bearing.
- More real art/audio assets — sprite and audio folders populated for Lake Ulysses
  (`spr_lake_bg_001`, `spr_bb`, `spr_QuoteBG`, `lk_01.mp3`, `heavens_waiting_room.mp3`);
  `ann_01.mp3` is sourced but destination scene TBD.
- A second writer actually using the manuscript pipeline.

## Deployment

Live at **dreamxtre.me**, hosted on GitHub Pages from
[github.com/dustooned/dXe](https://github.com/dustooned/dXe), domain
registered on GoDaddy. This took a real back-and-forth to get right, so
the working configuration is recorded here rather than left as tribal
knowledge:

- **Repo settings → Pages → Source** must be **"GitHub Actions"**, not
  the default "Deploy from a branch." The default mode serves the repo's
  raw files as-is, which doesn't work here — the source imports JSON
  directly (`import deborah from './content/deborah.json'`), which only
  resolves correctly after Vite's build step. `.github/workflows/deploy.yml`
  runs that build and publishes `dist/` via `actions/deploy-pages`.
- **Repo settings → Pages → Custom domain** is set to `dreamxtre.me`.
  This requires an actual successful Actions run to exist *before* the
  domain check can pass — GitHub's custom-domain verification checks that
  a live Pages deployment exists to route to, not just that DNS resolves.
  If DNS is confirmed correct but the settings page still shows
  `NotServedByPagesError`, check the Actions tab for a green run first.
- **GoDaddy DNS** for the apex (`@`) is four `A` records pointing at
  GitHub Pages' IPs (`185.199.108.153`, `.109.153`, `.110.153`,
  `.111.153`); the `www` CNAME points to `dustooned.github.io.` (not to
  the apex — GitHub's own recommendation, so `www` redirects cleanly).
  `public/CNAME` in this repo already contains `dreamxtre.me`, so the
  Vite build carries it into every deploy automatically.
- HTTPS enforcement lags behind DNS verification — GitHub only issues the
  certificate for the custom domain after its DNS check passes, which can
  take a bit even after DNS has actually propagated. `http://dreamxtre.me`
  will work before `https://` does. If the Pages settings page shows the
  DNS check stuck on "in progress" (yellow) even though DNS is
  independently confirmed correct (e.g. via `nslookup dreamxtre.me
  8.8.8.8`), the checker itself can just be stale — re-entering and
  re-saving the custom domain field forces a fresh check rather than
  waiting on whatever schedule it's stuck on. **Confirmed working
  end-to-end**: HTTPS is live, `http://` correctly 301-redirects to
  `https://`.

## Running it

See the root `README.md` for `npm install` / `npm run dev` / deploy.
