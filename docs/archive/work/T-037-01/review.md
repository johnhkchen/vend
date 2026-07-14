# T-037-01 — Review

## What this ticket did

Pre-flighted the bounded live macro-wallet sweep (T-037-02): proved **deterministically, with no
live model**, that the metered run will *clear* rather than no-op. The output is `preflight.md` — a
GO verdict backed by authorization-grade numbers computed from the *same pure functions `castWork`
uses*, over the live `.vend/runs.jsonl`.

## Changes

### Files created
- `docs/active/work/T-037-01/preflight.md` — **the deliverable**: predicted price, bounded-budget
  affordability, forward-E1 thread confirmation, freshness check, go/no-go.
- `docs/active/work/T-037-01/{research,design,structure,plan,progress,review}.md` — RDSPI artifacts.

### Files modified / deleted
- **No `src/` change. No test change. No deletion.** This is an analysis ticket.
- The ticket frontmatter (`docs/active/tickets/T-037-01.md`) shows modified — that is **Lisa's
  automatic phase advance** from detected artifacts, not a manual edit (per the workflow contract).

### Transient
- A pure-module verification harness was created, run, and removed in-session (not committed).

## The four claims — verdicts

| Claim | Verdict | Basis |
|-------|---------|-------|
| 1. Prices chain from live ledger | ✅ | `recalibrate`×2 + `sumBudgets` executed → **454.9k tok / 233.5s** (propose+decompose, both measured p90) |
| 2. Bounded budget affords ≥1 (~2) | ✅ | `canAfford` over 1h/1M → **2 chains** (token-bound); ≥1 guaranteed |
| 3. `--no-intervened` ⇒ forward-E1 | ✅ | full thread cli→…→audit confirmed; live forward reads **1/2**; no live cast |
| 4. Freshness passes for run-time board | ✅ | `isBoardStale` is `<` (fresh-on-tie); run-time mtime ≥ live |
| auth==exec (E-025) holds | ✅ | priced envelopes threaded into the cast per step; E-024 no-op cannot recur |

All four AC checkboxes are satisfied; the deterministic gate is green.

## Test coverage

- **No new tests** — deliberate. The four seams are already covered by pure unit tests:
  `spend-core.test.ts` (fitNext/shouldContinue), `wallet.test.ts` (allocate/canAfford/debit),
  `work-core.test.ts` (isBoardStale incl. tie/zero), `walk-away.test.ts` (forward/attested split,
  incl. line 162-168 mirroring the real 1/2 ledger shape), `chain-propose-decompose-core.test.ts`
  (per-step budget rung = auth==exec).
- **Gate run this ticket:** `bun run check:typecheck` clean; `bun test` **998 pass / 0 fail** (2439
  expects, 66 files).
- **Coverage gap (acknowledged, not a defect):** the *price/affordability numbers* themselves are
  not pinned by an automated test — they are computed from mutable runtime ledger state, so a test
  asserting "price == 454.9k" would rot as the ledger grows. The preflight freezes today's numbers in
  prose with a reproducible harness; that is the right durability tradeoff for an analysis ticket.

## Open concerns / flags for the human reviewer

1. **GO is conditional on board content.** Two chains require the staged board to carry **≥2 ranked
   `vend chain "…"` signals**. With 1 signal the run still clears 1 (the floor); with 0 it hits the
   empty-board andon. T-037-02 must stage a real board (it does so as step 1).
2. **Per-cast andon risk is real.** The historical censored rate is non-zero (propose 2/7,
   decompose 4/10), though inflated by synthetic test epics (token:1 envelopes) and pre-E-025
   150k-default casts. A `budget-exhausted` at the *correct* p90 envelope is an honest P7 stop, NOT
   the E-024 price-mismatch no-op — record it truthfully if it occurs. This is the one outcome that
   could make a chain fail to clear despite the GO.
3. **Two records per cleared chain.** Each chain appends propose + decompose records, both
   `intervened:false`. So forward-count arithmetic in T-037-03 is +2 per chain, not +1 — easy to
   misstate. Flagged in preflight §Claim 3.
4. **No over-claim downstream.** One bounded session moves the forward count (1/2 → ~5/6 if 2 chains
   clear) but does **not** meet the ≥10-genuine-forward bar. T-037-03 must name a cadence, not
   declare "forward-confirmed" — the exact E-026 trap this project corrected once.
5. **Actuals vs prediction.** Authorization gates on the predicted p90 price; the wallet debits
   actuals. Realized chain count is ≥1, expected ~2; a 3rd only if both casts run well under p90.

## Bottom line

The bounded live sweep is **viable and de-risked**: priced from the live ledger, affordable (~2
chains), forward-E1-threaded, freshness-clean, and — decisively — auth==exec so it cannot repeat the
E-024 "cleared 0". Hand off to T-037-02 with the ≥2-signal staging precondition and the honest
caveats above.
