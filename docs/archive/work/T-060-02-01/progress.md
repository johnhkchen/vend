# T-060-02-01 — Progress

## Done

- **Step 1 — `coldStartEnvelope` added to `src/ledger/recalibrate.ts`** (after `fundingEnvelope`,
  before the bias-correction block). New `ColdStartEnvelopeResult` interface + private `sumEnvelopes`
  helper + the pure `coldStartEnvelope(plays, records, tier, prior, opts?)`. Delegates all
  percentile/censoring/cold-start semantics to `recalibrate`; sums envelopes per-denomination
  (IA-8); aggregate `source` is all-measured; empty `plays` ⇒ the `prior` floor (TOTAL). No new
  imports — reuses the module's existing `Budget`/`ValueTier`/`RunRecord` types and `recalibrate`.

- **Step 2 — test block added to `src/ledger/recalibrate.test.ts`** (`describe("coldStartEnvelope
  …")`, 7 cases): the AC (measured-from-tails, value-tier, distinguishable-from-prior, read-from-
  ledger), tier sensitivity, censored-awareness, cold-start fallback, mixed provenance, degenerate
  empty-plays, single-play. Imported `coldStartEnvelope`; reused the existing `recordOf` fixture and
  the module-level `PRIOR`.

- **Step 3 — gate green.** `bun run check` = baml:gen + `tsc --noEmit` + `bun test`: **1340 pass / 0
  fail** (7 new). Targeted run `bun test src/ledger/recalibrate.test.ts`: 60 pass.

## Deviations from plan

- None of substance. The plan listed an optional inline `sumEnvelopes` vs reduce; implemented as a
  small private `sumEnvelopes` + a `reduce` seed of `{ timeMs: 0, tokens: 0 }` (clean and readable),
  exactly as sketched.
- Confirmed `bun run check` (not just the build/test trio) is the wired gate and ran it whole.

## Remaining

- Nothing for this ticket. Commit, then Review.
- **Downstream (NOT this ticket):** T-060-02-02 imports `coldStartEnvelope`, feeds it
  `loadRunLog()`'s records + `budgetForTier("standard")` over the cold-start chain's plays
  (`["propose-epic", "decompose-epic"]`), and sets the hackathon-seed default `--budget` to the
  result — keeping the quote = p90 price (no funding headroom folded in).
