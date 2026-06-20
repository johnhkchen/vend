# T-025-01 — Review: per-step wallet-priced chain

*Phase: Review. The handoff — what changed, coverage, open concerns. Read this, not every diff.*

## What this fixes

E-024's first live `vend work` spend cleared **0** because authorization and execution used different
budgets: the wallet recalibrated the chain (propose 227k + decompose 227k) and authorized on it, but
`castWork` called `castProposeDecomposeChain` with **no budget**, so each step ran under its *static
play default* (propose-epic 150k). The #1 pull's propose needed ~175k → blew the 150k default →
`budget-exhausted` andon → nothing staged. This ticket threads the reserved price into the cast
**per step**, so authorization == execution.

## Changes (4 files, 3 commits)

| File | Action | Summary |
|------|--------|---------|
| `src/play/chain-propose-decompose-core.ts` | **new (pure)** | `resolveStepBudgets(overrides, proposeDefault, decomposeDefault)` — rung order `per-step ?? uniform budget ?? play default`, steps resolved independently. Addon-free. |
| `src/play/chain-propose-decompose-core.test.ts` | **new** | 5 cases covering every rung combination; both denominations asserted. |
| `src/play/chain-propose-decompose.ts` | modify | `+proposeBudget?` / `+decomposeBudget?` (optional); the two `opts.budget ?? play.budget` lines → one `resolveStepBudgets(...)` destructure. Downstream untouched. |
| `src/play/work.ts` | modify | Keep `proposeEnvelope` / `decomposeEnvelope` (were summed-then-discarded); thread them into the `castOne` chain call as per-step budgets. `price`/`canAfford` unchanged. |

Commits: `feat(chain): pure resolveStepBudgets core …` → `feat(chain): accept per-step … budgets …`
→ `fix(work): cast each pull under its wallet-reserved price …`.

## How each acceptance criterion is met

- **AC#1 — per-step budgets with fallback, bare chain unchanged.** `resolveStepBudgets` is *additive*:
  with no overrides each step returns exactly its play default — literally the prior expression. A
  bare `vend chain` / `vend run` passes no overrides and casts byte-for-byte as before. ✅ (core test
  case 1; the offline thread test `chain-propose-decompose.test.ts` still passes, 3/3.)
- **AC#2 — `castWork` passes the two envelopes (227k, not 150k).** `work.ts` now names and keeps the
  two `recalibrate(...).envelope` results and threads them as `proposeBudget`/`decomposeBudget`. A
  fitted pull casts under exactly what the wallet authorized. ✅ (code path; proven end-to-end by
  AC#4's live sweep.)
- **AC#3 — pure-testable selection; `check:*` green.** The selection logic lives in the addon-free
  core, unit-tested for real (not mirrored). `bun run check` (baml:gen + typecheck + full test) →
  **830 pass / 0 fail**. ✅
- **AC#4 — live re-sweep clears ≥1.** Human step by ticket design (materializes real work, burns
  tokens). **Not yet run** — see Open concerns. The fix removes the root cause; the sweep is the proof.

## Test coverage

- **New:** 5 unit cases on `resolveStepBudgets` — no overrides, uniform only, one-sided per-step
  (proves independence + asymmetric fallback), per-step beats uniform, both per-step. Each asserts
  `timeMs` and `tokens` so the whole `Budget` is proven to flow, not just tokens.
- **Unchanged-and-green:** the offline propose→decompose thread proof (3 cases) — confirms back-compat
  (it does not import the impure shell and is unaffected).
- **Deliberately untested (by house pattern):** `castProposeDecomposeChain` and `castWork` remain
  un-unit-tested — they value-import the BAML addon and spawn live casts, exactly like `castChain`.
  Their correctness = the pure core (now tested) + the live sweep. This is the documented stance, not
  a gap to close.

## Coverage gaps / what a reviewer should weigh

- **The wiring inside the impure shell is not unit-tested.** `resolveStepBudgets` is proven, but the
  *fact that `castProposeDecomposeChain` calls it with the play defaults*, and the *fact that
  `castWork` passes the recalibrated envelopes*, are verified only by typecheck + the live sweep.
  This is intrinsic to the addon boundary (the same reason `castChain` is untested) and is the
  reason AC#4 exists. Review the two call sites by eye: `chain-propose-decompose.ts` (the
  `resolveStepBudgets(opts, proposeEpicPlay.budget, decomposeEpicPlay.budget)` destructure) and
  `work.ts` (the `proposeBudget`/`decomposeBudget` keys on the `castOne` call).

## Open concerns

1. **AC#4 is unverified until the human runs the sweep.** Expected:
   `bun run src/cli.ts work --budget 1200000,500000` against `steer.md` now clears ≥1 pull (propose
   fits under ~227k), wallet debits actuals, session Settles truthfully, hard-stops intact. If it
   still clears 0, the next suspect is the *recalibrated* number itself (does the ledger actually
   yield ≥175k for propose at the `standard` tier?), not the threading — the threading is now proven
   to carry whatever `recalibrate` returns.
2. **Predict-once assumption.** `work.ts` still prices the chain once for all signals (the chain casts
   the same two plays per signal). Unchanged by this ticket and correct today; if signal-specific
   pricing ever lands, the envelope computation moves inside `castOne` but the threading seam stays.
3. **No new denomination handling.** The andon was token exhaustion; the fix threads the whole
   `Budget` (time + tokens) so both stay consistent with authorization. No time-only edge introduced.

## Out of scope (intentionally untouched)

Play defaults (150k/120k) stay the cold-start fallback; `recalibrate.ts` / per-play envelopes (E-013)
unchanged; `spend.ts`, `budget.ts` unchanged; `epicSubjectFromPath` not moved. Blast radius is
optional-only option fields + one resolve call + one envelope-threading edit — each step compiles and
tests green in isolation and is independently revertible.

## Bottom line

The macro-wallet's premise ("fit each cast at its measured price *and spend at it*") is now fully
wired. Code-side ACs (#1–#3) are met with the gate green at 830/0; the live re-sweep (AC#4) is the
remaining human proof, and its first cleared autonomous pull becomes the forward E1 for the trust loop.
