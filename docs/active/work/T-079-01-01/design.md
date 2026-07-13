# Design — T-079-01-01

## Goal

Introduce a pure settle contract that turns an already loaded `WorkGraph` plus already observed gate,
presweep, review, and marker facts into one deterministic result. A successful result must be complete
enough for the next ticket to render without re-judging state, while malformed persisted marker data
must stop as a named, actionable refusal.

The core will not read files, execute Git, run checks, invoke an executor, choose colors, or advance the
marker. Those are shell responsibilities in T-079-01-02.

## Option 1 — one monolithic CLI/effect function

This approach would read the graph, marker, work artifacts, and Git status, then print the verdict in a
single `settle.ts` function.

### Advantages

- Fewer exported types.
- The first consumer could be implemented quickly.
- Marker parsing and rendering would be colocated.

### Rejection

- It violates the repository's pure-core/impure-shell rule.
- Delta and all-done logic would require filesystem-heavy tests.
- Future sweep would have to import a CLI module or duplicate completion derivation.
- A malformed marker could accidentally escape as an unhandled JSON exception.
- It mixes this ticket with the explicitly dependent CLI ticket.

## Option 2 — many narrow helpers with no aggregate verdict

This approach would expose separate functions for current done ids, epic counts, marker parsing,
exceptions, and review sorting. The CLI would call each and assemble its own output.

### Advantages

- Every individual function is tiny.
- Sweep could import only the all-done helper.
- Unit tests could isolate each transformation.

### Rejection

- It leaves the verdict contract unowned.
- The CLI would become the place where ordering and cross-field consistency are judged.
- Marker refusal could be handled inconsistently by different consumers.
- `delta`, `epics`, `allDoneEpicIds`, and `nextMarker` could come from different snapshots.
- This contradicts the ticket's request for a pure verdict computation.

## Option 3 — one aggregate computation over typed plain inputs

### Chosen

Create `computeSettleVerdict(input)` returning a discriminated union:

- `{ kind: "verdict", ... }` for a valid marker or first settle;
- `{ kind: "refusal", code: "malformed-last-settle-marker", ... }` for invalid marker bytes.

The successful verdict contains the board delta, per-epic summaries, all-done ids, gate facts,
presweep facts, review concerns, exceptions, and next marker. Small exported helpers support marker
parsing/serialization and per-epic derivation, but the aggregate function is authoritative.

### Rationale

- The whole result is computed from one immutable graph snapshot.
- Expected bad state remains returned data.
- The next CLI ticket can switch on one discriminator.
- Sweep can reuse the exported per-epic/all-done derivation without importing effects.
- Exact object tests can pin every acceptance field and ordering rule.
- The contract remains executor- and presentation-agnostic.

## Decision 1 — a versioned done-frontier marker

Use this canonical value shape:

```ts
interface LastSettleMarker {
  readonly version: 1;
  readonly doneTicketIds: readonly string[];
}
```

The durable bytes are JSON. The core exports a path constant for the future shell, a parser accepting
`string | null`, and a serializer for canonical output.

### Why a done frontier

- “Newly done” is set difference over stable ticket ids.
- It does not depend on clocks or file mtimes.
- It survives a settle process restart.
- It permits an immediately repeated settle to produce an empty delta.
- Historical ids can remain in the marker even if a board is later archived.

### Why not store a timestamp

Ticket frontmatter does not carry a reliable done timestamp. Comparing file mtimes would couple the
verdict to filesystem details and could misclassify edits. A timestamp would look precise without a
corresponding event clock.

### Why not store a board hash

A hash can say the board changed, but cannot directly name tickets newly done. Recovering the delta
would require the previous board snapshot, making the marker much larger and more brittle.

### Marker validation

A marker is valid only when:

- the top-level value is an object, not null or an array;
- it has exactly `version` and `doneTicketIds` keys;
- `version` equals the supported literal;
- `doneTicketIds` is an array of nonblank strings;
- ids are sorted and unique.

Canonical ordering is validated rather than silently repaired. A non-canonical marker indicates a
writer or manual-edit defect and should be visible. Unknown historical ids are allowed because the
board may have archived or removed them.

No marker (`null`) is valid and means first settle. Invalid JSON and invalid shape return the same
named refusal with a diagnostic reason.

## Decision 2 — phase is the completion authority

Define a ticket as cleared only when `ticket.phase === "done"`.

### Rationale

- This is the existing `donePhaseIds` rule.
- The presweep gate binds its contract to phase-done tickets.
- The sweep story explicitly consumes already phase-done tickets.
- Status can transition on a different lifecycle and must not become a competing source.

Per-epic summaries contain:

- `epicId` and `title`;
- `cleared` count;
- `total` count;
- sorted `clearedTicketIds`;
- `allDone` boolean.

An epic is `allDone` only when `total > 0 && cleared === total`. Empty epics do not clear
vacuously. `deriveEpicClearance(graph)` is exported as the future sweep seam.

## Decision 3 — arrays represent ordered sets

`allDoneEpicIds`, `doneTicketIds`, `newlyDoneTicketIds`, and `clearedTicketIds` are sorted readonly
arrays rather than JavaScript `Set` objects.

### Rationale

- They serialize directly to JSON.
- Exact order is testable.
- Consumers cannot accidentally depend on insertion history.
- The ticket calls the all-done value a set semantically, not a required collection type.

The aggregate function creates fresh arrays even when upstream values are readonly. This avoids
leaking caller-owned mutable arrays into the verdict.

## Decision 4 — settle-owned gate summary

Define:

```ts
interface SettleGateResult {
  readonly ok: boolean;
  readonly name: string;
  readonly detail: string;
  readonly nextAction: string | null;
}
```

The next ticket chooses whether this is sourced by rerunning `bun run check` or reading a recorded
result. The core does not import either existing, semantically different `GateResult` type.

For `ok: false`, `nextAction` must be non-null and nonblank. This is part of the typed calling
contract; the aggregate function also rejects invalid wiring with `TypeError`. A passing gate may
use `null`.

## Decision 5 — preserve `SweepVerdict` directly

The input and output use `SweepVerdict` from `presweep-core.ts` via a type-only import. The verdict
copies its arrays.

### Rationale

- This is already the canonical `done => committed` result.
- Rewrapping it would create another definition of presweep success.
- The input remains plain data and pure.
- The shell still owns actually running Git and classification.

For a failed presweep, produce one exception per sorted offender so each line has a path-specific
next action:

```text
Commit or restore <path>, then rerun `bun run check:presweep`.
```

An inconsistent `ok: false` verdict with zero offenders is a caller wiring defect and throws rather
than fabricating an action.

## Decision 6 — review concerns enter as already extracted facts

Define:

```ts
interface ReviewConcern {
  readonly ticketId: string;
  readonly name: string;
  readonly nextAction: string;
}
```

The downstream shell owns reading review artifacts and converting a blocked disposition or named
open concern into this shape. The pure core validates nonblank fields, sorts by ticket id then name,
copies the values, and retains them in the verdict.

### Rejected alternative — parse Markdown inside this module

Review prose is not a stable schema, while `review-disposition.json` is. Filesystem discovery and the
policy for mapping artifacts into concern names need to be settled with the CLI shell. Baking a
Markdown heading parser into this foundational verdict would create new judgment and overreach this
ticket's acceptance.

## Decision 7 — deterministic exceptions are derived, not supplied

The caller supplies facts; `computeSettleVerdict` decides which are exceptions and their global
order:

1. failed gate;
2. presweep offenders, sorted by path;
3. review concerns, sorted by ticket id then name.

Every exception contains:

- `kind`: `gate`, `presweep`, or `review`;
- `name`: stable operator-facing identity;
- `message`: exact failure detail;
- `nextAction`: a nonblank instruction.

Partial epics and an empty delta do not produce exceptions. The renderer therefore can display all
exception entries in red without deciding severity or action wording.

## Decision 8 — malformed marker refuses before board reporting

The refusal shape contains:

- `kind: "refusal"`;
- `code: "malformed-last-settle-marker"`;
- a specific reason;
- the marker path;
- an exact next action telling the operator to remove the marker and rerun for a first-settle
  summary.

The function parses the marker before computing a successful verdict. It does not return partial
epic or gate data alongside a bad delta because that would invite a renderer to present a result
whose “since last settle” claim is untrustworthy.

## Testing design

Use `buildGraph` with small Markdown frontmatter fixtures to exercise the same canonical graph shape
the loader returns while remaining filesystem-free.

Tests will pin:

- a prior marker yields exactly the newly done ticket ids;
- per-epic counts include one all-done and one partial epic;
- `allDoneEpicIds` has the expected stable order;
- gate, presweep, and review fields survive into the result;
- exceptions are ordered gate -> presweep -> review and each action is exact/nonblank;
- no marker reports every current done ticket and `firstSettle: true`;
- a marker generated from a verdict makes an immediate recomputation produce an empty delta;
- invalid JSON, wrong schema version, duplicate ids, and non-canonical ids produce the named refusal;
- marker parsing never throws for malformed persisted bytes;
- an empty epic is not all-done;
- inputs are not mutated.

Focused verification is `bun test src/settle`; the repository gate remains `bun run check`.

## Scope boundary

This ticket creates only `src/settle/settle-core.ts` and `src/settle/settle-core.test.ts` plus private
RDSPI artifacts. Marker filesystem I/O, Git execution, gate execution/record lookup, review artifact
discovery, terminal rendering, ANSI red, CLI parsing, and executor/run-log non-invocation proofs remain
T-079-01-02 work.
