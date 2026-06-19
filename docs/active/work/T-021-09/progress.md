# T-021-09 — Progress: rubric-scorecard-probe

## Status: implementation complete, full gate green, committed.

## Steps (per plan.md)

- [x] **Step 1 — pure core `src/probe/rubric.ts`.** `RUBRIC_DIMENSIONS` as-const +
  `RubricDimension`; `DimensionScore`/`Scorecard` types; `DENSITY_CHAR_BUDGET`; leaf helpers
  (`allCards`, `ratio`); five pure `score*` functions; `scoreDesignerRubric` (the public entry,
  dimensions in `RUBRIC_DIMENSIONS` order); `formatScorecard`. Language gate reuses
  translate.ts's `faceJargon` (design D3). Typecheck clean.
- [x] **Step 2 — pure tests `src/probe/rubric.test.ts`.** 11 cases over `buildGraph` fixtures:
  happy-path good-enough pass; the AC's mechanical-language teeth (charter code + file cite
  planted on a face → language fails + whole scorecard fails; a clean planted face passes);
  comprehension/density/structure/navigability failure branches; IA-4 vacuous pass (score 1,
  never NaN); P5 determinism; formatter shape. `11 pass / 0 fail`.
- [x] **Step 3 — impure harness `src/probe/run-rubric-probe.ts`.** Load → project → render →
  score → print, read-only, optional `[root]`. NOT unit-tested (house rule). Smoke run on the
  live board (61 tickets): **good enough: yes**, all five dimensions 100%. `authority-guard`
  live-source scan still green (7 pass) — the new probe introduces no write-against-`docs/active`.
- [x] **Step 4 — full gate + commit.** `bun run check` green: baml:gen ok · typecheck clean ·
  `731 pass / 0 fail`. Committed.

## AC verification

> A probe (patterned on src/probe/run-consistency-probe.ts) scores the designer render across
> the five rubric dimensions and emits a per-dimension scorecard; the language dimension
> mechanically fails on any untranslated-jargon token on a face.

- **Patterned on `run-consistency-probe.ts`** — same pure-core ↔ impure-harness split; the
  harness header carries the identical NOT-unit-tested house-rule note. ✓
- **Scores the designer render across the five dimensions** — `scoreDesignerRubric(render,
  projection)` over `renderPaper`/`projectGraph` under `DESIGNER_PRESET`; dimensions are
  comprehension, structure, density, language, navigability, always all five in order. ✓
- **Emits a per-dimension scorecard** — `Scorecard.dimensions` (each a `DimensionScore` with
  score/pass/detail/failures) + `formatScorecard`; live smoke prints the five-line card. ✓
- **Language fails on any untranslated-jargon token on a face** — `scoreLanguage` folds
  `faceJargon` across every card; tested twice (charter code, file cite) plus the clean
  counter-case. ✓

## Deviations from plan

- **None of substance.** The `DENSITY_CHAR_BUDGET.low = 240` starting figure (flagged as
  tune-on-implement in structure.md / plan.md) held: the live designer faces (61 tickets) all
  sit within it, so no re-tuning was needed.
- Minor: `structure`/`navigability` scores are a 0.5/0.5 split of their two sub-checks (tree +
  labels; headings + links) rather than a bare boolean, so the headline number degrades
  gracefully while `pass` stays the hard AND — within the design D4 "score is a graceful 0..1"
  intent, recorded for completeness.
