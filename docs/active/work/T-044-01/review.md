# T-044-01 — Review: concrete-demand-ranker-recalibration

Handoff document. What changed, test coverage, open concerns, and the named-deferred live
confirmation. A reviewer should be able to assent without reading every diff.

## Summary

Recalibrated both demand rankers so a board signal must be **concrete product demand** (a buildable
feature/change to Vend that decomposes into an epic) and **self-referential / operational meta-tasks**
(run Vend on itself, "run the sweep", settle a prior run, dogfood the loop) are demoted beneath
concrete demand or excluded. This is a **prompt recalibration, not a gate** — the E-020 honest-empty
precedent. The defect (both E-037 and E-039 sweeps ranked a self-referential meta-task #1) is
semantic; the structural gates pass it (it is grounded, keystone-ranked, well-ordered), so the only
correct fix lives in the ranker prompt.

## Files changed (4 modified, 0 created, 0 deleted)

| File | Change |
|------|--------|
| `baml_src/steer.baml` | New `CONCRETE DEMAND ONLY` lead bullet in `## The board — author it by these rules` (before `ONE signal per real demand`). Prompt text only. |
| `baml_src/survey.baml` | Byte-identical bullet in `## Otherwise, author the board by these rules`. Keeps the two rankers consistent (ticket step 2). |
| `src/baml/steer.test.ts` | New render-contract test: rendered prompt `toContain` `concrete product demand` + `self-referential`. |
| `src/baml/survey.test.ts` | Same render-contract test for the survey ranker. |

No change to `baml_client/` (prompt-text edit ⇒ generated client byte-identical), `src/play/steer-core.ts`
(structural gates), the bridges, `ClaudeStub`, or any `class`/`function`/`client` declaration.

## Acceptance criteria

- [x] **`steer.baml` and `survey.baml` recalibrated** — concrete product demand (decomposes into an
      epic); self-referential / operational meta-tasks demoted beneath it or excluded. Phrased as a
      steering bullet, not a schema change.
- [x] **`baml:gen` green; `ClaudeStub` + other functions unchanged** — `bun run baml:gen` exit 0, no
      client churn; `git diff baml_src/` shows only the two prompt bullets.
- [x] **Deterministic contract assertion** that both prompts carry the steering — render-based, no live
      model. 2 new tests, both green.
- [x] **No keyword gate added; structural gates unchanged** — `steer-core.ts` untouched. The judgment
      stays semantic (in the prompt), avoiding the false-positives a pattern gate would hit on
      legitimate Vend-feature demand.
- [x] **`bun run check:*` green** — `bun run check` = baml:gen + typecheck + test: **1087 pass, 0
      fail**, tsc clean.

## Test coverage

- **New (2):** `src/baml/{steer,survey}.test.ts` render-contract assertions — prove the recalibrated
  steering reaches the *rendered* prompt (stronger than asserting on raw source: a templating bug
  would still be caught). They reuse the existing render bridge op (index 3 of `RESULTS`); no new
  harness, no fixture change.
- **Regression:** full suite green (1085 prior pins, incl. the SAP-degrade / parse pins, steer-core
  gates, survey-core, effects). The edit changes no behavior path, so nothing else moved.
- **Coverage gap (intended):** there is **no deterministic test that the model actually demotes a
  meta-task** — that requires a live cast and cannot be pinned offline. Covered by the deferred
  confirmation below, exactly as E-020 paired its prompt change with a live probe.

## Open concerns / risk

- **Two-file consistency drift:** the bullet is duplicated verbatim across the two prompts. If one
  copy is later edited and the other isn't, that file's render-contract test goes red — so drift is
  caught, but the duplication is a maintenance cost inherent to BAML prompt modules (the same prompts
  already duplicate the entire board-rules list; this follows house style).
- **Substring contract is coarse:** the tests assert two phrases are present, not that the *full*
  semantics are intact. This matches the existing render pins (`"project STEERER"`, `"demand-surveyor"`)
  — a presence contract, not a semantic oracle. Adequate for "the steering is in the prompt".
- **No commit made / no frontmatter edit** — per the harness contract, Lisa detects these artifacts
  and advances the phase; the change is staged in the working tree for Lisa's commit.

## Live confirmation — NAMED AS DEFERRED (not claimed)

Per AC#4 and the E-038→E-039 shape: the real proof is the **next `vend steer` / live sweep** staging a
board whose **#1 is concrete product demand, not "run the sweep"** (and no degenerate meta-epic
minted on an unattended P4 run). That needs a live model cast and is **not** produced here. This
ticket delivers the deterministic half (prompt + contract + green checks); the live half is deferred
to the next cast, to be reconciled in its sweep-log — not asserted in this review.

## Bottom line

Minimal, surgical, reversible: 4 files, prompt text + 2 tests, all checks green, structural gates and
client surface untouched. Ready for human assent; live confirmation tracked as the next-cast follow-up.
