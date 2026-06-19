# Linear as Vend's collaborative visual surface — multi-role steering

**Origin:** inbound designer request, 2026-06-19, sharpened over three turns. Began as *"a
beautiful visual diagram instead of code"*; the founder then made the **two-way round-trip
crucial** (teammates leave feedback / update info like post-it notes, so multiple roles steer one
project and the developer leaves the telephone game); and then **committed the platform: build
around Linear + its MCP.** **Success bar: the designer deems the view good enough** — the
"mini stroke looking at text-heavy views" is precisely what we're relieving. Staged, **not
promoted**. **Carries vision-level consequences — see ⚠.**

## The signal (what)

**Linear is Vend's human-viewable, collaborative surface over the work graph Vend authors.**

- **A · Render to Linear (via MCP)** — Vend projects its epic → story → ticket DAG into Linear
  issues/sub-issues so a visual person reads structure, not markdown.
- **B · Live decomposition tree** — put a story in, watch the *existing* `decompose` fan it into
  smaller-and-smaller tickets. Renders a capability we already have.
- **C · The round-trip (the crucial part)** — teammates annotate/update in Linear (post-its,
  comments, field edits). Those return to Vend as **proposed demand**; the steward pulls them
  into the canonical graph. *Vend renders → teammate annotates → annotation becomes a signal →
  steward clears it.* **Reuses `expand-fragment` (E-016)** — a Linear comment *"this flow feels
  clunky"* is a fragment the demand-extraction primitive already turns into a runnable signal.

## Success criterion & cheapest test (do this first)

- **Bar (the founder's):** the **designer deems the rendered view good enough** — it relieves the
  text-heavy "mini stroke." Desirability, judged by the real user, not a sync metric.
- **Cheapest test (near-free):** the ticket graph **already exists as data** (`docs/active/
  tickets/*.md` + frontmatter). **Generate a Linear view from the current real graph and put it
  in front of the designer.** Yes → desirability proven, build the round-trip. No → we learn what
  "good enough" means *before* spending a block. This tests the one high-risk assumption — *can a
  generated view actually relieve the mini-stroke?* — for almost nothing.
- *Session note:* the **Linear MCP is not connected in this session yet** — wiring it is the
  literal first dependency for the probe.

## The guard — two-way **data**, one-way **authority** (the soundness invariant)

Committing to Linear *as the surface* is separable from Linear *owning the truth*.

- **Annotation-as-demand, append-only.** Feedback enters the **clearing queue** as proposed
  signals — it never silently mutates the canonical graph. Sidesteps "whose write wins on
  conflict." The steward (human) reconciles. This is what keeps the system **sound from every role**.
- **Vend stays system of record.** Linear is the rich **view + inbox**, not the source of truth.
- **N2 not implicated** — teammates steer *demand*, never approve *agent steps* (the round-trip
  returns humans to **authoring**, not to babysitting the agent; P4 intact).

## ⚠ Vision-level consequences (founder's call — above this desk)

Committing to Linear has three knock-on effects the desk can flag but not promote:

1. **Single → multi-role stewardship.** `clearing-dynamics.md` says *"the human assents"*
   (singular); this makes it plural. Proposed new invariant: *Multiple humans may author and
   assent. The executor never sits in the loop; the round-trip returns humans to authoring, never
   to supervising the agent.*
2. **P5 → "local-first, not local-only."** Linear is a cloud dependency. Hold P5 by keeping the
   **engine** (clearing, decompose, executor) fully local/offline; Linear is the **surface
   layer**. Vend works solo offline; collaboration is the shared layer on top.
3. **v1 surface.** `vision.md` names the v1 surface a **TUI**; this elects **Linear as a primary
   human surface**. Worth a conscious vision update (Linear-surface alongside or ahead of TUI).

**Recommend:** ratify these (a short charter/vision amendment) **before** building C. The render
probe (A/B desirability test) can run now regardless.

## Budget & phasing

1. **Desirability probe** — generate a Linear view from the real graph, test on the designer. *Near-free; do first.*
2. **A · Render to Linear (MCP)** — ~1 block over existing ticket data, once the probe says "good enough."
3. **B · Decomposition-tree view** — small; downstream of `decompose`.
4. **C · Annotation round-trip** — larger (ingestion + reconciliation, reusing `expand-fragment`); **gated on the charter ratification above.**

## Readiness / deps / sequencing

- **Tickets-as-data exist**; `decompose` authors the DAG; **`expand-fragment` (E-016)** is the
  round-trip's demand engine — already shipped. **Linear MCP** must be connected.
- **A/B not trust-gated** (a surface, not autonomy). **C gated on the charter ratification**, not E-014.
- **Pairs with the design-language session** (`survey-board.md` row 6): that defines the visual
  *language*; this elects the *surface* (Linear) that renders it.

## Pull this — the first castable unit (render, MCP-independent) ← overseer pulls & casts

The feature is **ready for the overseer to pull and cast** at its first slice. Scoped so it's
**castable now** — no Linear MCP, no charter ratification required (those gate later phases).

- **What (the slice):** build the **presentation layer (render-only)** — project Vend's
  canonical graph (`docs/active/epics + stories + tickets`) into the **designer preset** per
  `linear-surface-prep.md`: a **decomposition tree** with **digestible card faces** (plain
  title · why · state), the **vocabulary policy** stripping charter codes / `BAML` / file paths
  to a collapsed *Details* layer, driven by the **presentation-spec** knobs, rendered to a
  **local/Mermaid surface.**
- **Acceptance target (not blind):** the output matches **`linear-surface-mock.md`** — the
  paper mock *is* the spec. Pass the **5-dim rubric** with the designer.
- **Budget envelope:** **~1 block** (a projection over ticket data that already exists; no new
  data path — `decompose` already authors the graph).
- **In-bounds:** advances **IA-7 / P2 / legible-steerable state**; **not trust-gated** (a
  surface, not autonomy); **data/presentation separation** keeps the canonical graph untouched.
- **Explicitly excluded** (later phases, deliberately out of this cast): the **Linear MCP
  adapter** (phase 2, after designer sign-off + MCP connected) and the **two-way round-trip C**
  (phase 3, gated on the single→multi-steward charter ratification).

```
vend chain "Build the render-only presentation layer for the visual surface: project Vend's canonical work graph (docs/active epics + stories + tickets) into the designer preset per docs/active/pm/linear-surface-prep.md — a decomposition tree with digestible card faces (plain-language title/why/state; the vocabulary policy strips charter codes, BAML, and file paths to a collapsed Details layer), driven by the presentation-spec knobs, rendered to a local/Mermaid surface. Acceptance: output matches docs/active/pm/linear-surface-mock.md and passes the 5-dimension good-enough rubric. Excludes the Linear MCP adapter and the two-way round-trip (charter-gated). — A surface, not autonomy: not trust-gated, keeps the canonical graph untouched (data/presentation separation), advances IA-7/P2/legible-steerable state. Budget ~1 block."
```

_Pull moves it onto the board with one gesture; the cast builds the render to the mock's spec.
Phases 2 (Linear MCP) and 3 (round-trip) stay staged behind it._

---

_Advances [IA-7, P2, core feature: legible/steerable project state · **new segment: multi-role
teams**] · grounded in the inbound request + the founder's Linear-platform + two-way directives +
`expand-fragment` (E-016) as the round-trip engine. Holds the soundness invariant (two-way data /
one-way authority). **Opens a charter/vision question (single→multi-steward; P5 local-first-not-
only; v1 surface).** Staged — pull to clear; probe first, C blocked on charter ratification._
