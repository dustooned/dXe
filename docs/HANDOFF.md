# Handoff / Project Status

Last updated: 2026-10-03. Read this first if you're picking this project
up cold — it's the "why," not the "what" (the code and the other docs in
this folder cover the what).

Other docs, roughly in reading order: `ARCHITECTURE.md` (shell/chapter
split, boot sequence), `SCENE_TYPES.md` (how to add a scene),
`ASSET_GUIDELINES.md` (preparing art and audio), `SCRIPT_FORMAT.md` +
`CONTENT_SCHEMA.md` (writing dialog), `STAT_MATH.md` (the numbers),
`ATTIC.md` (removed code, kept for reference).

Two collaborator packs live outside `docs/`, written for people who don't
touch code: `writer-handoff/` (dialog and prose) and `sound-handoff/`
(music, MIDI leitmotifs, audio assets). Send those rather than this file.

## What Dream Xtreme is

An episodic interactive zine hosted as a static site on GitHub Pages.
Each chapter is a self-contained short story/game played with a swipe,
tap, or click — same interaction model on mouse and touch. Native JS, no
UI framework, Vite for dev/build only.

## What's actually playable right now

Boot plays the inkflo Graphics intro (loading phase -> logo, skippable),
then lands on the title screen for new players or chapter select for
returning ones.

Shell chrome around it: title screen, chapter select, About/Contact. ENTER
on the title goes straight into the story the first time and to chapter
select after that; a returning player picking a chapter is asked SKIP
STORY / FROM THE START (`askReady()` in `main.js`). SKIP STORY bypasses
the three story cutscenes and drops you at FEELZ -> intake quiz ->
Therapist call. The Therapist call is never skipped, because it's the
tutorial.

One chapter: **Truth Debt: Lake Ulysses**, in scene order: Opening quote
(cutscene) -> Bob Baiter (cutscene, the councilman's lake-reopening pitch)
-> Prologue (typewriter-drawn narrative cutscene; ends on "Your phone
buzzes against the gravel") -> **FEELZ launch** (cutscene: the phone's
therapy app opens and runs a real-app-style check-in — two "over the
last 2 weeks, how often…" questions with the standard four frequency
answers, modeled on the PHQ-2, then "matching you with care" — the
game's whole UI *is* the FEELZ app from here on. The boot beat plays a
placeholder synth chime (`audio.playFeelzBoot`) over a glowing silhouette
of the FEELZ wheel, filled with a moving rainbow wave
(`ui/feelzSilhouette.js`). The check-in answers are saved to
`run.checkIn` and read back on the ending screen, set flat against what
FEELZ recorded: lies told, to how many people, and the final lake
reading. Self-report versus data, with no comment on the gap)
-> **Questionnaire** (the app's intake: three swipe questions
whose answers *implicitly* set your class — Guns / Bible / Crystals —
followed by the Therapist's cryptic diagnosis; the class name is never
shown) -> Therapist (location 1 — the tutorial, see "The Therapist
tutorial" below) -> Deborah -> Rwanda -> Samun -> Rick -> **Reckoning, as a baptism**
(Pastor Gabriel runs an altar call at the lake: confess or double down on
your lies, IT and SO walk you into the water as his hellhound gatekeepers,
and he holds you under at the lake's final level — see "Pastor Gabriel"
below) -> one of four endings (Clean Cut / Functional
Mask / Collapse / Living Lie) based on final Truth Debt.

Each of the four NPCs is now a three-beat unit — **explore -> confront ->
encounter**: a mini-game walk to their door, a confrontation where you see
them and pick how to open, then the dialog itself. The confrontation choice
isn't decoration: it selects which node the NPC opens on, so the same
character starts guarded, warm, or already cornered depending on how you
came at them. All of it is placeholder art and placeholder prose right now
(see "Known gaps"), but the shape is real and playable end to end.

### Pastor Gabriel (the Reckoning)

The chapter's judgment. He's the local evangelical pastor, and he embodies
the game's contradictions: grace and a ledger, welcome and surveillance,
new life by drowning. He calls himself **Gabriel** ("God gave me my chosen
name"). The town still calls him **Sam**. His mother named him **Samael**,
the Angel of Death and accuser in Jewish tradition, and that name comes
out at the baptism, when his nameplate switches to SAMAEL. Deborah's
"You're not the church" sets him up.

His lines (`content/pastor.json`, picked by `engine/pastor.js`) climb
from warm toward the contradictions. They're chosen from the player's own
data: the lake's live status, the FEELZ check-in answers (he knows them,
and "You never told him that"), and how many lies were told. Confessing is
never quite enough ("…Is that all of it?"). That's scrupulosity, religious
OCD in which confession becomes a compulsion, and it's where IT and SO's
doubt ends up. Confessing clears the water live on his screen, while
doubling down fouls it. Even players with nothing to confess still go
under: "Even the clean ones go under."

### The Therapist tutorial

Rebuilt 2026-09-24 after playtest feedback: the tester liked the wheel
and swiping but didn't know what the colors, the meters, Truth Debt or
the goal were, and found the IT popup's X-only dismiss clunky. The fix
is guided discovery (the CBT technique: the therapist asks questions so
the client finds the answer, instead of telling them). He never explains
a mechanic. Each question makes the player use one new thing for the
first time:

1. *"How are you walking in today? Just point."* → the player picks a
   feeling → the card wiggles (`swipeCard.nudge()`) → he describes the
   symbol in an image (`PICK` lines). **Feelings are symbols only, never
   named**, in the UI or by him. After this node the four meters fade in
   ("four little lines").
2. *"What happened in the dream?"* → after it, the lake gauge fades in (or earlier: lie on
   the check-in and he points at it mid-reaction, after the bars, via {mark:lake}), and he hints at what it
   counts.
3. Outro: homework by class (surreal, not literal), a closing line by
   dream answer, HANGUP (screen dims, his music stops), then IT → SO,
   also by dream answer.

Each piece is **spotlit** as it's introduced: a black vignette mask
(`ui/spotlight.js`, a blurred SVG mask with holes) dims everything except
the thing he's talking about plus his line about it. The order is wheel,
then card, then meters, then debt. It's visual only
(`pointer-events: none`), so it never blocks input.

**Who he is:** an LCSW (licensed clinical social worker) at a community
clinic: a 40+ caseload, back-to-back telehealth, typing notes while you
talk. He's also somehow a guru who speaks in small aphorisms ("Weather,
not a verdict"), then gets pulled back by his actual day ("then I have to
take my two o'clock"). The wisdom is real, and so is the caseload. The
voice notes are at the top of `manuscript/therapist.txt`.

Engine pieces, all generic and opt-in per NPC: `PICK`/`REVEAL`/`SPOTLIGHT`/`=== OUTRO`
manuscript lines (`SCRIPT_FORMAT.md`), `run.choices` (nodeId → truth/lie),
IT popups dismiss on any tap, and touch-and-hold on a wheel wedge to hear
its tone without picking it (`feelzDartboard.js`'s `HOLD_MS`).

Prologue / Questionnaire / Therapist are deliberately one continuous
unit — **the chapter's opening call**, and the intended routine opener for
future chapters too: you're on site, the Therapist buzzes in, he evaluates
you. The order is load-bearing and the existing writing already assumed it.
Prologue's final beat is the phone buzzing; the Therapist dialog's opening
line is "The screen lights up... cuts through the ringing in your ears,"
which answers both that buzz and Prologue's earlier "Ears ringing" beat.
Questionnaire originally ran *before* Prologue, which fired the Therapist's
diagnosis before the story had established why he'd be talking to you —
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

- **Persistent HUD layer (`shell/hud.js`), added because scenes wipe their
  own container on every render.** `main.js`'s `.dx-canvas` used to be the
  same element every scene rendered into and wiped via `innerHTML = ''` —
  fine for full-screen content, but nowhere for chrome that should survive
  a scene's own re-renders. `.dx-canvas` now holds a `.dx-stage` child (what
  scenes actually render into and wipe) plus the HUD, mounted once as a
  sibling. Two buttons: a settings gear (volume/mute, Restart Chapter,
  Chapter Select — the latter two confirm first, since there's no
  mid-chapter save; `save.js` only ever records *completed* chapters) and a
  fast-forward icon. Fast-forward is deliberately the same exit a scene
  would use on its own — `sceneSequencer.js`'s `skip()` just calls the same
  `handleComplete()` a normal finish would, early. Only `cutscene` and
  `minigame` scenes are skippable (`SKIPPABLE_TYPES`) — `dialog`,
  `questionnaire`, `reckoning`, and `ending` have a real choice or a real
  ending in them, so skip is hidden rather than skipping content that
  matters. One known side effect: fast-forwarding a confrontation cutscene
  bypasses that cutscene's opener choice, so the dialog scene that follows
  starts on its default node instead of the one the choice would have
  picked — acceptable given how rarely that'll get used, but worth knowing.
- **Questionnaire diagnosis now has two variants per class, not one.**
  `scenes/questionnaireScene.js`'s `tallyClass()` used to only return the
  winning class; the exact same diagnosis text played every time a player
  landed on that class, regardless of how they actually answered. Each
  class is offered as an option on only 2 of the 3 questions (see
  `QUESTION_SLOTS`), so a true 3-of-3 unanimous result is mathematically
  unreachable — enumerated all 8 answer combinations to confirm before
  writing variants, so nothing shipped as dead content. The two real
  outcomes are a clean 2-of-3 (`majority` — the original text) and a
  genuine three-way tie resolved by first instinct (`split` — a new line
  that reads the tie back to the player instead of pretending it was
  clean). `DIAGNOSES[cls]` is keyed by variant accordingly.
- **Questionnaire questions now come from a pool, not 3 fixed prompts.**
  `QUESTION_SLOTS` holds 3 questions per class-pair (Crystals/Guns,
  Crystals/Bible, Bible/Guns — the same pairing structure the diagnosis
  math above depends on); `pickQuestions()` draws one at random per slot
  each run, so replays don't open with an identical questionnaire. The
  class-scoring math is unaffected either way — every question in a slot
  scores the exact same pair, only the wording differs.
- **The player's own SAY: line now has an emotion-driven tail
  (`engine/sayTone.js`).** Previously identical no matter which FEELZ
  emotion was active when you swiped. `composeSay()` appends one of 16
  short codas (8 emotions × truth/lie) to whatever the manuscript already
  authored — same trick as the per-NPC REACT codas (`engine/reactions.js`),
  just universal instead of per-NPC, since it's the player's tone, not an
  NPC's personality. Wired into `dialogScene.js`'s `stage === 'say'`
  render, so it covers Deborah/Rwanda/Samun/Rick/Therapist for free — all
  five run the same code path. No manuscript changes needed; `SAY:` stays
  one line same as always.
- **Swipe-card hints moved out of the card, into their own row above
  it.** `ui/swipeCard.js` used to overlay the TRUTH/LIE-style hint labels
  in the card's corners; once the questionnaire's question pool (above)
  introduced longer labels, corner-overlaid text crowded the centered
  prompt and orphaned arrow glyphs onto their own wrapped line. `el`
  returned by `createSwipeCard` is now a `.dx-swipe-card-wrap` containing a
  static `.dx-swipe-card__hints` row (doesn't move with the card) above the
  actual draggable `.dx-swipe-card`. Every caller only ever used the
  returned methods (`setSelectedColor` etc.), not the DOM shape directly,
  so this needed no changes in `dialogScene.js`, `questionnaireScene.js`,
  or `feelzDartboard.js`'s drop-target hit test.

## Stats — what's wired up and what isn't

Four meters (Integrity, Trust, Stability, Lucidity, 0–10) plus Truth Debt
(0–10, separate). Full semantics are in `CONTENT_SCHEMA.md`; the math
layered on top (Emotional Lean, the ending epilogue, meter-gated
branching) is in `STAT_MATH.md`. Truth Debt is still the only stat
driving the big structural stuff (picks the ending tier; since
2026-10-04 it no longer forces the Reckoning at 10). Its bloom thresholds at 3/6/8/10 (`debtEngine.js`'s
`checkBloomTriggers()`) now interrupt dialog scenes with an IT popup —
one placeholder line per class per threshold (`engine/itBlooms.js`),
overlaid on top of whatever's already on screen rather than replacing it,
since "the player doesn't choose this, IT just shows up" is the whole
point (`IT_DESIGN.md`). At 10 the popup still shows before the existing
force-to-Reckoning jump runs. The lake now shows Truth Debt:
`ui/lakeGauge.js` replaced the "DEBT N" box with a horizontal
water-quality chart. It's modeled on a real TDS (total dissolved solids)
chart: clean blue (20 ppm, IDEAL) through swamp green (520 ppm, OVER
LIMIT). A tamagotchi fish tank sits in its corner, going from three
thriving fish to one belly-up. It's deliberately indifferent: a sensor
readout with no sympathy words. Its five statuses line up exactly with
the ending tiers and bloom thresholds (`engine/lake.js`), and the ending
screen shows the final reading, full size, as the payoff. The lake is
audible too: `audio.playLakeSplash(debt)` is a square-wave water splash
whose pitch and brightness drop as the water turns. It plays at each
reaction once the gauge is on screen, and once at the ending. The four meters
feed two things:
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

**Site** (repo root `public/`, referenced from `index.html`):
- `favicon.png` (32×32) / `apple-touch-icon.png` (180×180) — Bob Baiter's
  face over the "dXe" wordmark, both downsized from a 1200×1200 source
  PNG. First real favicon; the site had none before.

**Sprites** (all in `public/assets/lake-ulysses/sprites/`):
- `spr_lake_bg_001/` — 46-frame animated lake background, 390×844px WebP,
  ~5.1MB total. Used in `bob_baiter` scene. This is dense halftone/dither
  art (1-bit-style black/white dot pattern), not flat-color pixel art —
  **full native resolution on purpose**. A half-res + `image-rendering:
  pixelated` pass was tried first and reverted: shrinking the dither and
  upscaling it back in the browser caused moire (the dot spacing doesn't
  divide evenly into the upscale factor), which read as blurry regardless
  of resize kernel. At native res, lossy quality tuning alone barely
  shrinks it (dither noise doesn't compress well — no smooth gradient to
  exploit), so this sequence is close to its original size; the fix here
  is about correctness, not file size. See
  `scripts/compress-cutscene-frames.mjs`.
- `spr_bb/` — 10-frame bob_baiter character sprite, 600×600px WebP (same
  native-res reasoning), ~720KB total. Was ~1MB — the transparency was
  stored as a **lossless** alpha channel, the single biggest cost per
  frame; lossy alpha (`alphaQuality: 60`) still saves real space here
  without touching resolution. Used in `bob_baiter` scene.
- `spr_QuoteBG/` — 5-frame quote-screen background. Used in `opening_quote` scene.

**Shared sprites** (`public/assets/shared/sprites/`):
- `spr_it_icon.webp` (160B) — IT's mark, the portrait-slot art in every IT
  popup (`ui/itPopup.js`, `.dx-it-icon` in `scenes.css`). Native 32×32
  pixel-art source, lossless WebP, displayed with `image-rendering:
  pixelated` for a crisp upscale to the 56px slot rather than a blurry
  smooth scale — same treatment as the Bob Baiter sprites.
- `spr_inkflo_logo.webm` (609KB) / `.mp4` (308KB) — inkflo Graphics logo animation, white-on-black. Played by the preloader screen.
  The white-on-black is **baked into the encode**, not a CSS filter. Source
  PNGs are RGBA with a transparent background and black ink, so the ffmpeg
  pipeline maps ink alpha straight to luma
  (`geq=r='alpha(X,Y)':g='alpha(X,Y)':b='alpha(X,Y)'`). Don't reach for
  `negate` if these ever get re-encoded — it inverts the alpha channel too
  and yields an all-white video.

**Audio** (`public/assets/lake-ulysses/audio/`):
- `lk_01.mp3` (1.2MB) — lake ambient loop. Used in `bob_baiter` scene.
- `heavens_waiting_room.mp3` (501KB) — questionnaire scene's ambient bed.
  Used to double as the Therapist's dialog-scene leitmotif too, stacking
  on top of the confrontation chord for a short tutorial beat that didn't
  need it — removed from `LEITMOTIFS` (`shell/audio.js`) so it only plays
  during the questionnaire now. See `STAT_MATH.md`'s "Per-NPC leitmotif".
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
- Placeholder audio — the confrontation chord and hit sounds are oscillator
  tones in `shell/audio.js`; no real instrumental stems yet. The emotion
  *drones* are gone: each loaded feeling is now a voice in a struck
  polychord built on the NPC's own tonic, moving toward unison or the
  tritone as the encounter resolves (`shell/harmony.js`, and STAT_MATH.md's
  "Confrontation polychord"). `EMOTION_WAVEFORMS` covers all 8 Plutchik
  emotions; only the player's *loaded* 3 get voices, since `dialogScene`
  passes `emotionsForClass()` into `strikeChord`/`strikeEmotionVoice`.
  Still placeholder timbre — four bare oscillator waveforms — but it's a
  real harmonic system now rather than eight unrelated fixed pitches.
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

**Done in the 2026-10-03 QA session** (screen sizes, plus a bot that plays the game):
- **Layout units, the rule:** every layout size in CSS (gap, padding, margin,
  width, height, top/left/right/bottom) is `calc(N * var(--px))`, never raw
  px. `--px` is 1 at the 390-wide reference and scales with the canvas, so
  the reference layout is unchanged and every other size is the same layout
  shrunk or grown. Before this, text scaled but boxes did not, so on phones
  under ~800px tall (320x568, 360x640, any iPhone in Safari) the dialog
  scenes overflowed and pushed the lake gauge off the bottom. Hairlines and
  borders (1-2px) stay px. Anything attached to `<body>` (the drag ghost,
  `.dx-feelz__ghost`) is outside `.dx-canvas` and has no `--px`, so it keeps
  raw px. The fish and bubble keyframes scale too.
- **Instant text speed was a softlock:** the typewriter never reported done
  in INSTANT mode, so cutscene choices, the wheel and card in every dialog,
  and the ending quote credit never appeared (`ui/typewriterText.js`,
  `notifyDone`). A line a caller starts revealed (a re-render) stays quiet.
- **Skim pressure never fired:** `lineReadThrough` reset the skim streak on
  lines cut short instead of lines read to the end, so IT's "you're
  skimming" could not trigger. Instant text counts as read.
- Storage writes (`save.js`, `settings.js`) no longer throw when storage is
  blocked or full (private windows); progress just won't persist.
- The ending button says BACK TO TITLE (it always went to the title).
- **Sideways pause** (`shell/orientationPause.js`): a touch phone held
  sideways (`orientation: landscape`, `max-height: 520px`, `pointer:
  coarse`) pauses the game into silence and IT says "Sideways. You can't
  see it like that. Turn it back." on black, outside the canvas at real
  pixel size. Turning it upright resumes where it was. Paused = audio faded
  and frozen (`pauseAudio`/`resumeAudio`), animations stopped, canvas
  `inert`, and every timer that moves the story or paces the player held:
  those use `later()`/`cancelLater()` from `shell/pauseBus.js` (cutscene
  auto-advance, ending judgment, reckoning entrance, class-reveal sequence,
  IT's stall popups, the leitmotif/pulse loops). New timers that advance
  the story should use them too, not `setTimeout`. In dev,
  `window.__turnPause(true/false)` forces it without a phone. `.dx-btn` has a
  10px padding floor for small canvases.
  `100vh` fallback sits under the `100dvh` canvas width.
- **Checked:** all 22 scenes swept for overflow, clipped and tiny text at
  320x568, 360x640, 390x844, 412x915, 768x1024, 1440x900, 1920x1080 and
  844x390; a bot played Deborah to the ending at 320x568, 844x390 and
  1920x1080, and the whole chapter at 390x844 (instant and normal text).
  No JS errors, no softlocks. **Not testable there:** real touch feel,
  audio on devices, iOS Safari toolbar behavior.
- **Known, left alone:** lake gauge scale labels are ~6.7px at the reference
  size (4.5px at 320 wide); the chapter "ready" sheet overlaps the ABOUT
  button by ~11px; a prompt split across pages shows a closing quote on its
  last page with no opening one.

**Done in the 2026-10-03 music session** (Rwanda's FL arrangement, tempo that follows the relationship):
- **Pipeline:** `node scripts/build-arrangement.mjs <project.flp> rwanda lake-ulysses --tonic=C` reads the FL project directly (`scripts/lib/flp.mjs`: channels, pattern names, notes; NOT the playlist order, plugin presets or automation) and writes `content/arrangements/rwanda.json`. Each FL pattern is a section (Intro_A/B/C, Intro_Bridge, Verse_001/002); parts are Organ, Drum 01, Bass. FL's own MIDI export came out empty for this project, hence the direct read. The synth is Plogue chipsynth C64 (a SID chip), so the voices are SID-style: pulse, triangle, a plucked low-pass, synth drums (`shell/arrangementVoices.js`). Tuned by ear; the drum key mapping (49 snare, 50 kick, 53 click, 54 hat, 55 open hat) is a guess.
- **Engine:** `engine/arrangementClock.js` is pure timing in ticks (one position, one tempo, every part off it; ramps; section changes on pattern/bar/beat); `shell/arrangement.js` plays it on the audio clock, 250 ms ahead, never from timers (so the sideways pause freezes it for free); `engine/tempoDirector.js` turns relationship numbers (tension, agitation, connection) into a target BPM and section along a five-step ladder (calm 80 / guarded 100 / uneasy 110 / tense 125 / agitated 140); `shell/battleMusic.js` joins them; `shell/encounterMusic.js` is the game hook. `npm run test:music` checks the rules and timing with a fake clock.
- **In the game:** Rwanda's confrontation cutscene plays Intro_A; the dialog then begins the battle and the director takes it from there (Intro_B at 100 BPM, up the ladder as answers land cold, down as they land warm). Each answer's `trustDelta + stabilityDelta` (the number that already bends the leitmotif and chord) feeds the director; being caught contradicting yourself is a connection failure. Rwanda's old placeholder riff and the heartbeat pulse are off while the arrangement plays; the polychord stays, built on C (`tonic` in the JSON). Any NPC with an arrangement JSON gets this; the rest keep their leitmotif. Music follows the relationship, not a verdict.
- **Sound player (Settings -> DEBUG -> SOUND PLAYER, `ui/soundLab.js`):** every track: arrangements (start a battle, push events, auto-escalate/calm, queue sections, mute/solo, audition a voice or drum key, edit the mix, master level, drum map and the tempo ladder live), leitmotifs (play, lean the mood), audio in memory, and every audio file in the build (`__AUDIO_FILES__`, vite.config.js). Holds the game while open (timers paused, scene music off). SAVE keeps tuning per arrangement on this device and applies it in the game too (`shell/soundTuning.js`); COPY JSON prints it to be made the default in code.
- **Why the full arrangement was never heard (fixed):** an answer moves trust+stability by only 1-2 points, and the first scaling turned that into tiny nudges, so even an all-cold Rwanda run ended on "uneasy" (Intro_C) and never reached the verses. `encounterMusic.react` now counts a delta as `SENSITIVITY` (2) events; checked against Rwanda's real deltas (all cold: guarded > uneasy > tense > tense, 130 BPM; all warm: calm, 80). The sound player shows which parts are sounding (● organ ● drum ● bass).
- **The confrontation was nearly inaudible (fixed):** its section (Intro_A) is drums only, and the hat/click pieces were ~4x quieter than the kick, organ and bass, so a local run peaked at 0.017 and read as "no music". Drum pieces rebalanced and the arrangement's default level raised 0.14 -> 0.24 (peak 0.089 at the confrontation). Saved tuning (`shell/soundTuning.js`) now keeps only values that differ from the code defaults (v2), and a v1 save's old default master level is dropped, so default improvements reach you.
- **Scope instruments (`ui/oscilloscope.js` drawInstruments, `getFeelings` from dialogScene):** a correlation needle left of the portrait (-1..+1: cos(wheel steps x pi/4) x (0.25 + 0.75 x closeness), wandering less as closeness rises) and a vectorscope right of it: a Lissajous figure whose ratio comes from the steps between your feeling (held, else last pick) and their shown mood on Plutchik's wheel (0 1:1 circle, 1 2:3, 2 8:9, 3 4:5, 4 7:5 tritone, which keeps rolling). Closeness sets the drift; at full trust with the same feeling it eases into a still, glowing circle. Verified live on Rwanda (Anger vs Anger circle, vs Sadness weave, vs Fear tangle, trusted + Anger a still circle with the needle at +1).
- **Lies that pay now (option A, 2026-10-04):** comforting lies already warmed Deborah, Samun and Rick (trust +1/+2) but never counted toward connecting. Now they are BIDs (`BID: lie`): deborah_01, deborah_02_denial, samun_01, samun_01_soft, samun_02_enabled, rick_01, rick_01_hard, rick_02_enabled, and rick_03 is `both`. So a good liar can win their number, the story and the secret track, while the lake pays. Rwanda only warms to the truth (no lie bids): the contrast is deliberate. Balance check: every class can still reach every NPC.
- **Endings gallery (part of option D):** the chapter card shows its four endings as chips, reached by name, the rest as ??? (`CHAPTERS[id].endings`, main.js endingsRow).
- **Calls vary (`engine/contacts.js`):** each contact now has `afterLast` (how you left the last person: connected / pushed / `me` when it was them; set as `run.lastParting` when an encounter ends), `knows` (their history with the person you're facing, carrying the colored read as `{feel}`: 10 lines across the chapter's pairs), and `byClass` (a tip per class). A call: greeting by your last parting (else a random one) > read through their history (else the generic read) > the Therapist's vitals > truth/lie advice > class tip > tired line. ~40 new lines, first drafts in code (not yet in the writer handoff).
- **Intake read lights your class (therapist_01):** while he reads your evaluation, the wheel is up but asleep (`dormant`) with the card hidden; each feeling-colored word in the read carries a `{cue:lit_<Feeling>}` that lights that slice with its own tone and icon, a 550 ms beat after each; when the prompt ends, any unnamed class slice lights, the wheel wakes, the card appears, and your class's evaluation sound plays (`playClassSigil`) as a throwback. Verified live (Anger, then Fear and Sadness, then awake).
- **His last exercise (outro `TRYFEEL [class]: {feel:X}"line"`):** the wheel comes back without a card: "Find me on your wheel." Each pick redraws the vectorscope against his feeling; his feeling (Sadness for Guns, Anxiety for Bible/Crystals, never shown) closes it into a still circle with the sync chime, and only then does a tap move on ("There. A circle that holds still..."). Wrong picks and taps hold; the tap that makes the match doesn't skip. Verified live.
- **The evaluation can't be skipped:** the FEELZ check-in is a cutscene, so the fast-forward used to skip it; scenes can now carry `unskippable: true` (sceneSequencer), set on feelz-launch. The intake questions were already unskippable. Verified: no skip button on the check-in, still there on the prologue.
- **Title:** the picture is lifted so the lake fills the upper half, and the logo and ENTER sit together in the middle just under it (logo ~42-58%, ENTER right below); the bottom fifth is the dark wash.
- **The tutorial reveals one piece at a time:** the first question shows only him, his words and the wheel and card. Each meter appears as he names it (`{cue:stability|trust|lucidity|integrity}` reveals that icon: statusBar `hidden`/`reveal`), the lake after the dream question (or early on a lie), the scope's lines at `{cue:scope}`, the needle and vectorscope at `{cue:instruments}`, the contacts dock at TRYCALL. Authored as `REVEAL: <meters|debt|scope|instruments|dock> after <node>` or `REVEAL: <piece> on cue` (dialogScene `fireCue`, oscilloscope `getVisibility` fades each in over 1 s). NPCs without REVEAL lines show everything. Verified live: each piece appeared on its exact line.
- **Tutorial (therapist manuscript):** the meters reaction now says what each one does (battery low: your calls get heavy; bars gate who opens up; bars + Wi-Fi needed for calls; the clock skips when you lie), and the outro teaches the scope and its two instruments, the music building and the secret track ("something new come in"), the push-away ("listen to the last thing they say"), and the story ("just listen").
- **Secret track (the hook is built, the music is yours):** name an FL channel starting with "Secret", rebake, and it becomes a part flagged `secret`. It plays silently from the start and fades in (4 s) when the player gets close to a full connection — closeness >= `secretAt` (0.6, one step from trust) — and back out only below 0.45, so it's a sign they're almost there. It has a default organ-type voice until tuned. Sound player: SECRET TRACK toggle, the part shows with a star. Verified with a stand-in part: silent at 0.5, in at 0.7 (0 -> 0.98), held at 0.5, out at 0.4, other parts untouched.
- **Pushed away (`PUSHAWAY [class]`, `showPushAway`):** an encounter that ends without trust gets the number-ask close-up, but cold (grey edge, a drift tone): they push the player away and say what they wish someone had done, one feeling-colored word as the hint, per class (Guns braced, Bible held on to the right words, Crystals absorbed everything). Written for all four NPCs. Verified live on Rwanda (Guns: "...put it **down**").
- **IT/SO on the story (`STORYIT`/`STORYSO`, `showStoryThoughts`):** right after the trauma story, in the same silence: IT weighs how true it rings, SO doubts one corner, never the person. Silent popups, NOT sharpened by the lake (the sharpen tags would turn it on the player). Written for all four NPCs. Not yet checked live (the browser pane was in use).
- **Tension follows the battle's phases, not connection (decided 2026-10-03):** `config.drive: 'phase'` (the game). Each answer given moves the music one step up the ladder (`phaseStates`: guarded > uneasy > tense > agitated), so Rwanda's 4-answer fight goes Intro_B 100 BPM > Intro_Bridge 110 > Verse_001 125 > Verse_002 140 whatever you say or however close you get (verified live). Connection and warm/cold answers no longer touch tempo or sections; connection is reserved for unlocking the secret track (design open: which instrument, when it joins, whether the unlock is saved). The old emotion model is still in the director (`drive: 'emotion'`, selectable in the sound player) for experiments.
- **(Superseded by the phase drive above) Instruments build with the conversation, tension only picks tempo and flavor:** the confrontation plays Intro_A (drums); the battle opens on Intro_B (+bass); from the 2nd answer (`fullAfterAnswers`) every state's section carries all three parts (calm/guarded Intro_C, uneasy Intro_Bridge, tense Verse_001, agitated Verse_002). So a warm run grows into the whole band at 80 BPM instead of thinning out, and a cold run grows into it harder and faster (130-140). `director.answerGiven()` counts answers (called from `encounterMusic.react`); the sound player has an ANSWER button and shows the count. Verified live on Rwanda: drums > +bass > all three at 110 > 114 BPM.
- **What the music follows:** tension comes from how each answer lands (trust+stability delta: warm eases, cold raises, a miss or being caught raises); connection is set outright to the scope's closeness (syncs, bids, misses; 1 once they trust you), so tempo and section track how close you actually are. Checked on Rwanda's real deltas: all cold = guarded > uneasy > tense > tense (130 BPM); all warm = calm (80 BPM) by the second answer.
- **(Revised 2026-10-04) Trauma stories: the music steps back, the voices stay.** Total silence read as dead, so only the music ducks (`audio.duckMusic`, `encounterMusic.duck`: ambient, leitmotif, arrangement); their words type out with the usual ticks and IT/SO pop up with their sting. Verified live: typing 0.019, idle between lines 0 (music out), IT sting 0.12. The split intake reads now name all three class feelings (Guns: heavy/Sadness, Bible: bad taste/Disgust).
- **Who's talking (2026-10-09).** Speech bubbles (`speechBubble`, CSS `.dx-speech` — not `.dx-bubble`, which is the lake tank's bubbles): their lines on the left framed in their accent color with a name tag and a tail up to the portrait; your SAY on the right under a YOU tag with a tail down; narration (hangup) has none. The speaker glows while their words type (`markSpeaking`: portrait, or the call avatar); the portrait dims while you talk. The plate under the portrait is hidden in battles (the tag names them; it also cost the room a long question needs: Deborah's opener overflowed 390x844 by 9px before). The feeling description (feelingIcons.js showBody) now fits the gap between the wheel and the contacts row instead of landing on the contacts.
- **His calls, step by step (2026-10-09).** A Therapist call about a new mechanic is now a short sequence (`nodeCoach` guides, `placeIncoming` steps): each line lights up exactly what he means (spotlight, the rest dimmed, a gold label with a pixel arrow: THEIR LINE, THE FLICKER, YOUR WHEEL, LITTLE SCREEN, or the friend's name in the dock) and the call box moves to the top when the target is low. After he hangs up, one plain line stays by the target ("Try a feeling. Watch the little screen." / "Deborah is here when you want a read.") until the player tries it (any pick, a call, or the next answer). Deliberately observational: he points at what to watch, never which feeling or answer is right (player's decision). The call triggers once the question and wheel are up (not on a timer). The first real battle (Deborah) also gets a short reminder call about the little screen, pointing at each piece in place (their line + yours, the little screen, the needle; "It's not grading you. It's just showing you."); the tutorial keeps its full exercise, jokes and class asides (user: do both). oscilloscope.js gained `rectOf(which)` for spotlighting a drawn piece.
- **What moved: just numbers (2026-10-09).** Tried a big center pop-up of the changed meters flying back to the bar; too dramatic (playtest), removed. What stays: on every change a +1 / -1 number by that meter's icon in the top-right bar, gold drifting up / red drifting down, ~2.4 s (`.dx-status__delta`). The tiny words under the bar are gone. Superseded note follows. **(Superseded) What moved, shown not told (2026-10-09).** The gold meter sentences were too abstract (playtest). Now, right after the player's line (or the reaction, if no spoken line), each meter that changed pops up big in the empty lower middle with its number (+1 / -1), its cells filling or draining (gold good, red bad; the lake as a drop in its current water color), then flies into its spot in the bar / the lake gauge (`meterMoment`, `meterIcon` exported from statusBar.js, Web Animations, never blocks a tap). Every tutorial answer and the first 6 battle answers; after that the bar's own +1 / -1 floats off each icon on every change (`.dx-status__delta`). The tiny words under the bar are gone (the tutorial's naming flash keeps its word).
- **Same day, follow-ups (2026-10-09).** New info in battles now comes as an incoming call from the Therapist (`placeIncoming`): it rings on repeat, the game waits until you tap to answer, he says it in his voice ("It's me. I'm between clients, this'll be quick..."), hangs up, and the piece he talked about glows gold until you do it (coach.until). Replaces the in-place coach lines. He only calls about mechanics the tutorial never showed: a mask, a new friend in your phone (the shape / needle / circle and his number were practiced in his session, so those calls were cut). While it rings his T sits above the dim, glowing, exactly over the dock T (`.dx-call__ringing`; floats near the top if the dock is hidden). The dock T is hidden while it rings (it showed through the dim as a second T) and the lit one uses the same border-box size. The card now says "Swipe to respond." Meter tags now show right after the player's own line (say stage), under the reaction only for answers with no spoken line. Tutorial exercise opens with his class aside for everyone (gun rights / not religious but driven by data / mom's crystal shelf) plus a class comparison; the near comments no longer repeat it. TRUTH / LIE arrows are pixel SVG arrows (the pixel font has no ← →; they fell back small and low), also on the intake's labels. Vignettes off the text: the lie haze sits behind the dialog content (z-index 0), the fear vignette closes in less (40px/12px at 0.55).
- **Learn by doing (2026-10-09, playtest: "too many clickthroughs, not enough interaction").** Therapist outro cut from 35 taps / 740 words to 13 taps / ~265, keeping his humor and class asides (folded into lines he already says). His find-me exercise is one step that teaches by reacting: each pick gets a hint saying what it drew (busy shape = close; needle left = pulling apart) and his own class comment (new manuscript TRYNEAR / TRYFAR: rifling, Jacob and the angel, tuning forks; needle jokes), with that scope piece glowing gold. Meter tags: after every tutorial answer and the first 6 battle answers, gold lines under the reaction say what moved ("Battery ▼ that cost you", "Lake ▲ lies go down easy"), built after the reaction types so a mid-line lake reveal counts. Coach lines (no popups) in real battles, once a run each: a mask, a new friend in the phone, the Therapist's number, the first busy shape / needle-left / circle; each waits for its action (sync, pick, call, swipe) with a gold glow on the piece. The science of the screen moved to the first call to the Therapist in a battle (contacts.js explain, with the interval tones). FEELZ tip popups switched off (TIPS_ENABLED = false; code kept). Fixes: the opening Toback quote's second screen opens with a quote mark (it was rendering as grey narration); the hung-up call no longer resizes the portrait (a comment had split the hung-up fade rule, so the portrait picked up the scope band's top/height; restored the fade). Crash report (restart in the third-floor hallway): a muted scripted run Therapist -> walk-home -> hallway threw no errors, heap ~13 MB; waiting on the tester's device and browser. Known: Guns only sees the near comment in the exercise (both non-target Guns feelings are two steps from Sadness) unless a gifted feeling is far.
- **Rest by outcome, the walk out, his voicemail (2026-10-04).** Rest moved from encounter start to encounter end (`restAfter` in cardEngine): connected -> battery +3 (soft-capped, can pass 5); otherwise up to +2 toward 5, never down. Shown as a short exit beat (`showRest`: THEY LET YOU IN / YOU WALK IT OFF / STILL CHARGED, a 10-cell pixel battery with the new cells charging in gold, one blip per point, tap to go on); not in the tutorial. Calling the Therapist below bars/Wi-Fi 4 rings out to his voicemail (`voicemailFor` in contacts.js: names what's low, bars / Wi-Fi / both), once per encounter, then the plain fail. Tutorial says both ("It charges back between people, more if they let you in", "You'll get my voicemail"). Verified live: voicemail at Wi-Fi 3, exit beat +2 after Samun.
- **Five fixes from the audit (2026-10-04).** (1+2) Meters: a soft cap in `applyStatDelta` (`softStep`, SOFT_BAND 3..7: past the band, moving further out costs 2 points per step) and rest between people (`restBetween`, battery only, 2 toward 5 at each non-tutorial encounter start). Sim: all-truth red-battery answers 17/19 -> 0, pinned-meter answers 55 -> 29 (mixed play 0). Rest originally covered all meters but floored trust at 5 before Rick, making his shut-down unreachable; now battery only, and Rick's GATE moved trust < 3 -> < 4 (random runs reaching it: 2.7% old, 1.2% now). (3) One fog rule: calls blur below Wi-Fi 4 (`FOG_WIFI`), the same line as the Therapist and tips (was debt 6). (4) Tips sit just above the contacts row (`attach(stage, floorEl)`), slimmer; measured clear of the dock at 400x860. (5) `forgetMeters()` on chapter mount (no phantom meter changes after a restart or debug jump); the Therapist's bars/Wi-Fi warnings now fire at exactly 4 (they needed <= 3, below his own cutoff) and pick the lowest low reading.
- **Therapist's parting watch-out (2026-10-04).** New outro line type WATCH [stability|trust|lucidity|integrity|lake|steady] (build-content turns it into a LINE with `watch`; dialogScene `watchFor` keeps only the match): lake if debt >= 3, else the lowest meter if <= 4, else steady. Plays just before HANGUP. Tutorial paths land on: all truth -> battery (honesty drains it), lie-truth-lie -> bars, truth-lie-lie -> clock, all lie -> lake, lie-lie-truth -> steady. The Wi-Fi line can't come up in the tutorial (it doesn't fog), kept for completeness.
- **Data audit of the Wi-Fi change (2026-10-04, scratchpad sim of 6 play styles).** Fixes: (1) the tutorial doesn't fog (resolveCard `{ fog: !npc.reveal }`), so a tutorial liar leaves at Wi-Fi 4 instead of 2; (2) epilogues are now high/low per meter (endings.json `{ high, low }`, `getEpilogueLine`): the old one-direction lines told an honest player "Integrity never came back" and a Wi-Fi-0 liar "You saw it clearly." FEELZ tips now stay until tapped closed (✕). Known, left alone: Wi-Fi pins at 10 for anyone lying under about half the time (truth +1/+2 vs lie -1), so only mostly-liars lose tips; the Therapist's Wi-Fi/bars health lines (value <=3) can never play because he won't pick up below 4.
- **Lies fog the Wi-Fi; tips need it (2026-10-04).** Lucidity only ever rose (one Therapist lie aside), so any gate on it never fired. Now every lie with no authored lucidity change applies LIE_FOG -1 (engine/cardEngine.js), the tutorial says so ("Every lie fogs it a little"), and FEELZ tips show only at lucidity 4+ (two arcs; a skipped tip is not used up). The Therapist's existing call gate (bars and Wi-Fi 4+) now actually bites for liars. Popup layering: body line 450 < calls/connect 470 < tips 480 < IT/SO 500.
- **The science of the scope, by class (2026-10-04).** After part one of the exercise the Therapist explains it plainly (Lissajous figure: your feeling drives x, theirs y; same speed a circle, different speeds tangle; wheel neighbors are simple ratios, opposites the tritone; the needle is phase correlation), then reluctantly gives a class metaphor with a disclaimer about himself: Guns rifling ("I don't own a gun. You're within your rights to"), Bible Jacob and the angel ("I'm not religious... bear with me, I'm driven by data"), Crystals tuning forks ("My mom was into all that... I didn't inherit it"). Needle metaphors follow (same target / praying for the same thing / auras in phase). Adds about 5 taps. The science lines play the intervals as he names them ({cue:tone_unison|tone_fifth|tone_tritone} -> audio.playIntervalDemo, two struck triangle tones with the music ducked). Character note: he reads as ADHD/neurodivergent (awkward self-awareness out loud, data-driven, neutral about the job); keep that voice.
- **The opponent's weather (2026-10-04).** Each opponent seasons their side of the screen (`ui/opponentFx.js` + `.dx-opfx--*`): Deborah wet ink, Rwanda paint-over, Samun last call, Rick engine heat, Therapist bad connection. Portrait, their words (text-shadow only), scope band and a canvas behind the content; meters, lake, card, wheel, dock untouched (checked: card filter none, status bar transform none). Driver: phase ceiling x closeness (trust clears, sync settles 1.4 s), pulses on master loudness. Note: rAF doesn't run with the browser pane hidden, so verify visually with the pane open.
- **Scope taught by doing, reminded by FEELZ, meters you can see (2026-10-04).** Therapist exercise is now two TRYFEEL steps (`{want:miss}`, then a `{mask:Happy}` find step; new tags in SCRIPT_FORMAT). The vectorscope now compares against the real mood, not a mask (so "the shape doesn't lie" holds in every battle; it used to answer to the cover). Mask flicker lengthened (420 ms every 2.2 s). FEELZ tips (`ui/feelzTip.js`, `showTip`/`scopeTip` in dialogScene, `run.tipsShown`): mask, shape, needle, circle, dots, once a run, not in the tutorial, with a gold frame on that piece (`getHighlight` in oscilloscope.js). Status bar: changed cells animate (`is-gain`/`is-loss`), sparks on a rise, glitch on a drop; the clock text moved into its own span so sparks survive the tick. Verified live: both exercise steps (hint text, hold until done), mask and shape tips with frames, 23 animated cells after an answer.
- **Lying feels good; the cost is quiet (2026-10-04).** Playtest: the lake "doesn't move" and nothing tempts you to lie. The numbers already moved fast (+2 to +4 a lie, a forced Reckoning at 10 inside Deborah), so instead of harsher debt the lie is made pleasant and the cut-off removed. (1) Debt 10 no longer jumps to the Reckoning: all four NPCs are always met, debt only picks the ending. (2) Warm water: an amber haze from the edges (`.dx-haze`, `--haze` from `engine/lake.js hazeFor`) and a master low-pass (`audio.setHaze`, 20 kHz to 2.4 kHz) thicken with debt; reset on dialog unmount. (3) Relief: `audio.playRelief` (rolled C major, triangle, ringing) on every lie; IT/SO co-conspirator pairs (`COZY_LINES`) on a streak of 2+, once per encounter, deferred if a bloom fires, never sharpened. The debt-10 bloom lines rewritten (bottom of the lake, warm, not a verdict). Comforting lies count as bids for Deborah, Samun, Rick (BID: lie). (5) Quiet cost: from debt 6 (`FOG_DEBT`) calls lose their color and the wheel hint, and the friend adds a `foggy` line. Each contact now words all 8 moods in their own voice (`moods`, 40 lines). Tutorial: two new Therapist lines naming the pull and the cost. Endings gallery chips on the chapter card. Verified live: haze at debt 7, relief + IT/SO cheer on the 2nd lie, debt 10 keeps Deborah going.
- **Trauma stories are told in silence (`showConnection`):** when the story starts, their bust comes up close and centered (same layout as the number ask), `audio.hush()` drops the whole mix (music, chord, typing), and `audio.unhush()` fades it back over 3 s when the last beat is done. Unmounting always unhushes. Verified: RMS 0.028 before, 0 during, 0.02 after.
- **Left:** the other three NPCs have no arrangement yet; the Bridge section isn't on the ladder; tempo-synced effects and reference-stem A/B aren't built; the FL playlist order is unread.

**Open (raised 2026-09-30, not decided):**
- **No node MOOD is Trust any more** (2026-10-01): Rwanda Q4 → Anxiety, Rick's enabled Q2 → Anger. Trust is earn-only, so a Trust mood could almost never be matched.
- **Art guide** (`docs/ART_GUIDE.md`): every asset with draw size, display size, format, frames, status, and its template in `art-templates/` (12 PNG templates with guide lines; regenerate with `node scripts/make-art-templates.mjs`).
- **Cleanup**: removed the old full-page report and its one-liner (`feelzReport.js` keeps the data the fax uses), the title skip dialog, and ~35 CSS rules nothing rendered any more.
- **Title is the front door** (2026-10-02): boot always lands on the title (chapter deep links still honored). ENTER: first time → straight into the story; played before → chapter select. Finishing or quitting a chapter returns to the title (settings button is now QUIT TO TITLE); chapter select has a TITLE SCREEN button. A returning player picking a chapter (mouse or touch) is asked SKIP STORY / FROM THE START; the old skip dialog on the title is gone.
- **Chapter cards** (`main.js` renderMenu, `CHAPTERS[id].banner`): each chapter is a banner card whose art pans forever and boils, tinted, under a wash for the title, with NEW / PLAYED ✓. Hovering a card with a mouse fills the screen behind with the same art, black and white, magnified, panning slowly, with a fainter, larger echo drifting the other way, a few soft notes of the chapter's motif ring first, then its ambience crossfades in low under the last echo; everything (scheduled notes too) fades out on leave or entering the chapter (`CHAPTERS[id].ambience`: `src` loop + `motif` notes; Lake Ulysses: lk_01 lake ambience, E4 G4 B4 A4). On touch, tapping a card shows the art and plays the preview, then asks "Ready to play?" (played before: SKIP STORY / FROM THE START, via `skipTo`). Lake Ulysses uses the title lake tinted teal as a PLACEHOLDER until it has its own art. Banner art = a vertical sheet of seamless tiles (same format as the title lake): give `src`, `frames`, `tile` [w, h], `tint`.
- **Title intro** (`main.js` renderTitleMenu, art via `scripts/import-gm-title.mjs` from the GameMaker beta): the dithered Lake Ulysses panorama (spr_title_bg, 7 frames) fades in and pans forever (each frame made a seamless tile at import: its right edge dissolves into its left with a Bayer-dither crossfade; a two-tile strip slides one tile per 60 s while the frames still boil); the DREAM XTREME logo (spr_game_title, still boiling, 13 of its 73 frames) arrives split, top half from the left, bottom from the right, in NES steps; they slam with a clang (`playLogoSweep`/`playLogoSlam`), a white flash and shake; the logo strobes; then ENTER (no subtitle). Tap skips. Art as palette PNG sprite sheets in public/assets/shared/title (~330 KB).
- **Ending rebuilt** (`endingScene.js`, `ui/feelzRecord.js`): final reading → story slides with image placeholders (endings.json `images` for art) → epilogue → closing quote (endings.json `quote`/`quoteBy`) → ending card → the record printed by a pixel fax (handshake, per-line print head and chirp; tap rushes it with a jam sound and a smear scratch) → SAVE AS PNG, an official FEELZ certified copy with letterhead, seal, signatures and company lore (Halberd & Lowe Affective Systems, Agreement LU-77; PLACEHOLDER lore). The old water/report pages are folded into the record.
- **Masks** (MASK lines; Samun ×4, Rick ×3, first two questions): the shown feeling differs from the real MOOD; tells are the prompt's colored word, a blink of the real color on the oscilloscope, the grind on picking the mask, and contacts' reads. Therapist outro plants it. Difficulty is now reading, not reachability (balance script still shows every route possible).
- **Earned stories** (STORY lines, `showConnection`): connecting plays a five-beat first-person cutscene of each NPC's trauma (one per character). Rick's ties to Gabriel; hearing it puts Rick on the bank at the Reckoning's gate (`run.storiesHeard`).
- **Dialogue always in quotes** (2026-10-02): every NPC PROMPT (58 lines across manuscript + handoff copies), every speaker cutscene beat (Bob Baiter, the confrontations), the epigraph; calls, the player's SAY and future speaker beats are quoted at render (`ui/speech.js`). IT/SO stay unquoted (thoughts).
- **Narration styling** (tester note, `typewriterText.js` markNarration): ( ) and [ ] text, and anything outside quotes in a quoting line, render grey and slanted; quote-less reactions are all narration.
- **Class codas** (`engine/reactions.js` CLASS_CODAS): 48 closing lines, per class × feeling × truth/lie, alternating with each NPC's own coda so a pick never closes the same way twice in a row. In the writer handoff as [class-coda / …] lines (`npm run handoff`).
- **Feeling context clues** (2026-10-02, `ui/feelingIcons.js`): pixel icons on the wheel slices (flame, wide eye, raindrop, sun, knot, ugh-face, spark, open hand) replace the glyphs; body-sensation lines on hold and on each feeling's first 3 picks, written per class (24 lines); a short screen reaction per feeling on hold and pick; a one-shot pixel burst from the slice on every pick.
- **Class balance** (2026-10-02, `scripts/balance-check.mjs`): Bible could never earn Deborah's trust and Guns had a narrow route with Rwanda. Fixed with two mood swaps: Deborah's soft opener Sadness → Anxiety, Rwanda's soft opener Anxiety → Fear. Every class can now reach every NPC (Bible × Deborah only via the soft opener). Samun and Rick are reachable on every route for every class: maybe too easy, a difficulty question for later. Rerun the script after any MOOD/BID change.
- **FEELZ feeling contradictions** (proposed): TOPIC tags per node; picking
  the opposite feeling on the same topic with someone else pings a FEELZ
  note and costs a sync; the ending report counts "incongruent affect."
  Waiting on a topic list.
- **Answer speed** only drives IT/SO comments today. Options: speed reads
  as not listening (widens the scope gap), or a pacing note in the FEELZ
  report.
- Still open from before: scene moves (Deborah's garden, Rwanda's mural,
  Samun's crosswalk), portrait art, walk stills, Samun's layered clothes,
  Deborah's tune.

**Done in the 2026-09-30 session:**
- **Gameplay mechanics**
  - *Same-person contradictions* (CAUGHT): contradict yourself in front of
    someone and they call it out themselves. -2 syncs, TRU -1, the bid on
    that answer doesn't count; correcting yourself (lie, then truth) never
    counts. 8 pairs, two each for Deborah, Rwanda, Samun, Rick. Word-travels
    contradictions (IT quotes you, -1 sync) are unchanged.
  - *Oscilloscope as connection*: a band across the portrait. The gap
    between their line and yours is how close they are (syncs, bids, minus
    misses this encounter); it merges when they trust you; holding a
    feeling previews it. Your line wears your feeling's color; a strip of
    blocks shows this encounter's picks (newest outlined). Shut out: your
    line greys, theirs flatlines.
  - *Status bar that teaches itself*: pixel-sprite icons; when a meter
    moves the icon pulses (up) or flickers (down), its word shows under the
    bar (honest / connected / clear / steady), and a two-note blip rises or
    falls, pitched per meter.
  - *Swipe lean*: the card leans into TRUTH or LIE as you drag, that label
    grows and takes its color (cool / warm, never green / red), and a stamp
    fades in.
  - *Lake on a lie*: lie on the therapist's check-in and he points at the
    lake mid-reaction, after the bars (new `{mark:name}` text cue).
  - *Trying his contact* (TRYCALL outro line): his contact pops into the
    dock and you have to call him while he's on the line; his "Hello?"
    echoes back with feedback, then he explains calls.
- **Voices and sound** (SAM via `sam-js`, `shell/voices.js`)
  - Per-character SAM voices: reaction barks (up / down / flat), call
    greeting and goodbye, a farewell when a trusted NPC swaps numbers. The
    tutorial call ends on his "Take ca—" cut off by the hang-up tone.
  - Per-person ringtones; hang-up tone; disconnect sounds (drift on a
    miss, signal-lost when shut out). License caveat: the SAM port
    reverse-engineers a commercial 1982 product whose holder (SoftVoice)
    couldn't be reached; decide before a commercial release.
- **Intake and therapist**
  - The class intake is FEELZ evaluation part 2 (app bar, progress, demo on
    Q1, tap-to-answer), then FILE CREATED / results sealed / the provider
    card, then his colored-word read.
  - The therapist is Charles Browning (he/him). On screen he's only
    THERAPIST; the name appears once, on the provider card. Accent is
    clinical grey `#9aa0a6`.
- **Pastor Gabriel's entrance**: death-clock ticks, three C64 bell tolls
  (Storm Lord style), a slow stepped fade-in of his placeholder bust
  (`ui/pastorBust.js`), SAM greeting; name hidden until he says it; the
  lake gauge waits for the first confession; SAM "Amen." / "Shame." /
  "Samael." during the reckoning.
- **Tutorial points at each meter**: as the therapist names battery, bars,
  Wi-Fi and clock, that icon flashes, shows its word and plays its blip
  (`{cue:name}` typewriter cues).
- **Class reveal rework**: the standalone THERAPIST diagnosis screen is gone. FEELZ · PROFILE READY stamps EVALUATION COMPLETE, lights your three starting slices on the pixel wheel, and plays a class sigil sound (`audio.playClassSigil`: echoing gunshot / singing bowl / reverberant choir); the therapist says the class read as his first line, reading your intake ({intake} token). His per-class OPENER lines retired (the read replaces them). Reads rewritten 2026-10-02: each quotes one of your intake answers back, names the class's struggle (bracing / holding on / absorbing) without naming the class, and carries one quiet nod to its lens (trigger, safety; chapter and verse, Thomas; energy, prism).
- **FEELZ boot logo as pixel art** (`ui/feelzSilhouette.js`): the wheel drawn on a 48×48 canvas scaled up pixelated, with a seamless rainbow wave (a cyclic blend of the eight feelings, no tile seams).
- **Debug menu** (Settings → DEBUG, `shell/debug.js`): pick a class, a lake level (0–10), ALL FEELINGS on/off, EVERYONE TRUSTS YOU on/off, then a scene button (grouped Opening / Therapist / each NPC / End) restarts the chapter right there with that state. New scenes show up under OTHER automatically. The gear and skip buttons are pixel icons now.
- **FEELZ in logo colors everywhere** (`shell/feelzWord.js` + typewriter).
- **Contact colors**: each contact in their dominant feeling's color (dock, call box); the read is written in the read feeling's color; misreads project their own feeling (`engine/contacts.js` dominant).
- **IT and SO**: name plates under the icon; on their last lines with
  Pastor Gabriel they pry open into SHIT and SHOW (plain again on the final
  screen); a howl duet as they walk you into the water, from clean to
  disturbing with the lake.
- **Fixes**: fish swim at all times (the earlier "static" ask meant the
  gauge's position); contacts dock and call box sit above the water meter.

**Done in the 2026-09-27 session** (from `devnotes/Sep 27 at 12_35 PM.md`):
- Bigger text that scales with the canvas; the canvas fills the viewport
  height (iPad). Long text pages at sentence ends. Fixed a stray-space
  indent on wrapped lines.
- Bob Baiter: GameMaker announcement symbols ported
  (`scripts/import-gm-symbols.mjs`, beat field `symbolAnim`), centered
  over his head, frames preloaded. Eleven new lines unveil the lake gauge
  (beat `art: lakeGauge`) and teach it in his voice.
- New class emotion sets: Guns Anger/Fear/Sadness, Bible
  Anxiety/Disgust/Fear, Crystals Happy/Anxiety/Surprise. Anxiety replaced
  Anticipation, Joy became Happy, Trust is unlock-only. New palette.
- Therapist: plain-advice homework, a FEELZ notification with Deborah's
  profile (`NOTIFY:`, with a ping), and an intrusive-thoughts question
  where IT/SO answer back (per-answer `IT:`/`SO:`).
- Ending in three pages with the FEELZ clinical summary; class revealed
  as a diagnosis; SO answers IT's last word.

**Later the same day:** Trust (moods, sync, bids, `run.bonds`), the battle
hit on every answer, feeling unlocks (`engine/unlocks.js`, one per NPC
plus the Therapist demo), the dramatic slice entrance, varied reactions
(`IF PICK` / `IF GIFT`), the connection moment (`CONNECT`), cleaner HUD,
homework as advice, and the walk-home cutscene. See GAME_MANUAL "Trust"
and "Filling the wheel", SCRIPT_FORMAT for the new lines.

**Then (2026-09-27/28):** phone status bar (`ui/statusBar.js`), contacts
(`engine/contacts.js`, Therapist always, gated on bars + Wi-Fi), IT/SO pace
pressure (`engine/itPressure.js`), text speed setting, the stay-in-touch
bust at the end of a trusted encounter (`CONTACT`), Trust surfacing on
the next wheel instead of a pop-up, lake gauge pinned in place in encounters (fish keep swimming).

**Still open from the Sep 27 discussion:** scene moves (Deborah's garden,
Rwanda's commissioned mural, Samun's crosswalk), the Therapist and NPCs
speaking to each class, class screen redesign, IT/SO meaner as the lake
worsens, the consistency check (contradiction pairs), portrait art for
calls and the bust (letters for now), iPad scaling of the wheel and
portrait, walk stills, Samun's layered clothes, Deborah's jolly-dissonant
tune.

**Next:** the consistency check (contradiction pairs), scene moves, class
screen redesign. The connection beats and reaction variants are
placeholder prose for the writer.

**Still open from that discussion:** the full feeling-unlock system (one
feeling per character), class screen redesign, scene moves (Deborah's
garden, Rwanda's mural, Samun's crosswalk), walk stills, contacts.

**Open from the 2026-09-24 playtest round** (tutorial, lake, Pastor). All
of these are decided or at least scoped; see the linked sections:
- **IT/SO observer voice for the older tables.** The new finding,
  gatekeeper and Therapist-outro lines use the "detached observers /
  countdown grim reapers who never admit they're against you" voice
  (`IT_DESIGN.md`'s "Findings, not commentary"). The bloom, emotion-lean
  and SO rebuttal tables (~50 lines) still use the earlier voice.
  Rewriting them would also drop IT's per-class voices, so it's **waiting
  on the designer's OK**.
- **Therapist reads the check-in back.** One line in his call ("You put
  'nearly every day.' Okay."). This was proposed but not built. Only the
  ending comparison was chosen.
- **More ways to clean the lake** (proposed, not chosen yet): the lake
  settles between visits after a truthful encounter, cheaper lies, a
  mid-conversation "take it back" branch, and a Reckoning that covers
  every lie instead of the last 3.
- **Audio is untuned.** The FEELZ boot chime is a placeholder, and the
  lake splash hasn't been listened to on real devices yet. Tune volume
  and pitch by ear.
- **Art jobs.** Pastor Gabriel (none yet), IT/SO as hellhounds (they
  reuse the IT popups today), the baptism underwater moment.
- **Playtest the new opening end to end** on a phone: FEELZ check-in →
  intake → Therapist spotlight tutorial → first NPC. Watch whether the
  spotlight and the lake reveal land without any explanation.

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
- ~~SO — a second voice answering IT~~ — done: bloom events and the
  dominant-emotion read now get a rebuttal chained right after IT's own
  line, grounded in doubt rather than reassurance (`IT_DESIGN.md`'s
  "SO — the doubt rebuttal"). Also fixed the actual repetition complaint
  that motivated it — the dominant-emotion line reading off a cumulative
  tally that rarely changes, so the same sentence could fire after every
  NPC in one sitting.
- ~~Reaction codas were one shared 16-line table for all 5 NPCs~~ — done:
  `engine/reactions.js` now has a dedicated table per NPC, voiced in that
  character's own imagery (Deborah's kitchen/bible, Rick's bar/patch,
  Rwanda's window/cigarette, Samun's rag/bottles, the Therapist's phone
  line) instead of one line landing identically on a grieving mother and
  a biker gang enforcer. `DEFAULT` keeps the original shared table as a
  fallback for any NPC that doesn't have one yet.
- ~~A third node on all four confrontation NPCs~~ — done: `deborah_03`,
  `rick_03`, `rwanda_03`, `samun_03`. Both existing second-node branches
  (confronted/enabled, open/closed, etc.) now funnel into one shared
  third node per NPC instead of ending there; that node closes the arc.
  Placeholder prose, same bar as the rest of the content — written to be
  read, just not final. `rick_shut_down` (the trust-gated lockout) was
  left as a one-node dead end on purpose; it's supposed to be curt.
- ~~A fourth node on all four confrontation NPCs~~ — done: `deborah_04`,
  `rick_04`, `rwanda_04`, `samun_04`, continuing straight on from each
  NPC's third node the same way node 3 continued from node 2.
- **More depth in Lake Ulysses** — still open: Bible/Crystals-class-aware
  FEELZ options on existing nodes. Pure content through the manuscript
  pipeline, no engine changes.
- ~~IT hint-system word-tinting~~ — done for 2 of the 4 originally-scoped
  placements; see `IT_DESIGN.md`'s "IT is the hint system". Entering a
  room/exiting a scene are deferred — real new content across every mini-
  game room, not a rendering change like the two that shipped.
- ~~Solid backing behind dialog/questionnaire text~~ — done:
  `.dx-game-content` (`scenes.css`) was transparent over the live
  `.dx-pattern-bg` noise canvas, making small/colored text hard to read
  fast (worst at the questionnaire diagnosis reveal, where the colored
  words are the whole point). Now opaque black; the pattern still shows
  as a frame in the 16px margin around it. `endingScene.js` was already
  correct — its pattern-only judgment beat has no text at all, and clears
  before any text renders — so it wasn't touched.

- ~~Mini-games for Rwanda / Samun / Rick~~ — done, all four exist and play.
  Art and prose are placeholder; see `ASSET_GUIDELINES.md` for the hand-off
  spec on replacing them.
- ~~Pre-battle confrontations~~ — done, one per NPC. Not a new scene type: a
  cutscene with `opensDialog` plus an `opener` on each choice, which writes
  the node the following dialog scene starts on (`SCENE_TYPES.md`). Adding
  more branches is authoring two things in step — a manuscript node and a
  matching option.
- ~~Real prose for the placeholder beats~~ — turns out already done. The
  file headers in `minigames/*.js` still say "PLACEHOLDER CONTENT," but
  that's stale — all 4 room intros ×3 classes, all 12 hotspot captions ×3
  classes, and all 4 confrontation openers read as finished prose, not
  code-path filler. The placeholder part is genuinely just the *art*
  (generated SVG vectors), not the writing.

- ~~Make the oscilloscope's two traces actually interact~~ — done: a
  `coherence` value (the *worse* of the NPC chord's consonance and the
  player's own clarity, not an average) drives real beat-interference
  between the two traces' frequencies plus a partial color blend, kept as
  a pure drawing-parameter effect rather than real audio signal mixing.
  See `STAT_MATH.md`'s "Trace interaction — coherence".

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
  `ann_01.mp3` is sourced but destination scene TBD. Dialog portraits
  specifically: the mood-mask that recolors a portrait live by trust/
  stability (`STAT_MATH.md`'s "Dialog portrait mood-mask") is already
  built and confirmed against real art — it just has no real portrait
  image to run on yet. Needs real light/dark value contrast to read well
  (a flat silhouette won't show the effect); a manuscript's `PORTRAIT:`
  header wires a new image in with no other code changes.
- A second writer actually using the manuscript pipeline.
- ~~A pipeline for composer-authored NPC leitmotifs~~ — done:
  `src/chapters/lake-ulysses/midi/*.mid` -> `npm run build:leitmotifs` ->
  `content/leitmotifs.json`, see `STAT_MATH.md`'s "Per-NPC leitmotif"
  section. Deborah has a real composed phrase now (`midi/deborah.mid`,
  17 notes). Rwanda, Samun, and Rick are still on their hand-typed
  placeholder phrases (`audio.js`'s `LEITMOTIFS` fallback) until a `.mid`
  exists for each.

## Build version stamp

Bottom of the main menu (`CHAPTERS` screen), low-key: `BETA · v0.1.0 ·
build 70 · fc2e270`. No manual bumping — `vite.config.js` injects three
build-time constants (`__APP_VERSION__` from `package.json`,
`__BUILD_NUMBER__` from `git rev-list --count HEAD`, `__COMMIT_HASH__`
from `git rev-parse --short HEAD`), rendered in `main.js`'s
`renderMenu()`. `BUILD_NUMBER` is the auto-incrementing part — every
commit on the branch bumps it by one, nothing to remember to update.
`APP_VERSION` stays the human-controlled major.minor.patch in
`package.json`; bump that manually for an actual release milestone.

Requires full git history at build time, which a GitHub Actions checkout
doesn't have by default (shallow clone, depth 1 — `git rev-list --count`
would always read back 1). `.github/workflows/deploy.yml`'s checkout step
sets `fetch-depth: 0` for exactly this reason — don't remove it.

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
