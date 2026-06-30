# T-062-01-02 — Review

Handoff for *stub-storefront-and-cloudflare-config-present*. What changed, how it was verified,
and what a human reviewer needs to know — especially the one cross-ticket seam.

## What changed

A new buildable seed directory, `examples/templates/kitchen-seed/`, committed in `c296029`
(16 files; the storefront + Cloudflare config + the five RDSPI artifacts). The Astro app:

| File | Role |
|------|------|
| `package.json` | Pins `astro@^6.4.8` + `@astrojs/cloudflare@^13.7.0`; `dev/build/preview/astro` scripts. |
| `astro.config.mjs` | The **Cloudflare adapter config** — `output:"server"`, `adapter: cloudflare()`. The AC's centerpiece. |
| `src/pages/index.astro` | The **deliberately-stubbed `/`** — mobile-first "menu coming soon", no data fetch. |
| `wrangler.toml` | Cloudflare deploy config-present (HONEST BOUNDARY), `name` + `compatibility_date` + commented D1/R2 stubs. |
| `.github/workflows/deploy.yml` | Deploy-on-push, **INERT** without `CLOUDFLARE_*` secrets. |
| `tsconfig.json`, `src/env.d.ts`, `public/favicon.svg`, `.gitignore`, `README-STACK.md`, `bun.lock` | Supporting scaffold. |

Nothing in `src/` (engine), no `init` wiring, no repo-root edits. `examples/` is outside the
root `tsconfig` include, so the repo gate is untouched.

## Acceptance criteria — verified, not asserted

> `astro build` is green and the root route renders the placeholder stub (no menu yet);
> Cloudflare adapter config is committed and produces deployable output with no live deploy invoked.

- ✅ **`astro build` green.** `bun install && bun run build` in the seed dir → exit 0
  (Astro 6.4.8 + adapter 13.7.0).
- ✅ **Root renders the placeholder stub, no menu.** The built page contains the "coming soon"
  copy and **no** `fetch(` / `.map(` / dish / EmDash-data code (grep-verified on both source and
  built output).
- ✅ **Cloudflare adapter config committed + deployable output.** `astro.config.mjs` +
  `wrangler.toml` are committed; the build emits `dist/server/entry.mjs`,
  `dist/server/wrangler.json`, `dist/client/_headers`; the committed `wrangler.toml` `name`
  (`kitchen-storefront`) merges into the generated config (proof the committed config is a real
  build input, not ornamental).
- ✅ **No live deploy invoked.** No Cloudflare credentials exist in this environment; the only
  credential references are `${{ secrets.* }}` in the inert `deploy.yml`. No deploy command runs
  in the build path.

## Test coverage & gaps

- **No unit tests in this ticket — by design.** The seed ships no `*.test.ts`: the
  schema/seed assertion is T-062-01-01's, and the `init --template kitchen` lays-the-seed test
  is T-062-02-01's. Adding tests here would poach downstream scope.
- **Verification was a real build** (the dress-rehearsal go-and-see), pre-validated in a
  throwaway scratchpad probe and then reproduced in the committed seed dir.
- **Regression guard:** root `tsc --noEmit` clean; `bun test src/init` 65 pass / 0 fail (the
  suite that reads `examples/`).
- **Gap (acceptable, downstream-owned):** there is no *automated* CI build of the seed. When
  `vend init --template kitchen` lands (02-01) and `vend doctor` probes the workspace (02-02),
  the seed's green build should be wired into a check so adapter/astro drift fails CI rather
  than a cook's machine. Recommend a follow-up once `init` lays the seed.

## Open concerns / flags for human attention

1. **⚠️ Cross-ticket seam (the headline).** T-062-01-01 (Dish content type) and this ticket both
   write under `examples/templates/kitchen-seed/` with `depends_on: []` — a **missing dependency
   edge** in the DAG. Observed live: 01-01's `.emdash/{README.md,seed.json}` (and a `src/kitchen/`
   dir) materialized in the working tree mid-build. **This commit stages only its own files**;
   `.emdash/**` is left for 01-01. The unresolved overlap is **`package.json`** (EmDash dep) and
   **`astro.config.mjs`** (the EmDash `integrations:[...]` entry). Whoever integrates the two
   seeds must: (a) add the EmDash dep to `package.json`, (b) register the EmDash integration in
   `astro.config.mjs`, and (c) **re-confirm the build stays green** — adapter 13 + astro 6 +
   EmDash v0.1 has not been built together here (EmDash wiring is out of this ticket's scope).
   Consider adding a DAG edge so 01-02 → 01-01 (or vice-versa) serialize rather than race.

2. **Version-pin fragility.** `@astrojs/cloudflare@14` / `astro@7` exist; the seed deliberately
   holds `^13` / `^6`. A `bun update` that drifts the adapter to 14 re-introduces the SSR build
   break (`rollupOptions.input should not be an html file`). Mitigated by the pin + a prominent
   warning in `README-STACK.md`, but it's a real trap to watch when EmDash moves.

3. **`bun.lock` committed for an example.** Adds dep-bump noise, accepted for reproducibility
   (mirrors hackathon's committed lockfile). Reviewers can ignore lockfile churn.

4. **Deploy command unverified (honestly).** `deploy.yml` uses `command: deploy` +
   `workingDirectory: dist/server` against the adapter's Worker output. It is INERT and was not
   executed (no creds, out of scope). The cook may need to adjust the exact wrangler invocation
   for their account; the workflow is a documented starting point, not a proven pipeline.

## Bottom line

The AC is met and verified by a real green build that emits deployable Cloudflare output, with
the storefront honestly stubbed and the deploy honestly config-present-not-live. The one thing a
human must act on before the seed is whole is the **01-01 ↔ 01-02 co-ownership seam** on
`package.json` / `astro.config.mjs` — surfaced here rather than discovered later.
