# T-058-04 — Design: how the board reaches the browser

Grounded in research.md. The renderer is shipped and untouched; the only decisions are *how the
generated SVG reaches the page* and *what the page does when no board exists yet*.

## Decision 1 — A dedicated `/board` route (not embedding in index)

**Chosen:** add `src/pages/board.astro` → served at `/board`. Replace the index placeholder comment
with a small link to `/board`.

- The ticket names `/board` as the example route and frames it as "a picture *beside* the running
  app" — a sibling tab/route the designer opens next to the app, not a section crammed into the
  product page. A dedicated route keeps the seed's product page (`index.astro`) yours to replace
  without losing the board.
- Rejected — inline the board *inside* `index.astro`: couples the board to the product UI the
  designer is meant to gut and replace ("Swap this for your real hackathon UI"). The placeholder
  comment becomes a link instead, so the connection is still discoverable.

## Decision 2 — Build-time inline read (not a public/ copy)

**Chosen:** `board.astro` reads `.vend/work-graph.svg` from disk in its frontmatter (`node:fs`) at
build time and inlines the markup via `set:html`.

Why, against the research's two bridges:

- **Self-contained & honest-empty.** A missing file is the *normal* state of a fresh seed (the board
  starts empty until `vend steer`). Inline read lets the page branch: file present → show the board;
  file absent → show a friendly "no board yet — run `vend svg`" panel. The build stays **green either
  way** — directly satisfying the AC "the seed build stays green".
- **No copy step, no stray asset.** The public/ approach (`vend svg --out public/board.svg`) writes a
  generated file into a tracked source dir; either it gets committed (ships a stale board, violates
  honest-empty) or it's a broken `<img>` until regen. Inline avoids both.
- **Deterministic & dependency-light.** `node:fs` ships with Astro's Node build — no new npm
  dependency. Same board bytes → same inlined page. Matches the SVG seam's own discipline.
- Rejected — `<img src="/board.svg">` + copy: adds a copy step and a tracked-vs-generated ambiguity
  for no rendering gain. Rejected — `<object data>`/iframe: heavier, and an external fetch the static
  build can't inline; loses the honest-empty branch.

Trade-off accepted: the board is a **build-time snapshot** — after a fresh `vend svg`, the designer
re-runs/refreshes the dev server to see the new board. This is the deliberate "static SVG, no live
socket" posture the ticket mandates. Documented as an honest boundary (Decision 5).

## Decision 3 — Read the DEFAULT path, drive it with a `board` npm script

**Chosen:** `board.astro` reads the seam's default `.vend/work-graph.svg`. Add a package.json script
`"board": "vend svg --seat designer"` (writes that default path), and document `npm run board` as the
regen one-liner.

- Reusing the seam's own default (`.vend/work-graph.svg`) means zero path config and the page agrees
  with `vend svg` run bare. `--seat designer` is the non-dev audience — the seed's whole point.
- The README drive (T-058-03, step 7) currently shows `vend svg --seat designer --out board.svg`.
  Reconcile by pointing step 7 at the default path + `/board` so the page and the drive agree. The
  `--out` form still works for anyone who wants a portable file; we just stop making it the canonical
  step.
- Path resolution: resolve against `process.cwd()` (Astro build runs from project root, where `.vend`
  lives) with a defensive fallback walk if needed. Keep it a plain `join(cwd, ".vend", "work-graph.svg")`.

## Decision 4 — Read-only, no new write path (authority preserved)

**Chosen:** the page only READS the file; it never invokes the renderer, never writes. Regeneration is
an explicit human gesture (`npm run board` / `vend svg`).

- E-055/E-056 already guarantee `vend svg` never mutates the graph; this view adds *nothing* that
  could. The board remains a one-way projection — display only. Directly satisfies AC #2.
- No server, no API route, no client JS for the board (the React island stays only on index). The
  board page is pure static HTML with inlined SVG — the lightest honest surface.

## Decision 5 — Honest-empty + boundary docs; ignore generated `.vend/`

**Chosen:**

- `board.astro` renders an explicit empty state when `.vend/work-graph.svg` is absent (no board cast
  yet) AND when it exists but is an empty board (the seam already renders a valid minimal `<svg>`, so
  that just displays as an empty board — which is honest).
- Add `.vend/` to the seed `.gitignore` so a generated board (and the rest of vend's project-state) is
  never committed — the template ships honest-empty, no seeded board.
- Document the boundary in README: the board is a **static snapshot**; re-run `npm run board` (or
  `vend svg`) and refresh to update it; it is read-only.

## What we are explicitly NOT doing

- No live/websocket updates, no file-watcher (ticket: deterministic, dependency-light).
- No new renderer, no change to `src/present/*` or `src/cli.ts` (reuse only).
- No new npm dependency.
- No change to vend's own gate — all edits are under `examples/templates/hackathon-seed/`.

## Acceptance-criteria trace

- AC1 (a `/board` view displays `.vend/work-graph.svg`; documented regen one-liner) → Decisions 1-3:
  `board.astro` inlines the default SVG; `npm run board` / `vend svg --seat designer` regenerates it,
  documented in README.
- AC2 (read-only; reuses E-055/E-056 one-way authority; no new renderer) → Decision 4: display-only,
  no write path, renderer untouched.
- AC3 (deterministic + dependency-light static SVG; seed build stays green; vend gate unaffected) →
  Decisions 2 & 5: build-time inline with honest-empty fallback (green with or without a board), no
  new deps, edits confined to the seed dir.
