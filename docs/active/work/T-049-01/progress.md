# T-049-01 — Progress

## Status: COMPLETE — all steps done, full gate green.

## Step 1 — model field (`src/engine/dag-core.ts`) ✓
- Added `export type EdgePredicate = (produced: string) => boolean;`.
- Added optional `readonly when?: EdgePredicate;` to `DagEdge` with doc (absent ⇒ unconditional fire;
  not consulted by `validateDag`/`topoSort`).
- `validateDag`/`topoSort` untouched.

## Step 2 — `runGraph` firing (`src/engine/graph-core.ts`) ✓
- Added `type DagEdge` to the `dag-core.ts` import.
- Widened `SkippedNode.blockedBy` doc to cover halt vs branch-not-taken (shape unchanged).
- `inEdges` is now `Map<NodeId, DagEdge[]>` and pushes the whole `edge` (carries `when`).
- Replaced the two-state halt check with a three-state in-edge classification (halted / not-taken /
  fired) + dual reason, halt precedence. JOIN now iterates `ins` keyed by `edge.from`.
- Everything after the JOIN (cast, `decideThread`, fan-out, sinks, return) unchanged.
- **`runGraphConcurrent` deliberately NOT modified** — its own `inEdges` local is still `NodeId[]`;
  predicate firing there is T-049-02. Confirmed untouched by full-suite green.

## Step 3 — tests (`src/engine/graph-core.test.ts`) ✓
- Imported `validateDag`.
- New `describe("runGraph — conditional edges select the taken branch (E-049, T-049-01)")` with 5 cases:
  1. fan-out runs only the matching branch; not-taken node in `skipped` (the AC core);
  2. not-taken reason contains "branch not taken", not "dependent on halted upstream"; `blockedBy` has "1";
  3. `validateDag` ok for the predicated spec;
  4. back-compat — un-predicated edge fires unconditionally;
  5. cascade — not-taken `B`'s downstream `C` cascade-skips via the existing halt path.
- Fixed one drafting slip: in case 5, `A` is a leaf (out-degree 0), so `produced` is `{A:"pa"}`, not empty.

## Step 4 — gate ✓
- `bun run build` (tsc --noEmit): clean.
- `bun test src/engine/graph-core.test.ts`: 17 pass / 0 fail (12 existing + 5 new), 77 expect calls.
- `bun test` (full): **1155 pass / 0 fail**, 3102 expect calls, 77 files (baseline ~1150; +5 new).
- `bun run lint`: no `lint` script defined in this repo yet (CLAUDE.md lists it as an intended
  convention, not yet wired); build + full suite are the live gate.

## Deviations from plan
- None of substance. The only correction was the case-5 `produced` assertion noted above (caught and
  fixed before the gate). No commit made — Lisa drives phase transitions; the working tree carries the
  change for the sweep/commit step per house convention.
</content>
