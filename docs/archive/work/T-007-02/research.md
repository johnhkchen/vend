# T-007-02 — Research: generic-cast-loop

Map the codebase for extracting the **play-agnostic spine** of `runDecomposeEpic`
into one generic `castPlay`. Descriptive only — what exists, where, how it connects,
and the constraints any extraction must honor.

## The ticket in one line

`runDecomposeEpic` (src/play/decompose-epic.ts) is a hardcoded end-to-end loop welded
to one play. The `Play<I, O>` contract (T-007-01, `src/engine/play.ts`) already names
the six per-play variation points. T-007-02 must pull the *fixed* orchestration out of
the runner into `src/engine/cast.ts` as `castPlay(play, inputs, budget, opts)`, leaving
the play-specific bits behind the interface.

## The welded loop today (`runDecomposeEpic`, decompose-epic.ts:106–208)

The spine, in order — every step except 1, 2-render, 6, 7 is already play-agnostic:

1. `assembleInputs({epicPath, projectRoot})` → `{epic, charter, project}`; `epicIdOf`
   pulls a lisa id (`E-001`) for the log. **PLAY-SPECIFIC** (DecomposeEpic inputs).
2. **render**: `b.request.DecomposeEpic(epic, charter, project)` → `extractPromptText`
   → prompt string. **PLAY-SPECIFIC** (BAML, loads the native addon).
3. **stream sink**: build `transcriptPath` under `.vend/transcripts/<runId>.jsonl`,
   `mkdir -p`, `makeStreamSink({write: stdout, sink: appendFile})`. **GENERIC.**
4. **dispense**: `dispense({prompt, model, onMessage, timeoutMs: timeoutMsFor(budget)})`;
   catch `ClaudeTimeoutError` → `timedOut=true`, else re-throw. **GENERIC** (the seam).
5. **meter**: `check(budget, result.usage)` → `BudgetOutcome`. **GENERIC.**
6. **parse**: `b.parse.DecomposeEpic(result.result)` → `WorkPlan`. **PLAY-SPECIFIC.**
7. **gates**: `clear(plan, {epic, charter})` → `GateResult`. **PLAY-SPECIFIC.**
8. **classify**: `classify({timedOut, budgetOutcome, gateResult})` → `Verdict`
   (`outcome`, `materialize`, `gateLog`). **GENERIC decision** (pure core).
9. **effect**: if `verdict.materialize` → `materialize(plan, {storiesDir, ticketsDir})`
   + `lisaValidate(root)`; an `IdCollisionError` THROW is caught and relabels the
   outcome to `id-collision`. **PLAY-SPECIFIC** (the world-touch).
10. **model**: `resolveLoggedModel(result?.model, opts.model)`. **GENERIC.**
11. **log**: ONE `appendRunLog({runId, play: PLAY, epic: epicId, model, outcome, usage,
    costUsd, gateResults: verdict.gateLog, startedAt, endedAt})`. **GENERIC** sink.

Return `{runId, outcome, materialized}` (`RunSummary`).

## The pure/impure split (the house pattern to mirror)

- **decompose-epic-core.ts** (PURE, tested by decompose-epic.test.ts): `classify`,
  `gateRowsFor`, `formatMessage`, `makeStreamSink`, `resolveLoggedModel`, `DEFAULT_MODEL`.
  Split out for ONE reason — the orchestrator value-imports `b` (the BAML native addon),
  which makes a `bun test` process flaky; the core stays addon-free so its test is an
  ordinary pure-function test.
- **decompose-epic.ts** (IMPURE verb): `runDecomposeEpic`, `lisaValidate` — spawn
  `claude`/`lisa`, touch fs, call BAML in-process. The single UNTESTED functions; their
  logic lives in the pure core, proven live in T-002-04.

Mirror this: `cast.ts` = the impure verb (untested); a new `cast-core.ts` = the pure,
tested decision core.

## The `Play<I, O>` contract (src/engine/play.ts, T-007-01)

The six variation points, already typed:

```ts
interface Play<I, O> {
  name:   string;
  render: (inputs: I) => string;
  parse:  (text: string) => O;
  gates:  (out: O, ctx: CastContext<I>) => GateVerdict;
  effect: (out: O, ctx: CastContext<I>) => Promise<EffectResult>;
  budget: Budget;
  card:   Card;
}
interface CastContext<I> { readonly inputs: I; readonly projectRoot: string; }
type GateVerdict =
  | { readonly status: "clear" }
  | { readonly status: "stop"; readonly gate: string; readonly unit: string; readonly reason: string };
interface EffectResult { readonly ok: boolean; readonly outcome?: RunOutcome;
  readonly detail?: string; readonly artifacts?: readonly string[]; }
```

Registry: `PlayRegistry` (`register`/`get`/`has`/`names`) + a default `registry`
singleton. The cast loop consumes a `Play`; it does **not** dispatch by name (T-007-03).

### Two contract facts that shape the extraction

- **`GateVerdict` is play-generic** (`gate: string`), NOT gates.ts's `GateResult`
  (`gate: GateName`, four decompose-specific names). T-007-01 design D2 chose this so
  the contract is play-agnostic; T-007-01 review concern #1 flags the gates.ts→GateVerdict
  assignability as the one downstream assumption to re-check (it lands in T-007-03).
- **`GateVerdict.clear` is opaque** — `{status:"clear"}`, no list of cleared gate names.
  gates.ts's `GateClear` carries `cleared: GateName[]`; the interface deliberately drops
  it. Consequence: the generic loop cannot emit one passed run-log row per gate the way
  the welded `gateRowsFor` does — see Design.

## The collaborators the loop composes (all pure leaves / one seam)

- **executor/claude.ts** — `dispense` (the one impure seam, spawns `claude -p`),
  `ResultMessage` (carries `usage`, `total_cost_usd`, `result`, harvested `model`),
  `ClaudeTimeoutError` (`code: "ETIMEDOUT_CLAUDE"`), `StreamMessage`. Budget-agnostic:
  takes `timeoutMs` only.
- **budget/budget.ts** — `Budget {timeMs, tokens}`, `timeoutMsFor`, `check` →
  `BudgetOutcome` (`ok | exhausted`), `Usage`. PURE, seam-agnostic.
- **log/run-log.ts** — `appendRunLog(input, opts?)` (the one impure fs verb;
  `opts.path` overrides `DEFAULT_RUN_LOG_PATH`), `RunOutcome` (the 5-member literal
  union), `GateResult {gate, passed, detail?}` (the PER-GATE log row — distinct from
  gates.ts's whole-plan `GateResult`). Asserts non-empty `runId/play/epic/model/…`.
- **gate/gates.ts** — `clear`, `GateResult`, `GateName`, `isStop`. PLAY-SPECIFIC;
  the generic loop must NOT import it (it would re-bind to DecomposeEpic's gate names).

## Layering / dependency constraint (the load-bearing one)

`src/engine/` is the generic foundation; `src/play/` holds concrete plays. T-007-03 will
make **play → engine** (decompose-epic.ts imports `castPlay` + the registry). Therefore
the engine must **not** import from `src/play/` — doing so creates a cycle
(`engine → play → engine`). This means `cast.ts`/`cast-core.ts` **cannot import
decompose-epic-core.ts**, even though it already houses `classify`/`makeStreamSink`/
`resolveLoggedModel`. The ticket's "reuse the pure decision core" is satisfiable only by
*mirroring* that core in the engine, not by importing it (see Design D1/D4).

## Build / test conventions

- Bun + TS, `verbatimModuleSyntax` (type-only imports must say `import type`),
  `noUncheckedIndexedAccess`, `strict`. `.ts` extensions in imports.
- `check:typecheck` = `tsc --noEmit`; `check:test` = `bun test`. Current suite: 236
  pass / 16 files (T-007-01 added 7).
- Pure-core test discipline: a `*-core.test.ts` imports ONLY the pure core, never a
  module that value-imports `b` — so the BAML addon never loads into the bun-test process
  (gates.test.ts / id-guard.test.ts / decompose-epic.test.ts all follow this).

## RunSummary consumers (downstream, for context only — not edited here)

cli.ts (`run ${s.runId}: ${s.outcome} (materialized: ${s.materialized})`) and
shelf/press.ts read `RunSummary.{runId, outcome, materialized}`. Re-wiring them onto
`castPlay` is **T-007-03** (it owns those files, R4). T-007-02 ships the generic loop;
nothing dispatches through it yet.

## Constraints & assumptions carried into Design

- The extraction is play-agnostic by construction: `cast.ts` may import the `Play`
  interface, the seam, budget, and the run log — never BAML, gates.ts, or any `src/play/`.
- One run-log record per cast, on every terminal path (incl. timeout) — the existing
  single-`appendRunLog` shape already guarantees this; preserve it.
- The effect relabel is now RETURNED DATA (`EffectResult.outcome`), not a caught throw —
  the throw→data conversion moves into DecomposeEpic's `effect` wrapper (T-007-03).
- The log's `epic` field is required + non-empty but is DecomposeEpic vocabulary; the
  generic loop needs a caller-supplied subject id to populate it.
