# T-066-01-04 — Review

## What changed

One product file modified, zero source code touched:

- `docs/knowledge/rdspi-workflow.md` (+26 lines, commit `d3ea9e7`):
  1. **`### Research` phase** gained an opening sentence: read the ticket's parent story first —
     the `story:` frontmatter field names it — with a forward reference to the new section.
  2. **New `## The Story Layer` section** between `## Phase Rules` and `## Ticket Format`,
     containing the story's job (the contract between epic intent and ticket execution; where
     stories live), the five contract sections, the three reader classes, the working rule, and
     an enforcement note.

Work artifacts created under `docs/active/work/T-066-01-04/` (research, design, structure, plan,
progress, this review). Doc + artifacts committed as `d3ea9e7`; review.md follows in its own
commit.

## Acceptance criteria — how each is met

Ticket criterion: *"`rdspi-workflow.md` gains the story-contract section: five sections named,
readers named, read-your-parent-story rule stated; the section dereferences no charter codes."*

- **Five sections named** — bulleted list with bolded prose labels, each with a one-line meaning:
  **Scope**, **Story acceptance**, **Honest boundary**, **Wave rationale** (explicitly noted as
  sitting under the story's `## DAG` block), **Out of this slice**. Labels are byte-identical to
  the rendered-story labels in `src/play/materialize.ts:172-174,226,228`, so what the doc names
  is what a worker finds when they open the story file.
- **Readers named** — three classes: *executing agents* (with the cross-vendor cold-worker
  emphasis the ticket demands — "a cross-vendor agent whose entire context is `AGENTS.md` plus
  this injected document… the parent story is the whole brief"); *the sweep* (checks Story
  acceptance at close); *allocation policy* (the story as unit of allocation, reading Scope, the
  DAG, and Wave rationale).
- **Read-your-parent-story rule stated** — twice by design: bold-imperative in the section
  ("read your ticket's parent story before starting the Research phase," plus the return-to-it
  guidance for mid-ticket scope questions) and at its trigger point in the `### Research` phase
  body. Since lisa injects this doc into every agent's context, the rule now reaches every
  worker.
- **No charter codes** — `grep -nE '\b[PN][0-9]+\b'` over the whole doc: no matches. The section
  also avoids vend-internal machinery vocabulary (`castPlay`/andon/BAML verified absent); the
  epic's "named andon" is rendered as plain "named error."

## Test coverage

No automated tests added — the deliverable is documentation and the acceptance criterion is
structural presence in prose. Verification performed and recorded in progress.md:

- The two charter-code / machinery greps (clean) and the five-label presence grep (all present).
- `bun run check` (the repo's real gate: typecheck + lint + full suite): **1533 pass, 1 skip,
  0 fail** across 104 files — confirming the research finding that no test snapshots this doc's
  content (only `guide-core.test.ts:23` asserts the doc's *path* appears in `vend user-guide`).

## Open concerns / known limitations

1. **Label coupling is by convention, unenforced.** The doc's five bolded labels must track the
   render labels in `materialize.ts` (`PRE_DAG_SECTIONS` + the Wave rationale / Out of this slice
   lines). A future rename in the render would silently strand the doc. A cheap future guard: the
   render/golden test could assert the doc contains the five labels, the same way the render test
   pins `STORY_CONTRACT_EXEMPLAR` — source-code scope this docs ticket did not have.
2. **Lisa-side injection is assumed, not verified here.** The mechanism that makes this section
   reach workers ("lisa injects this doc into every agent's context") is stated by CLAUDE.md and
   the ticket; nothing in the vend repo exercises it. If lisa ever injects a truncated or
   sectioned version, the story-layer section's reach should be re-confirmed.
3. **The enforcement one-liner slightly leads the gate ticket.** The section says an incomplete
   generated story "is refused at the source… before the story file is ever written." The gate
   (T-066-01-02) exists in the working tree (`gates.ts` `storyCompletenessGate`, wired at
   `gates.ts:329`) but that sibling was still mid-flight at commit time. If T-066-01-02 were
   somehow abandoned, this sentence would overstate; given the story's wave plan, the risk is
   nominal.
4. **Sweep is named ahead of its tooling.** "The sweep" is named as a reader per the ticket's
   explicit instruction; its automation lives outside this repo today. The doc describes the
   contract's intended readership, which is the point of the section (a contract nobody reads is
   not a contract), but a reader looking for a `vend sweep` verb won't find one yet.

## Handoff notes

- Commit `d3ea9e7` contains the doc change + research→progress artifacts; review.md follows in a
  separate commit. Only this ticket's paths were staged — sibling T-066-01-02's in-flight source
  edits were left untouched in the shared working tree.
- Ticket frontmatter (phase/status) deliberately not modified — Lisa owns transitions.
- Nothing deferred to a follow-up beyond the four concerns above; the story's remaining open work
  (the gate's cast-level test, the epic's live gold-master cast) belongs to its siblings and the
  epic, not this ticket.
