# Review — T-003-04 vend-select-resolve-and-dispatch

Handoff document. What changed, test coverage, open concerns — enough to review without
reading every diff.

## Summary

The press, end to end — E-003's convergence node. `vend <sel>` now parses the selection
mini-language (T-003-03), resolves the 1-indexed picks against the **persisted**
`.vend/menu.json` (T-003-02 — the same list the user just saw), and dispatches each
pick's `DecomposeEpic` in order under its warranted budget (overridable via `--budget`),
each appended to the run log. A materially-stale menu warns "re-run vend" and stops; an
out-of-range pick hard-errors before any dispatch. The house split holds: every decision
is a pure, fixtured function; only the cache read, the re-gather, and the runner spawn
are impure (the untested shell, smoke-proven).

Three atomic commits: **`9087b61`** (pure core), **`5dc9a31`** (cli select arm),
**`8ad8d73`** (press shell + artifacts). Full suite **229 pass / 0 fail**, typecheck
clean.

## Files changed

| File | Δ | Notes |
|---|---|---|
| `src/shelf/press-core.ts` | **new** (~95 ln) | PURE: `epicPathFor`, `isMenuStale`, `planRuns`; `PlannedRun`/`PressOpts`/`PressResult` types. `RunSummary` type-only → addon-free. |
| `src/shelf/press-core.test.ts` | **new** (~85 ln) | 11 fixture tests across the three helpers. |
| `src/shelf/press.ts` | **new** (~80 ln) | IMPURE `pressShelf`: read cache → re-gather → staleness → parse → plan → dispatch. Re-exports core. |
| `src/cli.ts` | **modify** | `select` in `ParsedCommand`; `parseArgs` split into `parseRunArgs`/`parseSelectOrBrowse`; lazy-import select dispatch arm. |
| `src/cli.test.ts` | **modify** | Replaced 2 placeholder assertions with 7 select cases. |
| `docs/active/work/T-003-04/*.md` | **new** | RDSPI artifacts. |

Deliberately **not** changed: `docs/active/tickets/*.md` (Lisa owns phase/status —
left unstaged) and `docs/active/work/T-003-01/review.md` (another ticket's untracked
artifact). `.vend/menu.json` is gitignored runtime telemetry, regenerated, never
committed.

## Public surface

- **`press-core.ts`** (pure, unit-tested): `epicPathFor(root,id) -> string`,
  `isMenuStale(cache, {demand,lisa}, pressAll) -> boolean`,
  `planRuns(cache, indices, root, override?) -> PlannedRun[]`; const `EPIC_DIR`.
- **`press.ts`** (impure shell): `pressShelf(opts: PressOpts) -> Promise<PressResult>`;
  `export *` of the core.
- **`cli.ts`**: `ParsedCommand` gains `{ cmd:"select"; selection; all; budget? }`.

## How a press flows

1. `parseArgs` routes selection-shaped argv (`/^[\d\s,-]+$/`) to `select`, joining
   shell-split tokens with `,`; `--budget` optional (defaults to the warranted
   envelope), `--all` a flag. Non-selection tokens stay `unknown command`.
2. `pressShelf` reads `.vend/menu.json` (corrupt/absent → `no-menu`), re-gathers fresh
   `demand`+`lisa`, and `isMenuStale` rehashes them under the **press's** `all` and
   compares to `cache.stateHash` (→ `stale` on any mismatch, incl. schema-version drift).
3. `parseSelection(selection, cache.actions.length)` validates ALL indices before any
   dispatch (→ `bad-selection` on `SelectionError`); `planRuns` resolves each to
   `actions[i-1]` (the index contract — no re-rank/re-filter) with `override ??
   action.budget`.
4. Sequential `runDecomposeEpic` per pick, in ascending order; it streams live and
   appends one run-log record per call. Result → `dispatched`.
5. `cli.ts` maps `PressResult` → stderr andon + exit code: `no-menu`/`stale`→1,
   `bad-selection`→2, `dispatched`→0 iff all picks succeed else 1.

## Acceptance criteria

- **AC#1** `parseSelection` against the persisted menu's length; materially-stale →
  warn "re-run vend" and stop — ✅ (`isMenuStale` rehash-compare; smoke #4).
- **AC#2** each pick → its playbook under the warranted budget (overridable), in order,
  each appended to the run log; multi-select sequential — ✅ (`planRuns` +
  `runDecomposeEpic` loop; the log append is structural in the runner).
- **AC#3** `--all` reveals hidden rows; out-of-range hard-errors **before** any dispatch
  — ✅ (parse precedes `planRuns`/dispatch; smoke #2 exit 2, no dispatch). `--all` is
  carried into the staleness hash so press-mode must match browse-mode.
- **AC#4** `check:test` / `check:typecheck` green; advances **P2**, **P7** — ✅ (229
  pass / 0 fail; tsc exit 0).

## Test coverage

11 pure-core tests: `epicPathFor` (flat + nested root); `isMenuStale` (fresh-match,
demand-change, lisa-change, mode-mismatch, all:true-match, version-drift); `planRuns`
(ordered id/path/budget resolution, override-supersedes-all, input non-mutation). Plus 7
`cli.ts` select-parse cases (single/multi-token join, `--all`, `--budget`,
unknown-command, malformed budget, missing-selection). The `isMenuStale` fixtures build
`cache.stateHash` from the real `stateHash(...)`, so they assert the *contract*, not a
brittle hex literal.

**Gaps (intentional, house pattern):** `pressShelf` and the `import.meta.main` select
arm are not unit-tested — they are thin I/O + process-level effects over tested pure
cores, verified by the live smoke (progress.md). No test exercises a real multi-pick
`runDecomposeEpic` dispatch (it spawns `claude` and materializes a board) — the seam is
the one proven live by T-002-04; here only resolution (which epic, which budget, which
order) is asserted, via `planRuns`.

## Open concerns / notes

1. **Full dispatch is not smoke-run end-to-end.** Smoke #6 confirms `E-002` resolves to
   `docs/active/epic/E-002.md` (exists) and the press *reaches* the runner, but a real
   `vend 1` launch would spawn an LLM session and materialize E-002's stories/tickets —
   inappropriate unattended. The dispatch seam itself is T-002-04-proven; the new code
   between parse and that seam is fully unit-tested. A human running `vend 1` against a
   live epic is the remaining real-world confirmation.
2. **Staleness errs toward re-running (by design).** `stateHash` folds the *raw*
   demand+lisa text, so any edit (even whitespace) flips it → "re-run vend". This is the
   conservative choice inherited from T-003-02 (concern #2): never act on a possibly-stale
   list. A press in a different `all` mode than the browse is likewise treated as stale
   (different numbering). Cost: an extra `lisa status` spawn + `demand.md` read per press.
3. **One play, one mapping.** Every pick dispatches `DecomposeEpic` with
   `epicPathFor(root, id)`. This is the documented scope (epic: "today: DecomposeEpic").
   The extension seam when a second play arrives: a play registry replacing the single
   `runDecomposeEpic` call in the `pressShelf` loop (and an `Action.play` field upstream).
4. **`--budget` is one override for the whole press.** `vend 1,2 --budget 2h,50k` applies
   to *both* picks (epic: "the default envelope for this pick"). Per-index budgets are
   not in the mini-language and out of scope.
5. **Run-all, not stop-on-first-failure.** A gate-fail/timeout on pick 1 does not abort
   picks 2-3; each is its own logged run, exit 0 iff all succeed. If a future workflow
   wants fail-fast, it is a one-line change in the `pressShelf` loop.
6. **`cli.ts` co-edit with T-003-02 resolved cleanly.** The `select` arm sits beside the
   `browse` arm; `parseArgs` was split into `parseRunArgs`/`parseSelectOrBrowse` (the old
   `argv.every(--all)` browse-all line is now subsumed by "no positional + `--all`"). All
   prior `run`/`browse`/`parseBudgetArg` tests still pass.

## Risk assessment

Low. New code is additive behind a new `select` command; `run`/`browse` untouched bar
the parse restructure (covered by existing + updated tests). The pure core is total and
fully fixtured; the impure shell is thin and smoke-verified for every non-dispatch path
(no-menu, stale, out-of-range, unknown-command) plus dispatch-target resolution. No
runtime dependency added, no committed state mutated (`.vend/menu.json` is gitignored).
The one unexercised path — a full live multi-pick LLM dispatch — reuses an already-proven
seam and is gated by fully-tested resolution logic.
