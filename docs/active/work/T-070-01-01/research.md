# Research — T-070-01-01: run-log seat-defaulted marker schema

## Ticket and story position

The ticket starts in `phase: research`, has no dependencies, and is the first of three tickets in S-070-01.
Its single acceptance criterion requires a `RunRecordInput` marker carrying requested raw seat,
applied default, and reason to serialize/revive byte-stably. An input without the marker must
produce bytes identical to a pre-E-070 record. The focused `src/log/run-log.test.ts` suite is the
named gate.

The story changes unknown-seat handling from discard to degradation. Eventually an unknown
`--agent` value will materialize the full board through the default seat, the ledger will retain
the fallback fact, and stdout will report requested versus applied seats. This ticket owns only
the ledger schema and unit contract.

The story assigns other behavior elsewhere:

- T-070-01-02 owns the materialization guard, result report, and effect seat handling.
- T-070-01-03 owns cast-loop record forwarding and the stdout warning.
- `KNOWN_SEATS` is reused, not modified.
- Valid-seat behavior from E-069 remains unchanged.
- `unknown-seat` stays in the outcome vocabulary for append-only-ledger compatibility.
- Ticket bodies, epic cards, and the BAML schema are outside the slice.

The honest boundary is fixture-only and token-free. No live cast is required.

## Vision and charter grounding

The ticket advances P4 and P6. P4 is served by leaving durable evidence when autonomous work
degrades safely instead of demanding supervision. P6 is served by recording requested/applied
seat names as structural data without importing executor policy into the ledger.

The vision makes gates and countable evidence the consistency contract. Here, consistency means
the degradation fact survives both ledger directions while historical ordinary records retain
their established bytes.

## Run-log boundary

`src/log/run-log.ts` is an append-only JSONL ledger with a pure core and thin impure shell.

```text
RunRecordInput -> buildRunRecord -> RunRecord -> serializeRunRecord -> JSONL
JSON.parse result -> reviveRecord -> RunRecord | null
```

`readRuns` composes parse/revive over text. `appendRunLog` and `loadRunLog` are filesystem shells.
The module imports neither executors nor budgets; it declares local structural contracts and acts
as a sink. Callers classify outcomes and degradations. The log validates and preserves facts.

`serializeRunRecord` is only `JSON.stringify(record) + "\n"`. Byte stability is therefore a
property of the canonical object shape and property order created by build/revive.

## Existing schema evolution

The schema version is 1. The repository evolves version 1 through optional fields whose absence
is meaningful. The reader accepts absent newer fields and drops malformed optional metadata.

Relevant precedents:

### `intervenedAttested`

- caller supplies an optional boolean;
- only true is emitted;
- false/absence do not alter canonical bytes;
- a historical raw attestation object can also revive the normalized fact.

### `reducedGrounding`

- input is `reducedGrounding?: boolean`;
- record is `reducedGrounding?: true`;
- a private normalizer retains only primitive true;
- builder and reviver conditionally spread the field;
- false, absent, and malformed values are omitted;
- tests cover round-trip, omission, malformed data, and a legacy line.

### `overEnvelope`

- follows the same optional-input/literal-true stored pattern;
- explicit false is tested byte-identical to absence;
- a literal pre-E-068 record proves old-line compatibility;
- this is the strongest direct template named by the ticket.

## Structured-marker difference

Existing one-way degradation markers are booleans. `seatDefaulted` must retain three facts, so
property presence alone is insufficient. The new marker is naturally an optional structured
object whose presence is the one-way condition and whose content describes it.

The module already normalizes structured optional objects. `Envelope` is locally typed, rebuilt
canonically by the writer, runtime-checked by the reviver, omitted when absent, and dropped rather
than record-fatal when malformed. `GateResult` normalization also selects supported fields and
drops extras. These patterns support a canonical three-string marker without a new subsystem.

No `seatDefaulted` symbol currently exists in the repository. No current run-log type imports a
seat registry or executor type.

## Writer behavior

`buildRunRecord` validates required identifiers/timestamps, normalizes optional fields into local
variables, and constructs one frozen object. Optional fields use conditional object spreads.
An absent new marker must not add undefined, null, false, or an empty object because each would
change JSON bytes. A present nested object needs deterministic key selection and ordering.

The builder already defensively copies normalized usage, envelope, and gates. It does not enforce
cross-module policy relationships. For example, `overEnvelope` is preserved without recomputing
budget disposition. The same boundary applies to seat defaulting.

## Reader behavior

`reviveRecord` is pure and total. Missing required fields or unknown outcomes reject the line.
Malformed optional fields are omitted so the remaining historical record stays useful.

Existing marker revival narrows raw unknown values, reuses the writer normalizer, and spreads only
a valid normalized result. A structured marker can follow this path: require a non-null object,
require all three named strings, rebuild a canonical object, and otherwise omit it.

## Tests and fixtures

`src/log/run-log.test.ts` uses Bun tests and fabricated plain values only. `baseInput(over)` returns
a complete `RunRecordInput`, with overrides applied last. There is no filesystem, clock, spawn,
network, or model in the schema tests.

Marker blocks sit together before ledger filtering/derivation tests. The `overEnvelope` block tests:

1. build/serialize/parse/revive persistence;
2. own-property and serialized-key absence;
3. explicit false versus absent exact serialized equality;
4. malformed writer input omission;
5. malformed reader metadata omission without losing the record;
6. a literal historical line without the field.

For a structured marker, the positive case can additionally reserialize the revived record and
compare complete bytes. A literal pre-E-070 expected line can directly pin the absent writer shape.

## Compatibility constraints

The ledger is append-only:

- new readers must accept old lines without the marker;
- new writers must keep ordinary records in their old canonical byte shape;
- marked records must contain the complete three-fact object;
- malformed optional marker data must not discard an otherwise valid line;
- absence means no degradation was recorded or historical unknown.

The ticket's “one-way/absent” wording rules out a negative marker and an empty object. Property
absence is the only compatible negative state.

## Working-tree constraints

The worktree contains unrelated Lisa/board changes that predate this ticket. They must not be
staged or altered. The E-070 story/tickets are currently untracked; their frontmatter remains
Lisa-owned. Only ticket-owned source, tests, and `docs/active/work/T-070-01-01/` artifacts belong
in this work's commits.

## Verification surface

Focused acceptance gate:

```sh
bun test src/log/run-log.test.ts
```

Repository gate:

```sh
bun run check
```

The latter runs BAML generation, TypeScript typechecking, and the full Bun test suite.

## Research conclusion

The ticket fits the established optional-field seam. The only new aspect is a structured marker
instead of literal true. Existing structured normalization plus one-way omission patterns cover
that need. No outcome, schema version, executor, cast, materialization, BAML, or seat-registry
change belongs in this ticket.
