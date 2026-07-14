# T-050-01 — Progress

## Status: implementation complete, all gates green

## Completed

### Step 1 — funding-headroom core (`src/ledger/recalibrate.ts`)
Added, between `formatEnvelopeLabel` and the T-013-03 bias-correction section, exactly as the
structure doc specified:
- Section banner comment (guard-≠-price, censoring ratchet, IA-14 actuation, does-not-touch invariant).
- `MEASUREMENT_HEADROOM = 2` and `CENSORED_WIDEN_RATE = 1 / 3` (both exported, doc-commented).
- `FundingOptions` (`window?`/`widenRate?`/`headroom?`) and `FundingResult` (`envelope`/`widened`).
- `fundDimension(priced, censoredActuals, headroom)` — private, reuses `positiveInt`.
- `fundingEnvelope(play, records, result, opts?)` — scalar under-calibration gate, per-dimension
  `max(priced, maxCensoredActual × headroom)`, `widened` = strictly-above-price in any dimension.

No existing symbol renamed or removed — purely additive. No new imports needed (`forPlay`,
`totalTokens`, `wallClockMs`, `CENSORED_OUTCOMES`, `positiveInt`, `DEFAULT_WINDOW`, `Budget`,
`RunRecord`, `RecalibrateResult` were all already in scope).

### Step 2 — tests (`src/ledger/recalibrate.test.ts`)
Extended the import; added `describe("fundingEnvelope — measurement-funding guard (T-050-01)")` with
9 cases, each feeding REAL `recalibrate(...)` output into `fundingEnvelope`:
1. E-049 shape (120k prior + 264,866 censored ⇒ funding == 264,866 × 2, widened).
2. Pure cold-start, no censored history ⇒ price × headroom both dims, widened.
3. Trusted-measured + clean ⇒ funding == price, not widened (back-compat).
4. High censored rate (3/6) auto-widens a `measured` source.
5. Per-dimension independence (tokens widen, time does not).
6. Does-not-mutate `recalibrate`'s envelope / `formatEnvelopeLabel`.
7. Totality — empty + degenerate (zero-token censored, unparseable stamps) ⇒ valid positive ints.
8/9. Constants are bounded/finite (≥2, ≈1/3).

### Step 3 — gates
- `bun run check:typecheck` — clean.
- `bun test src/ledger/recalibrate.test.ts` — 46 pass, 0 fail.
- `bun test` (full suite) — **1170 pass, 0 fail** across 77 files.

## Deviations from plan
None. The design held; values computed exactly as the plan predicted (no boundary surprises in the
`>=` rate gate — the 0.4 and 0.5 fixtures land above the 1/3 threshold as intended).

## Remaining (out of scope for this ticket)
- Threading `fundingEnvelope` into the live cast funding path + an honest funding label — **T-050-02**
  (`depends_on: [T-050-01]`). This ticket is the pure core only; there is no caller to wire here.
