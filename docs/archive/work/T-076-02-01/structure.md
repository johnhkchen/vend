# Structure — T-076-02-01

## Change inventory

Ticket-owned source changes are limited to the cast settlement core, cast shell, and their tests.

| Path | Action | Responsibility |
|---|---|---|
| `src/engine/cast-core.ts` | modify | pure reviewer-failure settlement outcome |
| `src/engine/cast-core.test.ts` | modify | pin post-effect failure semantics |
| `src/engine/cast.ts` | modify | catch reviewer dispense failure, render andon, continue settlement |
| `src/engine/cast.test.ts` | modify | end-to-end token-free reviewer-throw proof |

No file is created or deleted under `src/`.

Attempt-private workflow artifacts are created only under:

```text
.lisa/attempts/T-076-02-01/1/work/
```

They are not included in source commits; Lisa publishes admitted copies separately.

## `src/engine/cast-core.ts`

### Public interface

Export one function adjacent to `settleCrossReview`:

```ts
export function settleCrossReviewFailure(base: Verdict): Verdict
```

The function takes and returns the existing `Verdict` type.

### Behavior

- clone `base`;
- set only `outcome` to `missing-capability`;
- preserve `materialize`;
- preserve `gateLog` by reference/value;
- preserve optional `overEnvelope`.

### Documentation

Document that:

- the effect and diff already landed;
- operational failure is distinct from a review fail verdict;
- no cross-vendor gate row is invented;
- the caller remains responsible for presentation and persistence.

### Boundary

The helper receives plain values and performs no I/O.

It does not inspect errors, executor IDs, seats, environment, or logs.

## `src/engine/cast-core.test.ts`

### Imports

Add `settleCrossReviewFailure` to the existing import from `cast-core.ts`.

### Test placement

Place the new test near existing `settleCrossReview` tests so all post-effect settlement decisions
are reviewed together.

### Fixture

Construct a base verdict that makes preservation observable:

```ts
{
  outcome: "success",
  materialize: true,
  gateLog: [{ gate: "value", passed: true }],
  overEnvelope: true,
}
```

### Assertions

- exact returned object has outcome `missing-capability`;
- materialize remains true;
- gate row remains unchanged;
- over-envelope remains true;
- base object itself is not mutated.

## `src/engine/cast.ts`

### Imports

- Import `settleCrossReviewFailure` from `cast-core.ts`.
- Import OpenAI-compatible endpoint configuration constants if the category-specific hint uses the
  canonical exported names.

Do not import concrete executor classes or catch by provider-specific error class.

### Local type

Define a private `CrossReviewFailure` interface near other cast-local settlement shapes or helpers.

Fields:

```ts
readonly reviewingSeat: string;
readonly endpointCategory: string;
readonly cause: string;
readonly hint: string;
```

This is presentation state, not a durable log schema.

### Settlement locals

Add:

```ts
let crossReviewFailure: CrossReviewFailure | undefined;
```

next to `crossVendorVerdict` and `crossReviewSkipped`.

### Review branch

Keep resolver and null-resolution behavior unchanged.

For a non-null reviewer:

1. read patch bytes exactly as today;
2. compute elapsed and remaining timeout exactly as today;
3. call `dispenseReviewVerdict` inside `try`;
4. map a valid result exactly as today;
5. on rejection, call a local pure failure builder using the reviewer and caught value;
6. do not rethrow.

The catch must not encompass the patch `readFile` or unrelated settlement operations.

### Verdict selection

Replace the unconditional valid-review settlement call with:

```ts
const settledVerdict = crossReviewFailure === undefined
  ? settleCrossReview({ ...verdict, outcome }, crossVendorVerdict)
  : settleCrossReviewFailure({ ...verdict, outcome });
```

This keeps valid review behavior on the existing function.

### Output selection

After assigning `outcome`:

- if `crossReviewFailure` exists, print the missing-capability reviewer andon;
- else if a valid verdict failed, print the existing gate-failed review andon;
- print neither line for a valid pass or inert resolution.

The branches must be mutually exclusive by construction.

### Record assembly

Do not add a new record field.

Existing conditional spreads naturally omit both `crossVendorVerdict` and `crossReviewSkipped` on
the failure arm.

Use the settled `outcome` and unchanged gate log in the existing append.

### Private helpers

Add helpers near `executorProbeDetail`:

```ts
function crossReviewEndpointCategory(executorId: string): string
function crossReviewFailureCause(error: unknown): string
function crossReviewFailureDetail(reviewer: ComplementExecutor, error: unknown): CrossReviewFailure
```

If importing `ComplementExecutor` solely for a helper annotation, use a type-only import.

The endpoint category helper is total over unknown IDs.

The cause helper never throws and never accesses `.stack`.

The detail builder chooses the OpenAI configuration hint for `openai-compat` and the generic
reviewer reachability hint otherwise.

## `src/engine/cast.test.ts`

### Fixture helper

Either extend `crossReviewRegistry` with a throwing variant or define a dedicated registry inline.

Prefer a small helper:

```ts
function throwingCrossReviewRegistry(error: unknown, calls: DispenseOptions[]): ExecutorRegistry
```

It should:

- provide an unused Claude author factory compatible with resolver requirements;
- provide an `openai-compat` reviewer with `probe: ok`;
- record dispense options;
- throw the supplied value from `dispense`.

The reviewer probe is not invoked by this cast seam; including it satisfies `Executor`.

### Integration case

Place the case beside the existing pass/fail/inert cross-review tests.

Setup:

- temporary project root;
- initialized Git baseline;
- existing board-plan fixture;
- fixed run ID;
- throwing reviewer error with connection-refused wording;
- stdout capture.

Assertions are grouped by surface:

#### Promise and summary

- `captureStdout` returns normally;
- outcome is `missing-capability`;
- materialized is true;
- captured diff is the expected repository-relative path;
- reviewer was called exactly once.

#### Andon

- contains `· andon: missing-capability`;
- contains reviewer seat `codex`;
- contains `OpenAI-compatible endpoint`;
- contains the injected cause message;
- contains `VEND_OPENAI_BASE_URL`;
- contains `vend doctor`;
- does not contain `Error:`;
- does not contain a stack-frame prefix such as `\n    at `;
- does not contain the valid-review `gate-failed` andon.

#### Record

- exactly one JSONL line exists;
- outcome is `missing-capability`;
- captured diff remains present;
- primary usage/cost remain present;
- original fixture gate row remains present;
- `crossVendorVerdict` is absent;
- `crossReviewSkipped` is absent.

#### Artifact

- captured diff file exists and is non-empty.

### Successful-path oracle

Leave the existing passing-review test assertions unchanged.

Leave the existing valid-refusal and inert-resolution tests unchanged.

Their green result proves the new catch branch is behaviorally inert when no exception occurs.

## Ordering

1. Add pure core test and implementation.
2. Add failing cast integration test.
3. Implement the cast-local failure state and catch.
4. Run focused tests and typecheck.
5. Run complete repository gate.
6. Commit the four exact ticket-owned source paths through Lisa.
7. Write progress and review artifacts privately.

## Explicit non-changes

- No `RunOutcome` addition.
- No run-log schema field.
- No changes to `CrossVendorVerdict`.
- No changes to `CrossReviewSkipped`.
- No changes to `dispenseReviewVerdict` or its parser.
- No changes to executor adapters or resolver provisioning.
- No retries or alternate reviewer routing.
- No general settlement `finally`; that is the next ticket.
- No ticket phase/status edits.
- No direct writes to `docs/active/work/T-076-02-01`.
