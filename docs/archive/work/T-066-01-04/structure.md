# T-066-01-04 — Structure

Docs-only change. One file modified, no files created or deleted in the product tree; work
artifacts accrue under `docs/active/work/T-066-01-04/` as usual.

## Files

| File | Change |
|---|---|
| `docs/knowledge/rdspi-workflow.md` | **Modified** — two edits: (1) one sentence appended to the `### Research` phase intro; (2) new `## The Story Layer` section inserted between `## Phase Rules` and `## Ticket Format`. |
| `docs/active/work/T-066-01-04/{research,design,structure,plan,progress,review}.md` | **Created** — RDSPI artifacts. |

No source files touched. Disjoint from sibling T-066-01-02's in-flight edits
(`src/gate/gates.ts`, `src/play/decompose-epic-core.ts`) — commits stage only the paths above.

## Resulting document outline

```
## RDSPI Workflow
  ### Research            ← edit 1: + read-parent-story sentence
  ### Design
  ### Structure
  ### Plan
  ### Implement
  ### Review
---
## Phase Rules             (unchanged)
---
## The Story Layer         ← edit 2: NEW section
---
## Ticket Format           (unchanged)
---
## Concurrency             (unchanged)
```

## Edit 1 — the Research phase hook

Location: `rdspi-workflow.md:7` — the `### Research` intro line currently reads
"Map the codebase. Produce `research.md` (~200 lines)."

Shape: prepend one imperative sentence to the paragraph below it (line 9), so the phase body
opens with the rule at its trigger point:

> First read the ticket's parent story — the `story:` field in the frontmatter names it, and it
> answers the "why" questions Research would otherwise re-derive.

Constraint: one sentence only; the layer definition lives in the new section, not here.

## Edit 2 — the new section

Insertion point: immediately after the Phase Rules block's closing rule 5 ("Artifacts are
insurance…") and its trailing `---` separator; before `## Ticket Format`. The new section ends
with its own `---` so the doc's separator rhythm is preserved.

Internal organization (mirrors Design §"Content of the new section"):

```
## The Story Layer

<job paragraph: contract between epic intent and ticket execution;
 where stories live; ticket = what, story = why/how-far/what's-out>

<five sections as a bulleted list, prose labels bolded:>
- **Scope** — …
- **Story acceptance** — …
- **Honest boundary** — …
- **Wave rationale** — … (noted as living under the story's ## DAG block)
- **Out of this slice** — …

<readers paragraph or short list: executing agents (cross-vendor cold emphasis),
 the sweep, allocation policy>

<working rule, imperative: read your ticket's parent story before Research;
 return to it mid-ticket for scope questions>

<enforcement one-liner: generated stories missing any section are refused at
 the source, before a file is written>
```

## Interfaces & invariants

- **Prose labels are the interface.** The five bolded labels in the bulleted list MUST match the
  rendered-story labels in `src/play/materialize.ts:172-174,226,228` exactly: `Scope`,
  `Story acceptance`, `Honest boundary`, `Wave rationale`, `Out of this slice`. A worker greps the
  story file for what the doc names; a label drift here recreates the dangling-reference problem
  this ticket fixes.
- **No charter codes** anywhere in the added text (verify: `grep -nE '\b[PN][0-9]+\b' docs/knowledge/rdspi-workflow.md` → no matches).
- **No vend-internal machinery names** in the new section (no `castPlay`/gate/andon/BAML); "Lisa"
  is fine — the doc already names it.
- **Heading level:** `##` (peer of the four existing top-levels); no `###` subsections inside —
  at ~35 lines it doesn't need them, and the existing sections of similar size (Ticket Format)
  use field lists, not subheads.
- **Voice:** second-person imperative for rules, declarative for definitions — matching the doc.

## Ordering of changes

Single commit: both edits to `rdspi-workflow.md` land together (the Research hook references the
layer the new section defines; splitting them would leave a dangling mention). Work artifacts
committed with it, per repo convention for sibling tickets (T-066-01-01's artifacts commit).
