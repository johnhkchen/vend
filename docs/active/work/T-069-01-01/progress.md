# Progress — T-069-01-01

## Status

- Phase executed: Implement.
- Implementation state: code and focused verification complete.
- Full repository gate: green.
- Review artifact: pending at the time of this update.
- Ticket phase/status frontmatter: not edited by this worker.

## Completed work

### Step 1 — Seat-contract acceptance test

Completed.

- Created `src/play/agent-seat.test.ts`.
- Added an exact assertion for `KNOWN_SEATS` equal to `["claude", "codex"]`.
- Added `findUnknownSeat("gpt") === "gpt"`.
- Added `findUnknownSeat("claude") === null`.
- Added `findUnknownSeat("codex") === null`.
- Kept the test import graph free of BAML/native-addon modules.

### Step 2 — Pure seat contract

Completed.

- Created `src/play/agent-seat.ts`.
- Exported one `KNOWN_SEATS` tuple.
- Derived the `AgentSeat` union from the tuple.
- Exported the pure, total `findUnknownSeat` oracle.
- Used exact identity matching with no normalization.
- Added no effects or dependencies.

### Step 3 — Assembly fixture and assertions

Completed.

- Added a temp-root fixture with a minimal epic and canonical charter path.
- Used the existing missing-directory tolerance for `src`, stories, and tickets.
- Added cleanup in `finally` for every async test.
- Proved supplied `agent: "codex"` is present and owned on the result.
- Proved omission reads as `undefined`.
- Proved omission creates no own `agent` property.
- Proved the omitted result deeply equals the legacy `{ epic, charter, project }` shape.

### Step 4 — Input interfaces

Completed.

- Added `readonly agent?: string` to `ContextSources`.
- Added `readonly agent?: string` to `DecomposeInputs`.
- Documented the field as Lisa routing metadata owned by the effect.
- Kept the transport type as arbitrary string so later validation can honestly reject CLI input.

### Step 5 — Presence-preserving assembly

Completed.

- Added an `undefined`-checked conditional spread to `assembleInputs`.
- Preserved the existing `after` semantics exactly.
- Preserved required key ordering and shape.
- Updated the assembly comment to cover optional effect inputs.
- Corrected the file header's now-outdated claim that assembly has no direct fixture test.

## Verification record

### Focused tests

Command:

```bash
bun test src/play/agent-seat.test.ts src/play/project-context.test.ts
```

Result:

- Exit: 0.
- 13 tests passed.
- 0 tests failed.
- 32 assertions executed.
- New seat tests: 3 passed.
- Existing project-context regression tests: 10 passed.

### Typecheck

Command:

```bash
bun run build
```

Result:

- Exit: 0.
- `tsc --noEmit` reported no errors.
- Existing consumers compiled unchanged with the optional fields.

### Diff hygiene

Command:

```bash
git diff --check
```

Result:

- Exit: 0.
- No whitespace errors.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- Exit: 0.
- BAML CLI 0.223.0 generated the client successfully.
- `tsc --noEmit` passed.
- 1,603 tests passed.
- 1 test was skipped by its existing dist-artifact precondition.
- 0 tests failed.
- 4,816 assertions executed.
- 1,604 tests ran across 109 files.
- No BAML-generated working-tree drift remained after the gate.

### Scope inspection

Inspected production/test diff and `git status --short`.

Confirmed ticket-owned code changes are limited to:

- new `src/play/agent-seat.ts`;
- new `src/play/agent-seat.test.ts`;
- modified `src/play/project-context.ts`.

Confirmed no changes to:

- materialization;
- decompose effect/run logging;
- chain options;
- CLI parsing;
- executor adapters;
- BAML schemas/generated API;
- Lisa dispatch.

Preserved pre-existing orchestration state:

- modified `docs/active/tickets/T-069-01-01.md` (`ready` → `research`, Lisa-owned);
- untracked `docs/active/epic/E-069.md`;
- untracked `docs/active/stories/S-069-01.md`.

These paths will not be staged by this implementation.

## Plan deviations

None affecting design or scope.

One execution detail differs from the plan's conceptual red/green ordering: the test and minimal
implementation were added in one patch, then run green, instead of invoking a guaranteed failing test
between their creation. The acceptance behavior is still directly pinned, and no production behavior
was added without a corresponding assertion.

## Remaining implementation-phase work

1. Perform self-review against acceptance and scope.
2. Write `review.md`.
3. Stage explicit ticket-owned paths and commit without bypassing hooks.
4. Verify only preserved Lisa/concurrent state remains.

## Acceptance status after full gate

- Single `KNOWN_SEATS`: implemented and full-suite green.
- Unknown `gpt`: implemented and full-suite green.
- Known `claude`/`codex`: implemented and full-suite green.
- Supplied `agent: "codex"`: implemented and full-suite green.
- Absent agent/legacy shape: implemented and full-suite green.
- Full repository regression gate: green; implementation acceptance is met.
