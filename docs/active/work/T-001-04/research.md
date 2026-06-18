# Research — T-001-04 countable-run-log

Descriptive map of the codebase as it bears on a per-run JSONL log. What exists,
where, how the pieces connect, and the constraints the ticket inherits. No
solutions here.

## The ticket in one line

Write `src/log/run-log.ts`: append exactly one JSONL record per run to
`.vend/runs.jsonl` (path configurable), so the later consistency layer is *just
reading data we already kept*. The record must be countable (`wc -l` / `jq`) and
a failed run still writes a record carrying its failure outcome.

## Where this sits in the tree

```
src/
  budget/   budget.ts + budget.test.ts        ← T-001-03, DONE (be7e978)
  executor/ claude.ts + claude.test.ts        ← T-001-02, in flight
  gate/     .gitkeep                            ← not yet implemented
  log/      .gitkeep                            ← THIS TICKET lands here
  play/     .gitkeep
  smoke.test.ts
```

`src/log/` is empty but reserved. The module is new, self-contained, and
parallel to T-001-02 / T-001-03 — it shares the branch but no files with them.

## The hard constraint: no dependency on seam or budget (AC #4)

The ticket is explicit: the run-log module imports **nothing** from
`src/executor/` (the seam, T-001-02) or `src/budget/` (T-001-03). *The runner
passes it the data.* The log is a sink, not a collaborator. This mirrors the
inversion budget already uses: `budget.ts` declares a local structural `Usage`
interface and never imports the seam, so it builds independently while T-001-02 is
still in flight. The run-log must use the same trick for every shape it logs
(usage, gate results) — declare local structural types, couple to nothing.

This is load-bearing for the DAG too: T-001-04 depends only on T-001-01 (the
scaffold), not on the other slice tickets. If we imported from them we would be
lying about the dependency edges (CLAUDE.md concurrency note: a shared import is a
missing edge). The decoupling keeps the stated DAG honest.

## The established module shape (two precedents to match)

Both prior `src/` modules follow one shape, and the ticket's AC #3 ("pure record
construction is unit-tested; the append is a thin fs call") asks for the same:

**budget.ts** — fully pure. No network, fs, clock, or child process. Plain
`interface` + free functions + a discriminated-union outcome. `assertPositiveInt`
throws `RangeError` on caller error at the boundary. `num()` coerces
`undefined / non-finite → 0`. Every function and branch is unit-tested with
fabricated inputs (`budget.test.ts`), and that test file *is* the `check:test`
gate.

**claude.ts** — mostly pure helpers (`buildArgs`, `parseStreamJsonLine`,
`createLineBuffer`, `makeStreamConsumer`, `awaitChildClose` against a `ChildLike`
fake) plus exactly **one** impure function (`dispense`) that spawns a process and
is deliberately *not* unit-tested — "the byte-handling it relies on lives in the
PURE helpers above." Impurity is quarantined to a single thin function; everything
else is tested without I/O.

The run-log maps onto this precedent cleanly: **pure record construction +
serialization** (testable like budget), and **one thin impure append** (untestable
like `dispense`, quarantined). The split the AC asks for is the split the codebase
already uses.

## The data the runner will hand us (field provenance)

The record fields named in AC #1, traced to where each value originates:

- `runId`, `play`, `epic` — orchestration identifiers the runner owns. `play` is
  the playbook name (CLAUDE.md: the product is named, grab-and-go playbooks);
  `epic` is the E-001-style id. Plain strings.
- `model` — the pinned model id. The seam already accepts `model?` in
  `DispenseOptions` and passes it as `--model`; the runner knows which model it
  dispatched.
- `usage` — `{ input/output tokens }` at minimum. The seam returns a terminal
  `ResultMessage` carrying `usage?: Record<string, unknown>`. Budget's local
  `Usage` interface already names the four real sub-counts: `input_tokens`,
  `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`.
  The log should accept that same structural shape (declared locally, not
  imported) so the runner forwards `result.usage` straight through.
- `costUsd` — the seam's `ResultMessage.total_cost_usd?: number`. A dollar figure
  the CLI reports; the log records it verbatim (the log is not a cost model).
- `outcome` — one of `success | gate-failed | timed-out | budget-exhausted`.
  These map directly to the terminal states the other modules already produce:
  `timed-out` ← seam's `ClaudeTimeoutError` (`code "ETIMEDOUT_CLAUDE"`);
  `budget-exhausted` ← budget's `check` returning `status: "exhausted"`
  (`code "EBUDGET_EXHAUSTED"`); `gate-failed` ← a gate verdict (gates not built
  yet); `success` ← none of the above tripped. The runner classifies; the log
  records the label.
- `gateResults` — per-gate pass/fail. `src/gate/` is a `.gitkeep` only, so there
  is **no GateResult type to import** — another reason the log must declare its
  own structural shape and stay decoupled.
- `startedAt`, `endedAt` — run wall-clock bounds. CRITICAL for purity: budget
  proves the house style forbids a clock inside a pure module. The runner must
  *stamp these and pass them in*; the log must not call `new Date()` during record
  construction, or it forfeits pure testability.

## Toolchain / runtime facts that constrain the fs call

- **Bun + ESM**, `"type": "module"`, strict TS, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax` (so type-only imports need `import type`),
  `allowImportingTsExtensions` (imports carry the `.ts` extension, as the prior
  modules do).
- Test runner is `bun:test` (`describe/test/expect`), invoked by `bun test` via
  `check:test`. `check` = `tsc --noEmit && bun test`. Any new file must keep both
  green.
- Bun ships `node:fs` / `node:fs/promises`; `claude.ts` already imports from
  `node:child_process`, establishing the `node:`-prefix convention for the one
  module that touches the platform. The append needs directory creation
  (`.vend/` may not exist) plus an append-mode write.

## Countability — what "`wc -l` / `jq`" demands of the bytes

`wc -l` counts newlines, so **one record = exactly one `\n`-terminated line**, and
a record must contain no interior literal newline. `JSON.stringify` (no `space`
argument) never emits raw newlines — it escapes them inside strings — so a single
`stringify` per record + a trailing `\n` satisfies both `wc -l` (line count = run
count) and `jq` (each line is a standalone JSON object). Append-only means we only
ever add lines; we never rewrite, so the file is a monotonic ledger.

## Assumptions & open questions (carried into Design)

- **A:** the runner is the sole writer and stamps `startedAt`/`endedAt` — so no
  in-module clock and no cross-process write contention to solve in this slice.
- **A:** timestamps arrive as ISO-8601 strings (runner-stamped), keeping the
  module clock-free and the line trivially `jq`-readable.
- **Q:** does the append need its own concurrency guard? CLAUDE.md says commit
  serialization is handled by Lisa's file locking and "agents do not need to
  coordinate"; a single-writer runner + O_APPEND is the conservative assumption.
- **Q:** should the line carry a schema version for the forever-append log? Raised
  here, decided in Design.
- **Out of scope (confirmed by the slice):** no reading/querying, no rotation, no
  aggregation, no cost model — those are the *later* consistency layer this log
  feeds, not this ticket.
