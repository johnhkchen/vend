# T-071-01-02 Progress — cast stamps seat of execution

## Outcome

Implementation is complete, all acceptance criteria are met, the repository gate is green,
and the ticket-owned source unit is committed through Lisa.

## Completed work

### Step 1 — pure executor-to-lane mapping

Completed in `src/engine/cast-core.ts`.

- Added a type-only dependency on `AgentSeat`.
- Added `resolveSeatOfExecution(executorId)` as a pure, total resolver.
- Mapped `claude` to the `claude` lane.
- Mapped `openai-compat` to the `codex` lane.
- Left every unmapped id as `undefined`.
- Added no environment, registry, fs, clock, network, process, or native-addon access.

Completed in `src/engine/cast-core.test.ts`.

- Pinned the Claude mapping.
- Pinned the OpenAI-compatible mapping.
- Pinned unknown, case-mismatched, and empty identities as lane-less.

### Step 2 — cast settlement wiring

Completed in `src/engine/cast.ts`.

- Imported the pure resolver from the existing core boundary.
- Resolved the lane from the actual selected/injected executor instance's `id`.
- Resolved before dispense, allowing known timeout attempts to retain lane provenance.
- Conditionally spread `seatOfExecution` into the final run-log input.
- Used the same known-only omission discipline as `turnsUsed`.
- Left the pre-execution missing-capability record unchanged and lane-less.
- Did not modify classification, metering, effect behavior, or the return summary.

### Step 3 — token-free integration coverage

Completed in `src/engine/cast.test.ts`.

- Parameterized the existing stub's stable executor id, defaulting to `stub`.
- Cast the primary end-to-end fixture through a Claude-id stub.
- Asserted the written record has `seatOfExecution: "claude"`.
- Added a lane-less stub cast.
- Asserted the lane-less record has no `seatOfExecution` key and reads undefined.
- Used only temporary files and the existing stub; no model tokens or live executor were used.

## Verification

### Focused tests

Command:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Result:

- 63 passed;
- 0 failed;
- 182 assertions;
- 2 test files.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML generation succeeded with CLI 0.223.0;
- `tsc --noEmit` succeeded;
- 1,630 tests passed;
- 1 test intentionally skipped because no local `dist/` artifact exists;
- 0 tests failed;
- 4,943 assertions;
- 110 test files;
- Bun 1.3.13.

### Diff quality and ownership

- `git diff --check` passed for all four ticket-owned files.
- Final implementation diff: 77 insertions, 4 deletions across four files.
- No run-log, executor adapter, selector, materializer, reader, or ticket metadata source change.
- Existing unrelated `.lisa*`, Codex hook, provenance, and board changes were not included.
- The ordinary git index was not used.

## Commit

Committed with `lisa commit-ticket` using four exact repository-relative includes.

- Commit: `44c7f2b5b099ca32af9ff0a64ceb7c15fa2471b6`
- Subject: `feat(engine): stamp cast execution lane (T-071-01-02)`
- Included:
  - `src/engine/cast-core.ts`
  - `src/engine/cast-core.test.ts`
  - `src/engine/cast.ts`
  - `src/engine/cast.test.ts`
- All four ticket-owned source paths are clean after commit.
- No files remain staged in the ordinary index.

## Deviations from plan

No material implementation deviation.

The full gate completed quickly enough that a separate intermediate `bun run build` invocation
was unnecessary after focused tests: `bun run check` ran the authoritative typecheck and full
suite. This does not reduce verification coverage.

## Acceptance checklist

- [x] Cast through a stub executor writes a record with the executor's known lane.
- [x] Pure unit test pins Claude executor → Claude lane.
- [x] Pure unit test pins OpenAI-compatible executor → Codex lane.
- [x] Lane-less cast omits the field entirely.
- [x] Conditional spread matches `turnsUsed` unknown-fact semantics.
- [x] `bun run check` is green.
- [x] Ticket-owned code and tests are committed through Lisa.
