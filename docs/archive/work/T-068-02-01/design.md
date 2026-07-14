# Design — T-068-02-01: over-envelope-record-marker

## Decision summary

Add `overEnvelope` as an optional one-way marker on the run-log input and normalized record.
The input accepts `boolean`; the normalized record permits only literal `true`. A private
normalizer maps exactly `true` to `true` and maps false, absence, and malformed values to
`undefined`. Both `buildRunRecord` and `reviveRecord` conditionally include the field only when
true.

Keep schema version 1. Do not add an outcome, warning collection, overshoot amount, derived
helper, or downstream classification behavior. Prove the contract in `run-log.test.ts` with a
dedicated block modeled on `reducedGrounding`, including an exact serialized-byte comparison
between omission and explicit false.

## Design goals

1. A marked record remains marked after serialize/parse/revive.
2. An unmarked record has exactly the pre-E-068 serialized representation.
3. The normalized type makes property presence equivalent to a true warning.
4. The tolerant read boundary drops invalid marker values without losing the record.
5. The run-log module remains decoupled from classifiers, budgets, executors, and runners.
6. Later tickets can stamp the marker with a simple structural field.

## Option A — optional one-way boolean field

Shape:

```ts
// input
readonly overEnvelope?: boolean;

// normalized record
readonly overEnvelope?: true;
```

Normalization follows `reducedGrounding`:

```ts
function normalizeOverEnvelope(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
}
```

Advantages:

- It is the exact established house pattern named by the acceptance criterion.
- Property presence is the counting predicate; consumers need no three-state interpretation.
- False and absence serialize identically, preserving old bytes.
- It adds no imports or module coupling.
- A runner can forward a normal boolean while the stored type retains a stronger invariant.
- Revival remains tolerant and total.
- The name matches repository camel-case conventions and ticket vocabulary.

Costs:

- It records only the fact of an overshoot, not its magnitude or denomination.
- Absence combines “inside envelope” and “unknown because this predates E-068.”
- Callers must already know whether the run is over-envelope; the log does not derive it.

The first cost is explicitly consistent with “marker.” The second is the normal compatibility
tradeoff for all one-way fields. The third preserves the log's role as a sink.

## Option B — required boolean with default false

Shape:

```ts
readonly overEnvelope: boolean;
```

Every normalized record would carry either true or false.

Advantages:

- Consumers see an explicit binary value.
- TypeScript does not require an undefined check.

Rejected because it violates the acceptance criterion. Adding
`"overEnvelope":false` changes every serialized record, so an absent marker would not remain
byte-identical to a pre-E-068 line. It would also falsely claim knowledge about old records that
never observed this condition.

## Option C — new run outcome

Add a value such as `success-over-envelope` to `RUN_OUTCOMES`.

Advantages:

- The condition is visible in the existing outcome discriminator.
- Consumers filtering outcomes could distinguish it without inspecting another property.

Rejected because the story says the eventual record is a cleared/successful observation with a
warning. Recalibration treats success as a finishing-cost sample; changing the outcome would
force unrelated consumers to understand a new terminal state. It also merges two independent
facts: whether gates cleared and whether spend exceeded an envelope. T-068-02-02 and
T-068-02-03 own disposition and outcome wiring, not this record-shape ticket.

## Option D — warnings array or tagged warning object

Examples:

```ts
readonly warnings?: readonly string[];
```

or

```ts
readonly warning?: { readonly kind: "over-envelope" };
```

Advantages:

- Extensible to future warnings.
- A tagged object can grow structured metadata.

Rejected because no warning framework exists in the record schema and the ticket requests one
specific one-way marker. Introducing a generalized container creates vocabulary, validation,
deduplication, ordering, and compatibility questions without a current consumer. An array also
makes counting more complex than property presence and risks serializing empty containers on
unwarned records.

## Option E — persist the overshoot amount

Record a `Budget`-shaped amount, token number, or ratio.

Advantages:

- Quantifies severity.
- Could support reporting without recomputation.

Rejected because magnitude is not part of the acceptance criterion and denomination semantics
would broaden the contract. The run log already carries the allocated envelope and normalized
usage buckets; consumers can derive token spend. Persisting a second calculation risks drift
from `totalTokens` and would require deciding how time overshoot relates to the marker. The story
specifically distinguishes token detect-after from wall-clock timeout.

## Option F — derive the marker inside run-log

Have `buildRunRecord` compare `totalTokens(record)` with `envelope.tokens`.

Advantages:

- Callers cannot forget to stamp the marker.
- The fact derives from already-recorded data when an envelope exists.

Rejected because the eventual warning depends on disposition, not arithmetic alone. The story
requires a gates-cleared overshoot to be warned and materialized, while failed/timed-out paths
remain discards. The record builder does not know that policy context. Derivation would also mark
historical or failure records whenever their raw cost exceeds the envelope, changing semantics
outside the sequential story design.

## Field name

Choose `overEnvelope`.

The words come directly from the ticket title, successor-ticket text, story title, and epic.
Lower camel case matches `reducedGrounding` and other record properties. Alternatives such as
`overshotEnvelope`, `envelopeWarning`, or `budgetOvershoot` either diverge from established story
language or imply a magnitude/container that is not stored.

The name describes a fact rather than a command. Its one-way nature means:

```ts
record.overEnvelope === true // warning is present
record.overEnvelope === undefined // no warning was recorded
```

No stored `false` state exists.

## Write-boundary behavior

`RunRecordInput.overEnvelope` accepts a boolean because downstream classification/wiring will
naturally compute a boolean. The normalizer is deliberately strict: only the primitive boolean
`true` survives. Truthy strings, numbers, false, and absence are omitted.

`buildRunRecord` computes the normalized marker alongside the other optional fields. Its return
object spreads `{ overEnvelope }` immediately after the existing `reducedGrounding` optional
marker and before timestamps. This keeps one-way observational markers grouped and gives stable
new-record ordering.

The builder does not validate any relationship among marker, outcome, envelope, usage, or gates.
That mirrors `reducedGrounding`: the run log records the fact the caller supplies and does not
reimplement the caller's policy.

## Read-boundary behavior

`reviveRecord` reads the raw field only if its runtime type is boolean, then passes it through
the same normalizer. The explicit type check is consistent with `reducedGrounding`; malformed
truthy values cannot become markers.

The revived object conditionally spreads the normalized marker in the same relative position
as the builder. A raw `true` survives. Raw false, absent, string, number, null, array, or object
values disappear while the rest of an otherwise valid record remains available.

No legacy raw alias exists. Revival will not infer the marker from usage and envelope because
that would silently reclassify historical records and bypass the story's gates-cleared rule.

## Schema-version decision

Retain `RUN_LOG_SCHEMA_VERSION = 1`.

The project has repeatedly evolved version 1 records through optional, omission-compatible
fields. The reviver already tolerates absent newer fields. A version bump would not improve the
read boundary and would make a small additive field look like a migration. The byte-compat
requirement specifically favors the existing additive convention.

## Test design

Add a dedicated `describe` block beside `reducedGrounding` with these cases:

1. Build with `overEnvelope: true`, serialize, parse, revive, and assert true at both ends.
2. Build without the field and assert property/key absence.
3. Build with `overEnvelope: false`; assert omission and exact serialized equality with the
   otherwise identical absent-field record.
4. Supply a malformed typed value at build; assert omission.
5. Inject a malformed raw value before revive; assert the record survives and marker disappears.
6. Parse a literal pre-E-068 JSON line without the field; assert no skip and undefined marker.

The exact absent-versus-false equality is the strongest local interpretation of “byte-identical
to a pre-E-068 one.” The literal legacy line additionally proves the reader accepts historical
shape. Existing generic serialize tests continue to guard one-line JSONL countability.

## Verification strategy

Run the focused unit suite first:

```sh
bun test src/log/run-log.test.ts
```

Then run the repository gate:

```sh
bun run check
```

Inspect the final diff to confirm only the two owned source/test files and this ticket's work
artifacts are staged or committed. Check `RUN_LOG_SCHEMA_VERSION` is unchanged and imports are
unchanged.

## Chosen design

Option A is selected. It fulfills the stated persistence and byte-compatibility contract using
an already-proven repository pattern, gives dependent tickets a minimal stable interface, and
does not preempt the classifier or runner decisions assigned to later DAG nodes.
