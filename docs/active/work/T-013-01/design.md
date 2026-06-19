# T-013-01 — Design

*Decisions, with rationale, grounded in the research. What was rejected and why.*

Two design problems: **(A)** how to embed the allocated envelope in the record
backward-compatibly, and **(B)** the shape of the pure reader. Plus where the fs
shell lives.

---

## Decision A — embed the envelope as an optional local `Envelope` interface

### The question
The record must carry the allocated `Budget` (`{ timeMs, tokens }`) alongside actuals,
without (i) breaking the 10 existing field-less records and (ii) violating run-log's
zero-coupling-to-`src/budget/` invariant.

### Options
1. **`import { Budget } from "../budget/budget.ts"` and add `budget: Budget`.**
   Rejected. Breaks the module's stated decoupling contract (lines 19–24): run-log
   imports nothing from `src/budget/`. The whole point of the local `UsageInput`
   mirror is to keep that DAG edge honest. Importing `Budget` would regress it.
2. **Mirror `Budget` as a local structural interface `Envelope`, optional on input,
   defaulted to `undefined`/absent on the record.** *Chosen.* Exactly the `UsageInput`
   precedent: declare `interface Envelope { readonly timeMs: number; readonly tokens:
   number }` locally; budget's `Budget` satisfies it by duck-typing at the call site.
   Optional (`envelope?`) so old records parse and an envelope-less cast still logs.
3. **Flatten into two fields `budgetTimeMs?` / `budgetTokens?`.** Rejected. Loses the
   "it's one allocation" cohesion, and an envelope is conceptually a single object
   (matches `Budget`, matches how `recalibrate` will emit one). Two correlated optionals
   invite half-set states; one optional object cannot be half-present.

### Naming: `envelope`, not `budget`
The product vocabulary (IA-12) calls the allocation the **envelope**. The record field
is named `envelope` to read as Ledger vocabulary at the consumer; the *type* mirrors
`Budget`. This also avoids any reader confusion with the actuals.

### Normalization
`buildRunRecord` already coerces numbers with `num()`. The envelope gets the same
treatment **only when present**: if `input.envelope` is supplied, normalize its two
numbers (`num`); if absent, omit the field entirely (do **not** write `envelope: null`
or a zeroed envelope — absence is meaningful: "this cast did not record one"). A zeroed
envelope would be a lie the recalibrator can't distinguish from a real 0 (and 0 is an
invalid budget anyway). Omission keeps the line minimal and the back-compat symmetric:
old records and envelope-less new records look identical.

> Schema version stays `v:1`. The field is purely additive and optional; nothing about
> existing records becomes invalid, so a version bump (and the migration story it
> implies) is unwarranted. This matches the "one integer is insurance" intent — we
> bump only on a breaking shape change.

---

## Decision B — the pure reader: `readRuns` + `forPlay` + derivations

### `readRuns(jsonl: string): { records: RunRecord[]; skipped: number }`
- **Input is a string, not a path** — keeps it pure and unit-testable on literals
  (mirrors how `serializeRunRecord` is tested). The fs read is a separate thin shell.
- Splits on `\n`, ignores blank lines, `JSON.parse` each, and **revives** through a
  validator that returns a `RunRecord` or `null`. A `null`/throw increments `skipped`
  and the line is dropped — never throws (AC: tolerate malformed/partial lines).
- Returns the skip **count** so the shell/consumer can surface "N lines unreadable"
  rather than silently swallowing a torn ledger.

### Reviving a line — reuse `buildRunRecord`?
Considered routing each parsed line back through `buildRunRecord`. **Rejected as the
validator**: `buildRunRecord` *throws* on bad data (its job at the write boundary), and
it would re-`num()`-coerce already-normal data and re-freeze. The reader's job is the
opposite stance — **never throw, skip instead**. So a dedicated lightweight
`reviveRecord(parsed: unknown): RunRecord | null` does structural checks (object,
non-empty string ids, known outcome, an object `usage`) and returns `null` on any
miss. It tolerates the optional `envelope` (present→validate two finite numbers, else
drop the field) and tolerates **absent** newer fields on old records. This keeps the
two boundaries' philosophies distinct: write = assert loudly, read = degrade quietly.

### `forPlay(records, play, opts?: { outcome?: RunOutcome }): RunRecord[]`
Pure filter: `play` match, optional `outcome` match. This is the seam the recalibrator
needs (IA-13): `forPlay(recs, p, { outcome: "success" })` = the uncensored sample to
bound the tail from; the censored set (budget-exhausted/timed-out) is the same call
with the other outcome. Keeping it a thin predicate filter (not a percentile engine)
respects the DAG: T-013-01 *enables* the split; T-013-02 *computes* on it.

### Per-record derivations — `wallClockMs(r)` and `totalTokens(r)`
Two tiny pure helpers, not stored on the record (derivable ⇒ don't persist):
- `wallClockMs(r) = Date.parse(r.endedAt) − Date.parse(r.startedAt)` — guard `NaN`
  (unparseable timestamp) → return `null` rather than `NaN` so a consumer can branch.
- `totalTokens(r) = sum of the four usage sub-counts` — must agree with budget's
  `countTokens`; we inline the same sum (can't import budget here either) and note the
  shared definition in a comment. AC asks these be *unit-tested*, which is why they are
  named functions and not inline arithmetic at the call site.

---

## Decision C — the fs shell lives in `run-log.ts`, named `loadRunLog`

The reader's pure core (`readRuns`/`forPlay`/derivations) sits in `run-log.ts` next to
its mirror image (`buildRunRecord`/`serializeRunRecord`). The one impure verb —
`loadRunLog(opts?): Promise<{ records; skipped }>` — does `readFile(path, "utf8")`
(defaulting to `DEFAULT_RUN_LOG_PATH`), returns `{ records: [], skipped: 0 }` if the
file is **absent** (a fresh project has no ledger; ENOENT is not an error), and
delegates all parsing to `readRuns`. Untested by the same contract as `appendRunLog`.

**Rejected:** a new `src/log/run-log-reader.ts` module. The read and write of the same
ledger belong together — one record shape, one schema-version constant, one place to
evolve. Splitting them invites drift. The file grows ~60 lines; still cohesive.

---

## What this design explicitly does NOT do
- No percentile / t-digest / recalibration math (that is T-013-02, IA-13/14).
- No change to `appendRunLog`'s signature beyond the optional input field.
- No schema migration of the 10 existing records — they remain valid as-is.
- No new dependency, no `src/budget/` ↔ `src/log/` import edge.
