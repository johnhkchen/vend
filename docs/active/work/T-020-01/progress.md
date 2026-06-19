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

## Done (cont.)

- **Step 5 — verifying probe run** ✅ (live casts, N=2 each). **AC#1 met: honest-empty recorded for
  BOTH plays, distinct from grounded.**
  - **survey-thin** (`sweep-logs/survey-thin.log`):
    ```
    survey 1/2: budget-exhausted → budget-exhausted   (spent 635766/300000)
    survey 2/2: success → honest-empty                (staged "# Survey — no demand staged" marker)
    mix: signal 0 · honest-empty 1 · budget-exhausted 1 (honest-empty rate 50%)
    ```
    Records **`honest-empty`** in the headline mix (survey CLEARs the empty board + stages the
    marker). Distinct from grounded `survey`, which stages a real demand board (T-019-02).
  - **expand-thin** (`sweep-logs/expand-thin.log`, off-topic non-sequitur fragment):
    ```
    expand-fragment 1/2: budget-exhausted → budget-exhausted   (spent 335083/250000)
    expand-fragment 2/2: gate-failed → budget-exhausted        (andon: gate 'honest-empty' —
                          "the fragment grounds no demand … (IA-4)", 1 turn)
    raw run-log outcomes: budget-exhausted 1 · gate-failed 1
    ```
    Records **`honest-empty`** read off the **raw `gate-failed` tally + the andon line** (design D5 —
    expand STOPs, so the headline mix folds it into `budget-exhausted`; the true honest-empty is the
    `gate-failed`). Distinct from grounded `expand`, which lands `signal` (T-019-02).

## Deviations from plan

- None structural. `expand-thin` was implemented inline in `resolveTarget` (spreading `expandTarget`
  with a corrected `subject`) rather than as a standalone builder — same effect, less surface, and it
  keeps the "only the fragment varies vs grounded expand" invariant explicit. Noted per the RDSPI
  deviation rule.
- **Fixture iteration (the one real deviation):** the first thin fragment (`"make the project better
  …"`) was on-topic-but-vague — the model treated it as real demand and **wandered to budget
  exhaustion (340k)** instead of abstaining (0/2 honest-empty). Replaced it with an **off-topic
  non-sequitur** (`"Remember to water the office plants …"`) that maps to **no demand against this
  project** — the literal honest-empty trigger in `baml_src/expand.baml:68-72`. The model then
  abstained in 1 turn (`gate 'honest-empty'`). Lesson: the thin-expand negative control must be
  *off-topic*, not merely *vague* — a vague on-topic fragment invites a wander, not an abstention.
- **Honest wrinkle (a finding, not a fixture failure):** each play still had **one budget-exhausted
  cast** alongside the honest-empty one — the gate does not abstain on *every* cast even on truly-thin
  input; sometimes the model wanders past budget before the reply reaches the gate. This is the SAME
  run-to-run inconsistency T-019-02 measured (over-eagerness manifests as either abstention OR a
  wander); the negative control now makes the *abstention* polarity measurable, which is the ticket's
  ask. Recorded honestly (IA-8), not hidden.

## Notes for review

- Expand's honest-empty arrives as a `gate-failed` non-`success` (it STOPs), so the probe folds it
  into the `budget-exhausted` headline bucket; the **true** honest-empty is read off the **raw
  `RunOutcome` tally + the per-cast `gate 'honest-empty'` andon line** (design D5, the T-019-02 D4
  blind spot). Survey's honest-empty shows directly in the headline mix (it CLEARs + stages a marker).
