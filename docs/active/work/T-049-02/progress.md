# T-049-02 — Progress

## Status: COMPLETE — all steps done, full gate green.

## Step 1 — `runGraphConcurrent` predicate firing (`src/engine/graph-core.ts`) ✓

Applied changes A–E as one coherent edit (they only typecheck as a set — retyping `inEdges` forces
every stale `from` read to move, the compiler enumerates them):

- **A:** `inEdges` is now `Map<NodeId, DagEdge[]>` (was `NodeId[]`), with a widened comment explaining it
  carries the whole edge so `when` is in scope at the wave-skip step.
- **B:** pushes the whole `edge` (was `edge.from`).
- **C:** wave-ready filter reads `e.from` (`.every((e) => decided.has(e.from))`).
- **D:** the two-state skip block became the three-state classification — `halted` / `notTaken`,
  memoized in a `classified` map so the record loop does not re-evaluate (user) predicates — plus the
  dual reason with halt precedence. The reason strings are **copied verbatim** from `runGraph`
  (graph-core.ts), so a predicated spec's `GraphResult` is byte-for-byte identical under both runners.
- **E:** the JOIN map reads `e.from`.

`runGraph`, the cycle guard, `byId`, `authorizeWave`/budget-stop/`debitWave`, `Promise.all` dispatch,
SETTLE, SINKS, `skipped.sort`, and the return (incl. `walletRemaining`) are **unchanged**.

## Step 2 — cross-executor tests (`src/engine/graph-core.test.ts`) ✓

- Imports extended: `runGraphConcurrent`, `type GraphResult`, `allocate`, `type Budget`.
- Added the `facets(result)` projection (cast set, skipped ids+reasons+blockedBy, produced, outcome,
  halted — the AC's definition of "equal") and a `costed` stub (carries `actuals` for `debitWave`).
- New `describe("runGraphConcurrent — conditional edges mirror runGraph (E-049, T-049-02)")`, 4 cases:
  1. **AC fan-out** — `facets(concurrent)` equals `facets(sequential)` for the predicated 1→{A,B}; only
     the taken branch cast; B skipped "branch not taken".
  2. **Multi-wave branch + cascade** — 1→{A,B} predicated, A→C, B→D; B not-taken (wave 2), D
     cascade-skips (wave 3) via the halt path, C runs; facets equal; skipped `["B","D"]` with distinct
     reasons.
  3. **Branch-not-taken under a budgeted wallet** — costed nodes + a generously-funded shared wallet;
     facets equal the unbudgeted sequential run; `walletRemaining` reflects only the cast nodes' debit
     (the not-taken B never dispatched → never charged: tokens 170_000, timeMs 87_000).
  4. **Back-compat** — an un-predicated diamond is identical under both executors (guards the two-state
     path: no `when` ⇒ nothing not-taken).

## Step 3 — gate ✓

- `bun run build` (tsc --noEmit): clean.
- `bun test src/engine/graph-core.test.ts`: **21 pass / 0 fail** (17 existing + 4 new), 93 expect calls.
- `bun test` (full): **1159 pass / 0 fail**, 3118 expect calls, 77 files (T-049-01 baseline 1155; +4).
  The E-046 concurrency + E-048 wallet tests in `graph-example.test.ts` are unchanged and green (those
  specs carry no `when`, so the three-state classification reduces to the old two-state set).
- No `lint` script defined in this repo (CLAUDE.md lists it as an intended convention, not yet wired);
  build + full suite are the live gate.

## Deviations from plan

- None of substance. The wallet-math assertion in case 3 uses single-node waves (`debitWave`'s MAX over
  a one-element wave is that element), so `walletRemaining` is funded − (root + A) exactly — verified by
  the green run, not just by hand. No commit made — Lisa drives phase transitions; the working tree
  carries the change for the sweep/commit step per house convention.
