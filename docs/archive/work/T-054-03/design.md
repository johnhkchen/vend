# T-054-03 Design — deterministic-dual-runner-throw-equivalence

_Options, tradeoffs, decision with rationale. Grounded in research.md._

## The decision in one line

Add ONE focused `describe` block to `src/engine/graph-core.test.ts` that formally asserts
the full `GraphResult` facet projection is **identical** across `runGraph` and
`runGraphConcurrent` for a throwing-node + independent-sibling spec, asserting both the
holistic `facets(con) === facets(seq)` equality AND each AC-named facet (nodes / skipped /
outcome / halted) explicitly. No source change — the behavior already ships (T-054-02).

## What "done" requires (re-read of the AC)

> A deterministic test asserts the GraphResult (nodes / skipped / outcome / halted) for a
> spec with a throwing node and an independent sibling is equivalent across runGraph and
> runGraphConcurrent with a stub throwing thunk and no live model; the full `bun test`
> suite stays green.

Decomposed:
1. **Deterministic** — same spec + same stub casts ⇒ identical result, repeatably.
2. **Asserts GraphResult equivalence** across the two runners.
3. **Names four facets** — nodes, skipped, outcome, halted.
4. **Spec shape** — a throwing node AND an independent sibling.
5. **Stub throwing thunk, no live model** — `throwingNode`, pure, no spawn.
6. **Full suite green.**

## Options considered

### Option A — Lean on T-054-02's existing test #4 (do nothing new)

T-054-02's block already has `expect(facets(con)).toEqual(facets(seq))` for the throwing
spec (test #4, lines 542-547).

- **Pro:** zero new code.
- **Con (decisive):** that test is explicitly a *de-risking* check OWNED by T-054-02 (its
  review defers the formal proof here). T-054-03 must produce its own artifact trail and a
  test that stands as the ticket's deliverable. It also does NOT assert the four AC-named
  facets *individually*, nor prove determinism (repeatability), nor surface the equivalence
  as the named contract. Reusing another ticket's incidental assertion as this ticket's AC
  evidence is brittle: if T-054-02's block is ever refactored, this ticket's "proof"
  silently vanishes. **Rejected** — an AC needs a test that names it.

### Option B — A dedicated T-054-03 equivalence block (CHOSEN)

A new `describe("dual-runner throw-equivalence (T-054-03)")` with:
- a self-contained `mkSpec()` factory (fresh nodes per call — seq and con must not share
  recorded-call state, the T-054-02 lesson);
- the `facets` projection (the established E-049 / T-054-02 idiom);
- a **holistic** assertion: `expect(facets(con)).toEqual(facets(seq))` — the byte-for-byte
  equivalence claim;
- **per-facet** assertions naming each of nodes / skipped / outcome / halted, so the AC
  maps 1:1 onto named expectations a reviewer can read;
- a **determinism** assertion: run each runner twice and assert the repeats are equal
  (closes "deterministic" as a first-class property, not an assumption).

- **Pro:** the ticket owns its proof; the AC's four facets are each named; determinism is
  proven, not assumed; mirrors the house equivalence-test idiom exactly.
- **Con:** modest overlap with T-054-02 test #4 — acceptable, because the two have
  different owners and different framings (de-risk vs. formal proof), and the cost is a few
  dozen lines in a pure test file.
- **Decision:** **CHOSEN.**

### Option C — Option B + a budgeted-wallet equivalence variant

Add a third runner comparison: `runGraphConcurrent` WITH a generously-funded shared wallet,
proving a throw is equivalent even under the E-048 budget path (the errored summary's
`actuals === undefined` ⇒ `{0,0}` debit ⇒ nothing budget-stops ⇒ facets still equal, plus
`walletRemaining` is untouched by the throw).

- **Pro:** strengthens the proof across the budgeted path; mirrors E-049's budgeted
  parity test (lines 424-453); cheap (one more `costed`-style spec + a wallet alloc).
- **Con:** the AC does not require it; the `{0,0}`-debit invariant is already tested in the
  E-048 algebra.
- **Decision:** **INCLUDE as one extra test** — it is high-value, low-cost, and directly
  advances the epic's "holds identically in both runners" claim under the one path
  (budgeted concurrency) where a throw could plausibly interact with another subsystem.
  It is additive: if it ever became noisy it can be removed without touching the core proof.

## Chosen design — shape & assertions

### Spec shape (the throwing node + independent sibling, plus a cascade)

Reuse the proven E-054 shape, fresh per call:
```
        A (source, success "pa")
       / \
   B(throws)   C (independent sibling, success "pc")
      |
      D (depends on B — neverNode: must NOT be cast)
A→B, A→C, B→D
```
Why this shape: it exercises every facet that can differ between runners in ONE spec —
- `nodes`: A, B(errored), C cast; D absent.
- `skipped`: D, with a reason naming the halted/errored upstream B.
- `outcome`: `errored` (first non-success in topo order).
- `halted`: true.
- `produced`: `{C: "pc"}` (the surviving leaf; D the only sink, skipped).
`C` is the independent sibling the AC names; `D`'s `neverNode` makes the cascade-skip a
hard assertion (it throws if the cascade ever fails to skip it).

### The facet projection (established idiom)

```ts
const facets = (r: GraphResult) => ({
  cast: [...r.nodes.keys()].sort(),
  skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
  produced: Object.fromEntries(r.produced),
  outcome: r.outcome,
  halted: r.halted,
});
```
This projection deliberately EXCLUDES `walletRemaining` (present only on the budgeted
concurrent path) — the same reason the E-049 block excludes it. The AC's four named facets
map onto `cast` (the `nodes` keyset), `skipped`, `outcome`, `halted`.

### Assertions (per test)

1. **Holistic equivalence** — `expect(facets(con)).toEqual(facets(seq))`. The single
   strongest line: the entire projection is identical.
2. **Per-facet, AC-named** — assert on the equal projection so each AC facet is named:
   - `nodes`: `facets(seq).cast === ["A","B","C"]` and `con.nodes.get("B")?.outcome === "errored"`.
   - `skipped`: ids `["D"]`, reason contains `halted upstream` + `errored`, `blockedBy ⊇ ["B"]`.
   - `outcome`: both `=== "errored"`.
   - `halted`: both `=== true`.
3. **Determinism** — `facets(await runGraph(mkSpec())) === facets(await runGraph(mkSpec()))`
   and the same for `runGraphConcurrent`; repeats are byte-equal (the `erroredSummary`
   purity property made observable).
4. **Budgeted strengthening (Option C)** — run `runGraphConcurrent(mkSpec(), {wallet, priceOf})`
   with a generously-funded wallet over a `costed`-style throwing spec; assert its facets
   still equal the sequential, and `walletRemaining` reflects only the nodes that actually
   cast (the throw debited nothing).

## Rejected micro-decisions

- **Deep-equal the whole `GraphResult`** (not just facets) — rejected: `walletRemaining`
  asymmetry would make a budgeted comparison fail spuriously, and asserting on the projection
  is the codebase idiom (E-049 comment, lines 343-345).
- **Reuse T-054-02's `mkParts()` factory directly** — rejected for the core block: keep the
  T-054-03 block self-contained so it does not break if the T-054-02 block is edited. (The
  shape is re-expressed, not imported across describe blocks.)
- **Add a brand-new spec shape** — rejected: the E-054 shape already covers every
  differing facet; a novel shape adds surface without adding coverage.

## Why no source change

Research confirmed both runners already catch throws (T-054-02) and route them through the
existing halt machinery via the pure `erroredSummary`/`decideThread` pair. The dispatcher is
already total over `{success, non-success, exception}`. This ticket's contribution is the
**formal, AC-named equivalence proof** — a test artifact — not new runtime behavior.
