# T-025-01 — Progress

*Phase: Implement. Executed the plan; commits incremental. No deviations from the plan.*

## Status: code complete (AC#1–#3 met) — AC#4 is the human live re-sweep

| Step | What | Commit | State |
|------|------|--------|-------|
| 1 | Pure `resolveStepBudgets` core + 5-case test | `feat(chain): pure resolveStepBudgets core …` | ✅ green (5 pass) |
| 2 | Per-step options wired into `castProposeDecomposeChain` | `feat(chain): accept per-step propose/decompose budgets …` | ✅ typecheck + offline thread test green |
| 3 | `castWork` threads the two recalibrated envelopes | `fix(work): cast each pull under its wallet-reserved price …` | ✅ full gate green |
| 4 | Full `bun run check` gate + handoff | (this artifact) | ✅ 830 pass / 0 fail |

## What changed

- **`src/play/chain-propose-decompose-core.ts`** (new, pure, addon-free): `StepBudgetOverrides`,
  `ResolvedStepBudgets`, `resolveStepBudgets(overrides, proposeDefault, decomposeDefault)` —
  rung order `per-step ?? uniform budget ?? play default`, propose/decompose resolved independently.
- **`src/play/chain-propose-decompose-core.test.ts`** (new): 5 cases — no overrides, uniform only,
  per-step one-side, per-step beats uniform, both per-step (the 227k/227k `vend work` case). Both
  denominations asserted.
- **`src/play/chain-propose-decompose.ts`**: added `proposeBudget?` / `decomposeBudget?` (optional);
  replaced the two `opts.budget ?? play.budget` lines with the `resolveStepBudgets` destructure;
  refined the budget doc-comments + header. Downstream step construction unchanged.
- **`src/play/work.ts`**: named and kept `proposeEnvelope` / `decomposeEnvelope` (previously summed
  inline and discarded); `price = sumBudgets(...)` for `canAfford` unchanged; threaded the two
  envelopes into the `castOne` → `castProposeDecomposeChain` call as the per-step budgets.

## Verification run

- `bun test src/play/chain-propose-decompose-core.test.ts` → 5 pass.
- `bun test src/play/chain-propose-decompose.test.ts` → 3 pass (offline thread proof unaffected — it
  does not import the shell; back-compat holds).
- `bun run check` (baml:gen + typecheck + full `bun test`) → **830 pass / 0 fail**.

## Deviations

None. Scope held exactly to the plan: per-step options + pure core + envelope threading. Did **not**
bump the 150k/120k play defaults, did **not** touch `recalibrate`/`spend.ts`/`budget.ts`, did **not**
move `epicSubjectFromPath`.

## AC#4 — the live re-sweep (human step, deferred by ticket design)

The live cast materializes real work + burns tokens, so it is run as the verification (like the E-024
sweep), not in CI. The fix makes the cast run under the wallet's reservation, so the #1 pull's ~175k
propose now fits under its ~227k recalibrated envelope instead of blowing the 150k static default.

Suggested sweep command (steer board, sized for ~1 chain):

```
bun run src/cli.ts work --budget 1200000,500000
```

Expected: ≥1 pull clears (epic + tickets materialize), the wallet debits actuals, the session Settles
truthfully, hard-stops intact. That first cleared autonomous pull is the forward E1 for the trust loop.
