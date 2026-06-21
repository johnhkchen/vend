# T-053-01 — Progress

Status: **complete**. Single commit `2311b53`. `bun run check` green (1198 pass, 0 fail).

## Steps executed (per plan.md)

- **Step 1 — band constants (E1):** ✅ `FUNDING_FLOOR_TOKENS = 350_000`,
  `FUNDING_CEILING_TOKENS = 700_000` exported beside `CENSORED_WIDEN_RATE`, each doc-commented in the
  `MEASUREMENT_HEADROOM` style (what / why finite-P7 / the failure it addresses).
- **Step 2 — `FundingOptions` knobs (E2):** ✅ added optional `floorTokens?` / `ceilingTokens?`,
  doc-commented like `headroom`.
- **Step 3 — `bandTokens` helper (E3):** ✅ `bandTokens(tokens, floor, ceiling) =
  positiveInt(min(ceiling, max(floor, tokens)))`, beside `fundDimension`.
- **Step 4 — wire the clamp (E4 + E5):** ✅ resolved `floor`/`ceiling` from `opts` at the top of
  `fundingEnvelope`; banded the TOKEN dimension at BOTH return paths (measured-clean early return and
  under-calibrated widened return); `timeMs` passes through unbanded on both; `widened` computed on
  the **un-banded** tokens (headroom signal preserved).
- **Step 5 — band unit tests:** ✅ new `describe("fundingEnvelope — rational band (T-053-01)")` in
  `recalibrate.test.ts` with the 7 cases (below-floor→350k, above-ceiling→700k, in-band unchanged,
  price untouched, wall-clock untouched, opts override, constants P7).
- **Step 6 — gate + commit:** ✅ `bun run check` green; committed atomically.

## Deviations from plan

1. **A second test file needed the same isolation fix.** plan.md anticipated the T-050-01 tests in
   `recalibrate.test.ts` would hit the new floor; it did NOT anticipate that
   `chain-propose-decompose-core.test.ts` (T-050-02, `fundedStepDefault`) has two back-compat tests
   asserting sub-floor funded values (cold-start `120k×2 = 240k`, and a measured-verbatim ~5k case).
   Both legitimately now floor to 350k.
   **Resolution (same strategy, consistent):** passed an explicit wide band
   `{ funding: { floorTokens: 1, ceilingTokens: Number.MAX_SAFE_INTEGER } }` to those two
   `fundedStepDefault` calls so they keep asserting the HEADROOM contract in isolation. The band is a
   separate contract, covered by the new `recalibrate.test.ts` band cases (and T-053-02 end-to-end).
   This proves the design claim "the band flows through both cast paths automatically — no new
   wiring": the failures appeared precisely because `fundedStepDefault`/`resolveStepBudgets` already
   route through `fundingEnvelope`.

2. **`fundedStepDefault` signature has `tier` before `opts`.** The wide-band opts had to be passed as
   the 5th arg (`…, CHAIN_DEFAULT_TIER, WIDE_BAND`), not the 4th — caught by `tsc`, fixed.

## Files touched

- `src/ledger/recalibrate.ts` — 2 constants, 2 `FundingOptions` fields, `bandTokens` helper, clamp at
  both return paths (the only production change).
- `src/ledger/recalibrate.test.ts` — `WIDE_BAND` const + 4 existing T-050-01 calls widened; new
  T-053-01 band `describe` (7 tests). Imports `FUNDING_FLOOR_TOKENS` / `FUNDING_CEILING_TOKENS`.
- `src/play/chain-propose-decompose-core.test.ts` — `WIDE_BAND` const + 2 back-compat calls widened.

## Verification

- `bun test src/ledger/recalibrate.test.ts` → 53 pass.
- `bun run check` (baml:gen + tsc --noEmit + full `bun test`) → 1198 pass, 0 fail.
- precommit hook → "ok — tests green".

## Scope held

No change to wall-clock funding, `recalibrate`/percentile/`formatEnvelopeLabel`, `canAfford`/`fitNext`,
or any call site in `work.ts`/`resolveStepBudgets` (the band flows through the existing threading).
End-to-end confirmation through the real cast path is T-053-02, intentionally not done here.
