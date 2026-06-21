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
import {
  fundingEnvelope,
  recalibrate,
  type FundingOptions,
  type RecalibrateOptions,
} from "../ledger/recalibrate.ts";
import type { RunRecord } from "../log/run-log.ts";
import type { ValueTier } from "../shelf/menu.ts";

/** The neutral middle value-tier a BARE `vend chain` / `vend run` default rung recalibrates at — the
 *  same tier work.ts's price path uses (the `envelope`/`audit` arms' default). A bare chain carries no
 *  board row, so there is no value tier in scope; "standard" is the honest middle. The tier only
 *  selects the percentile WHEN there is measured history — on cold-start recalibrate returns the prior
 *  regardless. Exposed (and overridable) so the choice is legible and unit-testable. */
export const CHAIN_DEFAULT_TIER: ValueTier = "standard";

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

/**
 * Derive the MEASUREMENT-FUNDED default rung for one chain step (T-050-02, IA-14). PURE/TOTAL. This is
 * the guard a bare `vend chain` / `vend run` step RUNS under when it has NO per-step or uniform
 * `--budget` override — the cold-start thin prior that censored the E-049 decompose (its 120k static
 * default). Composes the two pure cores: `recalibrate` proposes the play's measured envelope (or the
 * `prior` on cold-start), then `fundingEnvelope` post-processes it to `max(price, maxCensoredActual ×
 * MEASUREMENT_HEADROOM)` when under-calibrated — so an under-bounding step clears its observed wall,
 * FINISHES, and RECORDS, breaking the censoring ratchet.
 *
 * GUARD ≠ PRICE (IA-8): this is what the cast is FUNDED with, not what the shelf quotes — it never
 * touches `recalibrate`'s returned envelope, the percentile math, or `formatEnvelopeLabel`. A
 * well-calibrated play (`measured`, low censored rate) funds at its honest p90 verbatim (funding ==
 * price — back-compat). An explicit override still WINS: this only supplies the default rung
 * {@link resolveStepBudgets} falls back to. `prior` doubles as the recalibrate cold-start prior AND
 * the `priced` base `fundingEnvelope` widens from — pass the play's own static `.budget`.
 */
export function fundedStepDefault(
  records: readonly RunRecord[],
  play: string,
  prior: Budget,
  tier: ValueTier = CHAIN_DEFAULT_TIER,
  opts: { readonly recalibrate?: RecalibrateOptions; readonly funding?: FundingOptions } = {},
): Budget {
  const result = recalibrate(play, records, tier, prior, opts.recalibrate);
  return fundingEnvelope(play, records, result, opts.funding).envelope;
}
