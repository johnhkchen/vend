# T-068-01-03 — Review

**Ticket:** cost-weight-total-tokens · **Commit:** `ae3c287` · **Gate:** `bun run check` green
(1584 pass / 1 skip / 0 fail).

## What changed

### `src/log/run-log.ts` (source, +33 / modified)
- Added a **module-private, frozen `COST_WEIGHTS`** constant `{input:1.0, cache_read:0.1,
  cache_creation:1.25, output:5.0}` — a documented, deliberate **inline mirror** of budget.ts's
  exported `COST_WEIGHTS` (T-068-01-01). Duplicated rather than imported to preserve the
  **run-log ⊥ budget zero-coupling invariant** (run-log imports nothing from `src/budget/`).
- Rewrote **`totalTokens`** from a parity sum to a cost-weighted sum. Signature, export, and name
  unchanged — a pure body swap. Docstring updated (parity → cost; flags the now-possibly-fractional
  result and that consumers `Math.ceil`/divide).

### `src/log/run-log.test.ts` (tests, +90)
- Updated the one parity assertion (`…→ 475`, not 1170).
- New describe **"totalTokens — cost-weighted, inline mirror"**: per-bucket ratio pins (drift
  guard) + the boilerplate-demo **E-008 fixture recompute** (`525,180 parity → ≈236,072.6 cost`,
  strictly below parity).
- New describe **"cost reweight flows through recalibrate"**: drives the real `recalibrate()` over
  5 cache-dominated `success` fixtures, asserting a **cost-denominated p90 envelope**
  (`Math.ceil(236,072.6)=236,073 < parity 525,180`, `source:"measured"`) — proving recompute from
  existing records with **no history re-run**.

### `src/ledger/walk-away.test.ts` (consumer test, +2 / −1)
- One assertion updated: `auditWalkAway` "median actual/allocated ratio" fixture was parity-based
  (actual 200); under the reweight the actual is `600`, so the median ratio moves `0.375 → 1.125`.
  Comment updated to explain. **Fallout of the shared-derivation change, not new behavior.**

## Acceptance criteria — met

> totalTokens over a cache-dominated fixture record equals countTokens over the same usage;
> recalibrate over historical records returns cost-denominated p90 envelopes with no history
> re-run (unit test); and run-log.test.ts stays green.

- **totalTokens is cost-weighted** = the same COST_WEIGHTS budget's (cost-weighted) countTokens
  reads — proven by pinning the identical literals budget.test.ts pins (the two mirrors are held
  in lockstep by matching guards, not a shared symbol, per the zero-coupling design). The E-008
  fixture recomputes `525,180 → ~236,073`.
- **recalibrate returns cost-denominated p90, no re-run** — the recalibrate-recompute test, using
  the genuine `recalibrate()`.
- **run-log.test.ts stays green** — 82 pass / 0 fail; full gate green.

## Test coverage assessment

- **Strong:** the derivation itself (per-bucket ratios, cache-dominated recompute, drift guard),
  and the primary downstream consumer (recalibrate) end-to-end.
- **Adequate by delegation:** walk-away/spend/wallet recompute for free; walk-away's ratio test now
  exercises the cost path. spend.ts and recalibrate's other call sites (censored bounds, funding
  ratios) are covered by their own suites, all green under the reweight.
- **Gap (intentional, out of slice):** no test asserts the two inline mirrors (run-log's vs
  budget's) share a symbol — by design they cannot (zero-coupling). The lockstep is enforced by two
  independent guard tests pinning the same literals. If a future editor changes one vector and not
  the other, the un-changed side's guard fails — but a reviewer should treat the two
  `COST_WEIGHTS` blocks as a linked pair.

## Open concerns / notes for the reviewer

1. **Deliberate duplication.** Two `COST_WEIGHTS` definitions now exist (budget.ts exported,
   run-log.ts private). This is the sanctioned house pattern (the pre-existing inline-`totalTokens`
   idiom, cited in recalibrate.ts:364). The drift risk is real but bounded by paired guard tests.
   Not a bug — a documented trade for the decoupling.
2. **`totalTokens` may now return a fractional value.** No integer contract on it exists; consumers
   `Math.ceil` (recalibrate `positiveInt`) or divide (walk-away/recalibrate ratios). Verified via
   full `bun run check`. Flagged in the docstring.
3. **Concurrent siblings.** budget.ts/budget.test.ts/wallet.test.ts carried **uncommitted**
   sibling edits (T-068-01-02, running in parallel on the shared branch) during this work. They
   were left untouched and **not staged**; only this ticket's files were committed. My slice is
   logically independent of budget.ts (no `countTokens` import), so it is green regardless of when
   T-068-01-02 lands.
4. **Extra file vs plan.** walk-away.test.ts was not in the original file plan; it was pulled in by
   the gate as necessary consumer-test fallout (see progress.md). No DAG overlap — no sibling owns
   it.
5. **Nothing deferred to the epic's live proof is claimed here.** This is fixture/unit-proven and
   FREE (recompute over logged buckets). The metered live decompose that clears E-008 under the new
   units remains the epic's closing counter-authorized proof — out of this ticket and this story.

## Files
- Modified: `src/log/run-log.ts`, `src/log/run-log.test.ts`, `src/ledger/walk-away.test.ts`
- Added (work artifacts): `docs/active/work/T-068-01-03/{research,design,structure,plan,progress,review}.md`
- Not touched: budget.ts, recalibrate.ts, gather.ts, spend.ts, wallet.ts, runs.jsonl schema
