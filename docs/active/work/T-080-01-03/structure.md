# Structure — T-080-01-03 settle surfaces cord failure

## Change boundary

Five tracked files form one meaningful ticket-owned source unit:

```text
docs/knowledge/lisa-loop-settled-contract.md
src/settle/settle-core.ts
src/settle/settle-core.test.ts
src/settle/settle.ts
src/settle/settle.test.ts
```

No files are created or deleted. No producer, hook, marker fixture, CLI dispatcher, board card,
sweep file, or `.gitignore` entry changes.

## Pure core — `src/settle/settle-core.ts`

### New input boundary

Add exported `SettleCordObservation` near the other settle fact interfaces:

```ts
export interface SettleCordObservation {
  readonly failureTraceContents: string | null;
  readonly failureTraceModifiedAtMs: number | null;
  readonly lastClaimModifiedAtMs: number | null;
}
```

Add `readonly cord: SettleCordObservation` to `ComputeSettleInput`.

This keeps all filesystem-produced values explicit and prevents `computeSettleVerdict` from
consulting the world.

### Verdict extension

Add to `SettleVerdict`, immediately after loop provenance:

```ts
readonly cordFailureReason: string | null;
```

This places the two Lisa-cord facts together and makes every manually assembled verdict update at
compile time.

### Private trace representation

Add a private interface for a revived record:

```ts
interface LisaLoopSettledFailureRecord {
  readonly timestamp: string;
  readonly reason: string;
}
```

No new public producer schema is required.

### Pure helpers

Add:

- canonical ISO timestamp predicate;
- `reviveLisaLoopSettledFailureLine(line)`;
- `latestLisaLoopSettledFailure(contents)`;
- finite nonnegative mtime predicate;
- exported or private `cordFailureReason(observation)` decision helper.

The decision helper returns null when:

- trace contents are absent;
- trace mtime is absent/invalid;
- no valid record exists;
- a valid claim watermark is greater than or equal to trace mtime.

It returns the selected record's original reason otherwise.

### Verdict assembly

Within `computeSettleVerdict`:

1. preserve loop-marker parse/refusal first;
2. preserve last-settle parse/refusal second;
3. preserve gate/presweep/review copying;
4. compute `cordFailureReason` from `input.cord`;
5. return it beside `loop`;
6. leave every continuation and exception calculation unchanged.

## Pure core tests — `src/settle/settle-core.test.ts`

### Imports and default fixture

- Import the decision helper if exported for focused assertions.
- Extend `input()` with a no-trace/no-claim default observation.
- Existing tests should remain behaviorally unchanged and expect null where useful.

### New decision matrix

Add one describe block for cord trace selection and freshness:

- exact valid record + absent claim;
- exact valid record + older claim;
- no trace;
- newer claim;
- equal claim;
- malformed newest physical line with valid previous line;
- invalid-only contents;
- reason containing leading/trailing spaces and escaped controls, proving exact preservation.

The trace fixture should use producer-compatible JSON text rather than calling the producer
serializer, so this consumer's schema checking is independently exercised.

### Verdict integration

Add one `computeSettleVerdict` assertion that a fresh trace populates `cordFailureReason` while the
result remains a verdict with ordinary gate/presweep facts. Existing aggregate tests can assert the
default null field.

## Effect shell — `src/settle/settle.ts`

### Imports

- Add `stat` from `node:fs/promises`.
- Import `DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH` beside the existing marker path.
- Import `SettleCordObservation` only if useful for local typing.

### Optional file observation

Replace or supplement `readOptionalText` with:

```ts
interface OptionalFileObservation {
  readonly contents: string;
  readonly modifiedAtMs: number;
}

async function readOptionalFile(path: string): Promise<OptionalFileObservation | null>
```

It reads UTF-8 contents and `stat(path).mtimeMs`; ENOENT returns null and other errors throw.
Existing last-settle use receives `.contents` while its mtime feeds the cord watermark.

### Claimed marker metadata

Extend `ClaimedLoopSettledMarker` with:

```ts
readonly modifiedAtMs: number;
```

After rename, read contents and stat the claimed path. Any read/stat failure follows the existing
restore path. `LoopSettledClaimPaths` remains a pick of stable and claimed paths, so restore does
not depend on metadata.

### Watermark helper

Add a tiny pure-local maximum helper or inline a compact maximum over optional numbers. The values
are:

- `lastSettle?.modifiedAtMs`;
- `loopClaim?.modifiedAtMs`.

No value yields null.

### `runSettle`

Load in parallel:

- graph;
- optional last-settle observation;
- optional failure-trace observation;
- review concerns.

Build `cord` as plain values and pass it to `computeSettleVerdict`. Preserve the rest of the
transaction order exactly.

### Renderer

After the existing loop/none-pending branch, add:

```ts
if (result.cordFailureReason !== null) {
  lines.push(`cord: last recording failed — ${result.cordFailureReason}`);
}
```

Do not use `red`, do not add an exception, and do not change the refusal branch.

## Shell tests — `src/settle/settle.test.ts`

### Imports

- Add `utimes` from `node:fs/promises`.
- Import `DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH`.

### Manual verdict fixture

Add a representative `cordFailureReason` to `completeVerdict()`.

The primary renderer test asserts:

- exact cord text;
- line is not wrapped in ANSI red;
- exception red/reset counts remain three.

The immediate-repeat fixture explicitly sets `cordFailureReason: null` and asserts no `cord:` line.

### Lifecycle fixture helpers

Add a helper to write a two-field failure record beneath the fixture root. Tests can call `utimes`
on last-settle, failure log, and marker paths with deterministic epoch values.

### New lifecycle cases

Case A — fresh failure:

1. create fixture root;
2. run settle once or seed a canonical last-settle marker;
3. write failure JSONL with exact reason;
4. set last-settle mtime older and trace mtime newer;
5. run settle;
6. assert `kind: verdict`, exact `cordFailureReason`, exact rendered line;
7. assert no refusal and the failure log remains byte-identical;
8. run immediate repeat and assert no cord line because last-settle was acknowledged later.

Case B — newer successful claim:

1. create fixture root;
2. write failure log;
3. write valid loop marker;
4. set trace mtime older and marker mtime newer;
5. run settle;
6. assert loop provenance is present;
7. assert `cordFailureReason` null and rendered output has no cord line;
8. assert marker consumption remains correct.

Case C — no log is already covered by the existing valid marker lifecycle; add explicit null/no-line
assertions there.

## Contract documentation

Update only the consumer and executable-contract sections:

- settle reads the newest valid failure record without mutating the log;
- log mtime is compared against the newest prior verdict/current marker claim mtime;
- a strictly newer log yields the exact normal verdict line;
- a newer/equal claim or no valid log yields no line;
- malformed trace records remain non-blocking;
- name settle tests as executable proof.

## Commit boundary

After focused and full gates pass, commit all five paths together through one exact-path Lisa
transaction. The core type, shell wiring, tests, and durable contract form one inseparable behavior
unit; splitting would create transient type or documentation drift.
