# Progress — T-082-01-02 cast-settle-cap-detection

## Status

Implementation complete, verified, and committed.

## Completed before implementation

- [x] Read `AGENTS.md`, canonical vision, RDSPI workflow, charter references, story, and ticket.
- [x] Confirm private attempt artifact and Lisa commit constraints.
- [x] Preserve unrelated Lisa-managed worktree changes.
- [x] Map run-log marker, cast core/shell, executor seam, graph throw behavior, and tests.
- [x] Inspect repository-local rate-limit stream evidence.
- [x] Establish focused baseline: 96 pass, 0 fail, 451 assertions.
- [x] Write `research.md`.
- [x] Write `design.md`.
- [x] Write `structure.md`.
- [x] Write `plan.md`.

## Implementation checklist

- [x] Add focused pure classifier tests.
- [x] Implement conservative terminal cap classifier.
- [x] Add marked and marker-less cast acceptance fixtures.
- [x] Wire marker into the existing final settlement append.
- [x] Run focused tests and typecheck.
- [x] Inspect exact diff and scope.
- [x] Run `bun run check`.
- [x] Commit exact ticket-owned source paths through `lisa commit-ticket`.
- [x] Verify ticket-owned source paths are clean and unstaged.

## Planned source unit

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

## Deviations

No implementation deviation from Design or Structure.

The planned pure-test inventory was consolidated into seven tests with multiple related assertions
rather than ten one-assertion tests. All named positive, precedence, negative, success-prose, null,
and malformed-data branches remain directly covered.

## Implemented behavior

- Added pure `classifyCapWindowExhaustion(ResultMessage | null)`.
- Requires a terminal failure shape (`error*` subtype or `is_error: true`).
- Classifies explicit structured/text HTTP 429 as `signal: "http-429"`.
- Classifies explicit rate-limit denial prose/type as `signal: "rate-limit"`.
- Uses controlled stable reasons; raw provider prose is not persisted.
- Ignores successful prose, ordinary failures, max-turn errors, malformed fields, and null.
- Does not inspect or intercept live `rate_limit_event` messages.
- Threads the complete marker once into the existing final append immediately after
  `seatOfExecution`.
- Leaves outcome, effect, timeout, thrown-dispense, executor, and run-log schema behavior unchanged.

## Test-first checkpoints

1. New pure tests initially failed at module load because the named export did not yet exist.
2. After pure implementation: 78 pass, 0 fail, 193 assertions; `tsc --noEmit` green.
3. New cast acceptance branch initially failed only on the absent marker; the marker-less whole-row
   byte control already passed.
4. After shell wiring: 105 pass, 0 fail, 473 assertions across cast core and cast suites;
   `tsc --noEmit` green.

## Scope and diff review

- `git diff --check` is clean.
- Diff is exactly four planned source files: 289 insertions, 2 import-line replacements.
- No ticket-owned file is staged.
- No run-log schema, executor adapter, outcome, lane heat, budget, wallet, or dispatch file changed.
- Existing Lisa-managed provenance/ticket changes and shared published work directories were left
  untouched.

## Full repository gate

`bun run check` is green:

- BAML generation: pass.
- TypeScript typecheck: pass.
- Tests: 1972 pass, 1 explicit pre-existing dist-dependent skip, 0 fail.
- Assertions: 6478.
- Test files: 127.

## Commit

Created through `lisa commit-ticket` with the four exact planned include paths:

```text
3255d0cbe0df3666ea2dbec85efc7c652f4ce44a
feat(cast): record cap-window exhaustion (T-082-01-02)
```

Commit paths:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Post-commit verification:

- ticket-owned source paths are clean;
- ordinary Git index is empty;
- commit file list is exactly the four included paths;
- unrelated Lisa-managed changes and concurrent `T-082-02-01` source/work remain outside the
  commit and untouched.
