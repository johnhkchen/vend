# T-054-01 Plan — pure-errored-outcome-unit

_Ordered, independently-verifiable steps. Testing strategy and done criteria._

## Step sequence

### Step 1 — add `"errored"` to `RUN_OUTCOMES`
- **File:** `src/log/run-log.ts`.
- **Do:** append `"errored"` to the `RUN_OUTCOMES` tuple literal (`:48`); add the
  one-clause doc note (`:37-47`) mapping `errored ← a thrown cast (E-054)`.
- **Verify:** `bun run build` (typecheck) stays clean — the union widens, no consumer
  breaks (Research confirmed no exhaustive switch). Full suite still green.
- **Commit:** atomic with Steps 2–3 (the value is inert without the helper + proof).

### Step 2 — add the `erroredSummary` helper + `NODE_ERRORED` const
- **File:** `src/engine/graph-core.ts`.
- **Do:** add the exported `NODE_ERRORED` const and the pure `erroredSummary(id: NodeId):
  RunSummary` helper with its doc comment (per Structure Edit 2). No new imports.
- **Verify:** typecheck clean (`NODE_ERRORED: RunOutcome = "errored"` requires Step 1).

### Step 3 — add the unit test
- **File:** `src/engine/graph-core.test.ts`.
- **Do:** extend imports (`decideThread` from `chain-core.ts`; `erroredSummary`,
  `NODE_ERRORED` from `graph-core.ts`; `RUN_OUTCOMES` from `run-log.ts`); add the
  `describe("erroredSummary …")` block with the four tests from Structure Edit 3.
- **Verify:** `bun test src/engine/graph-core.test.ts` — the new tests pass; the existing
  21 still pass.

### Step 4 — full gate + commit
- **Do:** run the project check gate (`bun run check` = baml:gen + typecheck + test, per
  project convention) and `bun run lint`.
- **Verify:** whole suite green, typecheck clean, lint clean.
- **Commit:** one commit `feat(T-054-01): add 'errored' RunOutcome + pure erroredSummary
  helper` covering all three files.

---

## Testing strategy

- **Unit only.** The whole ticket is a pure value + pure helper; it needs no integration
  or live-model test. The AC explicitly scopes the proof to "a graph-core unit test (no
  runner, no live model)".
- **What gets a unit test (Step 3):**
  - `erroredSummary` returns `outcome: "errored"`, `produced: undefined`,
    `materialized: false`, `actuals: undefined`, non-empty `runId` — the AC's "yields
    outcome 'errored' with produced undefined".
  - `decideThread(erroredSummary(id))` returns `{ proceed: false }` with a reason naming
    the non-success outcome — the AC's "decideThread refuses it … routes through the halt
    path unchanged".
  - Determinism: two calls with the same id are `toEqual` (guards T-054-03's later
    cross-runner equality); different ids differ in `runId`.
  - Constant↔tuple coherence: `RUN_OUTCOMES.includes(NODE_ERRORED)`.
- **What needs NO test here:** the runners (untouched — T-054-02 tests the try/catch
  wrapping); the ledger consumers (`walk-away`, `recalibrate` — total by construction,
  no behavior change); `assertOutcome`/`reviveRecord` (membership boundaries, covered by
  their own existing run-log tests, now accepting one more value with no branch added).

## Verification criteria (done = all true)

1. `RUN_OUTCOMES` contains `"errored"`; `RunOutcome` includes it (typecheck proves).
2. `erroredSummary(id)` is exported, pure, and returns the shape above.
3. The new unit tests pass; the existing graph-core suite (21) stays green.
4. `bun run build` (typecheck) and `bun run lint` are clean.
5. Full `bun test` suite is green (no regression in run-log / ledger / engine tests).
6. No runner code, no `RunSummary` shape, no `decideThread` changed (scope honored).

## Risks & mitigations

- **R1 — a hidden exhaustive `switch` on `RunOutcome` breaks the build.** Mitigation:
  Research grep found none (`: never` / `switch.*outcome` returned nothing relevant);
  Step 1's typecheck is the catch-all. If one surfaces, add the `errored` arm there.
- **R2 — `walk-away.ts`'s `OutcomeMix` snapshot tests assert an exact key set.**
  Mitigation: the mix is seeded from `RUN_OUTCOMES`, so a snapshot would gain an
  `errored: 0` key. Step 4's full-suite run surfaces any such test; the fix is to update
  the expected mix to include the zero-seeded key (a correct, mechanical update). Watch
  for this in Implement.
- **R3 — purity regression.** Mitigation: the helper takes only `NodeId`, returns a
  literal object; no fs/clock/random — trivially pure, asserted by the determinism test.

## Rollback

Single commit; `git revert` restores the prior tuple and removes the helper + test with
no migration needed (the ledger is append-only but no record was written with the new
value yet — the runners do not emit it until T-054-02).
