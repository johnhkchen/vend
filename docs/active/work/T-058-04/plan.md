# T-058-04 — Plan: ordered, verifiable steps

Reuse-only ticket; the renderer is shipped. All edits under
`examples/templates/hackathon-seed/`. Each step is small enough to commit atomically; the whole
ticket is one logical change, committed once at the end after verification.

## Testing strategy

- **No unit tests in the seed** (it has none by design — confirmed in research; vend's gate compiles
  only `src/`). The seed's contract is "a green Astro build", so the verification is the build itself.
- **Verification gates:**
  1. `examples/templates/hackathon-seed` → `npm install` (already vendored) → `npm run build` is green
     with **no** `.vend/work-graph.svg` (honest-empty fallback path).
  2. Same build is green **with** a sample `.vend/work-graph.svg` present, and `dist/board/index.html`
     contains the inlined `<svg>` markup.
  3. `bun run check` at the repo root stays green (vend's gate is unaffected — sanity, not a change).
- **Determinism check:** same `.vend/work-graph.svg` → byte-identical inlined `board/index.html`
  (the seam is deterministic; inline is a pass-through). Spot-check, not automated.

## Steps

### Step 1 — Create `src/pages/board.astro`

Write the `/board` page per structure.md: frontmatter reads `join(process.cwd(), ".vend",
"work-graph.svg")` via `readFileSync` in a try/catch (missing → `null`); template inlines with
`set:html` when present, else an honest-empty panel with the regen instruction. Link back to `/`.

*Verify:* file type-checks under the seed's Astro strict tsconfig (caught by `npm run build`).

### Step 2 — Add the `board` script to `package.json`

`"board": "vend svg --seat designer"`. The documented regen one-liner that writes the default
`.vend/work-graph.svg` the page reads.

*Verify:* JSON parses; `npm run` lists `board`.

### Step 3 — Link `/board` from `index.astro`

Replace the T-058-04 placeholder comment with a small visible link to `/board`.

*Verify:* index still builds; link present in `dist/index.html`.

### Step 4 — Ignore generated `.vend/` in the seed `.gitignore`

Append `.vend/` so a rendered board / vend project-state is never committed (honest-empty template).

*Verify:* `git status` would not surface a generated `.vend/work-graph.svg` after a local `vend svg`.

### Step 5 — Reconcile + document the drive (README.md, README-STACK.md)

- README.md: point drive step 7 at the default board + opening `/board`; add `npm run board` to the
  gesture notes; state the read-only static-snapshot boundary (re-run + refresh to update).
- README-STACK.md: add `npm run board` to "Run it" with a one-line note about `/board` being the
  read-only vend board.

*Verify:* prose matches the actual script name and route; no stale `--out board.svg`-as-canonical
claim left dangling (the `--out` form may still be mentioned as an option).

### Step 6 — Build verification (empty + populated)

- From the seed dir: `npm run build` with no `.vend/` → green; `dist/board/index.html` shows the
  empty-state panel.
- Drop a small valid sample SVG at `.vend/work-graph.svg` (e.g. `vend svg --seat designer` run from
  the seed, or a minimal hand-made `<svg>` for the hermetic check) → `npm run build` green;
  `dist/board/index.html` contains the inlined `<svg>`.
- Remove the sample so the template stays honest-empty.

### Step 7 — Repo-gate sanity

`bun run check` (or `bun test` + typecheck) at repo root → green. Confirms the seed edits don't touch
vend's gate. (Expected: unaffected — no `src/` change.)

### Step 8 — Commit

One commit: `feat(examples): /board route serves the vend SVG work-graph beside the hackathon-seed app (T-058-04)`.
Include `board.astro`, `package.json`, `index.astro`, `.gitignore`, the two READMEs. Do NOT commit any
sample `.vend/work-graph.svg`.

## Risk / mitigation

- **`process.cwd()` not the project root at build.** Astro runs the build from the project root, so
  `.vend` resolves correctly; the try/catch makes a wrong path degrade gracefully to the empty state
  (never a broken build). Mitigation is built into the design.
- **`set:html` and SVG trust.** The SVG is our own deterministic renderer's local output, not user
  input — inlining is safe; no sanitizer dependency needed (keeps it dependency-light).
- **Drive-doc drift.** Step 5 explicitly reconciles README step 7 so the page, the script, and the
  prose all name the same path/route.

## AC → coverage map

| AC | Step(s) | Verification |
| --- | --- | --- |
| `/board` displays `.vend/work-graph.svg`; documented regen one-liner | 1, 2, 3, 5 | build shows inlined SVG; `npm run board` documented |
| Read-only; reuses E-055/E-056 authority; no new renderer | 1 (display-only) | no write path / no `src/` change |
| Deterministic + dependency-light; seed build green; vend gate unaffected | 1, 4, 6, 7 | green build empty+populated; no new deps; `bun run check` green |
