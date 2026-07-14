# Structure — T-082-01-02 cast-settle-cap-detection

## Change inventory

Four ticket-owned source files are modified:

1. `src/engine/cast-core.ts`
2. `src/engine/cast-core.test.ts`
3. `src/engine/cast.ts`
4. `src/engine/cast.test.ts`

No source file is created or deleted. No run-log, executor-adapter, play, lane-heat, capacity,
budget, wallet, CLI, dispatch, or persisted ledger file changes.

## Module boundary

The implementation follows the repository's pure-core / impure-shell split:

```text
terminal ResultMessage (plain external value)
                  |
                  v
src/engine/cast-core.ts
  classifyCapWindowExhaustion(result)
                  |
         CapWindowExhausted | undefined
                  |
                  v
src/engine/cast.ts final settlement append
                  |
                  v
src/log/run-log.ts existing normalization + JSONL write
```

`cast-core.ts` owns the evidence judgment. `cast.ts` owns when to invoke it and the filesystem
append. `run-log.ts` continues to own only structural normalization and serialization.

## `src/engine/cast-core.ts`

### Import adjustment

Extend type-only imports to include:

```ts
import type { ExecutorProbeResult, ResultMessage } from "../executor/executor.ts";
import type {
  CapWindowExhausted,
  CrossVendorVerdict,
  GateResult as LogGate,
  RunOutcome,
} from "../log/run-log.ts";
```

No new runtime import is introduced. `ResultMessage` and `CapWindowExhausted` erase at compile time.

### Public helper

Add one exported function near the other executor-result projections (`resolveLoggedModel`,
`resolveTurnsUsed`):

```ts
export function classifyCapWindowExhaustion(
  result: ResultMessage | null,
): CapWindowExhausted | undefined;
```

Input:

- the terminal result returned by `Executor.dispense`;
- `null` for no terminal result.

Output:

- a fresh complete marker with controlled strings; or
- `undefined`, meaning no durable cap fact was proven.

### Stable constants

Keep marker vocabulary single-sourced as module constants:

```ts
const HTTP_429_CAP_MARKER = Object.freeze({
  signal: "http-429",
  reason: "executor terminal failure reported HTTP 429 at settlement",
});

const RATE_LIMIT_CAP_MARKER = Object.freeze({
  signal: "rate-limit",
  reason: "executor terminal failure reported rate-limit exhaustion at settlement",
});
```

The public helper returns fresh objects (or safe readonly constants if tests do not mutate); no raw
message is copied into the ledger.

### Private evidence helpers

Use the existing private `isRecord` predicate for non-null, non-array objects.

Add small private functions:

- `field(record, key): unknown`
  - reads one named property;
  - catches an exceptional getter and returns `undefined`;
- `isTerminalFailure(result): boolean`
  - true for string subtype beginning with `error` or `is_error === true`;
- `is429(value): boolean`
  - true only for numeric 429 or trimmed string `"429"`;
- `structured429(result): boolean`
  - checks `status`, `statusCode`, and `code` at top level and on an object-valued `error`;
- `diagnosticStrings(result): readonly string[]`
  - extracts only bounded diagnostic text fields;
  - tolerates missing, malformed, array, object, and exceptional values;
- `hasHttp429Text(text): boolean`
  - recognizes explicit HTTP-status phrasing;
- `hasRateLimitText(text): boolean`
  - recognizes explicit rate-limit / too-many-requests / hit-your-limit / usage-or-quota
    exhausted wording.

The extraction path is intentionally shallow and named. It does not recurse through arbitrary
model output or telemetry.

### Decision order

The helper body is structured as:

```ts
if (result === null || !isTerminalFailure(result)) return undefined;

const diagnostics = diagnosticStrings(result);
if (structured429(result) || diagnostics.some(hasHttp429Text)) {
  return { ...HTTP_429_CAP_MARKER };
}
if (diagnostics.some(hasRateLimitText)) {
  return { ...RATE_LIMIT_CAP_MARKER };
}
return undefined;
```

HTTP 429 wins over the broader textual category.

### Existing functions unchanged

- `classify` retains its current outcome ordering and input contract.
- `accumulateCastProgress` continues to ignore `rate_limit_event` for spend/turn purposes.
- `resolveTurnsUsed`, `resolveLoggedModel`, and `resolveSeatOfExecution` are unchanged.
- No stream interception or reroute state is added.

## `src/engine/cast-core.test.ts`

### Import adjustment

Add `classifyCapWindowExhaustion` to the named import from `./cast-core.ts`.
Use the existing `ResultMessage` or open-record structural typing; no impure module import.

### New describe block

Add:

```ts
describe("classifyCapWindowExhaustion — terminal executor evidence", () => {
  // focused branches
});
```

Place it near the result-projection tests, before progress formatting or near `resolveTurnsUsed`.

### Cases

The block contains independent tests for:

1. numeric top-level status 429;
2. nested error status/code 429;
3. `HTTP 429 Too Many Requests` diagnostic text;
4. explicit `rate_limit_exceeded` subtype or message;
5. common `You've hit your limit` terminal error text;
6. mixed HTTP/text evidence choosing `http-429`;
7. ordinary `error_during_execution` returning absence;
8. `error_max_turns` returning absence;
9. successful output discussing 429 returning absence;
10. null and malformed diagnostic fields returning absence without throw.

Assertions pin exact `signal` and `reason` strings, not only presence.

## `src/engine/cast.ts`

### Pure helper import

Add `classifyCapWindowExhaustion` to the existing import list from `./cast-core.ts`.

### Settlement value

After terminal result facts are complete, derive one immutable value:

```ts
const capWindowExhausted = classifyCapWindowExhaustion(result);
```

Place it with `loggedModel`, `turnsUsed`, `executorReportedTurns`, `usage`, and `costUsd`, before
effect/settlement logic. This is after dispense has settled and before the final append.

The value is not updated by gates, effects, cross-review, or presentation. It records only executor
terminal evidence.

### Final append

Immediately after the existing `seatOfExecution` spread, add:

```ts
// One-way provider-window evidence classified only from the terminal failure at settlement.
...(capWindowExhausted !== undefined ? { capWindowExhausted } : {}),
```

This ordering matches `RunRecordInput`/`RunRecord` canonical ordering in `run-log.ts`.

### Unchanged control flow

- preflight probe behavior is unchanged;
- timeout behavior is unchanged;
- plain rejected dispense behavior is unchanged;
- result parsing/gating/effect behavior is unchanged;
- terminal outcome is unchanged;
- exception/rethrow behavior is unchanged;
- one final append remains one final append.

## `src/engine/cast.test.ts`

### Fixture helper

Add a small local executor constructor for terminal failure records, or define the two executors
inline. It must:

- use id `claude` for known-seat proof;
- return `{ ok: true }` from `probe`;
- return a failure-shaped `ResultMessage` from `dispense`;
- optionally invoke `onMessage` with that result so transcript behavior remains realistic;
- avoid network/process/model calls.

The fixture result includes deterministic:

- subtype;
- result/error evidence;
- usage;
- cost;
- model.

### Acceptance test: marked failure

Add a test named for `T-082-01-02 AC` that:

1. creates a temp root and explicit `runs.jsonl` path;
2. casts `echoPlay` through a 429-shaped terminal failure executor;
3. reads the file without discarding physical-line evidence;
4. asserts exactly one non-empty JSONL line;
5. asserts `seatOfExecution === "claude"`;
6. asserts exact complete `capWindowExhausted` value;
7. asserts the marker appears after `seatOfExecution` in raw serialized bytes;
8. asserts `reviveRecord` preserves it.

The test may assert existing summary/outcome facts only to document that marker classification did
not rewrite them.

### Acceptance test: ordinary failure control

Add a neighboring test that:

1. uses the same fixture route with non-rate failure evidence;
2. asserts exactly one JSONL row;
3. asserts no raw or revived `capWindowExhausted` property;
4. builds a manual expected object literal in existing canonical key order;
5. uses the actual `startedAt` and `endedAt` strings from the row;
6. compares the entire raw file bytes to `${JSON.stringify(expected)}\n`.

The manual expected row includes only the fields current `castPlay` already emits on this path:

```text
v, runId, play, epic, model, outcome, usage, costUsd, gateResults,
envelope, project, turnsUsed, seatOfExecution, startedAt, endedAt
```

If the fixture invokes one result message but no assistant record, `turnsUsed` remains 0.

### Test isolation

- use the existing `tmp()` cleanup registry;
- use unique `runId` and subject values;
- do not mutate process environment;
- do not rely on wall-clock values except reusing the actual timestamps in expected bytes;
- do not add a live-provider test.

## Commit unit

The four files form one meaningful ticket-owned unit because the shell wiring cannot compile or
meet acceptance without the pure classifier and both test faces.

After focused and full gates are green, commit exactly:

```text
src/engine/cast-core.ts
src/engine/cast-core.test.ts
src/engine/cast.ts
src/engine/cast.test.ts
```

through one `lisa commit-ticket` call. Attempt artifacts remain private and are not included.

## Structural acceptance map

| Acceptance fact | Owning structure |
|---|---|
| rate-limit-shaped terminal failure recognized | `classifyCapWindowExhaustion` |
| pure and executor-neutral judgment | `cast-core.ts` + focused unit tests |
| exactly one ledger row | existing `cast.ts` final append + cast test |
| complete marker | controlled helper result + existing run-log normalizer |
| marker beside execution seat | adjacent conditional spreads + raw-byte assertion |
| ordinary failure has no marker | helper negative branch + cast control |
| ordinary record bytes unchanged | manual full JSONL expected bytes |
| no mid-run interception | no `onMessage` classification/state changes |
| no schema/policy scope creep | unchanged files outside four-file inventory |
