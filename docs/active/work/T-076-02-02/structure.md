# T-076-02-02 Structure — ledger line and artifact survive settlement throw

## Change inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/engine/cast.ts` | modify | guard post-effect settlement, reconcile artifact availability, append in `finally`, rethrow original error |
| `src/engine/cast.test.ts` | modify | real-Git non-reviewer settlement throw and artifact discrepancy proof |
| `src/engine/cast-diff.ts` | modify | publish final diff via temporary sibling and atomic rename |
| `src/log/run-log.ts` | modify | define and round-trip optional `artifactDiscrepancy` marker |
| `src/log/run-log.test.ts` | modify | pure marker normalization and compatibility coverage |

No production file is created or deleted.

Attempt-private artifacts are created only under `.lisa/attempts/T-076-02-02/1/work/`.
The ticket file and Lisa provenance remain Lisa-owned and are not included in source commits.

## `src/log/run-log.ts`

### Public data type

Add near other structured optional record markers:

```ts
export interface ArtifactDiscrepancy {
  readonly reference: string;
  readonly reason: string;
}
```

The type is executor-, engine-, and filesystem-neutral. It records facts handed to the ledger and
introduces no dependency from `src/log/` to `src/engine/` or Node filesystem APIs.

### `RunRecordInput`

Add `readonly artifactDiscrepancy?: ArtifactDiscrepancy` adjacent to `capturedDiff`.

Document that it is present only when the cast observed an intended artifact reference but could
not verify the artifact at terminal settlement. Both strings are required as one atomic marker.

### `RunRecord`

Add the same optional field beside `capturedDiff`.

Document:

- complete markers only;
- absence means no discrepancy recorded or historical unknown;
- `reviveRecord` preserves complete values and drops malformed optional metadata;
- the cast shell, not the ledger normalizer, owns mutual exclusion with `capturedDiff`.

### Normalizer

Add beside `normalizeCapturedDiff`:

```ts
function normalizeArtifactDiscrepancy(value: unknown): ArtifactDiscrepancy | undefined
```

Behavior:

- non-object or null → `undefined`;
- missing/empty/non-string `reference` → `undefined`;
- missing/empty/non-string `reason` → `undefined`;
- complete marker → fresh `{ reference, reason }` object;
- unknown nested keys are dropped.

### Build path

In `buildRunRecord`:

1. Normalize `input.artifactDiscrepancy` next to `capturedDiff`.
2. Spread the normalized marker beside the diff field.
3. Preserve current order of all existing keys.

Ordinary rows remain byte-identical because the field is omitted when absent.

### Revive path

In `reviveRecord`:

1. Normalize raw `r.artifactDiscrepancy`.
2. Spread it next to revived `capturedDiff`.
3. Retain all current tolerant read behavior.

No schema-version increment is needed: the ledger already evolves through optional fields under
schema version 1, and historical rows tolerate absence.

## `src/log/run-log.test.ts`

Add a describe block near the existing `capturedDiff` tests:

```text
artifactDiscrepancy — unavailable artifact audit round trip (T-076-02-02 AC)
```

### Complete marker test

- build with reference `.vend/artifacts/run-settlement-error.diff`;
- use reason `captured-diff-unavailable-at-settlement`;
- assert build preserves the exact two-field object;
- serialize and revive;
- assert the marker survives exactly;
- include an extra nested key through a type escape and assert it is dropped.

### Absence and malformed compatibility test

- build an ordinary row and assert no marker key;
- build a partial marker and assert no marker key;
- revive a row whose reason has the wrong type;
- assert the base row survives and the marker is absent;
- assert historical rows do not synthesize the optional field.

These tests pin the pure core without filesystem effects.

## `src/engine/cast-diff.ts`

### Imports

Extend filesystem imports with `rename` and `rm`. Import `randomUUID` from `node:crypto`.
No package dependency is required.

### Publication block

Keep path filtering, Git calls, patch assembly, safe run-id handling, and returned reference
unchanged.

Replace direct final-path write with:

```ts
const temporary = `${destination}.${randomUUID()}.tmp`;
try {
  await writeFile(temporary, patch, "utf8");
  await rename(temporary, destination);
} catch (error) {
  await rm(temporary, { force: true }).catch(() => {});
  throw error;
}
return reference;
```

The directory is created before temporary publication.
Cleanup is best-effort and never replaces the original capture error.
The final destination appears only at rename, with no fallible operation after rename before return.

## `src/engine/cast.ts`

### Imports

Extend the Node filesystem import with `access`.
Import `ArtifactDiscrepancy` as a type from `run-log.ts`.

### Stable primary-execution facts

Immediately after the base `verdict`, derive values needed even if settlement throws:

```ts
const loggedModel = resolveLoggedModel(result?.model, opts.model);
const turnsUsed = resolveTurnsUsed(result?.num_turns);
const usage = (result?.usage ?? {}) as Usage;
const costUsd = typeof result?.total_cost_usd === "number" ? result.total_cost_usd : 0;
```

### Effect boundary

Keep `play.effect(output, ctx)` outside the settlement guard:

```ts
let reported: EffectResult | undefined;
if (verdict.materialize && output !== null) {
  reported = await play.effect(output, ctx);
}
```

An uncontracted effect throw continues to propagate with existing behavior.

### Settlement state

Retain current locals and add:

```ts
let settledVerdict = verdict;
let settlementError: unknown;
let artifactDiscrepancy: ArtifactDiscrepancy | undefined;
let endedAt = "";
```

`outcome` begins at `verdict.outcome` as today.

### Guarded region

Wrap all post-effect work in:

```ts
try {
  // current effect-result projection, diff capture, review, settlement, and presentation
} catch (error) {
  settlementError = error;
  outcome = "errored";
  settledVerdict = { ...settledVerdict, outcome };
} finally {
  // reconcile artifact, stamp end, append row
}
```

The current effect body becomes `if (reported !== undefined)` inside `try`.
The review-specific try/catch remains nested and unchanged.
It handles reviewer dispense/schema failures as `missing-capability` and does not reach the outer
catch.

All current stdout notices remain in their current relative order inside the guarded tail.

### Artifact reconciliation helper

Add a private impure helper near the other shell helpers:

```ts
async function reconcileCapturedDiff(
  root: string,
  reference: string | undefined,
): Promise<{ capturedDiff?: string; artifactDiscrepancy?: ArtifactDiscrepancy }>
```

Behavior:

- absent reference → `{}`;
- `await access(join(root, reference))` succeeds → `{ capturedDiff: reference }`;
- access rejects → discrepancy with the same reference and stable reason
  `captured-diff-unavailable-at-settlement`.

The helper stays in the impure shell. It does not inspect patch contents or infer why access failed.

### Final append

Move the existing ordinary append into `finally` after reconciliation and timestamp.

Keep the record shape and field order, with two changes:

- `capturedDiff` uses only the reconciled available reference;
- `artifactDiscrepancy` is spread adjacent to it.

Use stable `usage` and `costUsd` locals in the append.
The row outcome comes from `outcome`; the outer catch sets `errored`.
Gate rows come from `settledVerdict.gateLog`, retaining any review evidence settled before a later
presentation failure.

### Rethrow and return

Immediately after the guard:

```ts
if (settlementError !== undefined) throw settlementError;
```

Then compute wall time and return the existing summary.
The returned `capturedDiff` is the reconciled available reference.

### Ordering sketch

```text
primary dispense / parse / gate
        |
        v
play.effect  <— outside guard; existing uncontracted throw behavior
        |
        v
try: diff capture → review → settle → render terminal facts
        |                         |
        | throw                   | success
        v                         v
catch: outcome=errored       settled outcome
        \                         /
         v                       v
finally: verify diff → append exactly one terminal row
                         |
                         v
             rethrow original OR return summary
```

## `src/engine/cast.test.ts`

### Registry stimulus

Import `rmSync` from `node:fs`.

Add `disappearingDiffRegistry(root, runId, calls)`. Its `openai-compat` factory:

1. removes `.vend/artifacts/<runId>.diff`;
2. returns a valid reviewer executor that records any dispense call.

Factory invocation occurs after capture and immediately before the production patch read. This
causes real `readFile` to throw without a production test hook.

### Integration test

Add near the current throwing-reviewer test:

```text
castPlay: a non-reviewer settlement throw writes an errored row and records a missing diff discrepancy
```

Setup:

- temporary Git repository;
- explicit run log path;
- stable run id;
- `boardPlanPlay` fixture;
- primary stub executor id `claude`;
- disappearing-diff registry.

Assertions:

- `castPlay` rejects with error code `ENOENT`;
- reviewer dispense was never called;
- exactly one JSONL row exists;
- row outcome is `errored`;
- primary usage, cost, and base gate row survive;
- `capturedDiff` is absent;
- exact discrepancy reference and reason are present;
- `reviveRecord` preserves the discrepancy;
- no cross-vendor verdict or skipped marker was fabricated;
- final artifact path is absent.

## Module boundaries

- `cast-core.ts` remains pure and unchanged.
- `cast-diff.ts` remains the only Git/diff publication shell.
- `run-log.ts` remains a data normalizer plus its existing thin append shell.
- `cast.ts` owns availability verification because it knows project root and settlement time.
- Tests use real local filesystem and Git only at the cast integration boundary.

## Commit unit

The five source/test files form one meaningful atomic unit:

```text
src/engine/cast.ts
src/engine/cast.test.ts
src/engine/cast-diff.ts
src/log/run-log.ts
src/log/run-log.test.ts
```

Commit them through one exact-path `lisa commit-ticket` call after focused and full verification.

## Structural acceptance map

| Required behavior | Owning structure |
|---|---|
| row survives settlement throw | `cast.ts` guard and finally append |
| honest failure outcome | `cast.ts` catch → `errored` |
| original defect remains visible | post-finally rethrow |
| successful diff is fully published | `cast-diff.ts` temp write + rename |
| missing diff not falsely referenced | `cast.ts` availability reconciliation |
| discrepancy is durable | `run-log.ts` optional structured marker |
| general non-reviewer proof | `cast.test.ts` disappearing diff before patch read |
| schema/back-compat proof | `run-log.test.ts` build/revive tests |
