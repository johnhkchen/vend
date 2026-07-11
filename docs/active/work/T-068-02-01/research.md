# Research — T-068-02-01: over-envelope-record-marker

## Ticket and story contract

The ticket adds a countable, one-way warning marker to a run-log record. Its sole
acceptance criterion is persistence and compatibility: a marked record must survive
`build → serialize → revive`, while an unmarked record must retain the exact serialized
shape that existed before E-068.

The parent story, `S-068-02`, defines the larger sequence. This ticket establishes the
record shape first. T-068-02-02 will change classification in the two mirrored cast cores,
and T-068-02-03 will wire runners to materialize and surface cleared overshoots. The DAG is
deliberately serial because the later tickets consume the record contract created here.

The story's behavioral boundary is detect-after. A token ceiling cannot undo already-spent
tokens. A run that clears its gates but finishes above the envelope will eventually be
materialized and recorded as a success carrying a warning. Gate failures and timeouts remain
discard paths. This ticket does not implement those disposition rules; it only gives them a
durable record field.

The story also states how the marker will be interpreted: a present warning makes an
otherwise cleared overshoot countable. Absence means no warning was recorded. No historical
ledger rewrite is part of this slice.

## Repository guidance available

The requested root `AGENTS.md` does not exist in this repository or its parent directory.
The repository does contain `CLAUDE.md`, which identifies Vend as a TypeScript/Bun project,
points to the canonical vision, lists the standard `bun run check` gate, and directs work to
the RDSPI workflow. The workflow itself was read from `docs/knowledge/rdspi-workflow.md`.

`docs/knowledge/vision.md` names the principles cited by the ticket. P3 says gates are the
contract that make autonomous output trustworthy. P4 says runs proceed against those gates
rather than live supervision. A persistent warning is an observation about a clearing run,
not a substitute for its gates.

## Dependency state

The ticket depends on T-068-01-03. That ticket is at `phase: done`; its review identifies
commit `ae3c287`. The dependency changed `totalTokens` in the same source file and added tests
to the same test file, which explains the dependency edge. Those changes are present in the
current branch.

The working tree contains unrelated active-ticket changes. They include Lisa metadata,
ticket/story files, work artifacts, and orphan-graph work. This ticket must avoid staging or
committing those paths. The two owned source files are currently clean relative to HEAD.

## Run-log module boundary

`src/log/run-log.ts` is the single source of truth for run-record construction,
serialization, revival, and JSONL persistence. It deliberately imports nothing from
`src/executor/` or `src/budget/`. Structural input shapes are declared locally so the log is
a sink rather than a collaborator.

The module has two pure faces and two thin filesystem verbs:

- `buildRunRecord` validates and normalizes a `RunRecordInput` into a frozen `RunRecord`.
- `serializeRunRecord` renders a record as one newline-terminated JSON object.
- `reviveRecord` converts an already-parsed unknown value into a normalized record or `null`.
- `readRuns` parses JSONL, retaining good records and counting unusable lines.
- `appendRunLog` and `loadRunLog` are the filesystem write/read boundaries.

The write boundary treats invalid required identifiers as caller errors and throws. The read
boundary is total and tolerant: malformed optional fields are dropped, while malformed core
records are skipped. This asymmetry prevents a torn historical line from hiding all usable
ledger history.

## Existing record shape

`RunRecordInput` carries required identity, outcome, usage, gates, timestamps, and several
optional observational fields. `RunRecord` is the normalized serialized shape and stamps
schema version 1.

Optional fields currently demonstrate three semantic categories:

- `intervened?: boolean` preserves both `true` and `false`; absence means unknown.
- `turnsUsed?: number` preserves valid non-negative integers, including zero.
- `intervenedAttested?: true` and `reducedGrounding?: true` are one-way markers.

The record schema remains version 1 as optional fields have been added compatibly. Old lines
without newer optional fields revive successfully. Serialization relies on object property
presence and insertion order; conditional spreads omit absent fields entirely.

## Exact one-way marker precedent

`reducedGrounding` is the closest precedent and is explicitly named by the ticket.

On the input interface, `reducedGrounding?: boolean` lets runner code forward a boolean without
having to narrow it to the literal type. Its documentation states that only `true` is
meaningful and that false/absence are identical.

On the normalized record, `reducedGrounding?: true` expresses the stronger invariant: if the
property exists, its value is exactly `true`.

`normalizeReducedGrounding` returns `true` only for `v === true`; false, absence, and malformed
values become `undefined`. `buildRunRecord` invokes that helper and conditionally spreads the
field only when truthy. `reviveRecord` applies the same normalization at the tolerant read
boundary and uses the same conditional spread.

The resulting serialized distinction is binary by property presence:

- marked: the JSON object contains `"reducedGrounding":true`;
- unmarked: there is no `reducedGrounding` key at all.

`intervenedAttested` follows the same write-side shape, though its reviver also derives the
flag from a legacy raw attestation object. The over-envelope marker has no analogous legacy
derivation source because no pre-E-068 record contains it.

## Existing test pattern

`src/log/run-log.test.ts` colocates unit coverage for all pure run-log behavior. The
`baseInput` helper returns a complete `RunRecordInput`, with each test overriding only the
field under examination.

The `reducedGrounding marker` describe block covers five relevant dimensions:

1. `true` survives build, serialize, parse, and revive.
2. absence omits the property and its key from serialized bytes.
3. explicit `false` is treated as absence and never written.
4. malformed build/read values degrade to absence without invalidating the record.
5. a literal legacy line without the field parses with an undefined marker.

The ticket acceptance criterion specifically requests the back-compat test in this file and
says to mirror that one-way flag. The existing tests provide both the fixture idiom and the
expected assertion vocabulary (`"field" in rec`, `.includes(...)`, and revived property).

## Serialization and byte compatibility

`serializeRunRecord` is a direct `JSON.stringify(record) + "\n"`. It does not add defaults,
sort keys, or rewrite records. Therefore byte compatibility for a newly optional field depends
on keeping that field out of the record object when it is absent.

The strongest local compatibility proof can compare serialized output from two otherwise
identical inputs: one omits the new field and one explicitly supplies `false`. Their strings
must be equal. It can also pin the existing legacy string for an input that never mentions the
field. The reduced-grounding tests currently assert key absence but do not compare two complete
serialized strings.

Revival constructs a new canonical object rather than returning the parsed object. A new field
must be explicitly read and spread there or it will disappear across serialize/revive even if
the writer emitted it.

## Naming evidence

The ticket, story, successor tickets, and epic consistently call the condition
“over-envelope” and the record value a marker or warning. No existing source symbol uses that
phrase. TypeScript record fields elsewhere use lower camel case (`reducedGrounding`,
`turnsUsed`, `intervenedAttested`), so the natural vocabulary available to downstream tickets
is an `overEnvelope` field.

The marker represents a boolean fact, not an overshoot amount. `wallet.ts` separately exposes
a `DebitResult.overshoot: Budget`, but the ticket does not ask the run log to persist either
denomination or magnitude. The record already carries `envelope` and raw usage, so token spend
can be derived independently where needed.

## Scope boundaries and constraints

- Owned production surface: `src/log/run-log.ts`.
- Owned test surface: `src/log/run-log.test.ts`.
- Required artifacts: this ticket's RDSPI work directory.
- No runner, classifier, recalibration, wallet, or presentation changes belong here.
- No schema-version bump or historical JSONL migration is requested.
- No outcome change belongs here; later tickets decide and wire `success` versus discard.
- The run-log zero-coupling invariant remains in force.
- The marker is an observation, so malformed/false values follow tolerant omission behavior.
- Existing records without the marker must remain readable and byte-identical when rebuilt.
- The full repository gate is `bun run check`; the focused gate is
  `bun test src/log/run-log.test.ts`.

## Research conclusion

The repository already contains a complete structural analogue for this ticket. The change
surface is localized to the two run-log interfaces, one normalization helper, the conditional
spreads in build and revive, documentation, and a mirrored test block. Downstream behavior is
intentionally absent until the dependent tickets consume the new record contract.
