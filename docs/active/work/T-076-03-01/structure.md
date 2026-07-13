# Structure — T-076-03-01

## Change summary

Modify exactly two ticket-owned source files:

1. `src/doctor/doctor-probe.ts`
2. `src/doctor/doctor-probe.test.ts`

Create no production modules. Delete no files. Do not modify the complement resolver, executor
contract, cast loop, preflight composer, doctor renderer, CLI, or ticket frontmatter.

## Dependency shape

The resulting runtime dependency graph is:

```text
doctor/doctor-probe.ts
  ├─ doctor/doctor-core.ts                 Check constructors
  ├─ executor/executor.ts                  ExecutorProbeResult type
  ├─ executor/select.ts                    active id + ExecutorRegistry type
  ├─ engine/cast-core.ts                   executor id → author seat
  ├─ cross-review/resolve-complement.ts    configured complement resolution
  └─ executor/openai-compat.ts             existing config presence constants
```

No lower-level module imports doctor. The dependency direction stays from the preflight shell down
to policy and executor seams.

## `src/doctor/doctor-probe.ts`

### Imports

Add value imports:

```ts
import { resolveComplementExecutor } from "../cross-review/resolve-complement.ts";
import { resolveSeatOfExecution } from "../engine/cast-core.ts";
```

Extend the selector import with the type-only registry symbol `ExecutorRegistry`. Do not import
concrete executor classes for reviewer handling.

### Public check constants

Add after `EXECUTOR_DISPENSABLE_CHECK`:

```ts
export const CROSS_REVIEW_INERT_CHECK =
  "cross-review: not provisioned — casts skip review";
export const CROSS_REVIEW_DISPENSABLE_CHECK =
  "cross-review reviewer dispensable";
```

The inert constant is the complete check name. The dispensable constant is a base name suffixed by
the resolved reviewer seat.

### Dependency interface

Extend `DoctorProbeDeps` with:

```ts
readonly crossReviewRegistry: ExecutorRegistry | undefined;
```

Semantics:

- `undefined` means use canonical default complement resolution;
- an explicit registry is the configured capability set;
- it is configuration input, not a new effect reader;
- factories remain lazy until the resolver selects the complement.

Extend `DEFAULT_PROBE_DEPS` with `crossReviewRegistry: undefined`. This encodes the fresh/default
unprovisioned state explicitly while preserving `Partial` override merging.

### Shared pure result mapping

Extract the current result formatting body into a private helper shaped like:

```ts
function dispensableCheck(
  name: string,
  fallbackSubject: string,
  result: ExecutorProbeResult,
): Check
```

Responsibilities:

- return `passed(name)` for `result.ok`;
- trim optional `reason` and `hint`;
- join present fields with ` — `;
- return `failed(name, detail)` for structured failure;
- use an actionable fallback naming `fallbackSubject` when both fields are absent.

Preserve existing active helper behavior through
`executorDispensableCheck(id, result): Check`. It constructs
`executor dispensable: <id>` and delegates to the private helper. Its current tests remain valid.

Add a new public pure helper:

```ts
export function reviewerDispensableCheck(
  seat: string,
  result: ExecutorProbeResult,
): Check
```

The resolver already guarantees a known seat at the call site. The helper constructs
`cross-review reviewer dispensable: <seat>` and uses a reviewer-specific actionable fallback.

### Reviewer check verb

Add an exported async function:

```ts
export async function crossReviewCheck(
  activeExecutorId: string,
  registry: ExecutorRegistry | undefined,
): Promise<Check>
```

Implementation order:

1. call `resolveSeatOfExecution(activeExecutorId)`;
2. call `resolveComplementExecutor(authorSeat, registry)`;
3. if null, return `passed(CROSS_REVIEW_INERT_CHECK)`;
4. otherwise await `reviewer.executor.probe()`;
5. return `reviewerDispensableCheck(reviewer.seat, result)`.

The function never references `dispense` and does not add transport-specific branching.

### `probeDoctor` composition

Continue resolving `executorId` once through `resolveExecutorId({}, d.env)`.

Append to the existing `Promise.all`:

```ts
safeCheck(CROSS_REVIEW_DISPENSABLE_CHECK, () =>
  crossReviewCheck(executorId, d.crossReviewRegistry)
)
```

This preserves all previous indices and assigns index 5 to the reviewer state.

Update module and function documentation:

- doctor now gathers reviewer resolution/readiness;
- the check order contains six entries;
- default reviewer resolution is visible and inert;
- a provisioned reviewer is probed through the same unmetered boundary;
- no model dispense is performed.

### Error boundary

Keep `safeCheck` private and unchanged. It wraps resolution, factory construction, and probe await
because all occur inside the callback. Unexpected throws become:

```ts
{
  name: CROSS_REVIEW_DISPENSABLE_CHECK,
  ok: false,
  hint: <thrown message>,
}
```

Expected provider reachability failures retain the resolved seat-specific name because executor
probes return non-ok result data.

## `src/doctor/doctor-probe.test.ts`

### Imports

Import both new check constants, `crossReviewCheck`, and `reviewerDispensableCheck`. Add
type-only imports for `Executor`, `ExecutorProbeResult`, and `ExecutorRegistry`. Do not import
concrete reviewer classes.

### Fake executor helper

Add a controlled fake executor:

```ts
function probeExecutor(
  id: string,
  probe: () => Promise<ExecutorProbeResult>,
): Executor
```

Its `dispense()` throws `doctor must not dispense`. This makes the story's FREE boundary
executable rather than documentary.

### Provisioned registry fixture

Build explicit two-seat registries per test or through a helper:

```ts
{
  claude: () => author,
  "openai-compat": () => reviewer,
}
```

The active environment remains `{}`, so author id resolves to Claude and complement seat resolves
to Codex.

### Existing expectation updates

Update fixed doctor counts from five to six in:

- all-green probe test;
- missing-lisa case;
- missing-BAML case;
- open-model endpoint case;
- thrown PATH case;
- thrown BAML case;
- thrown active executor probe case;
- guarded-live smoke.

Add index-5 assertion for the exact inert check in the all-green case. Update comments referring to
five dependencies/checks.

### New reviewer behavior block

Add tests for:

1. default registry returns exact inert passed check;
2. explicit provisioned reachable reviewer returns
   `{ name: "cross-review reviewer dispensable: codex", ok: true }`;
3. explicit provisioned unreachable reviewer returns red, names `codex`, and includes both reason
   and fix-it text;
4. reviewer probe is called exactly once;
5. active author executor factory is not invoked by complement construction;
6. pure mapper supplies actionable fallback for `{ ok: false }`;
7. a throwing reviewer probe becomes a returned generic red check in `probeDoctor`.

The unreachable fixture uses transport-neutral reason and repair text.

### Guarded-live assertion

The real default smoke is deterministic for reviewer provisioning even though primary executor
reachability is host-dependent. Assert:

- total length is six;
- all shapes remain well formed;
- `CROSS_REVIEW_INERT_CHECK` exists exactly and is green.

## Unchanged paths

### `src/cross-review/resolve-complement.ts`

No edits. The ticket consumes its post-`T-076-01-01` semantics.

### `src/executor/executor.ts`

No edits. `probe()` is already mandatory and sufficient.

### `src/doctor/preflight.ts` and test

No edits expected. Partial dependency merging supplies the default inert registry and sixth check.
The renderer is count-agnostic.

### `src/doctor/doctor-core.ts`

No edits. Existing passed/failed/render behavior covers the new state.

### `src/cli.ts`

No edits. The doctor dispatch renders the returned array generically.

## Commit unit

The source and its direct unit tests form one meaningful ticket-owned unit because the public
doctor behavior and count changes are inseparable. Commit together through:

```text
lisa commit-ticket T-076-03-01 \
  --message "feat(doctor): probe configured reviewer dispensability" \
  --include src/doctor/doctor-probe.ts \
  --include src/doctor/doctor-probe.test.ts
```

Attempt-private RDSPI artifacts are not included in ticket source commits; Lisa publishes them.

