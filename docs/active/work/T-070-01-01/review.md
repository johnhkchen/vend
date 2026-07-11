# Review — T-070-01-01: run-log seat-defaulted marker schema

## Handoff summary

The append-only run log now supports an optional structured `seatDefaulted` degradation marker.
A caller can provide the requested raw seat, applied default, and reason through `RunRecordInput`.
The pure writer canonically stores the complete object, serialization emits it deterministically,
and the pure reviver preserves it across the read boundary.

When the marker is absent, no property or placeholder is written. An ordinary record therefore
retains the exact bytes it had before E-070. Malformed or partial optional marker data is omitted
without discarding an otherwise useful historical record.

This ticket establishes only the ledger schema seam. T-070-01-02 supplies the materialization/effect
report, and T-070-01-03 owns cast forwarding and warning output.

## Commits

- `70a9cb0` — `docs(T-070-01-01): define seat-default marker contract`
- `2340765` — `feat(log): add seat-defaulted run marker (T-070-01-01)`

The final Review artifact is committed separately as the Lisa-detected handoff. Ticket phase and
status were not manually changed.

## Files created

RDSPI artifacts:

- `docs/active/work/T-070-01-01/research.md`
- `docs/active/work/T-070-01-01/design.md`
- `docs/active/work/T-070-01-01/structure.md`
- `docs/active/work/T-070-01-01/plan.md`
- `docs/active/work/T-070-01-01/progress.md`
- `docs/active/work/T-070-01-01/review.md`

## Files modified

### `src/log/run-log.ts`

Added exported structural contract:

```ts
export interface SeatDefaulted {
  readonly requested: string;
  readonly applied: string;
  readonly reason: string;
}
```

Added optional `seatDefaulted?: SeatDefaulted` to both `RunRecordInput` and normalized `RunRecord`.
Property presence is the one-way degradation state; there is no false, null, or empty-object form.

Added private `normalizeSeatDefaulted` that requires all three values to be non-empty strings and
returns a fresh object containing exactly the supported keys in deterministic order. Extra caller
metadata is dropped. Values remain verbatim, including the requested raw seat.

Moved the existing `isNonEmptyString` helper earlier without changing its behavior so both writer
and reader normalization share it.

Threaded the marker through `buildRunRecord` and `reviveRecord` using conditional spreads after the
existing one-way warning markers. Both paths therefore create the same canonical nested/key order.

No imports were added. `serializeRunRecord` is unchanged. Schema version remains 1 and the outcome
vocabulary is unchanged.

### `src/log/run-log.test.ts`

Added six pure unit tests:

1. complete requested/applied/reason marker survives build, serialize, parse, revive, and reserialize;
2. absent marker emits a literal byte-identical pre-E-070 line;
3. the literal pre-E-070 line revives successfully without a marker;
4. a partial writer marker is omitted atomically;
5. a valid marker is canonically copied without extra nested fields;
6. malformed raw marker metadata is dropped without losing the base record.

No effectful integration fixture was added; all inputs are fabricated plain values.

## Files deleted

None.

## Acceptance criterion assessment

Status: met.

The criterion asks for a `RunRecordInput` carrying requested raw seat, applied default, and reason
to serialize/revive byte-stably, plus a marker-less input that stays byte-identical to pre-E-070.

### Marked round-trip

The positive fixture is normally typed through `RunRecordInput`:

```ts
{
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
}
```

The test asserts the complete object on the built record and revived record. It then serializes the
revived record and compares the entire line to the first serialization. This proves nested content,
top-level placement, nested property order, JSON output, and read normalization are byte-stable.

### Absent/pre-E-070 contract

The absence test does not compare two outputs both produced by new code. It pins a complete literal
historical JSONL line and asserts the new writer produces that exact string, including property
order and final newline. It separately asserts the object lacks an own marker property and the JSON
contains no marker key.

The same literal passes through `readRuns` with zero skipped lines and no revived marker. Thus both
new-writer old-shape compatibility and new-reader historical compatibility are directly covered.

### One-way semantics

Unlike scalar `overEnvelope?: true`, the marker's valid object presence is itself the positive
state. Absence is the only negative state. Partial, malformed, null-like, or empty replacements are
not admitted. This satisfies the ticket's named one-way/absent contract without inventing a
separate boolean.

## Test evidence

### Planned red proof

Before implementation:

```text
bun test src/log/run-log.test.ts
94 pass / 2 fail
```

Only the new positive and canonical-copy assertions failed, each receiving undefined instead of the
marker. Existing and compatibility cases remained green. This demonstrates the tests detected the
missing behavior.

### Focused run-log suite

After implementation:

```text
bun test src/log/run-log.test.ts
96 pass / 0 fail
195 expect() calls
```

### Typecheck

```text
bun run check:typecheck
exit 0
```

### Full repository gate

```text
bun run check
BAML generation: success
TypeScript: success
1621 pass / 1 skip / 0 fail
4893 expect() calls
1622 tests across 110 files
```

The single skip is the existing release acceptance integration requiring local `dist/` artifacts.
The full gate includes the concurrently landed T-070-01-02 materialization/effect changes, which
also verifies the two tickets' marker shapes remain structurally compatible.

## Coverage assessment

Coverage is strong for the ticket-owned seam:

- positive writer/read persistence is exercised through every pure transformation;
- complete serialized equality pins the marked canonical bytes;
- a literal historical line pins absent writer bytes and reader compatibility;
- partial/malformed data covers atomic structured validation;
- extra-key coverage pins schema selection rather than arbitrary object spreading;
- malformed read metadata proves optional corruption does not discard the record;
- full-suite type/runtime coverage checks additive compatibility across ledger and consumers.

No filesystem integration test was added. `appendRunLog` only composes the tested builder and
serializer; `loadRunLog` composes file reading with the tested text reader. There is no marker-
specific effect logic in those shells, matching the repository's pure-core convention.

No live cast was run. The story explicitly defines a fixture-proven/free boundary and runtime cast
wiring belongs to T-070-01-03.

## Architectural assessment

The log remains a decoupled sink. It does not import `KNOWN_SEATS`, the executor layer, engine play
types, or materialization code. It validates only structural completeness and does not decide which
seat is known, which default should apply, or whether a fallback was warranted.

T-070-01-02 independently exports an engine `SeatDefaulted` with `applied: "claude"`. That contract
is structurally assignable to run-log's executor-neutral `applied: string`. Keeping the local ledger
type avoids reversing module dependencies while allowing T-070-01-03 to forward the value directly.

The marker remains orthogonal to `RunOutcome`. `unknown-seat` stays in `RUN_OUTCOMES` solely because
old append-only records may contain it. No new outcome or migration was introduced.

Keeping schema version 1 follows existing additive optional-field evolution. The old shape needs no
rewrite and malformed optional metadata degrades quietly at the reader boundary.

## Open concerns and known limitations

### 1. Runtime records are not stamped by this ticket

The schema is available, but T-070-01-03 must still forward `EffectResult.seatDefaulted` into
`appendRunLog` and emit the requested-versus-default warning. Until then, live records do not gain
the marker. This is intentional DAG sequencing, not an unmet criterion here.

### 2. Cross-field consistency is caller-owned

`buildRunRecord` permits a well-formed marker with any outcome and any seat strings. It does not
enforce `requested !== applied`, `applied === "claude"`, membership in `KNOWN_SEATS`, or a particular
reason code. This preserves the sink boundary and P6 executor neutrality. T-070-01-02/03 own those
policy facts.

### 3. Absence is historically ambiguous

Undefined means no seat default was recorded. For pre-E-070 history, it cannot prove that no
fallback occurred. Consumers should count positive markers and not reinterpret absence as complete
historical evidence. This is the required cost of byte-compatible append-only evolution.

### 4. Two structurally compatible type declarations exist

Engine and run-log each declare `SeatDefaulted` at their own architectural boundary. Their current
shapes are structurally compatible and the full typecheck proves forwarding is possible. If either
shape evolves, T-070-01-03 or its tests should remain the integration tripwire. Centralizing the type
would couple the log to engine policy and is not recommended without a neutral shared-data module.

## Final assessment

The ticket acceptance criterion is fully met, the focused and repository gates are green, coverage
pins both positive and historical byte contracts, and no critical issue requires human intervention.
