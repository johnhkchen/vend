# Design — T-001-04 countable-run-log

Decisions with rationale, grounded in Research. Five questions to settle: (1) the
module split, (2) the record shape and the `outcome` union, (3) how decoupling
from seam/budget is actually achieved, (4) the serialization contract that makes
the log countable, (5) the shape of the one impure fs call. Each is decided and
the rejected options recorded.

## Decision 1 — Split: pure builder + serializer, one thin impure append

**Chosen.** Three exported functions mirroring the house pattern:

```ts
export function buildRunRecord(input: RunRecordInput): RunRecord;   // PURE
export function serializeRunRecord(record: RunRecord): string;      // PURE (→ one line + "\n")
export async function appendRunLog(input: RunRecordInput, opts?): Promise<void>; // IMPURE, thin
```

`appendRunLog` *composes* the two pure functions and adds only the fs verbs
(`mkdir -p` + append). This is exactly `claude.ts`'s arrangement: `dispense`
composes the pure helpers (`buildArgs`, `makeStreamConsumer`) and is the single
untested function. `buildRunRecord` and `serializeRunRecord` are unit-tested to
the branch (like `budget.ts`); `appendRunLog` is the lone impure verb, left
untested because all its logic lives in the pure pair it calls — satisfying AC #3
literally ("pure record construction is unit-tested; the append is a thin fs
call").

**Rejected — one `logRun(input)` that builds + writes inline.** Fuses pure and
impure, so "pure record construction is unit-tested" can only be met by writing to
a temp file in tests — reintroducing I/O the house style quarantines. The split is
the testability.

**Rejected — a `RunLog` class holding the path / a stream handle.** Adds
lifecycle and stateful drift for no gain in a single-writer slice; budget's design
already rejected the class form for the same reason. A free function taking the
path per call is stateless and trivially testable.

## Decision 2 — Record shape and the `outcome` union

**Chosen.** A typed `RunRecord` carrying every AC-named field, plus a literal
`outcome` union derived from a `const` tuple so a `switch` over it is exhaustively
checkable by `tsc` (the habit budget set with its `code` literals):

```ts
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out", "budget-exhausted"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export interface RunRecord {
  readonly v: 1;                       // schema version — see below
  readonly runId: string;
  readonly play: string;
  readonly epic: string;
  readonly model: string;
  readonly outcome: RunOutcome;
  readonly usage: NormalizedUsage;     // input/output (+ cache buckets) coerced to numbers
  readonly costUsd: number;
  readonly gateResults: readonly GateResult[];
  readonly startedAt: string;          // ISO-8601, runner-stamped
  readonly endedAt: string;            // ISO-8601, runner-stamped
}
```

`buildRunRecord` validates and normalizes into this shape: required strings
(`runId/play/epic/model`) must be non-empty (else `RangeError` at the boundary,
budget's `assertPositiveInt` precedent); `outcome` must be a member of
`RUN_OUTCOMES` (else `RangeError`); `costUsd` and every usage sub-count are coerced
`undefined / non-finite → 0` via a local `num()` (copied, not imported, from
budget's idiom); `gateResults` defaults to `[]`. The result is `Object.freeze`d so
a logged record cannot be mutated after construction.

**Why a `v: 1` schema version.** An append-only ledger is *forever*; the
consistency layer reads records written across many tool versions. A one-field
version marker is the cheapest possible insurance against an unversioned migration
later, and it directly serves the ticket's reason-for-being ("later just reading
data we already kept"). It is one integer, not a framework — within the slice's
"nameable now" bar because the *first* record we ever write is the one that locks
the format. Noted, not gold-plated.

**Why timestamps as ISO strings, not `Date`.** Keeps `buildRunRecord` clock-free
and pure (Research: budget proves no clock in a pure module), makes each line
directly human- and `jq`-readable, and puts stamping where the wall-clock
knowledge actually is — the runner.

**Rejected — free-form `Record<string, unknown>` record.** Maximally flexible but
abandons the typed contract; a typo'd field name would silently corrupt the
ledger. The whole point is a *countable, queryable* shape — that needs a known
schema.

## Decision 3 — Decoupling: local structural types, import nothing

**Chosen.** `run-log.ts` imports nothing from `src/executor/` or `src/budget/`.
It declares its own structural `NormalizedUsage` and `GateResult`:

```ts
export interface UsageInput {          // what the runner forwards (seam's result.usage shape)
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}
export interface GateResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly detail?: string;
}
```

The seam's `result.usage` satisfies `UsageInput` by duck-typing; budget's `Usage`
interface is field-identical, so the runner can forward the same object to both
with zero compile-time coupling. `GateResult` is declared here because
`src/gate/` is a `.gitkeep` — there is no type to import even if we wanted to
(Research). This is precisely budget's seam-agnostic move, applied a second time,
and it keeps the T-001-04 → T-001-01-only dependency edge honest (AC #4).

**Rejected — import `Usage` from `budget.ts` to avoid duplication.** Four lines of
interface is a trivial duplication; importing them welds the log to budget,
violates AC #4, and turns an honest DAG edge into a lie. If a neutral shared-types
module ever appears, both can move to it then.

## Decision 4 — Serialization: one `JSON.stringify`, trailing `\n`, no interior newline

**Chosen.** `serializeRunRecord(record)` returns `JSON.stringify(record) + "\n"`
— no `space` argument, ever. `JSON.stringify` with no spacing emits no literal
newline (it escapes `\n` inside strings as `\\n`), so each record is guaranteed to
occupy exactly one physical line, and the appended `\n` terminates it. This makes
`wc -l` == run count and every line a standalone `jq` object (Research's
countability requirement, met by construction).

The trailing newline lives **here**, in one place, so "one record per line" is a
single owned invariant rather than something every call site must remember.
`appendRunLog` writes the string verbatim.

A unit test asserts the contract directly: the serialized string ends with exactly
one `\n`, contains no other `\n`, and `JSON.parse` round-trips it back to the
record. A record whose string fields contain embedded newlines is the adversarial
case the test pins (stringify must escape them).

**Rejected — pretty-printed JSON (`stringify(rec, null, 2)`).** Readable, but
multi-line — it breaks `wc -l` (one record spans many lines) and `jq -c`
expectations. Non-negotiable against the AC.

## Decision 5 — The impure append: `mkdir -p` then append-mode write

**Chosen.** `appendRunLog(input, { path = DEFAULT_RUN_LOG_PATH } = {})`:
`buildRunRecord(input)` → `serializeRunRecord` → `fs.mkdir(dirname(path),
{ recursive: true })` → `fs.appendFile(path, line, "utf8")`. `DEFAULT_RUN_LOG_PATH
= ".vend/runs.jsonl"`, overridable via `opts.path` (AC #1 "path configurable").
`node:fs/promises` + `node:path`, matching `claude.ts`'s `node:`-prefix
convention.

Append mode (`appendFile`, i.e. `O_APPEND`) is the right primitive: it never
truncates, only adds, so the ledger is monotonic; and O_APPEND writes are atomic
for the small single-line payloads here, which covers the single-writer runner
assumption without inventing a lock (CLAUDE.md: coordination is Lisa's job). The
`mkdir -p` is idempotent, so the first run creates `.vend/` and every later run
no-ops on it.

**Why a failed run still logs (AC #2), for free.** Because `outcome` is just a
field the runner passes, `appendRunLog` is called identically on the failure path
— the runner classifies `timed-out` / `budget-exhausted` / `gate-failed` and calls
the same function. The log has no happy-path bias to undo; "a failed run still
writes a record" falls out of the design rather than needing a special branch.

**Rejected — manual `open(..., "a")` + `write` + `close`.** More control, more
ways to leak a descriptor; `appendFile` is the one-call thin verb the AC asks for.

## What is deliberately out of scope

No reading/querying/aggregation, no rotation or size cap, no cost model, no
cross-process lock, no in-module clock. This slice writes one honest line per run;
the consistency layer that *reads* the ledger is a later ticket (Research). Adding
any of the above now is overproduction the charter refuses.
