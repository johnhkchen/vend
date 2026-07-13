# Structure — T-074-01-03

## Change set

Ticket-owned production and test changes are limited to four files:

- modify `src/engine/cast-core.ts`;
- modify `src/engine/cast-core.test.ts`;
- modify `src/engine/cast.ts`;
- modify `src/engine/cast.test.ts`.

No files are created or deleted under `src/`.

No executor, doctor, log, budget, shelf, funding, CLI, or configuration module changes.

Attempt phase artifacts remain under `.lisa/attempts/T-074-01-03/1/work/` and are not source
commit inputs.

## `src/engine/cast-core.ts`

### Import boundary

Add a type-only import of `ExecutorProbeResult` from `src/executor/executor.ts`.

The import is erased at runtime under the repository's TypeScript configuration, preserving the
core's effect-free runtime dependency surface.

No value import from an executor implementation is introduced.

### `ClassifyInput`

Add:

```ts
readonly executorProbe?: ExecutorProbeResult;
```

Document the field as the shallow pre-dispense result and absence as no participating capability
fact.

Keep the existing timeout, budget, and gate fields unchanged.

### `classify`

Insert the non-ok probe branch before timeout classification.

The branch returns:

```ts
{
  outcome: "missing-capability",
  materialize: false,
  gateLog: [],
}
```

It does not derive gate rows from an unrelated gate verdict because the executor refusal happens
before play gates run.

Successful or absent probes proceed through the existing branch order unchanged.

No new exported verdict type or outcome literal is introduced.

## `src/engine/cast-core.test.ts`

Add a focused test inside the existing `classify` describe block.

The fixture supplies a non-ok result with representative executor-unreachable reason and hint.

Use conflicting downstream facts—timeout, exhausted budget, and a stopped gate—to prove the
pre-dispense capability refusal is terminal and does not inherit play gate evidence.

Assert the exact verdict object or all of its stable fields.

Add or adapt one success test to supply `{ ok: true }`, proving the probe does not relabel or block
an otherwise successful clear.

Do not instantiate a real executor, read environment state, or perform async work in this suite.

## `src/engine/cast.ts`

### Type/data inputs

Continue importing `Executor` and `ExecutorTimeoutError` from the shared executor boundary.

No implementation-specific probe types or constants are needed.

### Executor resolution block

Move the existing executor resolution and `resolveSeatOfExecution` block to immediately after the
required-MCP success branch and before tool-flag projection/prompt rendering.

Preserve precedence exactly:

```ts
opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {})
```

The resolved object remains in scope for the later existing `dispense()` call.

Remove the old duplicate resolution block near transcript setup.

### Probe classification block

Await `executor.probe()` once.

Call `classify` with the probe result and neutral post-dispense facts:

```ts
classify({
  executorProbe,
  timedOut: false,
  budgetOutcome: null,
  gateVerdict: null,
})
```

If the verdict is `missing-capability`, prepare display details, append, and return.

The branch should be structurally exhaustive over the only failing probe result; a successful
probe falls through.

### Display detail helper

Add a small private pure formatter near `stopReason` or inline a tightly scoped construction.

Preferred private helper signature:

```ts
function executorProbeReason(
  executorId: string,
  result: ExecutorProbeResult,
): string
```

The helper returns the suffix after `missing-capability —` and:

- includes the executor id;
- includes trimmed reason when present;
- includes trimmed hint when present;
- provides stable reason/hint fallbacks when absent;
- never emits `undefined` or blank detail.

If this helper is added, import `ExecutorProbeResult` as a type in `cast.ts`.

### Early append

Mirror the existing required-MCP append fields and add known execution-seat provenance:

- `runId`;
- play name;
- subject;
- resolved/logged model fallback;
- envelope;
- project;
- optional intervention bit;
- optional `seatOfExecution`;
- missing-capability outcome;
- empty usage;
- zero cost;
- empty gate results;
- start/end timestamps.

Use the caller's run-log path override exactly as the MCP branch does.

Return a `RunSummary` with run id, missing-capability outcome, false materialization, and empty
actual usage plus elapsed wall time.

Do not create a transcript on this path.

### Ordinary classification

Pass the successful `executorProbe` into the existing post-dispense `classify` call.

This makes classifier inertness explicit on the real passing path and avoids treating probe as a
one-off shell-only check.

All later effect, review, log, and summary code remains structurally unchanged.

## `src/engine/cast.test.ts`

### Fixture additions

Add a dedicated failing executor fixture locally in the new test or a small helper next to
`stubExecutor`.

Track:

- probe invocation count;
- dispense invocation count;
- effect log.

The probe returns:

```ts
{
  ok: false,
  reason: "claude config store/Keychain is unreadable",
  hint: "run `claude login`; grant the sandbox access to the Keychain",
}
```

`dispense()` should increment the counter and throw defensively so an accidental call fails the
test immediately.

### Integration test

Use `captureStdout`, a temp root, explicit run-log path, and explicit known executor id.

Assert returned summary fields and zero usage.

Assert probe exactly once, dispense zero, and effect zero.

Assert stdout contains one missing-capability andon with executor id, reason, and hint and no
stack-oriented `Error:` line.

Assert transcript directory/path is absent.

Read the run log and assert exactly one non-empty line.

Parse the line and assert outcome, normalized zero usage, zero cost, empty gate results, and known
execution seat.

### Passing regression

Keep the existing successful stub executor test and its summary/ledger assertions.

Optionally count successful probe calls if the fixture change is minimal; otherwise the existing
fact that its `dispense()` succeeds after its implemented ok probe is sufficient end-to-end proof.

No real probe command, network request, executor subprocess, or token spend occurs in tests.

## Module boundary after change

```text
Executor.probe() returned data
          |
          v
cast-core.classify() -- pure terminal outcome/materialization decision
          |
          v
castPlay() -- stdout + one JSONL append + early RunSummary
```

On success:

```text
Executor.probe() { ok: true }
          |
          v
existing render -> transcript -> dispense -> meter -> parse -> gates -> effect -> log
```

The executor implementation owns environmental fact gathering.

The core owns terminal outcome judgment.

The cast shell owns ordering, human output, persistence, and returned actuals.

The log module remains a passive sink with no executor dependency.

## Change ordering

1. Add the classifier contract/test, producing the expected focused red failure.
2. Implement the pure classifier branch and rerun the focused core test.
3. Add the integration refusal test, producing the expected cast-path red failure.
4. Move executor resolution, call probe, and add the early andon branch.
5. Run both affected suites.
6. Run typecheck/full repository gate.
7. Commit the four exact source/test paths through Lisa.

## Compatibility checks

The only public type expansion is an optional classifier input field.

`RunSummary`, `RunOutcome`, `RunRecord`, `Executor`, and `CastOptions` shapes remain unchanged.

Existing fake executors already satisfy the required probe contract due to the dependency ticket.

No new package dependency, environment variable, persisted schema version, or generated file.

The passing cast's dispense argument construction remains in its current source block and retains
field order/object spread behavior.

## Explicit non-changes

- no doctor report/check changes;
- no executor implementation or probe classifier changes;
- no credential or Keychain access changes;
- no catching/relabeling of arbitrary dispense errors;
- no budget, cost, timeout, max-turn, or funding changes;
- no alternate-executor fallback;
- no run-log cause/hint schema;
- no CLI exit behavior changes;
- no ticket frontmatter edits.
