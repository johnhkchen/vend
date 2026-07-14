# Design — T-068-02-02: classify-warn-not-discard

## Decision summary

Represent a gates-cleared token overshoot as a successful, materializing verdict carrying an
optional literal warning marker:

```ts
interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
  readonly overEnvelope?: true;
}
```

Both classifiers will use the same precedence:

1. timeout → `timed-out`, no materialization, no warning;
2. explicit gate stop → `gate-failed`, no materialization, no warning;
3. exhausted budget plus explicit gate clear → `success`, materialize, `overEnvelope: true`;
4. exhausted budget without an explicit clear → `budget-exhausted`, no materialization, no
   warning;
5. otherwise → `success`, materialize, no warning.

The warning remains absent on every ordinary or discarded verdict.

## Design goals

The design must satisfy the exact ticket combination: exhausted budget plus clear gates becomes
materializable and warned.

It must preserve gate-stop discard behavior.

It must preserve timeout discard behavior.

It must not allow an exhausted ungated/null result to materialize.

It must give T-068-02-03 one authoritative fact to forward into the run log and live surface.

It must settle how recalibration sees a cleared overshoot.

It must keep the two pure cores symmetric.

It must avoid changing the runner, run-log schema, or recalibration code in this ticket.

## Option A — success outcome plus one-way verdict marker

Under this option, a cleared overshoot returns:

```ts
{
  outcome: "success",
  materialize: true,
  gateLog,
  overEnvelope: true,
}
```

All other verdicts omit `overEnvelope`.

### Advantages

This matches the dependency's established record shape: a clearing outcome with an orthogonal
one-way warning.

It gives the successor runner a direct value to forward.

It keeps policy in the pure classifier rather than duplicating a compound condition in an effect
shell.

It allows current success-only consumers to recognize the run as completed work.

It lets recalibration include the actual finishing cost in its success sample.

It requires no change to the closed `RunOutcome` union.

It preserves byte-compatible omission when there is no warning.

The optional literal `true` mirrors normalized `RunRecord.overEnvelope?: true`.

### Costs

The word `success` now means “gates cleared and output completed,” not necessarily “within the
allocated token envelope.”

Consumers that care about envelope compliance must inspect the marker as well as outcome.

That semantic expansion is intentional in the story: the warning makes the contract breach
countable without discarding completed, gated work.

## Option B — keep `budget-exhausted`, set materialize true, add warning

Under this option, the cleared overshoot would be:

```ts
{
  outcome: "budget-exhausted",
  materialize: true,
  gateLog,
  overEnvelope: true,
}
```

### Advantages

The outcome continues to name the budget breach directly.

Existing censored counts would continue to count the overshoot without inspecting the marker.

### Problems

It makes `materialize` and outcome semantics pull in opposite directions.

The generic runner currently prints an andon for any non-success verdict when it does not effect,
and adjacent code assumes success is the ordinary materialization path.

More importantly, recalibration would continue treating the record as right-censored.

That statistical label would be false once the run has returned, parsed, cleared gates, and
materialized: its finishing cost is observed, not merely a lower bound.

The run would be excluded from the percentile and bias samples even though its actual completed
cost is precisely the data those samples need.

The dependency review calls for a “clearing outcome,” which this option does not provide.

Rejected.

## Option C — add a new terminal outcome

Examples include `success-over-envelope` or `cleared-over-envelope`.

### Advantages

The outcome alone would encode both completion and budget breach.

Exhaustive switches could force every consumer to make an explicit decision.

### Problems

T-068-02-01 deliberately kept `RUN_OUTCOMES` unchanged and added an orthogonal marker.

Adding an outcome would expand this ticket into run-log validation, serialization fixtures,
recalibration filters, graph summaries, probes, presentation, and other exhaustive consumers.

It would duplicate the information already represented by `success` plus `overEnvelope`.

It would also make historical compatibility and aggregate definitions more complex for no added
ticket value.

Rejected as contrary to the established dependency contract and current scope.

## Option D — return a required boolean warning

This option adds:

```ts
readonly overEnvelope: boolean;
```

Every return branch would explicitly provide true or false.

### Advantages

Callers can use the property without optional access.

The type makes every branch visibly account for the warning.

### Problems

The durable marker is intentionally one-way: false and absent are equivalent, and only true is
meaningful.

A required false creates a different shape from the record contract and invites downstream code
to serialize a meaningless false.

It also adds noise to every existing verdict assertion and returned object.

Rejected in favor of optional literal true.

## Option E — do not add warning data to `Verdict`

The runner could derive the marker with:

```ts
budgetOutcome?.status === "exhausted" && gateVerdict?.status === "clear"
```

### Advantages

The classifier interface would remain unchanged.

### Problems

It duplicates the classification rule in the impure runner.

The decompose-specific and generic paths could drift.

The successor ticket would have to reconstruct why materialization was allowed rather than honor
the classifier's complete decision.

The ticket explicitly asks `classify` to return the over-envelope warning.

Rejected.

## Gate precedence

The old classifier placed budget exhaustion before gate stop.

That order was safe only while every exhaustion discarded.

Once an exhaustion can materialize, gate status must be checked before the special cleared
overshoot branch.

Otherwise exhausted plus stop could accidentally enter a warning path based only on budget.

The design therefore tests explicit stop before exhausted-plus-clear.

A stop always returns `gate-failed`, even when spend is also exhausted.

This makes P3 visible in the branch structure: gates decide whether completed output is trusted.

The failed gate row remains available for the durable record.

## Timeout precedence

Timeout remains the first branch.

A timed-out run has no reliable completed output to parse or materialize.

Even if a synthetic pure input also contains a clear or exhausted value, timeout wins.

The verdict remains `timed-out`, non-materializing, and unmarked.

Gate-row translation remains independent and is computed before the branch, preserving current
behavior for any synthetic combined input.

## Explicit-clear requirement

Budget exhaustion alone is insufficient to warn-and-materialize.

The special path requires an explicit clear variant.

In the generic core, that is `i.gateVerdict?.status === "clear"`.

In the decompose core, it is a non-null result for which `isStop` is false.

An exhausted value with null gates remains `budget-exhausted` and non-materializing.

This matters for the generic `--no-gates` mode as well as impossible or partially assembled
inputs.

The story says “gates-CLEARED,” not merely “not known to have failed.”

## Recalibration decision

The cleared overshoot will use `outcome: "success"`.

This is the correct statistical treatment because the executor returned and the successor runner
will parse, gate, and materialize the completed output.

Its final token spend is observed.

It is therefore not right-censored.

`recalibrate` will include its actual tokens and duration in the success percentile.

`learnBiasFactor` may include its actual-to-allocated ratio when an envelope is present.

The `overEnvelope` marker preserves the contract-breach fact for counting and presentation.

No recalibration source change is required: existing success filtering produces the desired
semantics once classification emits success.

This also helps break the censoring ratchet described in the ledger: a completed heavy run becomes
a finishing-cost observation instead of remaining excluded forever.

## Verdict type choice

Use `readonly overEnvelope?: true` in both local `Verdict` interfaces.

The two interfaces remain local because the classifier modules already mirror rather than share
their play-specific gate types.

Literal true encodes the invariant that property presence is the warning.

Ordinary success, gate failure, timeout, and uncleared exhaustion omit the property.

No helper is necessary for a single compound branch.

No import from run-log's `RunRecord` is necessary.

## Test design

Update the existing exhausted-plus-clear test in each core to assert:

- `outcome === "success"`;
- `materialize === true`;
- `overEnvelope === true`;
- existing clear gate rows remain intact where applicable.

Add exhausted-plus-stop coverage in each core to assert:

- `outcome === "gate-failed"`;
- `materialize === false`;
- `overEnvelope === undefined`;
- the failed gate row remains intact.

Add exhausted-plus-null coverage in each core to assert:

- `outcome === "budget-exhausted"`;
- `materialize === false`;
- `overEnvelope === undefined`.

Strengthen timeout tests to assert no warning.

Strengthen in-budget success tests to assert no warning.

The generic named-clear test continues to pin passed gate rows.

The concrete clear test continues to pin four passed gate rows.

## Scope boundary

This ticket will not change `src/engine/cast.ts` to parse/gate exhausted output.

It will not stamp `overEnvelope` on a run record.

It will not add live warning text.

It will not alter settle summaries.

It will not modify `RunOutcome`, run-log normalization, or recalibration filters.

It will not add a fixture executor test.

Those are T-068-02-03 responsibilities.

## Chosen design

Choose Option A with timeout-first, stop-second precedence and an explicit-clear requirement.

This is the smallest pure decision that satisfies the ticket, preserves P3, records the P7 breach,
and hands the successor runner an unambiguous one-way warning.
