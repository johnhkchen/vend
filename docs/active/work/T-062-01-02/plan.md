# T-062-01-02 — Plan

Ordered, independently-verifiable steps to land the kitchen storefront stub + Cloudflare
config-present. Each step ends in a checkable state; commits are atomic. The AC is the spine:
**`astro build` green + root renders the placeholder stub (no menu); Cloudflare adapter config
committed, produces deployable output, no live deploy invoked.**

## Testing strategy

- **No unit tests in this ticket.** The seed ships no `*.test.ts` (the schema/seed test is
  T-062-01-01's; the `init`-lays-seed test is T-062-02-01's). The repo gate `bun test` only
  runs `*.test.ts`, so nothing new runs — but it must stay green (regression guard).
- **Verification = a real build**, the dress-rehearsal's go-and-see: `bun install && bun run
  build` in the seed dir must succeed and emit deployable SSR output. This is the AC's literal
  proof and was pre-validated in a scratchpad probe (astro 6.4.8 + adapter 13.7.0).
- **Honest-boundary verification:** assert by inspection that no Cloudflare credentials are
  referenced as present and no deploy command is invoked anywhere in the build path.
- **Repo-gate regression:** `bun run check` at the repo root stays green (examples are outside
  `tsconfig` `include`, so this should be unaffected — verify, don't assume).

## Steps

### Step 1 — Scaffold the buildable Astro app
Create `examples/templates/kitchen-seed/{package.json, astro.config.mjs, tsconfig.json,
src/env.d.ts}` per structure.md (astro `^6.4.8`, `@astrojs/cloudflare@^13.7.0`,
`output:"server"`).
- **Verify:** files exist; `package.json` pins the proven pair.
- *Not committed yet* (no build proof until Step 4).

### Step 2 — Author the stubbed storefront + favicon
Create `src/pages/index.astro` (mobile-first "Menu coming soon" placeholder, no dish data, a
comment marking it the `vend work` slice) and `public/favicon.svg`.
- **Verify:** `index.astro` imports nothing from EmDash; renders only static placeholder copy.

### Step 3 — Author Cloudflare config-present + housekeeping
Create `wrangler.toml` (HONEST BOUNDARY header, `name`, `compatibility_date`, commented D1/R2
binding stubs), `.github/workflows/deploy.yml` (INERT deploy-on-push), `.gitignore`,
`README-STACK.md`.
- **Verify:** both `wrangler.toml` and `deploy.yml` state the config-present-not-live boundary;
  `deploy.yml` references CF secrets only as `${{ secrets.* }}` (absent ⇒ inert), invokes no
  deploy at build time.

### Step 4 — Install + prove the build green (the AC)
Run `bun install` then `bun run build` inside `examples/templates/kitchen-seed/`.
- **Verify (AC clause 1):** build exits 0; `dist/server/entry.mjs` + generated
  `dist/server/wrangler.json` exist (deployable output).
- **Verify (AC clause 2):** the committed `wrangler.toml` `name` appears in the generated
  config (the adapter merged it) — config-present is real, not ornamental.
- **Verify (stub):** the built page contains the placeholder copy and NO dish/menu content.
- `dist/`, `node_modules/`, `.astro/` are gitignored; `bun.lock` is produced for commit.

### Step 5 — Repo-gate regression check
From the repo root run `bun run check` (baml:gen + tsc + bun test).
- **Verify:** green — adding `examples/templates/kitchen-seed/` did not pull seed files into the
  root typecheck or break any existing test (e.g. the hackathon drift test).

### Step 6 — Commit
One atomic commit: the whole `kitchen-seed/` tree + `bun.lock`.
- Message (RDSPI/conventional): `feat(kitchen): stub storefront + Cloudflare config-present
  (E-062 S-062-01)` with a body noting the astro-6/adapter-13 pairing fix, the honest boundary,
  and the 01-01 co-ownership seam.
- Co-author trailer per repo convention.

## Sequencing & atomicity

- Steps 1–3 build up the tree but are committed together in Step 6 — the unit that is
  independently meaningful is "a green-building stubbed seed", not each file. Splitting commits
  per-file would leave intermediate non-building states.
- Step 4 is the gate that authorizes the commit; if the build is not green, do not commit —
  fix the pairing/config and re-run (the dress-rehearsal mandate is fix-at-source).
- Step 5 protects the repo's own gate; a failure there means a boundary leak to diagnose before
  committing.

## Deviations protocol

If the proven pairing fails to reproduce in the real seed dir (vs the scratchpad probe), record
the exact error in `progress.md`, fix at source (adjust the adapter/astro pin), and re-verify —
do not weaken the AC or fake a green build. If the EmDash seam forces a `package.json`/
`astro.config.mjs` shape decision, document it in `progress.md` and keep this ticket's build
green standalone.

## Definition of done (maps 1:1 to the AC)

- [ ] `astro build` green in `examples/templates/kitchen-seed/` (Step 4).
- [ ] Root route renders the placeholder stub, no menu (Steps 2, 4).
- [ ] Cloudflare adapter config committed (`astro.config.mjs` + `wrangler.toml`) and produces
      deployable output (Step 4); no live deploy invoked anywhere (Steps 3, 4).
- [ ] Repo gate still green; seam to 01-01 documented (Steps 5, review.md).
