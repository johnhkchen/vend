# T-054-02 Plan — thread-throw-into-both-runners

_Ordered, independently-verifiable steps. Testing strategy. Commit boundaries._

## Testing strategy (up front)

- **Unit, pure, no live model.** All proof lives in `graph-core.test.ts` — the existing
  pure-function suite (imports only pure/type-only modules; no spawn, no native addon).
- **Per-runner.** The AC says "proven for both runGraph and runGraphConcurrent" — every
  behavioral assertion is made against EACH runner over the same spec shape.
- **Stub-throw, not real failure.** `throwingNode(id)` throws a synthetic `Error`; the
  runner must absorb it into `erroredSummary(id)`. No model, no I/O.
- **Four AC clauses, one spec.** A fan-out+cascade (A→{B(throws),C}, B→D) proves in one
  shape: errored entry (B), dependent skipped (D), sibling survives (C), promise resolves.
- **Regression gate.** `bun run check` must stay green (1210 baseline + the new tests).

## Step 1 — add the `throwingNode` test helper

- Edit `graph-core.test.ts`: add `throwingNode(id)` beside `neverNode` (~:48) with the
  intent comment distinguishing it from `neverNode`.
- **Verify:** `bun test src/engine/graph-core.test.ts` still 25 pass (helper unused yet,
  must not break compilation). Typecheck clean.
- Atomic-committable on its own, but will be committed WITH Step 4 (test-only change is one
  logical unit). No commit here.

## Step 2 — wire the catch into `runGraph` (Edit 1)

- Edit `graph-core.ts` `runGraph` cast site (~:232): declare `summary: RunSummary`, wrap
  the `await node.cast(...)` in `try/catch { summary = erroredSummary(id); }`. Downstream
  unchanged.
- **Verify:** `tsc --noEmit` clean (declare-then-assign typechecks; no use-before-assign).
  Existing 25 graph-core tests stay green (no behavior change for non-throwing specs).

## Step 3 — wire the catch into `runGraphConcurrent` (Edit 2)

- Edit `graph-core.ts` `runGraphConcurrent` cast site (~:462): wrap the
  `return [id, await node.cast(...)]` in `try/catch { return [id, erroredSummary(id)]; }`.
  Settle/debit loops unchanged.
- **Verify:** `tsc --noEmit` clean; existing 25 tests green (the conditional-edges
  cross-executor block at `:330` still passes — no throwing node there, so no behavior
  change).

## Step 4 — add the throw test block (Edit 4) and prove the AC

- Edit `graph-core.test.ts`: append the
  `describe("… a thrown cast becomes an 'errored' node … (T-054-02)")` block with the
  `mkSpec()` factory and the per-runner test cases from Structure §Edit 4:
  1. `runGraph`: B errored in `.nodes`; D skipped (reason names halted upstream B, errored);
     C present and cast with `{A:"pa"}`; outcome `errored`; halted true; the `await`
     returned (no reject).
  2. `runGraphConcurrent` (no wallet): same assertions; the wave resolved (Promise.all did
     not reject).
  3. Explicit "resolves, not rejects" for `runGraphConcurrent` via `.resolves`.
  4. Minimal `facets(seq) == facets(con)` sanity for the throwing spec (de-risks T-054-03;
     formal proof is that ticket).
- **Verify:** `bun test src/engine/graph-core.test.ts` — new tests pass; total rises from
  25 to ~29. Then `bun run check` — full suite green (≈1214), typecheck clean, baml clean.
- **Commit** (all of Steps 1-4 together — the wiring + its proof are one shippable unit):
  `feat(T-054-02): catch thrown casts into 'errored' summary in both graph runners`.

## Step ordering rationale

Steps 2 and 3 (source) are independent of each other and of Step 1 (test helper). Step 4
(the proving tests) depends on ALL of 1-3 being in place — a throw test would fail (the
runner would reject) until both catches exist. Hence one commit at the end: the repo is
never in a state where the new tests exist but fail. Intermediate `tsc`/existing-test
checks after each source edit catch a typo before the final run.

## Risks & mitigations

- **R1 — `summary` declared but a code path leaves it unassigned.** Both try and catch
  arms assign; TS control-flow analysis confirms. Mitigation: `tsc --noEmit` in Step 2.
- **R2 — bare `catch {}` flagged by lint.** Project has NO lint script (check gate is
  baml:gen + tsc + test, per T-054-01 obs). Bare catch is valid TS. No risk; if a future
  lint objects, `catch (_e)` is the trivial fix.
- **R3 — the concurrent catch placed OUTSIDE the `dispatch.map` thunk** would let
  `Promise.all` reject before the catch. Mitigation: the catch is INSIDE the async thunk
  (Structure Edit 2), so each thunk resolves; test #3 (explicit resolves) pins this.
- **R4 — an errored node accidentally debited under a budgeted wave.** `actualsDelta`
  returns `{0,0}` for `actuals === undefined`; errored summary omits `actuals`. Already
  correct; not re-tested here (T-054-01 covered the primitive; budget interaction is
  E-048's tested invariant). Noted, not actioned.
- **R5 — cross-contaminated `recordingNode.calls` when one spec is run through both
  runners.** Mitigation: `mkSpec()` builds FRESH nodes per call (existing pattern at
  `:362`), so seq and con each get their own closure state.

## Definition of done

- Both runners catch a thrown cast into `erroredSummary(id)`; neither propagates/rejects.
- New per-runner tests prove all four AC clauses; all pass with no live model.
- `bun run check` green; commit landed; progress.md + review.md written.
