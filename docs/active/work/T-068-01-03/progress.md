# T-068-01-03 — Progress

## Status: implementation complete, full gate green

## Completed

- **Step 1 — cost-weight `totalTokens` (src/log/run-log.ts).** Added a module-private, frozen
  `COST_WEIGHTS` inline mirror of budget's vector (`{input:1.0, cache_read:0.1, cache_creation:1.25,
  output:5.0}`), documented as a deliberate duplication to preserve the run-log ⊥ budget
  zero-coupling invariant. Rewrote `totalTokens` to the cost-weighted sum; updated its docstring
  (parity → cost-weighted, notes the possibly-fractional result). Signature/export/name unchanged.
  Confirmed no new import from `src/budget/` — invariant held.

- **Step 2 — updated the broken parity assertion (run-log.test.ts).** The derivations-block
  `totalTokens` test now asserts the cost-weighted `100·1 + 50·5 + 1000·0.1 + 20·1.25 = 475`, and
  that it is NOT the old parity sum.

- **Step 3 — added cost-weight tests (run-log.test.ts).** New describe: per-bucket ratio pins
  (drift guard — `cache_read:1000→100`, `output:1000→5000`, `cache_creation:1000→1250`,
  `input:1000→1000`) and the boilerplate-demo E-008 fixture recompute
  (`525,180 parity → ≈236,072.6 cost`, strictly below parity, shortfall > 250k).

- **Step 4 — recalibrate-recompute test (run-log.test.ts, second AC).** New describe importing the
  real `recalibrate` (read-only; no file overlap). Over 5 cache-dominated `success` fixtures it
  asserts `recalibrate(...).envelope.tokens === Math.ceil(costWeightedP90) (=236,073)` and
  `< parity p90 (525,180)`, with `source === "measured"` — cost-denominated envelope from existing
  records, no re-run. Uses `recalibrate()` (unclamped), so independent of FUNDING band
  (T-068-01-04) and `countTokens` (T-068-01-02).

- **Step 5 — verified green.** `bun test src/log/run-log.test.ts` → 82 pass / 0 fail.
  `bun run check` (full typecheck + lint + all suites) → 1584 pass / 1 skip / 0 fail.

## Deviation from plan (documented)

- **Extra file touched: `src/ledger/walk-away.test.ts`.** The plan scoped the change to run-log.ts
  + run-log.test.ts, but `bun run check` surfaced one consumer test failure: `walk-away.test.ts`'s
  "median actual/allocated ratio" hard-coded a **parity**-based actual (`{input:100, output:100}`
  → 200). Under the reweight the actual is `100·1 + 100·5 = 600`, so the ratios shift
  (1.5 / 0.75 → median 1.125, was 0.375). Updated the one assertion + its comment. This is direct,
  expected fallout of changing the shared `totalTokens` derivation. It is **safe under the DAG**:
  no sibling ticket owns walk-away.test.ts (T-068-01-02 → budget.ts/test; T-068-01-04 →
  recalibrate/gather), so there is no file-overlap / missing-edge. walk-away.ts (source) was NOT
  edited — it recomputes for free, exactly as the story states.

## Not touched (scope held)

- No edits to budget.ts, recalibrate.ts, gather.ts, spend.ts, wallet.ts (sibling files / free
  recompute). Concurrent uncommitted sibling edits to budget.ts/budget.test.ts (T-068-01-02) were
  left alone and NOT staged.
- No schema bump (`RUN_LOG_SCHEMA_VERSION` stays 1); buckets read, never mutated.
- Ticket frontmatter phase/status untouched (Lisa handles transitions).

## Commit

`feat(budget): cost-weight run-log totalTokens (inline mirror) (T-068-01-03)` — staged files:
run-log.ts, run-log.test.ts, walk-away.test.ts, and this work dir.
