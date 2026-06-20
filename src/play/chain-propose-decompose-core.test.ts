import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { resolveStepBudgets } from "./chain-propose-decompose-core.ts";

// T-025-01: the pure proof of the chain's per-step budget selection (AC#3). Addon-free — imports only
// the pure core + the `Budget` type, so it runs under `bun test` without loading either play's native
// addon (the reason the selection logic lives in the core, not the impure shell). Proves the rung
// order `per-step ?? uniform ?? play default` AND that propose/decompose resolve INDEPENDENTLY — the
// authorization-vs-execution gap the E-024 live sweep diagnosed.

// Stand-in play defaults (the cold-start fallbacks). Distinct values per denomination per step so a
// wrong rung or a crossed step is observable in the assertion.
const PROPOSE_DEFAULT: Budget = { timeMs: 1_800_000, tokens: 150_000 };
const DECOMPOSE_DEFAULT: Budget = { timeMs: 7_200_000, tokens: 120_000 };

describe("resolveStepBudgets — per-step rung order (per-step ?? uniform ?? default)", () => {
  test("no overrides ⇒ each step takes its own play default (back-compat / cold start)", () => {
    const r = resolveStepBudgets({}, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(PROPOSE_DEFAULT);
    expect(r.decomposeBudget).toEqual(DECOMPOSE_DEFAULT);
  });

  test("uniform `budget` only ⇒ BOTH steps take it (existing --budget behavior)", () => {
    const uniform: Budget = { timeMs: 3_600_000, tokens: 200_000 };
    const r = resolveStepBudgets({ budget: uniform }, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(uniform);
    expect(r.decomposeBudget).toEqual(uniform);
  });

  test("per-step on one step only ⇒ that step takes per-step, the other falls to its default", () => {
    const proposeOnly: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const r = resolveStepBudgets({ proposeBudget: proposeOnly }, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(proposeOnly); // per-step wins
    expect(r.decomposeBudget).toEqual(DECOMPOSE_DEFAULT); // independent: unset ⇒ default
  });

  test("per-step overrides the uniform `budget` where present; uniform fills the unset step", () => {
    const uniform: Budget = { timeMs: 3_600_000, tokens: 200_000 };
    const proposeOver: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const r = resolveStepBudgets(
      { budget: uniform, proposeBudget: proposeOver },
      PROPOSE_DEFAULT,
      DECOMPOSE_DEFAULT,
    );
    expect(r.proposeBudget).toEqual(proposeOver); // per-step beats uniform
    expect(r.decomposeBudget).toEqual(uniform); // unset per-step ⇒ uniform, not default
  });

  test("both per-step set ⇒ each takes its own, defaults untouched (the `vend work` 227k/227k case)", () => {
    const proposeEnv: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const decomposeEnv: Budget = { timeMs: 7_300_000, tokens: 227_000 };
    const r = resolveStepBudgets(
      { proposeBudget: proposeEnv, decomposeBudget: decomposeEnv },
      PROPOSE_DEFAULT,
      DECOMPOSE_DEFAULT,
    );
    expect(r.proposeBudget).toEqual(proposeEnv);
    expect(r.decomposeBudget).toEqual(decomposeEnv);
    // both denominations carried, not just tokens
    expect(r.proposeBudget.timeMs).toBe(1_900_000);
    expect(r.decomposeBudget.timeMs).toBe(7_300_000);
  });
});
