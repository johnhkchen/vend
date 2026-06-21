# T-058-02 — Review

**Ticket:** astro-react-cloudflare-frontend-scaffold (S-058-02, E-058)
**Commit:** `8533ce2` — `feat(examples): Astro + React + Cloudflare hackathon-seed frontend scaffold`
**Phase:** Review — handoff. What changed, coverage, open concerns.

## Summary

Built `examples/templates/hackathon-seed/` as a real, minimal, runnable **Astro + React** app with a
**Cloudflare Pages auto-deploy config present**. The build was verified green by an actual `npm install
&& npm run build` (registry was reachable — the stronger evidence path, not the documented-command
fallback). The seed is fully isolated from vend's own build: `bun run check` is unchanged at **1295
pass / 0 fail**. The change is purely additive — no edits to `src/`, root `package.json`, or root
`tsconfig.json`.

## Files created (12 tracked + generated lockfile)

| File | Purpose |
|---|---|
| `package.json` | Astro 5 + `@astrojs/react` 4 + React 19; `dev`/`build`/`preview` scripts |
| `package-lock.json` | Resolved lockfile (committed for reproducible installs) |
| `astro.config.mjs` | `output: 'static'` + `react()` integration |
| `tsconfig.json` | `extends astro/tsconfigs/strict`; seed-scoped (invisible to root typecheck) |
| `wrangler.toml` | Cloudflare Pages config: `pages_build_output_dir = "dist"` |
| `.github/workflows/deploy.yml` | Literal on-push Pages deploy via `wrangler-action` (inert w/o secrets) |
| `.gitignore` | Seed-local: `node_modules/`, `dist/`, `.astro/` |
| `README-STACK.md` | Stack/run/deploy notes + the honest deploy boundary |
| `src/pages/index.astro` | Page; mounts the React island with `client:load` |
| `src/components/HackathonApp.tsx` | One interactive `useState` React island (hydration proof) |
| `src/env.d.ts` | Astro ambient client types |
| `public/favicon.svg` | Static asset (Astro `public/` convention) |

Build outputs (`node_modules/`, `dist/`, `.astro/`) are git-ignored and not committed.

## Acceptance criteria — status

- **AC#1 (runnable Astro+React; build succeeds; React component renders): ✅ MET, verified live.**
  `npm install` added 322 packages; `npm run build` completed; `dist/index.html` emitted with the React
  island bundled to `dist/_astro/HackathonApp.*.js` and an `astro-island` hydration node present. `npm
  run dev` is the documented preview path for the interactive component.
- **AC#2 (Cloudflare config present, valid in shape, NOT live-deployed): ✅ MET, verified by shape.**
  `wrangler.toml` carries the declarative Pages output-dir contract; `deploy.yml` is a valid on-push
  workflow that builds and runs `wrangler pages deploy dist`. Boundary (no creds → not deployed here)
  documented in both files and `README-STACK.md`.
- **AC#3 (no vend gate regression; `examples/` excluded; `bun run check` green): ✅ MET, verified.**
  Typecheck clean (`tsc --noEmit` with root `include: ["src"]` excludes the seed); `bun test` =
  1295 pass / 0 fail, **identical to the pre-change baseline**; precommit hook green on commit.

## Test coverage & gaps

- **No unit tests added — intentional and required.** The seed is example content; any `*.test.*` file
  would be swept into vend's `bun test` (no `bunfig.toml` scoping exists) and pollute the gate. The
  contract is enforced behaviorally instead: a real green build (AC#1) + the unchanged 1295-test gate
  (AC#3).
- **Gap (by design, owned elsewhere):** there is no *automatic* CI guard preventing a future layer from
  adding a seed test file that breaks the gate — it is closed by construction (no test files) and by the
  Step-5 test-count check, not by a config rule. A durable `bun test` scope guard was deliberately
  deferred (see Design Decision 3) as out-of-proportion to an example ticket; it warrants its own
  ticket touching the gate if ever wanted.

## Open concerns / notes for the reviewer

1. **Honest boundary stands:** Cloudflare deploy is config-present + build-green only. No live deploy
   was attempted (no creds). The `deploy.yml` workflow is inert until a designer supplies
   `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` in their own repo.
2. **Dependency freshness:** versions are pinned to recent stable majors (Astro 5, React 19). A
   transitive deprecation warning (`tsconfck`) appears during install — benign, not actionable here.
3. **Naming choice — `README-STACK.md`, not `README.md`:** the drive `README.md` is **T-058-03**'s
   artifact, layered into this same dir. Using a distinct name now avoids a clobber and keeps this
   ticket's scope to the frontend stack. The downstream ticket may fold these notes into its README.
4. **Downstream seams left intentionally:** `index.astro` has a marked slot where **T-058-04** will
   embed the SVG work-graph board; the directory path/name is held exactly as the brief specifies so
   **T-058-01** (`vend init --template`) and **T-058-03** (drive wiring) overlay onto it cleanly.

## Verdict

All three acceptance criteria met and verified (two empirically, one by shape with a documented
boundary). The change is additive, reversible, gate-safe, and faithful to E-058's honest boundaries.
Ready for handoff to the dependent tickets (T-058-03, T-058-04).
