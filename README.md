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

## Structure

- `src/main.js` + `src/shell/` — the app shell (title/menu/about, routing,
  save data, input handling)
- `src/engine/` — framework-agnostic game logic: the scene sequencer, plus
  Truth Debt/ledger/ending logic
- `src/scenes/` — reusable scene-type handlers (dialog, reckoning, ending)
  that chapters register with the sequencer
- `src/ui/` — reusable DOM components (swipe card, FEELZ wheel, meters...)
- `src/chapters/<id>/` — one self-contained chapter each

Docs, in the order you'll want them:

- [`docs/HANDOFF.md`](docs/HANDOFF.md) — project status, key decisions and
  why, what's deliberately not built yet. Start here.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the shell, chapters,
  and scene sequencer fit together.
- [`docs/SCENE_TYPES.md`](docs/SCENE_TYPES.md) — the scene handler
  contract, including the planned (unbuilt) cutscene and mini-game shapes.
- [`docs/CONTENT_SCHEMA.md`](docs/CONTENT_SCHEMA.md) — the dialog JSON
  format and what the stats mean, for anyone just writing content.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds
with Vite and publishes `dist/` to GitHub Pages. The custom domain is set
via `public/CNAME` (already in the repo), which Vite carries into every
build automatically.

Already set up for this repo; see `docs/HANDOFF.md`'s "Deployment"
section for the full GitHub Pages + GoDaddy DNS configuration if you ever
need to reproduce or debug it (e.g. on a repo transfer or a new domain).
