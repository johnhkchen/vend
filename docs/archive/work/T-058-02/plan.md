# T-058-02 — Plan

**Phase:** Plan — ordered, independently verifiable steps + testing strategy.

## Testing strategy

This is example content, not `src/` — so there are **no unit tests** to add (and adding `*.test.*`
files would *break* the vend gate, per Design Decision 3). Verification is therefore behavioral and
gate-based:

- **Build verification (AC#1):** attempt a real `npm install && npm run build` in the seed dir. Success
  = `dist/` emitted with an HTML page. If the npm registry is unreachable, fall back to config-shape
  assertion + the documented command, recorded honestly in `progress.md`/`review.md`.
- **Cloudflare config validity (AC#2):** assert the files exist and are well-formed in shape
  (`wrangler.toml` has `pages_build_output_dir`; `deploy.yml` is valid YAML with an on-push trigger and
  the wrangler deploy step). No live deploy.
- **Gate non-regression (AC#3):** run `bun run check` from the repo root and confirm it stays green
  (same test count, typecheck clean) — the load-bearing invariant.

Each step below is committable on its own where it makes sense; the seed scaffold is one coherent unit,
so steps 1–3 land together, with the verification steps (4–5) gating the commit.

## Steps

### Step 1 — Scaffold the seed config + deploy files
Create, under `examples/templates/hackathon-seed/`:
- `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`
- `wrangler.toml`, `.github/workflows/deploy.yml`
- `README-STACK.md` (stack notes + honest deploy boundary)

**Verify:** files exist; `wrangler.toml` and `deploy.yml` parse as valid TOML/YAML by inspection;
`package.json` is valid JSON.

### Step 2 — Scaffold the app source
Create:
- `src/pages/index.astro` (mounts the React island with `client:load`)
- `src/components/HackathonApp.tsx` (one `useState` interactive component)
- `src/env.d.ts`, `public/favicon.svg`

**Verify:** `index.astro` imports and renders `HackathonApp`; the component uses React state.

### Step 3 — Resolve dependency versions
Pin `astro`, `@astrojs/react`, `react`, `react-dom`, `@types/react(-dom)` to recent stable majors.
Prefer letting the install resolve a lockfile (`package-lock.json`) for reproducibility; if the
registry is unreachable, pin sensible recent versions by hand and note that the lockfile will be
generated on the designer's first `npm install`.

**Verify:** versions present in `package.json`.

### Step 4 — Build the seed (the AC#1 proof)
From `examples/templates/hackathon-seed/`:
```
npm install
npm run build
```
**Verify:** `dist/index.html` exists and contains the rendered page + a hydration script for the React
island. **Fallback (registry unreachable):** record the failure honestly, assert config shape, and
document the command as the AC#1 evidence path. Do **not** commit `node_modules/` or `dist/` (ignored).

### Step 5 — Verify the vend gate is unaffected (the AC#3 invariant)
From the repo root:
```
bun run check
```
**Verify:** typecheck clean and `bun test` green with the **same test count** as before the seed
existed (confirming `examples/` is invisible to both `tsc --include:["src"]` and the `bun test` scan
— no `*.test.*` files in the seed). This is the last gate before commit.

### Step 6 — Commit
Single commit scoped to `examples/templates/hackathon-seed/` (+ a possible `package-lock.json` inside
the seed). Conventional message, e.g.:
`feat(examples): Astro + React + Cloudflare hackathon-seed frontend scaffold (T-058-02)`.
Precommit hook (`check:precommit`) must pass.

## Risk / fallback summary

| Risk | Mitigation |
|---|---|
| npm registry unreachable in sandbox | Fall back to config-shape assertion + documented command; record honestly (AC#1 accepts "documented command"). |
| Seed accidentally adds a `*.test.*` file | Structure forbids it; Step 5 catches any drift via test-count check. |
| Seed `tsconfig`/`astro` types leak into root typecheck | Root `tsconfig` `include: ["src"]` excludes it; Step 5 confirms. |
| `.astro/` cache committed | Seed-local `.gitignore` covers it. |
| Path/name drift breaks T-058-01/03/04 | Keep `examples/templates/hackathon-seed/` exactly; use `README-STACK.md` to avoid colliding with T-058-03's `README.md`. |

## Definition of done (maps to AC)
- AC#1 ← Steps 1–4 (runnable Astro+React; build succeeds or documented).
- AC#2 ← Step 1 (`wrangler.toml` + `deploy.yml` present, valid in shape; boundary documented).
- AC#3 ← Step 5 (`bun run check` green, unchanged test count).
