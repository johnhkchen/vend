# PM workspace — the PM agent's desk

A dedicated, **upstream** space where a PM agent surveys project state and stages a
**proposed batch** of demand for the next round of epics. Drafts here are cheap and
**un-promoted**: staging a candidate is not pulling it. Promotion to the curated board
is a separate, deliberate gesture (see *Handoff* below). This keeps pull-discipline
intact (`playbooks/propose-epic.md` PE-1) — the PM *proposes*; the human *pulls*.

This space is **not** the active board. The PM writes only here. It never edits
`demand.md`, `epic/`, `stories/`, or `tickets/` — those change only when a play clears a
promoted signal.

## Process gate (discovery vs. processing)

This workspace runs in two modes, separated by `process-gate.md`:

- **Discovery (default, gate down):** the PM agent surveys freely and accumulates
  findings + draft signals. A `proposed-batch.md` present in this mode is a
  **preliminary draft**, not a decision. The orchestrator promotes **nothing** to the
  active board while the gate is down.
- **Processing (gate raised):** when the human sets `ready: true` in `process-gate.md`,
  the PM synthesizes the final ranked batch and recommends promotions, then lowers the
  gate (one-shot). Only now does a human pull a signal onto the board.

The flag is the human's "I'm ready for you to process this" — it lets discovery run as
long as it needs without the orchestrator jumping to a pull.

## Workspace layout (evergreen vs. time-based)

- **Evergreen (root):** `README.md` (this file) and `process-gate.md` (the control flag).
  The desk's durable scaffolding — maintained, not dated.
- **Time-based (`cycle-<date>-<slug>/`):** each completed discovery→processing cycle's
  artifacts (discovery, triage, strategy, batch, brief, PRD…), archived as dated snapshots
  with a per-cycle `README.md`. The live `proposed-batch.md` lives at root only while a
  cycle is active. *(A strategy artifact that becomes a living anchor — e.g. a settled
  value proposition — graduates to `docs/knowledge/`, not the cycle archive.)*

## What the PM agent does

Operationalizes `playbooks/project-steering.md` (the 10 steering moves) as a delegated
agent. Each run:

**Reads** — `knowledge/charter.md` (the value function, P1–P7/N1–N4),
`active/demand.md` (the board + what's done, E-001…E-013),
`knowledge/information-architecture.md` (esp. the open threads),
`knowledge/vision.md`, the playbooks (`project-steering.md`, `propose-epic.md`), and the
**codebase-index** MCP (`get_architecture`, `query_graph`) to ground proposals in the
real structure + hot-paths rather than assumption (`playbooks/codebase-index.md`).

**Produces** — `proposed-batch.md`: a **ranked shortlist (≤6)** of candidate signals,
each carrying *title · value tier (Keystone/High/Standard/Leaf) · the charter invariant
it advances · a rough budget envelope · a one-line rationale · readiness/deps*. Plus a
single **recommended next pull**. Signals stay **un-elaborated** (PE-6 intent, not
decomposition) — no epic cards are drafted here.

## Pull-discipline guardrails (the anti-overproduction contract)

- A **small ranked batch**, never a backlog drain (PE-1). Overproduced plans are
  inventory that rots (`tps.md`).
- Signals are **cheap one-liners** — what + why it might matter — left un-elaborated
  until pulled.
- Rank by **leverage, not effort** (`demand.md`). Surface only what the charter and the
  codebase genuinely demand *now*.
- Every candidate must name the charter invariant or core-feature advance it serves
  (PE-1 purposeful), or it doesn't make the list.

## Handoff — how vend works with this space

The staging unit is a **signal string** — exactly what the clearing plays already take.
A promoted signal is cleared by a play, which mints real artifacts on the **active
board**, never here:

```
docs/active/pm/proposed-batch.md   (PM stages ranked signals — upstream)
        │  human pulls one (the deliberate gesture)
        ▼
vend chain "<signal>"              (ProposeEpic → DecomposeEpic)
        ▼
docs/active/epic|stories|tickets/  (real epic card + tickets — the active board)
```

So plays **read** signals from here as input; their **outputs land on the active board**.
The PM space is strictly upstream of the pull. (A future play could batch-read this file
directly — for now the handoff is the signal string + a human pull.)
