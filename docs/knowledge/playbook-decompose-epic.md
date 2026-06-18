# Vend — The Decompose-Epic Playbook (the first clearing function)

The first playbook, and the v0 lever. Its job is the core feature in miniature:
**clear one epic against this project into work that can be allocated
effectively.** It is the membrane between intent (`docs/active/epic/`) and
execution capacity (lisa, reading `docs/active/stories/` + `tickets/`).

Build only this slice. The DAG, open-model executors, and authoring-via-
conversation all generalize out of what this one hardcoded play forces us to make
real. Resist elaborating past it.

---

## What it does (purpose, not mechanics)

Given an epic — a statement of intent and value — the playbook produces a set of
**work units**, each one a piece of design value small enough to allocate to a
single autonomous session and trustworthy enough to run without a human in the
loop. The units are *justified by purpose and value first*: each says what it
advances and how we'll know it landed. They are *materialized* as lisa-valid
stories/tickets on the way out — but that formatting is a downstream poka-yoke,
not the point. The point is **effective allocation**: the right work, right-sized,
in the right order, worth doing now.

```
epic (intent + value)  ─┐
charter (value function)─┼─►  Decompose-Epic  ─►  work units (purpose-justified)  ─►  lisa
project state (go-and-see)┘        │                                                  executes
                                   └─ clears against THIS project, gates on value
```

## Shape

A single typed function, authored once:

```
DecomposeEpic(epic: Epic, charter: Charter, project: ProjectContext)
    -> WorkPlan        // an ordered set of work units, each carrying its purpose,
                       // its value (which P-invariant / epic outcome it serves),
                       // and how it will be known done
```

- **Render + parse via BAML** (authoring-only, the proven pattern): `b.request.
  DecomposeEpic(...)` renders the prompt from the typed inputs; the dispense runs
  it; `b.parse.DecomposeEpic(text)` SAP-parses the reply into `WorkPlan`. The
  output type makes shapeless work impossible by construction.
- **Dispense via `claude -p` on Bun** (the single metered seam): spawn `claude -p
  --output-format stream-json --verbose`, write the rendered prompt to stdin,
  read newline-delimited messages, stream each to `onMessage`. The terminal
  `result` carries `usage` / `total_cost_usd` / `subtype` — the budget signal and
  the countable log, kept by default so the consistency layer is later just
  reading data you already have.

## The clearing gates (andon — stop the line before bad work settles)

In priority of *value*, not of format:

1. **Value gate** — every unit names what it advances (an epic outcome or a
   charter invariant) and is grounded in real project state. A unit that advances
   nothing nameable, or is speculative, is refused. (Overproduction is the worst
   waste.)
2. **Allocation gate** — each unit is right-sized for one autonomous session and
   sequenced so capacity never stalls on a missing dependency. Mis-sized or
   mis-ordered work fails the clearing.
3. **Bounds gate** — no non-goal (`N1–N4`) is violated; no invariant is regressed
   to advance another; the epic's `advances` claims actually hold. This is where
   "tied to the vision" is *recomputed*, not stored.
4. **Structural poka-yoke** — only now: the materialized files parse and pass
   `lisa validate` (no cycles, dependency edges complete). The last fixture on the
   way out, not the standard of worth.

A failed gate **stops the line and says why** — it does not emit half-cleared
work. Stopping at authoring is cheap; bad work in nonstop execution is not.

## Budget as a hard contract

The run is allocated time/tokens up front and is accountable to them (P7). The
wall-clock guard kills a non-returning dispense; `result.usage` meters tokens.
Exhaustion is a hard stop with a clear andon, not a silent overrun.

## v0 scope — and where it stops

In: **one hardcoded epic-decompose play**, real `claude -p` dispense wired to the
budget, streamed to both surfaces, every run logged in a countable shape, gated as
above. Out (generalizes later, do not build yet): the multi-node DAG, the
open-model executor, conversational authoring, the read-side consistency layer.
The single lever must dispense something real first.
