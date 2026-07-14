# T-060-02-01 — Structure

The blueprint: file-level changes, the public surface, and the ordering. No code here.

## Files touched

### MODIFIED — `src/ledger/recalibrate.ts`

Add one new section after `fundingEnvelope` (the funding block) and before the reference-class
bias-correction block (`calibrate`), since it composes `recalibrate` and belongs with the
envelope-derivation family. New surface:

1. **`ColdStartEnvelopeResult`** (exported interface)
   - `envelope: Budget` — the per-denomination Σ of the constituent plays' recalibrated envelopes.
   - `source: "measured" | "prior"` — `"measured"` iff every constituent recalibrate was measured.
   - `perPlay: readonly { readonly play: string; readonly result: RecalibrateResult }[]` — the
     breakdown, so a caller can label per-play / inspect confidence without re-deriving.

2. **`coldStartEnvelope(plays, records, tier, prior, opts?)`** (exported function, PURE/TOTAL)
   - Signature per design.md.
   - Reuses the existing `RecalibrateResult`, `RecalibrateOptions`, `recalibrate`, and the
     `Budget`/`ValueTier`/`RunRecord` type imports already at the top of the module — **no new
     imports**.
   - Internal: a private `sumEnvelopes(a, b): Budget` (or an inline reduce) summing `timeMs` and
     `tokens` independently. Kept private — `work.ts` has its own `sumBudgets`; the no-shared-util
     idiom (the module already inlines `totalTokens` rather than importing it) says duplicate the
     two-line sum rather than create a coupling. Mirror the IA-8 "never cross-add axes" comment.

   Doc comment must state: PURE/TOTAL; delegates all percentile/censoring/cold-start semantics to
   `recalibrate` (so it is censored-aware and two-dimension-independent for free); `plays`+`prior`
   are passed in to preserve the run-log ⊥ play / "core never redefines budget policy" decoupling;
   aggregate `source` is all-measured; empty `plays` ⇒ the `prior` floor.

No existing export changes signature; this is purely additive. The module's purity header still
holds (no fs/clock/process introduced).

### MODIFIED — `src/ledger/recalibrate.test.ts`

Add one `describe("coldStartEnvelope — …")` block at the end (after the `calibrate` blocks). Import
`coldStartEnvelope` (and the result type if referenced) from `./recalibrate.ts`. Reuse the existing
`recordOf` fixture factory and a local prior. No new test helpers needed beyond what the file has.

## Test plan shape (full detail in plan.md)

A handful of cases on fabricated ledgers, mirroring the existing fixture style:

- **measured & distinguishable (the AC core):** ≥`COLD_START_MIN_SUCCESSES` successes for each of two
  plays (`propose-epic`, `decompose-epic`) at known token/duration costs ⇒ assert
  `source === "measured"`, the summed `envelope` equals the sum of each play's percentile (so it is
  *read from the ledger*), and it **differs from** the summed hand prior. This is the literal AC.
- **value-tier percentile honored:** the summed tokens equal the per-play tier percentile sum (e.g.
  standard → p90 of each play's success tokens), proving the tier drives it.
- **censored-aware:** add `budget-exhausted`/`timed-out` records with huge costs ⇒ they do NOT inflate
  the measured envelope (right-censored out), proving censoring is inherited.
- **cold-start fallback:** < `minSuccesses` successes ⇒ `source === "prior"` and the envelope is the
  summed prior (the honest, labelled fallback — NOT a hand-picked literal masquerading as measured).
- **mixed provenance:** one play measured, one cold-start ⇒ aggregate `source === "prior"` (a macro
  budget is only as earned as its weakest leg).
- **degenerate `plays = []`:** ⇒ `{ envelope: prior, source: "prior", perPlay: [] }`, no `NaN`.

## Ordering of changes

1. Add `ColdStartEnvelopeResult` + `coldStartEnvelope` to `recalibrate.ts` (compiles standalone).
2. Add the test block to `recalibrate.test.ts`.
3. `bun test src/ledger/recalibrate.test.ts` green, then `bun run check` (the real gate:
   typecheck + lint + full test).

Single atomic commit — additive function + its test are one coherent unit.

## Module boundaries / invariants preserved

- **recalibrate.ts stays PURE & decoupled:** no `src/play/` import (plays passed as strings), no
  `src/shelf/` import (prior passed in), no fs/clock. The function is a pure fold over `recalibrate`.
- **IA-8 denomination separation:** the sum never cross-adds `timeMs` and `tokens`.
- **Quote = price:** the returned `envelope` is the p90 PRICE; no funding headroom folded in
  (`fundingEnvelope` untouched, applied elsewhere). This keeps T-060-02-02's "quote stays the p90
  price" AC honest at the source.
- **Honest provenance:** `source` never reports "measured" when any constituent fell back to prior.

## Out of scope (confirming the DAG edge)

`work.ts`, `cli.ts`, and `examples/templates/hackathon-seed/*` are NOT modified here. Wiring the
derived envelope as the seed default `--budget` is T-060-02-02 (`depends_on: [T-060-02-01]`); it will
import `coldStartEnvelope`, feed it `loadRunLog()`'s records + `budgetForTier("standard")`, and set
the seed default. Keeping those edits out of this card keeps the two tickets on disjoint files.
