# T-049-01 — Plan

Ordered, independently-verifiable steps. Each compiles/tests on its own; commit after the gate is green.

## Step 1 — Add the predicate to the edge model (`src/engine/dag-core.ts`)

- Add `export type EdgePredicate = (produced: string) => boolean;`.
- Add the optional `readonly when?: EdgePredicate;` field to `DagEdge` with the doc from structure.md.
- No change to `validateDag`/`topoSort`.

**Verify:** `bun run build` (typecheck) — additive optional field, no callers break. Existing
`dag-core.test.ts` still green (it constructs `{from,to}` edges; the field is optional).

## Step 2 — Fire only predicate-holding edges in `runGraph` (`src/engine/graph-core.ts`)

- Add `type DagEdge` to the `dag-core.ts` import.
- Widen the `SkippedNode.blockedBy` doc comment (shape unchanged).
- Change `inEdges` to `Map<NodeId, DagEdge[]>` and push the whole `edge` (not `edge.from`).
- Replace the two-state halt check with the three-state classification (halted / not-taken / fired) and
  the dual reason, with halt precedence (per design Decision 3). JOIN now iterates `ins` and keys by
  `edge.from`.
- Leave everything after the JOIN (cast, decideThread, fan-out, sinks, return) byte-identical.
- **Do not touch `runGraphConcurrent`** — it has its own separate `inEdges` local (still `NodeId[]`);
  predicate firing there is T-049-02.

**Verify:** `bun run build`. Then `bun test src/engine/graph-core.test.ts` — all *existing* runGraph
cases (linear / fan-out / join / diamond / halt-cascade / no-produced / empty / cyclic / determinism)
must stay green: with no `when`, the classification reduces exactly to the old halt check.

## Step 3 — Tests for conditional edges (`src/engine/graph-core.test.ts`)

Add `import { validateDag } from "./dag-core.ts"` and the new `describe` block with the five cases from
structure.md. Use a shared `predicatedSpec()` factory so the fan-out, andon, and validate cases share
one spec.

**Verify:** `bun test src/engine/graph-core.test.ts` green, including the new block.

## Step 4 — Full gate

- `bun run build` (typecheck + bundle).
- `bun test` (whole suite — confirm no engine/budget/example regressions; ~1150 tests baseline).
- `bun run lint` if available.

## Testing strategy

- **Unit, pure, no live model** — the entire ticket is provable as a pure-function test (the house
  discipline): the test imports only `graph-core.ts` + `dag-core.ts`, injects `recordingNode` /
  `neverNode` stubs, and asserts over `GraphResult`. No `castPlay`, no `graph.ts`, no addon, no spawn.
- **What each AC clause maps to:**
  - "runs ONLY the matching branch" → case 1 (`recordingNode` call records: A cast, B not; `nodes.size`,
    `produced`).
  - "not-taken node present in `result.skipped`" → case 1 (`skipped` ids) + case 2.
  - "reason reads 'branch not taken', textually distinct from 'dependent on halted upstream'" → case 2
    (`toContain` / `not.toContain`).
  - "validateDag still ok for the predicated spec" → case 3.
  - "`bun test` green" → Step 4.
- **Regression guard** — back-compat case 4 + the whole pre-existing `runGraph` suite prove an
  un-predicated edge is unchanged; the full `bun test` proves `runGraphConcurrent`/`castGraph`/examples
  are untouched.
- **Cascade reuse** — case 5 proves the not-taken branch's subgraph cascade-skips through the existing
  halt machinery (the epic's "reuse, don't reinvent" spine).

## Risks / watch-points

- **`inEdges` element-type change** ripples to the JOIN map construction — must switch both the push and
  the `flatMap` to operate on `DagEdge`, or the build breaks. Caught by Step 2 typecheck.
- **Precedence ambiguity** when a node has both a halted and a not-taken in-edge — resolved by design
  (halt wins); not in the AC but documented in code so a future reader is not surprised.
- **Accidentally editing `runGraphConcurrent`** — explicitly out of scope; T-049-02 depends on this
  ticket and will mirror it. Keep the diff to the sequential function.

## Commit

One commit after the full gate: `feat(engine): conditional edges in sequential runGraph (T-049-01)` —
the model field + the runGraph firing + tests, since they are one coherent, independently-green unit.
Commit only if the workflow calls for it (Lisa drives phase transitions; commit per house convention).
</content>
