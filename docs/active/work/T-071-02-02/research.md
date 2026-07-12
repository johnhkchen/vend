# Research — T-071-02-02

## Assignment and phase context

- The ticket begins in `research` phase.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Phase artifacts belong in `.lisa/attempts/T-071-02-02/1/work/`, not the shared
  `docs/active/work/T-071-02-02/` directory.
- Lisa owns ticket phase/status transitions; this worker must not edit those frontmatter fields.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative paths.
- The worktree contains unrelated Lisa configuration, provenance, ticket, hook, and prior-ticket
  artifact changes. They are not owned by this ticket and must remain untouched.

## Story contract

- Parent story: `S-071-02`, “overflow-aware-default-seat.”
- The story covers inferred default-seat selection end to end.
- This ticket is the serialization-schema branch of that story.
- Its sibling `T-071-02-01` owns the lane-heat reader.
- The downstream integration ticket `T-071-02-03` owns inference injection, materialization
  stamping, effect threading, and cast-to-run-record threading.
- The DAG intentionally lets the reader and marker schema run in parallel because they edit
  disjoint files.
- This ticket therefore must not edit `src/play/lane-heat.ts`, `src/play/decompose-effect.ts`,
  `src/engine/play.ts`, `src/engine/cast.ts`, or their integration tests.
- Story acceptance distinguishes three paths: inferred alternate seat, both lanes cool, and
  explicit agent override. Only the durable marker shape needed by the first path belongs here.
- The story’s honest boundary is fixture-level proof with no live metered mint.
- Heat is relative recent burn, not an absolute quota fraction.
- Live lane monitoring, runtime 429 interception, more seats, and Lisa dispatch changes are out
  of scope.

## Charter and vision constraints

- P3, “Gates are the contract,” requires the marker behavior to be pinned by enforceable tests.
- P4, “Autonomy by default,” is advanced by retaining enough provenance to audit automatic
  routing without requiring live supervision.
- Local-first behavior means the append-only JSONL ledger is the durable source of truth.
- Executor agnosticism means the log layer should store facts without importing executor policy.
- The run-log module already documents a zero-coupling boundary from executor and budget modules.
- The marker must make inferred routing countable and auditable, not introduce a dashboard or
  active monitor.

## Ticket acceptance

- `buildRunRecord` tests must show `seatInferred` written when supplied.
- `reviveRecord` tests must show the marker retained when valid.
- The marker contains the chosen seat and the heat reason.
- Absent and malformed markers must be omitted byte-identically.
- The implementation must follow the `normalizeSeatDefaulted` atomic-marker discipline.
- A valid marker must survive a `readRuns` round-trip.
- `bun run check` must be green.

## Run-log module boundary

- `src/log/run-log.ts` contains both the pure durable schema and thin filesystem shell.
- `RunRecordInput` is the pre-normalization caller contract.
- `RunRecord` is the normalized, frozen durable record contract.
- `buildRunRecord` validates required fields and normalizes optional fields.
- `serializeRunRecord` emits compact JSON plus one trailing newline.
- `reviveRecord` accepts unknown parsed data and either returns a normalized record or `null`.
- `readRuns` parses JSONL, skips unreadable records, and reports the skip count.
- `loadRunLog` is the filesystem wrapper around the pure reader.
- The module imports no executor or routing registry modules.

## Existing schema ordering

- Optional run metadata currently appears after required usage/cost/gates.
- `seatDefaulted` is followed by `seatOfExecution` in `RunRecordInput` and `RunRecord`.
- Both fields are conditionally spread immediately before timestamps in built/revived records.
- Property insertion order is observable because serialization uses plain `JSON.stringify`.
- New optional fields must not perturb serialization when absent.
- When present, rebuilding a marker in a fixed key order produces deterministic nested JSON.

## `seatDefaulted` precedent

- `SeatDefaulted` is declared locally in `src/log/run-log.ts`.
- It contains three required strings: `requested`, `applied`, and `reason`.
- The type deliberately does not import executor policy or known-seat vocabulary.
- `RunRecordInput.seatDefaulted` is optional.
- `RunRecord.seatDefaulted` is optional.
- Absence is the one-way negative state: no marker means no fallback recorded or historical
  unknown.
- `normalizeSeatDefaulted` requires a non-null value and three non-empty strings.
- A partial marker is omitted as a whole.
- A malformed nested field is not partially retained.
- A valid marker is rebuilt from only the three schema fields.
- Rebuilding drops caller-attached extra nested fields.
- Values are preserved verbatim; the ledger does not apply seat policy.
- `buildRunRecord` calls the normalizer before constructing the frozen result.
- `reviveRecord` first verifies the raw marker is a non-null object, then calls the same normalizer.
- Both paths conditionally spread the property only when normalization succeeds.
- A malformed optional marker does not invalidate an otherwise useful historical record.

## `seatOfExecution` substrate

- Dependency ticket `T-071-01-01` added `seatOfExecution?: string` to both record interfaces.
- `normalizeSeatOfExecution` retains any non-empty string verbatim.
- It intentionally does not restrict values to `KNOWN_SEATS`.
- This field records the lane whose usage was actually burned.
- It is distinct from routing-disposition provenance such as `seatDefaulted` or `seatInferred`.
- Its tests establish the expected `readRuns` round-trip and absent-field byte compatibility.
- The current source includes dependency commit `e616525`.

## Write boundary behavior

- Required identity, outcome, and timestamp errors throw at `buildRunRecord`.
- Optional metadata is generally coerced or omitted rather than causing a write failure.
- `buildRunRecord` returns `Object.freeze(...)` for the top-level record.
- Nested marker objects are canonical copies but are not separately frozen.
- Optional values are normalized into local variables before record construction.
- Conditional object spreads prevent absent keys from appearing in the serialized object.
- An input with an invalid optional marker can serialize identically to the same input without
  that marker if all other fields are identical.

## Read boundary behavior

- `reviveRecord` is documented as pure and total.
- Invalid required record structure returns `null`.
- Invalid optional metadata is dropped while the record remains readable.
- The current schema version is restamped on revival.
- `readRuns` splits on newlines and ignores blank lines.
- JSON parse failures and `null` revival results increment `skipped`.
- Valid records with malformed optional markers do not increment `skipped`.
- A full acceptance proof should use `readRuns`, not only direct `reviveRecord`, because the ticket
  explicitly names the ledger round-trip.

## Test organization

- `src/log/run-log.test.ts` is the pure test surface for the module.
- `baseInput` constructs a complete valid `RunRecordInput` and allows field overrides.
- Marker tests are organized in dedicated `describe` blocks near the end of schema tests.
- The `seatDefaulted` block covers valid canonical round-trip, absent byte fixture, legacy read,
  partial build omission, extra-key removal, and malformed revival.
- The `seatOfExecution` block covers raw future-seat preservation, absent byte fixture, legacy
  read, and malformed revival.
- Existing tests use literal pre-feature JSONL lines to prove exact serialization compatibility.
- Existing tests use unsafe casts only to simulate malformed runtime inputs beyond TypeScript’s
  static contract.
- The test suite uses Bun’s `describe`, `test`, and `expect`.
- No filesystem, clock, process, or model call is required for this ticket’s proof.

## Naming evidence

- The ticket and story consistently name the property `seatInferred`.
- The marker must identify the chosen seat and explain inference in terms of heat.
- The exact nested key names are not separately prescribed beyond “chosen seat + heat reason.”
- Existing `SeatDefaulted` uses factual nouns matching the disposition: `requested`, `applied`,
  and `reason`.
- The story calls the recorded value the “chosen seat” and the explanation the “heat reason.”
- Downstream integration will consume the exported marker type or satisfy it structurally.

## Repository and verification constraints

- The branch is ahead of `origin/main` and the worktree is dirty from orchestration and another
  ticket.
- `src/log/run-log.ts` and `src/log/run-log.test.ts` are currently clean.
- Exact-path Lisa commits allow this ticket to avoid unrelated ordinary-index changes.
- The project’s authoritative gate is `bun run check`.
- The gate runs BAML generation, TypeScript checking, and the full Bun test suite.
- Bun must not be upgraded as part of this work.

## Research conclusions (descriptive)

- The requested field belongs entirely within the existing run-log pure schema boundary.
- The `seatDefaulted` implementation is a direct structural precedent for atomic marker handling.
- `seatOfExecution` demonstrates raw lane fact preservation but is not a replacement for inferred
  routing provenance.
- Exact byte compatibility depends on conditional omission and stable property order.
- The existing focused test file can prove every ticket acceptance clause without exercising the
  impure append/load shell.
- No new module, dependency, schema-version bump, migration, or routing-registry import is implied
  by the current append-only compatibility conventions.
