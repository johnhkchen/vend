# T-007-02 — Structure: generic-cast-loop

The blueprint — files, exports, boundaries, and the import graph. Not code; the shape of
the code. Two new files in `src/engine/`, zero modifications (R4: the play/CLI re-wire is
T-007-03). Mirrors the proven decompose split: a PURE core + one IMPURE verb.

## Files

| File | Status | Role |
|------|--------|------|
| `src/engine/cast-core.ts` | **created** | PURE decision core — `classify`, `castGateRows`, stream/model helpers. Addon-free. Tested. |
| `src/engine/cast-core.test.ts` | **created** | The pure-function test for cast-core. No BAML, no spawn. |
| `src/engine/cast.ts` | **created** | The IMPURE orchestrator `castPlay` + `CastOptions`/`RunSummary`. The single untested verb. |

No modifications. `decompose-epic.ts`, `decompose-epic-core.ts`, `play.ts`, `cli.ts`,
`shelf/press.ts` are untouched — they are wired onto `castPlay` in T-007-03.

## `src/engine/cast-core.ts` — the pure core (public surface)

```ts
import type { StreamMessage } from "../executor/claude.ts";
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateVerdict } from "./play.ts";
import type { GateResult as LogGate, RunOutcome } from "../log/run-log.ts";

export const DEFAULT_MODEL = "claude-cli-default";
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string;

export interface ClassifyInput {
  readonly timedOut: boolean;
  readonly budgetOutcome: BudgetOutcome | null;
  readonly gateVerdict: GateVerdict | null;
}
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
}
export function castGateRows(g: GateVerdict | null): readonly LogGate[];
export function classify(i: ClassifyInput): Verdict;

export function formatMessage(msg: StreamMessage): string;
export function makeStreamSink(opts: {
  write: (line: string) => void;
  sink: (raw: string) => void;
}): (msg: StreamMessage) => void;
```

**Purity contract:** every import is `import type` (erased under `verbatimModuleSyntax`);
no fs, clock, network, process, gates.ts, or BAML. `LogGate` aliases run-log's per-gate
`GateResult` (distinct from gates.ts's whole-plan one — same alias trick
decompose-epic-core uses). This module is byte-for-byte addon-free, so cast-core.test.ts
never loads the native addon (the gates.test.ts / decompose-epic.test.ts discipline).

**Internal logic (mirrors decompose-epic-core, generalized):**
- `classify` — first-match priority: timeout → budget-exhausted → gate-stop → success;
  `materialize` true only on `success`; `gateLog = castGateRows(i.gateVerdict)`.
- `castGateRows` — `null → []`; `stop → [{gate, passed:false, detail:"${unit}: ${reason}"}]`;
  `clear → []` (the interface exposes no per-gate names — Design D3).
- `formatMessage`/`makeStreamSink`/`resolveLoggedModel` — re-implemented identical to
  decompose-epic-core (Design D1/D4); total, never throw on odd input.

## `src/engine/cast.ts` — the impure orchestrator (public surface)

```ts
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ClaudeTimeoutError, dispense, type ResultMessage } from "../executor/claude.ts";
import { check, timeoutMsFor, type Budget, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import { appendRunLog, type RunOutcome } from "../log/run-log.ts";
import type { CastContext, GateVerdict, Play } from "./play.ts";
import { classify, makeStreamSink, resolveLoggedModel } from "./cast-core.ts";

export interface CastOptions {
  readonly subject: string;          // → run-log `epic`
  readonly projectRoot?: string;
  readonly model?: string;
  readonly runId?: string;
  readonly transcriptDir?: string;
  readonly runLogPath?: string;
}
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly materialized: boolean;
}
export async function castPlay<I, O>(
  play: Play<I, O>, inputs: I, budget: Budget, opts: CastOptions,
): Promise<RunSummary>;
```

**Note the imports:** the seam, budget, run log, the `Play` interface, the engine's own
pure core. **No** `src/play/`, **no** gates.ts, **no** BAML — this is what makes the loop
play-agnostic (AC#2) and keeps the graph acyclic (Research layering constraint).

**`castPlay` internal sequence (the fixed orchestration):**

1. `root = opts.projectRoot ?? process.cwd()`; `startedAt = new Date().toISOString()`;
   `runId = opts.runId ?? \`run-${…}\``.
2. `prompt = play.render(inputs)`.
3. `transcriptPath` under `opts.transcriptDir ?? <root>/.vend/transcripts`; `mkdir -p`;
   `onMessage = makeStreamSink({write: stdout, sink: appendFile})`.
4. `try { result = await dispense({prompt, model: opts.model, onMessage,
   timeoutMs: timeoutMsFor(budget)}) } catch (e) { if ClaudeTimeoutError → timedOut else throw }`.
5. `ctx: CastContext<I> = {inputs, projectRoot: root}`.
6. if `!timedOut && result`: `budgetOutcome = check(budget, result.usage)`; if
   `status==="ok"`: `output = play.parse(result.result ?? "")`; `gateVerdict = play.gates(output, ctx)`.
7. `verdict = classify({timedOut, budgetOutcome, gateVerdict})`.
8. `outcome = verdict.outcome`; `materialized = false`. if `verdict.materialize && output !== null`:
   `eff = await play.effect(output, ctx)`; `materialized = eff.ok`; `if (eff.outcome) outcome = eff.outcome`;
   stdout `· effect ✓/✗`. else if `verdict.outcome !== "success"`: stdout `· andon: …`.
9. `loggedModel = resolveLoggedModel(result?.model, opts.model)`.
10. ONE `appendRunLog({runId, play: play.name, epic: opts.subject, model, outcome, usage,
    costUsd, gateResults: verdict.gateLog, startedAt, endedAt}, opts.runLogPath ? {path} : {})`.
11. `return {runId, outcome, materialized}`.

**Private helper (pure, kept in cast.ts like the runner's `stopReason`):**
`stopReason(gate: GateVerdict | null, budget: BudgetOutcome | null): string` — the andon
suffix naming the gate/budget reason. Cosmetic stdout only; untested (part of the verb).

## Module boundaries & invariants

- **Acyclic:** `cast.ts → {executor, budget, run-log, engine/play, engine/cast-core}`;
  `cast-core.ts → type-only {executor, budget, engine/play, run-log}`. Neither reaches
  into `src/play/`. T-007-03's `play → engine` edge closes no cycle.
- **One record per cast:** a single `appendRunLog` call at step 10, reached on every
  terminal path (timeout, exhausted, gate-stop, collision, success). The early paths set
  `result = null`/`budgetOutcome = null` but still fall through to the one log call.
- **Pure/impure:** all judgment (classify, gate-row translation, formatting, model
  resolution) is in cast-core (tested); cast.ts only spawns, writes fs, and calls the
  interface members (untested verb).
- **Type-safe wiring:** `castPlay<I, O>` threads `I` into `render`/`ctx` and `O` out of
  `parse` into `gates`/`effect`; the registry's type-erased `AnyPlay` is re-narrowed by
  the caller (T-007-03) before calling `castPlay`.

## Test plan (cast-core.test.ts)

| Group | Cases |
|-------|-------|
| `classify` | timeout outranks all; budget-exhausted beats a CLEAR (P7); in-budget STOP → gate-failed (+ gateLog row); CLEAR in budget → success + materialize. |
| `castGateRows` | STOP → one failed row (gate/unit/reason); CLEAR → `[]`; `null` → `[]`. |
| `formatMessage` | known + unknown types; never throws on `{}`. |
| `makeStreamSink` | fans each message to both surfaces, once each, in order. |
| `resolveLoggedModel` | real → pinned → sentinel. |

No `castPlay` test (impure verb; live in T-007-03). `tsc` proves the play-agnostic
compile (no `src/play/`/BAML import).

## Ordering of changes (for Plan)

cast-core.ts (+ its test) first — it is self-contained and provable in isolation. Then
cast.ts, which depends on cast-core. Typecheck + test after each.
