# T-002-02 — Research: the clearing gates

Descriptive map of what exists and what this ticket touches. No solutions here — that is
Design's job. The ticket: `src/gate/gates.ts` exporting `clear(workPlan, { epic, charter })
-> GateResult`, running the four value-ordered gates (value → allocation → bounds →
structural) over a BAML-parsed `WorkPlan`, stopping the line on the first failure.

## Where this sits in the design

The charter calls Vend "a clearing house for tasks" whose **gates are the guarantee**:
nothing settles into execution that hasn't cleared (P3). `playbook-decompose-epic.md`
names four gates "in priority of *value*, not of format":

1. **Value** — every unit names what it advances and is grounded; overproduction refused.
2. **Allocation** — right-sized for one session, sequenced so capacity never stalls.
3. **Bounds** — no non-goal violated, no invariant regressed; `advances` claims actually hold.
4. **Structural poka-yoke** — only now: the materialized files parse / pass `lisa validate`.

"A failed gate **stops the line and says why** — it does not emit half-cleared work." This is
the andon. T-002-02 builds the rule-checkable core of those four gates over the typed
`WorkPlan`; the judgment-heavy parts stay with the human (the gates keep them "honest but
minimal," per the ticket Context).

## The input type: `WorkPlan` (from T-002-01, generated)

`baml_client/types.ts` (generated; `@ts-nocheck`, gitignored, rebuilt by `bun run baml:gen`)
defines the shapes this ticket consumes:

- `WorkPlan { stories: StoryDraft[]; tickets: TicketDraft[] }` — both arrays positional;
  array order *is* presentation/execution order (no index field).
- `TicketDraft` — eight lisa frontmatter fields (`id`, `story`, `title`, `type`, `status`,
  `priority`, `phase`, `depends_on`) **plus** vend's value triplet (`purpose`, `advances[]`,
  `doneSignal`).
- `StoryDraft` — `id`, `title`, `type`, `status`, `priority`, `tickets[]`.
- `DraftType` / `DraftStatus` / `DraftPriority` / `DraftPhase` — TS string enums whose members
  are PascalCase (`Task`, `InProgress`, `Ready`…). `b.parse` returns the **member name**, not
  the lisa-token alias; the alias→token map is the materializer's job (T-002-03), not ours.

What this buys the gates: **BAML owns shape; gates own meaning** (stated verbatim in
`decompose.baml` lines 11–12). The four closed enum sets are already guaranteed valid by
construction — an out-of-set `status` is unrepresentable. So the gates must *not* re-check enum
membership; they check **semantics** the type cannot: does the dependency graph form a DAG, do
`advances` refs resolve, is the plan non-empty.

## The critical hazard inherited from T-002-01

`decompose.baml` header (lines 14–17) and T-002-01's `review.md` (Concern 2) both flag it, and
a test pins it: **`WorkPlan` is an all-array class, so the SAP parser never REJECTS — a
malformed model reply degrades to an EMPTY `WorkPlan` (`stories: []`, `tickets: []`) rather
than throwing.** `b.parse` alone cannot classify this. The explicit handoff:

> "T-002-02's value gate / T-002-03's runner must classify an empty plan as MALFORMED (it
> advances nothing)."

So the value gate must treat a zero-ticket plan as a STOP. This is a hard requirement carried
across the DAG edge, not an edge case I get to choose.

## The value function: `charter.md` (what "in-bounds / advances" means)

The charter is the indexed spine the gates check against:

- **Invariants P1–P7** (stable ids): P1 author-once, P2 two-gesture run, P3 gates-are-contract,
  P4 autonomy, P5 local-first, P6 executor-agnostic, P7 budget-hard-contract.
- **Non-goals N1–N4**: N1 not-a-chat-copilot, N2 not-a-dashboard, N3 not-a-one-off-runner,
  N4 not-an-executor.
- The charter's own words on how alignment is checked (lines 92–100): *"The playbook recomputes
  alignment at decompose time… The link is a **gate, not stored prose** — so it can't go stale.
  Retire an invariant and a one-line grep finds every dangling `advances` ref: a **detectable
  defect**, not silent rot."*

That sentence is a near-spec for the bounds gate: the set of valid invariant ids is **derived
from the charter string at clearing time**, not hardcoded — so a ticket claiming `advances:
["P9"]` (or a retired `P8`) is caught as a dangling ref. The signature `clear(workPlan, { epic,
charter })` passes `epic` and `charter` as the *same strings* fed to `DecomposeEpic` — the raw
material to grep for valid ids.

## The epic format: `docs/active/epic/E-001.md`

Frontmatter `id`, `title`, `status`, `advances: [P1, P3, P7]`, `serves`. Body has prose
("Done looks like" bullets) but **no stable per-outcome ids** (no `O1`/`E-001-O1`). Implication
for the bounds gate: "epic outcomes" are free-text, not grep-able ids. So `advances` entries
that look like invariant ids (`P<n>`/`N<n>`) are rule-checkable against the charter; other
free-text entries are human-judgment territory and must not be failed by a rule.

## Sibling modules — the house style to match

- `src/budget/budget.ts` (T-001-03): **pure** (no fs/clock/network/process), declares its input
  shapes locally to avoid coupling, distinguishes *programmer error* (`throw RangeError`) from
  *expected andon* (returns a typed outcome value). The exhaustion andon is **data, not an
  exception** — a returned discriminated union carrying the numbers the runner logs.
- `src/log/run-log.ts` (T-001-04): also pure-core; notably already declares a local
  `GateResult { gate: string; passed: boolean; detail?: string }` — the **per-gate** verdict the
  runner forwards to the log. My `clear()` returns the **whole-plan** clearing verdict; the
  runner is the translator between the two. Names must not collide confusingly.
- `RUN_OUTCOMES` includes `"gate-failed"` — the run-log already has a slot for a gate STOP.
  Confirms the integration contract: runner runs `clear()`, on STOP logs `gate-failed` and does
  not materialize.

## The bun-test / BAML constraint (does it bite here?)

T-002-01 review Concern 1: the BAML native addon completes only **one** native call per
`bun test` process; value imports of the generated client into a test process reintroduce
flakiness. **This ticket dodges it entirely**: `gates.ts` calls *no* BAML function — it operates
on an already-parsed `WorkPlan` value. So `gates.ts` and its test import `baml_client` types
**type-only** (`import type`, erased under `verbatimModuleSyntax`), construct fixtures as plain
objects, and call `clear()` directly. No subprocess bridge, no native addon, no flakiness. This
is the decisive reason the gate tests can be ordinary pure-function tests.

## Constraints pinned by the AC

- Depends **only** on `baml_client` types — no seam (`executor`), no `budget`, no `log` imports.
  (`gate/` currently holds only `.gitkeep`.) The DAG edge `depends_on: [T-002-01]` must stay
  honest: type-only import of `WorkPlan` is the single allowed dependency.
- Output: a `GateResult` that, on failure, is a `STOP` naming **gate + offending unit + why**;
  "the runner must not materialize on a `STOP`."
- Fully unit-tested with passing and failing `WorkPlan` fixtures.

## Open questions carried into Design

1. Exact shape of `GateResult` (single discriminated union? accumulate vs. first-fail?).
2. How much of each gate is rule-checkable vs. human judgment — where to draw the "honest but
   minimal" line the Context demands.
3. The DAG check algorithm and what "all refs resolve" spans (depends_on only, or also
   `story.tickets` / `ticket.story`).
