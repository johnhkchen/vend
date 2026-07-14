# Progress — T-071-02-01

## Outcome

Implementation is complete. The pure lane-heat reader and its unit tests are committed through Lisa,
and the required full repository gate is green.

## Completed phases

- Research completed in the private attempt directory.
- Design completed in the private attempt directory.
- Structure completed in the private attempt directory.
- Plan completed in the private attempt directory.
- Implementation completed and committed.
- Review follows in review.md.

## Implemented source

### src/play/lane-heat.ts

- Added the pure inferDefaultSeat reader.
- Added a public readonly InferredSeat result with seat and reason.
- Reads the routing vocabulary directly from KNOWN_SEATS.
- Reads cost-weighted burn directly through run-log's totalTokens.
- Considers the append-ordered last 100 records.
- Aggregates only records attributed to a currently known seat.
- Ignores absent and raw unknown seat values.
- Requires a unique coolest and hottest lane.
- Requires a 2x hottest-to-coolest relative imbalance.
- Returns null for no evidence, ties, ambiguity, and non-decisive heat.
- Emits deterministic evidence text suitable for later provenance.
- Performs no filesystem, clock, executor, or quota work.

### src/play/lane-heat.test.ts

- Added nine pure unit tests.
- Proved a clearly hot first lane selects the second known lane.
- Proved symmetric selection when the second lane is hot.
- Proved a 1.5x active imbalance remains unrouted as both cool.
- Proved equal positive burn returns null.
- Proved an empty ledger returns null.
- Proved unattributed and unknown-seat records do not count.
- Proved output cost weighting reverses the raw-token ranking.
- Proved records older than the 100-record tail do not count.
- Proved returned values are derived from KNOWN_SEATS.

## Verification

### Focused test

Command:

`bun test src/play/lane-heat.test.ts`

Result:

- 9 passed.
- 0 failed.
- 16 expectations on the initial run; 17 after the final type-safe assertion was added.

### Typecheck

The first combined focused/build run found one test-only strict typing issue: an optional-chained
result seat was passed directly to an expectation whose tuple item type excludes undefined. The
test already proved a decision and the production behavior was correct. The assertion was refined
to explicitly prove non-null before the registry membership assertion.

Subsequent full typecheck passed.

### Full gate

Command:

`bun run check`

Result:

- BAML generation passed with CLI 0.223.0.
- TypeScript no-emit check passed.
- 1,639 tests passed.
- 1 expected integration test skipped because no dist artifacts were present.
- 0 tests failed.
- 4,960 expectation calls passed.
- 111 test files ran.
- Bun version remained the pinned 1.3.13.

### Diff hygiene

- git diff --check passed for both ticket-owned source files.
- No ordinary git add or git commit command was used.
- Unrelated Lisa/config/hook/ticket changes were not included.
- Ticket phase/status frontmatter was not manually edited.

## Commit

Meaningful source unit committed with:

`lisa commit-ticket --ticket-id T-071-02-01 ... --include src/play/lane-heat.ts --include src/play/lane-heat.test.ts`

Commit:

`484a1a2398e2d916e1306620fc5985abfa880ead`

The unit contains exactly:

- src/play/lane-heat.ts
- src/play/lane-heat.test.ts

## Plan deviations

One small implementation refinement was made from the initial plan: multi-seat handling explicitly
requires unique extrema. This follows the planned conservative behavior and makes the “add a seat
without reader edits” boundary safer; it does not choose arbitrarily among multiple tied cool lanes.

The result reason uses direct numeric stringification instead of rounding. This preserves fractional
cost-weighted burn exactly enough for honest provenance and avoids inventing display precision.

No scope deviation occurred. Ledger loading, seat stamping, provenance schema, explicit override,
and cast integration remain assigned to dependent tickets.

## Workspace state

The ticket-owned source paths are clean after the Lisa commit. Lisa-generated/shared work and ticket
state may appear in the worktree as Lisa manages publication and transitions; they were not included
in the source commit. Pre-existing unrelated configuration and hook changes remain untouched.

## Remaining

- Write review.md.
- Stop on this ticket.
- Await Lisa's completion publication and seat release.

