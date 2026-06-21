# T-052-01 — Structure

_The file-level blueprint. Three files touched: one pure core (new function), one impure shell (new
option + wire), one test (new assertions). No files created or deleted._

## Files changed

### 1. `src/play/graph-real-play-core.ts` — ADD pure `realPlayMacro`

- **Add a type-only import** of `Budget`:
  ```ts
  import type { Budget } from "../budget/budget.ts";
  ```
  (Joins the existing `import type { DagEdge }` — both erased, purity preserved.)
- **Add an exported pure function** in a new `── The shared-wallet envelope ──` section, placed after
  the run-log subjects block (end of file). Signature + contract:
  ```ts
  /**
   * Size the ONE shared macro-wallet envelope the real-play diamond draws from (E-052). PURE/TOTAL.
   * Per-denomination by the wave schedule (survey → propose∥propose → note), the IA-8 concurrency
   * divergence (authorizeWave/debitWave): tokens SUM (both proposes burn real tokens), wall-clock is
   * the MAX-per-wave SUM (the two proposes OVERLAP, so their wave costs ~one propose's time). Funding
   * this guarantees every wave authorizes — the join runs — while a per-node-sized envelope would
   * budget-stop the second propose (the cross-branch leak E-052 closes).
   */
  export function realPlayMacro(survey: Budget, propose: Budget, note: Budget): Budget {
    return {
      tokens: survey.tokens + 2 * propose.tokens + note.tokens,
      timeMs: survey.timeMs + propose.timeMs + note.timeMs,
    };
  }
  ```
- **Boundary:** pure, total, no fs/clock/addon — same contract as every other export here. Exported so
  both the shell (`castRealPlayGraph`) and the test bind the SAME sizing (the shared-constant stance
  the node ids/edges already follow).

### 2. `src/play/graph-real-play.ts` — ADD `macroBudget` option + WIRE the wallet

- **Imports:** add `allocate` (value import — pure, addon-free, so it does NOT change the module's
  impurity profile; the module is already impure via the plays/`castGraph`):
  ```ts
  import { allocate } from "../budget/wallet.ts";
  ```
  Add `realPlayMacro` to the existing `./graph-real-play-core.ts` import group.
  `Budget` is already imported as a type (line 31).
- **`GraphRealPlayOptions`** (after `noteBudget`, line 63): add
  ```ts
  /** Override the ONE shared macro-wallet envelope the whole diamond draws from (E-052). Omitted ⇒
   *  realPlayMacro(survey, propose, note) — sized to cover survey + 2 proposes + note (not per-node). */
  readonly macroBudget?: Budget;
  ```
- **`castRealPlayGraph`** (lines 166–169): replace the body so it allocates ONE wallet and passes it:
  ```ts
  export async function castRealPlayGraph(opts: GraphRealPlayOptions = {}): Promise<GraphResult> {
    const { nodes, edges } = buildRealPlayGraph(opts);
    const macro = opts.macroBudget ?? realPlayMacro(
      opts.surveyBudget ?? surveyPlay.budget,
      opts.proposeBudget ?? proposeEpicPlay.budget,
      opts.noteBudget ?? captureNotePlay.budget,
    );
    return castGraph(nodes, edges, allocate(macro));
  }
  ```
- **Docstring update:** the `castRealPlayGraph` JSDoc (lines 159–165) and/or the module header's
  shared-wallet note should mention it now threads ONE shared wallet (E-052), so the prose matches the
  code. The `import.meta.main` live entry (lines 174–188) is UNCHANGED — it calls
  `castRealPlayGraph({projectRoot})`, which now funds the default envelope automatically.
- **Boundary:** still impure, still not unit-tested. The change is purely additive wiring.

### 3. `src/play/graph-real-play-core.test.ts` — ADD the sizing + coverage proof

- **Imports:** add to the existing import set:
  ```ts
  import { runGraphConcurrent } from "../engine/graph-core.ts";
  import { allocate } from "../budget/wallet.ts";
  import type { Budget } from "../budget/budget.ts";
  import type { DagNode, DagSpec, NodeId } from "../engine/dag-core.ts"; // DagSpec/NodeUpstreams present; add DagNode
  // and realPlayMacro from "./graph-real-play-core.ts"
  ```
  (`runGraph`, `DagSpec`, `NodeId`, `NodeUpstreams` already imported; `RunSummary`/`RunOutcome` too.)
- **Add a local `costedStub`** helper (mirroring graph-example.ts:95–106) — a canned success carrying
  `actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs }` so `debitWave` folds a
  real delta. Plus the four real-play node prices as a `Record<NodeId, Budget>`.
- **Add `describe("realPlayMacro: ONE envelope sized to cover the whole diamond (E-052, AC)")`** with
  three tests:
  1. `realPlayMacro` arithmetic pin → `{ tokens: 608_000, timeMs: 4_200_000 }`.
  2. the real diamond under `allocate(realPlayMacro(...))` → all four nodes cast, `skipped` empty,
     not halted, `walletRemaining` ≥ 0 on both denominations.
  3. a one-propose-sized wallet → propose-2 budget-stopped, join cascade-skips (the not-per-node
     contrast).
- **Boundary:** imports ONLY pure modules (core + `runGraphConcurrent` + `allocate` + budget types) —
  never `graph-real-play.ts`, never `graph.ts`. No addon, no spawn, no live model. Honors the test
  header's discipline (lines 21–28).

## Ordering of changes

1. **Core first** — add `realPlayMacro` + its `Budget` import. Self-contained, compiles alone.
2. **Test second** — add assertions against the new pure function + the pure dispatcher. Green proves
   the sizing before any shell wiring.
3. **Shell third** — add the option + wire `castGraph(nodes, edges, allocate(macro))`. Typecheck +
   full `bun test` confirm nothing regressed.

This order lets the pure proof land green before the impure wire, exactly as the per-node-budget and
shared-wallet work sequenced (core/test before shell).

## Public interface delta

| symbol | file | change |
|--------|------|--------|
| `realPlayMacro(survey, propose, note): Budget` | graph-real-play-core.ts | NEW export |
| `GraphRealPlayOptions.macroBudget?: Budget` | graph-real-play.ts | NEW optional field |
| `castRealPlayGraph` | graph-real-play.ts | body now allocates + passes a `Wallet` (3rd arg) |

No symbol is removed or renamed; every change is additive or internal. Back-compat: callers passing no
`macroBudget` get the computed default envelope — the intended budgeted path, the point of E-052.

## What is explicitly NOT touched

- `src/engine/graph.ts` — `castGraph`'s `wallet?` param already exists (E-048); no change.
- `src/engine/graph-core.ts` / `spend-core.ts` / `wallet.ts` — the dispatcher + algebra are complete;
  consumed as-is.
- The three plays (`survey.ts`/`propose-epic.ts`/`note.ts`) — their budgets are READ, not changed.
- `import.meta.main` live entry — unchanged; T-052-02 owns the live re-cast + verdict.
