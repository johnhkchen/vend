# T-034-01 — Plan: history-audit-core

*Phase: Plan. Ordered, independently-verifiable steps + the testing strategy. Each step is small enough
to land in the single atomic commit this ticket produces.*

## Testing strategy

- **Unit only.** Both functions are pure/total → ordinary `bun:test` pure-function tests (the pure half
  of `head-build-core.test.ts`). No git, fs, process, or fixtures. No integration test here — the
  worktree sweep is T-034-02's concern.
- **What gets a test:** every AC#3 case + the edges Design surfaced —
  `classifyHistory`: all-green, some-red (names each red sha+subject+summary), summary-absent graceful,
  empty-range honest-empty, input-order preservation.
  `boundRange`: under-bound (no drop), over-bound (loud note), `widenHint` interpolation, default bound,
  `max:0`/negative clamp, no-mutation.
- **Verification criteria:** `bun run check` green (= `baml:gen` → `tsc --noEmit` → `bun test`). `tsc`
  proves the shapes are exhaustively handled (every branch returns a complete `HistoryVerdict` /
  `RangeBound`); the tests prove the report/note *text* and the verdict *values*.

## Steps

### Step 1 — `classifyHistory` + its types

Write the header comment (PURE/TOTAL contract, family placement, house rules), then:
- `CommitResult`, `HistoryVerdict` interfaces (D1, D2).
- `summarySuffix(summary)` private helper (D4): `""` when blank/absent, else `": " + collapsed`.
- `classifyHistory(results)` — the three-branch ladder (D3/Structure):
  empty → honest-empty; no reds → all-green tally; else → ANDON header + per-red lines (input order) +
  tally footer. `anyRed = redCount > 0`.

**Verify:** typecheck passes; eyeball that all three branches return a full `HistoryVerdict`.

### Step 2 — `boundRange` + bound consts/types

- `DEFAULT_HISTORY_MAX = 100` (D6, R12 single-source).
- `BoundOpts`, `RangeBound` interfaces.
- `boundRange(allShas, opts?)`: resolve `max` (`undefined` → default; else `Math.max(0, floor)`),
  `covered = slice(0, max)` (fresh array), `droppedCount = length - covered.length`, loud-vs-quiet note.

**Verify:** typecheck passes; `boundRange` never references git/fs; `covered` is a fresh slice.

### Step 3 — `history-core.test.ts`

Author the two `describe` blocks from Structure's test map. Concrete fixtures inline, e.g.:
- green rows: `{ sha:"a1", subject:"first", green:true }`.
- red row with summary: `{ sha:"b2", subject:"break parser", green:false, summary:"3 failing in parser.test.ts" }`.
- red row without summary: `{ sha:"c3", subject:"oops", green:false }`.
- `boundRange(["s1".."s5"], { max: 2, widenHint: "--max 500" })` → covered 2, dropped 3, note has
  "covered 2 of 5", "bounded at 2", "--max 500".

Assert exact `anyRed`/`redCount`/`droppedCount`/`covered` + `toContain` for report/note substrings,
and assert greens are NOT individually listed in a some-red report (the red list names only reds).

**Verify:** `bun test src/ci/history-core.test.ts` green.

### Step 4 — full check + atomic commit

- `bun run check` — baml:gen, typecheck, full `bun test` all green (confirm no regression in siblings).
- Stage `src/ci/history-core.ts`, `src/ci/history-core.test.ts`, and the five RDSPI artifacts under
  `docs/active/work/T-034-01/`.
- Commit through the live E-033 pre-commit gate (it runs `check:test`; a green tree passes). Do **not**
  touch the ticket frontmatter (Lisa owns phase/status).
- Conventional commit: `feat(ci): history-audit-core — pure classifyHistory + boundRange (T-034-01)`.

**Verify:** commit lands; `git status` clean for tracked source; pre-commit printed `precommit: ok`.

## Risks & mitigations

- **Pre-commit gate blocks the commit if any sibling test is red.** Mitigation: Step 4 runs `bun run
  check` *before* committing; fix any surfaced failure first (this ticket adds only new files, so a
  regression would be pre-existing and out of scope — flag in `progress.md` if seen, don't paper over).
- **Tree-state-sensitive tests** (noted in T-033-02 history: untracked files perturbed
  `head-build-core` tests). Mitigation: stage all new files before running the final `check` so the
  tree the gate sees matches the tree tested; if a transient surfaces, document in `progress.md`.
- **Over-engineering the report text.** Mitigation: keep the three report shapes to the exact lines in
  Design D3; tests assert substrings, not whole strings, so wording stays flexible without churn.

## Out of scope (explicit, per the DAG)

- `check-history.ts`, the `check:history` script, `git rev-list`, worktree building, and the
  `buildCommittedHead` commit-ish generalization — all **T-034-02**.
- Any change to `package.json` scripts or the other CI cores.
