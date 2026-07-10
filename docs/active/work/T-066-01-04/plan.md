# T-066-01-04 — Plan

Docs-only ticket; one commit. Steps are small and each independently verifiable.

## Step 1 — Edit `docs/knowledge/rdspi-workflow.md`

1a. **Research-phase hook.** In the `### Research` phase body, prepend one sentence stating the
    read-your-parent-story rule (per structure.md Edit 1). Keep the existing "Map the codebase.
    Produce `research.md`…" framing intact after it.

1b. **New `## The Story Layer` section** between `## Phase Rules` and `## Ticket Format`,
    following the outline in structure.md Edit 2:
    - Job paragraph (contract between epic intent and ticket execution; stories live in
      `docs/active/stories/`; tickets carry the what, the story carries the why / done-for-the-
      slice / deliberately-out).
    - Five sections as a bulleted list with bolded prose labels **exactly** matching
      `materialize.ts` render output: Scope, Story acceptance, Honest boundary, Wave rationale
      (noted as sitting under the story's `## DAG` block), Out of this slice.
    - Readers: executing agents — especially cross-vendor cold workers arriving with `AGENTS.md`
      and injected context only; the sweep (checks Story acceptance at close); downstream
      allocation policy (routes/parallelizes using Scope, the DAG, Wave rationale).
    - Working rule, imperative: read the parent story before Research; return to it for
      mid-ticket scope questions.
    - Enforcement one-liner: a generated story missing any section is refused at the source,
      before a file is written.
    - Close with `---` to preserve separator rhythm.

**Verify (step-local):**
- Five labels present and byte-matching the render labels.
- Reader classes all named; rule stated in both places (Research phase + section).
- `grep -nE '\b[PN][0-9]+\b' docs/knowledge/rdspi-workflow.md` → no matches (no charter codes).
- No vend-internal machinery terms in the added text (`grep -inE 'castPlay|andon|BAML|\bgate\b'`
  over the diff — "refused" phrasing instead).
- Read the full doc once top-to-bottom for flow (the new section must not contradict Phase Rules
  or Concurrency).

## Step 2 — Repo gate

Run `bun run check` (the real gate per house discipline). Expectation: passes untouched — the
change is markdown-only and no test snapshots the doc's content (research.md §2). If the gate
fails, the failure is pre-existing (sibling T-066-01-02 has in-flight source edits in the shared
working tree); confirm by checking the failure's file paths, report in progress.md, and do NOT
attempt to fix sibling files.

## Step 3 — Commit

Stage **only** this ticket's paths:

```
git add docs/knowledge/rdspi-workflow.md docs/active/work/T-066-01-04/
```

Commit message (matches sibling convention, e.g. `3150c51`):

```
docs(workflow): story layer — contract, readers, read-before-research rule (T-066-01-04)
```

Include the RDSPI artifacts written so far (research → progress); review.md lands in a follow-up
commit after Review, or amend-free second commit — follow T-066-01-01's pattern of a separate
artifacts commit if cleaner. Simplest honest sequence: commit doc + artifacts-to-date in step 3,
then a second small commit for review.md in step 5.

**Verify:** `git status` shows sibling files (`src/gate/gates.ts`, `src/play/decompose-epic-core.ts`,
other tickets' work dirs) still uncommitted and untouched; `git show --stat HEAD` lists only this
ticket's files.

## Step 4 — progress.md

Write `docs/active/work/T-066-01-04/progress.md`: steps completed, verification results, any
deviation from this plan (expected: none).

## Step 5 — Review phase

Write `docs/active/work/T-066-01-04/review.md`: files changed, how each acceptance criterion is
met (quote the doc lines that satisfy "five sections named / readers named / rule stated / no
charter codes"), test-coverage note (no automated coverage — prose acceptance, with the grep
checks recorded), open concerns (e.g., lisa-side injection is assumed, not verified from this
repo; label coupling with `materialize.ts` is by convention, unenforced). Commit review.md.

## Testing strategy

- **No unit/integration tests** — the deliverable is documentation; the ticket's acceptance
  criterion is structural presence, not behavior. The named checks are the greps above plus
  `bun run check` as the regression gate.
- **Coupling risk logged, not tested:** if a future ticket renames a render label, this doc
  drifts silently. Flag in review.md as a known limitation (a doc-content assertion in the render
  test would be the fix, but that is source-code scope this ticket doesn't have).

## Acceptance criteria → step mapping

| Criterion | Step |
|---|---|
| Story-contract section exists in `rdspi-workflow.md` | 1b |
| Five sections named | 1b (labels check) |
| Readers named | 1b |
| Read-your-parent-story rule stated | 1a + 1b |
| No charter codes dereferenced | 1 verify (grep) |
