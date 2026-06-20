# T-025-01 — Plan: ordered, atomically-committable steps

*Phase: Plan. Each step is independently verifiable and commits clean.*

## Testing strategy

- **Unit (addon-free):** `chain-propose-decompose-core.test.ts` covers `resolveStepBudgets` across all
  five rung combinations (Structure §3). This is the only new logic with a pure seam — and the seam
  AC#3 names.
- **Type/compile:** the two optional option fields + the `work.ts` envelope threading are checked by
  `bun run check:typecheck` (no new runtime behavior to assert there — back-compat is a *type* + a
  *selection* property, both covered above).
- **Untested by design:** `castProposeDecomposeChain` and `castWork` stay un-unit-tested (addon /
  live), exactly as `castChain` — their correctness is the pure core + the live re-sweep.
- **Gate:** `bun run check:*` (typecheck + test + lint) green before the sweep.
- **Live proof (AC#4):** the human bounded `vend work` re-sweep against the staged board — must clear
  ≥1 and Settle truthfully, hard-stops intact.

## Step 1 — Pure core module + test (no addon)

**Create** `src/play/chain-propose-decompose-core.ts`:
- `StepBudgetOverrides`, `ResolvedStepBudgets` interfaces; `resolveStepBudgets(overrides,
  proposeDefault, decomposeDefault)` with the `per-step ?? budget ?? default` rung order.

**Create** `src/play/chain-propose-decompose-core.test.ts`:
- The five cases from Structure §3, asserting both denominations.

**Verify:** `bun test src/play/chain-propose-decompose-core.test.ts` green; `bun run check:typecheck`
clean. This step stands alone — nothing imports it yet.

**Commit:** `feat(chain): pure resolveStepBudgets core — per-step budget selection (T-025-01)`

## Step 2 — Wire per-step budgets into the chain

**Modify** `src/play/chain-propose-decompose.ts`:
- Import `resolveStepBudgets`.
- Add `proposeBudget?` / `decomposeBudget?` to `ChainProposeDecomposeOptions`; refine the `budget`
  doc-comment to "middle fallback rung".
- Replace lines 72–73 with the single `resolveStepBudgets(opts, proposeEpicPlay.budget,
  decomposeEpicPlay.budget)` destructure. Downstream untouched.

**Verify:** `bun run check:typecheck` clean; `bun test` still green (offline thread test unaffected —
it does not import this module; back-compat: no-override path returns the same defaults as before).

**Commit:** `feat(chain): accept per-step propose/decompose budgets (T-025-01)`

## Step 3 — Thread the recalibrated envelopes in `castWork`

**Modify** `src/play/work.ts`:
- Name the two `recalibrate(...).envelope` results `proposeEnvelope` / `decomposeEnvelope`; keep
  `price = sumBudgets(proposeEnvelope, decomposeEnvelope)` for `canAfford`.
- Pass `proposeBudget: proposeEnvelope, decomposeBudget: decomposeEnvelope` into the `castOne`
  `castProposeDecomposeChain({...})` call. **Authorization == execution.**

**Verify:** `bun run check:typecheck` clean; `bun run check:*` (full gate) green.

**Commit:** `fix(work): cast each pull under its wallet-reserved price, not the static default (T-025-01)`

## Step 4 — Full gate + handoff for the live re-sweep

**Verify:** `bun run check` (the whole gate) green — typecheck, all tests, lint/format.

Document in `progress.md` that Steps 1–3 land the budget-threading fix and the code-side ACs (#1, #2,
#3) are met; **AC#4 is the human bounded `vend work` re-sweep** (materializes real work + burns
tokens, run as verification like the E-024 sweep). Provide the exact sweep command and the expected
outcome so the human can execute it:

```
bun run src/cli.ts work --budget 1200000,500000   # against steer.md, sized for ~1 chain
```

Expected: the #1 pull's propose now runs under its ~227k reservation (not 150k), the 175k propose
fits, the chain clears, ≥1 pull Settles truthfully, hard-stops intact.

## Risk / rollback

- **Smallest possible blast radius:** optional-only option fields + one call-site rewrite + one
  predict-block rename. Each step compiles and tests green on its own; any step is revertible in
  isolation.
- **Back-compat is structurally guaranteed**, not just tested: the no-override path is literally the
  prior expression, now produced by a pure function with proven cases.
- The only unverifiable-until-live claim is AC#4 (the live cast) — by ticket design a human step.

## AC ledger

| AC | Met by |
|----|--------|
| #1 per-step + fallbacks, bare chain unchanged | Steps 1–2 + core test cases 1–5 |
| #2 `castWork` passes the two envelopes (227k) | Step 3 |
| #3 pure-testable selection; `check:*` green | Step 1 test + Step 4 gate |
| #4 live re-sweep clears ≥1 | Step 4 handoff (human) |
