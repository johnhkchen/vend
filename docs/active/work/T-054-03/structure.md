# T-054-03 Structure — deterministic-dual-runner-throw-equivalence

_The blueprint: exact files, edit sites, new symbols, ordering. Not code._

## Files touched

| File | Change | Why |
|---|---|---|
| `src/engine/graph-core.test.ts` | ADD one `describe` block at end of file | The formal dual-runner throw-equivalence proof (the ticket's deliverable) |
| `src/engine/graph-core.ts` | **none** | Behavior already ships (T-054-02) |
| `src/engine/graph-core.test.ts` helpers | **reuse existing** | `throwingNode`, `recordingNode`, `neverNode`, `summary`, `edge`, `spec`, `allocate` are all already imported/defined |

No source file changes. No new modules. No new exports. One test file gains one block.

## The new test block

### Location

Appended to `src/engine/graph-core.test.ts` AFTER the existing T-054-02 block (current end
of file, ~line 548). It is the last block in the file, mirroring how each epic's block was
appended in turn (E-049 block, then T-054-02 block).

### Block skeleton (symbols, not code)

```
describe("dual-runner throw-equivalence — same GraphResult under runGraph & runGraphConcurrent (T-054-03)")
│
├── const facets = (r: GraphResult) => ({ cast, skipped, produced, outcome, halted })
│       // block-local — the established E-049 / T-054-02 cross-executor projection.
│       // Excludes walletRemaining (budgeted-concurrent-only) by design.
│
├── const mkSpec = () => spec(
│       [ recordingNode("A", summary("success","pa")).node,
│         throwingNode("B"),
│         recordingNode("C", summary("success","pc")).node,
│         neverNode("D") ],
│       [ edge("A","B"), edge("A","C"), edge("B","D") ])
│       // fresh nodes per call — seq and con must NOT share recorded-call state.
│
├── const costed = (id, produced, price): DagNode   // OR reuse the E-049 block's pattern
│       // a success node carrying `actuals` so the budgeted wave debits a real delta.
│   const throwingCosted = (id): DagNode             // a throwing node on the budgeted path
│   const mkCostedSpec = () => spec( [costed A, throwingCosted B, costed C, neverNode D], edges )
│
├── test 1 — "the full GraphResult facets are byte-identical across both runners"
│       seq = await runGraph(mkSpec()); con = await runGraphConcurrent(mkSpec())
│       expect(facets(con)).toEqual(facets(seq))
│       expect(facets(seq).cast).toEqual(["A","B","C"])   // nodes facet (AC)
│
├── test 2 — "each AC-named facet agrees: nodes / skipped / outcome / halted"
│       seq, con as above
│       // nodes: B errored under both
│       expect(seq.nodes.get("B")?.outcome).toBe("errored")
│       expect(con.nodes.get("B")?.outcome).toBe("errored")
│       expect(seq.nodes.has("D")).toBe(false); expect(con.nodes.has("D")).toBe(false)
│       // skipped: D, naming the errored upstream
│       for r in [seq, con]: skipD = r.skipped.find(id==="D");
│           expect(skipD?.blockedBy).toContain("B")
│           expect(skipD?.reason).toContain("halted upstream")
│           expect(skipD?.reason).toContain("errored")
│       // outcome + halted
│       expect(seq.outcome).toBe("errored"); expect(con.outcome).toBe("errored")
│       expect(seq.halted).toBe(true); expect(con.halted).toBe(true)
│       // produced (surviving leaf)
│       expect(Object.fromEntries(seq.produced)).toEqual({ C: "pc" })
│       expect(Object.fromEntries(con.produced)).toEqual({ C: "pc" })
│
├── test 3 — "deterministic: repeated runs of each runner are byte-identical"
│       expect(facets(await runGraph(mkSpec()))).toEqual(facets(await runGraph(mkSpec())))
│       expect(facets(await runGraphConcurrent(mkSpec()))).toEqual(facets(await runGraphConcurrent(mkSpec())))
│       // proves erroredSummary's pure-fn-of-id property at the GraphResult level
│
└── test 4 — "throw-equivalence holds under a budgeted concurrent wallet (strengthening)"
        seq = await runGraph(mkCostedSpec())
        wallet = allocate({ tokens: BIG, timeMs: BIG }); priceOf = id => prices[id] ?? {0,0}
        con = await runGraphConcurrent(mkCostedSpec(), { wallet, priceOf })
        expect(facets(con)).toEqual(facets(seq))     // throw equivalent even when budgeted
        expect(con.nodes.get("B")?.outcome).toBe("errored")
        // the throw debited nothing: remaining = funded − (A + C only), B never charged
        expect(con.walletRemaining).toEqual({ tokens: funded − A − C, timeMs: funded − max-wave-time })
```

## New symbols

| Symbol | Scope | Role |
|---|---|---|
| `facets` | block-local const | cross-executor projection (re-declared, same as E-049/T-054-02 — block-local by the file's convention; each block defines its own) |
| `mkSpec` | block-local const | fresh throwing spec factory (unbudgeted) |
| `costed` | block-local const | success node carrying `actuals` (mirrors E-049 block's `costed`) |
| `throwingCosted` | block-local const | a throwing node for the budgeted spec |
| `mkCostedSpec` | block-local const | fresh budgeted throwing spec factory |
| `prices` / `priceOf` | block-local | the budgeted-wave price map (mirrors E-049 block) |

No exported symbols. No changes to any `*.ts` source module's public surface.

## Reused, NOT redefined

- `runGraph`, `runGraphConcurrent`, `GraphResult` — imported (lines 4).
- `throwingNode`, `recordingNode`, `neverNode`, `summary`, `edge`, `spec` — file-level
  helpers (lines 17-60).
- `allocate` (wallet) — imported (line 7); `Budget` type (line 8).
- `erroredSummary`/`NODE_ERRORED` behavior — exercised through the runners, not re-tested
  in isolation (that is T-054-01's block).

## Ordering of changes

1. Append the `describe` block (tests 1-3, the core proof).
2. Append test 4 (the budgeted strengthening) within the same block.
3. Run `bun test src/engine/graph-core.test.ts` — expect 29 + 4 = 33 pass.
4. Run the full gate `bun run check` — expect 1214 + 4 = 1218 pass, tsc clean.
5. Commit once.

There is no inter-step dependency requiring multiple commits — the change is a single
additive test block. One atomic commit is correct.

## Risk surface (structural)

- **R1 — seq/con cross-contamination via shared `recordingNode`.** Mitigated by `mkSpec()`
  building fresh nodes on each call (the T-054-02 lesson; each runner gets its own spec).
- **R2 — `facets` name collision.** Each `describe` block defines its own block-local
  `facets`; TS/`bun:test` scope them per-block, so re-declaration is fine (E-049 and
  T-054-02 already both define one). No top-level symbol added.
- **R3 — budgeted wallet math drift.** Single-node waves ⇒ `debitWave`'s wall-clock MAX ==
  that node's time (the E-049 budgeted test, lines 449-453, is the exact arithmetic
  template to copy). Compute expected remaining from the price map, not by hand-waving.
- **R4 — `tsc` strictness (`noUncheckedIndexedAccess`).** Use `prices[id] as Budget` /
  `?? {tokens:0,timeMs:0}` exactly as the E-049 block does for the `priceOf` lookups.
