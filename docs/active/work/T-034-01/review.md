# T-034-01 — Review: history-audit-core

*Phase: Review. The handoff — what changed, test coverage, and open concerns, so a human reviewer
understands the work without reading every diff.*

## Summary

Shipped `src/ci/history-core.ts`, the **pure** decision + reporting core of E-034's post-hoc red-commit
audit — the backward-looking complement to E-033's forward pre-commit gate. It mirrors `head-build-core`
one level up: where that classifies a single build outcome, this aggregates many already-classified
per-commit verdicts into one audit verdict + report. Two total functions, zero imports, no I/O.

Committed atomically at **`0b85ad8`** through the live E-033 pre-commit gate (`precommit: ok — tests
green`). The ticket frontmatter was deliberately left unstaged — Lisa owns phase/status.

## Files

| File | Action | Lines | Notes |
|------|--------|-------|-------|
| `src/ci/history-core.ts` | created | ~115 (incl. headers) | `classifyHistory`, `boundRange`, `DEFAULT_HISTORY_MAX`, `summarySuffix` (private). |
| `src/ci/history-core.test.ts` | created | ~140 | 14 pure-function tests, 2 `describe` blocks. |
| `docs/active/work/T-034-01/{research,design,structure,plan,progress,review}.md` | created | — | RDSPI artifacts. |

Nothing else touched: no `package.json` script (the `check:history` script is T-034-02's), no edits to
sibling cores or `check-head.ts`.

## What it does

- **`classifyHistory(results: readonly CommitResult[]) → { anyRed, redCount, report }`** — three
  mutually-exclusive, exhaustive report shapes:
  - empty range → honest-empty line (`"no commits in range — nothing to audit"`), `anyRed:false` — never
    a misleading "all green";
  - all green → one-line tally;
  - some red → an `ANDON — R of T … are red:` header, one indented line per red commit naming
    `<sha> <subject>: <summary>` (E-008 "name the failure" style) **in input order**, then a tally footer.
  - `anyRed` is derived as `redCount > 0` — no parallel boolean to desync. Greens are never listed
    individually (the audit surfaces reds, mirroring `committed-core` emitting only offenders).
- **`boundRange(allShas, opts?) → { covered, droppedCount, note }`** — the no-silent-cap bounder. Returns
  a fresh prefix slice + a note that is **loud** (`covered N of M (bounded at K — widen with <hint>)`)
  iff commits are dropped, quiet-but-truthful otherwise. `DEFAULT_HISTORY_MAX = 100` is the R12
  single-source default. `max` is floored and clamped to ≥ 0; a negative/zero bound is handled as data.

## Acceptance criteria — all met

- ✅ **Pure `classifyHistory`** → `{ anyRed, redCount, report }`; names each red commit with its summary;
  tally; honest-empty for an empty range. No I/O. *(history-core.ts:69; tests: all-green, some-red,
  empty-range, summary-absent, multi-line, order.)*
- ✅ **Pure `boundRange`** → covered subset + loud `covered N of M (bounded at K)` note when dropping;
  no silent cap. *(history-core.ts:130; tests: under/over bound, widenHint, default, max 0, negative,
  empty, no-mutation.)*
- ✅ **Unit-tested** (`head-build-core.test.ts` precedent) — all four required cases + edges.
  `bun run check:*` green: **939 pass / 0 fail** across 61 files; `tsc --noEmit` clean.

## Test coverage

14 tests / 46 expect calls, pure-function style (no git/fs/process). `classifyHistory`: all-green tally
(+ asserts greens NOT listed), some-red (each red sha+subject+summary present, greens absent, footer),
summary-absent graceful (no `"undefined"`), multi-line summary collapse, empty-range honest-empty,
input-order preservation. `boundRange`: under-bound (no drop, `covered === allShas`, no "widen"),
over-bound (loud note, prefix), widenHint interpolation, default = `DEFAULT_HISTORY_MAX`, `max:0`,
negative clamp, empty input, no-mutation.

**Gaps (intentional, by DAG):** no integration test — the worktree sweep that *fills* `CommitResult`
rows and *resolves* the sha list is T-034-02; its integration proof (driving the real `git rev-list` +
worktree build) belongs there, exactly as `head-build-core.test.ts`'s integration half lives with the
impure `buildCommittedHead`. The pure core is fully covered.

## Open concerns / notes for the reviewer

- **Report wording is asserted by substring, not whole-string.** Tests check key fragments ("ANDON",
  "covered N of M", sha+subject+summary) so the exact phrasing stays flexible. If a downstream tool ever
  parses the report, it should key off `anyRed`/`redCount` (the machine-readable verdict), not the text.
- **`sha`/`subject` are rendered verbatim.** The core does not truncate a long subject or shorten a full
  sha — that's the sweep's formatting choice when it builds the rows. No injection risk (pure string
  concat into a CLI report), but a pathological newline in a `subject` would split a report line; the
  sweep should pass `git log --format=%s` (single line) as assumed.
- **`DEFAULT_HISTORY_MAX = 100`** is a first-cut default. T-034-02 will exercise it against real
  histories; if 100 proves too tight/loose for the intended audit range, it's a one-line edit here (R12).
- **`boundRange` always covers the *prefix*** (`slice(0, max)`). This assumes the caller passes shas in
  the order it wants prioritized (newest-first from `git rev-list`). If a future audit wants oldest-first
  or a windowed range, that's the caller's `rev-list` ordering, not a core change.

## Risk assessment

Low. New, isolated, pure module with zero imports and no dependents within this ticket; cannot affect
existing behavior. Full suite green, committed through the live commit-discipline gates. The only
consumer (T-034-02) is not yet written, so there is no integration surface to break.
