# Vend — Charter

The durable anchor. Small by design, slow by design. This is the **value
function** the work-clearing playbook checks every epic and every unit of work
against. It is steering context first and a compliance checklist second: it tells
a decomposing agent *what is worth allocating on this project and why*, so the
work it produces is **valuable**, not merely **valid**.

Read `vision.md` for the full narrative; this file is the indexed, stable spine
that planning references by ID. When the two disagree, fix one — they are not
allowed to drift.

---

## The core feature

**Vend is a clearing house for tasks, against the specific project.** It stands
between *intent* (what someone wants done) and *execution capacity* (lisa and its
agents), and it **clears** raw intent into work that can be allocated effectively:
grounded in this project's reality, valuable to the design, and safe to run
autonomously.

Its core value is **simplifying the allocation of work** — turning *"here's what I
want"* into *"here's the right work, right-sized, in the right order, worth doing
now."* Everything else (the typed graph, the gates, the budget, the shelf) exists
to make that clearing trustworthy at volume.

The gates are the clearing house's guarantee: nothing settles into execution that
hasn't cleared. That guarantee is what makes "you got what you paid for" true.

---

## What makes work valuable here

The clearing function admits a unit of work only if it is worth allocating. A unit
is valuable when it is:

1. **Purposeful** — it advances the core feature (better clearing / better
   allocation) or a named invariant below, and it can *say which*. Work that
   advances nothing nameable is the worst waste (overproduction); refuse it.
2. **Grounded** — it answers to this project's actual state, not a speculative
   future. *Go and see* before deciding (`go-and-see.md`); clear against what is,
   not what might be.
3. **Allocatable** — right-sized for one autonomous session to finish and a human
   to trust, and sequenced so it doesn't stall capacity waiting on a missing
   dependency. Effective allocation is the product; under-specified or
   mis-ordered work breaks it.
4. **In-bounds** — it violates no non-goal, and it does not regress an invariant
   to advance another.
5. **Verifiable** — "done" can be told apart from "done right." A unit carries the
   means to know it landed (a check, a test, an observable outcome), so the
   clearing guarantee can be honored rather than asserted.

These five are *the steering*. An agent that internalizes them produces
allocatable, valuable work without being told the answer.

---

## Invariants (stable IDs — reference, don't restate)

The seven principles from `vision.md`, indexed. Epics declare which they
`advances`; the playbook refuses work that regresses any.

- **P1 — Author once, run forever.** Cost lives at authoring; never push spec
  effort back onto the run.
- **P2 — The run is two gestures.** Pick + budget + go. Config belongs at
  authoring, not at the counter.
- **P3 — Gates are the contract.** Quality lives inside the work; a unit without
  an enforceable gate isn't done.
- **P4 — Autonomy by default, not supervision.** Work proceeds against its gates,
  not live human approval. Escalation is a deliberate, gated event.
- **P5 — Local-first.** Fully usable offline, on one machine; owns its own state.
- **P6 — Executor-agnostic underneath.** Claude Code first; the design never
  assumes it's the only executor.
- **P7 — Budget is a hard contract.** A run respects the time/tokens it was
  allocated, both ways.

## Non-goals (stable IDs — the clearing house rejects these)

- **N1 — Not a chat copilot.** The win is removing yourself from the loop, not
  conversing in it better.
- **N2 — Not a babysitting dashboard.** Better step-approval solves the wrong
  problem.
- **N3 — Not a one-off prompt runner.** The unit is the reusable, gated playbook.
- **N4 — Not an executor.** Vend clears and allocates; lisa (and later others)
  execute.

---

## How planning uses this charter

- An **epic** carries a thin, stable anchor: `advances: [P…]` plus one line on the
  value it serves. It does **not** restate this charter.
- The **playbook recomputes alignment** at decompose time against *this* charter
  and *this* project. The link is a gate, not stored prose — so it can't go stale.
  Retire an invariant and a one-line grep finds every dangling `advances` ref: a
  *detectable defect*, not silent rot.
- Alignment is judged by **purpose and value** (the five criteria), not by ticket
  formatting. Structural validity (lisa frontmatter, `lisa validate`) is the final
  poka-yoke on the way out, not the standard of worth.

## Amendment rule (why this can't blow up)

This file is **capped at roughly one page**. Adding an invariant or non-goal
requires **retiring or merging another** — an amendment cost, paid deliberately
and versioned, never accreted. The anchor stays O(1) regardless of how many epics
exist. A charter that grows into a wiki has failed at its one job.
