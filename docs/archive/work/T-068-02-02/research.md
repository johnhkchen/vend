# Research — T-068-02-02: classify-warn-not-discard

## Ticket position

T-068-02-02 is the middle ticket in story S-068-02.

Its dependency, T-068-02-01, has already added the durable run-log marker.

Its successor, T-068-02-03, owns runner parsing, gating, materialization, logging, and live
surface wiring.

This ticket owns only the pure classification decision and its direct unit tests.

The ticket starts in `phase: research`.

The ticket and story files are already modified/untracked by Lisa in the shared worktree.

Those orchestration changes are outside this ticket and must be preserved.

## Story contract

The parent story changes the disposition of an already-detected token overshoot.

A run may materialize after exceeding its token envelope only when its gates clear.

A gate failure still discards the candidate output.

A wall-clock timeout still discards the candidate output.

The story calls this “warn, not prevent.”

The honest boundary states that token overshoot is detected after spend; it is not prevented.

The story requires both mirrored classifiers to agree.

The story also requires an over-envelope warning on the eventual run record.

That record and runner behavior span the three serial tickets, not this ticket alone.

## Charter and vision constraints

P3 says gates are the contract.

For this ticket, gate clearance is the condition that distinguishes a usable overshoot from a
discarded overshoot.

P4 says runs proceed autonomously against their gates rather than live approval.

The classification decision is therefore deterministic data, not an interactive escalation.

P7 says budget is a hard contract.

The story preserves that contract as a countable warning after an overshoot rather than erasing
the cleared work.

The warning is not permission to ignore spend; it records that the allocated envelope was
exceeded.

The local-first and pure-core boundaries are unaffected.

## Generic classifier

`src/engine/cast-core.ts` is the generic cast loop's pure decision core.

It imports `BudgetOutcome`, generic `GateVerdict`, and run-log types as type-only dependencies.

It does not import filesystem, clock, process, executor verbs, or the BAML native addon.

`ClassifyInput` contains:

- `timedOut: boolean`;
- `budgetOutcome: BudgetOutcome | null`;
- `gateVerdict: GateVerdict | null`.

`GateVerdict` has a `clear` variant and a `stop` variant.

The clear variant can optionally echo cleared gate names.

The stop variant carries the failed gate, unit, and reason.

The generic `Verdict` currently contains:

- `outcome: RunOutcome`;
- `materialize: boolean`;
- `gateLog: readonly LogGate[]`.

`castGateRows` translates the generic gate result into durable per-gate rows.

A stop creates one failed row.

A named clear creates one passed row per echoed gate.

An opaque clear or null creates no gate rows.

The current `classify` branch order is:

1. timeout → `timed-out`, no materialization;
2. exhausted budget → `budget-exhausted`, no materialization;
3. gate stop → `gate-failed`, no materialization;
4. otherwise → `success`, materialize.

The existing documentation describes timeout or exhaustion as outranking gate verdicts.

That description embodies the behavior this story is changing.

## Decompose-specific classifier

`src/play/decompose-epic-core.ts` is the older decompose-specific pure core.

It mirrors the generic classifier because engine code cannot depend upward on play code.

Its `ClassifyInput` uses `gateResult` rather than `gateVerdict`.

Its gate type is the concrete decompose `GateResult` from `src/gate/gates.ts`.

Its clear variant always carries the cleared gate names.

Its stop detection uses the `isStop` type guard.

Its `Verdict` has the same three properties as the generic verdict.

`gateRowsFor` performs the concrete gate-to-log translation.

Its current `classify` has the same branch priority and terminal values as the generic core.

The duplicated classifiers are intentionally maintained as mirrors at the current dependency
boundary.

## Existing classifier tests

`src/engine/cast-core.test.ts` imports only the pure core for classifier coverage.

Its fixture values include an in-budget outcome, an exhausted outcome, an opaque clear, a named
clear, and a stop.

Its classifier tests currently cover:

- timeout with null budget and gate values;
- exhausted budget plus clear;
- in-budget stop;
- in-budget opaque clear;
- in-budget named clear.

The exhausted-plus-clear test currently expects `budget-exhausted` and no materialization.

`src/play/decompose-epic.test.ts` follows the same native-addon isolation discipline.

Its classifier tests currently cover timeout, exhausted-plus-clear, in-budget stop, and
in-budget clear.

Its exhausted-plus-clear test also expects `budget-exhausted` and no materialization.

Neither suite currently asserts an over-envelope value on a verdict.

Neither suite currently covers exhausted-plus-stop as a combined condition.

Neither suite currently covers exhausted-plus-null-gate as a combined condition.

## Budget outcome shape

`src/budget/budget.ts` supplies a discriminated `BudgetOutcome`.

The relevant variants are `status: "ok"` and `status: "exhausted"`.

An exhausted value carries `spent`, `ceiling`, and `overage` plus its error code.

The classifiers only inspect the `status` discriminant.

They do not recompute token spend or derive an overage.

This keeps arithmetic in the budget core and disposition in the classifier.

## Run-log marker dependency

T-068-02-01 added `overEnvelope` to `src/log/run-log.ts`.

`RunRecordInput.overEnvelope` accepts an optional boolean.

Normalized `RunRecord.overEnvelope` is optional literal `true`.

The builder and reviver retain only literal true.

False, absent, and malformed values are omitted.

The marker is structural data supplied by the runner.

The run log deliberately does not infer it from usage, envelope, gates, or outcome.

The dependency review tells this ticket to make the classifier's warning fact available to the
runner rather than asking the runner to reproduce classification policy.

## Run outcome semantics

`src/log/run-log.ts` defines `RunOutcome` as a closed string union.

Relevant existing values are `success`, `gate-failed`, `timed-out`, and `budget-exhausted`.

There is no separate “success-over-envelope” outcome.

The run-log marker ticket explicitly left `RUN_OUTCOMES` unchanged.

That ticket describes the marker as orthogonal to terminal outcome.

A clearing outcome plus a warning is the data shape established by the dependency.

## Recalibration boundary

`src/ledger/recalibrate.ts` splits recent run records by outcome.

Only records with `outcome === "success"` feed the finishing-cost percentile.

Only `budget-exhausted` and `timed-out` count as censored outcomes.

Gate failures and other refusals are neither successful samples nor censored samples.

`fundingEnvelope` reads censored actuals as lower bounds when widening under-calibrated guards.

`learnBiasFactor` likewise uses only successful records with an envelope.

Therefore the terminal outcome assigned to a cleared overshoot determines its later statistical
treatment.

As `success`, it becomes an observed finishing-cost sample with its actual total.

As `budget-exhausted`, it remains in the right-censored set even if materialized.

The story explicitly assigns resolution of this semantic choice to this ticket's design.

## Current runner behavior

`src/engine/cast.ts` checks the token budget after the executor returns.

At present it parses and gates output only inside `if (budgetOutcome.status === "ok")`.

An exhausted generic cast therefore currently reaches `classify` with a null gate verdict and
null parsed output.

The runner calls the generic classifier once and consumes its outcome, materialize flag, and gate
rows.

The effect runs only when `verdict.materialize` is true and parsed output is non-null.

The run log currently receives the final outcome and `verdict.gateLog`.

It does not yet receive `overEnvelope`.

The decompose entry point now delegates to the generic cast path.

The successor ticket names both `cast.ts` and the decompose effect because it owns the complete
fixture path and warning surface.

Changing the runner's parse/gate condition in this ticket would cross the story's ticket boundary.

## State combinations at the pure boundary

Timeout is independently represented by `timedOut`.

An exhausted budget can theoretically arrive with a clear, stop, or null gate value because the
pure function accepts all combinations.

The ticket acceptance explicitly names exhausted plus clear.

The story explicitly preserves stop and timeout discard behavior.

Null means the run never gated or gates were deliberately skipped in the generic engine.

The pure classifier is total over these combinations even when current runner control flow cannot
yet produce all of them.

## File and ownership map

Ticket-owned production files:

- `src/engine/cast-core.ts`;
- `src/play/decompose-epic-core.ts`.

Ticket-owned test files:

- `src/engine/cast-core.test.ts`;
- `src/play/decompose-epic.test.ts`.

Ticket-owned workflow artifacts:

- `docs/active/work/T-068-02-02/research.md`;
- `docs/active/work/T-068-02-02/design.md`;
- `docs/active/work/T-068-02-02/structure.md`;
- `docs/active/work/T-068-02-02/plan.md`;
- `docs/active/work/T-068-02-02/progress.md`;
- `docs/active/work/T-068-02-02/review.md`.

Out-of-scope files include the ticket/story frontmatter, run-log schema, runner shell, budget
arithmetic, recalibration implementation, and live/fixture runner tests.

## Constraints and assumptions

Both classifier implementations must remain behaviorally identical.

Pure cores must remain free of effects and value imports that load native code.

Gate failure and timeout must continue to dominate materialization.

An over-envelope warning must be derived from both budget exhaustion and explicit gate clearance.

The warning must not be inferred solely from budget exhaustion.

Existing in-budget success behavior must remain unchanged.

Existing gate-row translation must remain unchanged.

No new run outcome is present in the dependency contract.

The full repository gate is `bun run check`.

Done includes committed code, tests, and work artifacts with the gate green.
