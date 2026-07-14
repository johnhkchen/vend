# T-025-01 — Structure: file-level blueprint

*Phase: Structure. The shape of the code — files, interfaces, ordering. Not the code.*

## Files touched

| File | Action | Why |
|------|--------|-----|
| `src/play/chain-propose-decompose-core.ts` | **create** | Pure, addon-free home for `resolveStepBudgets` so it is unit-testable (D3). |
| `src/play/chain-propose-decompose-core.test.ts` | **create** | Real coverage of the per-step selection (AC#3). |
| `src/play/chain-propose-decompose.ts` | **modify** | Add per-step option fields; resolve via the core helper. |
| `src/play/work.ts` | **modify** | Keep the two recalibrated envelopes; pass them as per-step budgets (AC#2). |

No deletions. No change to `spend.ts`, `budget.ts`, `recalibrate.ts`, or the play defaults.

---

## 1. `src/play/chain-propose-decompose-core.ts` (new — pure)

**Imports:** `import type { Budget } from "../budget/budget.ts";` only. No addon, no value imports.

**Public interface:**

```ts
/** The per-step budget overrides a caller may supply (subset of the chain's options). */
export interface StepBudgetOverrides {
  /** Override applied to BOTH steps when a per-step override is absent. */
  readonly budget?: Budget;
  /** Highest-priority override for the propose step. */
  readonly proposeBudget?: Budget;
  /** Highest-priority override for the decompose step. */
  readonly decomposeBudget?: Budget;
}

/** The two resolved per-step budgets the chain casts under. */
export interface ResolvedStepBudgets {
  readonly proposeBudget: Budget;
  readonly decomposeBudget: Budget;
}

/**
 * Resolve each step's cast budget. PURE. Rung order per step (D2):
 *   per-step override ?? uniform `budget` ?? the play's static default.
 * Additive over the prior `budget ?? default` behavior — bare casts (no overrides) are unchanged.
 */
export function resolveStepBudgets(
  overrides: StepBudgetOverrides,
  proposeDefault: Budget,
  decomposeDefault: Budget,
): ResolvedStepBudgets;
```

**Body shape:**

```ts
return {
  proposeBudget:   overrides.proposeBudget   ?? overrides.budget ?? proposeDefault,
  decomposeBudget: overrides.decomposeBudget ?? overrides.budget ?? decomposeDefault,
};
```

Module header documents: pure core of the chain's budget selection, addon-free, the `work-core.ts`
precedent.

## 2. `src/play/chain-propose-decompose.ts` (modify)

**Imports:** add `import { resolveStepBudgets } from "./chain-propose-decompose-core.ts";`

**`ChainProposeDecomposeOptions`** — add two optional fields after `budget` (lines ~36–37):

```ts
/** Optional budget override applied to BOTH steps; omitted ⇒ per-step / play default. */
readonly budget?: Budget;
/** Per-step override for the propose step; wins over `budget`; omitted ⇒ `budget` ⇒ play default. */
readonly proposeBudget?: Budget;
/** Per-step override for the decompose step; wins over `budget`; omitted ⇒ `budget` ⇒ play default. */
readonly decomposeBudget?: Budget;
```

(Update the `budget` doc-comment to note it is now the *middle* fallback rung.)

**`castProposeDecomposeChain`** — replace lines 72–73:

```ts
// before
const proposeBudget = opts.budget ?? proposeEpicPlay.budget;
const decomposeBudget = opts.budget ?? decomposeEpicPlay.budget;
// after
const { proposeBudget, decomposeBudget } = resolveStepBudgets(
  opts, proposeEpicPlay.budget, decomposeEpicPlay.budget,
);
```

Everything downstream (lines 75–108) is **unchanged** — `proposeBudget` / `decomposeBudget` keep the
same names and continue to feed each `PlayStep.budget`, the `adapt` budget, and
`assembleProposeEpicInputs`. The header's note ("`epicSubjectFromPath` is its one pure helper") is
refined to acknowledge the core helper.

## 3. `src/play/chain-propose-decompose-core.test.ts` (new)

Addon-free (imports only the pure core + `Budget` type). Cases:

1. **No overrides** → both steps take their respective play defaults (back-compat / cold start).
2. **Uniform `budget` only** → both steps take the uniform budget.
3. **Per-step only** (`proposeBudget` set, `decomposeBudget` unset, no uniform) → propose takes
   per-step, decompose takes its default (proves *independent* per-step + asymmetric fallback).
4. **Per-step overrides uniform** → per-step wins where present; uniform fills the unset step.
5. **Both per-step set** → each takes its own; defaults untouched (the `vend work` 227k/227k case).

Each asserts both denominations (`timeMs`, `tokens`) to prove the whole `Budget` flows, not just
tokens (D6).

## 4. `src/play/work.ts` (modify)

**Lines 118–123** — name and keep the two envelopes instead of discarding them:

```ts
const { records } = await loadRunLog();
const prior = budgetForTier(PRICE_TIER);
const proposeEnvelope   = recalibrate(proposeEpicPlay.name,   records, PRICE_TIER, prior).envelope;
const decomposeEnvelope = recalibrate(decomposeEpicPlay.name, records, PRICE_TIER, prior).envelope;
const price = sumBudgets(proposeEnvelope, decomposeEnvelope);   // unchanged: gates canAfford
```

**Line 129** — thread the two envelopes into the cast:

```ts
castOne: (signal) => castProposeDecomposeChain({
  signal,
  projectRoot: root,
  proposeBudget: proposeEnvelope,
  decomposeBudget: decomposeEnvelope,
  ...(opts.model ? { model: opts.model } : {}),
}),
```

`sumBudgets`, `priceOf: () => price`, the predict-once structure, and `WorkResult` are all unchanged.
The header's purity stance is unaffected (still IMPURE, still value-imports the chain).

---

## Ordering of changes (drives the Plan)

1. Core module + its test (pure, independently green — no addon).
2. Wire the core into `chain-propose-decompose.ts` (options + resolve call).
3. Thread the envelopes in `work.ts`.
4. Full `bun run check:*` gate; then the human live re-sweep (AC#4).

## Interface/back-compat invariants

- `ChainProposeDecomposeOptions` gains only **optional** fields → every existing caller compiles
  unchanged.
- With no overrides, `resolveStepBudgets` returns exactly `{ budget ?? default }` per step → bare
  `vend chain` / `vend run` casting is byte-for-byte unchanged (AC#1).
- `work.ts`'s public `castWork` / `WorkResult` signatures are untouched → `cli.ts` and `work-core`
  unaffected.
