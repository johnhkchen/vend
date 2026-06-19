# T-013-01 — Research

*Log the allocated envelope to the run record + a pure run-log reader.*

Descriptive map of what exists today and how it connects. No solutions here.

## The ticket in one line

The recalibration core (E-013, R3 / IA-12–15) must be able to ask the Ledger
"what did finishing actually cost for this play?" — but today the Ledger does not
record the **allocated envelope**, only the actuals. T-013-01 closes that gap by
(a) embedding the `Budget` in the run record (backward-compatibly) and (b) adding a
**pure** reader that loads `.vend/runs.jsonl` and filters a play's runs by outcome.

## The write path (what produces a record)

### `src/log/run-log.ts` — the record shape + writer

The house "two faces" pattern (pure core + one thin impure verb):

- **PURE.** `buildRunRecord(input: RunRecordInput): RunRecord` validates non-empty
  ids/timestamps (throws `RangeError`), coerces absent/non-finite numbers to `0`
  (`num()`), normalizes usage (`normalizeUsage`) and gate rows (`normalizeGates`),
  stamps `v: RUN_LOG_SCHEMA_VERSION` (currently `1`), and returns a **frozen** object.
- **PURE.** `serializeRunRecord(record): string` renders exactly one JSONL line
  (`JSON.stringify` + `\n`); the "one record per physical line" invariant lives here.
- **IMPURE.** `appendRunLog(input, opts)` is the single fs verb: `mkdir -p` +
  `appendFile` (O_APPEND). Not unit-tested by contract — its logic is the pure pair.

Key types:

- `RunRecordInput` (pre-normalization, what the runner hands in): `runId`, `play`,
  `epic`, `model`, `outcome`, `usage?`, `costUsd?`, `gateResults?`, `startedAt`,
  `endedAt`.
- `RunRecord` (normalized, frozen, serialized): same fields plus `v`, with `usage`
  as `NormalizedUsage` (all four sub-counts finite) and `gateResults` defaulted to `[]`.
- `RunOutcome` = `"success" | "gate-failed" | "timed-out" | "budget-exhausted" |
  "id-collision"` (a `const` tuple `RUN_OUTCOMES`).

**Decoupling contract (the module's stated invariant, lines 19–24):** run-log
imports **nothing** from `src/executor/` or `src/budget/`. The shapes it logs
(`UsageInput`, `GateResult`) are declared **locally** as structural contracts; the
seam's `result.usage` and budget's `Usage` satisfy them by duck-typing. This keeps
the DAG edge honest (T-001-04 depended only on T-001-01).

> Constraint for this ticket: embedding `Budget` must respect this decoupling. The
> `Budget` type is `{ timeMs, tokens }` — two numbers. We can mirror it as a local
> structural interface (the same trick already used for `UsageInput`) rather than
> `import`-ing from `src/budget/budget.ts`, preserving the zero-coupling rule.

### `src/budget/budget.ts` — the `Budget` type to embed

`Budget = { readonly timeMs: number; readonly tokens: number }` — the allocation
made at the counter. Also exports `countTokens(usage)` (the single definition of
"spent": sum of all four sub-counts) and `check(budget, usage): BudgetOutcome`.
`countTokens` is the canonical spent-total — the reader's "total tokens per record"
derivation should agree with it (sum of the four buckets).

### `src/engine/cast.ts` — the lone caller of `appendRunLog`

`castPlay(play, inputs, budget, opts)` is the generic cast loop. It already **has the
`budget` in scope** (it is the third positional parameter, used for `timeoutMsFor`
and `check`). The single `appendRunLog(...)` call is at lines 154–168 and currently
passes `runId, play, epic, model, outcome, usage, costUsd, gateResults, startedAt,
endedAt`. Adding the envelope is a one-field addition at this call site — `budget`
is right there; no new plumbing.

This is the **only** production caller. Greps for `appendRunLog` / `RunRecordInput`
elsewhere hit only comments (materialize.ts, chain-propose-decompose.ts) and the test
file. So the blast radius of widening the input is: `run-log.ts`, `cast.ts`, and the
two test files.

## The data on disk

`.vend/runs.jsonl` — 10 records today, schema `v:1`. A sample line:

```json
{"v":1,"runId":"A1","play":"decompose-epic","epic":"E-001","model":"claude-cli-default",
 "outcome":"success","usage":{...},"costUsd":0.43995,"gateResults":[...],
 "startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}
```

**No `budget`/envelope field.** So the cost-vs-budget question is unanswerable from
the log as it stands — exactly the gap noted in the session ledger. These 10 existing
records are the **backward-compatibility fixture**: after this change they must still
parse (the new field is optional / absent on them).

## The read path (what does NOT exist yet)

There is **no reader**. Nothing in `src/` reads `.vend/runs.jsonl` back into records —
greps for `readRuns` / `forPlay` / `readFile.*runs` return nothing. The Ledger
(recalibration, T-013-02) is the first consumer and depends on this ticket. So the
reader is greenfield; we choose its shape.

The ticket prescribes the shape: `readRuns(jsonl): RunRecord[]` (parse) + `forPlay(
records, play, {outcome?})` (filter). Plus per-record derivations: wall-clock
(`endedAt − startedAt`) and total tokens. It must **tolerate malformed/partial lines
without throwing** (skip + count) — the append-only ledger can contain a torn final
line if a process died mid-write, and old records lack the new field.

## Testing patterns to mirror

`src/log/run-log.test.ts` (188 lines): `bun:test` (`describe/test/expect`), a
`baseInput(over)` factory, `test.each([...TUPLE])` (note the **spread** — a readonly
const tuple must be spread for `test.each`, per a recorded prior fix), round-trip
assertions (`JSON.parse(serialize(x))` deep-equals `x`). Pure functions only — no fs,
no clock. The reader's tests should follow suit: a fixture **string** (JSONL literal),
not a real file, since the parse/filter core is pure.

## Constraints & assumptions surfaced

1. **Backward compatibility is an AC, not a nicety.** Old records have no envelope;
   `readRuns` must default it (to `undefined`/absent) and `buildRunRecord` must accept
   its absence. The 10 live records are the proof fixture.
2. **Purity boundary.** Parse + filter + derive are pure (testable on strings). The
   only fs touch is a thin `readFile`-then-`readRuns` shell — mirror `appendRunLog`:
   the impure verb is untested, its logic is the tested pure core.
3. **Decoupling.** Do not `import` `Budget` from `src/budget/` into `run-log.ts`;
   mirror it as a local structural interface (the `UsageInput` precedent).
4. **`check:*` gates** = `check:typecheck` (tsc --noEmit) + `check:test` (bun test).
   No lint script. `check:committed` polices the tree on commit.
5. **Outcome semantics for the Ledger (IA-13):** `success` = uncensored cost;
   `budget-exhausted`/`timed-out` = right-censored at the envelope (`≥ envelope`
   lower bounds). The `forPlay` outcome filter is what lets the recalibrator separate
   "successes" (bound the tail from these) from "censored" (track the stop rate). This
   ticket only needs to *enable* that split; it does not compute percentiles (T-013-02).
