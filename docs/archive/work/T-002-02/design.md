# T-002-02 — Design: the clearing gates

Decisions, with rejected alternatives, grounded in Research. The shape: a pure `clear()` that
runs four gates in value-order and **stops the line at the first failure** with a named reason.

---

## D1 — `clear()` is a pure function; gates own *meaning*, BAML owns *shape*

`clear(workPlan, { epic, charter }) -> GateResult`. Pure: no fs, clock, network, or process —
mirroring `budget.ts`. It receives an already-parsed `WorkPlan` (a value), so it never touches
the BAML native addon (Research: this is what lets the test be an ordinary pure-function test,
dodging the bun-test/BAML one-call limit). The gates check **only** what the type cannot
already guarantee: enum membership is BAML's job, so no gate re-checks `type/status/priority/
phase` *values* — they check the DAG, ref resolution, non-emptiness, and `advances` backing.

**Rejected:** having `clear()` itself call `b.parse` (take raw text). That would couple the gate
to the native addon, break the type-only dependency rule (AC4), and re-import the bun-test
flakiness for no gain. The runner parses; the gate judges the parsed value.

## D2 — One discriminated-union `GateResult`; **first-fail short-circuit** (true andon)

```ts
type GateResult =
  | { status: "clear";  cleared: GateName[] }                       // all four passed, in order
  | { status: "stop";   gate: GateName; unit: string; reason: string }; // the line stopped
```

A failed gate returns a `STOP` naming **gate + unit + why** (AC2, verbatim). `clear()` runs the
gates in value-order and returns the **first** STOP — it does not run later gates or accumulate
findings. This is the andon literally: "a failed gate **stops the line**." It also gives the
right *value-ordering* of diagnosis — a plan that both advances nothing (value) and is missing a
`phase` (structural) is reported as a **value** failure, because value is the higher-priority
defect (`playbook-decompose-epic.md`: "in priority of value, not of format").

**Rejected — accumulate all failures into a report.** Tempting for UX, but it contradicts
"stops the line" and would invert the value-ordering (a structural nit would appear co-equal
with an overproduction defect). The runner needs *one* reason to refuse and log; a list dilutes
the andon. Diagnosis-by-priority is the feature, not a limitation.

**Rejected — boolean + thrown error on failure.** `budget.ts` already established the house
rule: an *expected* terminal state (here, "this plan doesn't clear") is a **returned value**,
not an exception. Exceptions are reserved for *programmer* error (a malformed call). So a STOP
is data the runner switches on, exactly like `BudgetOutcome`.

## D3 — Naming: `GateResult` here is the **whole-plan** verdict; the runner translates

`run-log.ts` already declares a per-gate `GateResult { gate; passed; detail? }`. Mine is the
*clearing* verdict for the whole plan. The AC literally names the return type `GateResult`, so I
honor that — but I add `GateName` and an `isStop()` guard, and a header comment pointing at the
relationship: the runner maps a `clear`/`stop` verdict into one-or-more per-gate log records.
Different module, different import; no actual collision, but the comment prevents confusion.

## D4 — What each gate checks (the "honest but minimal" line)

The Context demands rule-based checks, "never judgment calls that belong to a human." So each
gate implements the **rule-checkable subset** of its charter responsibility and stops at the
first offending unit:

**Value gate** — for every ticket: `advances` is a non-empty array of non-empty strings
(it *names* what it advances); `doneSignal` is non-empty and **not a restatement of the title**
(normalized-equality check — the cheap, real slice of "distinguishable from merely done");
`purpose` is non-empty. **And** the plan has ≥1 ticket — a zero-ticket plan is the MALFORMED
empty-degradation case (Research / T-002-01 Concern 2): it advances nothing, so it STOPs here.
Offending unit = the ticket id, or `"<plan>"` for the empty-plan stop.

**Allocation gate** — the dependency graph is a DAG with all refs resolving:
- ticket ids are unique (a dup makes every reference ambiguous → unallocatable);
- every `depends_on` id resolves to a ticket in this plan;
- no cycle (capacity would deadlock — a cycle is the purest "stalls on a missing dependency");
- every `story.tickets` id resolves to a ticket (the ordering index must be real).
"Right-sized for one session" is human judgment — explicitly *not* rule-checked; the DAG is the
checkable core. Offending unit = the ticket/story id at the broken edge (cycle reports one node
on the cycle).

**Bounds gate** — `advances` claims are backed (the charter's own "detectable defect" rule):
derive the valid invariant-id set by grepping `P<n>` out of the `charter` string at call time;
for every ticket, any `advances` entry matching `^P\d+$` **must** be in that set (a dangling
`P9`/retired `P8` STOPs), and any entry matching `^N\d+$` is itself a violation (you cannot
*advance a non-goal*). Free-text entries (epic-outcome prose — Research: epics carry no
grep-able outcome ids) are **not** failed: they are human-judgment territory. "No non-goal
violated" beyond the N-ref check is judgment and stays with the human. Offending unit = ticket id.

**Structural gate** — every `TicketDraft` carries all required lisa frontmatter fields, present
and non-empty: `id`, `story`, `title`, `type`, `status`, `priority`, `phase`, and `depends_on`
is an array. This is the "last fixture on the way out" — it runs *after* the value/allocation/
bounds judgments, exactly as the playbook orders it ("only now"). Offending unit = ticket id +
the missing field.

## D5 — Derive valid invariant ids from the charter string, don't hardcode

The charter says alignment is "a gate, not stored prose… retire an invariant and a one-line grep
finds every dangling `advances` ref." So the bounds gate computes `invariantIds(charter)` by
matching `\bP\d+\b` over the passed `charter` string. Hardcoding `{P1…P7}` in `gates.ts` would
be exactly the "stored prose" the charter warns against — it would silently drift when an
invariant is retired. Grepping the live charter makes a dangling ref a *detectable defect* by
construction, which is the whole point. Same for `N\d+` non-goals.

**Rejected — hardcode `const INVARIANTS = ["P1".."P7"]`.** Drifts the moment the charter is
amended; defeats the charter's anti-rot mechanism. The charter string is already in hand
(it's a `clear()` argument) — grep it.

## D6 — Validation vs. andon split (house rule from `budget.ts`)

A *programmer* error — `clear()` called with a non-object `workPlan`, or `epic`/`charter` not
strings — `throw`s a `TypeError`/`RangeError` at the boundary (loud, like `budget.ts`'s
`assertPositiveInt`). A *plan* that simply doesn't clear is a returned `STOP`. The distinction:
the caller wiring is wrong (throw) vs. the model's output is unworthy (the expected andon,
returned). The gates never throw on bad *plan content* — that's what STOP is for.

## D7 — File layout: one module, no helper sprawl

Everything in `src/gate/gates.ts`: the types (`GateName`, `GateResult`, `ClearContext`,
`isStop`), four private gate functions `(plan, ctx) => Omit<GateStop,"status"> | null`, a small
private DAG/grep helper set, and the public `clear()` that sequences them. One file matches the
sibling modules (`budget.ts`, `run-log.ts` are each single files) and keeps the AC's "exports
`clear`" trivially true. Tests live in `src/gate/gates.test.ts`.

## Integration contract (for T-002-03, not built here)

The runner: `b.parse` → `WorkPlan`; `clear(plan, { epic, charter })`; on `stop`, log
`outcome: "gate-failed"` with the gate/unit/reason and **do not materialize**; on `clear`,
proceed to the materializer. `run-log.ts` already has the `gate-failed` outcome and a per-gate
`GateResult` slot — this design slots straight in.
