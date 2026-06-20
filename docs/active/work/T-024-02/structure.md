# T-024-02 Structure — autonomous-spend-loop

The shape of the code: files, public interfaces, internal organization, ordering. Not the
code itself.

## Files

| File | Action | Why |
|------|--------|-----|
| `src/engine/cast.ts` | **modify** | Add the `CastActuals` type + `actuals?` to `RunSummary`; populate it in `castPlay` (lift `endedAt`, derive `wallMs`). |
| `src/engine/spend-core.ts` | **create** | Pure decision core: `fitNext`, `shouldContinue`, the pure data types. |
| `src/engine/spend-core.test.ts` | **create** | Unit gate for the decision core (every branch). |
| `src/engine/spend.ts` | **create** | Impure loop `spendDown` + `sumActuals`; re-exports the core. NOT unit-tested. |

No other files change. `src/budget/wallet.ts` is consumed unchanged. T-024-03 will import
`spend.ts` and inject the real `castChain`/`recalibrate` — not in this ticket's scope.

## `src/engine/cast.ts` — the actuals seam

### New exported type (near `RunSummary`)
```ts
export interface CastActuals {
  readonly usage: Usage;   // tokens the cast burned (the seam's terminal result.usage)
  readonly wallMs: number; // wall-clock ms the cast took (endedAt − startedAt)
}
```
`Usage` is already imported from `../budget/budget.ts`.

### `RunSummary` — one additive optional field
```ts
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly materialized: boolean;
  readonly produced?: string;
  readonly actuals?: CastActuals;   // ← NEW: the measured cost the wallet debits by (T-024-02)
}
```
Optional only for back-compat of hand-built fakes (`chain-core.test.ts`) + the documented
log-read fallback; `castPlay` always populates it.

### `castPlay` — populate actuals (two small edits, no behavior change)
1. Lift `endedAt` out of the inline `appendRunLog` call into a `const endedAt = new
   Date().toISOString();` just above the append; pass `endedAt` into the record (byte-identical
   log line).
2. After the append, derive and return actuals:
   ```ts
   const wallMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
   const usage = (result?.usage ?? {}) as Usage;   // same value already metered by check()
   return { runId, outcome, materialized, produced, actuals: { usage, wallMs } };
   ```
   `usage` is the seam's `result.usage` (`{}` on a timed-out run, so 0 tokens — honest); `wallMs`
   is non-negative by construction. No new imports.

## `src/engine/spend-core.ts` — pure decision core

Ordering top→bottom (house pattern: header → types → exported functions). All imports
type-only except the pure `canAfford`.

### Imports
```ts
import { canAfford, type Wallet } from "../budget/wallet.ts"; // canAfford is pure
import type { Budget } from "../budget/budget.ts";
import type { RunOutcome } from "../log/run-log.ts";
```
No fs/clock/network/process/seam/play. Engine→budget and engine→log are existing legal edges.

### Types (exported)
```ts
/** Why a spend session ended (the clean-stop vocabulary, IA-9). */
export type StopReason = "board-cleared" | "wallet-exhausted" | "andon";

/** The decision shouldContinue returns: keep spending, or stop with a reason + readout. */
export type Continuation =
  | { readonly action: "continue" }
  | { readonly action: "stop"; readonly reason: StopReason; readonly detail: string };

/** The distilled board state shouldContinue judges (no candidate type leaks in). */
export interface BoardState {
  readonly remaining: number; // candidates left unpulled (0 ⇒ cleared)
  readonly fits: boolean;     // did fitNext find an affordable next? (next !== null)
}

/** One cleared (or andon'd) cast in the session — the per-step record + IA-7 signal. */
export interface SpendStep {
  readonly candidate: string;       // labelOf(next) — which pull ran
  readonly outcome: RunOutcome;     // the cast's terminal outcome
  readonly cost: Budget;            // actuals debited (both denominations)
  readonly overshoot: Budget;       // IA-8 detect-after overrun (0 when it fit)
  readonly remainingAfter: Budget;  // wallet remaining after this step
}

/** The structured session result for the Settle summary (ticket AC). */
export interface SessionResult {
  readonly steps: readonly SpendStep[]; // per-cast, execution order (the production line)
  readonly stop: StopReason;            // why it ended
  readonly stopDetail: string;          // human readout (remaining at stop, etc.)
  readonly remaining: Budget;           // wallet left at stop
  readonly cleared: number;             // count of `success` casts
}

/** Per-step production-line signal (IA-7); T-024-03 renders it. */
export interface StepSignal {
  readonly phase: "start" | "done";
  readonly candidate: string;
  readonly remaining: Budget; // wallet remaining at the moment of the signal
}
```

### Exported functions
```ts
export function fitNext<C>(
  wallet: Wallet,
  candidates: readonly C[],
  priceOf: (c: C) => Budget,
): C | null
```
Walk `candidates` in order; return the first whose `priceOf` `canAfford`s `wallet`; else
`null`. Generic over `C` (never inspects it). Pure, total. No re-ranking.

```ts
export function shouldContinue(
  wallet: Wallet,
  board: BoardState,
  lastOutcome: RunOutcome | null,
): Continuation
```
Precedence: andon (`lastOutcome !== null && lastOutcome !== "success"`) → `board.remaining === 0`
→ `!board.fits` → continue. `detail` strings name the remaining wallet (via `remaining`'s shape).
Pure, total.

## `src/engine/spend.ts` — impure loop

### Imports
```ts
import { canAfford, debit, remaining, type Wallet } from "../budget/wallet.ts";
import { countTokens, type Budget } from "../budget/budget.ts";
import type { ChainResult } from "./chain.ts";              // type-only (no spawn pulled in)
import { fitNext, shouldContinue, type SessionResult, type SpendStep, type StepSignal } from "./spend-core.ts";
export * from "./spend-core.ts";                            // one engine entry for the surface
```
`ChainResult` is type-only, so importing it does not pull the executor seam into a caller's
graph (the chain-core.ts discipline). `loadRunLog`/`wallClockMs`/`totalTokens` from
`../log/run-log.ts` are imported lazily ONLY inside the fallback path.

### Params + verb
```ts
export interface SpendLoopParams<C> {
  readonly wallet: Wallet;
  readonly candidates: readonly C[];           // PRE-RANKED (IA-1); the loop never re-sorts
  readonly priceOf: (c: C) => Budget;          // E-013 predicted envelope (injected)
  readonly castOne: (c: C) => Promise<ChainResult>; // the castChain pull→clear (injected)
  readonly labelOf: (c: C) => string;          // production-line label / session record
  readonly onStep?: (s: StepSignal) => void;   // IA-7 emit (optional)
}

export async function spendDown<C>(params: SpendLoopParams<C>): Promise<SessionResult>
```
Drives the D5 loop. IMPURE (awaits `castOne`); its decision logic is the tested core, its
debit is the tested wallet. NOT unit-tested — proven live in T-024-03.

### Private helper
```ts
async function sumActuals(result: ChainResult): Promise<Budget>
```
Sum each step's `actuals` into one `{ tokens, timeMs }`: tokens via `countTokens(step.actuals.usage)`,
timeMs via `step.actuals.wallMs`. For any step missing `actuals`, fall back to a lazy
`loadRunLog()` + find-by-`runId` (`totalTokens` + `wallClockMs`); if even that misses, contribute
0 (and the loop's debit simply doesn't move that denomination — honest, never a phantom charge).

## Internal organization & invariants
- **Engine ⊥ play preserved:** no `src/play/` import anywhere; the real chain is injected.
- **No re-ranking:** `fitNext` consumes the caller's order verbatim (IA-1).
- **P7:** the only authorized cast is a `fitNext` result (affordable on predicted price).
- **IA-8 separation:** tokens and `wallMs` carried separately through the seam, summed
  independently in `sumActuals`, debited per denomination by `debit`.
- **Immutability:** `wallet` is rebound to each `debit().wallet`; the input candidates array is
  never mutated (board filtered into a fresh array each iteration).

## `src/engine/spend-core.test.ts` — test map
`import { describe, expect, test } from "bun:test";` Fixtures: `const w = (timeMs, tokens):
Wallet => allocate({ timeMs, tokens })` (or a literal), `const price = (b) => () => b`.
- **`fitNext`**: affordable head returned; over-budget head SKIPPED to an affordable tail;
  all-unaffordable → null; empty candidates → null; exact-fit boundary affords; honest
  per-denomination (fits-on-tokens-not-time candidate skipped).
- **`shouldContinue`**: andon stop (each non-success `lastOutcome`) with reason `"andon"`;
  `remaining: 0` → `"board-cleared"`; `fits: false` (remaining > 0) → `"wallet-exhausted"`;
  precedence (andon beats cleared beats exhausted); continue case (`fits`, remaining > 0,
  lastOutcome `null`/`success`).

## Ordering of changes (commit-sized units)
1. `cast.ts` actuals seam (type + populate) — independently typecheckable; full suite still green.
2. `spend-core.ts` (types + `fitNext` + `shouldContinue`) + `spend-core.test.ts` — the unit gate.
3. `spend.ts` (`spendDown` + `sumActuals`) — typechecks against the core + injected thunks.
4. `bun run check` green.
