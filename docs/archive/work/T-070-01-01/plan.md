# Plan — T-070-01-01: run-log seat-defaulted marker schema

## Objective

Establish a pure append-only-ledger contract for optional structured `seatDefaulted` metadata.
Requested raw seat, applied default, and reason must survive serialization/revival; ordinary records
must retain exact pre-E-070 bytes.

## Scope guard

Edit only `src/log/run-log.ts`, `src/log/run-log.test.ts`, and this ticket's work directory.
Do not edit ticket phase/status, board documents, seat registry, materialization, effects, cast,
BAML, schema version, or outcome vocabulary. Do not run a live/metered cast.

## Step 1 — add the positive contract test

Create a marker block after existing one-way marker tests with fixture:

```ts
{ requested: "kodex", applied: "claude", reason: "unknown-seat" }
```

Build, serialize, JSON-parse, revive, and reserialize. Assert all nested values before and after
revival and exact equality between the first and second serialized lines.

Run the focused suite before production plumbing and record red/type-failure evidence in
`progress.md`. The failure must demonstrate the missing marker path.

## Step 2 — pin absence and legacy bytes

Build a fixed minimal record without the marker. Define an explicit pre-E-070 JSONL literal with
the expected historical property order and final newline. Assert:

- no own `seatDefaulted` property;
- no serialized marker key;
- exact output equality to the literal.

Pass that literal through `readRuns`; assert zero skipped, one record, and undefined marker.

## Step 3 — add boundary tests

Add cases for:

- partial write marker: whole property omitted;
- valid marker with extra nested metadata: only three supported keys retained;
- malformed raw read marker: record remains valid but marker is omitted.

These tests make the structured marker atomic and canonical.

## Step 4 — add public schema shape

Add exported `SeatDefaulted` with readonly `requested`, `applied`, and `reason` strings.
Add optional `seatDefaulted?: SeatDefaulted` to `RunRecordInput` and `RunRecord`.
Document one-way property presence and historical byte-compatible omission.

Keep `RUN_LOG_SCHEMA_VERSION = 1`, `RUN_OUTCOMES`, and imports unchanged.

## Step 5 — implement pure normalization

Move the unchanged `isNonEmptyString` declaration earlier so write and read paths can share it.
Add `normalizeSeatDefaulted`:

- absent returns undefined;
- every required value must be a non-empty string;
- partial/malformed returns undefined;
- valid returns a fresh object with exactly requested, applied, reason;
- values remain verbatim; no trimming or seat lookup.

## Step 6 — thread writer

Normalize `input.seatDefaulted` once in `buildRunRecord`. Conditionally spread the result after
`overEnvelope` and before timestamps. Verify by inspection that absence leaves the old object shape
and key order unchanged. Do not alter serialization.

## Step 7 — thread reader

Narrow raw `r.seatDefaulted` to a non-null object candidate, apply the same normalizer, and
conditionally spread a valid result in builder-matching order. Malformed optional metadata must not
return null. Do not infer from outcomes or other fields.

## Step 8 — focused verification

Run:

```sh
bun test src/log/run-log.test.ts
bun run check:typecheck
```

Required evidence:

- all existing run-log tests pass;
- marked record reserializes byte-stably;
- absent output equals literal pre-E-070 bytes;
- legacy line revives;
- malformed metadata is omitted without record loss;
- additive types compile across downstream structural callers.

## Step 9 — progress and implementation commit

Update `progress.md` with completed steps, red proof, implementation summary, test counts, and any
deviation. Stage only ticket-owned source, tests, and work artifacts. Inspect cached diff/status,
then commit with a ticket-specific message. Never stage unrelated Lisa/board changes.

## Step 10 — full gate

Run:

```sh
bun run check
```

This must complete BAML generation, TypeScript checking, and all Bun tests. Record exact counts and
existing skips. Inspect any generated-file change rather than staging unrelated drift.

## Step 11 — scope audit

Inspect Git status and ticket-owned diffs. Confirm:

- ticket frontmatter is untouched;
- story/epic and downstream implementation files are untouched;
- schema version and outcomes are unchanged;
- only complete marker objects are stored;
- absent bytes are directly pinned;
- all intended artifacts exist.

## Step 12 — review

Write `review.md` summarizing files, implementation, acceptance status, focused/full test evidence,
coverage, architecture, commits, and concerns. Explicitly note:

- no runtime producer stamps this until T-070-01-03;
- run-log does not validate known-seat/default policy;
- absence combines normal and historical unknown;
- `unknown-seat` remains readable for compatibility.

After review is written, stop without changing ticket phase/status.

## Verification matrix

| Contract | Evidence |
|---|---|
| complete marker accepted | build assertion |
| requested raw seat preserved | nested equality |
| applied default preserved | nested equality |
| reason preserved | nested equality |
| serialize/revive byte-stable | first vs revived line equality |
| marker absent normally | own-property and substring assertions |
| pre-E-070 writer bytes unchanged | exact literal equality |
| pre-E-070 reader accepted | `readRuns` literal fixture |
| partial marker rejected atomically | malformed build fixture |
| extra data not leaked | exact nested object equality |
| malformed read metadata does not discard | non-null revived record |
| pure-core boundary | no effects/new runtime imports |
| repository compatibility | `bun run check` |

## Completion criteria

- All six RDSPI artifacts exist.
- Focused tests and full `bun run check` are green.
- Code, tests, and work artifacts are committed.
- Review honestly records any gap.
- Ticket phase/status remain Lisa-owned and unedited.
