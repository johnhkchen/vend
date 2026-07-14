# Research — T-071-01-01

## Ticket and story contract

- Ticket: `T-071-01-01`, `run-log-seat-of-execution-field`.
- Parent story: `S-071-01`, `lane-heat-ledger-substrate`.
- The ticket adds an optional `seatOfExecution` fact to the run ledger.
- The fact identifies the executor lane whose usage a run burned.
- The immediate value is countable per-lane usage for later heat inference.
- The ticket advances P7: budget is a hard contract.
- The field is substrate only; no heat interpretation belongs here.
- Story ticket `T-071-01-02` later stamps the field from the resolved executor.
- That dependency makes cast-loop edits explicitly outside this ticket.
- The story also excludes seat selection, cap signals, reset windows, and Lisa dispatch.

## Repository and workflow constraints

- Vend is TypeScript running on Bun.
- `bun run check` is the repository gate: BAML codegen, typecheck, and tests.
- Ticket work follows Research, Design, Structure, Plan, Implement, Review.
- Attempt artifacts belong under `.lisa/attempts/T-071-01-01/1/work/`.
- Lisa publishes admitted artifacts to the shared work directory.
- Ticket phase/status frontmatter is Lisa-owned and must not be edited manually.
- Ticket source commits must use `lisa commit-ticket` with exact include paths.
- Existing unrelated working-tree changes must remain untouched.
- The current tree has Lisa/config/hook changes and the Lisa phase transition.
- None of those changes are owned by this ticket.

## Relevant production module

- `src/log/run-log.ts` owns the append-only JSONL run ledger.
- It deliberately has a pure core and an impure filesystem shell.
- `buildRunRecord` validates and normalizes caller input.
- `serializeRunRecord` emits one compact JSON object plus one newline.
- `reviveRecord` reconstructs useful records from parsed historical data.
- `readRuns` parses JSONL, skips malformed records, and reports a skip count.
- `appendRunLog` composes build/serialize with mkdir and append.
- `loadRunLog` composes file reading with `readRuns`.
- The module imports filesystem/path utilities only.
- It intentionally imports neither executor policy nor budget policy.

## Existing schema shape

- `RunRecordInput` is the pre-normalization caller contract.
- `RunRecord` is the normalized frozen durable contract.
- Required fields are asserted as non-empty strings.
- Required outcomes are checked against `RUN_OUTCOMES`.
- Usage and cost have numeric defaults.
- Gate results have an array default.
- Newer optional metadata is conditionally spread into the record.
- Conditional spreading prevents absent keys from entering serialized JSON.
- Object construction order defines stable serialized key order.
- The schema version remains `1` across additive optional metadata changes.

## Optional-field precedents

- `envelope` is omitted when absent and tolerated when absent on read.
- `project` is omitted when absent; read consumers can apply a default bucket.
- `intervened` preserves both booleans, because false is meaningful.
- `intervenedAttested`, `reducedGrounding`, and `overEnvelope` are one-way flags.
- `turnsUsed` is omitted for absent or invalid values.
- `seatDefaulted` is the closest precedent named by acceptance.
- `SeatDefaulted` is declared locally in the log module.
- Its values are preserved without importing the known-seat registry.
- Its normalizer checks structural completeness, not routing policy.
- Its reviver drops malformed optional metadata without dropping the record.
- Its tests pin marked round-trip and unmarked byte compatibility.

## Seat policy boundary

- `src/play/agent-seat.ts` owns `KNOWN_SEATS`.
- Today that tuple is `claude | codex`.
- `run-log.ts` has no import from `src/play/agent-seat.ts`.
- Acceptance explicitly requires preserving that lack of policy coupling.
- The ledger is a sink for facts classified by its caller.
- It must preserve a raw supplied seat even if not in `KNOWN_SEATS`.
- Therefore a future/unknown test value is important evidence.
- The ledger must not relabel, default, or reject that value.

## Write path

- `buildRunRecord` first validates required record identity/timestamps/outcome.
- It computes normalized optional values before object construction.
- It creates a fresh object and freezes the top-level record.
- Optional fields are spread before timestamps.
- `serializeRunRecord` uses plain `JSON.stringify` without indentation.
- An absent property is therefore truly absent from the JSON bytes.
- Adding an unconditional `undefined` property would be shape-visible in memory.
- The established convention is to omit the property from both object and bytes.

## Read path

- `reviveRecord` accepts `unknown` and is total.
- Required structural failure returns `null`.
- Optional metadata failure normally omits only that metadata.
- The return value is rebuilt in canonical field order and frozen.
- `readRuns` exercises the actual JSONL boundary around `reviveRecord`.
- Acceptance specifically calls for survival through `readRuns`, not only direct revival.
- A historical line without the field must remain a usable record.
- Its revived record must not acquire a guessed lane.

## Existing tests

- `src/log/run-log.test.ts` is the focused pure-unit test suite.
- `baseInput` provides a complete record with per-test overrides.
- `ledgerOf` builds serialized JSONL fixtures from inputs.
- Tests already cover countability, required validation, optional fields, and revival.
- The `seatDefaulted` block contains a literal pre-feature JSONL line.
- It asserts exact serialization for an absent optional marker.
- It also asserts historical read compatibility.
- This ticket can mirror that evidence with a dedicated `seatOfExecution` block.
- No filesystem test is needed because the impure functions are thin composition.
- No cast test belongs here; it is the dependent ticket's acceptance surface.

## Compatibility observations

- An optional property added after existing optional metadata preserves old bytes when absent.
- A literal pre-E-071 line is the strongest byte-compatibility oracle.
- Reusing a line with a ticket-specific run id makes exact comparison readable.
- Revival must not synthesize `seatOfExecution` for legacy input.
- The field should read as `undefined` through normal property access when absent.
- The property should also fail the `in` check when absent.
- A supplied raw string must serialize exactly, with no trim or canonicalization.
- The existing `seatDefaulted` wording treats non-empty strings as structurally valid.
- The TypeScript input contract already limits normal callers to strings.
- A malformed read-side non-string can be omitted without losing the record.

## Impacted and non-impacted files

- Production impact: `src/log/run-log.ts`.
- Test impact: `src/log/run-log.test.ts`.
- Attempt artifacts: six markdown files in the private attempt work directory.
- No change is needed in `src/play/agent-seat.ts`.
- No change is needed in `src/engine/cast.ts` or `cast-core.ts`.
- No change is needed in executor implementations.
- No schema migration or historical ledger rewrite is required.
- No schema-version bump is indicated by existing additive-field practice.

## Constraints and assumptions surfaced

- `seatOfExecution` is durable fact metadata, not a one-way warning flag.
- Absence means historical/unknown, never a default seat.
- A present seat should remain verbatim even when policy does not recognize it.
- Structural string checking is compatible with the nearby precedent.
- Policy validation would violate both acceptance and module decoupling.
- Exact key position is not externally specified, but canonical reconstruction must be stable.
- The focused unit suite plus full repository gate can verify this isolated change.
- Current unrelated modifications must be preserved and excluded from Lisa commits.
