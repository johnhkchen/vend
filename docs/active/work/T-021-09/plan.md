# T-021-09 — Plan: rubric-scorecard-probe

Ordered, independently-verifiable steps. Testing strategy follows the house split: the pure
core (`rubric.ts`) is unit-tested; the impure harness (`run-rubric-probe.ts`) is proven by a
live smoke run, not unit tests.

## Step 1 — Pure core `src/probe/rubric.ts`

Write the full pure module per structure.md: header comment, `RUBRIC_DIMENSIONS` as-const +
`RubricDimension`, `DimensionScore`/`Scorecard` types, `DENSITY_CHAR_BUDGET`, the leaf helpers
(`allCards`, `ratio`), the five `score*` functions, `scoreDesignerRubric`, `formatScorecard`.
Import `faceJargon`/`faceText` (value, pure) + `Projection`/`ProjectedCard`/`Card` (types).

- **Verify:** `tsc --noEmit` clean (`bun run check:typecheck`). No fs/clock/network import.

## Step 2 — Pure tests `src/probe/rubric.test.ts`

Write the eight cases from structure.md, reusing the `paper.test.ts` fixture builders. The
AC-teeth case (2) constructs a `Projection` literal with a `Card` whose face carries a raw
jargon token (bypassing `scrubFace`) and asserts `language.pass === false` + overall fail.
The IA-4 case (7) asserts vacuous passes with score 1 (never NaN).

- **Verify:** `bun test src/probe/rubric.test.ts` green. Then full `bun test` green (no
  regression — the probe is additive).

## Step 3 — Impure harness `src/probe/run-rubric-probe.ts`

Write the CLI harness per structure.md: load the live board (optional `[root]`), project +
render under `DESIGNER_PRESET`, score, print `formatScorecard`. Read-only; `docs/active` in
the header comment only; import `loadWorkGraph` (no fs writer).

- **Verify:**
  - `bun run src/probe/run-rubric-probe.ts` runs against the live board and prints a five-line
    scorecard + headline. Inspect: language should be a clean pass (the renderer scrubs);
    tune `DENSITY_CHAR_BUDGET.low` only if a legitimately terse live face over-fires.
  - `bun test src/present/authority-guard.test.ts` green (the live-source scan still passes —
    the new probe files introduce no write-against-`docs/active`).

## Step 4 — Full gate + commit

- **Verify:** `bun run check` green (baml:gen + typecheck + full test suite).
- Stage and commit the three new files (and this ticket's artifacts) so the D-005
  `check:committed` gate is clear:
  `feat(probe): 'good enough' rubric scorecard probe over the designer render (T-021-09)`.
  Body notes: pure core + impure harness split; language gate reuses `faceJargon`.

## Testing strategy summary

- **Unit (pure):** `rubric.test.ts` covers all five dimensions, the AC mechanical-language
  teeth, IA-4 vacuous passes, NaN-safety, and P5 determinism — over `buildGraph` fixtures, no
  fs. This is the AC's contract.
- **Live smoke (not unit):** the harness against the real board, the run-probe.ts precedent —
  proves the impure verbs (`loadWorkGraph`, render composition) end to end.
- **Regression:** full `bun test` stays green; `authority-guard` confirms one-way authority.

## Rollback

All three files are new and additive; no existing file is edited. Rollback = delete the three
files. No migration, no data change.

## Deviations protocol

Record any deviation (e.g. a re-tuned density budget, an added dimension nuance) in
`progress.md` with rationale before proceeding, per RDSPI.
