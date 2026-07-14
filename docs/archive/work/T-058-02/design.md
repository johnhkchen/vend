# T-058-02 — Design

**Phase:** Design — viable approaches, tradeoffs, decisions grounded in `research.md`.

This ticket has three decision axes: (1) the Astro rendering/deploy mode, (2) the Cloudflare deploy
config form, and (3) how to guarantee gate-safety against `bun test`. Each is decided below.

---

## Decision 1 — Astro mode: **static output** (not SSR via the CF adapter)

**Options**

- **A. Static (`output: 'static'`, default).** `npm run build` emits `dist/` HTML+JS; React components
  hydrate client-side (`client:load`). Cloudflare Pages serves `dist/` directly.
- **B. SSR via `@astrojs/cloudflare` adapter.** Server-rendered on CF Workers; needs the adapter,
  a `wrangler` runtime, and platform bindings.

**Decision: A — static.** Grounded in the ticket ("keep it minimal — a hackathon seed, not a product")
and the epic ("the value is *seeing* the work, not the code"). The seed exists to (a) build green and
(b) render a React component in a preview. SSR adds an adapter, a Workers runtime contract, and a
larger dependency surface for zero benefit to the demo. Static is also the *most honest* Cloudflare
Pages story: build command + output dir is the canonical Pages-static deploy, no creds, no runtime.
Rejecting B keeps the install light and the build fast/deterministic — important because this ticket is
"FREE/deterministic" per the epic.

---

## Decision 2 — Cloudflare deploy config: **`wrangler.toml` (Pages-static) as the asserted config**

**Options**

- **A. `wrangler.toml`** with `pages_build_output_dir = "dist"` — the modern declarative Pages config
  `wrangler pages deploy` reads. Single file, in-repo, inspectable, "valid in shape."
- **B. `.github/workflows/deploy.yml`** using `cloudflare/wrangler-action` — auto-deploys on push via
  GitHub Actions; needs `CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID` secrets.
- **C. Dashboard convention only** — document "set build command `npm run build`, output dir `dist`"
  with no file.

**Decision: A, plus a documented push-to-deploy note.** The ticket's AC#2 wants a config "present and
valid in shape (would deploy on push) — NOT live-deployed." `wrangler.toml` with
`pages_build_output_dir` is exactly that: a real, inspectable, schema-valid Pages config that *would*
deploy. It is the lightest honest artifact — no secrets to stub, no Actions runner semantics to fake.

Option B is attractive because the epic's user story literally says "auto-deploys on the designer's
push," and a workflow file is the most literal "on push" mechanism. **I include a thin
`.github/workflows/deploy.yml` as well** — but as the *documented push path*, with secrets referenced
(`${{ secrets.CLOUDFLARE_API_TOKEN }}`) and a header comment stating it is inert without creds. This
satisfies "auto-deploys on the designer's push" honestly: the wiring is real, the boundary (no creds
here) is stated. Rejecting C: a doc-only convention fails AC#2's "config present" — there must be a
file.

Net: **`wrangler.toml` (the canonical Pages-static config) is the primary asserted artifact; a guarded
`deploy.yml` provides the literal on-push path.** Both are config-present, neither runs here.

---

## Decision 3 — Gate-safety against `bun test`: **structural avoidance + a root-level guard**

This is the load-bearing decision (`research.md` flagged `bun test`'s whole-tree scan as the only real
regression vector; typecheck is already safe via `include: ["src"]`).

**Options**

- **A. Rely on "the seed has no `*.test.*` files."** Zero cost. Fragile: T-058-03 or any future layer
  could add one and silently break vend's gate.
- **B. Add a `bunfig.toml`** with a test `root`/coverage scope that confines `bun test` to `src/`.
  Durable, but introduces a repo-wide config file as a side effect of an example ticket, with some
  risk of changing how the existing gate discovers `src/**/*.test.ts`.
- **C. Verify empirically that `bun run check` is unchanged after the seed lands, and document the
  invariant** ("the seed contains no test files; `examples/` is outside `tsconfig` include"), leaving a
  durable guard to the dedicated owner.

**Decision: A + C — structural avoidance, empirically verified, with the invariant documented; do NOT
add `bunfig.toml` in this ticket.** Rationale:

- The seed genuinely needs **no** `*.test.*`/`*.spec.*` files (a minimal Astro starter has none), so
  the regression vector is closed by construction.
- Adding a repo-wide `bunfig.toml` (Option B) is **out of proportion** to an example-content ticket and
  risks perturbing the *existing* gate's discovery of `src/**/*.test.ts` — a change with blast radius
  far beyond `examples/`. If a test-scope guard is ever wanted, it belongs in its own ticket touching
  the gate deliberately, not as a side effect here.
- The contract is enforced by **running `bun run check` before and confirming green after** the seed is
  committed (the ticket's AC#3, made into a concrete verification step in `plan.md`).

This keeps the change additive and reversible: the entire ticket is new files under `examples/` with no
edits to `src/`, `package.json`, or `tsconfig.json`.

---

## Decision 4 — React component content: **a tiny interactive counter / "agents building" stub**

The component only needs to prove the React integration hydrates. A minimal `client:load` counter is
the canonical proof and is honest (no fake product surface). I will give it a hackathon-flavored label
so the seed reads as a real starter, not lorem ipsum, but keep it to one stateful component + the page.
This also leaves a natural, obvious place for T-058-04 to later embed the SVG board beside the app.

---

## Decision 5 — Verification posture: **attempt a real `npm install && npm run build`; fall back to
config-shape assertion if the registry is unreachable**

`research.md` confirmed npm 10 + node 22 are present. The strongest evidence for AC#1 is an actual green
build, so the plan attempts it. If the npm registry is unreachable in this sandbox, the fallback is:
assert config shape (valid `package.json`, `astro.config.mjs`, integration wiring) and document the
exact command for the designer/CI. The Implement/Review artifacts will record **which** path was taken,
honestly (per E-058's honest-on-outcome discipline).

---

## What is explicitly out of scope (deferred, with reason)

- **vend drive wiring** (README/SEED/charter/shelf-note/EXPECTED-OUTCOME) — **T-058-03**.
- **Serving the SVG board into the preview** — **T-058-04**.
- **Live Cloudflare deploy** — needs creds; epic honest-boundary (1).
- **A repo-wide `bunfig.toml` test guard** — over-scoped for this ticket (Decision 3).
- **SSR / CF Workers bindings** — unneeded for a static demo (Decision 1).
