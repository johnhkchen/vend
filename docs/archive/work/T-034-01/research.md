# T-034-01 — Research: history-audit-core

*Phase: Research. Descriptive map of the terrain this ticket lands in. No solutions proposed here.*

## What the ticket asks for

A new **pure** module `src/ci/history-core.ts` with two total functions and no I/O:

1. `classifyHistory(results)` — given per-commit outcomes `{ sha, subject, green, summary? }[]`,
   return `{ anyRed, redCount, report }`. The report names each red commit (sha + subject +
   failure summary, the E-008 "name the failure" style) plus a one-line tally, and is
   **honest-empty** for an empty range (a clear "no commits" line, never a misleading "all green").
2. `boundRange(allShas, opts)` — given the full resolved sha list and a `max`/default bound, return
   `{ covered, droppedCount, note }`, where `note` **loudly** states `covered N of M (bounded at K …)`
   whenever commits are dropped — a **no-silent-cap** discipline.

The impure T-034-02 sweep supplies both inputs (the raw `git rev-list` shas, and the per-commit
`results` it fills by building each commit in an isolated worktree and running `classifyBuildOutcome`).

## The CI gate family this joins (E-008 → E-010 → E-033 → E-034)

This module is the pure core of E-034, the **post-hoc history audit** backstop. The commit-discipline
frame already has three live layers, each a pure-core + thin-impure-verb split behind a `check:*` script:

| Epic  | Gate            | Question answered                        | Pure core              | Impure verb / trigger |
|-------|-----------------|------------------------------------------|------------------------|-----------------------|
| E-008 | `check:committed` | Is the source committed?                | `committed-core.ts`    | `check-committed.ts` / on-stop hook |
| E-010 | `check:head`      | Does the committed HEAD build?           | `head-build-core.ts`   | `check-head.ts` / on-clear hook |
| E-033 | `check:precommit` | Do tests pass at THIS commit?            | `precommit-core.ts`    | `check-precommit.ts` / `.githooks/pre-commit` |
| E-034 | `check:history`   | Was EVERY commit in range test-green?    | **`history-core.ts`** (this) | `check-history.ts` (T-034-02) |

E-033 gates *forward* (the pre-commit hook stops a red commit being made). E-034 audits *backward*
(did any red commit slip in, e.g. via `--no-verify`, a hook that wasn't installed, or a rebase). The
two are complements: a prospective gate and a retrospective sweep over the same invariant.

## Closest precedent: `head-build-core.ts` (the ticket says "mirror" it)

`src/ci/head-build-core.ts` (78 lines) is the template. Its shape, reused here:

- **`BuildOutcome`** (`{ failedStep: BuildStep | null; detail: string }`) — the RAW per-build result
  the impure verb reports as DATA, deciding nothing. `failedStep === null` means all steps passed.
- **`classifyBuildOutcome(outcome) → HeadVerdict`** — the PURE judgment: maps an outcome to
  `{ exitCode, ok, message }`. `ok` is *derived* (`exitCode === 0`), never a desyncable parallel field.
- The message **names the failure** and embeds the `detail` tail (E-008 lineage). Exit vocabulary
  0/1/2 is documented inline; the file header states the PURE contract explicitly.

T-034-01's `classifyHistory` consumes a per-commit `green: boolean` (+ optional `summary`). The ticket
notes the impure sweep fills `green`/`summary` by reusing `classifyBuildOutcome` — so `history-core`
sits one level *above* `head-build-core`: it aggregates many already-classified per-commit verdicts
rather than re-deriving the build judgment. It therefore does **not** import `BuildOutcome`; it takes a
flattened `{ sha, subject, green, summary? }` row (the sweep's job is to flatten `BuildOutcome` → row).

## The pure-core house rules (consistent across the family)

Reading `committed-core.ts`, `head-build-core.ts`, `precommit-core.ts` surfaces a shared discipline
this module must match:

- **PURE/TOTAL.** Every export takes plain data, returns fresh values — no `Bun.spawn`, fs, git, clock,
  network, or process. The file header says so in prose.
- **Returned data, never thrown** (budget.ts / gates.ts house rule). An offending input is a *value*
  in the result, not an exception. "Some commits are red" / "the range was empty" / "we dropped some"
  are all expected outcomes, modelled as data.
- **No desyncable parallel booleans.** `head-build-core` derives `ok` from `exitCode`; `committed-core`
  uses an empty array AS the "clean" verdict. Here `anyRed` should be derived from `redCount > 0`, not
  tracked independently.
- **Exhaustiveness via the compiler.** `precommit-core.verdictMessage` switches over a union with no
  `default` + an `assertNever` guard, so `tsc` rejects an unhandled case. The ticket's "keep the shapes
  exhaustively handled (`tsc` proves the empty/red/green and bounded/unbounded cases)" points at the
  same technique — though here the cases are `if`/branch shapes, not a discriminated union, so the
  exhaustiveness is over *input states* rather than a tag union.
- **Shared contract as a single exported const** (R12). `committed-core.SOURCE_PREFIXES`,
  `precommit-core.HOOKS_DIR` — one source of truth a consumer derives from, never re-lists. A default
  `max` bound for `boundRange` is the analogue here.
- **Honest, visible non-happy paths.** `precommit-core` makes a skip *visible* (a note, never silent);
  `committed-core` never falsely claims clean. The ticket's "honest-empty" and "no-silent-cap" are the
  same principle applied to an empty range and a dropped tail.

## The test precedent: `head-build-core.test.ts` (the ticket cites it)

The pure half of that file (`describe("classifyBuildOutcome", …)`) is an ordinary `bun:test`
pure-function test: construct an input literal, assert exact `exitCode`/`ok` and message *substrings*
(`toContain`). No git, no process, sub-millisecond. (Its second half is an integration proof driving
`buildCommittedHead` against a synthetic repo — that belongs to the **impure** T-034-02, not here.)

The four cases the ticket's AC#3 demands map cleanly onto this style:
- **all-green** — `classifyHistory` of all-`green:true` rows → `anyRed:false`, `redCount:0`, report
  shows the tally, names no commit.
- **some-red** — mixed rows → `anyRed:true`, correct `redCount`, report *names* each red sha+subject
  and its `summary`.
- **empty-range** — `classifyHistory([])` → honest-empty line, `anyRed:false` (not a false "all green").
- **bounded-vs-unbounded** — `boundRange` with more shas than `max` fires the loud note; under the
  bound it does not (`droppedCount:0`, empty/neutral note).

Sibling test files (`committed-core.test.ts`, `precommit-core.test.ts`) confirm the same conventions:
`describe` per function, `test` per case, exact-value + substring assertions, no fixtures for the pure
parts.

## Where the file lands & how it is wired

- **Location:** `src/ci/history-core.ts` + `src/ci/history-core.test.ts`, alongside the other cores.
  `tsconfig`/test globbing already covers `src/**`, so no config change is needed for the test to run
  under `bun test` (which is `check:test`).
- **No new `package.json` script in this ticket.** `check:history` is T-034-02's deliverable (it needs
  the impure runner to invoke). `bun run check` (= `baml:gen` → `check:typecheck` → `check:test`) will
  typecheck and test this module via the existing `check:typecheck` + `check:test` scripts. AC#3's
  "`bun run check:*` green" is satisfied by typecheck + test passing.
- **Downstream consumer:** `check-history.ts` (T-034-02) will `git rev-list` a range → `boundRange` →
  build each `covered` sha in a worktree (generalizing `buildCommittedHead` to take a commit-ish) →
  `classifyBuildOutcome` per commit → assemble `results` rows → `classifyHistory` → print `report`,
  exit non-zero iff `anyRed`. That dependency direction (impure depends on pure) is fixed by the DAG:
  T-034-02 `depends_on: [T-034-01]`.

## Constraints & assumptions surfaced

- **Non-monotonic red-ness** (from the E-034 pull notes): a history can go green→red→green, so the
  audit is a **linear sweep**, not a bisect. That's the impure sweep's concern; for the pure core it
  means `classifyHistory` must report *every* red commit independently (a count + per-commit lines),
  not just a first/last transition. The `report` therefore lists all reds, in input order.
- **Ordering:** the ticket leaves order to the caller (the sweep passes rows in `git rev-list` order —
  typically newest-first). The core should preserve input order in the report and not re-sort, so the
  report reads in whatever order the sweep chose. (Worth a Design decision.)
- **`summary` is optional.** A red row may lack a summary (the sweep couldn't capture one); the report
  must still name the commit and degrade gracefully (no `"undefined"` leak — cf. `precommit-core.tail`).
- **`opts` shape for `boundRange`.** The ticket writes `boundRange(allShas, opts)` with a `max`/default.
  Open question for Design: is `opts` `{ max?: number }` with an exported default const, and what is
  the `<range>` token interpolated into the "widen with …" nudge (a caller-supplied hint vs. a fixed
  placeholder)? The no-silent-cap requirement fixes the *behaviour*; the exact field names are a Design
  call.
- **`droppedCount` vs `covered.length`.** `covered = allShas.slice(0, max)`, `droppedCount =
  max(0, allShas.length - max)`. M (total) = `allShas.length`, N (covered) = `covered.length`,
  K (bound) = `max`. The note must use all three so the reader can see exactly what was skipped.

## Cited / read

- `src/ci/head-build-core.ts` — the mirror (BuildOutcome / classifyBuildOutcome, pure-core shape).
- `src/ci/head-build-core.test.ts` — the pure-function test precedent (AC#3 cites it).
- `src/ci/committed-core.ts` — pure-core split + R12 single-source contract (SOURCE_PREFIXES).
- `src/ci/precommit-core.ts` — most recent core: exhaustive switch + assertNever, visible-skip note,
  `tail()` graceful-undefined helper, HOOKS_DIR shared const.
- `src/ci/check-head.ts` — `buildCommittedHead` (~53), the seam T-034-02 generalizes (not this ticket).
- `package.json` — `check` / `check:test` / `check:typecheck` scripts; how a new core gets exercised.
