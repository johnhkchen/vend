# T-062-01-02 — Design

Decision: author a new `examples/templates/kitchen-seed/` Astro 6 storefront whose root route
renders a deliberately-stubbed placeholder (no menu), wired to Cloudflare via the
`@astrojs/cloudflare` adapter as **config-present, build-green, never live-deployed**, mirroring
the shipped `hackathon-seed` honest-boundary idiom. Grounded in Research, every choice below is
checked against a real probe build.

## The decision in one paragraph

Create the kitchen seed as a standalone, build-green Astro app: `astro@^6` +
`@astrojs/cloudflare@^13`, `output:"server"`, a single stubbed `src/pages/index.astro` that
renders a mobile-first "menu coming soon" placeholder (and is explicitly marked as the slice
`vend work` clears), a committed `wrangler.toml` carrying the literal HONEST BOUNDARY comment,
an INERT `deploy.yml`, and the supporting `tsconfig.json` / `env.d.ts` / `public/favicon.svg` /
`.gitignore` / `README-STACK.md`. The build is proven green and emits deployable SSR output;
no Cloudflare credentials are touched and no deploy is invoked.

## Decision 1 — Where the seed lives

**Chosen: a new directory `examples/templates/kitchen-seed/`.**
This is the exact location pattern of `hackathon-seed`, the directory that downstream
T-062-02-01 will teach `vend init --template kitchen` to lay down. The seed is the canonical
authored source tree; `init` consumes it later.
- *Rejected — author the files directly as `TEMPLATE_REGISTRY` string constants in
  `init-core.ts` now.* That is 02-01's job (it has the `depends_on` edge to this ticket), and
  inlining a whole Astro app as TS string literals is unreviewable and unbuildable. Authoring a
  real, buildable tree is what lets this ticket's AC ("`astro build` is green") be *verified*.
- *Rejected — put it at the repo root / a top-level `kitchen/`.* The seed is an example
  template; `examples/templates/` is its established home and keeps it out of the root gate.

## Decision 2 — Astro version and Cloudflare integration shape

**Chosen: `astro@^6.4.8` + `@astrojs/cloudflare@^13.7.0`, `output:"server"`, `adapter:
cloudflare()`.**
Rationale, all probe-verified:
- The epic pins **Astro 6** (EmDash's line). `astro@^6` → 6.4.8.
- "Cloudflare **adapter** config" (epic wording) = the `@astrojs/cloudflare` adapter in
  `astro.config.mjs`, not the hackathon's static-Pages `wrangler.toml`-only approach.
- **The adapter version is the trap to fix at source.** Latest `@astrojs/cloudflare@14`
  peer-requires astro 7 and, against astro 6, breaks the SSR build outright. `@13` peers with
  `astro@^6.3.0` and builds green. Pinning `^13` in the seed's `package.json` is the fix that
  saves the cook from the cold-start trap the epic exists to eliminate.
- **`output:"server"`** because the eventual menu-render reads EmDash's REST API at request
  time (SSR), so the adapter must be present and the build must emit a worker. The stub renders
  no dynamic data yet, but the architecture is honest from day one.

*Rejected — mirror hackathon exactly (`output:"static"` + Cloudflare Pages, no adapter).* It
builds green trivially, but it contradicts the epic's explicit "adapter" wording and would force
02/03 to re-architect the output mode when the menu-render SSR slice lands. Choosing the SSR
adapter now means the stub and the cleared slice share one build shape.

*Rejected — `astro@latest` (7.x) + `@astrojs/cloudflare@14`.* Violates the epic's Astro-6 pin
and diverges from EmDash's supported line; not worth the conflict for a stub.

## Decision 3 — What the stub renders

**Chosen: a self-contained mobile-first placeholder** — a centered "Menu coming soon" panel
with one line of copy explaining the cook adds dishes in the EmDash admin and `vend work` will
build the menu. **No dish data, no EmDash import, no `<DishCard>`** — the unbuilt menu is the
payoff `vend work` clears (decision (b)). Inline styles only (mirrors hackathon `index.astro`),
`<meta viewport>` for mobile-first, so the stub is *shaped like* the eventual menu page without
pre-empting it.
- *Rejected — render an empty menu grid / placeholder dish cards.* That is decision (a), which
  the plan/epic explicitly chose AGAINST: the empty render must be what autopilot clears, not
  something pre-shipped. Shipping cards would also create fake demand (violates IA-4
  honest-empty).
- *Rejected — read the one example dish from EmDash and render it.* That is the menu-render
  slice (T-062-03-03) and would couple this ticket to EmDash resolving; out of scope.

## Decision 4 — Cloudflare config-present, not live

**Chosen: commit `wrangler.toml` + `.github/workflows/deploy.yml`, both carrying a literal
HONEST BOUNDARY comment**, verbatim in spirit with `hackathon-seed`:
- `wrangler.toml`: `name`, `compatibility_date`, and *commented* D1/R2 binding stubs (the
  EmDash content store + media library the cook wires) — present as config, exercised by the
  build (the adapter merges it), never deployed.
- `deploy.yml`: a `push`→build→`wrangler-action` deploy job that is **inert without
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`** repo secrets, which do not exist in the
  vend environment. The deploy command targets the adapter's Worker output (`command: deploy`),
  not Pages.
- *Rejected — omit `wrangler.toml` and rely solely on the adapter-generated
  `dist/server/wrangler.json`.* The generated file is a build artifact (gitignored via `dist/`);
  a committed `wrangler.toml` is the reviewable, honest deploy contract and is the merge input
  the adapter reads. The epic says config must be *committed*.
- *Rejected — wire a real deploy / add placeholder secrets.* No creds exist; a live deploy is
  explicitly out of scope and the cook's own push. Honest-on-outcome forbids faking it.

## Decision 5 — Package manager / lockfile / deploy runtime

**Chosen: Bun for local dev/build (project stack per CLAUDE.md), commit `bun.lock`** for
reproducibility; `deploy.yml` uses Node + `npm ci` inside the CI runner only because
`cloudflare/wrangler-action` and Cloudflare's own docs assume an npm-shaped CI step — and the
workflow is inert anyway, so its runtime is the cook's to adjust. The seed's `package.json`
scripts (`dev`/`build`/`preview`/`astro`) are runner-agnostic (`astro …`).
- *Rejected — npm everywhere (mirror hackathon's `package-lock.json`).* The kitchen seed lands
  in the brew-installed-vend / Bun world; Bun is the project's declared toolchain. Committing
  `bun.lock` matches the repo and the cook's `bun`-based drive.

## The co-ownership seam (named, not hidden)

T-062-01-01 (Dish content type) and this ticket both write under
`examples/templates/kitchen-seed/` with `depends_on: []` — a **missing dependency edge** in the
DAG (the concurrency model says co-edited files = a missing edge). The overlap surface is
`package.json` (EmDash dep) and `astro.config.mjs` (the EmDash *integration*). This design
keeps THIS ticket's build green **without** EmDash: I own `package.json` (astro+adapter) and the
Cloudflare-adapter line of `astro.config.mjs`; 01-01 / 02-01 layer the EmDash integration + dep
on top additively. The seam is documented in structure.md and flagged in review.md so a human
resolves the edge rather than discovering it via a lock conflict.

## Why this is right-sized

One buildable Astro app, ~10 small files, all mirroring a shipped precedent; the only net-new
reasoning is the Astro-6/adapter-13 pairing (a real cold-start fix) and the SSR output choice.
No engine surface, no `init` wiring, no EmDash, no live deploy — each handed to the ticket that
owns it.
