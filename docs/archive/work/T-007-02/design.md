# T-007-02 — Design: generic-cast-loop

Decide the shape of `castPlay` and its pure core. The research shows the spine is
*already* a clean render→dispense→meter→parse→gate→classify→effect→log sequence; the
only play-specific steps are render/parse/gates/effect — exactly what `Play<I, O>`
abstracts. Every decision below is grounded in two hard codebase facts: (a) the engine
must not import `src/play/` (a cycle with T-007-03), and (b) `GateVerdict` is a *generic*,
opaque-on-clear verdict, not gates.ts's `GateResult`.

## The signature at a glance

```ts
// src/engine/cast.ts  — the IMPURE orchestrator (the single untested verb)
async function castPlay<I, O>(
  play: Play<I, O>, inputs: I, budget: Budget, opts: CastOptions,
): Promise<RunSummary>;

interface CastOptions {
  readonly subject: string;          // → run-log `epic` field (the cast's target id)
  readonly projectRoot?: string;     // default process.cwd()
  readonly model?: string;           // pinned model → --model; omitted ⇒ CLI default
  readonly runId?: string;           // derived from startedAt if omitted
  readonly transcriptDir?: string;   // default <root>/.vend/transcripts
  readonly runLogPath?: string;      // override the ledger path (testability)
}
interface RunSummary { readonly runId: string; readonly outcome: RunOutcome;
  readonly materialized: boolean; }
```

## Decision 1 — Mirror the pure/impure split in the ENGINE, do not import the play core

The ticket says "reuse the pure decision core in `src/play/decompose-epic-core.ts`."
Research established this is **impossible by import**: T-007-03 makes `play → engine`, so
any `engine → play` import is a cycle. Three options:

- **(a) import decompose-epic-core from cast.ts** — literal reading of the ticket;
  **creates the cycle**. Rejected.
- **(b) move the shared helpers down to a new neutral module both import** — cleanest
  long-term, but requires editing decompose-epic-core.ts (owned by T-002-03, R4) and
  reversing its deps before T-007-03 has established the direction. Out of this slice.
- **(c, chosen) mirror the split in the engine.** New `src/engine/cast-core.ts` holds the
  PURE decision core (`classify`, `castGateRows`, `makeStreamSink`, `formatMessage`,
  `resolveLoggedModel`, `DEFAULT_MODEL`); `cast.ts` is the impure verb. This honors the
  ticket's *intent* (a tested pure core + one untested verb, AC#3) and the layering.

**Cost:** `makeStreamSink`/`formatMessage`/`resolveLoggedModel` are duplicated ~verbatim
from decompose-epic-core.ts (they are already fully play-agnostic). This is deliberate,
flagged tech-debt: a later kaizen ticket can DRY them into one shared module once
T-007-03 has fixed the dependency direction (play → engine). ~35 lines of stable, pure
code; the duplication buys a clean acyclic graph today. Documented in Review.

## Decision 2 — A generic `classify` over `GateVerdict`, not gates.ts's `GateResult`

decompose-epic-core's `classify` takes `gateResult: GateResult | null` (gates.ts's type).
The generic loop receives a `GateVerdict` from `play.gates`. These are **not assignable**:
`GateVerdict`'s stop is `{gate: string,…}` (not `GateName`) and its clear is `{status:
"clear"}` (no `cleared` field). So the engine needs its own `classify`:

```ts
function classify(i: { timedOut: boolean; budgetOutcome: BudgetOutcome | null;
                      gateVerdict: GateVerdict | null }): Verdict;
```

The **decision logic is identical** to the welded core (the part the ticket means by
"the same classify verdict") — first-match priority, materialize only on success:

1. `timedOut` → `timed-out`, no materialize.
2. `budgetOutcome.status === "exhausted"` → `budget-exhausted`, no materialize (P7: a
   budget breach stops the line even if gates would have cleared).
3. `gateVerdict.status === "stop"` → `gate-failed`, no materialize.
4. otherwise → `success`, materialize.

Only the *gate input type* changes (`GateVerdict` vs `GateResult`); the branch order and
outcomes are copied exactly, and the cast-core test pins the same four cases the runner's
test pins. Rejected — casting a `GateVerdict` to gates.ts `GateResult` to reuse the old
`classify`: a lie to the type system and still needs the engine to import gates.ts.

## Decision 3 — `castGateRows`: real rows on STOP, empty on CLEAR (honest, not fabricated)

The run log wants `GateResult[]` (run-log's per-gate `{gate, passed, detail?}`). The
welded `gateRowsFor` emits one *failed* row on STOP and one *passed* row **per cleared
gate name** on CLEAR — but it can only do the latter because gates.ts's `GateClear`
carries `cleared: GateName[]`. `GateVerdict.clear` is **opaque** (T-007-01 D2), so the
generic loop has no gate names on a pass. Options:

- **(a) fabricate a synthetic passed row** (e.g. `{gate: "gates", passed: true}`) —
  invents a gate name the play never declared; misleading data in an append-only ledger.
- **(b, chosen) STOP → one failed row naming the real gate/unit/reason; CLEAR → `[]`.**
  Record only what the play actually told us. The record's top-level `outcome: "success"`
  already conveys "cleared"; the empty `gateResults` is honest about the generic loop not
  knowing the per-gate breakdown.

```ts
function castGateRows(g: GateVerdict | null): readonly LogGate[] {
  if (g === null) return [];
  if (g.status === "stop") return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return []; // clear: the interface exposes no per-gate names (D2)
}
```

**Behavior note for T-007-03:** once DecomposeEpic runs through `castPlay`, a *successful*
run will log `gateResults: []` instead of the four passed rows the welded runner wrote.
That is a faithful consequence of the play-agnostic contract, not a regression to fix
here. If per-gate success logging matters, T-007-03 can enrich `GateVerdict.clear` to
carry `cleared: string[]` and this function reads it — a one-line change, isolated.
Flagged in Review as the one cross-ticket consequence.

## Decision 4 — Reuse the stream/model helpers by re-implementation; keep the seam path identical

`makeStreamSink`, `formatMessage`, `resolveLoggedModel`, `DEFAULT_MODEL` are already
play-agnostic and pure. Per D1 they are *re-implemented* in cast-core.ts (not imported).
The two-surface streaming (AC#1) is wired exactly as the runner does it:

```ts
const onMessage = makeStreamSink({
  write: (line) => process.stdout.write(`${line}\n`),
  sink:  (raw)  => void appendFile(transcriptPath, `${raw}\n`, "utf8"),
});
```

`dispense({ prompt, model: opts.model, onMessage, timeoutMs: timeoutMsFor(budget) })` is
called identically; `ClaudeTimeoutError` → `timedOut`, any other throw re-raised (a
genuine launch failure is not a clean outcome). Model id resolved DOWNSTREAM of dispense
via `resolveLoggedModel(result?.model, opts.model)`.

## Decision 5 — The effect relabel is returned data; a real throw still propagates

The welded runner caught `IdCollisionError` from `materialize` and relabeled the outcome.
Under the contract the effect RETURNS `EffectResult {ok, outcome?, detail?, artifacts?}`
(T-007-01 D3), so the cast loop reads the relabel as data — no try/catch around
`play.effect`:

```ts
if (verdict.materialize && output !== null) {
  const eff = await play.effect(output, ctx);
  materialized = eff.ok;
  if (eff.outcome) outcome = eff.outcome;   // e.g. "id-collision"
  process.stdout.write(`· effect ${eff.ok ? "✓" : "✗"}${eff.detail ? ` ${eff.detail}` : ""}\n`);
} else if (verdict.outcome !== "success") {
  process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateVerdict, budgetOutcome)}\n`);
}
```

The throw→data conversion (catching `IdCollisionError` inside DecomposeEpic's effect) is
**T-007-03's** job inside the concrete play; cast.ts stays free of it. If `play.effect`
throws (an *unexpected* fs failure, not the contracted collision), it propagates —
mirroring the runner's `else throw e`: an uncontracted throw is a real bug, not an outcome.

## Decision 6 — `opts.subject` populates the log's `epic`; `RunSummary` keeps its shape

run-log requires a non-empty `epic`. That field is DecomposeEpic vocabulary; the generic
loop cannot derive it from `inputs: I`. So the **caller supplies `opts.subject`** (for
DecomposeEpic, the `epicIdOf(...)` value), which the loop logs as `epic`. Naming it
`subject` keeps "epic" out of the play-agnostic API surface while feeding the unchanged
log schema (a schema rename epic→subject is out of scope). `subject` is required +
non-empty (an empty one is a caller error surfaced by `appendRunLog`'s own assert).

`RunSummary` keeps `{runId, outcome, materialized}` verbatim — the shape cli.ts /
press.ts already read, so T-007-03's re-wire is a drop-in. `materialized` reads as
"the effect landed" generically (= `EffectResult.ok`).

## Decision 7 — Testing: pure core fully tested; `castPlay` is the untested impure verb

Mirroring the runner (AC#3): `cast-core.test.ts` exercises `classify` (4 priority cases),
`castGateRows` (stop/clear/null), `formatMessage`, `makeStreamSink`, `resolveLoggedModel`
— a pure-function test that loads **no** BAML addon and **no** seam spawn. `castPlay`
itself spawns `claude` and touches fs, so it is NOT unit-tested — exactly as
`runDecomposeEpic`/`dispense`/`appendRunLog`/`materialize` are not. Its play-agnostic
correctness is proven by `tsc` (it compiles against the generic `Play` with zero
`src/play/` or BAML import) and goes LIVE in T-007-03 when DecomposeEpic is registered
and cast (the analogue of T-002-04 for the welded runner). Rejected — injecting a fake
`dispense` for a unit test: adds API surface for testability the house pattern declines.

## What stays out (honest scope)

- No play registration, no `vend <name>` dispatch, no CLI/press re-wire — all T-007-03.
- No edit to decompose-epic.ts / decompose-epic-core.ts / play.ts (R4 file-ownership).
- No DRY of the duplicated stream/model helpers — a later kaizen once deps are reversed.
- No second play — T-007-04 (it proves play-agnosticism by construction).
