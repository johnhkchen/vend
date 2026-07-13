# Review — T-082-01-02 cast-settle-cap-detection

## Disposition

Pass. The ticket acceptance criterion is met, the full repository gate is green, the exact
ticket-owned source unit is committed through Lisa, and ticket-owned source paths are clean.

## Outcome

The cast settlement path now turns explicit terminal provider-cap evidence into the complete
one-way ledger marker introduced by `T-082-01-01`.

A known-lane stub executor returning a failure-shaped HTTP-429 terminal result produces exactly one
`runs.jsonl` row containing:

```json
"seatOfExecution":"claude",
"capWindowExhausted":{
  "signal":"http-429",
  "reason":"executor terminal failure reported HTTP 429 at settlement"
}
```

An otherwise identical ordinary terminal failure produces no marker and retains the complete
pre-marker row shape and key order byte-for-byte.

## Files changed

### `src/engine/cast-core.ts`

- Added pure `classifyCapWindowExhaustion(ResultMessage | null)`.
- Added exact structured 429 classification from status/statusCode/code fields.
- Added bounded diagnostic extraction from named terminal failure fields.
- Added explicit HTTP-429 and rate-limit denial phrase recognition.
- Added failure-shape gating (`error*` subtype or `is_error: true`).
- Added stable controlled `signal` and `reason` marker vocabulary.
- Kept the helper total over malformed optional external values.
- Introduced only type imports for executor-result and ledger-marker contracts.

### `src/engine/cast.ts`

- Calls the pure classifier once after terminal executor facts are available.
- Threads the optional result into the existing final settlement append.
- Places the conditional spread immediately after `seatOfExecution`, matching run-log canonical
  order and the acceptance contract.
- Adds no second append, retry, reroute, interception, or outcome branch.

### `src/engine/cast-core.test.ts`

- Added seven focused tests with positive, precedence, and false-positive controls.
- Pinned numeric and nested structured 429 evidence.
- Pinned explicit HTTP-429 text evidence.
- Pinned typed/prose rate-limit evidence.
- Pinned `http-429` precedence over the broader category.
- Pinned absence for ordinary and max-turn failures.
- Pinned absence for successful model prose discussing rate limits.
- Pinned null and malformed diagnostic totality.

### `src/engine/cast.test.ts`

- Added a free known-lane terminal-failure executor fixture.
- Added the branch-level marked 429 fixture.
- Added the branch-level ordinary failure byte-compatibility control.
- Proved exactly one physical JSONL line on each path.
- Proved marker adjacency to `seatOfExecution` in raw bytes.
- Proved marker survival through `reviveRecord`.
- Proved the unmarked whole file equals a manual canonical existing row, including key order.

No file was created or deleted in ticket-owned source.

## Classification assessment

The classifier is deliberately conservative because the sibling story will treat these markers as
hard capacity evidence.

It requires both:

1. a failure-shaped terminal result; and
2. explicit 429 or rate-limit-exhaustion evidence in bounded diagnostic fields.

It does not classify a bare word `limit`, a max-turn cap, timeout, connection failure, successful
model prose, or malformed fields. The returned marker contains controlled vocabulary rather than
raw provider text, avoiding unstable or sensitive diagnostic persistence.

When both HTTP 429 and general rate-limit wording occur, `http-429` wins as the more precise signal.
When only explicit denial wording exists, `rate-limit` records that evidence without inventing an
HTTP status.

## Settle-only / N4 assessment

No classification occurs in `onMessage`. Existing `rate_limit_event` stream telemetry remains
progress/transcript data only.

This matters because repository-local transcripts show healthy casts emitting `allowed` and
`allowed_warning` rate-limit events, including cases where optional overage is rejected while the
primary request remains allowed. Event presence alone is not exhaustion.

The implementation observes only the already-settled terminal result. It does not interrupt,
retry, reroute, or supervise the executor, satisfying the story's N4 boundary.

## Compatibility assessment

The marker is a conditional spread. Absence adds no key, placeholder, null, or empty object.

The ordinary failure control compares the complete raw file against an independently assembled
expected row with all existing fields in canonical order:

```text
v, runId, play, epic, model, outcome, usage, costUsd, gateResults,
envelope, project, turnsUsed, seatOfExecution, startedAt, endedAt
```

The assertion passes. Existing `RunOutcome`, parser/gate/effect behavior, timeout handling,
max-turn recovery, cross-review, transcript, and rethrow behavior are unchanged.

The prior max-turn fixture remains green, specifically protecting the established behavior where
`error_max_turns` terminal output can still be checkpointed/gated/materialized without gaining a
provider-window marker.

## Acceptance checklist

- [x] Fixture uses an injected stub executor and spends no provider tokens.
- [x] Fixture terminal result is explicitly failure-shaped.
- [x] Fixture carries HTTP-429/rate-limit-shaped evidence.
- [x] Cast settles through the existing final append.
- [x] `runs.jsonl` contains exactly one record.
- [x] Record carries a complete cap marker.
- [x] Record carries `seatOfExecution` alongside the marker.
- [x] Marker has stable signal and reason strings.
- [x] Marker survives `reviveRecord`.
- [x] Non-rate terminal failure settles exactly one record.
- [x] Non-rate record carries no marker.
- [x] Entire non-rate raw JSONL row is byte-compatible with the existing shape.
- [x] Pure positive and negative classifier branches are pinned.
- [x] Existing cast-core and cast tests pass.
- [x] Existing run-log behavior passes under the full suite.
- [x] `bun run check` is green.
- [x] Source unit is committed through Lisa with exact includes.

## Test coverage

Focused post-implementation gate:

```text
105 pass
0 fail
473 expect() calls
2 files
```

This increased the focused baseline from 96 to 105 passing tests: seven pure classifier tests and
two cast acceptance tests.

Full repository gate:

```text
BAML generation: pass
TypeScript typecheck: pass
1972 pass
1 skip
0 fail
6478 expect() calls
127 test files
```

The one skip is the pre-existing dist-dependent compiled integration test and is explicit about
requiring local release artifacts. It is unrelated to this ticket.

## Commit review

Commit:

```text
3255d0cbe0df3666ea2dbec85efc7c652f4ce44a
feat(cast): record cap-window exhaustion (T-082-01-02)
```

It was created through `lisa commit-ticket` with exactly:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

The ordinary index is empty and all four ticket-owned source paths are clean after commit.

## Scope review

Unchanged by design:

- `src/log/run-log.ts` and its schema/version/normalizers;
- Claude and OpenAI-compatible executor adapters;
- live rate-limit stream handling;
- terminal outcome vocabulary;
- lane heat and learned capacity;
- budgets and wallets;
- provider quota fetching;
- CLI and TUI surfaces;
- Lisa dispatch and ticket transitions;
- historical ledger rows.

No live cap was burned. The story's honest boundary remains fixture-proven and free; real evidence
begins only when future terminal failure results carry matching facts.

## Open concerns and limitations

No blocking concern for this ticket.

The classifier intentionally covers terminal `ResultMessage` failures: the existing path that
already reaches cast settlement and its one ledger append. A `dispense` promise that rejects before
returning a terminal result still follows the established immediate rethrow path and writes no row.
For example, the current OpenAI-compatible adapter throws on non-OK HTTP status. Broadening that
error cord would create records on paths that do not write them today and requires separate
outcome/metering/rethrow decisions. That is a legitimate follow-on if live evidence shows caps
arriving only through rejection, but it is outside this ticket's “row it already writes” and
byte-compatible control contract.

The text vocabulary is intentionally small. Future captured terminal evidence may justify adding a
new explicit denial phrase. Such an extension stays localized to the pure classifier and should
arrive with a fixture, rather than weakening the matcher speculatively.

## Worktree and artifact integrity

Lisa-managed provenance/ticket changes, published shared work directories, and concurrent
`T-082-02-01` source files remain outside this ticket's commit. They were not staged, reset,
modified, or included.

All phase artifacts were authored in the private attempt directory. Lisa owns their admitted
publication and phase/status transitions.

## Final judgment

The settlement shell now records explicit provider-window exhaustion as complete, countable,
executor-neutral evidence beside the lane that burned it. The decision is pure, conservative,
settle-only, tested at both decision and JSONL boundaries, backward-compatible for ordinary rows,
repository-green, scoped, and committed. Disposition: pass.
