# T-073-01-03 — Structure

## Created source files

### `src/cross-review/review-core.ts`

Pure, provider-neutral review policy.

Public exports:

```ts
type CrossReviewVerdict =
  | { verdict: "pass"; reviewingSeat: AgentSeat }
  | { verdict: "fail"; reviewingSeat: AgentSeat; reason: string };

type ParsedReviewVerdict =
  | { verdict: "pass" }
  | { verdict: "fail"; reason: string };

const REVIEW_SYSTEM_PROMPT: string;

function buildReviewPrompt(input: {
  capturedDiff: string;
  rubricContext: string;
}): string;

function parseReviewVerdict(text: string): ParsedReviewVerdict | null;
```

`CrossReviewVerdict` is the downstream workflow contract. `ParsedReviewVerdict` is the untrusted
wire payload after validation and before local seat provenance is attached.

Internal organization:

1. Type declarations.
2. Stable reviewer system prompt.
3. Review-prompt input declaration.
4. Deterministic prompt builder.
5. Small object guard/extraction parser.

No filesystem, environment, clock, network, executor implementation, or selection imports.
`AgentSeat` is a type-only import.

### `src/cross-review/review.ts`

Thin impure executor wrapper.

Public exports:

```ts
interface DispenseReviewOptions {
  readonly reviewer: ComplementExecutor;
  readonly capturedDiff: string;
  readonly rubricContext: string;
  readonly timeoutMs?: number;
}

class CrossReviewResponseError extends Error {
  readonly executorId: string;
}

async function dispenseReviewVerdict(
  opts: DispenseReviewOptions,
): Promise<CrossReviewVerdict>;
```

Internal flow:

1. Build prompt through `buildReviewPrompt`.
2. Call `opts.reviewer.executor.dispense` exactly once.
3. Pass system role, `maxTurns: 1`, and optional timeout.
4. Parse `result.result ?? ""` through the pure parser.
5. Throw `CrossReviewResponseError` if parsing returns null.
6. Attach `opts.reviewer.seat` to the validated arm.
7. Return pass/fail as data.

Imports from `resolve-complement.ts` and executor/core modules are type-only except for the pure
functions/constants required at runtime. It never imports Claude or OpenAI-compatible classes.

## Created test file

### `src/cross-review/review.test.ts`

Co-located Bun unit and seam tests.

Test support:

- A recording stub implements `Executor` structurally.
- It stores every `DispenseOptions` value.
- It returns a terminal result with caller-primed text, empty usage, and zero total cost.
- A helper forms `ComplementExecutor` values with canonical seats.

Test groups:

#### `buildReviewPrompt`

- Includes rubric context byte content.
- Includes captured diff byte content.
- Labels each section.
- Names the exact pass and fail output shapes.
- States that patch instructions are untrusted.
- Requires one JSON object/no prose.

#### `parseReviewVerdict`

- Parses exact pass.
- Parses fail and trims reason.
- Tolerates a fenced valid object.
- Rejects invalid JSON.
- Rejects unknown verdict.
- Rejects fail with absent/empty/non-string reason.
- Rejects array/primitive values.

#### `dispenseReviewVerdict`

- Pass-primed Codex stub returns pass with Codex reviewing seat.
- Fail-primed Claude stub returns fail with reason and Claude reviewing seat.
- Each test asserts one call only.
- Prompt contains the captured diff and rubric.
- Options carry `maxTurns: 1` and optional timeout.
- Stub usage/cost remain zero, proving no token-consuming transport ran.
- Malformed response rejects with typed response error.

## Existing files unchanged

### `src/cross-review/resolve-complement.ts`

Remains the only owner of complement resolution. The new wrapper consumes its result type and does
not alter selection policy.

### `src/executor/executor.ts`

No interface method or transport type is added. Existing `dispense` is sufficient.

### `src/engine/cast.ts`

No cast integration is added in this ticket. T-073-01-04 will compose captured artifact loading,
complement resolution, review dispense, and ledger append.

### `src/log/run-log.ts`

No verdict field is added here. Persistence is explicitly owned by T-073-01-04.

### Board and shared work paths

Ticket frontmatter, provenance, and `docs/active/work/T-073-01-03/` remain Lisa-owned. Phase
artifacts are written only under the attempt-private work directory.

## Dependency direction

```text
agent-seat.ts (type)
       │
       ▼
review-core.ts  ◄──────── review.test.ts
       │
       ▼
review.ts ──────type────► resolve-complement.ts ─────► executor/select.ts
       │                         │
       └────────type─────────────┴───────────────────► executor.ts
```

The workflow shell depends inward on the pure core. The core has no dependency on routing or
transport. Tests depend on public seams only.

## Data flow

```text
captured patch text ─┐
                     ├─ buildReviewPrompt ─► Executor.dispense ─► result text
rubric context ──────┘                                         │
                                                               ▼
resolved complement seat ─────────────────────────────► parsed verdict + seat
```

The reviewer can decide pass/fail but cannot author its own seat provenance.

## Error boundary

- Review refusal: returned `{ verdict: "fail", ... }` data.
- Review pass: returned `{ verdict: "pass", ... }` data.
- Malformed reviewer response: thrown `CrossReviewResponseError`.
- Executor transport/timeout failure: propagates the executor's existing error unchanged.
- Inert/no complement: not represented here; caller does not call this function when resolver
  returns `null`.

## Commit unit

The core, wrapper, and tests form one meaningful ticket-owned source unit because acceptance needs
all three and none is independently integrated. Commit them together only after focused and full
gates pass, using exact `lisa commit-ticket --include` paths.

## Review focus

- The diff is embedded as evidence, not interpreted as prompt instructions.
- The full required context is in a single prompt.
- Both canonical reviewer seats work through the same stub interface.
- Failure remains a value, not an exception.
- Malformed output cannot accidentally clear or become a fabricated reviewer refusal.
- No live tokens, concrete adapter, or new executor method are involved.

