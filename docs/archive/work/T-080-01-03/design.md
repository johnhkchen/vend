# Design — T-080-01-03 settle surfaces cord failure

## Decision summary

Extend the pure settle verdict with `cordFailureReason: string | null`. Feed the core one plain
cord observation containing optional failure-log bytes, optional failure-log mtime, and an optional
last-successful-claim mtime. The core will scan JSONL from newest to oldest for an exact valid
timestamp/reason record, expose its reason only when the trace mtime is strictly newer than the
claim watermark, and otherwise return null.

The shell will read the failure log and prior last-settle file with their mtimes, retain the claimed
loop marker's mtime, and use the newest prior-verdict/current-marker mtime as the claim watermark.
No persisted schema changes. The renderer will print the exact required cord line immediately after
the loop line as normal verdict text.

## Goals

- Surface the latest applicable recorder failure on the next free settle verdict.
- Preserve the logged reason exactly after JSON decoding.
- Suppress the line when no trace exists.
- Suppress the line when a successful claim/acknowledgement is at least as new as the trace.
- Keep malformed diagnostic bytes non-blocking.
- Keep freshness policy pure and testable.
- Keep filesystem and metadata reads in the settle shell.
- Avoid changing the successful marker or last-settle v1 schemas.
- Preserve atomic marker claim, restore, consume, and continuation ordering.
- Preserve all existing settle output and failure behavior.

## Non-goals

- Do not modify the recorder, hook, or Lisa event inputs.
- Do not truncate, rotate, repair, or rewrite the append-only failure trace.
- Do not add retry, queue, replay, or delivery guarantees.
- Do not make a cord warning a refusal, exception, red line, or nonzero outcome.
- Do not invent a recovery action.
- Do not expose malformed diagnostic lines as recorder reasons.
- Do not change marker schema versions or canonical fixture bytes.
- Do not add a watcher, daemon, network call, or new user gesture.

## Option 1 — always render the last valid failure line

### Advantages

- Minimal parsing and rendering logic.
- Every historical failure remains visible forever.

### Disadvantages

- A later successful loop claim cannot clear/supersede old evidence.
- Every settle repeats stale noise.
- Directly violates the acceptance clause for a newer successful claim.

### Decision

Rejected.

## Option 2 — delete or truncate the log after settle

### Advantages

- Simple one-shot warning semantics.
- No freshness metadata required after consumption.

### Disadvantages

- Contradicts the producer's append-only local evidence contract.
- A failed settle could destroy diagnostic history before a terminal verdict.
- Concurrency with producer appends creates lost-evidence risk.
- Makes Vend mutate the trace rather than only observe it.

### Decision

Rejected.

## Option 3 — add claim time to `.vend/last-settle.json`

### Advantages

- Explicit persisted claim timestamp.
- Freshness survives filesystem timestamp copying.

### Disadvantages

- The marker is a closed v1 schema with exactly two fields.
- Adding an optional field silently violates its validator; adding v2 creates migration and refusal
  policy outside this small surface ticket.
- A new current-time fact and injection seam would be needed.
- Existing exact byte fixtures and user state would need broader changes.

### Decision

Rejected as disproportionate and schema-breaking.

## Option 4 — add a dedicated successful-claim sidecar

### Advantages

- Separates done-ticket baseline from loop claim acknowledgement.
- Can precisely preserve only successful loop claims.

### Disadvantages

- Adds a third singleton, serializer, atomic writer, parser, refusal policy, cleanup policy, and
  crash ordering question.
- The ticket asks for a visible verdict line, not a new durable protocol.
- Existing last-settle persistence already marks successful terminal verdict acknowledgement.
- More state creates more silent failure modes than this hardening slice needs.

### Decision

Rejected for scope and complexity.

## Option 5 — compare existing file modification times

### Shape

- Failure observation: log contents plus log mtime.
- Prior acknowledgement: `.vend/last-settle.json` mtime, when present.
- Current successful marker candidate: claimed loop marker mtime, when present.
- Last claim watermark: maximum of the two claim mtimes.
- Visible warning: valid reason exists and trace mtime is strictly greater than the watermark.

### Advantages

- Uses local facts already created by the involved writes.
- No marker schema or bytes change.
- No new state or clock minting.
- Supports deterministic tests through `utimes`.
- A verdict that surfaces a warning writes a newer last-settle acknowledgement, so immediate repeats
  are quiet without deleting history.
- A current marker newer than the trace suppresses stale failure evidence.
- A trace newer than an old marker remains visible.

### Disadvantages

- Filesystem mtimes are metadata, not application payload.
- Copy/restore tooling can alter them.
- Coarse timestamp filesystems can produce equality; strict comparison then conservatively treats
  equal state as already acknowledged.
- Prior no-loop settles also advance the acknowledgement watermark.

### Decision

Selected. The state is explicitly local filesystem evidence, the comparison is advisory rendering
policy, and this option satisfies the named behavior without expanding the persisted protocol.

## Parser policy

Implement a private pure reviver for one failure line in `settle-core.ts`:

1. Parse JSON inside a try/catch.
2. Require a non-array object.
3. Require exactly `reason` and `timestamp` keys.
4. Require a canonical ISO timestamp matching the producer contract.
5. Require a nonblank reason string.
6. Return the original reason string without trimming.

Implement a pure latest-record scan:

- split on CRLF/LF;
- scan from the physical tail toward the head;
- ignore blank or invalid lines;
- return the first valid record;
- return null when none qualify.

This is tolerant because the trace is diagnostic. A corrupt tail must not block board, gate,
presweep, or review truth. Selecting by append position follows the producer's append-only
contract; the payload timestamp is validated but does not override file order.

## Freshness policy

Define a plain immutable observation shape:

```ts
interface SettleCordObservation {
  readonly failureTraceContents: string | null;
  readonly failureTraceModifiedAtMs: number | null;
  readonly lastClaimModifiedAtMs: number | null;
}
```

Core validation treats a usable mtime as a finite nonnegative number. Shell-generated values meet
that contract. A missing contents/mtime pair cannot establish a visible failure. A missing claim
watermark means any usable trace is unacknowledged. A trace equal to or older than the watermark is
suppressed.

The `timestamp` payload remains part of exact schema validation and diagnostic history but is not
used for freshness. That avoids comparing an injected recorder wall clock with filesystem write
ordering and matches the acceptance wording that the log itself is newer.

## Verdict shape

Add:

```ts
readonly cordFailureReason: string | null;
```

It is deliberately not:

- a `SettleRefusal` variant;
- a `SettleException`;
- a `ReviewConcern`;
- a next action.

The core computes it only after both persisted marker parsers have admitted their state. A malformed
loop marker still refuses and is restored exactly as before. The cord observation does not alter
delta, clearance, gate, presweep, review, exceptions, or next marker.

## Shell observation ordering

1. Atomically claim an optional loop marker and retain its contents plus mtime.
2. In parallel, load graph, optional last-settle contents+mtime, optional failure log contents+mtime,
   and review concerns.
3. Run repository gate and presweep as before.
4. Compute `lastClaimModifiedAtMs` as the maximum present value among prior last-settle mtime and
   current loop-claim mtime.
5. Pass the cord observation into the pure core.
6. On refusal, restore claim and do not write continuation.
7. On verdict, atomically write last-settle continuation, then consume current loop claim.

Reading contents then metadata can race an append. The worst advisory outcome is deferral or one
extra display; it cannot corrupt the log or block settle. The producer writes each JSONL record in
one append call, and the core ignores torn invalid tails.

## Render policy

Within the normal verdict branch:

1. Render the existing loop line.
2. If `cordFailureReason !== null`, append exactly
   `cord: last recording failed — ${reason}`.
3. Continue with delta and every existing line.

The cord line is not passed through `red()`. The exact reason is interpolated unchanged. JSON escape
sequences have already been decoded, so embedded newlines remain verbatim even though such a reason
can occupy more than one terminal row; producer contract prioritizes reason fidelity.

## Test strategy

### Pure core

- A valid trace newer than no claim yields the exact reason.
- A valid trace newer than an older claim yields the exact reason.
- No trace yields null.
- A claim newer than the trace yields null.
- Equal timestamps yield null.
- A malformed/torn tail falls back to the preceding valid line.
- Invalid-only trace yields null without refusal.
- Existing loop-marker and last-settle refusals remain unchanged.

### Renderer

- Manual verdict fixture renders the exact cord line.
- Null cord state renders no line.
- Cord text is not red and does not change exception count.

### Effect lifecycle

- Failure log newer than prior last-settle produces a verdict and visible exact reason.
- That verdict remains `kind: verdict` and persists the baseline.
- A marker claim newer than the log suppresses the line on the same run.
- No log suppresses the line.
- Existing marker consume/restore lifecycle remains green.

## Documentation

Update `docs/knowledge/lisa-loop-settled-contract.md` so the consumer section no longer delegates
this behavior to a future ticket. Record the mtime freshness watermark, tolerant JSONL tail read,
normal verdict line, and non-mutation of the append-only log.
