# T-054-03 Progress — deterministic-dual-runner-throw-equivalence

_Implementation log. What was done, verification, deviations._

## Status: COMPLETE — all plan steps executed, full gate green.

Test-only ticket: NO source change. The throw-containment behavior shipped in T-054-02
(`f25d81c`); this ticket adds the FORMAL dual-runner equivalence proof.

## Steps executed

### Step 1 — core equivalence block (tests 1-3) ✅
- `src/engine/graph-core.test.ts` — appended
  `describe("dual-runner throw-equivalence — same GraphResult under runGraph & runGraphConcurrent (T-054-03)")`.
- block-local `facets` projection (the E-049 / T-054-02 idiom; excludes `walletRemaining`).
- `mkSpec()` factory — `A→{B(throws),C}`, `B→D`, fresh nodes per call (no seq/con
  cross-contamination).
- **test 1** — `expect(facets(con)).toEqual(facets(seq))` + `cast === ["A","B","C"]`.
- **test 2** — each AC facet named, asserted for BOTH runners in one loop: nodes (B
  `errored`, D absent, C present), skipped (D, reason contains `halted upstream` +
  `errored`, `blockedBy ⊇ ["B"]`), outcome (`errored`), halted (`true`), produced
  (`{C:"pc"}`).
- **test 3** — determinism: repeated `runGraph` runs byte-equal; repeated
  `runGraphConcurrent` runs byte-equal.

### Step 2 — budgeted-wallet strengthening (test 4) ✅
- Nested `describe(... under a budgeted concurrent wallet ...)` with `costed` stub,
  `prices` map (A/B/C), `mkCostedSpec()` (A,C costed; B `throwingNode`; D `neverNode`).
- **test 4** — `runGraphConcurrent(mkCostedSpec(), {wallet, priceOf})` with a
  generously-funded 200k/100k wallet; `facets(con) === facets(seq)`; B is `errored`;
  `walletRemaining === {tokens: 175_000, timeMs: 89_000}` — the throw (B) debited nothing
  (its `actuals === undefined` ⇒ {0,0}); remaining = funded − A − C, with wave-2 wall =
  MAX(0, C.timeMs) = C.timeMs.

### Step 3 — full gate ✅
- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`).

### Step 4 — commit (single, atomic) ✅
- See commit SHA in review.md.

## Verification against AC

> A deterministic test asserts the GraphResult (nodes / skipped / outcome / halted) for a
> spec with a throwing node and an independent sibling is equivalent across runGraph and
> runGraphConcurrent with a stub throwing thunk and no live model; the full `bun test`
> suite stays green.

- ✅ **deterministic test** — test 3 (repeated runs of each runner byte-identical).
- ✅ **asserts GraphResult equivalence across both runners** — test 1
  (`facets(con) === facets(seq)`) and test 2 (every facet asserted for both).
- ✅ **nodes facet** — test 2: B `errored`, D absent, C present, both runners.
- ✅ **skipped facet** — test 2: D skipped, reason names the errored upstream, both runners.
- ✅ **outcome facet** — test 2: `errored`, both runners.
- ✅ **halted facet** — test 2: `true`, both runners.
- ✅ **throwing node + independent sibling** — `mkSpec`: `throwingNode("B")` + sibling `C`
  (depends only on A).
- ✅ **stub throwing thunk, no live model** — `throwingNode`; the file imports only
  pure/type-only modules; no spawn, no native addon.
- ✅ **full suite stays green** — `bun run check` → 1218 pass / 0 fail.
- ✅ **(strengthening) budgeted-concurrency equivalence** — test 4.

## Gate results

- `bun test src/engine/graph-core.test.ts` → **33 pass / 0 fail** (was 29; +4 new),
  157 expect() calls.
- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) → **1218 pass / 0 fail**
  (was 1214; +4), typecheck clean, baml generated clean.

## Deviations from plan

**None.** Step counts and arithmetic matched the plan. The plan's predicted suite total
(1218) was exact. Risks did not materialize:
- R1 (seq/con cross-contamination) — `mkSpec()`/`mkCostedSpec()` build fresh nodes per call.
- R2 (`facets` redeclare) — block-local, accepted by `tsc`/`bun:test` as before.
- R3 (wallet math) — copied the E-049 budgeted single-node-wave MAX arithmetic;
  `walletRemaining` matched the computed {175_000, 89_000}.
- R4 (tsc strictness) — used `prices[id] as Budget` / `?? {0,0}`; `tsc --noEmit` clean.

## Notes for review

- This ticket adds NO runtime behavior; it is the equivalence proof E-054 needed to call the
  dispatcher total over `{success, non-success, exception}`. The de-risk test in T-054-02
  (its test #4) is superseded as the *formal* proof by this block, which additionally proves
  determinism, names each AC facet, and covers the budgeted path.
