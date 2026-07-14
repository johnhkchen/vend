# T-011-01 Structure — chain-primitive-and-output-threading

The blueprint: file-level changes, interfaces, boundaries, ordering. Not code — the shape of it.

## Files

| Action | File | Why |
|--------|------|-----|
| **create** | `src/engine/chain-core.ts` | PURE threading + halt core: `ChainStep`, `ThreadDecision`, `decideThread`, `ChainResult`, `runChain`. Type-only imports. |
| **create** | `src/engine/chain-core.test.ts` | The AC#3 pure proof: two-step threading; step-1 STOP → step-2 never runs; the decideThread branches; empty/single chains. Imports ONLY `./chain-core.ts`. |
| **create** | `src/engine/chain.ts` | IMPURE shell: `PlayStep<I,O>`, `castChain`. Imports `castPlay`; re-exports the core. |
| **modify** | `src/engine/play.ts` | Add `produced?: string` to `EffectResult`. |
| **modify** | `src/engine/cast.ts` | Add `produced?: string` to `RunSummary`; lift `eff.produced` into the return. |
| **modify** | `src/play/propose-effect.ts` | `proposeEpicEffect` sets `produced: path` (the minted epic path) on success. |
| **modify** | `src/play/note-core.ts` | `captureNoteEffect` sets `produced: path` (consistency; cheap, threadable). |
| **modify** | `src/play/propose-effect.test.ts` | Assert the effect surfaces `produced` = the minted path. |

No deletions. Every source change is additive/optional → existing casts unaffected (AC#4).

## Interfaces

### `src/engine/play.ts` — `EffectResult` (extend)

```ts
export interface EffectResult {
  readonly ok: boolean;
  readonly outcome?: RunOutcome;
  readonly detail?: string;
  readonly artifacts?: readonly string[];
  /** The single canonical reference a downstream play threads on (chain primitive,
   *  T-011-01) — e.g. ProposeEpic's minted epic path. DISTINCT from `artifacts` (all files
   *  written, for provenance): `produced` is the ONE handle the next play consumes. Optional
   *  + backward-compatible; an effect that surfaces nothing threadable omits it. */
  readonly produced?: string;
}
```

### `src/engine/cast.ts` — `RunSummary` (extend) + threading

```ts
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly materialized: boolean;
  /** The artifact reference this cast produced (EffectResult.produced), surfaced so a chain
   *  (T-011-01) can thread it into the next play. Present only on a materialized cast whose
   *  effect set it; undefined otherwise (a STOP, or an effect that produced nothing). */
  readonly produced?: string;
}
```

Threading site — inside the existing `if (verdict.materialize && output !== null)` branch:

```ts
let produced: string | undefined;
...
  const eff = await play.effect(output, ctx);
  materialized = eff.ok;
  produced = eff.ok ? eff.produced : undefined;   // NEW
  if (eff.outcome) outcome = eff.outcome;
...
return { runId, outcome, materialized, produced };   // produced added
```

### `src/engine/chain-core.ts` (new, PURE)

```ts
import type { RunSummary } from "./cast.ts";          // TYPE-ONLY → erased
import type { RunOutcome } from "../log/run-log.ts";  // TYPE-ONLY → erased

export interface ChainStep {
  /** Cast this step. Receives the upstream `produced` (undefined for the first step). */
  readonly cast: (upstream: string | undefined) => Promise<RunSummary>;
}

export interface ThreadDecision {
  readonly proceed: boolean;
  readonly reason?: string;   // the andon when it does not proceed
}

/** Proceed to the next step iff this step succeeded AND surfaced a `produced` reference. */
export function decideThread(summary: RunSummary): ThreadDecision;

export interface ChainResult {
  readonly steps: readonly RunSummary[];   // one per CAST step (each = one run-log record)
  readonly outcome: RunOutcome;            // the last cast step's outcome
  readonly halted: boolean;                // a non-success step skipped downstream casts
  readonly produced?: string;              // the final cast step's produced (chain net output)
  readonly haltReason?: string;            // why it halted, when it did
}

/** PURE given injected `cast` thunks: run steps in sequence, thread produced → next, halt on
 *  the first non-success (or success-without-produced). Empty chain → success no-op. */
export async function runChain(steps: readonly ChainStep[]): Promise<ChainResult>;
```

### `src/engine/chain.ts` (new, IMPURE shell)

```ts
import type { Budget } from "../budget/budget.ts";
import { castPlay, type CastOptions } from "./cast.ts";
import type { Play } from "./play.ts";
import { runChain, type ChainResult, type ChainStep } from "./chain-core.ts";
export * from "./chain-core.ts";

export interface PlayStep<I, O> {
  readonly play: Play<I, O>;
  readonly budget: Budget;
  readonly opts: CastOptions;
  /** Build this step's typed inputs from the upstream `produced` (undefined for step 1). */
  readonly adapt: (upstream: string | undefined) => I | Promise<I>;
}

/** Cast a sequence of plays, threading produced → the next step's `adapt`; halts on any
 *  non-success; one run-log record per cast step (castPlay logs each). The IMPURE shell. */
export async function castChain(steps: readonly PlayStep<any, any>[]): Promise<ChainResult>;
```

## Control flow — `runChain`

```
summaries = []
upstream  = undefined
for i in 0 .. steps.length-1:
    summary = await steps[i].cast(upstream)   // first step: upstream undefined
    summaries.push(summary)
    if i is last index: break                 // nothing downstream to thread/halt
    decision = decideThread(summary)
    if not decision.proceed:
        return { steps: summaries, outcome: summary.outcome, halted: true,
                 produced: summary.produced, haltReason: decision.reason }
    upstream = summary.produced                // thread
last = summaries[last]
if last is undefined: return { steps: [], outcome: "success", halted: false }   // empty chain
return { steps: summaries, outcome: last.outcome, halted: false, produced: last.produced }
```

## Control flow — `castChain` (builds thunks, delegates to runChain)

```
chainSteps = steps.map(s => ({
    cast: async (upstream) => {
        inputs = await s.adapt(upstream)       // may be async (assembleInputs reads fs)
        return castPlay(s.play, inputs, s.budget, s.opts)
    }
}))
return runChain(chainSteps)
```

## Boundaries & invariants

- **Acyclic:** `chain.ts` imports only the engine (`cast.ts`, `play.ts`, `chain-core.ts`) +
  `budget` types — NEVER `src/play/`. Concrete steps are assembled by the caller (T-011-02).
- **Purity:** `chain-core.ts` has only `import type` lines → no runtime edge to cast.ts's seam.
  `chain-core.test.ts` imports only `./chain-core.ts` → spawns nothing, loads no addon.
- **One record per step:** satisfied structurally — `castChain` calls `castPlay` once per step,
  and `castPlay` already appends exactly one run-log record per call.
- **Additive only:** `produced?` optional on both `EffectResult` and `RunSummary`; no existing
  call site changes behavior.

## Ordering of changes

1. `play.ts` (`EffectResult.produced`) — the leaf the effects + cast depend on.
2. `cast.ts` (`RunSummary.produced` + threading) — depends on (1).
3. `propose-effect.ts` / `note-core.ts` (set `produced`) — depend on (1).
4. `chain-core.ts` (pure core) — depends on (2)'s `RunSummary` type.
5. `chain.ts` (shell) — depends on (4) + `castPlay`.
6. Tests: `chain-core.test.ts` (4); `propose-effect.test.ts` assertion (3).
