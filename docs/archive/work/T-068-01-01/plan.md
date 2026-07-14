# Plan — T-068-01-01 confirm-pricing-cost-weights

## Strategy

One atomic change: add the confirmed `COST_WEIGHTS` vector (+ `CostWeights` type) to
`budget.ts` and its pinning test to `budget.test.ts`, then run the gate. The whole ticket is
a constant and its unit proof — no behavior changes, no other module touched.

## Steps

### Step 1 — Add `CostWeights` + `COST_WEIGHTS` to budget.ts
- Insert the `CostWeights` interface and the frozen `COST_WEIGHTS` const with the full
  pricing-basis doc comment, immediately above `countTokens` (budget.ts:111).
- Values: `{ input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0 }`, `Object.freeze`d.
- Verify: `bun run build` (typecheck) passes; no import added (purity preserved).

### Step 2 — Add the `COST_WEIGHTS` test suite to budget.test.ts
- Extend the named import from `./budget.ts` with `COST_WEIGHTS`.
- Add `describe("COST_WEIGHTS")` with four tests: exact vector, numeraire fixed,
  load-bearing relationships (output = 5× input; cache_read ≪ input ≈ 0.1×;
  cache_creation > input), frozen.
- Verify: `bun test src/budget/budget.test.ts` — new block green, existing suites unaffected.

### Step 3 — Full gate + commit
- `bun run check` (typecheck + lint + format + test) — the real gate.
- Commit atomically: `feat(budget): pin confirmed COST_WEIGHTS cost-weight vector (T-068-01-01)`.

## Testing strategy

- **Unit only.** This is a pure constant; the AC asks exactly for "a unit test asserts the
  confirmed values." No integration test, no live cast (S-068-01: fixture/unit-proven, FREE).
- **What the tests defend:**
  - *Exact-value pin* — silent drift back to parity (all 1.0) or wrong ratios fails.
  - *Relationship pins* — a future edit with plausible-but-wrong numbers that breaks the
    economics (e.g. cache_read ≥ input) still fails, even if the exact-value test were
    loosened.
  - *Frozen pin* — the shared singleton can't be mutated at runtime.
- **Regression guard:** existing `countTokens`/`check`/`timeoutMsFor` suites must stay green
  — proves the addition is purely additive.

## Verification criteria (done)

- [ ] `COST_WEIGHTS` exported from budget.ts as `{input 1.0, cache_read 0.1, cache_creation
      1.25, output 5.0}`, frozen, with the pricing basis cited in a doc comment.
- [ ] `CostWeights` type exported (readonly).
- [ ] `bun run check` green (typecheck + lint + all tests).
- [ ] No non-test module besides budget.ts changed; no import added to budget.ts.
- [ ] Committed atomically with a conventional message referencing T-068-01-01.

## Risks / notes

- **Only risk is a wrong number.** Mitigated by deriving each weight explicitly from cited
  per-MTok prices in the doc comment and pinning them in the test. The ratios were confirmed
  to land exactly on S-068-01's starting figures.
- **Do not scope-creep into `countTokens`.** The reweight of the counting function is
  T-068-01-02, a disjoint ticket that reads this vector. Editing it here would collide with
  that ticket's file (S-068-01 wave rationale) and violate this ticket's boundary.
- **No `bun install` / new dep** — nothing added to the toolchain.
