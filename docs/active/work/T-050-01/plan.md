# T-050-01 — Plan: ordered, verifiable steps

Small, atomic steps. Each typechecks; tests land with the code they cover so the suite is green at
every commit boundary.

## Step 1 — Add the funding-headroom core to `recalibrate.ts`

Insert, between `formatEnvelopeLabel` (ends `:180`) and the `── Reference-class bias correction`
header (`:182`):

1. A section banner comment (guard-≠-price, the censoring ratchet, IA-14 actuation, the
   does-not-touch-`recalibrate` invariant; cite `budget.ts` `TIMEOUT_HEADROOM`).
2. `export const MEASUREMENT_HEADROOM = 2;` (+ doc comment mirroring `TIMEOUT_HEADROOM`).
3. `export const CENSORED_WIDEN_RATE = 1 / 3;` (+ doc comment naming the IA-14 auto-widen).
4. `export interface FundingOptions` (`window?`, `widenRate?`, `headroom?`).
5. `export interface FundingResult` (`envelope: Budget`, `widened: boolean`).
6. `function fundDimension(priced, censoredActuals, headroom): number` (private; reuses `positiveInt`).
7. `export function fundingEnvelope(play, records, result, opts = {}): FundingResult` per the
   structure-doc flow (scalar gate, per-dimension `max`, `widened` = strictly-above-price in any dim).

**Verify:** `bun run check:typecheck` — clean. No runtime behavior yet exercised; this is a pure add.

## Step 2 — Add the test block to `recalibrate.test.ts`

1. Extend the existing `./recalibrate.ts` import: add `fundingEnvelope`, `MEASUREMENT_HEADROOM`,
   `CENSORED_WIDEN_RATE`.
2. New `describe("fundingEnvelope — measurement-funding guard (T-050-01)")` with the AC cases.

**Test design (each case feeds REAL `recalibrate` output into `fundingEnvelope`):**

- **E-049 shape (AC #3a/#1).** Records: 2 successes (so `< COLD_START_MIN_SUCCESSES` ⇒ `source:
  "prior"`) + one `budget-exhausted` logging `tokens: 264_866`. `result = recalibrate("p", recs,
  "standard", { timeMs: …, tokens: 120_000 })` (cold-start ⇒ envelope = the 120k prior). Then
  `fundingEnvelope`: assert `envelope.tokens === positiveInt(264_866 * 2)` (≥ 265k × headroom) and
  `widened === true`.
- **pure cold-start, no censored history (AC #3b).** Records: empty (or 0 censored). `result` =
  cold-start prior. Assert `envelope.tokens === prior.tokens * MEASUREMENT_HEADROOM`,
  `envelope.timeMs === prior.timeMs * MEASUREMENT_HEADROOM`, `widened === true`.
- **trusted-measured + clean (AC #3c).** ≥3 successes, 0 censored ⇒ `source: "measured"`, rate 0.
  Assert `fundingEnvelope().envelope` deep-equals `result.envelope` and `widened === false`.
- **high-censored-rate auto-widen on `measured` (AC #3d).** ≥3 small successes + enough
  `budget-exhausted`/`timed-out` runs that `censored/(successes+censored) >= 1/3`, each logging a
  large actual. `source` stays `"measured"` (≥3 successes) yet `widened === true` and funding > priced.
- **per-dimension independence.** A censored run whose token actual × headroom exceeds priced tokens
  but whose duration × headroom does NOT exceed priced time (or use unparseable stamps so the time
  dimension has no censored actual but priced already dominates) ⇒ tokens widen, time does not. Assert
  `envelope.tokens > priced.tokens` and `envelope.timeMs === priced.timeMs`.
- **does-not-mutate (AC #2).** Capture `result.envelope` by value; call `fundingEnvelope`; assert
  `result.envelope` is unchanged (guard ≠ price). Also assert `formatEnvelopeLabel(result)` is
  unaffected.
- **totality / positive-int (AC #1).** `fundingEnvelope("p", [], recalibrate("p", [], "leaf", PRIOR))`
  returns positive-int dims, no throw. Degenerate: a censored run with `tokens: 0` ⇒ still positive
  (`positiveInt` floors at 1) and ≥ priced.
- **constants.** `expect(MEASUREMENT_HEADROOM).toBeGreaterThanOrEqual(2)`;
  `expect(CENSORED_WIDEN_RATE).toBeCloseTo(1/3, 10)`.

**Verify:** `bun run check:test` — the new block + full existing suite green.

## Step 3 — Full gate + commit

`bun run check` (baml:gen + typecheck + test). On green, commit `src/ledger/recalibrate.ts`,
`src/ledger/recalibrate.test.ts`, and the work artifacts in one commit.

## Testing strategy

- **Unit only, no live model** (AC explicit): every fixture is a fabricated `RunRecord` via the
  existing `recordOf` writer; `fundingEnvelope` is pure, so the suite fully determines correctness.
- **No integration test in this ticket** — wiring into the cast funding path is T-050-02; there is no
  caller to integration-test here.
- **Coupling guard:** tests feed actual `recalibrate(...)` output into `fundingEnvelope` (not
  hand-mocked `RecalibrateResult`s) so the price→funding seam is exercised exactly as production wires
  it; a drift in `recalibrate`'s shape would fail these tests too.

## Verification criteria (maps to AC)
- AC #1 — `fundingEnvelope` per-dimension `max(priced, maxCensoredActual × headroom)` when
  under-calibrated; `priced` verbatim when trusted; positive-int dims; `widened` surfaced. → E-049,
  cold-start, trusted, per-dim, totality cases.
- AC #2 — no mutation of `envelope`/percentile/`formatEnvelopeLabel`; headroom finite. →
  does-not-mutate + constants cases.
- AC #3 — the five enumerated scenarios. → the five named test cases.
- AC #4 — `bun run check:*` green. → Step 3.

## Risk / rollback
Purely additive (new exports only); rollback is reverting the two files. The only behavioral risk is
a `widened`/gate boundary off-by-one (rate `>=` vs `>`), pinned by the auto-widen case at exactly the
threshold. No external surface, no migration, no fs/clock — nothing to roll back beyond the diff.
