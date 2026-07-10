# T-066-01-04 — Design

**Decision to make:** where the story-layer section lives in `rdspi-workflow.md`, what it is
called, what it contains, and how far it goes (describe the contract vs. re-document the whole
story file format).

## Option A — New top-level section between "Phase Rules" and "Ticket Format"

Add `## The Story Layer` as a peer of the existing four sections, placed after Phase Rules and
before Ticket Format. Content: the story's job in one sentence, the five sections with one-line
meanings, the readers, the read-before-Research rule, and where stories live.

- **Fits the doc's grain.** The doc reads top-down as: how a ticket is built (phases) → rules →
  what a ticket is (format) → how tickets run together (concurrency). The story is the layer
  *above* the ticket; introducing it right before Ticket Format means a reader meets the parent
  concept before the child's field schema, and the `story:` field line in Ticket Format stops
  being a dangling reference.
- **Reachable by the rule's audience.** A cold worker skimming the injected doc top-down hits the
  read-your-parent-story rule before the phase they'd apply it in has any pull on them — the rule
  says "before Research," and Research is defined above; adjacency to Ticket Format (where
  `story:` points) is where a worker actually looks up what the field means.
- **Risk:** none identified. Nothing parses headings (Research §2).

## Option B — Fold into "Ticket Format" as a subsection

Extend the existing Ticket Format section with a `### The Parent Story` subsection under the
`story:` field.

- Keeps story knowledge adjacent to the field that points at it.
- **Rejected:** it subordinates the story to the ticket, which is the exact inversion the epic
  diagnoses — the story layer rotted *because* it was a field annotation instead of a named layer
  with a job. A subsection of ticket-format is documentation of a pointer, not a contract with
  readers. It also buries the readers ("the sweep," "allocation policy") who are not ticket
  executors and would never look inside Ticket Format.

## Option C — New rule in "Phase Rules" only

Add a Phase Rule 6: "Before Research, read the parent story," with the five sections listed inline.

- Cheapest edit; puts the rule where the phases are governed.
- **Rejected as the sole change:** the ticket demands the story's *job* and *readers* be named,
  which is more than a rule — it's a layer definition. Cramming a contract definition, five
  section meanings, and three reader classes into a numbered rule violates the doc's register
  (rules there are one short paragraph each). However, a **one-line pointer** in Phase Rules is
  worth keeping from this option — see "Chosen design."

## Chosen design: A, plus a one-line hook in the Research phase

**Primary:** Option A — `## The Story Layer` between Phase Rules and Ticket Format, separated by
the doc's `---` convention.

**Secondary hook:** one sentence appended to the existing `### Research` phase description:
"Before starting Research, read the ticket's parent story (the `story:` field in the frontmatter
names it)." Rationale: the working rule is temporally anchored to Research; a worker deep in
execution follows the phase list, not the layer glossary. Stating the rule at its trigger point
*and* defining the layer in its own section is how the doc already handles phase transitions
(stated in the phase text via artifacts, governed in Phase Rules). Two mentions of one rule in a
112-line doc is acceptable redundancy for the doc's one guaranteed-injected channel.

### Content of the new section (shape, not final prose)

1. **Job, one paragraph:** the story is the contract between epic intent and ticket execution.
   Tickets say what to build; the story says why this slice, what "done" means for the slice, and
   what was deliberately left out. Stories live in `docs/active/stories/`.
2. **The five sections, named with one-line meanings** (prose labels per Research §3 — Scope,
   Story acceptance, Honest boundary, Wave rationale, Out of this slice — with a note that Wave
   rationale sits under the story's `## DAG` block). Rendered as a table or definition list:
   a table matches the doc's existing "Fields:" list style best as a bulleted list; choose a
   **bulleted list** (`- **Scope** — …`) since Ticket Format uses exactly that pattern for fields.
3. **Readers, named:** executing agents (with the cross-vendor cold-worker emphasis: `AGENTS.md`
   plus injected context is all they have — the story is the whole brief); the sweep (checks story
   acceptance at close); downstream allocation policy (the story is the unit routed/parallelized;
   it reads Scope, the DAG, and Wave rationale).
4. **The working rule, stated imperatively:** read your ticket's parent story before Research;
   the parent story is the first hop for any "why"/"how far" question mid-ticket.
5. **Enforcement note, one line:** story completeness is machine-enforced at decomposition (a
   story missing contract sections is refused before a file is written) — this tells a reader the
   sections are load-bearing, not aspirational. Phrase without naming vend internals beyond what
   the doc already does (it names Lisa freely; it never names vend's gate machinery — keep it
   mechanism-light: "generated stories are refused at the source if any section is missing").

### What the section deliberately does NOT contain

- **No story frontmatter schema.** Ticket Format documents ticket fields because Lisa reads them;
  duplicating the story frontmatter (id/title/type/status/priority/tickets) would create a second
  source of truth for something this ticket's siblings just settled in code. The contract is the
  *body*; the section documents the body.
- **No charter codes** (P/N references) — ticket constraint; also no vend-internal jargon
  (`castPlay`, andons, BAML) that a cross-vendor worker can't resolve. "Named andon" from the
  epic's language becomes plain "refused with a named error."
- **No exemplar story inline.** The render prompt embeds the exemplar (T-066-01-01); the doc
  pointing at ~40 lines of sample story would double the section's length for readers who will
  have real stories in-repo. The five one-liners carry the shape.

### Sizing

Target 30–40 lines for the new section + 1 line in Research. Doc grows ~112 → ~150 lines,
keeping the story section proportionate to Ticket Format (~40 lines).

## Alternatives on placement of the rule-hook, considered and dropped

- In Phase Rules as rule 6: redundant with both the Research hook and the layer section — three
  statements of one rule is noise.
- In Concurrency (since allocation policy reads the DAG): the wave-rationale reader is mentioned
  in the layer section's readers list instead; Concurrency stays about Lisa's mechanics.

## Verification approach (feeds Plan)

Acceptance is prose-checkable: (1) section exists; (2) five sections named with the prose labels
matching `materialize.ts`'s rendered output; (3) three reader classes named; (4) read-before-
Research rule stated; (5) `grep -E "\b[PN][0-9]+\b"` over the doc stays clean (no charter codes);
(6) `bun run check` still passes (docs-only, but run the real gate anyway per house discipline).
