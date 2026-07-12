# Structure — T-071-01-01

## Change set

The ticket changes one production module and its colocated test module. It adds no
new runtime module, dependency, command, migration, or effect boundary.

## `src/log/run-log.ts`

### `RunRecordInput`

Add an optional property after `seatDefaulted` and before timestamps:

```ts
readonly seatOfExecution?: string;
```

Its documentation defines it as raw execution-lane provenance. Absence is
historical/unknown and causes complete omission. The documentation explicitly says
the log does not validate membership in a known-seat registry.

### `RunRecord`

Add the matching optional durable property in the same relative schema area:

```ts
readonly seatOfExecution?: string;
```

Its documentation pins read-side preservation and historical omission.

### Pure normalization helper

Add a private helper near `normalizeSeatDefaulted`:

```ts
function normalizeSeatOfExecution(value: unknown): string | undefined
```

Responsibilities:

- accept a non-empty string;
- return the exact string unchanged;
- omit absence and malformed runtime values;
- apply no seat registry or routing policy.

The `unknown` parameter makes the helper directly suitable for both typed input
and parsed JSON without unsafe policy assumptions.

### `buildRunRecord`

Compute:

```ts
const seatOfExecution = normalizeSeatOfExecution(input.seatOfExecution);
```

Add a conditional spread after `seatDefaulted`:

```ts
...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
```

Using an explicit undefined comparison communicates that the field is ordinary
optional metadata rather than a one-way boolean marker.

### `reviveRecord`

Normalize the parsed property with the same helper:

```ts
const seatOfExecution = normalizeSeatOfExecution(r.seatOfExecution);
```

Add the same conditional spread in the canonical returned object, in the same
relative position used by `buildRunRecord`.

This maintains write/read symmetry and deterministic serialization order.

### Imports and dependencies

No imports are added. In particular:

- no `KNOWN_SEATS` import;
- no `AgentSeat` type import;
- no executor import;
- no budget import.

The module remains a policy-independent ledger sink.

## `src/log/run-log.test.ts`

Add one describe block adjacent to the existing seat-related optional metadata
tests. The block owns a literal pre-E-071 record fixture.

### Test: raw seat survives `readRuns`

Build a record with a deliberately non-registry value. Serialize it to JSONL and
call `readRuns`. Assert:

- build result contains the exact raw string;
- read reports zero skipped lines;
- exactly one record is returned;
- revived result contains the exact raw string;
- reserialization is byte-stable.

This one test covers `buildRunRecord`, serialization, `readRuns`, and
`reviveRecord` while demonstrating absence of `KNOWN_SEATS` policing.

### Test: absence is byte-identical

Build the logical equivalent of a literal historical line without the new field.
Assert:

- no own/inherited property exists under the field name;
- serialized output contains no such key;
- serialized output exactly equals the literal pre-E-071 bytes.

### Test: historical line survives

Read the literal line with `readRuns`. Assert:

- zero skipped;
- one returned record;
- the field is omitted rather than defaulted.

### Test: malformed parsed metadata is optional

Construct a parsed record with a non-string value and call `reviveRecord`. Assert:

- record remains non-null;
- its required identity remains intact;
- the malformed optional field is omitted.

This is consistent with surrounding optional metadata behavior.

## Private attempt artifacts

The following workflow artifacts are written only under
`.lisa/attempts/T-071-01-01/1/work/`:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`

Lisa owns publication to `docs/active/work/T-071-01-01/`.

## Files explicitly unchanged

- `docs/active/tickets/T-071-01-01.md`: phase transition is Lisa-owned.
- `src/play/agent-seat.ts`: policy registry remains unchanged.
- `src/engine/cast.ts`: dependent ticket will stamp the field.
- `src/engine/cast-core.ts`: no schema responsibility.
- executor implementations: no change in this schema ticket.
- ledger consumers: no heat reading belongs in this story ticket.

## Ordering

1. Add schema and pure normalization/write/read support.
2. Add focused contract tests.
3. Run the focused unit test.
4. Run the full repository gate.
5. Commit exactly the production and test files via Lisa.
6. Record implementation evidence in `progress.md`.
7. Write the final `review.md` handoff.

The source and test edits form one meaningful schema unit because neither is
complete independently: production defines the behavior and tests are the ticket's
explicit acceptance evidence.
