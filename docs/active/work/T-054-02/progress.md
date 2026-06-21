# T-054-02 Progress — thread-throw-into-both-runners

_Implementation log. What was done, verification, deviations._

## Status: COMPLETE — all plan steps executed, gate green, committed.

Commit: `f25d81c` — `feat(T-054-02): catch thrown casts into 'errored' summary in both graph runners`.

## Steps executed

### Step 1 — `throwingNode` test helper ✅
- `src/engine/graph-core.test.ts` — added `throwingNode(id)` beside `neverNode`, with the
  intent comment distinguishing it (its throw is the stimulus the runner must ABSORB, not
  an assertion that it was never called).

### Step 2 — catch in `runGraph` (Edit 1) ✅
- `src/engine/graph-core.ts` `runGraph` cast site — declared `let summary: RunSummary;` and
  wrapped `await node.cast(upstreams)` in `try/catch { summary = erroredSummary(id); }`.
  Everything from `summaries.set(id, summary)` onward is unchanged. 4-line comment explains
  the throw→errored→existing-halt-path routing.

### Step 3 — catch in `runGraphConcurrent` (Edit 2) ✅
- `src/engine/graph-core.ts` `runGraphConcurrent` cast site — wrapped the
  `return [id, await node.cast(upstreams)]` INSIDE the `dispatch.map` async thunk in
  `try/catch { return [id, erroredSummary(id)] as const; }`. Placing the catch inside the
  thunk is load-bearing: `Promise.all` sees a RESOLVED member, so the wave never rejects.
  Settle + debit loops unchanged.

### Step 4 — throw test block (Edit 4) + prove the AC ✅
- `src/engine/graph-core.test.ts` — appended
  `describe("a thrown cast becomes an 'errored' node, dependents skip, siblings survive (T-054-02)")`
  with a fresh-per-call `mkParts()` factory (A→{B(throws),C}, B→D) and 4 tests:
  1. `runGraph` — full AC assertion via shared `assertAc`.
  2. `runGraphConcurrent` — same `assertAc` (the wave did not reject).
  3. `runGraphConcurrent` RESOLVES — explicit `.resolves.toBeDefined()` pinning AC#4.
  4. `facets(seq) == facets(con)` for the throwing spec — de-risks T-054-03.

## Verification against AC

> Per-runner tests with a stub throwing thunk: the throwing node appears as an 'errored'
> entry in GraphResult.nodes, its transitive dependents land in `skipped` with a recorded
> reason, an independent sibling node still completes, and the runner promise RESOLVES to a
> clean GraphResult (never rejects) — proven for both runGraph and runGraphConcurrent with
> no live model.

- ✅ **'errored' entry in `.nodes`** — `r.nodes.get("B")?.outcome === "errored"`, both runners.
- ✅ **Dependent in `skipped` with a recorded reason** — D absent from `.nodes`, present in
  `.skipped` with `blockedBy` ⊇ `["B"]` and reason containing `halted upstream` + `errored`.
- ✅ **Independent sibling completes** — C present in `.nodes`, cast with `{A:"pa"}` (its
  real JOIN), surfacing leaf `{C:"pc"}`.
- ✅ **Promise RESOLVES, never rejects** — the `await` returning a `GraphResult` proves it
  for both; test #3 pins the concurrent path explicitly via `.resolves`.
- ✅ **Both runners** — every clause asserted against each; test #4 shows their facets equal.
- ✅ **No live model** — pure stubs (`throwingNode`/`recordingNode`/`neverNode`); the file
  imports only pure/type-only modules; no spawn, no native addon.

## Gate results

- `bun test src/engine/graph-core.test.ts` → **29 pass / 0 fail** (was 25; +4 new).
- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) → **1214 pass / 0 fail** (was
  1210; +4), typecheck clean, baml generated clean.
- Pre-commit hook (`check-precommit.ts`) → tests green.

## Deviations from plan

**None.** The plan's risks did not materialize:
- R1 (use-before-assign) — both try/catch arms assign `summary`; `tsc` clean.
- R2 (bare-catch lint) — no lint script in the project; bare `catch {}` is valid TS.
- R3 (concurrent catch misplaced) — catch is inside the thunk; test #3 confirms resolve.
- R5 (recordingNode cross-contamination) — `mkParts()` builds fresh nodes per call.

## Notes for downstream (T-054-03)

- The throwing spec already produces byte-equal facets across both runners (test #4) — the
  precondition T-054-03's formal dual-runner equivalence proof leans on. `erroredSummary`
  being a pure fn of `id` is what makes the summaries identical.
- The thrown error's MESSAGE is intentionally discarded at the catch site (bare `catch`),
  consistent with T-054-01 Design Decision 2 — see review.md open concern #1.
