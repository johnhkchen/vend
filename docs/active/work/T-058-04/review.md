# T-058-04 — Review: serve the SVG work-graph board beside the app

Handoff for a human reviewer. The work puts the SHIPPED `vend svg` board into the hackathon-seed
app's browser via a read-only `/board` route. One commit: **`481b8ad`**.

## What changed

All edits confined to `examples/templates/hackathon-seed/` (6 files, +89/−4):

| File | Change |
| --- | --- |
| `src/pages/board.astro` | **NEW** — the `/board` route. Reads `.vend/work-graph.svg` at build time (`node:fs`, `process.cwd()`-relative) and inlines it via `set:html`; renders an honest-empty panel when absent. Links back to `/`. Read-only; no client JS. |
| `package.json` | Added script `"board": "vend svg --seat designer"` — the documented regen one-liner (writes the seam's default `.vend/work-graph.svg`). |
| `src/pages/index.astro` | Replaced the T-058-04 placeholder comment with a visible link to `/board`. |
| `.gitignore` | Added `.vend/` so a generated board / vend project-state is never committed (template ships honest-empty). |
| `README.md` | Reconciled drive step 7 to render the default board + open `/board`; added a "the picture, beside the app" note stating the read-only static-snapshot boundary. |
| `README-STACK.md` | Added `npm run board` to "Run it" + a one-line `/board` note. |

No `src/` (vend) changes — the renderer (`src/present/svg-file.ts`) and CLI (`src/cli.ts`) are reused
untouched.

## How it meets the acceptance criteria

- **AC1 — a `/board` view displays `.vend/work-graph.svg`; documented regen one-liner.** `board.astro`
  serves `/board` and inlines the generated SVG. `npm run board` (→ `vend svg --seat designer`) is the
  one-liner, documented in both READMEs; `/board` is linked from the app's index page. ✅
- **AC2 — read-only; reuses E-055/E-056 one-way authority; no new renderer.** The page only READS a
  file and inlines it — no write path, no renderer call, no graph mutation. `vend svg` itself already
  guarantees one-way authority (writes only `.vend`, returns the graph reference-unchanged). ✅
- **AC3 — deterministic + dependency-light static SVG; seed build green; vend gate unaffected.**
  Build-time inline of a deterministic SVG, no live socket, **no new npm dependency** (uses `node:fs`,
  already in Astro's Node build). Build verified green with AND without a board. `bun run check` →
  1313 pass / 0 fail, typecheck clean. ✅

## Test coverage

- **No automated tests** were added — by design. The seed has no test suite (it is example template
  code outside vend's gate: root `tsconfig.json` compiles only `src/`, and the seed has no test
  files). The seed's contract is "a green Astro build", which is the verification used here.
- **Build verification (both branches):**
  - Empty board → `npm run build` green; `/board` shows the empty-state panel; index links `/board`.
  - Sample SVG present → `npm run build` green; the SVG is inlined into `dist/board/index.html`; no
    empty-state panel. Confirms the conditional.
- **Determinism**: inline is a byte-for-byte pass-through of the deterministic seam output, so the same
  `.vend/work-graph.svg` yields the same `board/index.html`. Spot-checked, not automated.

## Open concerns / limitations

- **Static snapshot, by design.** The board is captured at build time; after a fresh `vend svg` the
  designer must re-run `npm run board` and refresh (or restart `npm run dev`). This is the ticket's
  mandated "static SVG, no live socket" posture — documented as an honest boundary in both READMEs.
  If a later ticket wants live updates, that is a new, larger change (file-watcher / dev-server
  middleware), explicitly out of scope here.
- **`set:html` of the SVG.** The inlined SVG is our own deterministic renderer's *local* output, not
  user input, so inlining is safe and no sanitizer dependency was added (keeps it dependency-light).
  If the seed ever inlines a board from an untrusted source, that assumption would need revisiting —
  not the case for any current flow.
- **`process.cwd()` assumption.** The page resolves `.vend/work-graph.svg` against the build's cwd
  (the project root, where `vend svg` writes). If a future build runs from a non-root cwd, the
  try/catch degrades it gracefully to the empty state — never a broken build — but the board would
  show empty. No current Astro flow does this.
- **Dependency on T-058-01 for the documented copy step.** The README drive shows `vend init
  --template hackathon`; that gesture is delivered by T-058-01 (the `depends_on` is T-058-02, already
  satisfied for this ticket's own work). This ticket only documents/uses `vend svg`, which is shipped.

## Nothing needs human intervention before merge

The change is self-contained, reuse-only, build-verified on both paths, and leaves vend's gate green.
The one judgment call worth a reviewer's eye is the **static-snapshot vs. live-update** posture — it
matches the ticket's explicit instruction, but is the natural place a future enhancement would land.
