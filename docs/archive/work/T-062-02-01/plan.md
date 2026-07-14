# Plan — T-062-02-01 init-template-kitchen-lays-emdash-astro-seed

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy. Each step is
commit-sized and leaves the gate green._

## Testing strategy

- **Unit / pure (existing, `init-core.test.ts`):** the registry/standalone invariants already
  iterate `TEMPLATE_REGISTRY` and `STANDALONE_TEMPLATES`, so registering `kitchen` is
  auto-covered for honest-empty + LISA_MARKER + "standalone ⊆ registry". Two assertions need
  manual edits (the available-list, the `.gitignore` clause).
- **Guarded-live (new, `init-kitchen.test.ts`):** the AC — a real `mkdtemp` empty dir, real
  `runInit(root,"kitchen")`, real `readFile`/`stat`, torn down in `finally`. This is the same
  no-mocks discipline as `init-effect.test.ts`.
- **Contract reuse:** the Dish-type / example-dish half of the AC is asserted by reusing
  `parseKitchenSeed` + `validateDishSeed` from `dish-seed.ts` against the *scaffolded* file — so
  the test grades against the authored contract, not a re-statement of it.
- **Bytes-are-authored:** assert the scaffolded `seed.json` equals the example file — proves the
  text-import embed writes the real seed (the structural substitute for a drift test).
- **Gate:** `bun test src/init src/kitchen` green; full `bun run check` (`baml:gen` +
  `tsc --noEmit` + tests) green; spot-confirm `bun build --compile` still produces a binary that
  scaffolds (manual, since CI compile is out of scope).

Verification criteria for "done": the AC test passes, the two updated suites pass, `tsc` clean,
no existing test regressed.

## Steps

### Step 1 — `src/kitchen/kitchen-overlay.ts` (new)

Create the overlay module: 12 `with { type: "text" }` imports of the authored seed files, a
`type`-only import of `ScaffoldEntry`, and the exported `KITCHEN_OVERLAY` array (paths =
project-root-relative scaffold targets; files-only). Header comment per Structure.

**Verify:** `bunx tsc --noEmit` clean; `bun -e 'import("./src/kitchen/kitchen-overlay.ts").then(m
=> console.log(m.KITCHEN_OVERLAY.length, m.KITCHEN_OVERLAY.map(e=>e.path)))'` prints 12 entries
with the expected paths and non-empty contents.
**Commit:** `feat(kitchen): author the kitchen init overlay (text-embedded seed)`.

### Step 2 — register in `src/init/init-core.ts`

Add the `KITCHEN_OVERLAY` import; add `kitchen: KITCHEN_OVERLAY` to `TEMPLATE_REGISTRY`; add
`"kitchen"` to `STANDALONE_TEMPLATES`; refine the one-way `.gitignore` comment. No logic change.

**Verify:** `bunx tsc --noEmit` clean. `bun test src/init/init-core.test.ts` — expect the
`availableTemplates` assertion and the `.gitignore` invariant to now FAIL (the signal that the
data landed); everything else green. (These fail until Step 3.)
**Commit:** folded with Step 3 (the registry change + its test updates are one logical unit).

### Step 3 — update the two existing assertions

- `init-core.test.ts`: `availableTemplates()` → `["hackathon","kitchen","minimal"]`; rewrite the
  one-way `.gitignore` clause to iterate `Object.entries(TEMPLATE_REGISTRY)` and apply the
  `!== ".gitignore"` assertion only for `!isStandaloneTemplate(name)` (keep `LISA_MARKERS` for all).
- `init-effect.test.ts`: unknown-template `available` → `["hackathon","kitchen","minimal"]`.

**Verify:** `bun test src/init` fully green.
**Commit:** `feat(init): register the standalone kitchen template (E-062 S-062-02)`
(steps 2+3 together).

### Step 4 — `src/kitchen/init-kitchen.test.ts` (the AC)

Author the guarded-live test per Structure: standalone empty-dir lay-down (full seed: Dish type +
example dish via `validateDishSeed`, stub storefront, Cloudflare config, package.json, base board
honest-empty, bytes-are-authored, one-way), no-clobber converge, registry pins.

**Verify:** `bun test src/kitchen` green (incl. the existing `dish-seed.test.ts`); then
`bun run check` fully green.
**Commit:** `test(kitchen): cast vend init --template kitchen lays the full seed (T-062-02-01)`.

### Step 5 — compile smoke (manual, belt-and-suspenders)

Run `bun build --compile src/cli.ts --outfile /tmp/vend-probe` (the compile path) and, from an
empty temp dir, run `/tmp/vend-probe init --template kitchen` → confirm it scaffolds the seed (the
text-embedded bytes survive into the binary, the brew-install reality). Not committed (no CI
compile in scope); recorded in `progress.md`/`review.md`.

## Rollback / blast radius

- All changes are additive: one new module, one new test, two assertion edits, a registry entry +
  set member. No existing control flow changes (`runInit`/`applyInitScaffold`/`cli.ts` untouched).
- If text imports unexpectedly fail the gate, the fallback is Option A (inline constants + drift
  tests) for the few files that need it — but Research verified all three toolchain axes, so this
  is contingency only.
- Reverting is dropping the registry entry + standalone member + the new files; bare `vend init`
  and the `hackathon`/`minimal` paths are wholly unaffected.

## What this plan deliberately does NOT do

- No EmDash↔Astro live integration (the 01-01/01-02 co-ownership seam) — scaffold as authored.
- No CI build-of-the-seed check — deferred to `vend doctor` (T-062-02-02), per 01-02's review.
- No change to the seed files themselves — this ticket *ships* them, it does not re-author them.
