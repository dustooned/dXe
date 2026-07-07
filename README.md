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

Writing dialog by hand as plain text instead of JSON? See
[`docs/SCRIPT_FORMAT.md`](docs/SCRIPT_FORMAT.md), then run
`npm run build:content` to generate the JSON the game actually reads.

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

Docs, in the order you'll want them:

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — project status, key decisions and
  why, what's deliberately not built yet. Start here.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the shell, chapters,
  and scene sequencer fit together.
- [`docs/SCENE_TYPES.md`](docs/SCENE_TYPES.md) — the scene handler
  contract, including the planned (unbuilt) cutscene and mini-game shapes.
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
