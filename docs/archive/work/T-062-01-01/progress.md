# Progress — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Implement. What's done, what's verified, deviations._

## Status: COMPLETE — all plan steps done, full gate green.

## Steps executed (per plan.md)

### ✅ Step 1 — pure contract + validator (`src/kitchen/dish-seed.ts`)
Created. Exports the contract (`DISH_COLLECTION_SLUG`, `REQUIRED_DISH_FIELDS`,
`REQUIRED_DISH_FIELD_REQUIRED`), the EmDash seed types (faithful minimal subset), and the
pure ops `parseKitchenSeed` / `findCollection` / `dishRecords` / `validateDishSeed`. No fs /
network / clock — pure-core discipline preserved. `validateDishSeed` accumulates
`violations` (soft on bad data); `parseKitchenSeed` throws only on structurally-invalid JSON.

### ✅ Step 2 — authored EmDash seed (`examples/templates/kitchen-seed/.emdash/seed.json` + `README.md`)
Created. `seed.json` declares the `dishes` collection (`name` string/required, `photo`
image, `description` text; `labelSingular: "Dish"`, `$schema` + `version: "1"`) and exactly
one published example dish whose prose self-documents the format (honest-empty, IA-4).
`photo` is a placeholder reference string — no binary shipped, fully clear of the
storefront's `public/`. `README.md` explains the content type, the honest-empty rule, the
no-live-server boundary, and the first-boot apply behavior.

### ✅ Step 3 — gate test (`src/kitchen/dish-seed.test.ts`)
Created. Positive cases read the REAL authored `seed.json` (drift-guard precedent) and pin
the AC: validates ok; the Dish collection declares photo/name/description with contract
types and `name` required; `dishRecords` returns exactly one published record carrying the
three fields. Negative cases (in-memory seeds) prove the rule is genuine: zero records fails,
two records fails, a missing field fails, a mistyped field fails, an absent collection fails.

### ✅ Step 4 — full-gate confirmation
- `bun test src/kitchen/` → **10 pass / 0 fail** (25 expect calls).
- `bun run check:typecheck` (`tsc --noEmit`) → exit 0.
- `bun run check` (baml:gen + typecheck + full suite) → **1454 pass / 1 skip / 0 fail**
  across 94 files. The new files perturb nothing existing.

## Deviations from plan

- **Test helper simplification (minor).** The first draft of the negative-case helper
  `seedWithRecords` had a nonsense conditional-type signature; replaced with a plain
  `(records: readonly EmDashRecord[]) => EmDashSeed` and imported `EmDashRecord`. No change
  to coverage or intent. No other deviations.

## Commits

Left to Lisa's commit serialization (file-locking) per the concurrency model — this thread
shares the branch with sibling T-062-01-02 and does not self-commit on the default branch.
Logical commit boundaries, in order, are the three plan steps:
1. `feat(kitchen): add the Dish content-type contract + seed validator (E-062)`
2. `feat(kitchen): author the Dish content type + one example dish seed (E-062)`
3. `test(kitchen): assert the Dish schema + single-row honest-empty seed (E-062)`

## Disjointness held (concurrency)

No existing file modified. Only new files created: `src/kitchen/dish-seed.ts`,
`src/kitchen/dish-seed.test.ts`, `examples/templates/kitchen-seed/.emdash/seed.json`,
`examples/templates/kitchen-seed/.emdash/README.md`. Sibling T-062-01-02's files
(`astro.config.mjs`, `wrangler.toml`, `src/pages/index.astro`, `package.json`,
`.github/workflows/`) are untouched. `init-core.ts` is untouched (`kitchen` template
registration is out of this AC).
