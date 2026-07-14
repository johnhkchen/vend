# Review — T-068-02-02: classify-warn-not-discard

## Handoff summary

Both pure cast classifiers now distinguish a trusted, completed token overshoot from an uncleared
budget exhaustion.

An explicitly gates-cleared exhausted run returns:

```ts
{
  outcome: "success",
  materialize: true,
  gateLog,
  overEnvelope: true,
}
```

Timeout still returns `timed-out` with no materialization.

Gate stop still returns `gate-failed` with no materialization, including when the token budget is
also exhausted.

Exhaustion without an explicit clear still returns `budget-exhausted` with no materialization.

Ordinary in-budget success remains successful and materializing without a warning.

The warning is an optional literal true so property presence carries the same one-way meaning as
the landed run-log marker.

## Commits

- `ec34f9d` — `docs(T-068-02-02): design warned overshoot classification`
- `6f7b6c7` — `feat(cast): warn and materialize cleared overshoots (T-068-02-02)`

The final Review artifact is committed separately as the Lisa-detected handoff.

Ticket phase and status frontmatter were not manually changed or staged.

## Files created

### Workflow artifacts

- `docs/active/work/T-068-02-02/research.md`
- `docs/active/work/T-068-02-02/design.md`
- `docs/active/work/T-068-02-02/structure.md`
- `docs/active/work/T-068-02-02/plan.md`
- `docs/active/work/T-068-02-02/progress.md`
- `docs/active/work/T-068-02-02/review.md`

## Files modified

### `src/engine/cast-core.ts`

Extended the generic `Verdict` interface with:

```ts
readonly overEnvelope?: true;
```

The literal optional marker makes false unrepresentable and gives T-068-02-03 a direct pure
decision to forward.

Reordered the classifier's branches to timeout, explicit stop, exhaustion, then ordinary success.

Inside the exhaustion branch, only `gateVerdict.status === "clear"` returns warned success.

A null gate verdict remains budget-exhausted and non-materializing.

Updated comments to stop treating every exhausted run as necessarily ungated and to document the
P3/P7 relationship.

`castGateRows` is unchanged.

### `src/play/decompose-epic-core.ts`

Added the same optional literal marker to the concrete decompose `Verdict`.

Applied the identical policy order using `isStop` for concrete gate narrowing.

After the stop branch returns, a non-null result in the exhaustion branch is a concrete clear and
returns warned success.

Null remains a discarded budget exhaustion.

Updated documentation symmetrically.

`gateRowsFor` is unchanged.

### `src/engine/cast-core.test.ts`

Changed the exhausted-plus-clear expectation from discarded budget exhaustion to successful,
materializing, warned completion.

Added exhausted-plus-stop coverage to prove P3 still blocks output when both conditions occur.

Added exhausted-plus-null coverage to prove an absent/skipped gate cannot authorize exhausted
output.

Added warning-absence assertions to timeout, gate-failed, opaque success, and named-clear success.

Existing gate-row assertions remain in place.

### `src/play/decompose-epic.test.ts`

Mirrored the generic matrix with the concrete gate type.

The cleared overshoot test also verifies all four passed gate rows remain present.

The exhausted stop test verifies the detailed failed gate row remains present.

The exhausted-null test verifies no gate rows or warning are invented.

Timeout and ordinary clear explicitly assert warning absence.

## Files deleted

None.

## Acceptance criterion assessment

Ticket criterion:

> classify({budgetOutcome:exhausted, gate:clear}) → materialize:true + over-envelope warning;
> classify({gate:stop}) still gate-failed/no-materialize; classify({timedOut}) still
> no-materialize; unit tests in both pure cores green.

Status: met for this ticket's pure-core scope.

### Exhausted plus clear

Both classifiers return `outcome: "success"`, `materialize: true`, and `overEnvelope: true`.

Both retain their existing gate-log translations.

The generic opaque-clear fixture correctly logs no invented names.

The concrete decompose clear correctly logs its four passed gates.

### Gate stop

Both in-budget and exhausted-plus-stop tests return `gate-failed`, do not materialize, omit the
warning, and retain the failed gate evidence.

Checking stop before the warned exhaustion branch prevents budget state from overriding the gate
contract.

### Timeout

Both timeout tests return `timed-out`, do not materialize, and omit the warning.

Timeout remains the first classification branch.

### Uncleared exhaustion

Both suites additionally pin exhausted plus null as `budget-exhausted`, non-materializing, and
unwarned.

This closes the unsafe gap between “explicitly cleared” and “not observed to stop.”

## Recalibration decision

A cleared overshoot is recorded as `success`, not `budget-exhausted` and not a new outcome.

This is intentional: once an executor result returns, gates clear, and output materializes, the
run's finishing cost is observed rather than right-censored.

Existing `recalibrate` logic will therefore include the run's actual token and wall-clock cost in
the successful percentile sample.

Existing `learnBiasFactor` may include its actual/envelope ratio when the record carries an
envelope.

The orthogonal `overEnvelope` marker keeps the contract breach separately countable and visible.

No recalibration source edit is required for this outcome choice.

Keeping the run in the completed sample also avoids perpetuating the censoring ratchet where a
heavy finishing cost never informs later estimates.

## Test evidence

### Planned red proof

Before production changes:

```text
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
83 pass / 4 fail
176 expect() calls
```

The four failures were exactly exhausted-plus-clear and exhausted-plus-stop in the two mirrors.

The exhausted-plus-null preservation tests were already green.

### Focused pure-core suites

After implementation:

```text
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
87 pass / 0 fail
189 expect() calls
```

### Typecheck

```text
bun run check:typecheck
$ tsc --noEmit
exit 0
```

### Full repository gate

```text
bun run check
1599 pass / 1 skip / 0 fail
4779 expect() calls
1600 tests across 108 files
```

BAML client generation and TypeScript checking also passed.

The single skip is the existing release acceptance test that requires local `dist/` artifacts.

## Coverage assessment

Coverage is strong for the pure disposition seam owned by this ticket.

The two implementations have direct, symmetric branch coverage for timeout, gate stop, warned
clear exhaustion, uncleared exhaustion, ordinary clear, and warning omission.

The combined exhausted-plus-stop case specifically protects the changed branch precedence.

The exhausted-plus-null case specifically protects the explicit-clear invariant.

Existing tests retain detailed gate-row coverage and exercise unrelated helpers in both pure-core
files, catching accidental module-level regressions.

Typecheck covers current structural consumers of the extended verdict.

The full suite covers downstream graph, run-log, ledger, budget, play, engine, and presentation
code against the additive interface change.

There is deliberately no effectful fixture proof in this ticket.

The current runner does not yet create the new pure input combination, and changing that is the
successor ticket's owned implementation.

## Architectural assessment

The change preserves pure core/impure shell separation.

No filesystem, clock, process, network, executor, or BAML value dependency was added to either
classifier core.

Budget arithmetic remains in `src/budget/budget.ts`.

Gate judgment remains in the gate/play layer.

The classifiers own only disposition and the warning handoff.

Run-log normalization remains decoupled and accepts the caller-supplied marker established by
T-068-02-01.

Recalibration remains a downstream consumer of run records rather than a collaborator in live
classification.

The two mirrors remain separate because the engine cannot import upward from the play layer and
their gate types are different.

Their behavior and tests are intentionally symmetric.

## Open concerns and known limitations

### 1. Current runner cannot yet produce exhausted plus clear

`src/engine/cast.ts` currently parses and gates only when `budgetOutcome.status === "ok"`.

An exhausted live cast therefore still reaches `classify` with null output and null gate verdict.

T-068-02-03 must change runner sequencing so returned exhausted output is parsed and gated before
classification, while timeout remains ungated.

Until then, this ticket's new warned branch is unit-proven but not live-reachable.

### 2. Current runner does not forward or surface the marker

`cast.ts` does not yet spread `verdict.overEnvelope` into `appendRunLog`.

It also does not print the over-envelope warning or include it in the live Settle summary.

T-068-02-03 must forward the classifier fact rather than re-derive it from budget arithmetic.

### 3. Materialization still requires parsed output

The generic runner appropriately requires both `verdict.materialize` and non-null parsed output
before calling the effect.

The successor must ensure exhausted returned output is parsed before classification so the new
verdict cannot claim materialization while `output` remains null.

### 4. Warning consistency is a runner responsibility

The pure classifier guarantees that only exhausted plus explicit clear emits `overEnvelope: true`.

The run-log sink intentionally permits callers to provide the marker with other outcomes.

T-068-02-03 should stamp the record directly from the verdict to preserve this invariant across
the effect boundary.

### 5. No prevention claim

This implementation changes disposition after token spend is measured.

It does not prevent overshoot, interrupt token generation, or change the budget denomination.

That matches the story's honest detect-after boundary.

## Final assessment

T-068-02-02 meets its acceptance criterion with both pure cores and their unit suites green.

The outcome and warning contract is ready for T-068-02-03 to make live: parse and gate exhausted
returned output, materialize only on clear, persist `overEnvelope: true`, and surface the warning.

No critical issue remains inside this ticket's scope.
