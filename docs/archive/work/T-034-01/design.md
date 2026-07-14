# T-034-01 — Design: history-audit-core

*Phase: Design. Options, tradeoffs, and the chosen shape — grounded in Research. Decisions are
numbered D1…D7 and carried into Structure/Plan.*

## The two functions, fixed by the ticket

```ts
classifyHistory(results: CommitResult[]): HistoryVerdict   // { anyRed, redCount, report }
boundRange(allShas: string[], opts?: BoundOpts): RangeBound  // { covered, droppedCount, note }
```

Everything below is the *how* and the *exact shapes*, decided against the Research precedent.

---

## D1 — `CommitResult` row shape: flattened, not `BuildOutcome`

The ticket models each per-commit outcome as `{ sha; subject; green; summary? }`. Two options:

- **(A) Reuse `BuildOutcome`** from `head-build-core` directly as the per-commit payload.
- **(B) A new flat `CommitResult` interface** with a boolean `green` + optional `summary`. ✅

**Chosen: B.** The ticket is explicit (`green: boolean`, `summary?`), and Research established this
module sits *above* `head-build-core`: the sweep flattens `BuildOutcome` → row (it owns the
`classifyBuildOutcome` call). Importing `BuildOutcome` here would drag the build-step vocabulary
(`preflight`/`worktree`/`build`) into a module that only cares "green or not". A flat boolean keeps the
core decoupled and total over exactly the four AC cases. The sweep does the mapping
(`green = outcome.failedStep === null`, `summary = verdict.message` or the detail tail).

```ts
export interface CommitResult {
  sha: string;       // full or short — the core renders it verbatim, never resolves it
  subject: string;   // the commit subject line (git log -1 --format=%s)
  green: boolean;    // true = tests passed at this commit; false = red
  summary?: string;  // failure context for a red commit (the E-008 "name the failure" tail)
}
```

## D2 — `HistoryVerdict`: derive `anyRed`, don't track it

```ts
export interface HistoryVerdict {
  anyRed: boolean;   // === redCount > 0; derived, never an independent field
  redCount: number;
  report: string;    // the full human-readable audit text
}
```

`anyRed` is computed as `redCount > 0`, mirroring `head-build-core`'s derived `ok`. No parallel boolean
to desync (the family house rule). The caller (T-034-02) exits non-zero iff `anyRed`.

## D3 — Report format: honest-empty / all-green / some-red, three mutually-exclusive shapes

The report is built by branching on the input, and each branch is a distinct, exhaustive shape:

- **empty range** (`results.length === 0`): a single honest line —
  `history: no commits in range — nothing to audit`. **Not** "all green" (Research: that would lie).
  `anyRed:false`, `redCount:0`.
- **all green** (`length > 0`, no reds): a tally line —
  `history: ok — all N commit(s) test-green`.
- **some red** (`redCount > 0`): a header naming the count, then one line per red commit, then a tally:
  ```
  history: ANDON — 2 of 5 commit(s) are red:
    abc1234 fix the parser: tests failed (exit 1): 3 failing in parser.test.ts
    def5678 refactor cast: tests failed (exit 1)
  history: 2 of 5 commit(s) red — audit failed
  ```
  Each red line is `  <sha> <subject>` + the summary suffix (when present). Greens are **not** listed
  individually (the audit's job is to surface reds; listing every green would bury the signal — same
  reasoning as `committed-core` only emitting offenders).

**Why a string, not structured lines?** The sibling cores all return a single `message` string the
impure verb prints verbatim; `classifyHistory.report` follows that — the caller does zero formatting.
`anyRed`/`redCount` carry the machine-readable verdict for the exit decision, so nothing is lost.

## D4 — `summary` rendering: graceful, never `"undefined"`

A red row with no `summary` must still name the commit. Reuse the `precommit-core.tail()` idiom: a
local helper returns `": " + normalized` when a summary is present and `""` when absent — so a missing
summary yields a bare `  <sha> <subject>` line, never `… <subject>: undefined`. Whitespace in the
summary is collapsed (`replace(/\s+/g, " ")`) so a multi-line captured tail stays one report line.

## D5 — Ordering: preserve input order, do not re-sort

`committed-core.classifyPorcelain` sorts because paths have no inherent order. Here the rows arrive in
`git rev-list` order (a meaningful sequence — chronological), so the core **preserves input order** in
the report and the red-list. Re-sorting would destroy the "when did red-ness appear" signal that makes
a linear history audit readable (Research: red-ness is non-monotonic, so order matters). `redCount` is
order-independent; the report lists reds in the order they appear in `results`.

## D6 — `boundRange`: opts shape, default const, and the loud note

```ts
export const DEFAULT_HISTORY_MAX = 100;   // R12 single-source default bound

export interface BoundOpts {
  max?: number;      // cap on commits to sweep; defaults to DEFAULT_HISTORY_MAX
  widenHint?: string;// caller's range token for the nudge, e.g. "--max 500" or "origin/main..HEAD"
}

export interface RangeBound {
  covered: string[];   // allShas.slice(0, K) — the commits to actually sweep
  droppedCount: number;// max(0, M - K)
  note: string;        // loud when droppedCount>0, neutral/confirming otherwise
}
```

- **Default bound as an exported const** (R12, cf. `HOOKS_DIR`/`SOURCE_PREFIXES`): the impure caller
  derives the default from `DEFAULT_HISTORY_MAX`, never re-literals `100`.
- **`max` guard:** a non-positive or non-finite `max` is meaningless. Decision: clamp to *at least 0*
  via `Math.max(0, Math.floor(max))`; `max:0` legitimately covers nothing (the caller may want a
  dry-run count). A negative `max` is treated as `0` (returned data, never thrown — house rule).
  `max === undefined` → `DEFAULT_HISTORY_MAX`.
- **The note (the no-silent-cap heart):**
  - `droppedCount > 0` → `history: covered N of M (bounded at K — widen with <hint>)`, where
    `<hint>` is `widenHint` when supplied, else a generic `a higher --max`. This is the loud line the
    ticket demands; without it, auditing 20 of 200 and printing "all green" would be a lie.
  - `droppedCount === 0` → a quiet confirming note `history: covered all M commit(s) (within bound K)`
    so the caller can always print *something* truthful; it never fabricates coverage.

**Why bound here, not in the sweep?** Keeping the cap in the pure core makes "what got dropped" a
*tested* property (AC#3's bounded-vs-unbounded case) instead of an untested slice in impure code. The
sweep just calls `boundRange` and trusts the note.

## D7 — Exhaustiveness strategy

`precommit-core` uses a discriminated-union switch + `assertNever`. Here the branches are over *input
states* (empty / all-green / some-red for `classifyHistory`; dropped / not-dropped for `boundRange`),
not a tag union, so a `switch`+`assertNever` doesn't apply cleanly. Instead:

- `classifyHistory` computes `redCount` once, then branches `length===0` → empty, `redCount===0` →
  all-green, else some-red. The three branches are total over `(length, redCount)` and `tsc` checks the
  return type on each path. This satisfies the ticket's "`tsc` proves the empty/red/green … cases" —
  the proof is that every branch returns a fully-populated `HistoryVerdict`.
- A tiny internal `reportFor` could be split out, but with three short branches inline is clearer and
  matches `head-build-core.classifyBuildOutcome`'s flat `if` ladder. **Chosen: inline branches**, no
  union, no `assertNever` (there is no open union to guard).

## Rejected alternatives

- **Returning structured `redLines: string[]` instead of a `report` string** — rejected: breaks the
  family contract (sibling verbs print one `message`/`report` verbatim) and pushes formatting into the
  impure caller, the exact split this architecture avoids.
- **Importing/reusing `BuildOutcome`** (D1-A) — rejected as above; couples the aggregator to build-step
  internals it doesn't need.
- **Sorting reds by sha or subject** (vs D5) — rejected: destroys chronological signal.
- **Throwing on `max <= 0` or empty `allShas`** — rejected: violates "returned data, never thrown";
  an empty range and a zero bound are valid, expected inputs the core must render honestly.
- **A `default` arm / no exhaustiveness** — rejected: the family proves cases via the compiler; flat
  total branches achieve that without an artificial union.

## Test plan (preview of AC#3, detailed in Plan)

`history-core.test.ts`, pure-function style (`head-build-core.test.ts` precedent): `describe` per
function; cases — all-green, some-red (asserts each red sha+subject+summary appears, greens don't),
empty-range (honest-empty substring, `anyRed:false`), `boundRange` dropped (loud note names N/M/K) and
not-dropped (`droppedCount:0`, neutral note, `covered === allShas`), plus `summary`-absent graceful
render and `max:0` / negative-`max` edge. Assertions: exact `anyRed`/`redCount`/`droppedCount` +
`toContain` substrings for report/note text.
