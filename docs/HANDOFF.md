# Handoff / Project Status

Last updated: 2026-07-06. Read this first if you're picking this project
up cold — it's the "why," not the "what" (the code and the other docs in
this folder cover the what).

## What Dream Xtreme is

An episodic interactive zine hosted as a static site on GitHub Pages.
Each chapter is a self-contained short story/game played with a swipe,
tap, or click — same interaction model on mouse and touch. Native JS, no
UI framework, Vite for dev/build only.

## What's actually playable right now

One chapter: **Truth Debt: Lake Ulysses**. Title screen -> chapter menu
-> About/Contact -> Prologue (typewriter-drawn narrative cutscene) ->
Deborah -> Rwanda -> Samun -> Rick (dialog, swipe truth/lie) -> Reckoning
(confess or double down on your lies) -> one of four endings (Clean Cut /
Functional Mask / Collapse / Living Lie) based on final Truth Debt.
Progress (which endings you've seen) persists in `localStorage`.

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
  mini-games — both wanted, neither built yet — have a well-defined slot
  to drop into later without another rewrite. See `SCENE_TYPES.md` for
  the contract, including the planned (unbuilt) `cutscene` and
  `minigame` shapes.
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

## Stats — what's wired up and what isn't

Four meters (Integrity, Trust, Stability, Lucidity, 0–10) plus Truth Debt
(0–10, separate). Full semantics are in `CONTENT_SCHEMA.md`; the math
layered on top (Emotional Lean, the ending epilogue) is in
`STAT_MATH.md`. Truth Debt remains the only stat that *branches*
anything (bloom-event thresholds, forces the Reckoning at 10, picks the
ending tier) — that's unchanged. The four meters now feed one thing: the
ending epilogue line, which names whichever meter moved furthest from
baseline. **They still don't gate or branch any content** — no dialog
option is unlocked or blocked by a meter value yet. Meter-gated branches
(e.g. an NPC refusing a dialog option below a trust threshold) remains
the next real step there, and doesn't require any architecture change —
the data's already there, it just needs a consumer, same as the epilogue
was.

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
4-ending set. What's still not in:

- **The FEELZ Dartboard** (`DX MECHANICS.md`) — a much richer
  emotion-zone-mapping system than the 3-button picker in the demo. The
  current FEELZ wheel is a placeholder UI wired to the same node data
  shape, so upgrading it later doesn't require touching content files.

## Known gaps (not bugs, just not done)

- No real art. NPC portraits are colored initials (`ui/npcPortrait.js`).
  Audio is placeholder oscillator tones (emotion stems, per-NPC
  leitmotifs, hit sounds) — no real instrumental loops or SFX. Asset
  target sizes are noted in `CONTENT_SCHEMA.md`.
- Cutscene has real content (the Prologue); mini-game has none, and no
  concrete concept picked yet — see "What's next" below.

## What's next

Roughly in order of how ready each one is to just start:

**Ready to build, no further design needed:**
- ~~Ending judgment beat~~ — done (`SCENE_TYPES.md`'s `ending` section).
- **More depth in Lake Ulysses** — additional dialog branches, possibly a
  Bandlands tutorial beat before the Prologue. Pure content through the
  manuscript pipeline, no engine changes.
- **FEELZ Dartboard** (`DX MECHANICS.md`) — the richer emotion-zone
  system, replacing the current 3-button placeholder wheel.

**Needs a dedicated design pass first:**
- **Meter-gated branching** — see "Stats" above.
- **Mini-game** — the sequencer already supports the type for free
  (proven by how cheaply `cutscene` slotted in); still no concrete
  concept. Best candidate so far: a point-A-to-B explore beat in
  Deborah's condo hallway.

**Needs something from outside this repo:**
- Real art/audio assets — folders are ready (`public/assets/`), nothing's
  in them yet.
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
  will work before `https://` does.

## Running it

See the root `README.md` for `npm install` / `npm run dev` / deploy.
