# Research — T-080-01-03 settle surfaces cord failure

## Assignment and phase state

- Ticket `T-080-01-03` starts in `phase: research` and depends on completed tickets
  `T-080-01-02` and `T-080-02-02`.
- The assignment requires one continuous pass through Research, Design, Structure, Plan,
  Implement, and Review.
- Attempt artifacts belong only under `.lisa/attempts/T-080-01-03/1/work/`; Lisa publishes
  admitted artifacts later.
- Ticket phase/status frontmatter is Lisa-owned and must not be edited by this worker.
- Ticket source must be committed with `lisa commit-ticket` and exact repository-relative include
  paths; the ordinary Git index and ordinary commit commands are forbidden.
- The worktree begins with Lisa-owned changes to `.lisa/provenance.jsonl` and
  `docs/active/tickets/T-080-01-03.md`.
- The branch is ahead of `origin/main` with the dependency source and completion commits present.

## Product and story context

- Vend is a local-first clearing and orchestration tool whose gates make probabilistic work
  dependable without live supervision.
- P3 requires visible gate truth, P4 requires autonomous operation, and P5 keeps the evidence and
  gesture local.
- E-079 introduced a Lisa-to-Vend cord: a whole-loop completion marker is recorded locally and
  consumed by the free `vend settle` verdict.
- E-080 was created after the first real trial showed that the recorder's intentional error
  containment also hid recorder failures.
- The hook must continue never to block Lisa; visibility therefore has to come from Vend-owned
  state, not louder hook stderr or a new approval step.
- Parent story `S-080-01` confines this slice to the seam recorder contract and settle's loop/cord
  surface.
- Hook changes, ntfy content, retry/queue semantics, and delivery guarantees are explicitly out of
  scope.
- The honest boundary remains: a recorder which never starts cannot write a trace.

## Ticket acceptance

- A verdict must carry and render `cord: last recording failed — <reason>` when the seam failure
  log is newer than the last successful claim.
- The reason must be recovered verbatim from the logged JSON string.
- No log means no cord line.
- A successful claim newer than the log means no cord line.
- The cord line is normal verdict information, not a refusal and not a settle blocker.
- `bun run check` must be green.

## Settled producer contract

- `T-080-01-02` added `.vend/lisa-loop-settled-failures.jsonl`.
- The path is exported as `DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH` from
  `src/seam/lisa-loop-settled-core.ts`.
- Each producer record is one JSON object per physical line with exact insertion order
  `timestamp`, then `reason`.
- `timestamp` is canonical ISO-8601 UTC text minted by Vend's recorder clock.
- `reason` is a nonblank string and is serialized with JSON escaping, so parsing restores embedded
  controls verbatim.
- Classifier refusals retain their existing exact reasons.
- Marker publication errors use `marker write failed: <detail>`.
- The producer appends one record for refusal or marker-write failure.
- Ignored events and successful marker publication append no record.
- The log is local, append-only, and covered by `.vend/*` in `.gitignore`.
- The producer intentionally did not implement trace parsing, freshness, or rendering; those were
  reserved for this ticket.

## Existing pure settle core

- `src/settle/settle-core.ts` owns deterministic verdict assembly.
- It receives plain values: graph, pending loop-marker contents, last-settle contents, gate,
  presweep, and review concerns.
- It parses the pending loop marker through the seam's closed-schema parser.
- Malformed loop-marker bytes produce a typed `malformed-loop-settled-marker` refusal.
- It parses `.vend/last-settle.json` through its own closed v1 schema.
- The last-settle marker contains only `version` and sorted unique `doneTicketIds`.
- Absence of the last-settle marker means first settle.
- Invalid last-settle bytes produce a typed refusal.
- The core copies and validates gate/presweep/review facts, derives active epic clearance and the
  full done-ticket frontier, and returns one `SettleVerdict`.
- `SettleVerdict` currently has loop provenance but no cord-failure field.
- Exceptions are reserved for repository gate, presweep, and structured review concerns.
- A cord failure is not one of those exceptions under the ticket contract.

## Existing settle shell

- `src/settle/settle.ts` owns filesystem discovery, process execution, marker persistence, claim
  lifecycle, and rendering.
- `runSettle` atomically renames `.vend/loop-settled.json` to a unique `.settling` sibling before
  the longer observation work.
- The claimed marker's inode and filesystem metadata survive the rename.
- A malformed marker or thrown operation restores the claim without replacing a newer stable
  producer marker.
- A verdict writes `.vend/last-settle.json` atomically before removing the successful claim.
- Every successful verdict writes the last-settle marker, even when no loop marker was pending.
- The last-settle marker is therefore also a durable acknowledgement that the preceding local
  state was shown by a free verdict.
- The shell currently reads optional file contents but not optional file metadata.
- `readFile` plus `stat` can provide a coherent-enough local observation for this advisory line;
  marker claim itself remains the only strict atomic ownership boundary.
- `runSettle` has no clock option and does not need to mint a new time fact for this ticket.
- Filesystem modification times already order the durable files involved without changing either
  persisted JSON schema.

## Freshness facts available without schema migration

- The failure log's modification time advances when a producer appends a record.
- A claimed loop marker retains the successful marker file's modification time.
- The prior `.vend/last-settle.json` has the modification time of the most recent successful
  verdict acknowledgement.
- The latest applicable claim/acknowledgement watermark can be represented as the maximum of the
  prior last-settle mtime and the current claimed marker mtime.
- A trace is newer exactly when its mtime is strictly greater than that watermark, or when no
  watermark exists.
- Equality should not count as newer; the ticket uses “newer,” not “same time or newer.”
- Comparing mtimes avoids adding a timestamp field to either closed v1 marker schema.
- It also avoids treating the trace's payload timestamp as Lisa provenance; that timestamp remains
  diagnostic producer data.
- After a warning is carried by a successful verdict, the newly written last-settle marker is
  newer and an immediate repeat will not reprint the same warning.
- A current successful marker whose mtime is newer than the trace suppresses the cord line on that
  same verdict.
- A trace newer than an old pending marker remains visible; merely claiming stale success does not
  erase later failure evidence.

## Trace parsing boundary

- The producer contract guarantees valid JSONL, but the reader still faces external file bytes.
- A physical line can be blank, malformed, torn, wrong-schema, or valid.
- The cord must never turn malformed diagnostic state into a settle refusal under this ticket.
- The smallest safe read policy is to scan nonblank lines from newest to oldest and select the
  first exact valid two-field failure record.
- Invalid lines are skipped rather than thrown or promoted into a refusal.
- Exact field validation prevents unrelated JSON objects from becoming a user-visible reason.
- Canonical timestamp validation can match the producer serializer's contract.
- The selected reason must be copied without trimming so admitted surrounding whitespace or
  embedded controls remain verbatim.
- If no valid record exists, there is no renderable cord failure and settle continues normally.
- This parsing and freshness selection are deterministic over strings and numbers and belong in
  the pure core.

## Rendering boundary

- `renderSettleResult` renders refusals through a separate early return with red lines.
- Normal verdict rendering starts with `settle`, then the loop line, delta, epic lines, gate,
  presweep, review concerns, and exceptions.
- A cord warning should be inserted into the normal verdict branch as an ordinary uncolored line.
- Keeping it adjacent to the loop line makes both halves of the Lisa cord visible together.
- The exact required prefix and separator are already fixed by epic/story/ticket acceptance.
- No recovery action is required by acceptance, and inventing one would turn historical diagnostic
  evidence into an andon or refusal.

## Existing test surfaces

- `src/settle/settle-core.test.ts` uses plain graph and string fixtures and is the natural home for
  parser/freshness policy tests.
- Its `input()` helper centralizes all `ComputeSettleInput` fields and will need a default cord
  observation.
- `src/settle/settle.test.ts` has a manually assembled complete verdict for renderer assertions.
- The same file has a real temporary Git repository fixture for marker claim/consume lifecycle.
- The fixture can create the failure log and use `utimes` to set deterministic modification times,
  avoiding sleeps and timestamp-resolution races.
- Existing lifecycle coverage already proves marker consumption, last-settle persistence,
  immediate repeat behavior, malformed marker restoration, and untracked duration rendering.
- The focused baseline is 33 passing tests and 127 expectations across the two settle files.
- Full verification is `bun run check`, which runs BAML generation, strict TypeScript, and all Bun
  tests.

## Scope conclusion

- Expected production changes are limited to `src/settle/settle-core.ts` and
  `src/settle/settle.ts`.
- Adjacent tests are the two settle test files.
- The durable seam contract should be updated to describe the now-implemented consumer behavior.
- No seam producer code, fixture marker, hook, CLI dispatcher, ticket card, or sweep code needs to
  change.
