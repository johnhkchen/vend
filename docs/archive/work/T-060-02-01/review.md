# T-060-02-01 — Review

**Ticket:** derive-cold-start-budget-envelope-from-runlog-tails (S-060-02 · E-060)
**Commit:** `f21b254` — feat(ledger): derive cold-start budget envelope from run-log tails

## What changed

### `src/ledger/recalibrate.ts` (+~55 lines, additive only)
New section after `fundingEnvelope`, before the bias-correction block:
- **`ColdStartEnvelopeResult`** — `{ envelope: Budget; source: "measured" | "prior"; perPlay:
  { play; result: RecalibrateResult }[] }`.
- **`coldStartEnvelope(plays, records, tier, prior, opts?)`** — PURE/TOTAL. Recalibrates each drive
  play over the ledger, sums envelopes per-denomination into one macro `Budget`, reports aggregate
  provenance (measured iff every leg is measured). Empty `plays` ⇒ the `prior` floor.
- Private **`sumEnvelopes(a, b)`** — per-denomination sum (IA-8, never cross-add axes).
- No new imports; no existing export changed. Module purity header still holds (no fs/clock/process).

### `src/ledger/recalibrate.test.ts` (+~70 lines)
One `describe("coldStartEnvelope …")` with 7 cases (below). Imported `coldStartEnvelope`; reused the
existing `recordOf` factory and module-level `PRIOR`.

### `docs/active/work/T-060-02-01/` — RDSPI artifacts (research/design/structure/plan/progress/review).

No other files touched. `work.ts`, `cli.ts`, and `examples/templates/hackathon-seed/*` are
deliberately untouched — wiring the derived value as the seed default is T-060-02-02
(`depends_on: [T-060-02-01]`), so the two cards sit on disjoint files (clean DAG edge).

## Acceptance criteria — met

> A test asserts the cold-start envelope is produced by recalibrate over the run-log successful-run
> tails (value-tier percentile, censored-aware) and is distinguishable from the hand prior when
> enough successes exist; the value is read from the ledger, not literal-coded.

The AC test (`"AC: measured from the tails, value-tier percentile, distinguishable from the hand
prior"`) asserts, on a fabricated ledger with ≥`minSuccesses` successes per play:
- `source === "measured"` (produced over the successful-run tails);
- `envelope` equals the per-denomination Σ of each play's **p90** (value-tier percentile) — and
  equals the independently-computed Σ of per-play `recalibrate`, so the value is **read from the
  ledger, not literal-coded**;
- `envelope ≠` the summed hand prior (**distinguishable** when enough successes exist).

`censored-aware` is its own case (huge `budget-exhausted`/`timed-out` runs do not inflate the
envelope, yet are counted in `confidence.censored`) — inherited from `recalibrate`'s right-censoring.

## Test coverage

`bun test src/ledger/recalibrate.test.ts` → **60 pass / 0 fail** (7 new). Full gate `bun run check`
(baml:gen + `tsc --noEmit` + `bun test`) → **1340 pass / 0 fail**, typecheck clean.

Cases: (1) AC — measured/tier/distinguishable/read-from-ledger; (2) tier sensitivity (keystone p95 >
leaf p75 on both axes); (3) censored-aware (envelope unchanged, censored counted); (4) cold-start
fallback (<minSuccesses ⇒ summed prior, source "prior"); (5) mixed provenance (one leg cold-start ⇒
aggregate "prior"); (6) degenerate empty plays (prior floor, no NaN/zero); (7) single-play (Σ over
one == that play's recalibrate).

## Design notes for the reviewer

- **Why a composition, not new math.** The cold-start drive's `vend work` casts the
  propose→decompose chain, so the per-clear cost is `Σ recalibrate(play)` — identical to the `price`
  line `work.ts` already computes. We reused the proven core verbatim; all percentile/censoring/
  cold-start semantics live in `recalibrate`, so this function inherits IA-12/IA-13 for free and adds
  no statistical surface to audit.
- **Decoupling preserved.** `plays` and `prior` are passed in, never imported — recalibrate.ts stays
  free of `src/play/` (play names) and `src/shelf/` (the `budgetForTier` prior), mirroring
  `recalibrate`'s own "the caller owns the hand prior" rule.
- **Honest provenance.** Aggregate `source` is "measured" only when every leg is — a macro budget is
  only as earned as its weakest constituent (case 5). This prevents a partially-measured sum from
  over-stating confidence.
- **Quote = price (IA-8).** The returned `envelope` is the p90 price; no funding headroom folded in.
  This keeps T-060-02-02's "displayed quote stays the p90 price" AC honest at the source — the
  separate per-cast `fundingEnvelope` guard in `work.ts` is untouched.
- **Dissolves the budget-shape finding (EXPECTED-OUTCOME #2).** At T-058 there were no successes, so
  the cold-start chain priced at the inflated ~120-min hand prior and the denomination-separate
  wallet refused to fund it. Once real successes exist, the measured time is seconds — making the
  tight two-gesture `--budget` fundable. That payoff lands when T-060-02-02 wires the value in.

## Open concerns / limitations

- **None blocking.** The contract is the derivation; a pure unit test on fabricated ledgers is the
  correct and complete proof (the house pattern for `recalibrate`).
- **The live ledger has 1 success per play today** (`.vend/runs.jsonl`), below `minSuccesses` — so
  against the *real* current ledger `coldStartEnvelope` cold-starts to the prior, by design. The
  "measured" path is exercised in tests now and will engage live as the dogfood/seed ledger
  accumulates successes (and definitively at the E-060 closing live re-drive).
- **Tier is the caller's choice.** Kept as a parameter (no baked policy); T-060-02-02 will pass
  `"standard"` to match `work.ts`'s `PRICE_TIER`.
- **No display label** added here (`formatEnvelopeLabel` is reusable per-leg if T-060-02-02 wants an
  honest aggregate confidence string for the seed quote).

## Handoff

Ready for T-060-02-02: `import { coldStartEnvelope } from "src/ledger/recalibrate.ts"`, feed it
`(await loadRunLog()).records`, `["propose-epic", "decompose-epic"]`, `"standard"`, and
`budgetForTier("standard")`; set the hackathon-seed default `--budget` to `result.envelope`.
