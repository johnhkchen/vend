# Review — T-071-02-02

## Outcome

Acceptance is met.

The run-log now has an additive, optional `seatInferred` provenance marker containing the seat
chosen by default-seat inference and the heat reason supplied by the inference layer. Valid markers
survive the pure JSONL write/read boundary. Absent and malformed inputs are omitted, with tests
proving exact byte equality to a pre-marker record. The authoritative project gate is green and the
ticket-owned source files are committed through Lisa.

## Scope delivered

Delivered only the marker-schema branch assigned by `S-071-02`:

- durable marker type;
- write contract;
- read contract;
- atomic normalization;
- exact compatibility tests;
- `readRuns` round-trip proof.

Not delivered here, by story/DAG design:

- loading the ledger for a board-writing gesture;
- deciding when to infer;
- stamping the inferred agent on materialized tickets;
- adding `seatInferred` to `EffectResult`;
- threading the effect value through `cast` into `RunRecordInput`;
- decompose/chain end-to-end fixtures.

Those belong to downstream integration ticket `T-071-02-03`, which depends on this schema ticket
and sibling lane-reader ticket `T-071-02-01`.

## Commit

- Full id: `464c7174033e5b6d8297fd6f4d83e97762636fb2`.
- Subject: `feat(log): record inferred seat provenance (T-071-02-02)`.
- Method: `lisa commit-ticket`.
- Exact included paths:
  - `src/log/run-log.ts`
  - `src/log/run-log.test.ts`
- Diff size: 110 insertions across two files.
- Ticket-owned source files are clean after commit.

No ordinary `git add`, `git add -A`, or `git commit` was used. Existing unrelated worktree changes
were neither staged nor modified by the ticket source commit.

## File changes

### `src/log/run-log.ts`

Added exported durable type:

```ts
export interface SeatInferred {
  readonly seat: string;
  readonly reason: string;
}
```

Added optional `seatInferred?: SeatInferred` to:

- `RunRecordInput`, the caller/write contract;
- `RunRecord`, the normalized durable/read contract.

Added `normalizeSeatInferred`, which:

- requires a marker object;
- requires a non-empty string `seat`;
- requires a non-empty string `reason`;
- omits the marker atomically if either fact is missing or malformed;
- returns a fresh canonical `{ seat, reason }` object;
- drops extra runtime fields;
- preserves accepted strings verbatim;
- applies no known-seat or heat policy.

Wired the normalizer into `buildRunRecord` and `reviveRecord`. Both paths conditionally spread the
marker only after successful normalization. The field is ordered after `seatDefaulted` and before
`seatOfExecution`, grouping inferred/default routing disposition before actual execution-lane
provenance.

No schema version change was made. This follows the established optional-additive compatibility
strategy used by adjacent run-log fields.

### `src/log/run-log.test.ts`

Added five focused pure tests:

1. Chosen seat and heat reason survive build, serialization, `readRuns`, revival, and
   byte-identical reserialization.
2. An absent marker has no own property/key and exactly matches a literal pre-marker JSONL line.
3. A partial marker is atomically omitted and serializes exactly like the absent marker.
4. A valid marker carrying an extra diagnostic property is canonically copied without that field.
5. A malformed revived marker is dropped while the otherwise valid run record survives.

The tests use fabricated plain values only. They do not touch filesystem, clock, process, executor,
network, or model boundaries.

## Acceptance assessment

### `buildRunRecord` writes supplied `seatInferred`

Pass. The valid test builds with:

```ts
{
  seat: "codex",
  reason: "recent cost-weighted burn: claude hotter",
}
```

and asserts the normalized record carries both fields.

### `reviveRecord` preserves the marker

Pass. The valid line is passed through `readRuns`, which calls `reviveRecord`; the recovered record
carries the exact marker and reserializes byte-identically.

### Chosen seat plus heat reason are durable

Pass. The public marker has separate `seat` and `reason` string fields. The shape is structurally
compatible with sibling `inferDefaultSeat` output `{ seat: AgentSeat, reason: string }` while the
ledger stays independent of routing types.

### Absent marker is byte-identical

Pass. The test compares serialization to a literal JSONL record with no marker and asserts exact
string equality, including key order and trailing newline.

### Malformed marker is byte-identical

Pass. A partial `{ seat: "codex" }` runtime input with the same run id serializes exactly equal to
the absent-marker literal.

### Atomic-marker discipline

Pass. Partial input is dropped as a whole, extra fields are removed from valid input, and malformed
read metadata does not invalidate the enclosing record. This matches `normalizeSeatDefaulted`.

### Survives `readRuns`

Pass. The focused test explicitly calls `readRuns`, asserts zero skipped and one recovered record,
then asserts marker equality and byte-stable reserialization.

### `bun run check` green

Pass. Full result:

- BAML client generation succeeded.
- TypeScript `tsc --noEmit` succeeded.
- 1,644 tests passed.
- 1 integration test was intentionally skipped because no `dist/` artifacts existed.
- 0 tests failed.
- 4,974 assertions ran across 111 files.

## Focused verification

Command:

```bash
bun test src/log/run-log.test.ts
```

Result:

- 105 tests passed.
- 0 failed.
- 223 assertions.
- All five new `seatInferred` cases passed.

Whitespace/diff verification:

```bash
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Result: clean.

Post-commit source cleanliness:

```bash
git diff --quiet -- src/log/run-log.ts src/log/run-log.test.ts
```

Result: exit 0.

## Architecture assessment

The change preserves the project’s pure-core/impure-shell rule:

- marker validation and normalization are pure;
- write/read proofs operate on plain values and strings;
- no new filesystem behavior was needed;
- the existing append/load shell remains unchanged.

The change also preserves run-log’s dependency boundary:

- no import from `src/play/lane-heat.ts`;
- no import of `AgentSeat` or `KNOWN_SEATS`;
- no executor dependency;
- no heat-policy logic in persistence.

This makes the schema executor-agnostic and forward-compatible. The current inference reader’s
`AgentSeat` value is assignable to the durable string field, but the ledger does not reject future
raw seat vocabulary.

The marker is distinct from both adjacent provenance fields:

- `seatDefaulted` records an explicit requested seat degrading to a default;
- `seatInferred` records an automatic default choice when no explicit seat was supplied;
- `seatOfExecution` records where usage was actually burned.

Keeping these facts separate preserves audit meaning and makes inferred choices countable without
parsing overloaded strings or inventing a false request.

## Compatibility assessment

Compatibility is additive:

- historical records lack the optional property and continue to revive;
- ordinary new records omit the property entirely;
- malformed optional metadata does not make a line unreadable;
- absent/malformed build output is exact-byte compatible;
- version 1 remains appropriate under existing run-log conventions;
- no migration or ledger rewrite is required.

When valid, the normalizer reconstructs the nested object in fixed `seat`, `reason` order. This
produces deterministic marked bytes and prevents incidental caller diagnostics from leaking into
the durable schema.

## Test coverage gaps

No acceptance-critical gap remains within this ticket.

Deliberately not tested here:

- `appendRunLog` filesystem writes, because it is the unchanged thin shell around tested pure
  construction/serialization;
- `loadRunLog`, because the ticket explicitly needs the pure `readRuns` round-trip and no load
  behavior changed;
- exact live reason text from `lane-heat.ts`, because the log records supplied provenance and must
  not couple to heat policy;
- `AgentSeat` compile-time integration, because downstream structural threading is owned by
  `T-071-02-03`;
- decompose and chain behavior, which is downstream story integration.

## Open concerns and limitations

- The marker is now available but no production caller supplies it until `T-071-02-03` lands.
  This is expected DAG staging, not an acceptance gap for this schema ticket.
- `seat` and `reason` use the existing non-empty-string rule, so whitespace-only strings are
  structurally accepted. This intentionally matches `SeatDefaulted` rather than adding asymmetric
  policy at the durable boundary.
- The top-level record is frozen, while nested marker objects are canonical copies but not deeply
  frozen. This matches existing run-log marker behavior and was not broadened in this ticket.
- The reason is durable prose/evidence rather than a structured heat metric. That is the sibling
  reader and story contract; richer quota/reset-window data is explicitly deferred by `S-071-02`.
- The repository remains dirty with Lisa-managed configuration, provenance, ticket, hooks, and
  published work artifacts. Those changes are unrelated to the ticket-owned source files and were
  intentionally left untouched.

## Charter alignment

- P3: the durable contract is enforced by focused exact-byte and round-trip tests plus the full
  repository gate.
- P4: automatic inference provenance can be audited after the fact without adding live approval or
  supervision.
- P5/local-first vision: the fact survives the local append-only ledger boundary.
- P6/executor-agnostic vision: persistence imports no executor or seat-policy registry.

No non-goal is regressed. The change adds no chat loop, babysitting dashboard, one-off runner, or
executor behavior.

## Final checklist

- [x] Story read before implementation.
- [x] Research artifact written privately.
- [x] Design artifact written privately.
- [x] Structure artifact written privately.
- [x] Plan artifact written privately.
- [x] Progress artifact written privately and updated honestly.
- [x] Marker schema implemented.
- [x] Pure tests cover every ticket acceptance clause.
- [x] Focused suite green.
- [x] Full `bun run check` green.
- [x] Source committed with Lisa and exact include paths.
- [x] Ticket-owned source files clean after commit.
- [x] Review artifact completed privately.
- [x] Ticket frontmatter phase/status not edited by this worker.
- [x] No next ticket started.

## Final verdict

Green. T-071-02-02 is complete within its stated boundary, with no known critical issue requiring
human intervention. The durable schema is ready for `T-071-02-03` to thread actual inferred-seat
decisions onto run records.
