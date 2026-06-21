# T-049-02 — Plan

Ordered, independently-verifiable steps. The model (`DagEdge.when`) and the sequential reference
(`runGraph`) already ship from T-049-01; this ticket is `runGraphConcurrent` + cross-executor tests.

## Step 1 — Port the predicate firing into `runGraphConcurrent` (`src/engine/graph-core.ts`)

Apply changes A–E from structure.md as one coherent edit (they only typecheck together):

- **A:** `inEdges` → `Map<NodeId, DagEdge[]>`.
- **B:** push the whole `edge` (not `edge.from`).
- **C:** wave-ready filter reads `e.from` (`.every((e) => decided.has(e.from))`).
- **D:** replace the two-state skip block with the three-state classification (`halted`/`notTaken`,
  memoized in `classified`) + dual reason with halt precedence — reason strings copied verbatim from
  `runGraph` (graph-core.ts 184–193).
- **E:** JOIN map reads `e.from`.

**Verify:** `bun run build` (tsc --noEmit) clean — the type change forces every `from` read to move; a
missed one fails to compile (a free correctness net). No behavior assertion yet.

**Risk:** missing one `from→edge.from` site. *Mitigation:* the `DagEdge[]` retype makes any stale
`decided.has(from)` / `producedAll.get(from)` a type error — the compiler enumerates them.

## Step 2 — Cross-executor equality tests (`src/engine/graph-core.test.ts`)

Add imports (`runGraphConcurrent`, `GraphResult`, `allocate`, `Budget`), the `facets` projection, and
the `costed` stub. Add `describe("runGraphConcurrent — conditional edges mirror runGraph (E-049,
T-049-02)")` with four cases:

1. **AC fan-out equality** — run both executors on `predicated()`; `facets` equal; spot-checks (B
   skipped "branch not taken", produced `{A:"pa"}`, cast `["1","A"]`).
2. **Multi-wave branch + cascade** — 1→{A,B} predicated, A→C, B→D; `facets` equal; `skipped` ids
   `["B","D"]`, reasons distinct (B not-taken, D halted-upstream); C ran.
3. **Branch-not-taken under a budgeted wallet** — `costed` nodes + a generously-funded `allocate`d
   wallet; `facets(budgetedConcurrent)` equals `facets(sequential)`; `walletRemaining` present and
   debited only by the cast nodes (not-taken branch contributes nothing).
4. **Back-compat (no `when`)** — a plain diamond; `facets` identical across executors.

**Verify:** `bun test src/engine/graph-core.test.ts` green (existing 17 + new ~4).

**Risk:** reason strings drift between executors → equality fails. *Mitigation:* strings are copied
verbatim in Step 1; case 1/2 assert equality directly, surfacing any drift immediately.

**Risk:** the budgeted wallet accidentally budget-stops a branch (changing the skip set vs `runGraph`,
which has no budget). *Mitigation:* fund the wallet far above the summed prices of the *taken* path so
`authorizeWave` stops nothing; the only skip is the predicate's not-taken — keeping facets equal to the
unbudgeted sequential run.

## Step 3 — Full-suite gate

**Verify:**
- `bun run build` — clean.
- `bun test` (full) — all green; specifically the E-046 concurrency + E-048 wallet tests in
  `graph-example.test.ts` unchanged (back-compat: no-`when` edges classify as fired, so those specs
  behave identically). Baseline after T-049-01 was 1155 pass; expect 1155 + new cases.

**Risk:** a regression in `graph-example.test.ts` (the live wallet/concurrency proof). *Mitigation:*
those specs carry no `when`, so the three-state classification reduces to the old two-state set; if any
fail it signals a real divergence, caught here before commit.

## Testing strategy

- **Unit, pure:** all new tests live in `graph-core.test.ts`, importing only `graph-core.ts` +
  `dag-core.ts` + the pure wallet/budget algebra — no live model, no spawn, no addon (house discipline).
- **Oracle-based:** the central assertion is *equality to `runGraph`* (the T-049-01 reference), not a
  hand-recomputed expected — so the test cannot drift from the reference semantics it mirrors.
- **Coverage targets (AC clauses):** same cast set ✓ (facets.cast), same skipped ids+reasons ✓
  (facets.skipped), same produced ✓ (facets.produced), multi-wave branch ✓ (case 2), branch-not-taken
  under a budgeted wallet ✓ (case 3), existing E-046/E-048 green ✓ (Step 3).

## What is explicitly NOT in scope

- The model (`when`) — shipped T-049-01.
- `runGraph` — the reference oracle, read-only here.
- `castGraph`/`graph.ts` — already predicate-transparent; the end-to-end worked example through
  `castGraph` is T-049-03.
- A typed `SkippedNode.kind` — T-049-01 deliberately kept the reason a string contract; parity is held.

## Commit

One atomic unit: `runGraphConcurrent` predicate firing + its cross-executor tests, full suite green. No
commit is made in this phase — Lisa drives phase transitions and the sweep/commit per house convention;
the working tree carries the change.
