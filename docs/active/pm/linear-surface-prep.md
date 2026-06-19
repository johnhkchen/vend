# Linear surface — preparation stage (the presentation layer, MCP-independent)

**Date:** 2026-06-19 · **Scope:** the work we can do **before the Linear MCP is set up.** The
designer's *"good enough"* bar is won or lost on **presentation**, not Linear's API — so we
front-load the two things that decide it: **(1) digestible language** and **(2) a calibratable
presentation style.** Nothing here needs Linear connected; when it is, this becomes the render
contract. Sits under the staged signal `staged/graph-view-human-projection.md`.

## The core move: separate **data** from **presentation**

Vend's canonical graph (epics → stories → tickets, as `docs/active/tickets/*.md` + frontmatter)
is **fixed and authoritative**. The designer never reads *that*. They read a **projection** of
it, governed by a **presentation spec** they can tune. *Same graph, many renders.* Calibration
changes the **spec**, never the data. This is what makes "dial it until it's good enough"
possible without ever touching the source of truth — and it keeps the soundness invariant
(two-way data / one-way authority) intact.

---

## Exhibit: what the designer sees *today* (the problem, grounded)

Real ticket `T-018-01`, as it exists:

> **title:** `steer-pure-core` · **type:** feature · **phase:** done
> *"The pure core of `SteerProject-lite` (**R1** pure-core-first, **R3** foundation), mirroring
> `survey-core.ts` … the `SteerProject` **BAML** function (`b.request.SteerProject(project,
> charter)` … **SAP**-parses …). The pure gates: **read-never-invent (PE-1)** … **honest-empty**
> … composes into the **`Play.gates`** contract shape."*

Every bolded token is a "mini stroke." None of it is *wrong* — it's the **dev layer**. The
designer needs the **intent layer**, with the dev layer tucked behind disclosure.

---

## Workstream 1 — Digestible language

### 1a. Field mapping (canonical → designer-facing)

| Canonical field | Designer-facing presentation |
|---|---|
| `title: steer-pure-core` | Plain-language title: **"Build the brain that reads a project and proposes real choices."** |
| `type / phase / status` | A single visual **state** chip: *To do · In progress · Done* (no `phase:done` raw). |
| Context paragraph (jargon) | One-line **"Why this matters"** in plain language. |
| Acceptance Criteria (checkboxes + jargon) | **"What 'done' means,"** rewritten plainly; raw ACs behind *Details*. |
| `depends_on` | Visual **links** between cards (arrows), not an ID list. |
| `Cites:` (file paths) | Tucked in *Details* — dev layer only. |
| Charter codes (`PE-1`, `IA-7`), `BAML`, `SAP` | **Translated or hidden** (see vocabulary policy). |

### 1b. Vocabulary policy (what to do with each jargon class)

- **Charter codes (`P5`, `PE-1`, `IA-7`)** → translate to the plain idea (*"every suggestion
  traces to something real in the project — no invented work"*), or hide. Never show the code.
- **RDSPI phase names, `BAML`, `SAP`, file paths** → **dev layer**, hidden behind *Details*.
- **Internal play names (`survey-core.ts`)** → drop or rename to the capability ("the surveyor").
- **Principle:** the **face** carries *what · why · state · how-it-breaks-down*; the **how**
  (implementation, gates, cites) lives one disclosure-tap deeper.

### 1c. Worked before → after (`T-018-01`)

> **Card face (designer):**
> **Build the brain that reads a project and proposes real choices** · ✅ Done
> *Why:* So Vend can look at a project and offer a ranked to-do list **plus** the genuine
> either/or decisions a human must make.
> *What "done" means:* It produces a ranked list of suggested work, flags the real decisions,
> and **refuses to invent fake work or a fake choice just to look busy.**
> *[ Details ▸ ]* — (collapsed: the Fork type, the BAML function, the gates, the file cites)

That single rewrite *is* the digestibility target. Everything in Workstream 1 is producing this
mapping for every node type (epic, story, ticket, run).

---

## Workstream 2 — Calibratable presentation style

Make the projection **tunable**, so the designer can dial it to "good enough" and we **save**
the setting. Calibration = editing a **presentation spec**, never the graph.

### 2a. The knobs (what's tunable)

- **Vocabulary** — `plain · mixed · technical` (how much dev language leaks through).
- **Density** — `low · medium · full` (how much per card).
- **Field visibility** — which fields sit on the face vs behind *Details*.
- **Grouping** — `by epic · by story · by status · by role · by leverage`.
- **Metaphor** — `tree · board · timeline` (the decomposition tree is the designer's likely favorite).
- **Labels** — the status/word language (`open → "To do"`, `done → "Done"`).
- **Color language** — what color *means* (`by leverage · by status · by role`).

### 2b. Presentation-spec sketch (the calibration artifact)

A small declarative config — *this* is what "calibrate the style" edits. Proposed shape:

```yaml
presentation:
  preset: designer            # designer | dev | custom
  vocabulary: plain           # plain | mixed | technical
  density: low                # low | medium | full
  face:                       # what appears on the card face
    [plain_title, why, state, breakdown]
  details:                    # progressive disclosure (dev layer)
    [charter_codes, file_cites, baml_internals, raw_acceptance_criteria]
  group_by: story             # epic | story | status | role | leverage
  metaphor: tree              # tree | board | timeline
  labels:
    status: { open: "To do", in_progress: "In progress", done: "Done" }
  color_language: leverage    # leverage | status | role
```

### 2c. Role-based presets (the key idea)

The **same graph** renders differently per seat:

- **Designer preset** — `vocabulary: plain · density: low · metaphor: tree`, intent on the
  face, all dev detail hidden.
- **Dev preset** — `vocabulary: technical · density: full`, cites and gates visible.

**Calibration loop:** start from the designer preset → show the designer → adjust the knobs to
their feedback → **save the preset** once they say "good enough." That saved preset is the
deliverable that drives the eventual Linear render.

---

## The "good enough" rubric (make the bar testable, not vibes)

Turn the founder's bar into dimensions the designer scores, so the eventual probe is measurable:

1. **Comprehension** — can I understand each item **without asking the developer**?
2. **Structure** — can I see how big things break into smaller ones?
3. **Density** — right amount of info, not overwhelming?
4. **Language** — matches how I think; no untranslated jargon?
5. **Navigability** — can I find and steer without a map?

*"Good enough" = a pass across all five.* This rubric is also the eventual probe's scorecard.

---

## Deliverables of this prep stage (all in `docs/active/pm/`)

1. **This doc** — the presentation-layer spec (mapping + vocabulary + knobs + presets + rubric).
2. **The field-mapping table** (1a) — extend to every node type (epic, story, run), not just ticket.
3. **The presentation-spec** (2b) — promote from sketch to the concrete config Linear will consume.
4. **A paper mock** — render the *current real* graph in the designer preset (markdown/Mermaid),
   as the thing to put in front of the designer **before Linear exists** — desirability tested on paper.
5. **The rubric** (above) — the scorecard for the eventual probe.

## Handoff to the MCP stage (nothing here is wasted)

When the Linear MCP is connected: the **field-mapping** becomes the issue/sub-issue render; the
**presentation-spec** drives layout, labels, grouping, and color; the **saved designer preset**
is the default view; the **rubric** is the probe's scorecard. The prep stage *is* the render
contract — Linear just executes it.

---

_Prep artifact (discovery), not a promotion. Grounded in real ticket `T-018-01` + the staged
signal `graph-view-human-projection.md` + the founder's Linear/two-way directives. Holds the
data/presentation separation that keeps the soundness invariant (two-way data, one-way authority)._
