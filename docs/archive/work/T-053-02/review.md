# T-053-02 — Review

Handoff for a human reviewer: what changed, the coverage, and the open concerns. The ticket is a
**confirmation** ticket — it proves the E-053 band makes the budget rational *through the real paths*,
adding only assertions (no production change).

## What changed

| File | Change | Lines |
|------|--------|-------|
| `src/play/chain-funding-band-e2e.test.ts` | **created** — 7 tests, 3 `describe`s, 20 `expect` calls | +~150 |
| `src/**` | **none** | — |

Single commit `e945bde`. The band auto-flows via the existing E-050/T-050-02 threading
(`recalibrate` → `fundingEnvelope` inside `fundedStepDefault` / `resolveStepBudgets` / `work.ts`), so
no production code moved — and confirming that *nothing else moved* is half the ticket's point.

## Acceptance criteria — status

- ✅ **AC#1 — propose floor.** A well-calibrated `propose-epic` p90 `169_873` funds at the `350k` floor
  through `fundedStepDefault`, and `resolveStepBudgets({}, …)` casts the step under exactly that banded
  default. The `176_101` tail draw that budget-exhausted the `vend chain` now fits — the halt cannot
  recur. (`AC#1` describe, 2 tests.)
- ✅ **AC#2 — decompose ceiling.** An under-calibrated `decompose-epic` whose funding computes
  `366_500 × 2 = 733_000` is capped at exactly the `700k` ceiling. (`AC#2` describe, 1 test.)
- ✅ **AC#3 — GUARD ≠ PRICE.** The reconstructed `work.ts` price seam authorizes on the unbanded p90 sum
  `289_873` (not the `1_050_000` banded funding sum); `canAfford` / `fitNext` gate on price (a wallet
  between price and funding affords; a wallet below price is refused); `formatEnvelopeLabel` and the
  priced envelope are byte-identical before/after the funding path runs. (`AC#3` describe, 4 tests.)
- ✅ **`bun run check:*` green** — 1205 pass, 0 fail (1198 prior + 7 new, no regressions); tsc clean.

## Test coverage assessment

**Strong on the ticket's three claims.** Each AC maps to explicit assertions on *real composed output*
(no mocks of the units — only fabricated `RunRecord` input, the genuine ledger shape). The fixtures pin
the exact epic-motivating numbers (`169_873` / `176_101` / `366_500`), and each test asserts the
intermediate `recalibrate(...)` price *before* the funded value, so any nearest-rank / fixture drift
fails loudly at the price step rather than silently mis-passing the band step.

**The GUARD ≠ PRICE proof is the highest-value test here** — it is the regression guard the epic most
needs: it would fail if a future change re-banded the price or the authorization base, which is the
exact mistake P7 / IA-8 forbids.

### Coverage gaps / deliberate non-coverage

1. **`work.ts` itself is not executed** — it value-imports the BAML chain addon, so no `bun test` can
   import it. The e2e file reconstructs its price + funding composition (`work.ts:202-218`) from the
   pure cores it calls. This is the house pattern (pure core tested, impure shell proven by smoke), but
   it does mean *the wiring in `work.ts` is verified by inspection + the pure-core equivalence, not by a
   direct test*. If `work.ts`'s composition ever diverges from the reconstruction here, this file would
   not catch it. **Mitigated** by the reconstruction being line-for-line faithful (`sumPrice` mirrors
   the private `sumBudgets`; the same `recalibrate`/`fundingEnvelope` calls in the same order).
2. **Wallet-debits-actuals is asserted only on the authorization half.** The ticket's AC#3 names "debits
   actuals"; that contract is owned by existing `wallet.test.ts` / `spend-core.test.ts` and is unchanged
   by the band, so re-proving it here would duplicate. We assert the *authorize-on-price* half, which is
   what the band could plausibly regress.
3. **Wall-clock banding** is not re-asserted here (T-053-01 owns "time is never banded"); AC#3 keeps the
   wallet's `timeMs` at `MAX_SAFE_INTEGER` so tokens alone decide `canAfford` — intentional, to keep the
   token assertions unconfounded.

## Open concerns / flags for human attention

- **None blocking.** The ticket is complete and green.
- **Minor — fixture duplication.** `recordOf` is now copied in three test files (`recalibrate.test.ts`,
  `chain-propose-decompose-core.test.ts`, and this one) because test files don't export helpers. If a
  fourth consumer appears, consider a shared `src/log/run-record.fixture.ts`. Not worth doing for three.
- **Observation (not this ticket):** memory note `23824` flags `captureNotePlay.budget`'s 8k default is
  stale vs. real burn — a calibration concern in a *different* play, unrelated to the funding band.
  Logged here only so it isn't lost; out of scope for E-053.

## Bottom line

The rational band `[350k, 700k]` is confirmed end-to-end: it floors the too-tight propose (fixing the
`vend chain` halt), caps the runaway decompose, and — critically — does **not** touch the price the
shelf quotes or the price the wallet authorizes on. No production change was required, which is itself
the proof that the band flows through the existing cast-funding threading as designed.
