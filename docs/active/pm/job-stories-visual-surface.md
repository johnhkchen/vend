# Job stories — the visual surface (designer + founder/director)

**Date:** 2026-06-19 · **Feature:** Linear collaborative visual surface (`staged/graph-view-
human-projection.md`), prep in `linear-surface-prep.md`. JTBD format (situation-first).
**Two personas:** the **designer** (visual sensibility on a technical project — wants a
*beautiful* diagram and *digestible language*) and the **founder/director** (wants a *brief*,
not nitty-gritty). **Design:** paper mock = prep deliverable #4 (designer preset); no Figma yet.

> ACs are observable/measurable and bound by the prep discipline: **data/presentation
> separation** (the view is a projection, never the source of truth), the **vocabulary policy**
> (no `PE-1`/`BAML`/file-paths on the face), and the **5-dim "good enough" rubric**
> (comprehension · structure · density · language · navigability).

---

## Story 1 — Trade the wall of text for a visual structure *(designer)*

**Title:** See the project as a diagram, not a wall of jargon

**Description:** When I open a technical project and hit a wall of tickets, code, and codes I
don't speak, I want to see the work as a visual structure instead, so I can engage with it
instead of looking away.

**Acceptance criteria:**
1. On open, the project renders as a **visual diagram** (nodes + links), not a text/ID list.
2. Every card **face** shows plain-language *title · why · state* — **no** raw charter codes,
   `BAML`, `SAP`, or file paths (vocabulary policy).
3. Structure (epic → story → ticket) is shown as **visual containment/links**, not an ID tree.
4. The designer reads **≥5 items and explains each without asking the developer** (rubric: comprehension).
5. The canonical graph is **unchanged** — the view is a projection; nothing on screen mutates source.
6. A clear/empty area renders **honestly as "nothing here"** (IA-4), never fake nodes to fill space.
7. The designer **signs off "good enough"** across all five rubric dimensions.

---

## Story 2 — A diagram that's actually *beautiful* *(designer)*

**Title:** Work in a view that doesn't aggravate my eye

**Description:** When the auto-generated view is functional but ugly, I want the diagram to be
visually pleasing — deliberate hierarchy, spacing, and color that means something, so aesthetic
fatigue doesn't push me out of the project.

**Acceptance criteria:**
1. Layout encodes **visual hierarchy** (size/position reflect epic > story > ticket), not a flat dump.
2. Color follows the spec's **`color_language`** (leverage | status | role) **consistently** —
   meaning, not decoration.
3. On-screen **density is bounded** by the density knob (low, for the designer preset) — no walls.
4. **Whitespace and grouping are deliberate**; related items cluster visibly.
5. The **metaphor is selectable** (tree | board | timeline); the decomposition **tree renders cleanly**.
6. The designer rates the view **aesthetically acceptable**, not merely legible (a delight check beyond comprehension).
7. **No layout breakage at real project scale** — readable at the current graph's node count.

---

## Story 3 — The language makes or breaks the visual *(designer)*

**Title:** Read the work in words I think in

**Description:** When a visual still carries developer jargon, I want every label rewritten in
plain language, so I understand the work without translating in my head.

**Acceptance criteria:**
1. Charter codes / RDSPI phases / `BAML` / file paths **never appear on the face** — translated
   to plain intent or hidden behind *Details*.
2. Status reads as **words** (To do / In progress / Done), never `phase: done`.
3. Each node carries a plain **"why this matters"** and **"what done means."**
4. Dev detail is **one disclosure-tap deeper** (progressive disclosure) — available, not in the way.
5. **Zero untranslated-jargon tokens on the face** — checkable against a jargon list.
6. A non-dev **reads any node's intent correctly** without the developer present (comprehension test).
7. Each plain rewrite **traces to the real ticket** — fidelity preserved, no invented meaning.

---

## Story 4 — Tune it to my taste, and keep it *(designer)*

**Title:** Calibrate the view until it fits, then have it stay

**Description:** When the default view is close but not right for me, I want to adjust how it
looks and reads and save that, so each time I return it already fits.

**Acceptance criteria:**
1. The **presentation spec** exposes the knobs (vocabulary, density, field visibility, grouping,
   metaphor, labels, color) as adjustable.
2. Changing a knob **re-renders without touching the graph data**.
3. Adjustments **persist as a saved preset** (the designer preset).
4. The designer preset **loads by default** for the designer's seat.
5. Calibration **converges**: the designer reaches a **5-dim rubric pass**, and the preset is saved at that point.
6. A developer opening the same graph sees the **dev preset** — same data, different render (role presets).
7. **Reset-to-default is one action**; tuning never corrupts the canonical graph.

---

## Story 5 — The brief, not the weeds *(founder/director)*

**Title:** Grasp where the project stands in a glance

**Description:** When I check in as the director, I want a brief overview of shape and direction
— not ticket-level detail — so I can grasp where things stand and move on.

**Acceptance criteria:**
1. A top-altitude view shows **epics/themes and their state**, collapsing ticket detail by
   default (`density: brief · group_by: epic`).
2. The **single highest-leverage thing in progress is surfaced first** (IA-1), not an unranked list.
3. Progress shows as **proportion done per epic**, not a checkbox list.
4. The director can **state the project's direction after ≤1 minute** on the view (time-to-grasp).
5. Detail is available on **drill-down**, but never the default.
6. The brief reads in **plain language** — no nitty-gritty, no jargon.
7. **"Nothing material in flight"** shows honestly when true (IA-4), never padded status.

---

## Story 6 — See how a feature breaks down, at altitude *(founder/director)*

**Title:** Judge scope without reading every ticket

**Description:** When someone proposes a feature, I want to see how it fans into smaller pieces
without reading every ticket, so I can judge scope and shape quickly.

**Acceptance criteria:**
1. A feature renders as a **decomposition tree collapsed to 1–2 levels** by default (founder altitude).
2. Expanding a branch is **optional, on demand** — never forced.
3. Each branch shows **count/size of sub-work** so scope is legible without detail.
4. It is the **existing `decompose` output, rendered** — no separate data path.
5. The director can assess **"big or small" per branch in a glance** (scope-at-altitude).
6. **Plain-language labels** apply at every level (vocabulary policy).
7. **Genuine forks/decisions** (from `steer`) are flagged at the top level as the calls needing a human.

---

## Story 7 — Steer from my seat without touching code *(shared — designer + founder)*

**Title:** Leave feedback on the view and have it become real work

**Description:** When I see something off in my role, I want to leave feedback on the view
itself, so I can steer the project without dropping into code or routing through the developer.

**Acceptance criteria:**
1. Feedback is left **on the view in-place** (comment / post-it / field note).
2. The annotation **returns to Vend as a proposed signal** (annotation-as-demand), reusing `expand-fragment`.
3. It **enters the clearing queue** — it does **not** mutate the canonical graph directly
   (two-way data, one-way authority).
4. The steward sees the proposed signal and **pulls to reconcile** (human-pulls-to-clear).
5. The feedback **never puts the human into supervising the agent** — it's authoring, not babysitting (N2/P4).
6. **Both** a founder (strategic note) and a designer (UX note) can do this **from their own preset**.
7. The contributor can **see their feedback's state** (proposed → pulled / cleared) — a visible round-trip.

---

## Coverage note

Seven stories, two personas. **Designer (1–4):** visual structure over text, *beauty* not just
legibility, *language* as the make-or-break, and *calibration* that persists — directly serving
"something visual that doesn't aggravate my sensibilities." **Founder/director (5–6):** the
*brief* and *scope-at-altitude* — same graph, collapsed by the density/grouping knobs, never the
weeds. **Shared (7):** the round-trip that lets each role steer from their seat without the
telephone game. Every story leans on the **same presentation spec** over the **same canonical
graph** — the prep stage's whole point: one source of truth, many calibrated renders.

*Staged on the desk — discovery, not promotion. C (the round-trip, Story 7) remains gated on the
charter ratification (single → multi-steward) flagged in the signal.*
