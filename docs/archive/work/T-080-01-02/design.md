# Design — T-080-01-02 recorder refusal leaves trace

## Decision summary

Add a closed, append-only JSONL failure trace at
`.vend/lisa-loop-settled-failures.jsonl`. Each physical line has exactly two fields in stable order:
`timestamp` and `reason`. The pure seam core will own the path, value validation, and deterministic
serializer. The recorder effect will own the clock, root selection, directory creation, and append.

`recordLisaLoopSettled` will contain both classified refusals and marker-publication errors. It will
append exactly one trace record for either case and return named result data instead of rejecting.
Ignored events and successfully recorded events append nothing. Production will still set a
nonzero recorder process status for refusal/failure, preserving the unchanged hook rule that settle
runs only after a successful marker publication. The hook itself continues to contain that status
and always returns control to Lisa.

For trace location, a syntactically absolute `LISA_PROJECT` is preferred even when another field
causes refusal. If the project value itself is unusable, the recorder falls back to its working
root, which defaults to `process.cwd()`. Tests inject both the working root and clock without global
process mutation.

## Goals

- Leave one durable local record for every classified complete-event refusal.
- Leave one durable local record for every marker publication failure.
- Preserve the exact classifier reason for later user-visible rendering.
- Preserve useful underlying filesystem error detail.
- Guarantee one physical append record per handled failure.
- Keep the trace gitignored and local-first.
- Ensure the exported recorder resolves to typed data on all tested failure paths.
- Preserve marker atomicity and cleanup.
- Preserve the hook's success-only settle trigger.
- Keep clocks and filesystem effects out of the pure core.
- Establish a deterministic contract that T-080-01-03 can consume.

## Non-goals

- Do not modify `.lisa/hooks/on-notify`.
- Do not change Lisa environment or event semantics.
- Do not retry marker publication.
- Do not queue failed events for later delivery.
- Do not rotate, truncate, or cap the failure log.
- Do not surface the trace in `vend settle` yet.
- Do not compare trace time with settle claim time yet.
- Do not change marker schema v1 or its fixture.
- Do not add network notification behavior.
- Do not make recorder failure block Lisa.

## Option 1 — Print only to stderr

### Advantages

- No new state or format.
- Existing main-shell behavior already prints refusal and thrown-write messages.
- Minimal production change.

### Disadvantages

- The hook redirects recorder stderr to `/dev/null`.
- The failure remains invisible on the actual execution path.
- The next settle has no state to read.
- It fails the explicit durable local trace acceptance.

### Decision

Rejected. This is the silent behavior the ticket exists to remove.

## Option 2 — Write a singleton JSON failure marker

The recorder could atomically replace `.vend/loop-settled-failure.json` with the newest failure.

### Advantages

- Consumer parsing would be simple.
- The latest failure would be available without reading a log tail.
- Atomic replacement matches the successful marker pattern.

### Disadvantages

- The ticket and epic explicitly require an appended reason line/seam log.
- Replacement loses older evidence and makes “each append exactly one” unprovable.
- It creates another atomic publication path with temporary cleanup complexity.
- A log is more honest about repeated failures than a mutable singleton.

### Decision

Rejected. It contradicts the stated append-only trace contract.

## Option 3 — Append delimiter-separated plain text

Examples include `<ISO timestamp> <reason>` or `<ISO>\t<reason>`.

### Advantages

- Human-readable with ordinary shell tools.
- Very small serialization surface.
- Easy to append.

### Disadvantages

- Arbitrary error messages can contain tabs, CR, or LF.
- Sanitizing those characters changes the reason that the later ticket must render verbatim.
- Not sanitizing them can create multiple physical lines for one failure.
- Parsing needs delimiter and escape conventions that are effectively a second serialization
  format.

### Decision

Rejected. The line-count and verbatim-reason requirements conflict under raw delimiters.

## Option 4 — Append two-field JSON Lines

Each record is serialized as:

```json
{"timestamp":"2026-07-13T20:00:00.000Z","reason":"LISA_PROJECT must be an absolute project root"}
```

### Advantages

- One JSON object maps directly to one trace event.
- JSON escaping guarantees embedded newlines remain within one physical line.
- Parsing restores the reason verbatim.
- Stable insertion order makes fixture assertions exact.
- The repository already uses JSONL for local/durable logs.
- The `.jsonl` extension tells future consumers how to parse it.

### Disadvantages

- Slightly more syntax than plain text.
- A future reader must validate parsed objects rather than split a string.
- Append atomicity is bounded to the filesystem's individual append write behavior.

### Decision

Selected. It is the smallest format that simultaneously preserves reason text and one-line
physical records.

## Trace path decision

Use:

```text
.vend/lisa-loop-settled-failures.jsonl
```

The name identifies the producer seam, distinguishes failures from the successful singleton, and
declares the append format. It is more precise than a generic `.vend/seam.log`, which would need a
second discriminator when other seams appear. It is more explicit than `loop-settled.log`, whose
contents could be mistaken for successful loop history.

Export the path from `lisa-loop-settled-core.ts` beside the marker path so producer tests and the
dependent consumer use one authority. The root `.gitignore` rule `.vend/*` covers it. No ignore-file
change is needed; both an automated test and final command will prove the actual Git result.

## Failure record contract

Add a pure value:

```ts
interface LisaLoopSettledFailure {
  readonly timestamp: string;
  readonly reason: string;
}
```

The serializer accepts the typed value and validates runtime facts because external callers can
still bypass TypeScript. Requirements:

- `timestamp` must be the canonical output of `Date#toISOString`;
- invalid dates and merely parseable noncanonical timestamps are rejected;
- `reason` must be a non-empty string after trim checking;
- the original non-empty reason bytes are preserved, including surrounding space and escaped
  control characters;
- serialized key order is `timestamp`, then `reason`;
- exactly one trailing newline terminates the JSON object.

Canonical ISO validation can parse the string and require `new Date(value).toISOString() === value`.
This avoids accepting locale strings or offset variants that complicate downstream time ordering.

## Clock decision

The impure recorder obtains the current time only when it is about to append a failure. It does not
mint a timestamp for ignored or successful events. `RecordLisaLoopSettledOptions` will expose an
optional zero-argument `now` function returning `Date`; production defaults to `new Date()`.

The append helper converts that date through `toISOString` before calling the pure serializer.
Tests supply a fixed date for byte-exact proof. The option exists as an effect seam, not public
runtime configuration; no counter-side gesture is added.

## Trace-root decision

Add an optional `root` to `RecordLisaLoopSettledOptions`. Production defaults it to
`process.cwd()`.

Root selection for failure append is:

1. if `input.projectRoot` is an absolute path, use it;
2. otherwise use `options.root ?? process.cwd()`.

This is intentionally independent of full event classification. A valid absolute project remains
safe as a log home when ticket count or duration is malformed. A relative or missing project is
the reason for refusal, so it is not used as a filesystem target. The fallback corresponds to the
project working directory from which Lisa runs its project-owned hook.

The root option also avoids `process.chdir` in tests, which is global and unsafe under Bun's
parallel test execution.

## Recorder result decision

Retain existing result kinds and add a distinct write-failure variant:

```ts
| { readonly kind: "failed"; readonly reason: string }
```

Classified refusal remains `kind: "refused"` with the classifier's exact reason. Write failure is
`kind: "failed"` and its reason begins `marker write failed: ` followed by the normalized thrown
detail. This lets callers distinguish bad input from a filesystem failure without reading prose.

No trace path/timestamp is required in the public result: the path is a module constant, and the
success criterion is durable append rather than downstream coordination on a returned receipt.

## Marker-publication containment

Wrap the existing marker publication unit in `try/catch` while preserving the unique temporary
file and atomic rename algorithm. On error:

1. best-effort remove the temporary sibling;
2. derive one stable reason string;
3. append one failure record;
4. return `kind: "failed"`.

Do not append separately from both `catch` and `finally`; that risks double records. Cleanup errors
must not replace the original marker-publication reason. A cleanup `.catch(() => undefined)` is
appropriate because the unpublished temporary file is secondary diagnostic debris; the primary
failure trace carries the reason that prevented publication.

Successful publication returns before any append helper is called. The existing atomic replacement
semantics remain unchanged.

## Classified-refusal containment

After classification:

- `ignored` returns immediately with no trace;
- `refused` calls the append helper exactly once and then returns the same outcome;
- `complete` enters marker publication.

The classifier reason is passed unchanged into JSON serialization. The append helper creates the
failure log's parent directory recursively and uses one `appendFile` call for one complete line.

## Trace-write failure policy

A log write can fail for reasons that also prevent marker writing. The recorder cannot promise
durability on an unwritable filesystem. It must nevertheless avoid throwing into its caller under
the ticket's containment requirement.

The append helper's error will be caught at the outer recorder boundary. The result remains refused
or failed, while the main shell can report the trace problem on stderr and exit nonzero. To avoid
inflating the primary public union, an internal safe-append helper returns success/failure data; a
small optional `traceError` field on failure results is unnecessary for the named acceptance and
would complicate consumers. The main shell's stderr is diagnostic only; hook correctness still
rests on its unconditional containment.

Tests deliberately force marker rename failure while keeping `.vend/` appendable. That is the
promised and verifiable failure class. The review will state the unavoidable unwritable-log limit.

## Main-process behavior

The `import.meta.main` branch will await the now-nonthrowing recorder outcome. It will:

- do nothing special for `recorded` or `ignored`;
- print the existing refusal category and set exit code 1 for `refused`;
- print the failure reason and set exit code 1 for `failed`.

An outer catch remains as a final programmer/unexpected guard but is not exercised by expected
input or marker failure. A nonzero recorder exit is required so the unchanged shell hook does not
invoke settle without a marker. The hook itself still exits zero, so Lisa is never blocked.

## Test design

### Pure core

- Serialize the canonical fixed timestamp and relative-project reason byte-for-byte.
- Parse the resulting JSON in the test and compare exact two-field data.
- Prove an embedded newline remains one physical line while JSON recovery preserves it.
- Reject invalid/noncanonical timestamps.
- Reject blank reasons.

### Recorder effect

- Successful complete event writes marker and no failure-log file.
- Ignored event writes neither marker nor failure trace.
- Relative project refusal uses injected working root and appends exactly one record.
- Non-numeric ticket refusal with an absolute project appends exactly one additional record at that
  project root.
- Both calls resolve to `refused`; neither rejects.
- Precreate the stable marker path as a directory to force rename failure.
- Assert the call resolves to `failed` with a marker-write reason.
- Assert exactly one trace record is appended for that call.
- Assert no unique `.tmp` sibling remains.
- Preserve the existing successful replacement and real-hook tests.

### Ignore proof

- Run `git check-ignore` against the exported repository-relative failure path.
- Assert exit zero and exact echoed path.
- Repeat the command manually during final verification for review evidence.

## Documentation decision

Update `docs/knowledge/lisa-loop-settled-contract.md` in the same source unit. Document:

- exact failure-log path;
- JSONL line shape;
- absolute-project versus working-root placement;
- one append for refusal or publication failure;
- no append for ignore/success;
- nonblocking hook/process relationship;
- append-only local, gitignored ownership;
- explicit no-retry/no-delivery-guarantee boundary.

Do not document settle rendering or freshness comparison as implemented; identify it only as the
dependent consumer responsibility.

## Commit strategy

The trace contract, effect behavior, adjacent tests, and durable contract document form one
meaningful ticket-owned unit. Splitting core serialization from effect use would temporarily leave
unused production API; splitting tests/docs would weaken atomic review. Run focused tests, build,
and full gate, then commit exactly:

- `docs/knowledge/lisa-loop-settled-contract.md`;
- `src/seam/lisa-loop-settled-core.ts`;
- `src/seam/lisa-loop-settled-core.test.ts`;
- `src/seam/lisa-loop-settled.ts`;
- `src/seam/lisa-loop-settled.test.ts`.

Attempt-private artifacts are not included; Lisa publishes them separately.

## Risks and controls

- Risk: a rejected relative path controls trace placement.
  Control: use it only if `isAbsolute`, otherwise use the injected/current working root.
- Risk: one error creates multiple log lines.
  Control: one safe-append call at each exclusive result branch and exact line-count tests.
- Risk: an error message creates multiple physical lines.
  Control: JSON string escaping plus embedded-newline coverage.
- Risk: success creates noisy failure state.
  Control: assert log absence after successful marker publication.
- Risk: returning failure as data makes the hook think recording succeeded.
  Control: main maps `refused` and `failed` back to process exit code 1.
- Risk: cleanup hides the original error.
  Control: best-effort cleanup inside the publication catch.
- Risk: trace format drifts before T-080-01-03.
  Control: export path/serializer, pin exact bytes, and update the durable seam contract.
- Risk: `.vend` negation rules accidentally track the log.
  Control: executable `git check-ignore` assertion.
- Risk: concurrent Lisa state enters the commit.
  Control: exact `lisa commit-ticket --include` paths and status checks.

## Honest boundary

The design makes all classifier refusals and ordinary marker publication failures visible when the
local trace directory remains writable. It cannot record a process that never starts or a failure
on a filesystem that also refuses the trace append. It adds visibility, not delivery guarantees.
That boundary matches the parent story and remains materially better than silent stderr discarded
by the hook.
