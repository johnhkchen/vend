# Structure — T-068-02-02: classify-warn-not-discard

## Change boundary

The implementation changes four existing source files and creates the ticket's remaining workflow
artifacts.

No production file is created or deleted.

No shared run-log, runner, budget, or ledger module is modified.

The two classifier cores remain separate mirrors at their existing dependency boundary.

## Files modified

### `src/engine/cast-core.ts`

This remains the generic, play-agnostic pure decision core.

#### `ClassifyInput`

The interface shape remains unchanged:

```ts
export interface ClassifyInput {
  readonly timedOut: boolean;
  readonly budgetOutcome: BudgetOutcome | null;
  readonly gateVerdict: GateVerdict | null;
}
```

The comments will no longer imply that exhausted runs cannot have a gate verdict.

The successor runner will eventually make exhausted-plus-gated input a live state.

#### `Verdict`

Add one optional one-way field:

```ts
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
  readonly overEnvelope?: true;
}
```

Place it after `gateLog` so the three existing fields retain their current order.

Document that presence means a token-exhausted run explicitly cleared gates and is allowed to
materialize with a warning.

The literal type prevents a verdict from representing `overEnvelope: false`.

#### `castGateRows`

No structural or behavioral change.

It continues to compute log rows before terminal classification.

#### `classify`

Replace the old timeout → budget → stop → success ordering with:

```ts
const gateLog = castGateRows(i.gateVerdict);
if (i.timedOut) {
  return { outcome: "timed-out", materialize: false, gateLog };
}
if (i.gateVerdict?.status === "stop") {
  return { outcome: "gate-failed", materialize: false, gateLog };
}
if (i.budgetOutcome?.status === "exhausted") {
  if (i.gateVerdict?.status === "clear") {
    return { outcome: "success", materialize: true, gateLog, overEnvelope: true };
  }
  return { outcome: "budget-exhausted", materialize: false, gateLog };
}
return { outcome: "success", materialize: true, gateLog };
```

The nested exhausted branch makes the explicit-clear requirement visible.

It also preserves the old budget-exhausted outcome for null/ungated exhausted inputs.

Update the function documentation to describe the new precedence and warning semantics.

No helper or new import is added.

### `src/engine/cast-core.test.ts`

This remains the generic classifier's pure test surface.

No fixture types or imports are added.

Use the existing `okBudget`, `exhausted`, `cleared`, `clearedNamed`, and `stopped` constants.

Modify the existing exhausted-plus-clear case to expect a successful materializing warning.

Add an exhausted-plus-stop case.

Add an exhausted-plus-null-gate case.

Add `overEnvelope` absence assertions to timeout and ordinary success cases.

Keep existing gate-log assertions.

Test names should describe policy rather than the removed behavior.

The classifier describe block remains near the top of the file.

No runner or filesystem test belongs here.

### `src/play/decompose-epic-core.ts`

This remains the concrete decompose pure core.

#### `ClassifyInput`

The interface shape remains unchanged:

```ts
export interface ClassifyInput {
  readonly timedOut: boolean;
  readonly budgetOutcome: BudgetOutcome | null;
  readonly gateResult: GateResult | null;
}
```

Update the gate-result comment so it does not encode the old “exhausted means never gated”
assumption.

#### `Verdict`

Add the same field and invariant as the generic core:

```ts
readonly overEnvelope?: true;
```

Keep the local interface rather than importing the generic verdict.

The concrete gate types differ and the existing mirror is deliberate.

#### `gateRowsFor`

No change.

Clears still produce four passed rows for the current decompose gate set.

Stops still produce one detailed failed row.

#### `classify`

Use the same semantic ordering as the generic core.

The concrete clear predicate is:

```ts
i.gateResult !== null && !isStop(i.gateResult)
```

The branch outline is:

```ts
if (i.timedOut) ...
if (i.gateResult !== null && isStop(i.gateResult)) ...
if (i.budgetOutcome?.status === "exhausted") {
  if (i.gateResult !== null) {
    return { outcome: "success", materialize: true, gateLog, overEnvelope: true };
  }
  return { outcome: "budget-exhausted", materialize: false, gateLog };
}
return { outcome: "success", materialize: true, gateLog };
```

Because the stop branch has already returned, a non-null result inside the exhausted branch is
narrowed to clear.

An explicit repeated `!isStop` check may be retained if it improves local readability.

Both cores must return structurally identical verdicts for equivalent states.

### `src/play/decompose-epic.test.ts`

This remains the concrete classifier and decompose pure-core test file.

Modify exhausted-plus-clear to assert success, materialization, warning, and passed gate rows.

Add exhausted-plus-stop to assert gate failure, no materialization, no warning, and the failed row.

Add exhausted-plus-null to assert budget exhaustion, no materialization, and no warning.

Add warning-absence assertions to timeout and ordinary in-budget clear.

No value import from the generated BAML client is introduced.

The native-addon isolation comment remains accurate.

## Files created

### `docs/active/work/T-068-02-02/research.md`

Describes the story, classifier mirrors, tests, run-log marker, runner boundary, and recalibration
semantics without prescribing implementation.

### `docs/active/work/T-068-02-02/design.md`

Records the selected success-plus-marker disposition, branch precedence, explicit-clear rule, and
recalibration decision.

### `docs/active/work/T-068-02-02/structure.md`

Defines this file-level blueprint.

### `docs/active/work/T-068-02-02/plan.md`

Sequences test changes, red proof, production changes, verification, and commits.

### `docs/active/work/T-068-02-02/progress.md`

Records phase completion, test evidence, commits, deviations, and remaining work during
implementation.

### `docs/active/work/T-068-02-02/review.md`

Provides the final handoff, acceptance assessment, test evidence, coverage evaluation, and open
concerns for T-068-02-03.

## Files explicitly unchanged

`docs/active/tickets/T-068-02-02.md` keeps Lisa-managed phase and status changes untouched.

`docs/active/stories/S-068-02.md` remains unchanged.

`src/log/run-log.ts` already owns the durable marker and remains unchanged.

`src/log/run-log.test.ts` already proves marker persistence and remains unchanged.

`src/engine/cast.ts` remains unchanged because runner gating and warning forwarding belong to the
successor ticket.

`src/play/decompose-epic.ts` remains unchanged for the same reason.

`src/ledger/recalibrate.ts` remains unchanged because selecting `success` automatically places the
completed run in its existing success sample.

`src/budget/budget.ts` remains unchanged because it continues to detect and describe exhaustion.

## Module boundaries

Budget detection remains in the budget pure core.

Gate judgment remains in the play gate core.

Disposition remains in the two classification pure cores.

Durable normalization remains in the run-log core.

Effectful parsing, materialization, logging, and surfacing remain in the runner shell.

Recalibration remains a downstream consumer of normalized run records.

The new verdict marker is the data handoff between disposition and later runner wiring.

## Behavioral matrix

| Timed out | Budget | Gate | Outcome | Materialize | Warning |
|---|---|---|---|---|---|
| true | any | any | timed-out | false | absent |
| false | any | stop | gate-failed | false | absent |
| false | exhausted | clear | success | true | true |
| false | exhausted | null | budget-exhausted | false | absent |
| false | ok | clear | success | true | absent |
| false | ok | null | success | true | absent |

The last row preserves the generic no-gates behavior for in-budget casts.

Only the exhausted-plus-clear row is newly materializing.

## Ordering constraints

Tests should be changed before production branches to establish a focused red proof.

Both test files should be updated before either production implementation so the mirror contract
is visible together.

Both production cores should be updated in one implementation unit to prevent drift.

Focused tests should pass before the full repository gate.

The ticket's source and artifact paths must be staged explicitly so unrelated shared-worktree
changes are excluded from commits.

The ticket frontmatter must not be staged or edited.
