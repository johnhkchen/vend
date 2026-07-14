# T-062-01-02 — Research

Map of the terrain for *stub-storefront-and-cloudflare-config-present*: stand up the
deliberately-stubbed Astro 6 storefront at the site root plus config-present (not live)
Cloudflare deploy, leaving the menu-render slice as the thing `vend work` will clear.
Descriptive only — no solutions here.

## What the ticket is, in epic context

- **Epic E-062** (`docs/active/epic/E-062.md`) is the *kitchen-emdash-dress-rehearsal*: a
  soft-launch that hardens the `brew → init → steer → work` cold-start path on an EmDash +
  Astro 6 seed. The deliverable is a RELIABLE BOOTSTRAP, not feature depth.
- **Story S-062-01** (`kitchen-emdash-astro-seed-template`) materializes the seed in two
  tickets: **T-062-01-01** authors the EmDash `Dish` content type + one example dish;
  **T-062-01-02 (this one)** authors the Astro storefront stub + Cloudflare config.
- The epic's explicit BOUNDARY (verbatim): *"the Cloudflare deploy is config-present and
  build-green here, NOT a live deploy — the live deploy is the cook's own push"*. The
  menu-render itself is **decision (b)**: the storefront `/` ships intentionally unbuilt so
  `vend work` clears it later (T-062-03-03). My job is the STUB, not the menu.

## The precedent that governs everything: `hackathon-seed`

`examples/templates/hackathon-seed/` is the already-shipped sibling template (E-058) and the
single strongest reference. Its file set and *honest-boundary* idiom are what this ticket
mirrors for the kitchen domain:

```
examples/templates/hackathon-seed/
  astro.config.mjs        # output:"static" + @astrojs/react; NO adapter
  package.json            # astro ^5.5, react; scripts dev/build/preview/astro/board
  tsconfig.json           # extends "astro/tsconfigs/strict"; excludes dist
  wrangler.toml           # Cloudflare PAGES config; pages_build_output_dir="dist"
  .github/workflows/deploy.yml   # deploy-on-push, INERT without CF creds
  .gitignore              # node_modules/ dist/ .astro/ .vend/
  public/favicon.svg
  src/pages/index.astro   # the app page (NOT a stub here — it renders a React island)
  src/pages/board.astro   # reads .vend/work-graph.svg, degrades honest-empty if absent
  src/components/HackathonApp.tsx
  SEED.md  charter.md  shelf-note.md  README*.md  EXPECTED-OUTCOME.md
```

Key idioms to carry over, observed directly in the files:
- **`wrangler.toml` carries a literal "HONEST BOUNDARY" comment** stating it is config
  present, not a live deploy from this repo — there are no Cloudflare creds in the vend
  environment; the designer deploys on their own push.
- **`deploy.yml` carries the same honest boundary**: the workflow is INERT without the
  repo secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.
- **`board.astro` degrades honest-empty** when `.vend/work-graph.svg` is absent — the
  fresh-seed default — so the build stays green with or without a board.
- The seed ships **honest-empty** (IA-4): structure + format docs, never fake demand.

## How `vend init --template` resolves templates (the downstream consumer)

- `src/init/init-core.ts` holds `TEMPLATE_REGISTRY` — the overlay manifests that
  `vend init --template <name>` layers over the base scaffold. Today: `hackathon` (lays
  `SEED.md` + a tuned `docs/knowledge/charter.md`) and `minimal` (empty, standalone).
- Crucially, the registry overlays name **ONLY vend-owned paths** (one-way-to-lisa). The
  hackathon *Astro app files* live only under `examples/templates/hackathon-seed/` — they
  are NOT laid by the current `init`. A drift test in `src/init/init-effect.test.ts` pins
  the seed `charter.md` equal to the registry constant.
- **T-062-02-01** (`init-template-kitchen-lays-emdash-astro-seed`, depends on this ticket)
  is the one that wires `vend init --template kitchen` to lay *the full seed* (Dish type,
  stub storefront, example dish, Cloudflare config). So THIS ticket's job is to AUTHOR the
  canonical kitchen-seed source tree; 02-01 teaches `init` to lay it down.

## Build/stack reality (probed this session, in the scratchpad)

The dress-rehearsal demands go-and-see; I built a throwaway probe to de-risk:
- `bun 1.3.8`, `node v26.4.0`; **network installs work**.
- `astro@latest` = **7.0.3**; the epic pins **Astro 6** (= EmDash's "Astro 6" line).
  `astro@^6` resolves to **6.4.8**.
- **Adapter pairing matters and is friction-prone.** `@astrojs/cloudflare@14` (latest)
  peer-requires `astro@^7` and, mismatched against astro 6, FAILS the build with
  *"rollupOptions.input should not be an html file when building for SSR"*. The version
  that peers with `astro@^6.3.0` is **`@astrojs/cloudflare@13`** (13.7.0). With that pair,
  `output:"server"` + `adapter: cloudflare()` builds GREEN and emits deployable SSR output
  (`dist/server/entry.mjs`, generated `dist/server/wrangler.json`, `dist/client/_headers`).
- The adapter **generates `wrangler.json` at build and merges a committed top-level
  `wrangler.toml`** (a committed `name = "kitchen-storefront"` showed up in the generated
  config) — so a hand-written `wrangler.toml` is both honest deploy config and a real input.
- `compatibility_date` defaulted to `2026-04-15` in the generated config.

## Repo gate boundaries (so adding files won't break the build)

- Root `tsconfig.json` has `include: ["src"]` — `examples/` is NOT typechecked by the root.
  Each seed carries its own `tsconfig.json` extending `astro/tsconfigs/strict`.
- Root gate is `bun run check` = `baml:gen && tsc --noEmit && bun test` (per project memory,
  the real gate). `bun test` only runs `*.test.ts`; the kitchen-seed ships no test files
  (the schema/seed test is T-062-01-01's; the init-lays-seed test is T-062-02-01's).
- `hackathon-seed` already coexists in `examples/` without affecting the root gate — the
  kitchen seed sits in exactly the same place under the same rules.

## Constraints, assumptions, and seams surfaced

- **Astro 6 + `@astrojs/cloudflare@13` is the only build-green pairing** for this stack right
  now; the naive "install latest adapter" path is a real cold-start trap (assumption: the
  cook would hit it — worth fixing at source per the epic's mandate).
- **Co-ownership seam with T-062-01-01.** Both sibling tickets target
  `examples/templates/kitchen-seed/`, and both have `depends_on: []`. The natural overlap is
  `package.json` (EmDash dep vs Astro deps) and `astro.config.mjs` (the EmDash *integration*
  registration vs the Cloudflare adapter). The DAG models no edge between them — a finding to
  surface, not silently paper over.
- **EmDash is v0.1 beta**, linked as a GitHub repo (`emdash-cms/emdash`), not obviously a
  stable npm package. The stub storefront reads NO EmDash data (no menu yet), so this ticket
  can stand a fully green Astro build that does not depend on EmDash resolving — the EmDash
  wiring is additive and belongs to 01-01 / 02-01.
- **Honest-on-outcome**: "config-present, not live" must be literal and visible (mirroring the
  hackathon `HONEST BOUNDARY` comments); no Cloudflare credentials exist here and no deploy
  may be invoked.
- **Output mode**: the eventual menu-render reads EmDash's REST API at request time → SSR
  (`output:"server"`) is the architecturally honest choice and the one the epic's "Cloudflare
  *adapter* config" wording points at (vs the hackathon's static Pages config).
