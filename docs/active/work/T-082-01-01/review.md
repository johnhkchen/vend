# Review — T-082-01-01 run-log cap-window marker

## Disposition

Pass. The ticket acceptance criterion is met, the complete repository gate is
green, and the ticket-owned source is committed through Lisa's scoped commit path.

## What changed

The append-only run ledger now has an honestly named, one-way structured marker for
a provider reset-window exhaustion event:

```ts
export interface CapWindowExhausted {
  readonly signal: string;
  readonly reason: string;
}
```

`RunRecordInput` and normalized `RunRecord` expose:

```ts
readonly capWindowExhausted?: CapWindowExhausted;
```

The marker is additive and optional. A record carries the field only when both
payload strings are complete and non-empty.

## Files changed

### `src/log/run-log.ts`

- Added exported `CapWindowExhausted`.
- Added the optional marker to the write input and normalized record interfaces.
- Added one pure atomic normalizer.
- Wired the marker into `buildRunRecord`.
- Wired the marker into `reviveRecord`.
- Kept build and revive property ordering symmetric.
- Left serialization, JSONL parsing, loading, appending, schema version, and run
  outcome vocabulary unchanged.

### `src/log/run-log.test.ts`

- Added seven focused acceptance tests.
- Pinned complete marked round-trip behavior.
- Pinned marker-less build bytes.
- Pinned historical marker-less read→serialize bytes.
- Pinned partial and malformed atomic omission.
- Pinned canonical nested copying.
- Pinned row survival when optional metadata is corrupt.

No file was created or deleted in the ticket-owned source unit.

## Public contract assessment

The name `capWindowExhausted` states the exact event the epic needs as capacity
evidence. It avoids broader terms such as `rateLimited`, which could include
transient throttling unrelated to a depleted reset window, and avoids implying a
numeric quota that is not yet learned.

The nested `signal` and `reason` contract is executor-neutral:

- `signal` records the stable evidence category recognized at settlement;
- `reason` records the stable explanation for the classification;
- the run log checks structure only;
- the next ticket remains responsible for deciding which executor failures qualify.

This preserves the module's role as a fact sink, not a classifier.

## Atomicity assessment

The implementation uses one normalizer on both write and read faces.

A marker is omitted as a whole when:

- the value is absent;
- the read value is not an object;
- `signal` is absent, empty, or non-string;
- `reason` is absent, empty, or non-string.

A valid marker is rebuilt from exactly its two schema fields. Unknown nested keys
are dropped. No partial evidence can reach the durable record, and optional bad data
cannot cause the containing run to be rejected.

This directly satisfies the ticket's “omitted atomically without losing the record”
requirement.

## Serialization compatibility assessment

The new property is emitted through a conditional spread. There is no placeholder,
`null`, false flag, default object, or synthesized historical value.

Tests prove both compatibility faces:

- a newly built marker-less record matches a literal pre-feature JSONL line exactly;
- the literal historical line survives `readRuns`/`reviveRecord` and reserializes to
  the exact same bytes.

The existing relative order of all prior fields is unchanged. Valid marked records
also reserialize byte-stably because build and revive place the new field in the same
canonical location after `seatOfExecution`.

The schema version remains `1`, consistent with prior additive optional v1 markers.

## Existing fact composition

The marker is intentionally not self-duplicating. Future capacity learning composes
it with existing row facts:

- `seatOfExecution` identifies the lane;
- `usage` supplies burn;
- `endedAt` supplies settlement time;
- `model` supplies model context;
- `outcome` continues to describe the terminal run result.

This avoids contradictory lane/timestamp copies and keeps capacity policy outside
the ledger.

## Acceptance checklist

- [x] Complete cap marker survives `buildRunRecord`.
- [x] Complete cap marker survives `serializeRunRecord`.
- [x] Complete cap marker survives `reviveRecord`.
- [x] Marked record reserialization is byte-stable.
- [x] Partial build marker is atomically omitted.
- [x] Malformed read marker is atomically omitted.
- [x] Non-object read marker is atomically omitted.
- [x] Containing run survives malformed optional metadata.
- [x] Unknown nested marker fields are not persisted.
- [x] Marker-less build is byte-identical to pre-feature serialization.
- [x] Revived historical marker-less line is byte-identical after serialization.
- [x] Focused run-log unit suite is green.
- [x] `bun run check` is green.
- [x] Ticket-owned source is committed.

## Test coverage

Focused test result:

```text
139 pass
0 fail
325 expect() calls
```

Baseline was 132 pass / 0 fail, so the ticket adds seven focused cases without
removing or weakening an existing test.

Repository gate result:

```text
BAML generation: pass
Typecheck: pass
1956 pass
1 skip
0 fail
6438 expect() calls
126 test files
```

The single skip is the pre-existing dist-dependent integration test and is explicit
about requiring local release artifacts. It is unrelated to this ledger-only change.

## Commit review

Commit:

```text
377ac7a454ecac8a68c3bb8281baddf69c5243ed
feat(log): record cap-window exhaustion (T-082-01-01)
```

The commit contains exactly:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

It was created through `lisa commit-ticket` with those exact repeated `--include`
paths. Ticket-owned source paths are clean afterward, and the ordinary index has no
staged paths.

## Scope review

The implementation stays within the story's first-ticket boundary.

Unchanged by design:

- `src/engine/cast.ts` and `src/engine/cast-core.ts`;
- executor errors and rate-limit classification;
- lane heat and seat inference;
- capacity learning;
- budget and wallet algebra;
- CLI behavior;
- provider API access;
- runtime interception and rerouting;
- historical ledger contents;
- ticket phase/status frontmatter.

`T-082-01-02` can now classify a failure and supply the marker. `T-082-02-01` can
consume complete marker presence alongside lane, usage, and time. Neither follow-on
was started here.

## Open concerns and limitations

No blocking concern.

The stable vocabulary for `signal` and `reason` is intentionally not enumerated in
the ledger module. The next ticket owns settlement classification and should define
controlled constants or a pure classifier result so call sites do not invent ad hoc
strings. That is expected follow-on work, not missing acceptance in this schema
ticket.

The ticket proves behavior with fabricated unit records only. It does not prove a
live provider 429, matching the story's honest boundary. Real evidence will begin to
accrue only after the cast settlement ticket lands and future runs hit actual caps.

## Worktree and artifact integrity

Unrelated Lisa-managed changes remain outside the ticket source commit. The worker
did not stage, reset, or commit them. Phase artifacts were authored only in the
private attempt directory; Lisa detected and published copies into the shared work
directory during execution.

## Final judgment

The ledger now has the missing countable substrate with the same compatibility and
lenient-read posture as its established structured markers. The implementation is
pure, additive, tested to every acceptance branch, repository-green, scoped, and
committed. Disposition: pass.
