# Research — T-082-01-01 run-log cap-window marker

## Ticket and story contract

- Ticket `T-082-01-01` begins in `research` and belongs to story `S-082-01`.
- The ticket adds the run-ledger schema substrate only.
- Its purpose is to turn a provider cap / HTTP-429 window-exhaustion event from an
  invisible generic errored run into a durable, countable ledger fact.
- The ticket advances P7: budget is a hard contract. The provider reset window is
  the scarce capacity unit this epic ultimately needs to learn.
- Acceptance requires a complete marker to survive build, serialization, and
  revival.
- Acceptance also requires partial or malformed optional marker data to be omitted
  atomically without losing the containing run record.
- Marker-less records must remain byte-identical, including historical lines that
  have passed through the read-side revival path.
- `bun run check` is the repository-wide completion gate.

## Parent-story boundary

- `S-082-01` covers two ordered tickets.
- This first ticket owns only `src/log/run-log.ts` and its unit tests.
- `T-082-01-02` later owns classification of rate-limit-shaped executor failures in
  the cast settlement path and stamps this ticket's settled marker shape.
- The story explicitly excludes mid-run interception and rerouting.
- The story also excludes lane heat, capacity inference, budget, and wallet work.
- No live provider call is required. The story's proof is fixture-based and free.
- Historical ledger rows are not rewritten or backfilled.

## Epic context

- `E-082` upgrades lane capacity from a relative-burn heuristic to a locally learned
  quota-per-reset-window fact.
- The existing heat implementation cannot prove that a lane is near an absolute
  provider cap.
- Capacity learning depends on observing cap events, the burn recorded on their run
  rows, and their existing settlement timestamps.
- The cap event therefore needs a durable occurrence marker, but this ticket does
  not calculate capacity from it.
- `seatOfExecution` already names the lane whose capacity was burned.
- `usage`, `startedAt`, and `endedAt` already carry the remaining facts downstream
  learning can use.
- The new marker should not duplicate routing or capacity policy.

## Run-log module architecture

- `src/log/run-log.ts` is deliberately both a pure core and a thin impure shell.
- `buildRunRecord` validates required data and normalizes optional data into a
  frozen `RunRecord`.
- `serializeRunRecord` is a pure `JSON.stringify(record) + "\n"` boundary.
- `reviveRecord` is a pure, total read-side normalizer over parsed unknown data.
- `readRuns` parses JSONL and skips only lines whose required record structure is
  unusable.
- `appendRunLog` is the thin filesystem effect that composes build and serialize.
- The module imports no executor, budget, routing, heat, or provider policy.
- Locally declared structural interfaces preserve that zero-coupling boundary.

## Current record shape

- Required fields include schema version, run identity, play/epic/model, outcome,
  normalized usage, cost, gate results, and settlement timestamps.
- Optional facts are emitted with conditional object spreads.
- JavaScript insertion order is therefore part of stable JSON byte output.
- `RUN_LOG_SCHEMA_VERSION` remains `1`; optional additive fields have historically
  not required a version bump or a migration.
- `seatOfExecution` is an optional non-empty raw string and is not checked against
  `KNOWN_SEATS`.
- `RUN_OUTCOMES` has no rate-limit-specific outcome; the epic explicitly identifies
  that current state.
- This ticket asks for a marker, not a new terminal outcome.

## Structured marker precedents

- `SeatDefaulted` is a local interface with three required non-empty strings.
- `SeatInferred` is a local interface with two required non-empty strings.
- `CrossReviewSkipped`, `ArtifactDiscrepancy`, and `CrossVendorVerdict` use the same
  local structured-fact pattern.
- Each marker has a dedicated pure normalizer.
- A normalizer accepts a typed optional input but defensively validates runtime
  values because JSON and structurally typed callers can be malformed.
- Valid markers are rebuilt field-by-field rather than retained by reference.
- Rebuilding discards unknown nested keys and fixes deterministic key order.
- Required nested strings use the shared `isNonEmptyString` guard.
- A missing, partial, non-object, empty-string, or wrong-typed marker normalizes to
  `undefined`.
- The containing run remains valid when optional metadata is invalid.

## Write-side path

- `RunRecordInput` declares every optional field accepted from the cast shell.
- `buildRunRecord` validates only required record fields loudly.
- Optional markers are normalized before the frozen object is assembled.
- The normalized marker is conditionally spread only when complete.
- An absent marker therefore creates no key and changes no existing JSON bytes.
- A new structured marker can follow this path without touching filesystem code.

## Read-side path

- `reviveRecord` first validates required top-level data.
- Optional objects are guarded with `typeof value === "object" && value !== null`.
- They are then passed through the same normalizer used by the write side.
- This avoids write/read contract drift.
- The revived record is rebuilt in canonical field order and frozen.
- Historical records lack newer optional fields and therefore revive with those
  fields absent.
- Malformed optional metadata is intentionally lossy while the valid run row is
  retained.

## Serialization compatibility

- Existing tests pin literal historical JSONL strings for optional-field features.
- Marker absence is checked with both the `in` operator and literal byte equality.
- The strongest historical compatibility assertion is read then serialize: the
  revived record must produce the exact original line.
- Adding the conditional spread in a stable optional-field position leaves every
  marker-less record unchanged.
- Marked rows gain exactly one nested field and a trailing newline remains the only
  physical line boundary.
- No rewrite, schema migration, default object, `null`, or explicit false sentinel
  is compatible with the acceptance criterion.

## Existing test conventions

- `src/log/run-log.test.ts` uses `baseInput` to make deterministic run inputs.
- Marker tests are grouped in a dedicated `describe` block adjacent to related
  ledger provenance tests.
- Complete-marker tests assert the built value, revive the serialized JSON, and
  assert byte-stable reserialization.
- Compatibility tests use a literal pre-feature JSONL line.
- Partial write inputs use `as never` to exercise the runtime boundary despite the
  TypeScript interface.
- Malformed revived inputs start with an otherwise-valid serialized record and
  replace only the optional marker.
- Canonical-copy tests add an unknown nested diagnostic key and assert it is absent
  from the normalized value.

## Baseline verification

- `bun test src/log/run-log.test.ts` passed before modification.
- Result: 132 passing tests, 0 failures, 306 assertions.
- This establishes a clean focused baseline for the two ticket-owned files.
- The worktree contained Lisa-managed ticket/provenance activity unrelated to the
  ticket source unit; it must remain untouched.

## Constraints and assumptions surfaced by research

- The marker needs more structure than a boolean because acceptance explicitly
  distinguishes complete from partial marker data and the story calls for an
  interface.
- The ledger should preserve evidence supplied by settlement without deciding what
  constitutes a rate limit; classification belongs to the next ticket.
- The execution lane should remain single-sourced by `seatOfExecution` rather than
  repeated in the cap marker.
- Event time should remain single-sourced by the row's `endedAt`; no marker-local
  clock belongs in this pure module.
- The marker must contain enough controlled evidence for the next ticket to explain
  why settlement classified the event, while downstream capacity learning needs
  only its complete presence alongside existing row facts.
- No source outside `src/log/run-log.ts` and `src/log/run-log.test.ts` is required by
  this ticket's acceptance criteria.

## Relevant files

- `AGENTS.md` — project rules and required workflow.
- `docs/knowledge/rdspi-workflow.md` — six required phases and artifact contract.
- `docs/knowledge/vision.md` — local-first, executor-agnostic, hard-budget principles.
- `docs/knowledge/charter.md` — stable P7 and N4 definitions.
- `docs/active/epic/E-082.md` — learned-capacity motivation and exclusions.
- `docs/active/stories/S-082-01.md` — story scope and honest boundary.
- `docs/active/tickets/T-082-01-01.md` — ticket acceptance.
- `src/log/run-log.ts` — only production source in scope.
- `src/log/run-log.test.ts` — focused acceptance proof.
