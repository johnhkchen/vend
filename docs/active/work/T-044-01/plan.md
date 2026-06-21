# T-044-01 — Plan: concrete-demand-ranker-recalibration

Ordered, independently-verifiable steps. Each is small enough to commit atomically.

## Testing strategy

- **No live model anywhere.** The proof is two offline layers (Design §"deterministic proof"):
  `baml:gen` green + render-based contract assertions.
- **Contract assertions** ride the existing render bridge op (`{ mode: "render" }`) in
  `steer.test.ts` / `survey.test.ts`; they assert the rendered prompt contains the steering phrases.
  No new harness, no `RESULTS`/`runBridge` change.
- **Regression safety:** the SAP/parse pins and every other suite must stay green — the edit is prompt
  text only, so nothing else should move. `bun run check` is the gate.
- **Live confirmation is deferred** (named in review.md, not run here) — the E-038→E-039 shape.

## Steps

### Step 1 — Recalibrate `baml_src/steer.baml`
Add the CONCRETE-DEMAND lead bullet to the `## The board — author it by these rules` section, as the
first bullet before `- ONE signal per real demand …` (Structure Edit 1). Wording per Design.
- **Verify:** `bun run baml:gen` exits 0; `git diff baml_src/steer.baml` shows only the inserted
  bullet; no `class`/`function`/`client` line changed.

### Step 2 — Recalibrate `baml_src/survey.baml`
Add the **byte-identical** bullet to `## Otherwise, author the board by these rules`, first bullet
before `- ONE signal per real demand …` (Structure Edit 2).
- **Verify:** `bun run baml:gen` still 0; the bullet text matches Step 1 verbatim (consistency).

### Step 3 — Regenerate the client
`bun run baml:gen`.
- **Verify:** exits 0; `git status` shows any regenerated `baml_client/*` are consistent (prompt-text
  edits typically leave the generated client byte-identical — if so, no client churn, which is the
  expected outcome since no types changed).

### Step 4 — Contract assertion in `src/baml/steer.test.ts`
Add the T-044-01 test to the render `describe` (Structure Edit 3): assert the rendered prompt contains
`"concrete product demand"` and `"self-referential"`.
- **Verify:** `bun test src/baml/steer.test.ts` green (render op index 3 already in `RESULTS`).

### Step 5 — Contract assertion in `src/baml/survey.test.ts`
Add the parallel test to survey's render `describe` (Structure Edit 4).
- **Verify:** `bun test src/baml/survey.test.ts` green.

### Step 6 — Full check + regression sweep
`bun run check` (= `baml:gen && check:typecheck && check:test`).
- **Verify:** all green; no pre-existing suite regressed (the SAP/parse pins, steer-core, survey-core,
  effects, etc.). Confirm `ClaudeStub` and all other BAML functions unchanged (`git diff baml_src/`
  shows only the two prompt bullets).

### Step 7 — Review artifact + deferred-confirmation note
Write `review.md`: changed files, test coverage, AC checklist, and the **named-deferred** live
confirmation (next `vend steer`/sweep stages a concrete #1, not "run the sweep").

## AC → step mapping

| Acceptance criterion | Covered by |
|----------------------|-----------|
| `steer.baml` + `survey.baml` recalibrated (concrete demand; meta-tasks demoted/excluded; steering not schema) | Steps 1, 2 |
| `baml:gen` green; `ClaudeStub` + other functions unchanged | Steps 1–3, 6 |
| Deterministic contract assertion both prompts carry the steering (no live model) | Steps 4, 5 |
| No keyword gate; structural gates unchanged; live confirmation named as deferred | Design (no gate added); Step 7 (deferred note) |
| `bun run check:*` green | Step 6 |

## Commit strategy

Atomic, all in one logical change (prompt + its contract test are coupled — the test asserts the
prompt). Single commit after Step 6 is green: the two `.baml` edits + the two test edits (+ any
`baml_client` regen if it churns). Implementation progress tracked in `progress.md`. Per the harness,
do not edit the ticket frontmatter — Lisa advances phases from artifacts.

## Rollback / risk

- If `baml:gen` fails after Step 1/2, the bullet has malformed BAML template syntax (e.g. an unescaped
  quote inside `#" … "#`) — fix the wording (avoid `"` chars that break the block; use plain quotes
  only where the existing prompt already does, as in `"run the sweep"` which mirrors existing quoted
  phrases in the prompts).
- If a render test fails on whitespace, the asserted phrase spans a line break — keep each asserted
  phrase (`concrete product demand`, `self-referential`) within a single source line in the bullet.
