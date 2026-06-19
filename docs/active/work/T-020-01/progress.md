# T-020-01 — Progress

Tracking the Implement phase against `plan.md`. Updated as steps complete.

## Done

- **Step 1 — thin expand fragment** ✅ `fixtures/thin-fragment.txt`: `"make the project better and
  tidy things up where it makes sense"` — a grammatical-but-vacuous imperative that grounds no demand
  and cites nothing (design D3; the sibling of T-019-02's `grounded-fragment.txt`).
- **Step 2 — thin survey board** ✅ `fixtures/thin-board/` — a complete/frozen tiny project (`mdwc`,
  a one-file word counter):
  - `docs/knowledge/charter.md` — thin charter, scope explicitly **complete & frozen**, no open
    problems, no `P#`/`N#` ids.
  - `docs/active/stories/S-900-01.md` + `docs/active/tickets/T-900-01.md` — both `status: done`
    (`9xx` id block, no collision with the live board). The board already fully captures the product
    ⇒ the honest read is "nothing new to stage."
- **Step 3 — harness extension** ✅ `src/probe/run-consistency-probe.ts`:
  - Added `THIN_BOARD_DIR` + `THIN_FRAGMENT_PATH` constants.
  - Parameterized `seedCharter(root, srcRoot=process.cwd())` and `seedBoardSnapshot(root,
    srcRoot=process.cwd())`; refactored `surveyTarget`'s inline board copy to call `seedBoardSnapshot`
    (behavior-preserving — same copy loop).
  - Added `surveyThinTarget()` (mirrors `surveyTarget`, seeds from `THIN_BOARD_DIR`; same
    `isAbstention` "no demand staged" marker).
  - Added `resolveTarget` cases `survey-thin` and `expand-thin` (the latter reuses `expandTarget` with
    the fixed thin fragment + an honest `"expand of thin fragment"` subject). Both input-less.
  - Appended `survey-thin`, `expand-thin` to `SUPPORTED`.
- **Step 4 — `bun run check`** ✅ **green**: baml:gen clean, `tsc --noEmit` clean, **586 tests pass /
  0 fail**. No regressions (the harness is not imported by any test). Unsupported-name guard still
  exits non-zero and lists the two new names.

## In progress

- **Step 5 — verifying probe run** (live casts, N=2, running concurrently):
  - `survey-thin` → `sweep-logs/survey-thin.log`
  - `expand-thin` → `sweep-logs/expand-thin.log`
  - Grounded baselines for the distinctness comparison (`survey`, `expand <grounded>`) pending after
    the controls land, or cited from T-019-02's already-measured grounded sweep.

## Deviations from plan

- None structural. `expand-thin` was implemented inline in `resolveTarget` (spreading `expandTarget`
  with a corrected `subject`) rather than as a standalone builder — same effect, less surface, and it
  keeps the "only the fragment varies vs grounded expand" invariant explicit. Noted per the RDSPI
  deviation rule.

## Notes for review

- Expand's honest-empty arrives as a `gate-failed` non-`success` (it STOPs), so the probe folds it
  into the `budget-exhausted` headline bucket; the **true** honest-empty is read off the **raw
  `RunOutcome` tally + the per-cast `gate 'honest-empty'` andon line** (design D5, the T-019-02 D4
  blind spot). Survey's honest-empty shows directly in the headline mix (it CLEARs + stages a marker).
