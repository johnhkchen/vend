// The chain primitive's IMPURE shell (T-011-01, story S-011-01, epic E-011) — `castChain`, the
// engine's first COMPOSITION primitive. Runs a sequence of plays through the SAME generic
// `castPlay`, threading each step's `produced` output into the next step's input via a per-step
// `adapt`, halting the chain on any non-success. The fixed spine (sequencing + threading + halt)
// lives in the pure ./chain-core.ts (`runChain`); this module owns only the impure wiring —
// building each step's `cast` thunk (`adapt → castPlay`) — and re-exports the core so callers
// have ONE engine entry for the chain surface (the cast.ts re-export pattern).
//
// DEPENDENCY DIRECTION (E-007 keystone): the engine stays acyclic. This module imports the
// engine (`castPlay`, the `Play` contract, the pure core) and `Budget` only — NEVER `src/play/`.
// A concrete chain (the propose→decompose steps) is assembled BY the caller in T-011-02, where
// the concrete plays depend UP onto this primitive; the primitive never depends down on them.
//
// PURITY: `castChain` is the impure verb (it awaits each `adapt` — which may read fs — and calls
// `castPlay`, which spawns + logs). It is NOT unit-tested; its logic is the pure `runChain`
// core, proven live when the propose→decompose chain is cast in T-011-02. One run-log record per
// step is structural: `castChain` calls `castPlay` once per step, and `castPlay` appends exactly
// one record per cast.

import type { Budget } from "../budget/budget.ts";
import { castPlay, type CastOptions } from "./cast.ts";
import type { Play } from "./play.ts";
import { runChain, type ChainResult, type ChainStep } from "./chain-core.ts";

// Re-export the pure core so a caller (T-011-02) has one import for the whole chain surface.
export * from "./chain-core.ts";

/**
 * One play in a chain: the play, its budget + cast options, and an `adapt` that builds the
 * step's typed inputs from the upstream `produced` reference. The FIRST step's `adapt` ignores
 * `upstream` (it has none); each LATER step adapts the previous step's `produced` into its own
 * inputs (e.g. an epic path → DecomposeEpic's `epicPath`, wired in T-011-02). `adapt` may be
 * async — assembling a play's inputs reads fs (`assembleProposeEpicInputs`), so `castChain`
 * awaits it before casting.
 *
 * @typeParam I the play's typed inputs
 * @typeParam O the play's typed output
 */
export interface PlayStep<I, O> {
  readonly play: Play<I, O>;
  readonly budget: Budget;
  readonly opts: CastOptions;
  readonly adapt: (upstream: string | undefined) => I | Promise<I>;
}

/**
 * Cast a sequence of plays end to end — the chain primitive. Threads each step's `produced`
 * output into the next step's `adapt`; HALTS on any non-success (no downstream cast); appends
 * one run-log record per cast step. The impure shell over the pure `runChain`: it builds each
 * step's `cast` thunk (`adapt → castPlay`) and hands the thunks to the core, which owns the
 * sequencing / threading / halt decision.
 *
 * The `PlayStep<any, any>[]` element type is the same documented, unavoidable type-erasure as
 * `AnyPlay = Play<any, any>` (play.ts): a chain is heterogeneous — its steps hold plays with
 * different `I`/`O`, which a single array cannot preserve. Type safety lives at each
 * `PlayStep`'s internally-consistent construction (T-011-02 builds the concrete steps with real
 * types) and at the `adapt` boundary.
 */
export async function castChain(steps: readonly PlayStep<any, any>[]): Promise<ChainResult> {
  const chainSteps: ChainStep[] = steps.map((s) => ({
    cast: async (upstream) => {
      const inputs = await s.adapt(upstream);
      return castPlay(s.play, inputs, s.budget, s.opts);
    },
  }));
  return runChain(chainSteps);
}
