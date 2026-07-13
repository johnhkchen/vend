# Design — T-074-01-03

## Decision summary

Resolve the exact executor instance once, call its required shallow `probe()` before prompt render
or transcript setup, and route a non-ok result through a new pure cast-core classifier branch.

The classifier will treat executor unreachability as the highest-priority pre-dispense terminal
state and return the existing `missing-capability` verdict with materialization forbidden.

The impure shell will render the probe's reason and hint, append one zero-spend record, and return
immediately. A successful probe will fall through to the existing cast pipeline unchanged.

## Pure decision shape

Extend `ClassifyInput` with an optional executor-probe fact:

```ts
readonly executorProbe?: ExecutorProbeResult;
```

`classify` will check this fact before timeout, gate, and budget state:

```ts
if (i.executorProbe?.ok === false) {
  return { outcome: "missing-capability", materialize: false, gateLog: [] };
}
```

Optionality preserves source compatibility for existing classifier callers and fixtures. Absence
means that no executor capability decision is participating in that classification call.

An ok probe is inert. It does not change timeout/gate/budget precedence or any returned bytes.

The failure branch has no gate rows because executor reachability is a cast precondition, not a
play quality gate.

The probe result remains available to the impure shell for human detail rendering; the generic
`Verdict` does not absorb executor-specific prose.

## Why classify in the existing core

The ticket explicitly requires a cast-core classifier case. The terminal outcome and
materialization authorization are judgment, so they belong in the pure core rather than being
literalized only in the effect shell.

Adding a separate `classifyExecutorProbe` helper was considered. It would be pure, but it would
create a parallel terminal-outcome classifier and make the shell arbitrate between two verdict
types. The existing `classify` already owns terminal outcome priority.

Adding a boolean such as `executorReachable` was rejected because it would discard the structured
boundary result and invite a second source of truth. Passing `ExecutorProbeResult` keeps the core
coupled only to the executor-neutral interface contract.

Adding reason/hint fields to `Verdict` was rejected. Those strings are display details rather than
terminal settlement facts, and existing timeout/gate/budget branches have their own detail sources.

## Cast ordering

Keep required-MCP resolution first. It is already an established missing-capability gate and can
refuse without selecting or touching an executor.

After tools resolve successfully:

1. Resolve the exact executor instance using current precedence.
2. Resolve its accounting seat from its stable id.
3. Await `executor.probe()`.
4. Classify the probe result with otherwise empty terminal facts.
5. On non-ok, surface and append the refusal, then return.
6. On ok, continue with tool flags, render, transcript setup, and dispense.

The executor is not resolved a second time. The probed object is the object later dispensed.

Moving executor resolution earlier is behaviorally inert: selection is synchronous, and no output
or persistence occurs merely from construction. It is necessary to probe before render/transcript.

Seat resolution also moves with the executor so a known active lane can be recorded on the refusal.
This is honest provenance: the executor instance was selected and probed even though no usage was
burned. Unknown ids remain omitted under the existing mapper.

## Andon surface

The stdout line will follow the established prefix:

```text
· andon: missing-capability — executor '<id>' unreachable: <reason> — <hint>
```

Both result strings are trimmed before joining.

If a malformed non-ok result omits or blanks `reason`, use a stable executor-neutral fallback that
names the selected executor as unavailable.

If it omits or blanks `hint`, use a stable repair fallback directing the caller to check local
configuration, authentication, and reachability.

The production built-ins already return named, actionable language. Fallbacks keep the cast shell
total over the intentionally permissive shared type.

The line contains no thrown stack. `probe()` implementations already convert expected reader
failures to returned data; cast consumes that data directly.

## Durable refusal record

Mirror the existing required-MCP early-return record:

- same run id, play, subject, model fallback, envelope, project, intervention bit, and timestamps;
- `outcome: "missing-capability"`;
- `usage: {}`;
- `costUsd: 0`;
- `gateResults: []`;
- known `seatOfExecution` when the executor id maps to a lane.

The current run-log schema does not have cause/hint fields, and this ticket/story explicitly owns
cast files rather than the ledger schema. The cause and hint therefore live on the named cast-time
andon surface, while the ledger counts the refusal outcome and zero spend exactly as the existing
missing-capability path does.

The early branch calls `appendRunLog` once and returns before transcript setup, dispense, effect,
cross-review, and the ordinary terminal append. This structurally guarantees one record.

`RunSummary.actuals` uses the existing early-refusal convention: empty usage and elapsed wall time.

## Passing path compatibility

An ok probe writes nothing and changes no cast data.

The prompt is rendered with the same inputs.

The transcript path and stream sink are created in the same form.

The same executor instance receives the same `DispenseOptions` fields.

The post-dispense classification will receive the successful probe fact; its success branch is
specified as inert, so timeout, gate, budget, materialization, cross-review, logging, and summary
behavior remain unchanged.

No executor selector precedence, environment variable, model selection, timeout, or budget logic
changes.

## Error policy

A returned non-ok probe is an expected missing capability and becomes an amber andon.

The shared executor implementations promise to degrade environmental probe failures to returned
data. This ticket does not add a broad catch around programming errors thrown in violation of that
boundary; swallowing arbitrary exceptions would hide defects and exceed the contract.

`dispense()` behavior remains unchanged. A non-timeout dispense failure after a successful shallow
probe still propagates because a shallow probe cannot prove all live execution conditions.

No retry, alternate executor fallback, sandbox escape, credential mutation, or live login is added.

## Tests

Add a `cast-core.test.ts` classifier case with a non-ok `ExecutorProbeResult`. Assert:

- `outcome` is `missing-capability`;
- `materialize` is false;
- `gateLog` is empty;
- no over-envelope marker exists;
- the pre-dispense refusal outranks fabricated timeout/gate/budget facts.

Add a passing-probe assertion to an existing classifier success or priority case so inertness is
explicit.

Add a `cast.test.ts` integration case using an injected executor whose probe returns a stable reason
and hint and whose `dispense` increments a counter or throws if called. Assert:

- stdout contains the selected executor id, exact reason, and exact hint;
- the returned summary is missing-capability and not materialized;
- actual usage is empty;
- dispense and effect were never called;
- no transcript was created;
- exactly one run-log line exists;
- persisted outcome is missing-capability, normalized usage is all zero, cost is zero, and gate
  results are empty.

Retain the existing successful stub cast as the passing-probe regression oracle. Its expected
summary and run record should require no changes beyond the probe actually being invoked.

## Rejected alternatives

### Catch dispense launch errors and relabel them

Rejected. It reacts after the failure, cannot reliably distinguish capability failures from bugs,
and misses the newly established zero-token probe boundary.

### Reuse `vend doctor` from cast

Rejected. Doctor checks unrelated dependencies and owns report/exit-code concerns. Cast needs only
the selected executor's boundary method.

### Perform the probe inside `executorFor`

Rejected. Selection is synchronous policy; probing is asynchronous environmental I/O. Combining
them would change every selector caller and blur construction with readiness.

### Store cause/hint in run-log gate rows

Rejected. Executor dispensability is not an authored play gate. Fabricating a failed gate row would
pollute gate evidence and misrepresent the existing ledger model.

### Add new run-log schema fields

Rejected for this slice. It expands ownership into `src/log`, changes persistence compatibility,
and contradicts the story's disjoint-file wave rationale. The existing outcome already makes the
andon countable; cast stdout carries the named repair details.

## Acceptance mapping

- Non-ok probe refusal: pure classifier branch plus early cast branch.
- `missing-capability` summary: existing `RunSummary` shape populated by the early return.
- Nothing materialized/dispensed: branch occurs before render, transcript, dispense, and effect.
- Exactly one zero-spend record: direct append followed by immediate return.
- Named cause and hint/no raw stack: structured probe data rendered on stdout.
- Passing executor unchanged: ok probe is classifier-inert and falls into the established pipeline.
- Required tests: focused pure classifier test and effect-shell integration proof.
