# Plan — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy. Each step is
an atomic commit._

## Testing strategy (decided first — it shapes the steps)

- **Unit / gate test (`bun test`):** the whole AC is verifiable as a pure + one-runtime-read
  test — `src/kitchen/dish-seed.test.ts`. It reads the authored `seed.json` (the
  drift-guard precedent), validates the schema and the single-row seed, and proves the
  single-row rule with negative in-memory cases. This is the primary verification.
- **Typecheck (`tsc --noEmit`):** `dish-seed.ts` + its test are under `src/`, so the gate
  typechecks them. `seed.json` lives under `examples/` (outside `tsconfig` include) — read
  at runtime, never compiled — so it cannot break typecheck.
- **No integration test.** Live EmDash/D1/REST is out of scope (Design Option C, rejected);
  it belongs to the human-authorized drive, not the gate.
- **Verification command:** `bun run check` (= `baml:gen` + `tsc --noEmit` + `bun test`).
  Scoped runs during dev: `bun test src/kitchen/`.

## Steps

### Step 1 — the pure contract + validator (`src/kitchen/dish-seed.ts`)

Create the module per Structure's interface:
- Contract consts: `DISH_COLLECTION_SLUG`, `REQUIRED_DISH_FIELDS`,
  `REQUIRED_DISH_FIELD_REQUIRED`.
- Types: `EmDashFieldType`, `EmDashField`, `EmDashCollection`, `EmDashRecord`, `EmDashSeed`
  (minimal faithful subset; tolerate unknown keys).
- Pure fns: `parseKitchenSeed`, `findCollection`, `dishRecords`, `validateDishSeed`.
- Pure discipline: no `node:fs`/network/clock. `validateDishSeed` accumulates `violations`,
  never throws on bad *data*; `parseKitchenSeed` throws only on structurally-invalid JSON.

**Verify:** `tsc --noEmit` clean; module imports with no side effects.
**Commit:** `feat(kitchen): add the Dish content-type contract + seed validator (E-062)`

### Step 2 — the authored EmDash seed (`examples/templates/kitchen-seed/.emdash/seed.json` + `README.md`)

Write the seed JSON exactly as Design specifies:
- One `dishes` collection: `name` (`string`, required), `photo` (`image`), `description`
  (`text`); `labelSingular: "Dish"`; `$schema` + `version: "1"`.
- Exactly one published record under `content.dishes` — the self-documenting example dish;
  `photo` a placeholder reference string (no binary).
- `README.md`: 8–15 lines — what the seed declares, the honest-empty rule (one example,
  cook edits/deletes via the admin), the no-live-server boundary, and that EmDash applies
  this on first boot when the DB is empty.

**Verify:** `JSON.parse` succeeds (e.g. `bun -e` or it parses in the Step-3 test); fields
match the contract by eye.
**Commit:** `feat(kitchen): author the Dish content type + one example dish seed (E-062)`

### Step 3 — the gate test (`src/kitchen/dish-seed.test.ts`)

Create the test per Structure:
- Load-once: `readFile(SEED_PATH)` → `parseKitchenSeed`.
- Positive (the AC): validates ok / no violations; `dishes` declares the three fields with
  contract types and `name` required; `dishRecords(seed).length === 1` with the three data
  fields present.
- Negative (rule is genuine): zero records → `!ok`; two records → `!ok`; a dropped/mistyped
  field → `!ok`. In-memory seeds, no disk fixtures.

**Verify:** `bun test src/kitchen/` green; then full `bun run check` green.
**Commit:** `test(kitchen): assert the Dish schema + single-row honest-empty seed (E-062)`

### Step 4 — full-gate confirmation + progress/review

Run `bun run check` end-to-end; confirm typecheck + the whole suite (not just the new file)
is green — the new files must not perturb existing tests. Record outcomes in `progress.md`,
then write `review.md`.

**Verify:** `bun run check` exits 0.
**Commit:** (artifacts are docs; committed with or alongside the work per repo convention.)

## Sequencing rationale

1 before 3 (the test imports the module). 2 before 3 (the test reads the seed). 1 and 2 are
independent and could be authored in either order, but contract-first (1) lets the seed (2)
be written against a known field/type expectation. Each commit leaves the tree typecheck-
clean: after Step 1 the module compiles unused; after Step 2 the seed is inert data; Step 3
activates the assertions. No step leaves the gate red mid-way except the intended moment
Step 3 introduces a test (which passes on commit).

## Risks & mitigations

- **Seed↔contract drift** (e.g. someone renames a field in `seed.json`): caught by Step 3's
  positive test reading the real file — drift turns the gate red, by design.
- **Path resolution in the test:** `readFile` is relative to CWD (= repo root under
  `bun test`), confirmed by the existing `init-effect.test.ts` reading
  `examples/templates/hackathon-seed/charter.md`. Use the same root-relative string.
- **`tsc` picking up `examples/`:** it won't — `tsconfig` includes only `src/`; verify by a
  clean `tsc --noEmit` in Step 1.
- **EmDash schema fidelity:** field types + seed shape are taken from EmDash's own docs
  (Research). If EmDash's beta schema shifts, the seed is a pinned snapshot the autopilot
  re-clears later (per the epic's "EmDash v0.1 beta" risk) — acceptable for the rehearsal.
- **Honest-empty regression:** the negative "two records fails" test guards against a future
  edit sneaking in a second seeded dish.

## Definition of done (this ticket)

- `examples/templates/kitchen-seed/.emdash/seed.json` declares the `Dish` content type
  (photo/name/description) and exactly one example dish.
- `src/kitchen/dish-seed.ts` provides the pure contract + validator + REST model.
- `src/kitchen/dish-seed.test.ts` asserts schema + single-row honest-empty seed (positive)
  and that the single-row rule is enforced (negative).
- `bun run check` is green; no existing file modified; sibling-ticket files untouched.
