# T-046-01 — Progress

Tracks the Implement phase against `plan.md`. Status as of this pass: **implementation complete,
full suite green.**

## Steps

### Step 1 — Model + skeleton (`dag-core.ts`) — ✅ DONE
Created `src/engine/dag-core.ts` with the header comment (purity discipline + scope: shape+ordering
only), the type-only `RunSummary` import, and the full model: `NodeId`, `NodeCast`, `DagNode`,
`DagEdge`, `DagSpec`, `DagOffenseKind`, `DagOffense`, `DagValidation`, `TopoResult`.
- Verify: `tsc --noEmit` green.

### Step 2 — `topoSort` (Kahn's, deterministic) + tests — ✅ DONE
Implemented `topoSort` as Kahn's indegree BFS. **Deviation from plan (documented below):** the
ready-set tie-break selects the smallest declaration *index* each step, not a FIFO queue.
- Verify: `topoSort` test group green (linear, fan-out, join, diamond, disconnected, single, empty,
  determinism, 2-/3-cycle, self-loop, cycle+acyclic-tail).

### Step 3 — `validateDag` (total, all offenses) + tests — ✅ DONE
Implemented `validateDag`: duplicate-node + dangling-edge structural scans, then cycle detection
delegated to `topoSort` (only on a structurally-sound graph). Returns `{ ok: true }` or
`{ ok: false, offenses }`.
- Verify: `validateDag` test group green (clean shapes, empty, each named offense, multi-fault
  accumulation).

### Step 4 — Full-suite gate + AC sweep — ✅ DONE
- `bun run check:typecheck` → green.
- `bun test` (full suite) → **1105 pass, 0 fail, 2925 expect() calls, 74 files**.
- `bun test src/engine/dag-core.test.ts` → **18 pass, 0 fail**.
- AC sweep: every acceptance criterion maps to a named test (see `review.md` traceability table).

## Deviation from plan — tie-break rule

**Plan/Design D4** said "declaration order" tie-break and the Structure sketch implied a FIFO ready
queue seeded/appended in ascending index. During Step 2 the FIFO approach revealed an ambiguity:
FIFO mixes *node* declaration order (the seed) with *edge* declaration order (the order successors
are recorded), so when node order ≠ edge order the result follows edge order — still deterministic,
but not the *node*-declaration-order tie-break Design D4 intended.

**Resolution (chosen):** replaced the FIFO queue with a rule that always emits the smallest-index
ready node. This makes the tie-break *purely* a node's declaration order, robust to how edges happen
to be listed. It is simpler to reason about, matches Design D4's stated intent exactly, and is the
behaviour the determinism test asserts (`[root, c, b, a]` for fan-out over nodes declared in that
order). Complexity is O(n²) worst case — irrelevant at playbook-graph scale (handful of nodes).
No interface changed; `topoSort`'s signature and totality are unaffected.

## Commit status

Implementation is **not committed** in this pass. We are on the default branch `main`; per the
repo's commit discipline I left the working tree for the orchestrator (Lisa) to commit/serialize,
as the task instruction states Lisa "handles the rest" after Review. Changed files staged for that
commit:
- `src/engine/dag-core.ts` (new)
- `src/engine/dag-core.test.ts` (new)
- `docs/active/work/T-046-01/*` (the six RDSPI artifacts)

If incremental commits are desired, the plan's Step 1–3 commit messages are ready to use verbatim.
