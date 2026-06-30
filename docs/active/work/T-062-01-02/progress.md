# T-062-01-02 — Progress

## Status: implementation complete, build green, ready to commit

### Done (maps to plan.md steps)

- **Step 1 — Astro app scaffold.** Created `examples/templates/kitchen-seed/{package.json,
  astro.config.mjs, tsconfig.json, src/env.d.ts}`. Pinned `astro@^6.4.8` +
  `@astrojs/cloudflare@^13.7.0`, `output:"server"`.
- **Step 2 — Stub storefront + favicon.** `src/pages/index.astro` renders a mobile-first
  "menu coming soon" placeholder (no dish data, no EmDash import, no fetch); `public/favicon.svg`
  is a dependency-free plate/fork glyph.
- **Step 3 — Cloudflare config-present + housekeeping.** `wrangler.toml` (HONEST BOUNDARY
  header, `name`, `compatibility_date`, commented D1/R2 binding stubs),
  `.github/workflows/deploy.yml` (INERT without CF secrets, `command: deploy` against the
  adapter's Worker output), `.gitignore`, `README-STACK.md`.
- **Step 4 — Build proven green (the AC).** `bun install && bun run build` → exit 0. Verified:
  - `dist/server/entry.mjs`, `dist/server/wrangler.json`, `dist/client/_headers` emitted
    (deployable SSR output).
  - The committed `wrangler.toml` `name` (`kitchen-storefront`) appears in the generated
    `dist/server/wrangler.json` — the adapter merged it (config-present is real).
  - The built page contains the "coming soon" placeholder and NO `fetch(`/`.map(`/dish/menu
    code — stub confirmed.
  - No Cloudflare credentials referenced as present; deploy.yml uses only `${{ secrets.* }}`
    (inert) — no live deploy invoked.
- **Step 5 — Repo-gate regression.** Root `tsc --noEmit` clean; `bun test src/init` → 65 pass /
  0 fail (the suite that reads `examples/`). Examples stay outside the root `tsconfig` include,
  so the repo gate is unaffected.

### Deviations from plan

1. **`.wrangler/` added to `.gitignore` (not foreseen in structure.md).** The Cloudflare
   adapter's image/session services spin up a local miniflare cache (`.wrangler/state/**`,
   `.wrangler/deploy/config.json`) during build. These are build-time artifacts — ignored, not
   committed. One-line addition; no design impact.

2. **`@astrojs/cloudflare@14` / `astro@7` available but deliberately NOT taken.** `bun install`
   notes newer majors exist. Holding the `astro@6` + adapter `13` pair is the whole point (the
   epic's Astro-6 pin + the cold-start build-break fix). Documented in `README-STACK.md`.

### The co-ownership seam observed LIVE (not just predicted)

While building, the sibling ticket **T-062-01-01** (Dish content type) materialized its work on
the same branch — `examples/templates/kitchen-seed/.emdash/{README.md, seed.json}` (the Dishes
collection + example dish) appeared in the working tree. Confirms the seam called out in
design.md/structure.md: both siblings write under `kitchen-seed/` with `depends_on: []`.
**Handled cleanly:** my commit stages ONLY my own files (the storefront + Cloudflare config +
my RDSPI artifacts); `.emdash/**` is left for 01-01's own commit. The still-open seam is
`package.json` + `astro.config.mjs` (EmDash dep + integration) — flagged for human attention in
review.md, since the DAG models no edge between the siblings.

### Remaining

- Commit my files (Step 6). Then Review.
