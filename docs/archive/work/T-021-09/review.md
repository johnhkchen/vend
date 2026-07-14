# T-021-09 — Review: rubric-scorecard-probe

Handoff doc. What changed, test coverage, open concerns. The work: a 'good enough' rubric
scorecard probe over the rendered designer preset, patterned on the consistency-probe harness.

## What changed (all additive; no existing file edited)

| File | Lines | Role |
|---|---|---|
| `src/probe/rubric.ts` | ~190 | **PURE core.** `RUBRIC_DIMENSIONS` (as-const) + `RubricDimension`; `DimensionScore`/`Scorecard` types; `DENSITY_CHAR_BUDGET`; five pure `score*` fns; `scoreDesignerRubric(render, projection)`; `formatScorecard`. The only unit-tested half. |
| `src/probe/rubric.test.ts` | ~140 | **Pure tests.** 11 cases over `buildGraph` fixtures. |
| `src/probe/run-rubric-probe.ts` | ~50 | **IMPURE harness.** Load → project → render → score → print. Read-only, NOT unit-tested (house rule). |

Committed as `31938a7`. The ticket frontmatter is left untouched (Lisa drives phase/status).

## How it satisfies the AC

> A probe (patterned on src/probe/run-consistency-probe.ts) scores the designer render across
> the five rubric dimensions and emits a per-dimension scorecard; the language dimension
> mechanically fails on any untranslated-jargon token on a face.

- **Pattern match** — identical pure-core ↔ impure-harness split; the harness header carries the
  same "NOT unit-tested (house rule)" note as `run-consistency-probe.ts`/`run-probe.ts`.
- **Five dimensions, scored over the designer render** — comprehension, structure, density,
  language, navigability, always all five in `RUBRIC_DIMENSIONS` order, over the
  `renderPaper`/`projectGraph` output under `DESIGNER_PRESET`.
- **Per-dimension scorecard** — `Scorecard.dimensions` (score/pass/detail/failures each) +
  `formatScorecard`. Live smoke (61 tickets) → `good enough: yes`, all five at 100%.
- **Language gate** — `scoreLanguage` folds translate.ts's `faceJargon` across every card; it
  fails on any face-jargon token. The key reuse decision (design D3): one source of "what is
  jargon", shared with `scrubFace`, so the read and write sides cannot drift.

## Test coverage

- **`rubric.test.ts`: 11 pass / 0 fail.**
  - Happy path: clean designer render → all five present + in order, `pass === true`.
  - **AC teeth (×3):** a charter code (`PE-1`) and a file cite (`survey-core.ts`) planted on a
    face → `language.pass === false`, token in `failures`, whole scorecard fails; a clean
    planted face passes. Planting is done by hand-building a `Projection` (a real render is
    scrubbed and can never leak — the probe is the independent verifier).
  - One failure branch each for comprehension (missing state), density (over-budget face),
    structure (no tree in render), navigability (missing heading).
  - IA-4 vacuous pass: empty board → every dimension passes, score exactly 1, never NaN.
  - P5 determinism + formatter shape.
- **Regression:** full `bun run check` green — baml:gen ok · `tsc --noEmit` clean ·
  `731 pass / 0 fail` across 50 files.
- **One-way authority:** `authority-guard.test.ts` (7 pass) still green — the new probe imports
  only the read-only `loadWorkGraph` and references `docs/active` only in a header comment.
- **D-005:** `check:committed: ok — all source committed`.

### Coverage gaps (acknowledged, by design)

- `run-rubric-probe.ts` has no unit test — the house rule (its impure verbs are proven by the
  live smoke run; the judgment is the tested pure core). Same stance as the two sibling
  harnesses.
- The four non-language dimensions are **mechanical proxies**, not ground truth. Comprehension
  ≈ "has a plain title + state"; density ≈ "face char volume within the knob's budget";
  structure/navigability ≈ "the artifact carries its tree + headings, links resolve". They
  catch the failure modes calibration is meant to prevent; they are not a substitute for human
  judgment of "is this actually good." Language is the one hard, exact gate.

## Open concerns / follow-ups (none blocking)

1. **Density budget is a tuned constant** (`low: 240`, `medium: 480`, `full: ∞`). It holds for
   today's live board; a future board with legitimately longer terse faces could need widening
   — a one-line edit, and `failures` names the offending card + char count so the signal is
   legible.
2. **The probe is a reporter, not a CI gate** (design D7): it prints and exits 0 regardless of
   verdict, the run-probe.ts instrument stance. Wiring `good enough: no` into `check:*` (a
   non-zero exit) is a deliberate later ticket, not this one.
3. **Heading/tree string-matching** couples structure/navigability to paper.ts's stable
   substrings (`Designer view`, `Card faces`, `Founder/director view`, the ```mermaid` fence) —
   the same substrings paper.test.ts asserts, so they move together; still, a paper.ts heading
   rename would need a matching probe update.

## Critical issues needing human attention

None. Additive, fully green, one-way authority preserved, AC met with its mechanical-language
teeth tested.
