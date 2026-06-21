# T-058-02 — Progress

**Phase:** Implement — execution log against `plan.md`.

## Status: complete — all steps executed, build green, gate unaffected.

### Baseline (before any change)
`bun test` → **1295 pass / 0 fail** across 81 files. Recorded so AC#3 can be proven by equality.

### Step 1 — Scaffold config + deploy files ✅
Created under `examples/templates/hackathon-seed/`: `package.json`, `astro.config.mjs`,
`tsconfig.json`, `.gitignore`, `wrangler.toml`, `.github/workflows/deploy.yml`, `README-STACK.md`.
All parse as valid JSON/TOML/YAML.

### Step 2 — Scaffold app source ✅
Created `src/pages/index.astro` (mounts the island with `client:load`),
`src/components/HackathonApp.tsx` (a `useState` counter island), `src/env.d.ts`,
`public/favicon.svg`.

### Step 3 — Resolve dependency versions ✅
Pinned recent stable majors: `astro ^5.5.0`, `@astrojs/react ^4.2.0`, `react ^19`, `react-dom ^19`,
`@types/react(-dom) ^19`. `npm install` resolved a `package-lock.json` (committed for reproducibility).

### Step 4 — Build the seed (AC#1) ✅ — real build, not fallback
The npm registry **was reachable** in this env, so AC#1 is proven by an actual green build, not the
documented-command fallback.
- `npm install` → added 322 packages in ~20s (one deprecation warning: `tsconfck`, transitive — benign).
- `npm run build` → **Complete**; 1 page built in ~634ms.
- `dist/index.html` emitted; the React island bundled to `dist/_astro/HackathonApp.*.js`; the page
  contains an `astro-island` hydration node (grep confirmed). A real interactive React component
  renders. **AC#1 met.**

### Step 5 — Verify vend gate unaffected (AC#3) ✅
From repo root:
- `bun run check:typecheck` (`tsc --noEmit`) → clean, no errors (seed is outside `include: ["src"]`).
- `bun test` → **1295 pass / 0 fail** — identical to baseline. No seed `*.test.*` file exists, so the
  whole-tree scan picked up nothing new. **AC#3 met.**
- `git check-ignore` confirms `node_modules/`, `dist/`, `.astro/` are all ignored (root + seed-local
  `.gitignore`). Only the 12 source files (+ `package-lock.json`) are staged.

### Step 6 — Commit
Single commit scoped to `examples/templates/hackathon-seed/`. See review.md for the sha.

## Deviations from plan
- **None material.** The only plan branch that resolved differently-than-worst-case: Step 4's fallback
  (registry unreachable) was **not** needed — the registry was reachable and a real build passed. This
  is the stronger AC#1 evidence path, recorded honestly.
- Added `package-lock.json` to the commit (Plan Step 3 preferred this for reproducibility); it is a
  generated-but-durable artifact, intentionally tracked.

## AC#2 note (Cloudflare config, verified by shape)
`wrangler.toml` carries `pages_build_output_dir = "dist"` (the declarative Pages contract);
`deploy.yml` is a valid on-push workflow invoking `cloudflare/wrangler-action` → `pages deploy dist`.
Both are config-present and would deploy on push; neither runs here (no creds). Boundary documented in
both files' header comments and in `README-STACK.md`. **AC#2 met.**
