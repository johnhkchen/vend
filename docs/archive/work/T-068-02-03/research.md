# Research — T-068-02-03: runner-materialize-and-surface

## Ticket position

- Ticket: `T-068-02-03`.
- Story: `S-068-02`, “warn-not-discard-over-envelope.”
- Current ticket phase: `research`.
- Dependency `T-068-02-02` is complete.
- This is the third and final ticket in the story’s serial DAG.
- No artifact directory existed for this ticket before this phase.
- The worktree contains unrelated Lisa metadata and other E-068 ticket work.
- Those existing changes must be preserved and excluded from ticket-specific edits.

## Product contract

The vision defines gates as the contract that makes probabilistic work dependable.

The story applies that principle to a detect-after token overshoot:

- token spend is already incurred when the executor returns;
- the runner cannot prevent that historical spend;
- a returned plan may materialize only when its gates explicitly clear;
- a gate stop or wall-clock timeout must still discard output;
- a cleared overshoot is a success carrying a warning, not a censored budget exhaustion;
- the warning must be durable on the run record and visible during settlement.

This advances P3 and P4 without claiming token-wall prevention under P7.

The ticket acceptance criterion asks for one fixture-level proof:

- cast a gates-passing plan through a stub executor;
- make its reported token usage exceed the supplied ceiling;
- write story and ticket files;
- append one cleared run record;
- preserve the over-envelope warning on that record;
- do not classify the run as `budget-exhausted`.

## Runtime architecture

`src/engine/cast.ts` is the active generic runner.

Its header documents the fixed orchestration:

1. render the play prompt;
2. dispense through an executor;
3. meter returned usage against the budget;
4. parse returned text;
5. run the play gates;
6. classify the terminal disposition;
7. invoke the play effect when authorized;
8. append exactly one run-log record;
9. return a `RunSummary`.

The module is an impure shell. Pure classification lives in `src/engine/cast-core.ts`.

Concrete plays depend upward on the engine through the `Play<I, O>` interface.
The engine intentionally imports no concrete play or BAML module.

`src/play/decompose-epic.ts` is now a registered concrete play rather than a second active runner.

Its `runDecomposeEpic` function delegates to `assembleAndCast`, which delegates to `castPlay`.
Therefore runner behavior changes belong in `cast.ts`; changing that seam also changes live decompose behavior.

## Existing classification contract

T-068-02-02 changed both mirrored pure classifiers:

- `src/engine/cast-core.ts` exposes `classify` for the generic runner;
- `src/play/decompose-epic-core.ts` retains the older decompose-specific mirror;
- both return a `Verdict` with `outcome`, `materialize`, `gateLog`, and optional `overEnvelope`;
- `overEnvelope` is typed as optional literal `true`;
- timeout wins and never materializes;
- a gate stop wins over token exhaustion and never materializes;
- exhausted plus explicit gate clear returns success, materialization, and the warning;
- exhausted plus null gate remains `budget-exhausted` and non-materializing;
- an ordinary in-budget clear remains an unmarked success.

Unit tests in both pure-core suites pin that state matrix.

The classifier is the authoritative source of the warning.
The runner should not repeat budget-and-gate arithmetic independently.

## Current unreachable live branch

`castPlay` initializes `budgetOutcome`, `gateVerdict`, and parsed `output` to null.

When an executor returns, it calls `check(budget, usage)`.

It currently parses and gates only inside:

```ts
if (budgetOutcome.status === "ok") {
  output = play.parse(...);
  gateVerdict = play.gates(...);
}
```

For an exhausted result:

- `budgetOutcome` is exhausted;
- `output` stays null;
- `gateVerdict` stays null;
- `classify` receives exhausted plus null;
- the outcome remains `budget-exhausted`;
- the effect does not run;
- no story or ticket file can be written.

The pure warned-clear verdict is therefore correct but unreachable in the current effect shell.

Timeout behavior is structurally separate:

- executor timeout sets `timedOut` true;
- `result` remains null;
- parsing and gating are skipped because there is no terminal result;
- classification returns `timed-out`;
- the effect remains unreachable.

## Gate-skip behavior

`CastOptions.skipGates` deliberately keeps `gateVerdict` null.

For an in-budget result, that mode currently materializes as an ungated success.

For an exhausted result, the new classifier requires explicit clear before materialization.
An exhausted `skipGates` cast therefore remains a discarded `budget-exhausted` run.

That follows the story’s requirement that an overshoot materialize only after gates pass.

## Effect boundary

The generic runner calls `play.effect(output, ctx)` only when:

- `verdict.materialize` is true; and
- parsed `output` is non-null.

The effect reports `ok`, optional produced data, optional detail, and an optional outcome relabel.

Decompose’s effect in `src/play/decompose-epic.ts`:

- canonicalizes model-proposed IDs to the epic’s nested ID namespace;
- validates graph integrity before writing;
- applies optional born-blocked dependencies;
- calls `materialize` to write story and ticket files;
- runs `lisa validate` after writing;
- returns expected refusals as effect data rather than throwing.

No warning decision belongs inside this concrete effect.
The effect receives only the parsed plan and cast context, not the classifier verdict.

## Run-log boundary

`src/log/run-log.ts` already contains the T-068-02-01 schema change.

`RunRecordInput.overEnvelope` accepts an optional boolean.

Normalized `RunRecord.overEnvelope` is optional literal `true`.

The log builder and reviver use a one-way normalization rule:

- literal true is retained;
- false, absence, and malformed values are omitted;
- old records remain byte-compatible when unmarked.

This mirrors the existing `reducedGrounding` marker.

`cast.ts` already demonstrates the intended forwarding style:

```ts
...(reducedGrounding ? { reducedGrounding: true } : {})
```

The current append object does not forward `verdict.overEnvelope`.
Consequently no live cast can currently persist the new marker.

## Live settlement surface

`RunSummary` currently includes:

- `runId`;
- `outcome`;
- `materialized`;
- optional `produced`;
- optional measured `actuals`.

It has no over-envelope warning field.

CLI call sites print a final line from this summary containing outcome and materialization.

`castPlay` also emits live effect, andon, turns, and reduced-grounding lines directly to stdout.

There is therefore an established dual live surface:

- detailed cast-time notices from the runner;
- a returned settlement summary consumed by CLI and higher-level orchestration.

For a warning to be available rather than buried only in the ledger, the runner must surface it.

## Existing fixture-test pattern

`src/engine/cast.test.ts` is already the executor-agnostic integration suite.

It avoids Claude and BAML by using:

- a temporary project directory;
- a trivial `Play` fixture;
- an injected stub `Executor`;
- a fabricated terminal `ResultMessage` with usage;
- a custom run-log path;
- assertions over effect observations and the JSONL record.

The suite currently proves:

- stub execution streams messages and returns a result;
- parse, clear, effect, and logging run end to end;
- reduced-grounding markers are forwarded and revived;
- timeouts stay non-materializing.

This is the nearest and lowest-risk location for the new fixture.

The existing echo effect only writes to an in-memory array.
The ticket needs filesystem evidence specifically named as story and ticket files.
A dedicated fixture play can keep plain plan parsing and a thin file-writing effect while remaining BAML-free.

## Relevant constraints

- Preserve pure-core/impure-shell separation.
- Do not import `src/play/decompose-epic.ts` into a Bun test that should avoid the BAML native addon.
- Do not duplicate classification in the effect shell.
- Do not add a new run outcome; cleared overshoot remains `success` plus marker.
- Keep timeout and gate-stop paths unchanged.
- Keep unmarked records free of an `overEnvelope` key.
- Use the executor’s returned usage as the measured spend.
- Maintain exactly one append per completed cast path.
- Do not change ticket phase or status frontmatter.
- Preserve unrelated dirty-worktree changes.

## Research conclusion

The implementation gap is localized to the generic effect shell and its fixture suite.

The classifier and log schema already provide the required typed facts.

The active runner must let a returned exhausted result reach parse and gates, then forward the resulting verdict warning through materialization, live settlement, and the append-only record.

No concrete decompose algorithm, gate rule, materializer, budget denomination, or run-log schema change is required.
