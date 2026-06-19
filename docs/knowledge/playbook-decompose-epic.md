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

## The decomposition rule-set (the *build* spec)

The gates above are the **verify** spec — what the output must satisfy. These are
the **build** spec — the rules the play applies to *produce* the `WorkPlan`. They
are **extracted from the by-hand decompositions** of E-001, E-004, E-005 and the
E-006 survey, not invented (`playbooks/project-steering.md`: hand-drafting is
authoring the play by demonstration). Each rule pairs with the gate that checks it.

**Shape**
- **R1 — Pure core before integration.** Split a unit into a pure, addon-free,
  fully-tested core (the testable heart) and a thin integration that wires it in.
  *(E-001 seam/budget/log; E-004 `detectCollisions` → `materialize`.)* → allocation gate.
- **R2 — One ticket = one atomically committable change.** Bounded scope,
  independently verifiable; no "and also" sprawl. → allocation gate.
- **R3 — Foundation first.** Types / scaffold / shared modules are early DAG roots
  that dependents build on. *(E-001 `T-001-01` scaffold gates all.)* → allocation gate.

**Dependencies**
- **R4 — File ownership → an edge.** Two units that edit the same file get a
  `depends_on` (the critical lisa rule); the commit lock is a safety net, not a
  substitute. *(E-005 `T-005-01` ↔ `T-004-02`, both on `decompose-epic.ts`.)*
  → structural + allocation gate.
- **R5 — Otherwise maximize concurrency.** Disjoint files + satisfied deps run in
  parallel; add no spurious edges. *(E-001 wave-1: seam/budget/log/baml.)* → allocation gate.

**Identity**
- **R6 — Ids disjoint from the live board, narrowest namespace that achieves it.**
  Epic-scoped story ids (`S-<epic>-<n>`); drop to **story-scoped** ticket ids
  (`T-<story>-<n>`) when the epic number is already taken. *(F1; E-002 — E-001's
  `S-002` had already consumed `T-002-NN`, forcing `T-002-01-NN`. The rule E-004 now
  enforces in code.)* → structural gate + the E-004 materialize guard.

**Value & justification**
- **R7 — Value-link every unit.** Each names what it `advances` (a charter
  invariant or the epic outcome); advances nothing nameable → refuse. → value gate.
- **R8 — A verifiable done-signal.** Acceptance criteria distinguish *done* from
  *done right* — a check, a test, an observable. → value gate.

**Harness-readiness**
- **R9 — Cite sources; carry runnable context.** Point at the real files / docs /
  reference implementations a unit needs (e.g. `mc-design-eval/sdk-binding` for the
  seam); it must run without the author in the loop. *(E-001 tickets cited the
  reference.)* → no machine gate yet; the harness-readiness / human-amplifier check.

**Process-fit (upstream of decomposition)**
- **R10 — Match work-type to executor.** Code-*permanents* → lisa RDSPI tickets; a
  one-shot planning *sorcery* → a dispense, not a lisa ticket (else RDSPI friction +
  no run-log). *(F4.)* → a steering-layer routing choice, not a gate.

**Risk isolation (earned in E-002)**
- **R11 — Isolate andon-prone steps.** Put external-dependency, human-gated, or
  irreversible steps in their *own* ticket, so the deterministic build completes
  cleanly and the risky bit is a discrete, surfaceable unit. *(E-002: the Docker-gated
  `dagger call` verify is its own ticket `T-002-01-03`; the `dagger develop` caution
  is flagged, not buried.)* → a harness-readiness / andon-surfacing check, not a gate.
- **R12 — Shared-contract-first.** When a unit introduces a contract multiple
  consumers invoke, make *establishing that contract* the foundation ticket.
  *(E-002's `check:test` is run identically by standalone / play / CI — the Central
  Rule, "Dagger invokes, never defines," is this as architecture.)* → allocation gate.

**This list is the spec, and it grows exactly as the mechanism predicts** (E-002 alone
added R11/R12 and refined R6). Each new hand-decomposition either *confirms* a rule or
*adds* one; when it stops changing, the play is spec-complete — the TPS "standard
stabilized → ready to systematize" signal. Three rules have **already graduated from
doc to code** (R6 → E-004's id-guard; R4 → the file-overlap edge; R11 → the isolated
Docker verify), the bridge from "we keep doing this by hand" to "the play does it."

## Budget as a hard contract

The run is allocated time/tokens up front and is accountable to them (P7). The
wall-clock guard kills a non-returning dispense; `result.usage` meters tokens.
Exhaustion is a hard stop with a clear andon, not a silent overrun.

**The envelope is measured, not guessed** *(learned 2026-06-19)*. The up-front
allocation is only honest if it reflects the play's *actual* cost. Decompose's first
envelope (50k tokens) was a cold-start **guess**; the E-014/E-015 probes measured its use
as **bimodal — lean runs <50k, real-work runs ~85–94k** — so it was recalibrated
**50k→120k** to clear the upper tail with headroom. *A guessed-too-thin envelope
false-andons legitimate work* (8/10 probe runs budget-exhausted at 50k while finishing
fine). The discipline (E-013 / IA-12): set the envelope from the run-log's **measured
tails at the value-tier percentile**, not a number someone picked. And separate the two
fat-tail *causes* — **genuine cost** → recalibrate the envelope up; **agentic wandering**
→ cap it with `--max-turns` (E-015). A `--max-turns` cap that *doesn't move the tail*
proves the cost is genuine, not sprawl — **measurement, not assumption, picks the lever.**

## The clearing cycle — where this play feeds back *(learned 2026-06-19)*

Decompose-Epic is one **stage of a self-improving loop**, not a terminal step. Its
run-log actuals flow back into the system that sized and steered it:

```
demand → propose → DECOMPOSE → lisa builds → run-log (actuals) ─┐
   ▲                  ▲                                          │
   │                  └──── recalibrated envelope (E-013/IA-12) ◄┘   (guess → measured)
   └──── evidence gate (E-014): do the gates actually deliver? ◄──── ledger
```

- **The envelope recalibrates from the play's own history** (E-013/IA-12): actuals →
  measured percentile → the next cast's pre-filled budget. The guess→measured graduation
  is the budget-side sibling of the rule-set's doc→code graduation.
- **An evidence gate can hold the line *above* the play** (E-014): the gates here
  *produce* gated work; the ledger measures whether they *deliver*. Gate-driven
  output-variance reduction measured at **~21%** (real, modest); walk-away trust returned
  **HOLD**, parking downstream autonomy (the macro-wallet) until measured. The gate doesn't
  only stop a bad *unit* — it can stop a bad *roadmap*.
- **The rule-set has stabilized.** Three further hand-decompositions this round
  (E-013/E-014/E-015) **confirmed R1–R12 and added none** — the TPS *standard-stabilized →
  ready-to-systematize* signal. With the build rules stable **and** the envelope now
  measured, the play is close to the **automated cycle**: steer → propose → decompose →
  build → measure → recalibrate, with the human at the **forks** (assent), not the keyboard
  (articulation) — the `clearing-dynamics.md` collapse to *author + assent*.

## v0 scope — and where it stops

In: **one hardcoded epic-decompose play**, real `claude -p` dispense wired to the
budget, streamed to both surfaces, every run logged in a countable shape, gated as
above. Out (generalizes later, do not build yet): the multi-node DAG, the
open-model executor, conversational authoring, the read-side consistency layer.
The single lever must dispense something real first.
