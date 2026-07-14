# T-002-02 — Review: the clearing gates

Handoff. What changed, how it's tested, what a reviewer should scrutinize, and the open concerns
for the runner (T-002-03).

## Gate status

`bun run check` → **exit 0**: `baml:gen` (14 files) → `tsc --noEmit` clean → `bun test`
**87 pass / 0 fail / 173 expect()**, ~122 ms. **Deterministic over 3 consecutive runs** (the
BAML/bun-test one-call limit does not apply — see Test architecture).

## What changed

| Action | File | Notes |
|---|---|---|
| create | `src/gate/gates.ts` | the four value-ordered gates + `clear()` + `isStop()`; pure module |
| create | `src/gate/gates.test.ts` | 19 tests over fabricated `WorkPlan` fixtures (passing + failing) |

No other file touched. `package.json`, `tsconfig.json`, and every sibling `src/` module are
untouched; `src/gate/.gitkeep` left in place. **The only import in `gates.ts` is a type-only
`baml_client` import** — disjoint from the seam, budget, and log (AC4, audited by grep).

## Acceptance criteria — all met

- **AC1 ✓** `src/gate/gates.ts` exports `clear(workPlan, { epic, charter }) -> GateResult`,
  running the four gates **in order**:
  1. **value** — every ticket has a non-empty `purpose`, a non-empty `advances[]` of non-empty
     entries, and a `doneSignal` that is non-empty and not a restatement of the title. A
     zero-ticket plan is classified MALFORMED here (the SAP empty-degradation case).
  2. **allocation** — ticket ids unique; every `depends_on` resolves; the graph is a DAG (cycle
     detection); every `story.tickets` ref resolves.
  3. **bounds** — every `advances` entry shaped like `P\d+` resolves to an invariant in THIS
     charter (dangling ref → STOP); any `N\d+` (advancing a non-goal) → STOP; free-text entries
     pass the rule.
  4. **structural** — every `TicketDraft` carries all required lisa frontmatter (`id`, `story`,
     `title`, `type`, `status`, `priority`, `phase`) non-empty, and `depends_on` is an array.
- **AC2 ✓** A failed gate returns `{ status: "stop", gate, unit, reason }` — naming the gate, the
  offending unit (ticket/story id, or `"<plan>"`), and why. `isStop()` lets the runner branch
  (`if (isStop(r)) refuse`); on a STOP the runner must not materialize. The CLEAR verdict is
  `{ status: "clear", cleared: [...GATE_NAMES] }`.
- **AC3 ✓** Fully unit-tested: a passing fixture per gate plus failing fixtures for each rule
  (empty plan, empty/blank advances, doneSignal==title, empty purpose, unresolved/cyclic/dup
  deps, dangling story ref, `P9` dangling, `N1` non-goal, missing structural fields), plus the
  value-ordering short-circuit and the programmer-error throws.
- **AC4 ✓** Depends only on `baml_client` types — no seam/budget/log import (grep-audited).

## Design decisions worth a reviewer's eye

- **First-fail short-circuit, in value-order (the andon).** `clear()` returns the FIRST gate's
  STOP — it does not accumulate. A plan that both advances nothing (value) and is missing a field
  (structural) is reported as a **value** failure. This is deliberate: "stops the line… in
  priority of value, not of format" (`playbook-decompose-epic.md`). Verify you agree diagnosis
  should be by priority rather than a flat list. A test pins this ordering.
- **Bounds gate greps the LIVE charter, doesn't hardcode `{P1..P7}`.** The charter says alignment
  is "a gate, not stored prose… retire an invariant and a one-line grep finds every dangling
  `advances` ref." So `matchIds(ctx.charter, "P")` derives the valid set at call time. Retiring an
  invariant therefore makes a dangling ref a *detectable defect* by construction. Scrutinize: this
  trusts the charter string passed by the runner to be the real charter.
- **"Honest but minimal" boundary.** Each gate implements only the **rule-checkable subset** and
  explicitly does **not** over-reach into human judgment: "right-sized for one session" is not
  checked; free-text `advances` (epic-outcome prose, which has no grep-able id) is **not** failed
  — a dedicated test pins that bounds does not over-fail it. This is the line the ticket Context
  drew ("never judgment calls that belong to a human").
- **Enum values are not re-checked — only presence.** BAML owns shape (the four closed sets are
  enums; an out-of-set value is unrepresentable), so the structural gate checks fields are
  *present and non-empty*, never that `status` is a valid member. Re-checking would duplicate the
  type. This is the shape/meaning split from `decompose.baml`.
- **Throw vs. STOP split (from `budget.ts`).** A programmer error (non-object plan, non-string
  context) throws `TypeError`; an unworthy plan is a returned STOP. The gates never throw on bad
  plan *content*.

## Test architecture — the BAML/bun-test limit does NOT bite here

T-002-01's Concern 1 (the BAML native addon completes only one native call per `bun test`
process, forcing a subprocess bridge) **does not apply to this ticket**: `clear()` makes no BAML
call — it judges an already-parsed `WorkPlan` value. So `gates.test.ts` imports `baml_client`
**type-only** (erased under `verbatimModuleSyntax`), builds fixtures as plain objects with enum
member-name string literals cast to the erased enum types, and calls `clear()` directly. No
bridge, no native load — confirmed by 3/3 deterministic green runs. Any future *pure* consumer of
`WorkPlan` can follow this same pattern; only modules that actually call `b.*` need the bridge.

## Test coverage

- **Happy path** — a valid two-ticket plan with a real `depends_on` edge clears all four gates;
  `cleared` equals `GATE_NAMES`.
- **Per-gate failing fixtures** — listed under AC3; each asserts `gate`, `unit`, and a `reason`
  substring.
- **Value-ordering** — a plan failing value AND structural reports value.
- **Narrowing/guards** — `isStop` narrows; `clear(null, …)` and non-string context throw
  `TypeError`.
- **Gap (acceptable):** the gates are tested in isolation, not wired through a runner (T-002-03)
  or a live `b.parse` round-trip (T-002-04) — out of scope. No property-based/fuzz testing of the
  DAG checker; the cycle test is a single 2-node back-edge (the algorithm is standard DFS, but a
  reviewer wanting more could add a longer-cycle and a diamond-DAG case).

## Open concerns / handoff to T-002-03 (the runner)

1. **STOP ⇒ do not materialize; log `gate-failed`.** The runner must call `clear(plan, { epic,
   charter })` after `b.parse`, and on `isStop(r)` refuse to materialize and write a run-log
   record with `outcome: "gate-failed"`. `run-log.ts` already has that outcome and a per-gate
   `GateResult { gate; passed; detail? }` slot — translate this whole-plan STOP into a log row
   (e.g. `{ gate: r.gate, passed: false, detail: r.reason }`). **Two distinct `GateResult` types
   exist** (this module's whole-plan verdict vs. run-log's per-gate record) — the runner is the
   translator; don't confuse them.
2. **Empty plan is a `value` STOP, not an exception.** The runner gets a clean, named refusal for
   the SAP empty-degradation case — it must not separately special-case empty before calling
   `clear()` (that would duplicate the gate). Just call `clear()` and honor the STOP.
3. **Charter/epic strings must be the real ones.** The bounds gate's "dangling ref" detection is
   only as honest as the `charter` string handed in. The runner should pass the same charter text
   fed to `DecomposeEpic` (e.g. read `docs/knowledge/charter.md`), not a paraphrase.
4. **Epic-outcome refs are unvalidated by design.** Because epics carry no grep-able outcome ids,
   a free-text `advances` entry passes the bounds rule. If/when epics gain stable outcome ids,
   extend `boundsGate` to grep the `ctx.epic` string too (the hook is already there — `epic` is
   in `ClearContext` and currently used only for context).

## Not done by design

No runner/materializer/CLI (T-002-03), no live dispense (T-002-04). No `git commit` — files left
for lisa per project convention.
