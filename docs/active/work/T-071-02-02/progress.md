# Progress — T-071-02-02

## Status

Implementation and source commit complete; Review in progress.

## Completed phases

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.

## Chosen implementation

- Add local exported `SeatInferred` with `{ seat: string, reason: string }`.
- Add optional `seatInferred` to `RunRecordInput` and `RunRecord`.
- Reuse the `normalizeSeatDefaulted` atomic-marker discipline in a dedicated helper.
- Use the same helper at both `buildRunRecord` and `reviveRecord` boundaries.
- Keep run-log independent of `AgentSeat`, `KNOWN_SEATS`, and `lane-heat.ts`.
- Place inferred routing provenance between `seatDefaulted` and `seatOfExecution`.

## Ticket-owned source files

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

## Worktree constraint

The worktree already contains unrelated modified/untracked Lisa configuration, hooks, provenance,
ticket frontmatter, and prior-ticket work artifacts. This ticket will not modify, stage, revert, or
commit them. The two ticket-owned source files were clean at implementation start.

## Implementation checklist

- [x] Add the marker type and record interface fields.
- [x] Add atomic normalization.
- [x] Wire `buildRunRecord`.
- [x] Wire `reviveRecord`.
- [x] Add valid `readRuns` round-trip test.
- [x] Add absent exact-byte test.
- [x] Add malformed exact-byte test.
- [x] Add canonical-copy test.
- [x] Add malformed-revive preservation test.
- [x] Inspect diff and whitespace.
- [x] Run focused run-log tests.
- [x] Run `bun run check`.
- [x] Commit exact source paths with `lisa commit-ticket`.
- [x] Confirm ticket-owned source files are clean after commit.

## Planned verification

```bash
bun test src/log/run-log.test.ts
bun run check
```

## Deviations

None.

## Source changes completed

- Added exported `SeatInferred` with `seat` and `reason` string fields.
- Added optional `seatInferred` to input and normalized run-record contracts.
- Added shared `normalizeSeatInferred` with atomic two-field validation and canonical copy.
- Wired the marker symmetrically through `buildRunRecord` and `reviveRecord`.
- Kept property ordering alongside `seatDefaulted` and before `seatOfExecution`.
- Added five focused pure tests covering valid `readRuns` byte-stable round-trip, absent exact
  bytes, malformed exact bytes, extra-field removal, and malformed revival without record loss.

## Verification observed

### Focused suite

Command:

```bash
bun test src/log/run-log.test.ts
```

Result:

- 105 pass.
- 0 fail.
- 223 assertions.
- The five new `seatInferred` tests all passed.

### Full gate

Command:

```bash
bun run check
```

Result:

- BAML client generation succeeded.
- `tsc --noEmit` succeeded.
- Full suite: 1,644 pass, 1 intentional skip, 0 fail.
- 4,974 assertions across 111 files.

### Diff audit

- `git diff --check -- src/log/run-log.ts src/log/run-log.test.ts` succeeded.
- Ticket diff contains 110 insertions across exactly the two planned source files.
- No generated files were left modified by the full gate.
- Unrelated orchestration changes remain present and untouched.

## Commit observed

Command:

```bash
lisa commit-ticket \
  --ticket-id T-071-02-02 \
  --message "feat(log): record inferred seat provenance (T-071-02-02)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Result:

- Commit: `464c7174033e5b6d8297fd6f4d83e97762636fb2`.
- Commit subject: `feat(log): record inferred seat provenance (T-071-02-02)`.
- Commit contains exactly two files and 110 insertions.
- `git diff --quiet -- src/log/run-log.ts src/log/run-log.test.ts` returned 0 after commit.
- Unrelated dirty worktree entries remain untouched.

## Remaining

- Write `review.md` in the private attempt work directory.
- Stop on this ticket for Lisa completion verification and artifact publication.
