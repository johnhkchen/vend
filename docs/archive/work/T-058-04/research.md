# T-058-04 — Research: serve the SVG work-graph board beside the app

## Ticket in one line

Put the SHIPPED `vend svg` board into the browser the designer already has open for the
hackathon-seed Astro app — a `/board` view that *displays* `.vend/work-graph.svg`, plus a
documented one-liner to (re)generate it. No new renderer; read-only projection; deterministic
and dependency-light; the seed build stays green and vend's own gate is untouched.

## The shipped renderer (reused, not rebuilt)

`src/present/svg-file.ts` — the SVG file-output seam (`writeBoardSvg`, T-055-03, E-055/E-056).
What it gives us, verified by reading the source:

- `writeBoardSvg(opts)` LOADS the live board (`loadWorkGraph`), PROJECTS it under a seat preset
  (`projectGraph`, default seat `"designer"` — the non-dev audience), RENDERS a static SVG string
  (`projectionToSvg`), and WRITES it to `{outDir}/{fileName}`.
- Default output path: `boardSvgPath()` → `.vend/work-graph.svg` (constants `DEFAULT_SVG_DIR=".vend"`,
  `DEFAULT_SVG_FILENAME="work-graph.svg"`).
- **Deterministic**: `loadWorkGraph` / `projectGraph` / `projectionToSvg` are clock-/random-free, so
  the same board renders byte-identical every run (P5 consistency). The only impurity is the load +
  the single write.
- **One-way authority** (the AC's teeth): the seam READS the board and its ONLY mutation is the
  `.svg` under `.vend` — never `docs/active`, never the board itself. `projectGraph` returns the
  loaded graph reference-unchanged. The board is never touched.
- **Honest-empty**: an empty board flows through to a minimal valid `<svg>` (`cardCount: 0`), still
  written. Absence is rendered, not padded.

## The CLI gesture (the regen one-liner)

`src/cli.ts` — the `svg` arm (lines ~820-851, parse at ~190-215):

- Usage: `vend svg [--seat <designer|dev>] [--out <path>]`.
- Read-only over the board (no `--budget`). Default `--seat designer`.
- Dispatch lazily imports `writeBoardSvg`; with `--out` it splits the path into
  `outDir`/`fileName` via `dirname`/`basename`. With no `--out` it writes the default
  `.vend/work-graph.svg`.
- Prints `wrote {path} — {n} groups, {n} cards, {n} links`.

So the regen one-liner the designer/dev runs is literally **`vend svg --seat designer`** (writes the
default `.vend/work-graph.svg`), or `vend svg --seat designer --out <path>` to redirect it. The
README's drive already lists `vend svg --seat designer --out board.svg` as step 7.

## The Astro seed (where the view is added)

`examples/templates/hackathon-seed/` — the app from T-058-02, the drive wiring from T-058-03.

- `astro.config.mjs`: `output: "static"`, `integrations: [react()]`. `astro build` emits `dist/`,
  served directly by Cloudflare Pages.
- `src/pages/index.astro`: one page, `<HackathonApp client:load />` React island. It ALREADY has a
  placeholder: `<!-- T-058-04 will embed the vend SVG work-graph board beside the app here. -->`.
- `src/components/HackathonApp.tsx`: a tiny `useState` island (proof the stack hydrates).
- `package.json`: scripts `dev / build / preview / astro` only — **no board/regen script yet**.
- `public/`: only `favicon.svg`. Astro serves `public/` as static assets at the site root.
- `tsconfig.json`: extends `astro/tsconfigs/strict`, `include: ["**/*"]`, `exclude: ["dist"]` — so a
  new `.astro` page under `src/pages/` is type-checked by the seed's own (Astro) tsconfig.
- `.gitignore`: ignores `node_modules/`, `dist/`, `.astro/` — **does NOT ignore `.vend/`**.
- README.md (T-058-03): the vend drive script; step 7 is `vend svg`. The ascii sketch already
  promises the board "lives beside your running app in the browser you already have open".
- README-STACK.md: run/deploy notes; confirms the seed is outside vend's build.

## Key constraint: where the SVG lives vs. where Astro serves from

`vend svg` writes to `.vend/work-graph.svg` at the **project root**. Astro's static build only serves
files under `public/` (→ site root) and pages under `src/pages/`. `.vend/` is OUTSIDE `public/`, so
the SVG is NOT automatically a served asset. Two honest bridges exist:

1. **Build-time inline**: an Astro page reads `.vend/work-graph.svg` from disk in its frontmatter
   (Node fs at build) and inlines the markup. Self-contained; no copy step; gracefully handles a
   missing file (honest-empty placeholder) so the build is green whether or not `vend svg` has run.
2. **Static-asset copy**: regen writes the SVG into `public/` (`vend svg --out public/board.svg`) and
   the page references `/board.svg` via `<img>`/`<object>`. Simpler page, but the served asset only
   appears after a regen, and a broken `<img>` if it hasn't.

Both reuse the shipped renderer untouched; the choice is a Design decision (see design.md).

## Boundary / gate facts (verified)

- vend's own gate (`bun run check`) compiles only `src/` (root `tsconfig.json` includes only `src/`).
  The seed lives under `examples/` and has no test files → **adding `.astro`/config files here cannot
  affect vend's typecheck or tests** (confirmed in README-STACK.md and prior T-058-02/03 work).
- No new npm dependency is needed for either bridge: build-time inline uses `node:fs` (already
  available in Astro's Node build); the copy approach uses only the existing `vend svg`.
- The board is read-only by construction — E-055/E-056 already guarantee `vend svg` never mutates the
  graph. The Astro view only DISPLAYS the file; it adds no write path.

## Assumptions

- The designer runs `npm run dev` (or `preview`) and opens the app; a `/board` route is reachable in
  the same browser session. A static pre-render is sufficient — no live websocket (the ticket says so
  explicitly: "keep it deterministic + dependency-light").
- `vend svg` is run from the seed's project root, so `.vend/work-graph.svg` is at the root the Astro
  build also runs from (`process.cwd()`).
- The template ships **honest-empty**: no pre-generated `.vend/work-graph.svg` committed. The board
  appears only after the designer drives the seed.
