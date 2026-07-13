# T-073-02-02 — Structure

## File-level blueprint

### Create `src/engine/cross-review-refusal.e2e.test.ts`

This is the only ticket-owned source unit. It is a black-box acceptance test around exported
production interfaces and filesystem outcomes.

Imports:

- Bun test lifecycle and assertion functions.
- Node filesystem promises for temp setup, evidence reads where needed, and cleanup.
- Node OS/path helpers for temporary locations and stable paths.
- `Budget` for the fixed high envelope.
- `Executor`, `DispenseOptions`, and `ResultMessage` for typed doubles.
- `ExecutorRegistry` for the injected two-seat capability set.
- `Play` for the fixture play contract.
- `castPlay` for the complete production orchestration path.

Internal organization:

1. Temporary-directory registry and `afterEach` cleanup.
2. Minimal Git command helper.
3. Temporary Git repository initializer.
4. Fixed generous budget.
5. Parsed output type for bad/good quality.
6. Fixture play factory that writes visible bad/good evidence.
7. Successful author executor factory.
8. Recording queued complement-stub factory/registry.
9. One end-to-end test containing both casts and all assertions.

No helper is exported. The production API remains unchanged.

### Create private RDSPI artifacts

- `.lisa/attempts/T-073-02-02/1/work/research.md`
- `.lisa/attempts/T-073-02-02/1/work/design.md`
- `.lisa/attempts/T-073-02-02/1/work/structure.md`
- `.lisa/attempts/T-073-02-02/1/work/plan.md`
- `.lisa/attempts/T-073-02-02/1/work/progress.md`
- `.lisa/attempts/T-073-02-02/1/work/review.md`

These are attempt metadata, not source commit includes. Lisa publishes admitted artifacts later.

## Test boundaries

### Production code inside the proof

The new test calls `castPlay` directly. Through that public function it exercises:

- render and parse;
- ordinary play gates;
- effect execution;
- artifact reporting;
- Git patch capture;
- complement-seat resolution;
- one-turn structured review dispense;
- strict review reply parsing;
- cross-review gate settlement;
- final `RunSummary` projection;
- final JSONL construction and append.

### Replaced external boundaries

- The author model transport is replaced by a typed executor double.
- The complement model transport is replaced by a typed, primed executor double.
- The developer's repository is replaced by a temporary Git worktree.
- The default ledger and transcript locations are redirected into the temporary project.
- Network, tokens, vendor credentials, and human decisions are absent.

### Real boundaries retained

- Real filesystem writes.
- Real Git diff computation.
- Real captured artifact persistence.
- Real prompt construction.
- Real structured verdict parsing.
- Real classification and settlement.
- Real JSONL append and parse.

## Fixture play shape

`refusalProofPlay` will satisfy:

```ts
Play<{ case: string }, { quality: "bad" | "good" }>
```

Its methods have these responsibilities:

- `render`: create a deterministic author request.
- `parse`: decode the author stub's terminal JSON.
- `gates`: return `{ status: "clear", cleared: ["fixture-contract"] }`.
- `effect`: write the evidence module and report it in `artifacts`.
- `budget`: carry the same high fixture budget supplied to `castPlay`.
- `card`: satisfy the authored play metadata contract.

The effect file path should remain the same for both casts. The second cast overwrites bad bytes
with good bytes, proving the review input is the current patch rather than a fixture identifier.

## Executor-double shape

### Author double

`authorExecutor(quality)` returns an `Executor` with id `claude`. `dispense` returns a terminal
success whose `result` is JSON for that quality and whose usage/cost are zero.

### Review double

A small fixture object contains:

- `calls: DispenseOptions[]`;
- `registry: ExecutorRegistry`.

The registry exposes `claude` and `openai-compat`. The latter's `dispense` records each call and
shifts the next primed reply. It returns a terminal success with model `review-stub`, zero usage,
and zero cost. Missing replies throw an explicit fixture error.

## Ledger shape under assertion

Line 1:

- `runId: "cross-review-bad"`
- `outcome: "gate-failed"`
- `seatOfExecution: "claude"`
- non-empty `capturedDiff`
- passing `fixture-contract` gate row
- failing `cross-vendor-review` row with the refusal reason
- FAIL verdict from `authoringSeat: "claude"` to `reviewingSeat: "codex"`

Line 2:

- `runId: "cross-review-good"`
- `outcome: "success"`
- `seatOfExecution: "claude"`
- non-empty `capturedDiff`
- passing `fixture-contract` gate row
- passing `cross-vendor-review` row
- PASS verdict from `authoringSeat: "claude"` to `reviewingSeat: "codex"`

## Change ordering

1. Write the test fixture and complete contrast scenario.
2. Run only the new test to tighten compile and behavioral feedback.
3. Run TypeScript/build or the full repository gate.
4. Review the diff for test-only scope and exact acceptance mapping.
5. Commit the one test path through `lisa commit-ticket`.
6. Confirm the ticket-owned source path is clean.
7. Complete progress and review artifacts privately.

## Commit boundary

One meaningful ticket-owned source unit is expected:

```text
src/engine/cross-review-refusal.e2e.test.ts
```

It will be committed in one Lisa transaction because the fixture and the scenario are not useful
or independently green when separated. No ordinary staging or commit command will be used.

## Expected unchanged files

- `src/engine/cast.ts`
- `src/engine/cast-core.ts`
- `src/cross-review/review.ts`
- `src/cross-review/resolve-complement.ts`
- `src/log/run-log.ts`
- Existing focused test files
- Ticket frontmatter and Lisa provenance state

Any discovered need to change these would be a deviation requiring documentation before action.
