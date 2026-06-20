// The PURE core of the propose→decompose chain's budget selection (T-025-01, story S-025-01, epic
// E-025 wallet-priced-casts). The impure shell `chain-propose-decompose.ts` value-imports both plays
// (the BAML native addon), so its logic cannot be unit-tested directly (a `bun test` that imports it
// loads the addon). This module is the addon-free home for the one piece that IS pure — resolving
// each step's cast budget — so it gets real coverage, exactly the `work.ts` → `work-core.ts` and
// `chain.ts` → `chain-core.ts` precedent (pure core + impure shell).
//
// WHY THIS EXISTS (E-024 live-sweep diagnosis): `vend work` AUTHORIZED a pull at the wallet's
// recalibrated price (propose 227k) but EXECUTED it under the play's static default (150k), because
// the cast was given no budget. The fix threads the reserved price PER STEP. This module owns the
// rung order that makes "authorization == execution" precise: per-step override ?? uniform budget ??
// the play's cold-start default — additive over the prior `budget ?? default`, so a bare cast is
// unchanged (back-compat).

import type { Budget } from "../budget/budget.ts";

/** The per-step budget overrides a caller may supply (the budget subset of the chain's options). */
export interface StepBudgetOverrides {
  /** Override applied to BOTH steps when the matching per-step override is absent (middle rung). */
  readonly budget?: Budget;
  /** Highest-priority override for the propose step. */
  readonly proposeBudget?: Budget;
  /** Highest-priority override for the decompose step. */
  readonly decomposeBudget?: Budget;
}

/** The two resolved per-step budgets the chain casts each step under. */
export interface ResolvedStepBudgets {
  readonly proposeBudget: Budget;
  readonly decomposeBudget: Budget;
}

/**
 * Resolve each chain step's cast budget. PURE. Rung order, per step:
 *   per-step override ?? uniform `budget` ?? the play's static default.
 *
 * Purely additive over the prior `budget ?? default` behavior: with NO overrides each step returns
 * exactly its play default, so a bare `vend chain` / `vend run` casts byte-for-byte as before. The
 * propose and decompose steps resolve INDEPENDENTLY — they recalibrate separately and can diverge, so
 * `vend work` threads two distinct envelopes (227k / 227k), not one summed total.
 */
export function resolveStepBudgets(
  overrides: StepBudgetOverrides,
  proposeDefault: Budget,
  decomposeDefault: Budget,
): ResolvedStepBudgets {
  return {
    proposeBudget: overrides.proposeBudget ?? overrides.budget ?? proposeDefault,
    decomposeBudget: overrides.decomposeBudget ?? overrides.budget ?? decomposeDefault,
  };
}
