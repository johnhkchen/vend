# A collaborative visual surface — multi-role steering via a two-way work graph

**Origin:** inbound designer request, 2026-06-19, sharpened in follow-up. Began as *"a beautiful
visual diagram instead of code"*; the founder then made the **two-way round-trip crucial**: the
designer (and other non-dev roles) **leave feedback and update info — like post-it notes — on
the shared structure**, so **multiple teammates steer the same project**, the **developer leaves
the telephone game**, and each role ensures the system is sound *from their own seat*. Staged,
**not promoted** — a human pulls to clear. **Contains a charter-level question (see ⚠ below).**

## The signal (what)

A **collaborative visual surface over the work graph Vend authors**, two-way:

- **A · Render** — Vend emits its epic → story → ticket DAG and run production-line to a
  human-viewable surface (local/Mermaid/SVG first; **Linear as one publish adapter**).
- **B · Live decomposition tree** — put a story in, watch the *existing* `decompose` fan it into
  smaller-and-smaller tickets as a growing tree. Renders a capability we already have.
- **C · The round-trip (the crucial part)** — teammates **annotate** the surface (post-its,
  feedback, field updates). Those annotations **return to Vend as proposed demand**, and the
  steward pulls them into the canonical graph. *Vend renders → teammate annotates → annotation
  becomes a signal → steward clears it.*

## Why (vision-distance it closes)

- **Multi-role steering.** Today Vend assumes one steward. A designer/PM/QA can each ensure the
  project is sound *from their role* without routing everything through the developer — the
  **telephone game** (human-to-human spec translation) is removed, not just shortened.
- **The artifact becomes the shared truth, not the dev's head.** Non-dev roles bounce off
  code/markdown/TUI (the inbound *"mini stroke looking at code"*). A two-way visual surface lets
  them contribute demand directly — this is **O5** (legible project state) plus a **new segment:
  teams, not just solos.**
- **B is near-free** and **C reuses `expand-fragment` (E-016)** — a post-it *"this flow feels
  clunky"* **is a fragment**; the demand-extraction primitive already turns fragments into
  runnable signals. The round-trip is mostly *wiring a human as a second demand source.*

## The guard — two-way **data**, one-way **authority** (this is load-bearing)

The post-it metaphor is the discipline: annotations **attach to** the graph; they never
blind-overwrite canonical fields.

- **Annotation-as-demand, append-only.** Feedback enters the **clearing queue** as proposed
  signals/edits — it does **not** silently mutate the canonical graph. This sidesteps
  "whose write wins on conflict" entirely. The steward (human) pulls to reconcile.
- **Vend stays system of record (P5 preserved).** Linear/the surface is a *projection + an
  inbox*, never the source of truth. Hold P5 as **local-first, not local-only**: Vend works
  fully offline solo; the collaboration surface is an **opt-in layer**, not a required cloud dep.
- **N2 is *not* implicated** (earlier over-applied). A teammate authoring demand from their
  role is the opposite of babysitting agent steps — it removes a human bottleneck. The
  round-trip puts a human back into **authoring**, never into **supervising the agent** (P4 intact).
- **Linear is *a* target, not *the* truth** — render/ingest via an open/local format first;
  Linear is one adapter (P6-style optionality, no SaaS coupling).

## ⚠ Charter-level question (founder's call — above this desk)

Two-way steering expands Vend from **single steward → multi-role stewardship**.
`clearing-dynamics.md` says *"the human assents"* (singular); this makes it plural. That is a
**vision/charter decision**, not a feature the desk can promote on its own. It likely wants a new
invariant, e.g.:

> *Multiple humans may author and assent. The executor never sits in the loop; the collaborative
> round-trip returns humans to **authoring** the work, never to **supervising the agent.***

**Recommend:** decide this consciously (a charter amendment) **before** building C — the feature's
shape depends on the answer. A/B can proceed regardless; C is gated on this decision.

## Budget & phasing

- **B (decomposition-tree render)** — small; downstream of existing `decompose`. *Start here.*
- **A (graph render → local/Mermaid)** — ~1 block over the ticket data that already exists.
- **C (annotation round-trip)** — larger: annotation ingestion + reconciliation, reusing
  `expand-fragment`. **Gated on the charter decision above.**
- **Multi-user shared surface / Linear adapter** — the heaviest increment; after C proves out.

## Readiness / deps / sequencing

- **Tickets-as-data exist** (`docs/active/tickets/*.md` + frontmatter); `decompose` authors the
  DAG; **`expand-fragment` (E-016) is the round-trip's demand engine** — already shipped.
- **A/B not trust-gated** (a surface, not autonomy). **C gated on the charter decision**, not on E-014.
- **Pairs with the staged design-language session** (`survey-board.md` row 6): that defines the
  visual *language*; this is the collaborative *surface* that language renders.

---

_Advances [IA-7, P2, core feature: legible/steerable project state · **new segment: multi-role
teams**] · grounded in the inbound request + the founder's two-way directive + IA-7 + the
design-language signal + `expand-fragment` (E-016) as the round-trip engine. Holds P5
(local-first-not-local-only), P4, P6. **Opens a charter question (single → multi-steward).**
Staged — pull to clear; C blocked on the charter call._
