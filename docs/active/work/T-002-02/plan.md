# T-002-02 — Plan: ordered implementation steps

Small, independently-verifiable steps. Verification gate throughout: `bun run check` (runs
`baml:gen` → `tsc --noEmit` → `bun test`). Each step is committable; commit after the suite is
green (project convention leaves the `git commit` to lisa, but progress is tracked per step).

## Testing strategy

- **Unit only**, pure module — no integration test needed (no fs/network/process; `budget.ts`
  set this precedent). All branches covered with fabricated `WorkPlan` fixtures (AC3).
- **Every gate: ≥1 passing + ≥1 failing fixture**, plus the value-ordering/short-circuit case
  and the programmer-error throws.
- **No BAML native call in the test** → no subprocess bridge, type-only client imports
  (defuses T-002-01 Concern 1). This is itself a thing to verify: the suite must be green
  deterministically across repeated runs, not 1-in-5 flaky.
- Verification criteria per AC: (1) `clear` exists with the right signature; (2) a failed gate
  returns a STOP naming gate+unit+why; (3) passing & failing fixtures all green; (4) only
  `baml_client` types imported — grep the import list to confirm no seam/budget/log import.

## Steps

### Step 1 — Module skeleton + public types
Write the header comment and the public surface of `gates.ts`: `GATE_NAMES`, `GateName`,
`ClearContext`, `GateStop`, `GateClear`, `GateResult`, and stub `clear()`/`isStop()`. Type-only
import of `WorkPlan`/`TicketDraft`/`StoryDraft` from `baml_client`.
**Verify:** `bun run check:typecheck` clean; the type-only import erases (no addon load).

### Step 2 — Boundary guards + pure helpers
Add `assertPlan`, `assertContext` (throw on programmer error), and `nonEmpty`,
`normalizeTitle`, `idSetOf`, `matchIds`, `findCycle`. Pure, no side effects.
**Verify:** typecheck clean; helpers exercised indirectly by later gate tests (a couple of
direct micro-tests for `findCycle`/`matchIds` if useful).

### Step 3 — `valueGate`
Empty-plan (zero tickets) → offense `<plan>` "plan advances nothing (malformed/empty)". Per
ticket: `advances` non-empty array of non-empty strings; `doneSignal` non-empty and
`normalizeTitle(doneSignal) !== normalizeTitle(title)`; `purpose` non-empty. First offense wins.
**Verify:** new `valueGate` tests pass (empty plan, empty advances, doneSignal==title, empty
purpose, and a passing fixture).

### Step 4 — `allocationGate`
Duplicate ticket id; every `depends_on` ref resolves to a ticket id; `findCycle` returns null;
every `story.tickets` ref resolves. First offense → unit = offending id.
**Verify:** allocation tests pass (missing dep, 2-cycle, duplicate id, dangling story ref,
passing DAG).

### Step 5 — `boundsGate`
`invariantIds = matchIds(charter, "P")`, `nonGoalIds = matchIds(charter, "N")`. Per ticket, per
`advances` entry: `^P\d+$` must be in `invariantIds` else offense (dangling ref); `^N\d+$` →
offense (cannot advance a non-goal); otherwise pass (free-text). First offense → unit = ticket id.
**Verify:** bounds tests pass (`P9` dangling, `N1` rejected, free-text allowed, valid `P1`).

### Step 6 — `structuralGate`
Per ticket: `id`, `story`, `title`, `type`, `status`, `priority`, `phase` non-empty strings and
`depends_on` is an array. First missing field → offense naming the field. (Enum *values* are not
re-checked — BAML owns that; only presence/non-emptiness.)
**Verify:** structural tests pass (empty `phase`, empty `story`, passing fixture).

### Step 7 — `clear()` sequencing + `isStop()`
Wire the ordered gate table `[["value", valueGate], …]`; run `assertPlan`/`assertContext`, then
first non-null offense → STOP; else CLEAR with `cleared: [...GATE_NAMES]`. Implement `isStop`.
**Verify:** happy-path → clear; value-ordering case (fails value+structural → reports value);
programmer-error inputs throw; `isStop` narrows. Full `bun run check` green.

### Step 8 — Determinism + AC sweep
Run `bun run check` 3× to confirm no BAML-runner flakiness leaked in. Grep `gates.ts` imports to
confirm only `baml_client` is imported (AC4). Re-read AC1–AC4 against the code.
**Verify:** 3/3 green; import audit clean; every AC has a corresponding test.

## Risks & mitigations

- **Enum literals in fixtures load the addon.** Mitigation: follow `decompose.test.ts` — cast
  string-literal member names `as DraftType` under type-only imports; never value-import `b`.
  Verify by repeated-run determinism (Step 8).
- **`noUncheckedIndexedAccess` (tsconfig) on fixture array access.** Mitigation: guard with `!`
  or length checks in tests, as the sibling tests do.
- **Over-reaching into judgment.** Mitigation: each gate's failing tests assert *only* the
  rule-checkable offenses; a free-text-`advances` test pins that bounds does **not** over-fail.
- **`GateResult` name collision with run-log.** Mitigation: header comment + distinct import
  path; they never meet in one file.
