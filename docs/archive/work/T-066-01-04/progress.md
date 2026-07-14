# T-066-01-04 — Progress

## Completed

- **Step 1a — Research-phase hook.** `docs/knowledge/rdspi-workflow.md` `### Research` body now
  opens with the read-your-parent-story rule (one sentence, pointing at the `story:` frontmatter
  field and forward-referencing The Story Layer section).
- **Step 1b — `## The Story Layer` section.** Inserted between `## Phase Rules` and
  `## Ticket Format` with its own `---` separators, containing: the job paragraph (contract
  between epic intent and ticket execution; stories live in `docs/active/stories/`); the five
  sections as a bulleted list with bolded prose labels matching the `materialize.ts` render
  labels byte-for-byte (Scope, Story acceptance, Honest boundary, Wave rationale — noted as
  sitting under the story's `## DAG` block — Out of this slice); the three reader classes
  (executing agents with the cross-vendor cold-worker emphasis, the sweep, allocation policy);
  the working rule in bold imperative; and the enforcement one-liner ("refused at the source with
  a named error, before the story file is ever written").

## Verification results

- Charter codes: `grep -nE '\b[PN][0-9]+\b'` over the doc → **no matches** (clean).
- Labels: all five bolded labels present, matching `src/play/materialize.ts:172-174,226,228`.
- Machinery terms: `grep -inE 'castPlay|andon|BAML'` over the doc → **no matches** (the epic's
  "named andon" became plain "named error" per design).
- Full-doc read-through: section order now RDSPI Workflow → Phase Rules → The Story Layer →
  Ticket Format → Concurrency; no contradiction introduced; separator rhythm preserved.
- Repo gate: `bun run check` → **1533 pass, 1 skip, 0 fail** (104 files). Docs-only change,
  as predicted by research (no test snapshots the doc's content).

## Remaining

- Step 3: commit (doc + artifacts research→progress), staging only this ticket's paths.
- Step 5: Review phase — write review.md, commit it.

## Deviations from plan

None. Sibling in-flight files (`src/gate/gates.ts`, `src/play/decompose-epic-core.ts`, other
tickets' work dirs) left untouched and unstaged.
