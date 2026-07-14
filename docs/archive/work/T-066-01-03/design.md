# T-066-01-03 — materialize-contract-body — Design

Four decisions settle this ticket: how the story renderer gets the data it newly needs (tickets +
date), what it does when a contract field is absent, how a general ticket DAG renders as text, and
what the demoted provenance footer says. Each is decided below with the rejected options.

## D1 — Signature: `renderStoryFile(s, storyTickets, cutDate)`

The DAG block needs the story's `TicketDraft`s (for `depends_on` + titles) and the footer needs a
date; today's `renderStoryFile(s: StoryDraft)` has neither.

**Chosen**: widen the pure function to
`renderStoryFile(s: StoryDraft, storyTickets: readonly TicketDraft[], cutDate: string)`.
`materialize` (the already-impure verb) supplies both at its call site: it filters `plan.tickets`
to the story's members and computes `cutDate = new Date().toISOString().slice(0, 10)` once per
run. The renderer stays PURE — clock as a parameter is the exact `work-core.ts` pattern
("`new Date(ms)` is total, unlike argless `new Date()`"), and the golden test passes a fixed date
for byte-exactness.

- *Rejected — pass the whole `WorkPlan`*: hands the renderer more than it owns and makes the pure
  test fixture heavier; the story's own tickets are the honest unit. Filtering stays in
  `materialize`, which already holds the plan.
- *Rejected — clock inside the renderer*: violates the module's stated PURE charter and makes the
  golden test impossible to pin byte-exact.
- *Rejected — date on `MaterializeTargets`*: `targets` is "where files go", not "what they say";
  a config field that every caller must fake invites drift. The impure verb owning its clock
  matches `gather.ts`/`cast.ts` precedent.

Filter semantics: `storyTickets = plan.tickets.filter((t) => s.tickets.includes(t.id))` — plan
order preserved (a valid dependency order per the schema), membership defined by the story's own
`tickets` list, which is also what the frontmatter already prints.

## D2 — Absent contract fields: omit the section, never fabricate, never throw

The five fields are `string | null | undefined` by T-066-01-01's deliberate choice; two live
suites (`materialize.test.ts`, `chain-propose-decompose.test.ts:137`) push contract-less stories
through `materialize` today.

**Chosen**: a `null`/`undefined` field renders **nothing** — its section is simply absent from
the body. Present fields (including empty strings — meaning is the gate's job, T-066-01-01 review
gap #2) render verbatim. The DAG block and provenance footer always render: the DAG is derived
from edges that always exist, and provenance is this writer's own testimony, not model output.

- *Rejected — throw on absence*: duplicates the completeness gate (T-066-01-02 owns refusal, and
  in the decompose path it fires **before** the effect, so the writer never sees a shell there);
  breaks the chain-propose-decompose test and the collision-guard fixtures; couples the writer to
  a sibling ticket's file (`gates.ts`), which the story's wave rationale forbids.
- *Rejected — placeholder text ("section not provided")*: fabricates content the parse didn't
  carry — exactly the "silently fabricated default" T-066-01-01 was built to prevent, and it
  would launder a shell into something that *looks* filled.

Consequence stated honestly: if `materialize` is reached outside the gated decompose path with a
shell story, the file is frontmatter + DAG + footer. That is strictly more information than
today's one-liner, and the gate — not the writer — is the contract's enforcement point (P3).

## D3 — DAG block: derived adjacency lines, not the exemplar's tree glyphs

`depends_on` stays the single edge source; the block is a projection of it. The S-066-01 exemplar
draws a `├─`/`└─` tree, but that shape only exists for single-root trees — a general story DAG
(diamonds, multiple roots, `--after` edges to tickets outside the plan) has no faithful tree
drawing.

**Chosen**: a fenced code block under a `## DAG` heading, one line per story ticket in story
`tickets` order, each line `id  title` plus `  ← dep1, dep2` when `depends_on` is non-empty:

```
T-066-01-01  story-contract-schema-and-render
T-066-01-02  story-completeness-gate  ← T-066-01-01
T-066-01-03  materialize-contract-body  ← T-066-01-01
```

- Edges render **verbatim** from `depends_on` — including edges to tickets outside the story or
  plan (`blockEntryTicketsAfter` legitimately creates those). No filtering: dropping an edge
  would make the block lie about the graph.
- Line order: `s.tickets` order (the schema's "execution order"), realized by iterating
  `s.tickets` and looking each id up in a map of `storyTickets`. An id in `s.tickets` with no
  matching TicketDraft (impossible in the decompose path post-`graphIntegrityViolations`, but
  representable) renders as the bare id — degrade honestly, don't crash, matching the
  "doc with no parseable id skips both (degrade, not regress)" precedent.
- `waveRationale`, when present, renders as a plain `Wave rationale: …` paragraph directly under
  the code block — inside the DAG section, exactly where the exemplar puts it (the rationale
  explains the block above it).

- *Rejected — replicate the exemplar's tree glyphs*: correct only for trees; a diamond DAG would
  force either a wrong drawing or duplicated nodes. The exemplar is a look-and-feel bar for
  *content*, not a rendering algorithm.
- *Rejected — mermaid/graphviz block*: heavier than the kitchen-table bar, unreadable raw in a
  terminal, and lisa workers consume the file as text.
- *Rejected — arrows in `→` (blocks) direction*: `depends_on` is the stored direction; rendering
  `←` ("depends on") keeps the projection 1:1 with the source field so a reader can check it
  against ticket frontmatter without mental reversal.

## D4 — The five sections and the footer

Body layout (blank-line separated), mirroring the hand-authored exemplar's labels:

1. `**Scope:** {scope}`
2. `**Story acceptance:** {storyAcceptance}`
3. `**Honest boundary:** {honestBoundary}`
4. `## DAG` + fenced block + optional `Wave rationale: …` paragraph
5. `**Out of this slice:** {outOfSlice}`
6. `---` then `_Materialized by Vend's \`decompose-epic\` play — N ticket(s), {cutDate}._`

Decisions inside this:

- **Labels are prose-cased** (`storyAcceptance` → "Story acceptance", `outOfSlice` → "Out of this
  slice") — the file is for humans and cold workers, not a field-name echo. The mapping lives in
  one ordered structure in `materialize.ts` so the golden test pins it.
- **Footer keeps the exact old words** ("Materialized by Vend's `decompose-epic` play —
  N ticket(s)") with `, {cutDate}.` appended and the whole line demoted to an italic line under a
  `---` rule — "still says a play cut it, and when". Date form `YYYY-MM-DD`, the S-066-01 footer's
  form.
- *Rejected — dropping the ticket count*: it is the one at-a-glance consistency check between
  footer and frontmatter, and keeping the sentence recognizable makes the demotion legible in
  diffs across the 30+ historical shells.

## D5 — Test design (the two ACs)

1. **Golden-file test**: a contract-shaped fixture (all five fields, three tickets with a
   non-trivial edge set including a two-parent join) rendered via
   `renderStoryFile(fixture, tickets, "2026-07-10")` and compared `toBe` against an inline
   template-literal golden — byte-exact, house style (no fixture files on disk exist; gather.test
   calls this pattern "golden hashes"). A second golden pins the shell/degraded shape (no
   contract fields → frontmatter + DAG + footer only) so D2's behavior is deliberate, not
   accidental.
2. **Ticket byte-identity**: `renderTicketFile` is untouched; the existing ticket suite already
   pins its tokens. Add one explicit full-file `toBe` golden for a ticket so "byte-identical to
   today" is *pinned*, not inferred — cheap insurance that also hardens AC2 for future editors.
3. Existing suites stay green by construction: story fixtures without contract fields degrade
   (D2), frontmatter assertions unaffected; `materialize` fs tests unaffected (signature change
   is internal to the module and the one loop call site).

## What this deliberately does not do

No changes to `gates.ts` (T-066-01-02), `decompose-epic-core.ts` exports, the BAML schema, or
`rdspi-workflow.md` (T-066-01-04). No backfill of historical shell stories. No import of
`STORY_CONTRACT_FIELDS` into `materialize.ts` — the writer needs labels and order, not the bare
field list, and its own ordered label table is pinned by the golden; a schema rename still fails
`tsc` here because the renderer reads the fields off `StoryDraft` by name.
