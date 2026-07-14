# T-054-03 Plan — deterministic-dual-runner-throw-equivalence

_Ordered, independently-verifiable steps. Testing strategy. Single atomic commit._

## Testing strategy

- **Unit, pure, no spawn.** Everything lands in `src/engine/graph-core.test.ts`, which
  imports only `graph-core.ts` + `dag-core.ts` (+ wallet/budget types). No native addon, no
  live model — the chain-core.test.ts discipline. Every node is a stub
  (`throwingNode`/`recordingNode`/`neverNode`/`costed`).
- **No integration test.** There is no impure shell change to prove live; `castGraph`
  (graph.ts) is untouched. The equivalence is a property of the pure core, proven on the
  pure core.
- **Verification criterion per step** is a passing `bun test` of the file, ending with the
  full `bun run check` gate (baml:gen + `tsc --noEmit` + `bun test`) green.

## Steps

### Step 1 — Add the core equivalence block (tests 1-3)

Append `describe("dual-runner throw-equivalence … (T-054-03)")` to the end of
`src/engine/graph-core.test.ts` with:
- block-local `facets` projection (the E-049/T-054-02 idiom);
- `mkSpec()` factory: `A→{B(throws),C}`, `B→D` with fresh nodes per call;
- **test 1** — `expect(facets(con)).toEqual(facets(seq))` + `cast === ["A","B","C"]`;
- **test 2** — each AC facet named: nodes (B errored, D absent), skipped (D, reason names
  errored upstream B), outcome (`errored`), halted (`true`), produced (`{C:"pc"}`) — for
  BOTH runners;
- **test 3** — determinism: repeated `runGraph` runs equal; repeated `runGraphConcurrent`
  runs equal.

**Verify:** `bun test src/engine/graph-core.test.ts` → 29 + 3 = 32 pass, 0 fail.

### Step 2 — Add the budgeted-wallet strengthening (test 4)

Within the same block, add `costed`/`throwingCosted`/`mkCostedSpec`/`prices`/`priceOf`
(mirroring the E-049 budgeted test, lines 424-453) and **test 4**:
- `seq = runGraph(mkCostedSpec())`; `con = runGraphConcurrent(mkCostedSpec(), {wallet, priceOf})`
  with a generously-funded wallet (nothing budget-stops);
- `expect(facets(con)).toEqual(facets(seq))` — equivalence holds on the budgeted path;
- `con.nodes.get("B")?.outcome === "errored"`;
- `con.walletRemaining` reflects only the nodes that cast (A + C); the throw (B) debited
  nothing — compute expected from the price map (single-node-wave MAX arithmetic).

**Verify:** `bun test src/engine/graph-core.test.ts` → 32 + 1 = 33 pass, 0 fail.

### Step 3 — Full gate

Run `bun run check` (baml:gen + `tsc --noEmit` + `bun test`).

**Verify:** suite **1218 pass / 0 fail** (was 1214; +4), typecheck clean, baml clean.

### Step 4 — Commit (single, atomic)

One commit: `test(T-054-03): formal dual-runner throw-equivalence (GraphResult identical
under runGraph & runGraphConcurrent)`. Stage `src/engine/graph-core.test.ts` and the
T-054-03 work artifacts.

## Why one commit, not four

The deliverable is a single additive test block. No source change, no migration, no
sequencing where an intermediate state must be independently shippable. The atomic unit is
"the equivalence proof exists and the gate is green." (Per `git commit` policy: only commit
when the user asks — the RDSPI Implement phase's "commit incrementally" is that instruction
for this autonomous ticket run; one commit at the end of a green gate satisfies it.)

## Verification matrix (maps steps → AC)

| AC clause | Proven by |
|---|---|
| deterministic test | Step 1 test 3 (repeated runs byte-equal) |
| asserts GraphResult equivalence across both runners | Step 1 test 1 (`facets(con)===facets(seq)`) |
| nodes facet | Step 1 test 2 (B errored, D absent, both runners) |
| skipped facet | Step 1 test 2 (D skipped, reason names errored upstream) |
| outcome facet | Step 1 test 2 (`errored`, both) |
| halted facet | Step 1 test 2 (`true`, both) |
| spec has throwing node + independent sibling | `mkSpec`: `throwingNode("B")` + sibling `C` |
| stub throwing thunk, no live model | `throwingNode`; pure imports only |
| full suite stays green | Step 3 (`bun run check` 1218/0) |
| (strengthening) holds under budgeted concurrency | Step 2 test 4 |

## Risks & mitigations (carried from structure.md)

- **R1 cross-contamination** → `mkSpec()`/`mkCostedSpec()` build fresh nodes per call.
- **R2 `facets` redeclare** → block-local, per the file's existing convention.
- **R3 wallet math** → copy the E-049 budgeted test's single-node-wave MAX arithmetic;
  compute expected from the price map.
- **R4 tsc strictness** → `prices[id] as Budget` / `?? {0,0}` exactly as E-049 does.
- **R5 overlap with T-054-02 test #4** → acceptable; different owner, different framing
  (formal proof vs. de-risk), and this block additionally proves determinism + the
  per-facet AC mapping + the budgeted path.
