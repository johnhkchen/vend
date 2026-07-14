# Design — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Design. Options, tradeoffs, the decision and its rationale — grounded in Research._

## The shape of the decision

The control flow is already built and tested: `runInit` resolves a template, gates (or bypasses
for standalone), merges base+overlay, applies write-if-absent/no-clobber. This ticket needs to
supply **(1) the kitchen overlay's `ScaffoldEntry[]` content**, **(2) register it + mark it
standalone**, and **(3) a test that casts `vend init --template kitchen` and pins the AC**. The
single real design question is **how the 12 authored seed files get into the overlay's `contents`
strings such that they survive `bun build --compile` into a brew binary.**

## Question 1 — sourcing the seed content into the overlay

### Option A — inline as TS string constants + drift tests (the `HACKATHON_CHARTER` pattern)

Copy each file's bytes into a `const FOO = \`…\`` template literal; a test reads the example file
and asserts byte-equality. Proven, tsc-clean, compile-safe.

- ✚ Established precedent; zero new mechanism.
- ✚ Pure string constants — trivially fit `init-core.ts`'s purity.
- ✘ **Escaping hell.** `deploy.yml` contains `${{ secrets.* }}` → every `${` must become `\${`;
  `README-STACK.md`/`.emdash/README.md` are dense with backticks → every `` ` `` must be `` \` ``.
  12 files, 95 KB of `bun.lock` — hand-escaping is error-prone and unreadable.
- ✘ **Drift surface.** 12 hand-copied mirrors, 12 drift tests, forever out of sync risk.

### Option B — read `examples/templates/kitchen-seed/` from disk at runtime

`runInit` reads the example tree and writes it.

- ✚ Zero duplication; always in sync.
- ✘ **Fatal: the brew binary doesn't ship `examples/`.** Verified — the binary is `bun build
  --compile src/cli.ts`; the example dir is not beside it. Works in-repo, breaks for every real
  install. Disqualified.

### Option C — text imports: `import x from "…/f" with { type: "text" }` (CHOSEN)

Build the overlay from `with { type: "text" }` imports of each authored file. Bun's `--compile`
**inlines the bytes into the binary at build time**; `bun test` and tsc resolve them natively.

- ✚ **The file *is* the source.** No copy, so **drift is structurally impossible** — no drift
  test needed (the embedded bytes are the authored bytes).
- ✚ **No escaping.** Backticks and `${` pass through untouched — they're never in a JS literal.
- ✚ **Embeds in the binary** (verified: the compiled probe printed the asset after its source was
  moved). Works for the brew install — the disqualifier for Option B.
- ✚ **tsc-clean under this repo's config** (verified: `bundler` resolution + the import attribute,
  no ambient `*.ext` declaration). `bun test` supports it natively.
- ✚ Still pure: the imported value is a compile-time `string` constant, semantically identical to
  `HACKATHON_CHARTER` — no runtime fs/clock/network. Purity doctrine holds.
- ✘ One mild novelty: the first `with { type: "text" }` imports in the codebase. Mitigated — the
  three risk axes (compile-embed, tsc, test-runtime) were each verified before choosing.

**Decision: Option C.** It is the only option that is simultaneously duplication-free,
escaping-free, and binary-safe. Option A's escaping + 12-file drift surface is precisely the cost
C removes; B is disqualified by the brew binary.

## Question 2 — where the overlay lives

`init-core.ts`'s registry should stay a **one-line entry per template** (it reads `hackathon: […]`,
`minimal: []`). Inlining 12 text imports + a nested `ScaffoldEntry[]` there would bloat the pure
core and couple it to the example tree's layout.

**Decision:** a new module `src/kitchen/kitchen-overlay.ts` that owns the text imports and exports
`KITCHEN_OVERLAY: readonly ScaffoldEntry[]`; `init-core.ts` imports the constant and registers
`kitchen: KITCHEN_OVERLAY`. This co-locates kitchen concerns beside `dish-seed.ts`, keeps the
registry one line, and confines the `../../examples/...` paths to one file. The `src/init →
src/kitchen` import is a registry pulling a template's data — a value import, no cycle (kitchen
does not import init).

Rejected: defining the overlay inside `init-core.ts` (bloat + path coupling, as above).

## Question 3 — standalone, and base+overlay

- **Standalone.** The AC scaffolds "into an empty dir" and E-062's clean-room phase is a hands-off
  fresh-repo drive. So `kitchen` joins `STANDALONE_TEMPLATES` → the lisa gate is bypassed, exactly
  the `minimal` path. The pure invariant ("every standalone name is a registry key") stays true.
- **Base + overlay.** The cook drives with `vend steer`/`vend work`, so they need the vend board
  tree too. `runInit` already applies `mergeManifests(SCAFFOLD_MANIFEST, KITCHEN_OVERLAY)` — the
  cook gets *both* the storefront seed and the honest-empty board. No new merge logic.
- **Files-only overlay.** `applyInitScaffold` does `mkdir(dirname)` before each file write, so the
  overlay lists **files only** (no `dir` entries for `src/`, `public/`, `.github/workflows/`,
  `.emdash/`) — matching the hackathon overlay's files-only style.

## Question 4 — the one-way-to-lisa `.gitignore` invariant

`init-core.test.ts:243` asserts **no** overlay entry is `.gitignore`. That rule protects an
existing lisa project: a non-standalone overlay (`hackathon`) layered onto a checkout must not
own/clobber the lisa repo's root `.gitignore`. But a **standalone** template by definition runs
where there *is no* lisa project — it is minting a fresh workspace and legitimately owns its root
`.gitignore` (and no-clobber protects any pre-existing one regardless).

**Decision:** refine the invariant, don't delete it. Scope the root-`.gitignore` prohibition to
**non-standalone** overlays; keep the `LISA_MARKERS` (`CLAUDE.md`/`.lisa.toml`) prohibition
**absolute** for all overlays (kitchen writes neither). This is a principled tightening of "what
one-way-to-lisa means," documented in the test and in `init-core.ts`'s registry comment.

Rejected: dropping `.gitignore` from the seed (the cook's app repo genuinely needs to ignore
`node_modules/`, `dist/`, `.astro/`, `.wrangler/`) — that would ship a worse seed to satisfy a
test whose intent is narrower than its current wording.

## Question 5 — the test (the AC)

A guarded-live temp-dir test (`init-effect.test.ts` discipline), in a new
`src/kitchen/init-kitchen.test.ts` (co-located with the overlay it exercises):

1. `runInit(emptyDir, "kitchen")` → `scaffolded` **in a non-lisa empty dir** (standalone proven).
2. **Full seed written:** `.emdash/seed.json` parses + `validateDishSeed` ok (Dish type +
   example dish — *reusing the 01-01 contract*); `src/pages/index.astro` present and contains the
   stub copy with **no** `fetch(`; `astro.config.mjs` carries `adapter` + `cloudflare`;
   `wrangler.toml` + `package.json` present; the base board present + honest-empty.
3. **Bytes are the authored bytes:** the scaffolded `seed.json` equals the example file (proves
   the text-import embed writes the real seed, not a stale copy).
4. **No-clobber converge:** a second run → zero created, all skipped; a user edit to a seed file
   survives byte-identical.
5. Registry pins: `availableTemplates()` includes `kitchen`; `isStandaloneTemplate("kitchen")`.

Plus update the two existing list assertions and the refined one-way invariant (Question 4).

## Out of scope (held honestly)

- The EmDash↔Astro live wiring (the 01-01/01-02 co-ownership seam) — scaffold as authored; the
  menu render is what `vend work` clears.
- A CI build of the seed (01-02 review's recommended follow-up) — belongs with `vend doctor`
  (T-062-02-02), not here.
