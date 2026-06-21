# T-050-01 — Design: pure funding-headroom core

One decision per open question from research, each grounded in the read code.

## Decision 1 — Signature: `fundingEnvelope(play, records, result, opts?)`

**Chosen.** A free function beside `recalibrate`, taking the same `(play, records)` plus the
already-computed `RecalibrateResult` and an options bag:

```ts
fundingEnvelope(
  play: string,
  records: readonly RunRecord[],
  result: RecalibrateResult,
  opts?: FundingOptions,
): FundingResult            // { envelope: Budget; widened: boolean }
```

**Why this over threading records through `RecalibrateResult`:**
- `RecalibrateResult` is a *return value* consumed by `formatEnvelopeLabel` and every caller of
  `recalibrate`. Bolting `records` onto it would bloat a label/affordability type with the entire
  ledger slice and couple unrelated consumers to data they never read. Rejected.
- The funding fn genuinely needs the raw censored records (their logged `totalTokens`/`wallClockMs`
  magnitudes) — `confidence` carries only *counts*, not magnitudes. So `records` must flow in
  somehow; a parameter is the least-coupled channel and mirrors `recalibrate`'s own signature.
- Reusing `result` (not recomputing the percentile) keeps this a pure *post-processor* of
  `recalibrate` — it cannot drift from or contradict the price. This is the guard-≠-price seam made
  structural: funding is `recalibrate`'s output, transformed, never re-derived.

**Rejected alt — fold headroom into `recalibrate` itself** (return both price and funded envelope):
violates AC #2 (must not mutate `recalibrate`'s envelope / percentile math) and would force every
existing caller/test of `recalibrate` to reckon with a second envelope. A separate fn is additive.

## Decision 2 — "Under-calibrated" is a SCALAR gate; the `max` is PER-DIMENSION

`source` and the confidence counts are scalar (one per `RecalibrateResult`), so the
under-calibration decision is **one boolean**, shared by both dimensions:

```
underCalibrated = result.source === "prior"  OR  censoredRate ≥ CENSORED_WIDEN_RATE
censoredRate    = censored / (successes + censored)      // 0 when the sample is empty
```

- `source === "prior"` ⇒ cold-start: the percentile is the hand prior, provably unearned → widen.
- `censoredRate ≥ threshold` ⇒ runs keep hitting the wall even on a `measured` source → the
  percentile is under-bounding the tail → widen. This is the IA-14 auto-widen the `:14-16` comment
  defers, **actuated**: it reads the rate `recalibrate` already computed.

Only the FLOOR is per-dimension. When under-calibrated, each dimension independently computes
`max(priced_dim, maxCensoredActual_dim × headroom)`; widening may land on tokens but not time (or
vice-versa) depending on which dimension's observed wall exceeds its priced value.

**Why scalar gate, not per-dimension gate:** `source` and `censored` are properties of the run
*outcome*, not of a dimension — a `budget-exhausted` run is censored on tokens, a `timed-out` run on
time, but `recalibrate` already lumps both into one `censored` count and one `source`. Re-deriving a
per-dimension censored rate would mean re-classifying outcomes, duplicating `recalibrate`'s logic,
and risking divergence from the `confidence` the caller already trusts. The scalar gate + per-dim
floor gives the same outcome (a dimension only widens if its own observed actuals warrant it via the
`max`) with zero recomputation. Grounded in `recalibrate.ts:140-141`.

## Decision 3 — Per-dimension funding formula

```
fundDimension(priced, censoredActuals[], headroom):
  floor = censoredActuals.length > 0
            ? max(censoredActuals) × headroom      // clear the observed lower bound
            : priced × headroom                    // pure cold-start, no history to read
  return positiveInt(max(priced, floor))
```

- `max(censoredActuals)` = the largest logged lower bound — the run that burned the most before its
  wall. Clearing `max × headroom` (headroom ≥ 2) gives the next run room to finish ABOVE every
  observed wall and RECORD a success, breaking the ratchet (same logic as `TIMEOUT_HEADROOM`).
- The `priced × headroom` fallback (no censored runs to read) ensures a first cold-start run still
  gets room to record — matches the ticket's explicit cold-start clause and AC #3.
- `max(priced, …)` guarantees funding never drops BELOW the honest price; `positiveInt` honors the
  budget contract (reused from the module, `:94`).
- Censored actuals are read by re-windowing: `forPlay(records, play).slice(-window)` filtered to
  `CENSORED_OUTCOMES`, then `totalTokens` (tokens) / `wallClockMs` filtered non-null (time). Using
  the SAME `window` as `recalibrate` keeps magnitudes and the `confidence` rate consistent (Decision 4).

**Trusted-measured path:** when NOT under-calibrated, return `{ ...priced }` verbatim, `widened:
false`. A well-calibrated play is byte-for-byte unchanged (back-compat, AC #2/#3).

## Decision 4 — `widened` is a single bool = "headroom was actually applied"

```
widened = envelope.tokens > priced.tokens  ||  envelope.timeMs > priced.timeMs
```

Since each funded dimension is `max(priced, floor) ≥ priced`, `widened` is true iff some dimension
came out STRICTLY above its price — i.e. headroom genuinely lifted the funding. This is the honest
reading the ticket asks for ("flags whether headroom was applied, for an honest funding label").

Edge: under-calibrated but the prior/price already exceeds every observed wall × headroom ⇒
`max` picks `priced` in both dims ⇒ `widened: false`. Correct: no headroom was needed, so the label
must not claim one. A per-dimension `widened` was considered and rejected — the ticket's return type
is `widened: boolean`, and a caller logging "funded with headroom" needs one honest bit, not two.

## Decision 5 — Constants, mirroring `budget.ts`

```ts
export const MEASUREMENT_HEADROOM = 2;     // mirrors TIMEOUT_HEADROOM; ≥2, finite (P7)
export const CENSORED_WIDEN_RATE = 1 / 3;  // ~1/3: runs hitting the wall a third of the time ⇒ under-bounding
```

- `MEASUREMENT_HEADROOM = 2`: same warranted factor as `TIMEOUT_HEADROOM` — one factor for the
  class (double the observed wall), not a patch for two data points. Finite ⇒ a bounded guard (P7).
- `CENSORED_WIDEN_RATE = 1/3`: the ticket's suggested ~1/3. With ≥1-in-3 runs censored, the
  percentile over the surviving successes is provably under-bounding the tail. Overridable per call.
- Both exported (testable as documented constants, like `COLD_START_MIN_SUCCESSES`/`TIMEOUT_HEADROOM`).

## Decision 6 — Options bag `FundingOptions`

```ts
interface FundingOptions { window?: number; widenRate?: number; headroom?: number; }
```
`window` defaults to `DEFAULT_WINDOW` (must match the `recalibrate` call that produced `result`);
`widenRate`/`headroom` default to the constants above. Mirrors `RecalibrateOptions`/`CalibrateOptions`.

## What stays untouched (AC #2, explicit)
`recalibrate`, `percentile`, `formatEnvelopeLabel`, `TIER_PERCENTILE`, the bias-correction half of
the module, and all of `budget.ts`. `fundingEnvelope` is purely additive: new constants, two new
exported types, one new exported fn, one private helper (`fundDimension`).
