# Dream Xtreme

An episodic interactive zine. Each chapter is a self-contained short
story played with a swipe, tap, or click — mouse and touch both work the
same way. Native JS, no UI framework, deployed as a static site.

Live at **[dreamxtre.me](https://dreamxtre.me)**.

## Quick start

```bash
npm install
npm run dev
```

Opens a dev server with hot reload. Build for production with
`npm run build` (outputs to `dist/`), preview that build locally with
`npm run preview`.

Writing dialog? Start with [`docs/GAME_MANUAL.md`](docs/GAME_MANUAL.md)
(what the game is) and [`docs/SCRIPT_KEY.md`](docs/SCRIPT_KEY.md) (the
one-page working reference), then run `npm run build:content` to generate
the JSON the game actually reads.

## Structure

- `src/main.js` + `src/shell/` — the app shell (title/menu/about, routing,
  save data, input handling, global fx/audio feedback)
- `src/engine/` — framework-agnostic game logic: the scene sequencer, plus
  Truth Debt/ledger/ending logic
- `src/scenes/` — reusable scene-type handlers (dialog, reckoning, ending)
  that chapters register with the sequencer
- `src/ui/` — reusable DOM components (swipe card, FEELZ wheel, meters...)
- `src/chapters/<id>/` — one self-contained chapter each, with
  `manuscript/` (writer-authored source) and `content/` (generated JSON)
- `public/assets/<id>/` — chapter art/audio; `public/assets/shared/` for
  cross-chapter assets
- `scripts/build-content.mjs` — the manuscript → JSON build tool
- `scripts/build-manual.mjs` — the docs → browsable HTML manual build tool

### Reading the docs as one page

[`docs/manual.html`](docs/manual.html) is all of the docs below in a single
browsable file — sidebar, per-document contents, and search. Just open it;
it's committed to the repo and needs no server or build step.

It's generated from the `.md` files, which stay the source of truth. After
editing docs, regenerate it:

```bash
npm run manual
```

Docs, in the order you'll want them:

- [`docs/GAME_MANUAL.md`](docs/GAME_MANUAL.md) — what the game is, how it
  plays, the Chapter 1 beat list and full cast. **Start here if you're a
  writer or artist**, then go to `SCRIPT_KEY.md`.
- [`docs/SCRIPT_KEY.md`](docs/SCRIPT_KEY.md) — the writer's quick
  reference: where every line lives, the inline pacing codes, and the
  measured length budget per text slot.
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — project status, key decisions and
  why, what's deliberately not built yet. Start here if you're coding.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the shell, chapters,
  and scene sequencer fit together.
- [`docs/SCENE_TYPES.md`](docs/SCENE_TYPES.md) — the scene handler
  contract for every scene type, plus the one still unbuilt (mini-game).
- [`docs/ASSET_GUIDELINES.md`](docs/ASSET_GUIDELINES.md) — preparing art
  and audio: formats, naming, size budgets, and the encode gotchas.
- [`docs/ASSET_MANIFEST.md`](docs/ASSET_MANIFEST.md) — the artist's
  checklist: every asset Chapter 1 still needs, one row per file, with
  its exact path, dimensions, and placeholder status.
- [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md) — the dialog JSON
  format, what the stats mean, and the asset folder convention.
- [`docs/SCRIPT_FORMAT.md`](docs/SCRIPT_FORMAT.md) — the plain-text
  manuscript format for writing dialog without touching JSON.
- [`docs/STAT_MATH.md`](docs/STAT_MATH.md) — the math layered on top of
  the stats (Emotional Lean, the ending epilogue), and why it stays
  simple on purpose.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds
with Vite and publishes `dist/` to GitHub Pages. The custom domain is set
via `public/CNAME` (already in the repo), which Vite carries into every
build automatically.

Already set up for this repo; see `docs/HANDOFF.md`'s "Deployment"
section for the full GitHub Pages + GoDaddy DNS configuration if you ever
need to reproduce or debug it (e.g. on a repo transfer or a new domain).
