# T-060-02-01 — Design

**Decision:** Add one PURE function `coldStartEnvelope(plays, records, tier, prior, opts?)` to
`src/ledger/recalibrate.ts` that recalibrates each drive play over the run-log tails and sums their
envelopes per-denomination into the seed's cold-start macro budget, carrying honest aggregate
provenance. Prove it with a unit test on fabricated ledger fixtures.

## The shape of the answer

The seed cold-start drive is `vend steer → vend work`; `vend work` casts the propose→decompose
**chain** per signal. The budget that funds **one cold-start clear** is therefore the per-denomination
sum of the two plays' recalibrated envelopes — which is *exactly* what `work.ts` already computes as
its `price` line. So the calibrated cold-start envelope = `Σ recalibrate(play)` over the drive's
plays, at a value tier, against the run-log tails. This is "measured, not hand-picked" by
construction, because every dimension flows out of `recalibrate`.

## Options considered

### Option A — `coldStartEnvelope` in `recalibrate.ts`, plays passed in *(CHOSEN)*

A pure export that loops the given play names through `recalibrate`, sums envelopes
denomination-separately, and reports aggregate `source` (measured iff *every* constituent is
measured) plus the per-play breakdown.

- **Pros:** lands in the canonical home of envelope derivation, beside `recalibrate`/`fundingEnvelope`;
  inherits censored-awareness, the cold-start fallback, and the two-dimension independence for free;
  stays PURE/TOTAL and unit-testable with the existing fixture style; preserves zero-coupling
  (plays + prior passed in, never imported — mirrors recalibrate's own "prior is passed in" rule).
- **Cons:** adds a result type to an already-large module. Acceptable — it is the same family as
  `RecalibrateResult`/`FundingResult` and belongs with them.

### Option B — compute it in `work.ts` / a seed module

`work.ts` already computes the equivalent `price`. Could export that.

- **Rejected:** `work.ts` is IMPURE and explicitly *not* unit-tested (it value-imports the BAML
  native addon via the chain). The AC demands a **test**; the logic must live in a pure, testable
  core. Also couples the derivation to the work gesture, when T-060-02-02 needs to read it for the
  *seed default* independently of a live `vend work` run.

### Option C — a brand-new `src/ledger/cold-start-budget.ts` module

- **Rejected (for now):** a new module for one ~15-line pure function is ceremony. It would re-import
  `recalibrate`, re-declare a sum helper, and re-state the purity header — duplicating recalibrate.ts's
  framing. The function is a recalibrate *composition*; it belongs in recalibrate.ts. (If it later
  grows seed-specific policy it can spin out — the epic's right-sizing note.)

### Option D — single-play recalibrate as "the envelope"

Treat one representative play's recalibrate as the cold-start envelope.

- **Rejected:** under-funds. The cold-start drive casts BOTH propose-epic and decompose-epic; a budget
  sized to one play cannot fund a clear (the wallet authorizes only when price ≤ remaining on both
  axes). The sum is the faithful per-clear cost. (The chosen function still handles the single-play
  case — a one-element `plays` list — so D is a strict subset of A.)

## The chosen function — contract

```ts
export interface ColdStartEnvelopeResult {
  readonly envelope: Budget;                 // per-denomination Σ of the plays' recalibrated envelopes
  readonly source: "measured" | "prior";     // "measured" iff EVERY constituent recalibrate was measured
  readonly perPlay: readonly { readonly play: string; readonly result: RecalibrateResult }[];
}

export function coldStartEnvelope(
  plays: readonly string[],
  records: readonly RunRecord[],
  tier: ValueTier,
  prior: Budget,                             // the per-play hand prior (budgetForTier(tier)) — passed in
  opts: RecalibrateOptions = {},
): ColdStartEnvelopeResult
```

**Semantics**
- For each `play`: `recalibrate(play, records, tier, prior, opts)` → keep `{ play, result }`.
- `envelope` = per-denomination sum of the `result.envelope`s (`timeMs` and `tokens` summed
  independently — IA-8, never cross-add the axes).
- `source` = `"measured"` iff `perPlay.length > 0 && perPlay.every(p => p.result.source ===
  "measured")`. One cold-start play means the macro is not fully earned ⇒ `"prior"`. Honest: the
  aggregate is only as trustworthy as its weakest constituent.
- **Degenerate `plays = []`**: return `{ envelope: prior, source: "prior", perPlay: [] }`. TOTAL — a
  zero-play sum would be `{0,0}` (an invalid Budget); falling back to the single hand prior is the
  sensible floor and never emits a `NaN`/zero dimension. Documented.

**Why this satisfies the AC, point by point**
- *Produced by recalibrate over successful-run tails* — every dimension is a `recalibrate` output;
  no literal budget is ever returned except the explicitly-labelled cold-start `prior` fallback that
  recalibrate itself owns.
- *value-tier percentile, censored-aware* — inherited from `recalibrate` (`TIER_PERCENTILE`,
  `CENSORED_OUTCOMES` right-censoring). Nothing re-implements percentile/censoring here.
- *distinguishable from the hand prior when enough successes exist* — with ≥`minSuccesses` successes
  per play at costs above/below the prior, the summed measured envelope ≠ the summed hand prior, and
  `source === "measured"`. The test asserts both the inequality and `source`.
- *read from the ledger, not literal-coded* — the function takes `records`; against a fabricated
  ledger the result tracks the fixtures, not any constant. (The impure `loadRunLog` is the existing
  shell that feeds it; T-060-02-02 wires `loadRunLog → coldStartEnvelope` for the seed default.)

## What this ticket deliberately does NOT do

- No seed `--budget` wiring, no edits to `examples/templates/hackathon-seed/*` — that is T-060-02-02
  (depends_on this), and folding it in here would cross the DAG edge / file boundary.
- No funding-headroom in the returned value — the quote stays the p90 PRICE (IA-8); per-cast
  `fundingEnvelope` already lives in `work.ts` and is untouched.
- No new percentile/censoring math — pure composition of the proven core.
- No display label — `formatEnvelopeLabel` is reusable per-play if T-060-02-02 wants one.

## Risks / tradeoffs

- *Module size.* recalibrate.ts is long; one more small result type is justified by cohesion (it is a
  recalibrate composition) over a thin new module.
- *Aggregate `source` strictness.* "All-measured" is the honest definition for a macro budget; a
  partially-measured sum mixing one prior dimension would silently over/under-state confidence.
  Documented and tested (mixed → "prior").
- *Tier choice is the caller's.* The function takes `tier`; T-060-02-02 picks `"standard"` (work.ts's
  `PRICE_TIER`, the neutral middle). Keeping it a parameter avoids baking policy into the core.
