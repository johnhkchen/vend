# Structure — T-080-01-02 recorder refusal leaves trace

## Change map

One production seam unit changes across five tracked files:

1. `src/seam/lisa-loop-settled-core.ts` — pure trace contract.
2. `src/seam/lisa-loop-settled-core.test.ts` — serializer/validation proof.
3. `src/seam/lisa-loop-settled.ts` — append effect and nonthrowing outcomes.
4. `src/seam/lisa-loop-settled.test.ts` — filesystem, failure, and ignore proof.
5. `docs/knowledge/lisa-loop-settled-contract.md` — durable producer/consumer agreement.

No file is created or deleted in tracked source. The runtime creates a gitignored JSONL file only
when a recorder failure occurs.

## Runtime state layout

```text
<project>/
└── .vend/
    ├── loop-settled.json                       successful pending singleton (existing)
    ├── loop-settled.json.<pid>.<uuid>.tmp      transient atomic-write sibling (existing)
    └── lisa-loop-settled-failures.jsonl        append-only failure trace (new)
```

The marker and trace share Vend-owned state but have distinct lifecycles:

- success atomically replaces the singleton marker;
- refusal/failure appends one immutable trace line;
- success does not clear or append the failure log;
- T-080-01-03 later decides visibility from trace/claim freshness.

## `src/seam/lisa-loop-settled-core.ts`

### New exported constant

```ts
export const DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH =
  ".vend/lisa-loop-settled-failures.jsonl" as const;
```

Place it beside `DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH`. The exported literal type lets recorder,
tests, docs, and the later settle consumer share an exact path.

### New exported value interface

```ts
export interface LisaLoopSettledFailure {
  readonly timestamp: string;
  readonly reason: string;
}
```

This is independent of `LisaLoopSettledMarker`. A failure is not a malformed marker variant and
must never enter the marker parser.

### New private validation helpers

Add a canonical timestamp predicate near existing scalar validators:

```ts
function isCanonicalIsoTimestamp(value: unknown): value is string
```

It must:

- require a string;
- parse with `Date.parse`;
- reject `NaN`;
- compare `new Date(parsed).toISOString()` with the original string.

Reuse `isNonEmptyString` for reason admission. It checks trimmed non-emptiness without modifying
the original text.

### New exported serializer

```ts
export function serializeLisaLoopSettledFailure(
  failure: LisaLoopSettledFailure,
): string
```

Behavior:

1. validate canonical timestamp;
2. validate nonblank reason;
3. construct a fresh object in `timestamp`, `reason` order;
4. JSON stringify it;
5. add exactly one final newline.

Invalid typed calls throw `TypeError`, matching `buildLisaLoopSettledMarker`'s programmer-boundary
convention. JSON escaping, rather than text replacement, preserves exact reason content.

### Unchanged core areas

- Marker version and marker key sets.
- Marker build/revive/parse/serialize behavior.
- Lisa event classifier policy and reason strings.
- Optional duration behavior from T-080-01-01.

## `src/seam/lisa-loop-settled-core.test.ts`

### Imports

Add `serializeLisaLoopSettledFailure`.

### New describe block

Add `describe("serializeLisaLoopSettledFailure", ...)` adjacent to marker serialization tests.

Cases:

1. canonical record serializes to exact compact JSON plus newline;
2. parsed bytes equal the timestamp/reason object;
3. a reason containing newline/tab remains one physical JSONL record;
4. JSON parse recovers those control characters verbatim;
5. invalid date text throws `TypeError`;
6. a parseable but noncanonical offset timestamp throws;
7. blank reason throws.

No parser is added in this ticket. The later consumer will own external-line parsing and malformed
log policy; this ticket pins producer bytes.

## `src/seam/lisa-loop-settled.ts`

### Imports

- Add `appendFile` to `node:fs/promises`.
- Add `isAbsolute` to `node:path`.
- Import the new failure-log path and serializer from the pure core.

### Result union

Extend `RecordLisaLoopSettledResult` with:

```ts
| {
    readonly kind: "failed";
    readonly reason: string;
    readonly traceError?: string;
  }
```

Widen the existing refused variant with optional `traceError` only for the pathological case where
the trace append itself cannot complete. Successful trace writes preserve the existing exact
`{kind, reason}` shape. Ignored and recorded variants remain unchanged.

### Options interface

```ts
export interface RecordLisaLoopSettledOptions {
  readonly root?: string;
  readonly now?: () => Date;
}
```

`root` is the trusted working-root fallback. `now` is the clock seam. Neither changes authored
playbook or CLI configuration.

### Private thrown-value helper

```ts
function errorMessage(error: unknown): string
```

Return `error.message` for `Error`, otherwise `String(error)`.

### Private trace-root helper

```ts
function failureRoot(input, options): string
```

Return `input.projectRoot` only when it is present and absolute; otherwise return
`options.root ?? process.cwd()`.

### Private append helper

```ts
async function appendFailureTrace(
  root: string,
  reason: string,
  now: () => Date,
): Promise<string | null>
```

It resolves the exported relative path, creates its parent recursively, serializes one record, and
calls `appendFile` once with UTF-8 text. It catches all failures and returns a diagnostic string;
`null` means the append succeeded.

The helper deliberately returns rather than throws so expected recorder paths remain contained.

### Refusal branch

After classification:

```text
ignored  ──► return unchanged
refused  ──► append once at failureRoot ──► return refused (+ traceError only if append failed)
complete ──► marker publication
```

The original classifier reason is passed directly to the trace serializer.

### Marker publication branch

Keep stable/temporary path derivation and atomic rename. Reshape control flow to one `try/catch`:

1. create marker directory;
2. write unique temporary bytes;
3. rename to stable path;
4. return recorded result;
5. on any error, remove temporary best-effort;
6. construct `marker write failed: <detail>`;
7. append exactly once beneath the validated project root;
8. return failed result (+ `traceError` only if append failed).

Because the marker and trace share the parent, a test failure must target the stable marker entry,
not make the whole `.vend/` directory unwritable.

### Main branch

- `refused`: preserve existing stderr prefix and exit code 1.
- `failed`: print `lisa loop-settled <reason>` and exit code 1.
- if either carries `traceError`, append a stderr clause identifying trace failure.
- `recorded`/`ignored`: no error status.
- retain a final outer catch for unexpected programmer/runtime faults.

The process exit policy is distinct from throwing: expected failure calls resolve as data, then the
CLI intentionally signals unsuccessful recording to the shell hook.

## `src/seam/lisa-loop-settled.test.ts`

### Imports

- Import the new failure-log path.
- Existing filesystem imports already cover directory creation/read/listing.
- Add no process-global cwd mutation.

### Shared fixtures

Add fixed timestamps:

```ts
const FIRST_FAILURE_AT = new Date("2026-07-13T20:00:00.000Z");
const SECOND_FAILURE_AT = new Date("2026-07-13T20:01:00.000Z");
```

Add a small `readFailureLines(root)` helper that reads the trace and parses each nonempty JSON line
for assertions. The helper is test-only and can return inferred plain objects.

### Success test extension

After recording an untracked-duration complete event, assert the trace path does not exist. Existing
marker and Vend-only path assertions remain.

### Replace mixed no-write test

Split current ignored/refused behavior:

- ignored attention returns ignored and leaves root empty;
- refusal trace test calls relative-project and nonnumeric-ticket cases sequentially.

For relative project, pass `options.root = root` and a fixed clock. Assert one line after the call.
For nonnumeric tickets, pass absolute `projectRoot = root`, a second fixed clock, and assert two
total lines. Assert exact reasons and timestamps in order. Both awaited calls must resolve to
`kind: "refused"`.

### Forced marker-write failure test

1. create temporary root;
2. create `.vend/loop-settled.json` as a directory;
3. call the recorder with otherwise-valid event and fixed clock;
4. assert resolved `kind: "failed"`;
5. assert reason starts with `marker write failed:`;
6. read trace and assert exactly one record with fixed timestamp and same result reason;
7. list `.vend/` and assert no `.tmp` sibling remains;
8. clean root.

This forces atomic rename failure while leaving log append writable.

### Ignore-contract test

Run:

```text
git check-ignore .vend/lisa-loop-settled-failures.jsonl
```

from the repository root. Assert exit code zero and stdout equals the exported path. This makes the
existing `.gitignore` rule executable acceptance evidence without modifying it.

### Existing tests retained

- later completion replaces pending marker;
- real project-owned hook records, settles, and consumes successful provenance.

## `docs/knowledge/lisa-loop-settled-contract.md`

### Producer lifecycle

Expand refusal/write-failure steps:

- refused complete facts append failure record and create no marker;
- marker publication failure removes temporary state best-effort and appends one record;
- ignored and successful events append no record;
- recorder returns failure status while the hook contains it.

### New failure-trace section

Document exact path and canonical example. State:

- JSONL, exact timestamp/reason keys;
- timestamp minted by Vend at observation of recorder failure;
- classifier reason preserved;
- marker-write category retains underlying detail;
- absolute project root preferred, cwd fallback for invalid project root;
- append-only, local, gitignored;
- later settle consumption is separate.

### One-way authority and exclusions

Add trace to Vend-owned state. Explicitly retain no hook edit, retry, queue, network dependency, or
guaranteed logging when the process/filesystem cannot write.

## Dependency direction

```text
lisa-loop-settled-core.ts
  ├── marker schema/classification (existing)
  └── failure path + serialization (new, pure)
               ▲
               │ imports
lisa-loop-settled.ts
  ├── clock/root choice
  ├── marker atomic write
  └── failure append containment
               ▲
               │ invoked by unchanged shell hook
.lisa/hooks/on-notify
```

T-080-01-03 may import the exported path and define external log parsing in settle's pure/effect
boundary. No reverse import from seam into settle is introduced here.

## Implementation order

1. Add and test pure trace contract.
2. Add recorder options, root choice, and safe append.
3. Reshape refusal and publication failure control flow.
4. Add effect tests for refusal, forced failure, success silence, and Git ignore.
5. Update durable contract.
6. Run focused tests, build, diff checks, and full gate.
7. Commit all five exact paths as one meaningful source unit.

## Unchanged files

- `.gitignore` — existing `.vend/*` rule already covers runtime trace.
- `.lisa/hooks/on-notify` — story excludes hook edits.
- `src/seam/fixtures/lisa-loop-settled.valid.json` — marker schema unchanged.
- `src/settle/settle-core.ts` — dependent consumer ticket owns trace interpretation.
- `src/settle/settle.ts` — dependent consumer ticket owns cord rendering/freshness.
- All ticket/story/provenance files — Lisa-owned transitions remain untouched.

## Commit boundary

One `lisa commit-ticket` transaction includes only the five tracked paths in the change map. The
attempt-private RDSPI files remain outside Git source commits. Post-commit status must show no
ticket-owned modified/untracked paths; only Lisa/concurrent state may remain.
