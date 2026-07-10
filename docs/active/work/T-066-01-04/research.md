# T-066-01-04 — Research

**Ticket:** workflow-doc-story-contract — add a story-layer section to `docs/knowledge/rdspi-workflow.md`
naming the story's job (contract between epic intent and ticket execution), its five sections, its
readers, and the read-your-parent-story rule. Docs-only; no source code changes.

## 1. The target document as it exists

`docs/knowledge/rdspi-workflow.md` (112 lines) has four top-level sections in order:

1. `## RDSPI Workflow` — the six phases (Research → Design → Structure → Plan → Implement → Review),
   one artifact each, all under `docs/active/work/{ticket-id}/`.
2. `## Phase Rules` — five numbered rules (all phases always run, ~200 lines, Lisa advances the
   `phase` field, high-leverage phases, artifacts are insurance).
3. `## Ticket Format` — the ticket frontmatter schema. **This is the only place stories appear
   today**, and only as one field line: `story: Parent story ID`. Nothing tells any reader that a
   story *body* exists, carries content, or should be read.
4. `## Concurrency` — Lisa's DAG scheduling, threads, commit file-locking.

The doc is written in second-person-imperative voice aimed at the executing agent ("Map the
codebase. Produce `research.md`…"). Sections are separated by `---` horizontal rules. The rot the
epic diagnoses is directly visible here: the workflow definition gives the story layer no job, so
nothing in the loop reads a story body, so the machine-emitted body degraded to a one-line shell.

## 2. How the doc reaches its readers (the injection mechanism)

- Vend's own `CLAUDE.md` states: "The RDSPI workflow definition is in
  `docs/knowledge/rdspi-workflow.md` and is injected into agent context by lisa automatically."
  Lisa (the ticket-execution engine, a separate tool) injects this doc into **every** worker
  session's context. That injection is why this ticket exists: a section added here is the one
  channel guaranteed to reach every executing agent, including cross-vendor cold workers that
  arrive with only `AGENTS.md` and whatever lisa injects — no accumulated repo context.
- `src/guide/guide-core.ts:20` mentions the doc's path in `vend user-guide` output ("lisa's
  per-ticket build loop"); `guide-core.test.ts:23` asserts only that the **path string** appears.
  No test anywhere snapshots the doc's *content* — `grep -rn "rdspi-workflow" src/` returns only
  the guide path mention. The doc can be edited freely without breaking `bun test`.

## 3. The story contract this section must describe (settled by the siblings)

T-066-01-01 (done) fixed the shape; -02 (gate) and -03 (done, materializer) consume it. The
canonical five-field list lives in `src/gate/gates.ts:200` as `STORY_CONTRACT_FIELDS`
(schema field names): `scope`, `storyAcceptance`, `honestBoundary`, `waveRationale`, `outOfSlice`.

The **rendered story file** (what a worker actually reads) is produced by
`renderStoryFile` in `src/play/materialize.ts:204`:

- Frontmatter: `id, title, type: story, status, priority, tickets` (unchanged by the epic).
- Body, in order (`materialize.ts:171-231`):
  - `**Scope:** …`
  - `**Story acceptance:** …`
  - `**Honest boundary:** …`
  - `## DAG` — fenced block, one line per ticket in execution order with `← deps` edges
    (a projection of the tickets' `depends_on` fields), then `Wave rationale: …` beneath it.
  - `**Out of this slice:** …`
  - Provenance footer: `_Materialized by Vend's \`decompose-epic\` play — N ticket(s), DATE._`
- So the five sections' **prose labels** are: Scope, Story acceptance, Honest boundary,
  Wave rationale, Out of this slice. The hand-authored `docs/active/stories/S-066-01.md` is the
  named look-and-feel exemplar (it uses exactly these labels, with `## DAG` housing the wave
  rationale). The workflow-doc section should use the prose labels, not the camelCase schema names —
  workers read files, not schemas.

## 4. What each section means (source: S-066-01, E-066, the exemplar constant)

From `STORY_CONTRACT_EXEMPLAR` (`src/play/decompose-epic-core.ts:376`) and S-066-01 itself:

- **Scope** — which parts of the system the story touches, and what it explicitly does not.
- **Story acceptance** — verifiable done-conditions for the whole story, beyond any one ticket's
  checkbox.
- **Honest boundary** — what this story proves versus what it defers (e.g. fixture-proven vs.
  live-verified), stated rather than hidden.
- **Wave rationale** — why the ticket DAG is shaped as it is: what runs alone, what runs in
  parallel, and why that's safe (disjoint files / dependency edges).
- **Out of this slice** — adjacent work deliberately excluded, so a worker doesn't scope-creep
  into it.

## 5. The readers to name (from ticket Context + E-066 "Done looks like")

1. **Executing agents** — the worker holding a ticket; the story is where epic intent lands within
   one hop. Emphasis on **cross-vendor cold workers**: agents from other vendors arrive with
   `AGENTS.md` and lisa's injected context only, so the parent story is the entire brief.
2. **The sweep** — the board-review pass that checks story acceptance when closing work.
3. **Downstream allocation policy** — routing/overflow decisions treat the story as the unit of
   allocation (the routing arc consumes this; it reads scope + DAG + wave rationale to decide
   what can run where, in parallel).

## 6. The working rule to state

"A worker reads its ticket's parent story **before the Research phase**." The ticket frontmatter's
`story:` field is the pointer; stories live in `docs/active/stories/` (per CLAUDE.md's directory
conventions — the workflow doc itself never states where stories live, another gap this section
can close in passing).

## 7. Constraints

- **Self-contained — no bare charter codes.** The ticket forbids dereferencing charter codes
  (P1/P3/P6/N-codes). E-066's context notes cross-vendor workers can't resolve them; the section
  must carry its meaning in plain prose. The existing doc already complies (it contains no codes),
  so this is a bar to hold, not a cleanup.
- **Tone/format:** match the doc — imperative, terse, `##` sections separated by `---`, tables and
  numbered lists where they earn it.
- **~200-line artifacts** per phase rule 2; the doc addition itself should stay proportionate
  (the whole doc is 112 lines; a story section of roughly 25–45 lines fits its register).
- **No frontmatter edits to the ticket** (Lisa owns phase/status transitions).
- **Concurrency:** T-066-01-02 is in flight in a sibling thread touching `src/gate/gates.ts` and
  `src/play/decompose-epic-core.ts` (visible as uncommitted modifications). This ticket touches
  only `docs/knowledge/rdspi-workflow.md` — disjoint by design (the story's wave rationale says
  so). Commits must stage **only** this ticket's files.

## 8. Assumptions surfaced

- Lisa's injection is content-agnostic (whole-file); nothing in vend's repo parses the doc's
  headings, so a new `##` section cannot break tooling.
- The acceptance criterion is prose-verifiable (section present, five sections named, readers
  named, rule stated, no charter codes) — no automated test exists or is demanded for this ticket.
- Sibling T-066-01-02's gate names the andon `story-incomplete`; mentioning the gate in the new
  section is accurate today (gate code exists at `gates.ts:226-233,329`) even though that ticket
  is still mid-flight.
