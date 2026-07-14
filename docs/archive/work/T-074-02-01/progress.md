# Progress — T-074-02-01 underfunding decision core

## Status

Implementation is complete and committed. Focused ticket tests pass. The first repository
gate attempt was temporarily red because concurrent T-074-01-01 tests referenced probe
exports before their executor source changes arrived. Once that concurrent unit settled,
the full repository gate passed. This ticket's source paths are clean and committed.

## Completed work

### Phase artifacts

- Read the assignment, AGENTS.md, vision, RDSPI workflow, charter, parent story, ticket,
  epic context, and relevant source/tests.
- Wrote attempt-private `research.md`.
- Wrote attempt-private `design.md`.
- Wrote attempt-private `structure.md`.
- Wrote attempt-private `plan.md`.
- Continued directly into implementation as assigned.

### Pure decision core

Created `src/shelf/underfunding-core.ts`.

Implemented:

- `UNDERFUNDING_FACTOR = 2`;
- `underfundingWarning(funded, floor): string | null`;
- strict warning boundary: funded tokens `< floor tokens / 2`;
- exact-half, near-floor, at-floor, and above-floor silence;
- token-only comparison, leaving wall-clock independent;
- one-line advisory message naming human-scale funded and measured-floor tokens;
- explicit “proceeding with funded budget” language for warn-don't-block truthfulness;
- private formatter preserving 12,500 as `12.5k` and 400,000 as `400k`.

The core imports `Budget` type-only and performs no I/O.

### Fixture tests

Created `src/shelf/underfunding-core.test.ts` with eight tests covering:

1. factor pinned to 2;
2. field-report 12.5k versus 400k warning;
3. exact warning message and both named quantities;
4. one token below the threshold warns;
5. exact floor is silent;
6. above floor is silent;
7. near floor is silent;
8. exact half is silent;
9. wall-clock mismatch alone is silent.

The numbered behaviors include eight test cases because the field-report case also pins
multiple message requirements in one fixture.

## Verification performed

### Focused test

Command:

```bash
bun test src/shelf/underfunding-core.test.ts
```

Result:

```text
8 pass
0 fail
8 expect() calls
```

The focused process imported only the standalone core and type-only budget contract; no
BAML addon path was loaded.

### Initial full typecheck

Command:

```bash
bun run build
```

Result: red on concurrent, unrelated files only:

- `src/executor/claude.test.ts` expects `classifyClaudeProbe`, `CLAUDE_PROBE_HINT`, and a
  `probe` method not yet present in `claude.ts`;
- `src/executor/openai-compat.test.ts` expects probe request/classification/hint exports
  and a `probe` method not yet present in `openai-compat.ts`.

These are T-074-01-01 executor-dispensability work visible in the shared worktree. No
underfunding-core diagnostic was emitted.

### Source inspection

- Diff contains exactly one core and one colocated test.
- Core has no runtime imports.
- No fs, clock, process, network, executor, BAML, ledger, or dispatch API is used.
- No existing source file was modified by this ticket.

## Commit

Committed with the required isolated mechanism and exact includes:

```bash
lisa commit-ticket \
  --ticket-id T-074-02-01 \
  --message "feat(shelf): add underfunding warning decision" \
  --include src/shelf/underfunding-core.ts \
  --include src/shelf/underfunding-core.test.ts
```

Commit:

```text
fc838e4b613e43375ac51a22bbd7d4e7b2db2f01
```

Commit stat: 2 files changed, 86 insertions. Both ticket-owned source files are clean after
commit.

## First repository-gate attempt

Command:

```bash
bun run check
```

Observed:

- BAML generation succeeded and rewrote its normal 14 client files without leaving a
  ticket-owned diff;
- typecheck stopped on the same concurrent T-074-01-01 missing probe exports/methods;
- full tests did not run because the chained check stops after typecheck failure.

This is not softened into a green result. A recheck is required after the concurrent
source unit settles.

## Final repository-gate recheck

After the concurrent executor probe implementation appeared in the shared worktree, ran:

```bash
bun run check
```

Final result:

```text
BAML generation: passed (14 client files generated)
TypeScript typecheck: passed
Tests: 1709 passed, 1 skipped, 0 failed
Assertions: 5273
Files: 115
```

The one skipped test is the existing release acceptance integration that requires local
`dist/` artifacts. The ticket's focused eight tests ran within the full green suite.

## Plan deviations

- The plan expected `bun run build` and `bun run check` to be immediately green. They are
  temporarily blocked by another active ticket's test-first changes in the shared
  worktree.
- The ticket source unit was committed after its focused green proof so exact ownership
  was secured without absorbing or altering concurrent files.
- No implementation/API/scope deviation occurred.

## Unrelated state preserved

The worker did not edit, stage, include, or revert:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-074-01-01.md`;
- `docs/active/tickets/T-074-02-01.md` (Lisa phase state);
- `src/executor/claude.test.ts`;
- `src/executor/openai-compat.test.ts`;
- `docs/active/work/T-074-01-01/`;
- Lisa-published `docs/active/work/T-074-02-01/`.

## Remaining

1. Perform committed-diff self-review.
2. Write `review.md` and stop on this ticket.
